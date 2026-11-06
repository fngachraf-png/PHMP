// =====================================================================
// PHMP — RealtimeHub (Durable Object) — قلب الاتصال الفوري الدائم
// ---------------------------------------------------------------------
// لماذا هذه الطبقة؟ خادم الهاتف خلف النفق نقطة فشل وحيدة: حين ينام الهاتف
// أو يُقتل الترمكس تنقطع الدردشة والمكالمات ومزامنة الطلبات كلياً (قياس
// فعلي: البوابة 200 بينما الأصل 503). هذا الـDO يعمل على حافة Cloudflare
// على مدار الساعة، ويتكلم **نفس بروتوكول** خادم الهاتف حرفياً فلا تتغير
// الواجهات إطلاقاً.
//
// البنية:
//   • WebSocket Hibernation API: المقابس تبقى مفتوحة والـDO ينام لتوفير
//     الموارد؛ ping/pong تلقائي دون إيقاظ، والنبض عبر منبّه دوري.
//   • هوية كل اتصال وغرفه في attachment قابل للتسلسل (ينجو من السبات).
//   • الطلبات في تخزين الـDO (SQLite خلف الكواليس على حساب المالك) بفهارس
//     زمنية/صيدلوية/هاتفية — والمصدر الموحّد للواجهات الثلاث.
//   • المصادقة: JWT ‏HS256 محلياً إن ضُبط السر (JWT_SECRET) — وإلا عبر خادم
//     الهاتف (رابط VPC) مع تخزين مؤقت للنتيجة حتى انتهاء الرمز.
//   • الدردشة وإشارات المكالمات تُرحَّل في الذاكرة فقط ولا تُخزَّن أبداً
//     (قاعدة المالك 8) — المُخزَّن حصراً: الطلبات وذاكرة المصادقة المؤقتة.
// =====================================================================
import {
  MAX_PAYLOAD, MAX_TEXT, RATE_LIMIT, RATE_WINDOW, CALL_RATE_LIMIT, CALL_RATE_WINDOW,
  HEARTBEAT_MS, ORDER_STATUSES, ORDER_JSON_MAX, ORDER_ITEMS_MAX,
  ORDER_RATE_WINDOW, ORDER_RATE_MAX, ORDERS_KEEP_DAYS, ORDERS_MAX, SYNC_PAGE_MAX,
  makeOriginAllowed, normalizePhone, strField, verifyJwtHS256, sha256Hex, jsonResponse,
} from './shared.js'

const PHARMACY_REGISTRY_TTL = 10 * 60 * 1000   // تحديث لائحة الصيدليات كل 10 دقائق
const AUTH_CACHE_PRUNE = 200                    // أقصى ذاكرة مصادقة مؤقتة تُفحص كل منبّه

export class RealtimeHub {
  constructor(state, env) {
    this.state = state
    this.env = env
    this.originAllowed = makeOriginAllowed(env.PHMP_ALLOWED_ORIGINS)
    // ردّ تلقائي على ping دون إيقاظ الـDO (بقاء الاتصال بلا كلفة)
    state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}'),
    )
    // عدادات معدل الطلبات (ذاكرة — تُصفّى في المنبّه الدوري)
    this.orderRate = new Map()
    this.connSeq = 0
    this.booted = false
  }

  async ensureBoot() {
    if (this.booted) return
    this.booted = true
    // منبّه النبض: يُعاد جدولته في كل معالجة
    if (!(await this.state.storage.getAlarm())) {
      await this.state.storage.setAlarm(Date.now() + HEARTBEAT_MS)
    }
  }

  // =====================================================================
  // ===== HTTP داخل الـDO (يوجّهها الموجّه العام src/index.js) =====
  // =====================================================================
  async fetch(request) {
    await this.ensureBoot()
    const url = new URL(request.url)
    const path = url.pathname

    if (request.headers.get('Upgrade') === 'websocket') return this.handleUpgrade(request)
    if (path === '/api/health') return jsonResponse({ ok: true, service: 'phmp-realtime-hub', sockets: this.state.getWebSockets().length, time: new Date().toISOString() })
    if (path === '/api/orders' && request.method === 'POST') return this.restCreateOrder(request, url)
    if (path === '/api/orders' && request.method === 'GET') return this.restListOrders(request, url)
    if (path === '/api/orders/track' && request.method === 'GET') return this.restTrackOrders(request, url)
    if (path === '/api/orders/sync') {
      if (request.method === 'GET') return this.restSyncPull(request, url)
      if (request.method === 'POST') return this.restSyncPush(request)
    }
    const patchMatch = path.match(/^\/api\/orders\/([\w-]+)$/)
    if (patchMatch && request.method === 'PATCH') return this.restUpdateOrder(request, patchMatch[1])
    const cancelMatch = path.match(/^\/api\/orders\/([\w-]+)\/cancel$/)
    if (cancelMatch && request.method === 'POST') return this.restCancelOrder(request, cancelMatch[1])
    return jsonResponse({ error: 'not_found' }, 404)
  }

  // ===== مصادقة الموظفين (JWT) =====
  // 1) إن ضُبط JWT_SECRET: تحقق محلي فوري (بلا اعتماد على أي خادم).
  // 2) وإلا: تحقق عبر خادم الهاتف (VPC) مع تخزين مؤقت لهوية الرمز (هاش
  //    الرمز فقط — لا يُخزَّن الرمز نفسه) حتى انتهائه.
  // النتيجة: مستخدم | null (رمز غير صالح) | 'unavailable' (تعذر التحقق —
  // كالسر غير مضبوط والهاتف نائم/بنسخة قديمة؛ لا يُحسب خطأ المستخدم).
  async verifyStaff(request) {
    const header = request.headers.get('Authorization') || ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    if (!token) return null
    if (this.env.JWT_SECRET) {
      const payload = await verifyJwtHS256(token, this.env.JWT_SECRET)
      if (!payload || !payload.id) return null
      return { id: payload.id, name: payload.name || 'موظف', role: payload.role || 'cashier', pharmacyId: payload.pharmacyId || null }
    }
    const result = await this.verifyTokenViaPhone(token)
    if (result?.payload) {
      return {
        id: result.payload.id, name: result.payload.name || 'موظف',
        role: STAFF_ROLE_OK(result.payload.role) ? result.payload.role : 'cashier',
        pharmacyId: result.payload.pharmacyId || null,
      }
    }
    return result?.invalid ? null : 'unavailable'
  }

  // ===== لائحة الصيدليات (تحقق من وجود صيدلية الطلب) =====
  async getPharmacyIds() {
    const cached = await this.state.storage.get('pharmacies')
    if (cached && Date.now() - cached.at < PHARMACY_REGISTRY_TTL) return cached.ids
    try {
      const res = await this.env.PHMP.fetch(new Request('http://127.0.0.1:3001/api/pharmacies'))
      if (res.ok) {
        const rows = await res.json()
        const ids = (Array.isArray(rows) ? rows : []).map((p) => String(p?.id || '')).filter(Boolean)
        if (ids.length) {
          await this.state.storage.put('pharmacies', { ids, at: Date.now() })
          return ids
        }
      }
    } catch { /* الخادم خلف النفق نائم — نستعمل آخر لائحة معروفة */ }
    return cached?.ids || null // null = لا سجل متاح (خادم نائم ولم نرَه يوماً)
  }

  // =====================================================================
  // ===== إنشاء طلب (REST — نفس منطق خادم الهاتف) =====
  // =====================================================================
  orderRateLimited(ip) {
    const now = Date.now()
    const rec = this.orderRate.get(ip)
    if (!rec || now - rec.start > ORDER_RATE_WINDOW) { this.orderRate.set(ip, { start: now, count: 1 }); return false }
    rec.count += 1
    return rec.count > ORDER_RATE_MAX
  }

  normalizeOrderPayload(order) {
    if (!order || typeof order !== 'object') return { error: 'طلب غير صالح' }
    const id = strField(order.id, 60)
    const pharmacyId = strField(order.pharmacyId, 40)
    if (!/^[\w-]{3,60}$/.test(id)) return { error: 'معرّف الطلب غير صالح' }
    if (!Array.isArray(order.items) || order.items.length < 1 || order.items.length > ORDER_ITEMS_MAX) {
      return { error: 'بنود الطلب غير صالحة' }
    }
    const items = order.items.map((i) => ({
      productId: strField(i?.productId, 60), name: strField(i?.name, 120),
      price: Number.isFinite(Number(i?.price)) ? Number(i.price) : 0,
      quantity: Math.min(Math.max(Number.isFinite(Number(i?.quantity)) ? Number(i.quantity) : 1, 1), 99),
      requiresPrescription: !!i?.requiresPrescription,
    }))
    const customer = {
      name: strField(order.customer?.name || order.customer?.fullName, 60) || 'زبون',
      phone: strField(order.customer?.phone, 30),
      type: order.customer?.type === 'member' ? 'member' : 'guest',
    }
    const status = ORDER_STATUSES.includes(order.status) ? order.status : 'pending'
    const total = Number.isFinite(Number(order.total)) ? Math.max(0, Number(order.total)) : 0
    const full = {
      ...order,
      id, number: strField(order.number, 40) || `CMD-${id}`,
      pharmacyId, customer, items, status, total,
      needsPrescription: !!order.needsPrescription,
      deliveryMethod: strField(order.deliveryMethod, 20) || 'pickup',
      deliveryAddress: strField(order.deliveryAddress, 300),
      subtotal: Number.isFinite(Number(order.subtotal)) ? Number(order.subtotal) : total,
      deliveryFee: Number.isFinite(Number(order.deliveryFee)) ? Number(order.deliveryFee) : 0,
      paymentMethod: strField(order.paymentMethod, 30) || 'on_delivery',
      preferredRole: order.preferredRole === 'pharmacist' ? 'pharmacist' : 'cashier',
      createdAt: order.createdAt || new Date().toISOString(),
    }
    if (full.prescriptionPhoto && typeof full.prescriptionPhoto === 'string' && full.prescriptionPhoto.length > 1_200_000) {
      delete full.prescriptionPhoto
    }
    let serialized
    try { serialized = JSON.stringify(full) } catch { return { error: 'طلب غير قابل للتسلسل' } }
    if (serialized.length > ORDER_JSON_MAX) return { error: 'حجم الطلب كبير جداً' }
    return { full, id, pharmacyId, items, customer, status, total }
  }

  // تخزين الطلب بفهارس أربعة: بالمعرّف، زمنياً، لكل صيدلية، ولكل هاتف زبون
  async putOrder(envelope) {
    const createdAt = String(envelope.createdAt || '')
    const updatedAt = String(envelope.updatedAt || envelope.createdAt || '')
    const value = JSON.parse(JSON.stringify(envelope)) // نسخة مستقلة لكل مفتاح
    await this.state.storage.put({
      [`o:${envelope.id}`]: value,
      [`onc:${createdAt}:${envelope.id}`]: value,
      [`oph:${envelope.pharmacyId}:${createdAt}:${envelope.id}`]: value,
      [`otl:${normalizePhone(envelope.customerPhone)}:${createdAt}:${envelope.id}`]: value,
      [`ou:${updatedAt}:${envelope.id}`]: value,
    })
  }

  async removeOrderKeys(envelope) {
    const createdAt = String(envelope.createdAt || '')
    const updatedAt = String(envelope.updatedAt || envelope.createdAt || '')
    await this.state.storage.delete([
      `o:${envelope.id}`,
      `onc:${createdAt}:${envelope.id}`,
      `oph:${envelope.pharmacyId}:${createdAt}:${envelope.id}`,
      `otl:${normalizePhone(envelope.customerPhone)}:${createdAt}:${envelope.id}`,
      `ou:${updatedAt}:${envelope.id}`,
    ])
  }

  async restCreateOrder(request, url) {
    const ip = request.headers.get('x-phmp-client-ip') || 'unknown'
    if (this.orderRateLimited(ip)) return jsonResponse({ error: 'طلبات كثيرة — أعد المحاولة بعد قليل' }, 429)
    let body
    try { body = await request.json() } catch { return jsonResponse({ error: 'طلب غير صالح' }, 400) }
    const norm = this.normalizeOrderPayload(body)
    if (norm.error) return jsonResponse({ error: norm.error }, 400)

    // التحقق من وجود الصيدلية: صارماً إن توفر سجل حديث، ومتساهلاً (مع وسم)
    // إن كان خادم المالك نائماً — حفظ الطلب أولى من إسقاطه (يُصالح عند المزامنة)
    const knownIds = await this.getPharmacyIds()
    let pharmacyUnverified = false
    if (knownIds) {
      if (!norm.pharmacyId || !knownIds.includes(norm.pharmacyId)) {
        return jsonResponse({ error: 'صيدلية غير موجودة' }, 400)
      }
    } else {
      pharmacyUnverified = true
      if (!norm.pharmacyId) return jsonResponse({ error: 'صيدلية غير موجودة' }, 400)
    }

    if (await this.state.storage.get(`o:${norm.id}`)) {
      return jsonResponse({ ok: true, id: norm.id, duplicate: true })
    }
    const now = new Date().toISOString()
    const full = { ...norm.full, updatedAt: now, ...(pharmacyUnverified ? { pharmacyUnverified: true } : {}) }
    const envelope = {
      id: full.id, number: full.number, pharmacyId: full.pharmacyId,
      customerName: full.customer.name, customerPhone: full.customer.phone,
      status: full.status, total: full.total, itemCount: full.items.length,
      createdAt: full.createdAt, updatedAt: now, data: full,
    }
    await this.putOrder(envelope)
    await this.maybePruneOrders()
    await this.broadcastOrder(full, 'new')
    return jsonResponse({ ok: true, id: full.id, updatedAt: now }, 201)
  }

  // ===== قائمة الطلبات (موظفون — نفس قواعد رؤية خادم الهاتف) =====
  async restListOrders(request, url) {
    const user = await this.verifyStaff(request)
    if (user === 'unavailable') return jsonResponse({ error: 'verify_unavailable' }, 503)
    if (!user) return jsonResponse({ error: 'مصادقة مطلوبة' }, 401)
    let pharmacyId = strField(url.searchParams.get('pharmacyId'), 40)
    const isSuper = user.role === 'super_admin'
    if (!isSuper) pharmacyId = user.pharmacyId
    if (pharmacyId && !isSuper && pharmacyId !== user.pharmacyId) {
      return jsonResponse({ error: 'ليست لديك الصلاحيات اللازمة' }, 403)
    }
    const since = strField(url.searchParams.get('since'), 40)
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit'), 10) || 100, 1), 200)
    const prefix = pharmacyId ? `oph:${pharmacyId}:` : 'onc:'
    const options = { prefix, limit: limit * 3 + 20 } // هامش لفلترة since
    if (since) options.end = `${prefix}${since}` // قبل «منذ» زمنياً
    const entries = [...(await this.state.storage.list(options)).entries()]
      .filter(([k]) => !since || k.slice(prefix.length) >= since)
    let rows = entries.map(([, v]) => this.envelopeToOrder(v))
    if (since) rows = rows.filter((o) => o.updatedAt > since)
    rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return jsonResponse(rows.slice(0, limit))
  }

  envelopeToOrder(v) {
    const d = v?.data && typeof v.data === 'object' ? v.data : {}
    return {
      ...d,
      id: v.id, number: v.number, pharmacyId: v.pharmacyId,
      status: v.status, total: v.total,
      createdAt: v.createdAt, updatedAt: v.updatedAt,
      items: Array.isArray(d.items) ? d.items : [],
      customer: d.customer && typeof d.customer === 'object' ? d.customer : { name: v.customerName, phone: v.customerPhone },
    }
  }

  // ===== تتبع طلبات الزبون (هاتف فقط — حقول دنيا) =====
  async restTrackOrders(request, url) {
    const ip = request.headers.get('x-phmp-client-ip') || 'unknown'
    if (this.orderRateLimited(ip)) return jsonResponse({ error: 'طلبات كثيرة — أعد المحاولة بعد قليل' }, 429)
    const phone = normalizePhone(strField(url.searchParams.get('phone'), 30))
    if (!/^\+?\d{6,20}$/.test(phone)) return jsonResponse({ error: 'رقم هاتف غير صالح' }, 400)
    const entries = await this.state.storage.list({ prefix: `otl:${phone}:`, limit: 50, reverse: true })
    return jsonResponse([...entries.values()].map((v) => ({
      id: v.id, number: v.number, pharmacyId: v.pharmacyId, status: v.status,
      total: v.total, itemCount: v.itemCount, createdAt: v.createdAt, updatedAt: v.updatedAt,
    })))
  }

  // ===== تحديث طلب (موظفون) =====
  async restUpdateOrder(request, orderId) {
    const user = await this.verifyStaff(request)
    if (user === 'unavailable') return jsonResponse({ error: 'verify_unavailable' }, 503)
    if (!user) return jsonResponse({ error: 'مصادقة مطلوبة' }, 401)
    const envelope = await this.state.storage.get(`o:${orderId}`)
    if (!envelope) return jsonResponse({ error: 'الطلب غير موجود' }, 404)
    const isSuper = user.role === 'super_admin'
    if (!isSuper && envelope.pharmacyId !== user.pharmacyId) {
      return jsonResponse({ error: 'هذا الطلب يخص صيدلية أخرى' }, 403)
    }
    let body
    try { body = await request.json() } catch { body = {} }
    const { status, assignedTo, deliveryFee, total, notes, deliveryAddress } = body || {}
    if (status !== undefined && !ORDER_STATUSES.includes(status)) {
      return jsonResponse({ error: 'حالة غير صالحة' }, 400)
    }
    const full = { ...(envelope.data || {}) }
    if (status !== undefined) full.status = status
    if (assignedTo !== undefined) full.assignedTo = strField(assignedTo, 80) || null
    if (deliveryFee !== undefined && Number.isFinite(Number(deliveryFee))) full.deliveryFee = Number(deliveryFee)
    if (total !== undefined && Number.isFinite(Number(total))) full.total = Number(total)
    if (notes !== undefined) full.notes = strField(notes, 500)
    if (deliveryAddress !== undefined) full.deliveryAddress = strField(deliveryAddress, 300)
    const history = Array.isArray(full.history) ? full.history : []
    if (status !== undefined && status !== envelope.status) {
      history.push({ status, at: new Date().toISOString(), by: user.name || 'موظف' })
    }
    full.history = history.slice(-20)
    const now = new Date().toISOString()
    full.updatedAt = now
    await this.removeOrderKeys(envelope) // فهرس ou يتغير بالتحديث — إزالة المفاتيح القديمة ثم الكتابة
    const updated = { ...envelope, status: full.status || envelope.status, total: Number.isFinite(Number(full.total)) ? full.total : envelope.total, updatedAt: now, data: full }
    await this.putOrder(updated)
    const orderOut = { ...full, id: envelope.id, pharmacyId: envelope.pharmacyId }
    await this.broadcastOrder(orderOut, 'update')
    return jsonResponse({ ok: true, id: envelope.id, updatedAt: now, order: orderOut })
  }

  // ===== إلغاء طلب من الزبون (تحقق هاتف صاحب الطلب) =====
  async restCancelOrder(request, orderId) {
    const ip = request.headers.get('x-phmp-client-ip') || 'unknown'
    if (this.orderRateLimited(ip)) return jsonResponse({ error: 'طلبات كثيرة — أعد المحاولة بعد قليل' }, 429)
    const envelope = await this.state.storage.get(`o:${orderId}`)
    if (!envelope) return jsonResponse({ error: 'الطلب غير موجود' }, 404)
    let body
    try { body = await request.json() } catch { body = {} }
    const phone = normalizePhone(strField(body?.phone, 30))
    if (!phone || phone !== normalizePhone(envelope.customerPhone)) {
      return jsonResponse({ error: 'رقم الهاتف لا يطابق صاحب الطلب' }, 403)
    }
    if (envelope.status !== 'pending' && envelope.status !== 'accepted') {
      return jsonResponse({ error: 'الطلب قيد المعالجة — تواصل مع الصيدلية لإلغائه' }, 409)
    }
    const full = { ...(envelope.data || {}) }
    const now = new Date().toISOString()
    const history = Array.isArray(full.history) ? full.history : []
    history.push({ status: 'cancelled', at: now, by: 'customer' })
    full.status = 'cancelled'
    full.cancelledAt = now
    full.cancelledBy = 'customer'
    full.history = history.slice(-20)
    full.updatedAt = now
    await this.removeOrderKeys(envelope)
    await this.putOrder({ ...envelope, status: 'cancelled', updatedAt: now, data: full })
    await this.broadcastOrder({ ...full, id: envelope.id, pharmacyId: envelope.pharmacyId }, 'update')
    return jsonResponse({ ok: true, id: envelope.id, updatedAt: now })
  }

  // ===== مزامنة المرآة مع خادم المالك (SQLite) =====
  // سحب: GET /api/orders/sync?since=ISO (موظف موثق — يوقّع الخادم رمز خدمة)
  async restSyncPull(request, url) {
    const user = await this.verifyStaff(request)
    if (user === 'unavailable') return jsonResponse({ error: 'verify_unavailable' }, 503)
    if (!user || user.role !== 'super_admin') return jsonResponse({ error: 'مصادقة مطلوبة' }, 401)
    const since = strField(url.searchParams.get('since'), 40)
    const options = { prefix: 'ou:', limit: SYNC_PAGE_MAX }
    if (since) options.startAfter = `ou:${since}`
    const entries = await this.state.storage.list(options)
    const orders = [...entries.values()].map((v) => this.envelopeToOrder(v))
    return jsonResponse({ ok: true, orders, count: orders.length })
  }

  // دفع: POST /api/orders/sync {orders:[...]} — طلبات وصلت للخادم عبر المسار
  // الاحتياطي (البوابة) بينما هذه الطبقة كانت غير متاحة: تُرفع هنا ليقبع
  // المصدران متطابقين (idempotent: الأحدث updatedAt فقط يفوز)
  async restSyncPush(request) {
    const user = await this.verifyStaff(request)
    if (user === 'unavailable') return jsonResponse({ error: 'verify_unavailable' }, 503)
    if (!user || user.role !== 'super_admin') return jsonResponse({ error: 'مصادقة مطلوبة' }, 401)
    let body
    try { body = await request.json() } catch { return jsonResponse({ error: 'طلب غير صالح' }, 400) }
    const orders = Array.isArray(body?.orders) ? body.orders.slice(0, SYNC_PAGE_MAX) : []
    let inserted = 0
    let updated = 0
    for (const order of orders) {
      const norm = this.normalizeOrderPayload(order)
      if (norm.error) continue
      const existing = await this.state.storage.get(`o:${norm.id}`)
      const now = norm.full.updatedAt || new Date().toISOString()
      if (existing) {
        if (String(existing.updatedAt || '') >= String(now)) continue // المحلي أحدث
        await this.removeOrderKeys(existing)
        updated += 1
      } else {
        inserted += 1
      }
      const full = { ...norm.full, updatedAt: now }
      await this.putOrder({
        id: full.id, number: full.number, pharmacyId: full.pharmacyId,
        customerName: full.customer.name, customerPhone: full.customer.phone,
        status: full.status, total: full.total, itemCount: full.items.length,
        createdAt: full.createdAt || now, updatedAt: now, data: full,
      })
    }
    return jsonResponse({ ok: true, inserted, updated })
  }

  // =====================================================================
  // ===== WebSocket (Hibernation API) =====
  // =====================================================================
  handleUpgrade(request) {
    const origin = request.headers.get('Origin')
    // فحص الأصل قبل قبول الترقية كلياً (لا سباق: الرسائل لا تُعالج أصلاً
    // لاتصال مرفوض) — نفس سياسة قائمة الأصول في البوابة والخادم المحلي
    if (origin && !this.originAllowed(origin)) {
      return new Response('Origin not allowed', { status: 403 })
    }
    const pair = new WebSocketPair()
    const server = pair[1]
    const connId = `c${++this.connSeq}`
    this.state.acceptWebSocket(server)
    server.serializeAttachment({
      connId, kind: 'pending', userId: null, name: '', role: '', pharmacyId: null, phone: '',
      rooms: [], rate: [], callRate: [], lastSeen: Date.now(),
    })
    // مهلة المصادقة: 10 ثوانٍ وإلا يُغلق (نفس الخادم المحلي)
    setTimeout(() => {
      try {
        const att = server.deserializeAttachment()
        if (att && att.kind === 'pending') server.close(4001, 'مهلة المصادقة')
      } catch { /* السوكيت أُغلق أصلاً */ }
    }, 10 * 1000)
    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  // ===== أدوات على المقابس الحية =====
  eachSocket(fn) {
    for (const ws of this.state.getWebSockets()) {
      let att
      try { att = ws.deserializeAttachment() } catch { continue }
      if (att) fn(ws, att)
    }
  }

  sendTo(ws, payload) {
    try { if (ws.readyState === 1) ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload)) } catch { /* تجاهل */ }
  }

  socketsInRoom(room, exceptConnId) {
    const out = []
    this.eachSocket((ws, att) => {
      if (att.connId !== exceptConnId && att.rooms?.includes(room)) out.push({ ws, att })
    })
    return out
  }

  pharmacyStaff(pharmacyId, exceptConnId) {
    const out = []
    this.eachSocket((ws, att) => {
      if (att.connId !== exceptConnId && att.kind === 'staff' && att.pharmacyId === pharmacyId) out.push({ ws, att })
    })
    return out
  }

  socketByConn(connId) {
    let found = null
    this.eachSocket((ws, att) => { if (att.connId === connId) found = { ws, att } })
    return found
  }

  socketsOfUser(userId) {
    const out = []
    this.eachSocket((ws, att) => {
      if (att.kind === 'staff' && att.userId === userId) out.push({ ws, att })
    })
    return out
  }

  async saveAttachment(ws, att) {
    try { ws.serializeAttachment(att) } catch { /* تجاهل */ }
  }

  joinRoom(ws, att, room) {
    if (!att.rooms.includes(room)) att.rooms.push(room)
    this.saveAttachment(ws, att)
  }

  // ===== حضور الصيدلية (موظفون متصلون) =====
  broadcastPresence(pharmacyId) {
    if (!pharmacyId) return
    const staff = this.pharmacyStaff(pharmacyId)
      .map(({ att }) => ({ userId: att.userId, name: att.name, role: att.role }))
    this.eachSocket((ws, att) => {
      if (att.pharmacyId === pharmacyId) this.sendTo(ws, { type: 'presence', pharmacyId, staffOnline: staff })
    })
  }

  // ===== حضور غرف المساعد =====
  assistantRoomPresence(room) {
    if (!room || !room.startsWith('assistant:')) return
    const members = this.socketsInRoom(room)
    const staffOnline = members.filter(({ att }) => att.kind === 'staff')
      .map(({ att }) => ({ name: att.name, role: att.role }))
    members.forEach(({ ws }) => this.sendTo(ws, { type: 'presence', room, online: staffOnline.length > 0, staffOnline }))
  }

  // نطاق غرف المساعد: أعضاء الصيدلية المعنية حصراً (خصوصية — كما بالخادم)
  canJoinAssistantRoom(att, room) {
    if (!room || !room.startsWith('assistant:')) return true
    const phId = room.slice('assistant:'.length)
    if (att.kind === 'staff') {
      return att.role === 'super_admin' || !att.pharmacyId || att.pharmacyId === phId
    }
    if (att.kind === 'customer') return !!phId && att.pharmacyId === phId
    return false
  }

  // ===== بث الطلب (نفس استهداف خادم الهاتف v2.2.0) =====
  // الموظفون + مالك المنصة + صاحب الطلب (مطابقة الهاتف) + أعضاء غرفة الطلب
  async broadcastOrder(order, action = 'new') {
    if (!order || typeof order !== 'object' || !order.id) return
    const roomName = `order:${String(order.id).slice(0, 80)}`
    const targets = new Map() // connId -> ws
    if (order.pharmacyId) {
      this.pharmacyStaff(order.pharmacyId).forEach(({ ws, att }) => targets.set(att.connId, ws))
    }
    this.eachSocket((ws, att) => {
      if (att.kind === 'staff' && att.role === 'super_admin') targets.set(att.connId, ws)
    })
    const ownerPhone = normalizePhone(order.customer?.phone)
    if (ownerPhone) {
      this.eachSocket((ws, att) => {
        if (att.kind === 'customer' && normalizePhone(att.phone) === ownerPhone) {
          this.joinRoom(ws, att, roomName)
          targets.set(att.connId, ws)
        }
      })
    }
    this.socketsInRoom(roomName).forEach(({ ws, att }) => targets.set(att.connId, ws))
    const envelope = {
      type: 'order', action: action === 'update' ? 'update' : 'new',
      order, from: 'server', fromKind: 'server', ts: Date.now(),
    }
    for (const ws of targets.values()) this.sendTo(ws, envelope)
  }

  // =====================================================================
  // ===== معالجة رسائل المقابس (نفس بروتوكول خادم الهاتف) =====
  // =====================================================================
  async webSocketMessage(ws, raw) {
    let text = raw
    if (raw instanceof ArrayBuffer) text = new TextDecoder().decode(raw)
    else if (Array.isArray(raw)) text = new TextDecoder().decode(new Uint8Array(raw))
    if (typeof text !== 'string' || text.length > MAX_PAYLOAD) {
      return ws.close(4002, 'حجم الرسالة كبير جداً')
    }
    let msg
    try { msg = JSON.parse(text) } catch { return }
    let att
    try { att = ws.deserializeAttachment() } catch { return }
    if (!att) return

    // حد المعدل (كما الخادم: للمكالمات حد خفيف خاص)
    const now = Date.now()
    if (msg.type === 'call') {
      att.callRate = (att.callRate || []).filter((ts) => now - ts < CALL_RATE_WINDOW)
      if (att.callRate.length >= CALL_RATE_LIMIT) {
        return this.sendTo(ws, { type: 'error', message: 'معدل إشارات المكالمات مرتفع — تمهّل قليلاً' })
      }
      att.callRate.push(now)
    } else if (msg.type !== 'ping') {
      att.rate = (att.rate || []).filter((ts) => now - ts < RATE_WINDOW)
      if (att.rate.length >= RATE_LIMIT) {
        return this.sendTo(ws, { type: 'error', message: 'معدل الرسائل مرتفع — تمهّل قليلاً' })
      }
      att.rate.push(now)
    }
    att.lastSeen = now
    await this.saveAttachment(ws, att)

    if (msg.type === 'ping') return this.sendTo(ws, { type: 'pong' })

    // ===== المصادقة =====
    if (msg.type === 'auth') {
      let identity = null
      if (msg.token) {
        let result
        if (this.env.JWT_SECRET) {
          const payload = await verifyJwtHS256(msg.token, this.env.JWT_SECRET)
          result = payload ? { payload } : { invalid: true }
        } else {
          result = await this.verifyTokenViaPhone(msg.token)
        }
        if (result?.payload) {
          const payload = result.payload
          identity = { kind: 'staff', userId: payload.id, name: payload.name || 'موظف', role: payload.role || 'cashier', pharmacyId: payload.pharmacyId || null, phone: '' }
        } else if (result?.unavailable) {
          // الطبقة السحابية لا تستطيع التحقق الآن (سر غير مضبوط + الهاتف
          // نائم/قديم) — ليس خطأ المستخدم: رمز مميز 4005 كي تسقط الواجهة
          // للبوابة بدل إنهاء جلسة موظف سليمة (4003 محجوز للرمز الفاسد)
          return ws.close(4005, 'تعذر التحقق حالياً — القناة الاحتياطية')
        }
      }
      if (!identity && msg.guest && typeof msg.guest.name === 'string' && msg.guest.name.trim()) {
        identity = {
          kind: 'customer', userId: null,
          name: msg.guest.name.trim().slice(0, 60), role: 'customer',
          pharmacyId: typeof msg.guest.pharmacyId === 'string' ? msg.guest.pharmacyId : null,
          phone: typeof msg.guest.phone === 'string' ? msg.guest.phone.slice(0, 30) : '',
        }
      }
      if (!identity) return ws.close(4003, 'مصادقة غير صالحة')
      const newAtt = { ...att, ...identity, rooms: att.rooms || [], rate: att.rate || [], callRate: att.callRate || [], lastSeen: now }
      await this.saveAttachment(ws, newAtt)
      const staffOnline = this.pharmacyStaff(newAtt.pharmacyId, newAtt.connId)
        .map(({ att: a }) => ({ userId: a.userId, name: a.name, role: a.role }))
      this.sendTo(ws, {
        type: 'welcome',
        identity: { kind: newAtt.kind, userId: newAtt.userId, name: newAtt.name, role: newAtt.role },
        staffOnline,
      })
      this.broadcastPresence(newAtt.pharmacyId)
      return
    }

    if (att.kind === 'pending') return ws.close(4001, 'مصادقة مطلوبة')

    // ===== الدردشة =====
    if (msg.type === 'chat') {
      const body = typeof msg.text === 'string' ? msg.text.trim().slice(0, MAX_TEXT) : ''
      if (!body) return
      const room = typeof msg.room === 'string' ? msg.room.slice(0, 80) : null
      const displayName = att.kind === 'customer'
        ? (typeof msg.displayName === 'string' && msg.displayName.trim() ? msg.displayName.trim().slice(0, 60) : att.name)
        : att.name
      const envelope = {
        type: 'chat', room, from: displayName, fromKind: att.kind, fromRole: att.role,
        fromId: att.userId || att.connId, connId: att.connId, text: body,
        // معرّف رسالة العميل (cid) — يُرحَّل كما هو لمنع التكرار لدى المستقبِل
        cid: typeof msg.cid === 'string' ? msg.cid.slice(0, 48) : undefined,
        ts: Date.now(),
      }
      if (room) {
        if (!this.canJoinAssistantRoom(att, room)) {
          return this.sendTo(ws, { type: 'error', message: 'هذه الغرفة تخص صيدلية أخرى' })
        }
        this.joinRoom(ws, att, room)
        if (room.startsWith('assistant:')) this.assistantRoomPresence(room)
        const members = this.socketsInRoom(room, att.connId)
        members.forEach(({ ws: mws }) => this.sendTo(mws, envelope))
        // زبون بلا موظفين في الغرفة بعد: وجّهها لكل موظفي صيدليته المتصلين
        if (att.kind === 'customer' && att.pharmacyId) {
          const inRoom = new Set(this.socketsInRoom(room, att.connId).map(({ att: a }) => a.connId))
          this.pharmacyStaff(att.pharmacyId, att.connId).forEach(({ ws: mws, att: matt }) => {
            if (!inRoom.has(matt.connId)) {
              this.sendTo(mws, envelope)
              this.joinRoom(mws, matt, room)
            }
          })
        }
      } else if (typeof msg.to === 'string') {
        const targets = new Map()
        if (msg.to.startsWith('user:')) {
          this.socketsOfUser(msg.to.slice(5)).forEach(({ ws: tws, att: tatt }) => targets.set(tatt.connId, tws))
        } else {
          const rawId = msg.to.startsWith('client:') ? msg.to.slice(7) : msg.to
          const t = this.socketByConn(rawId)
          if (t) targets.set(rawId, t.ws)
        }
        envelope.to = msg.to
        targets.forEach((tws) => this.sendTo(tws, envelope))
      }
      return
    }

    // ===== انضمام غرفة =====
    if (msg.type === 'join' && typeof msg.room === 'string') {
      const room = msg.room.slice(0, 80)
      if (!this.canJoinAssistantRoom(att, room)) {
        return this.sendTo(ws, { type: 'error', message: 'لا يمكنك الانضمام لغرفة مساعد صيدلية أخرى' })
      }
      this.joinRoom(ws, att, room)
      this.sendTo(ws, { type: 'joined', room, members: this.socketsInRoom(room).length })
      if (room.startsWith('assistant:')) this.assistantRoomPresence(room)
      return
    }

    // ===== ترحيل الطلبات من العميل =====
    if (msg.type === 'order') {
      const payload = msg.order
      if (!payload || typeof payload !== 'object') return
      const envelope = { type: 'order', action: String(msg.action || 'new'), order: payload, from: att.name, fromKind: att.kind, ts: Date.now() }
      const targets = new Map()
      const phId = payload.pharmacyId || att.pharmacyId
      if (msg.action === 'update') {
        if (typeof msg.room === 'string') this.socketsInRoom(msg.room, att.connId).forEach(({ ws: tws, att: tatt }) => targets.set(tatt.connId, tws))
        if (phId) this.pharmacyStaff(phId, att.connId).forEach(({ ws: tws, att: tatt }) => targets.set(tatt.connId, tws))
      } else {
        if (phId) this.pharmacyStaff(phId, att.connId).forEach(({ ws: tws, att: tatt }) => targets.set(tatt.connId, tws))
        this.eachSocket((ws2, a2) => {
          if (a2.kind === 'staff' && a2.role === 'super_admin' && a2.connId !== att.connId) targets.set(a2.connId, ws2)
        })
      }
      targets.forEach((tws) => this.sendTo(tws, envelope))
      return
    }

    // ===== مراقبة طلبات الزبون =====
    if (msg.type === 'watch-orders' && Array.isArray(msg.ids)) {
      for (const rawId of msg.ids.slice(0, 50)) {
        this.joinRoom(ws, att, `order:${String(rawId).slice(0, 80)}`)
      }
      await this.saveAttachment(ws, att)
      return
    }

    // ===== إشارات المكالمات (ترحيل فقط — الوسائط ندّ لند) =====
    if (msg.type === 'call') {
      const action = String(msg.action || '')
      const callId = String(msg.callId || '').slice(0, 60)
      if (!action || !callId) return
      const displayName = att.kind === 'customer'
        ? (typeof msg.displayName === 'string' && msg.displayName.trim() ? msg.displayName.trim().slice(0, 60) : att.name)
        : att.name
      const signal = {
        type: 'call', action, callId,
        media: msg.media === 'video' ? 'video' : 'audio',
        from: displayName, fromKind: att.kind, fromRole: att.role,
        fromId: att.userId || att.connId, fromConn: att.connId,
        sdp: msg.sdp || undefined, candidate: msg.candidate || undefined,
        reason: msg.reason || undefined,
      }
      const targets = new Map()
      const to = typeof msg.to === 'string' ? msg.to : null
      if (to === `pharmacy:${att.pharmacyId}`) {
        this.pharmacyStaff(att.pharmacyId, att.connId).forEach(({ ws: tws, att: tatt }) => targets.set(tatt.connId, tws))
      } else if (to?.startsWith('user:')) {
        this.socketsOfUser(to.slice(5)).forEach(({ ws: tws, att: tatt }) => targets.set(tatt.connId, tws))
      } else if (to) {
        const rawId = to.startsWith('client:') ? to.slice(7) : to
        const t = this.socketByConn(rawId)
        if (t) targets.set(rawId, t.ws)
      }
      if (to?.startsWith('room:')) {
        const room = to.slice(5)
        this.socketsInRoom(room, att.connId).forEach(({ ws: tws, att: tatt }) => {
          if (tatt.kind !== 'staff') targets.set(tatt.connId, tws)
        })
      }
      targets.forEach((tws) => this.sendTo(tws, signal))
      // أول موظف يردّ يوقف رنين زملائه
      if (action === 'answer' && att.kind === 'staff' && att.pharmacyId) {
        this.pharmacyStaff(att.pharmacyId, att.connId).forEach(({ ws: tws }) => {
          this.sendTo(tws, { type: 'call', action: 'taken', callId, by: att.name })
        })
      }
      return
    }
  }

  // تحقق رمز عبر خادم الهاتف (VPC) — يعيد {payload} أو {invalid} أو {unavailable}
  async verifyTokenViaPhone(token) {
    const cacheKey = `ac:${await sha256Hex(token)}`
    const cached = await this.state.storage.get(cacheKey)
    if (cached) {
      if (cached.exp && cached.exp < Date.now()) { await this.state.storage.delete(cacheKey); return { invalid: true } }
      return { payload: cached.payload }
    }
    try {
      const res = await this.env.PHMP.fetch(new Request('http://127.0.0.1:3001/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }))
      // الهاتف نائم أو بنسخة قديمة بلا نقطة التحقق: ليست مشكلة الرمز —
      // نميّزها كي لا تُنهي الواجهة جلسة موظف سليمة (4005 بدل 4003)
      if (res.status === 404 || res.status === 502 || res.status === 503) return { unavailable: true }
      if (res.status === 401 || res.status === 403) return { invalid: true }
      if (!res.ok) return { unavailable: true }
      const data = await res.json()
      if (!data?.ok || !data?.user?.id) return { invalid: true }
      const payload = { id: data.user.id, name: data.user.name, role: data.user.role, pharmacyId: data.user.pharmacyId || null }
      let exp = Date.now() + 30 * 60 * 1000
      try {
        const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        if (p?.exp) exp = Math.min(exp, p.exp * 1000)
      } catch { /* تجاهل */ }
      await this.state.storage.put(cacheKey, { payload, exp })
      return { payload }
    } catch {
      return { unavailable: true }
    }
  }

  // ===== انقطاع/خطأ مقبس: تنظيف وإشعار الغرف =====
  async webSocketClose(ws) { await this.cleanupSocket(ws) }
  async webSocketError(ws) { await this.cleanupSocket(ws) }

  async cleanupSocket(ws) {
    let att
    try { att = ws.deserializeAttachment() } catch { return }
    if (!att) return
    for (const room of att.rooms || []) {
      this.socketsInRoom(room).forEach(({ ws: mws }) => {
        this.sendTo(mws, { type: 'peer_left', room, who: att.name })
      })
      this.assistantRoomPresence(room)
    }
    this.broadcastPresence(att.pharmacyId)
  }

  // =====================================================================
  // ===== المنبّه الدوري: نبض + صيانة =====
  // =====================================================================
  async alarm() {
    // نبض الحياة لكل المقابس الموثقة (يرد العميل بping — يُجاب تلقائياً)
    this.eachSocket((ws) => {
      if (ws.readyState === 1) this.sendTo(ws, { type: 'heartbeat' })
    })
    // تصفية عدادات معدل الطلبات المنتهية
    const now = Date.now()
    for (const [ip, rec] of this.orderRate) {
      if (now - rec.start > ORDER_RATE_WINDOW) this.orderRate.delete(ip)
    }
    // صيانة يومية: حذف الطلبات الأقدم من 120 يوماً + تقليم ذاكرة المصادقة
    try {
      const lastPrune = (await this.state.storage.get('meta:lastPrune')) || 0
      if (now - lastPrune > 24 * 60 * 60 * 1000) {
        await this.state.storage.put('meta:lastPrune', now)
        await this.pruneOldOrders()
        const authKeys = [...(await this.state.storage.list({ prefix: 'ac:', limit: AUTH_CACHE_PRUNE })).keys()]
        for (const key of authKeys) {
          const rec = await this.state.storage.get(key)
          if (!rec || (rec.exp && rec.exp < now)) await this.state.storage.delete(key)
        }
      }
    } catch { /* صيانة أفضل جهد */ }
    await this.state.storage.setAlarm(now + HEARTBEAT_MS)
  }

  async maybePruneOrders() {
    try {
      const count = (await this.state.storage.list({ prefix: 'onc:', limit: ORDERS_MAX + 1 })).size
      if (count > ORDERS_MAX) await this.pruneOldOrders(true)
    } catch { /* تجاهل */ }
  }

  // حذف الطلبات المتقادمة (كل الفهارس) — أو الأقدم تجاوزاً للسقف
  async pruneOldOrders(forceTrim = false) {
    const cutoff = new Date(Date.now() - ORDERS_KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const stale = []
    for (const key of (await this.state.storage.list({ prefix: 'onc:', end: `onc:${cutoff}` })).keys()) {
      stale.push(key)
    }
    if (forceTrim) {
      // الأحدث أولاً عكسياً: كل ما بعد السقف يُحذف
      const all = [...(await this.state.storage.list({ prefix: 'onc:', reverse: true, limit: ORDERS_MAX + 200 })).keys()]
      for (const key of all.slice(ORDERS_MAX)) stale.push(key)
    }
    for (const oncKey of [...new Set(stale)]) {
      const envelope = await this.state.storage.get(oncKey)
      if (envelope) await this.removeOrderKeys(envelope)
      else await this.state.storage.delete(oncKey)
    }
  }
}

// أدوار صالحة لنتائج التحقق عبر الهاتف (منع حقن أدوار مجهولة)
function STAFF_ROLE_OK(role) {
  return ['super_admin', 'admin', 'accountant', 'pharmacist', 'cashier'].includes(role)
}
