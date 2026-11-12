// =====================================================================
// PHMP — خادم الاتصال الفوري (WebSocket) للتراسل والمكالمات
// ---------------------------------------------------------------------
// الغاية: مزامنة الرسائل والمكالمات الصوتية/المرئية بين الزبناء
// والموظفين عبر الأجهزة (الهاتف ↔ الحاسوب) بشكل أنيق وفوري.
//
// مبادئ التصميم (مطلب المالك — قاعدة 8 في WORKLOG):
//   1. لا تخزين إطلاقاً: الرسائل وإشارات المكالمات تُرحَّل في الذاكرة
//      فقط وتُستهلك مباشرة — لا قاعدة بيانات ولا سجلات ولا localStorage.
//   2. المكالمات الصوتية/المرئية تُستهلك مباشرة بين المستخدمين (WebRTC
//      ندّ لند)؛ هذا الخادم يرحّل «الإشارة» فقط (عرض/قبول/ICE/إنهاء).
//   3. المصادقة: الموظفون برمز JWT، والزبناء كضياف معروفين بالاسم
//      والهاتف ضمن صيدلية محددة.
//   3. حماية: تحديد معدل الرسائل، حدود الحجم، ونطاق الضيف محصور
//      في صيدليته.
// =====================================================================
import { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'

const MAX_PAYLOAD = 32 * 1024        // 32 كيلوبايت كحد أقصى للرسالة
const MAX_TEXT = 2000                // طول نص الدردشة
const RATE_LIMIT = 30                // رسالة كحد أقصى…
const RATE_WINDOW = 10 * 1000        // …كل 10 ثوانٍ لكل اتصال
const CALL_RATE_LIMIT = 30           // إشارة مكالمة كحد أقصى…
const CALL_RATE_WINDOW = 60 * 1000   // …كل دقيقة لكل اتصال (حد خفيف بدل الإعفاء الكامل)
const HEARTBEAT_MS = 30 * 1000

// تطبيع رقم الهاتف للمطابقة بين بيانات الطلب وهوية الزبون المتصل
const normalizePhone = (raw) => (typeof raw === 'string' ? raw.replace(/[\s-]/g, '') : '')

export function setupRealtime(httpServer, { verifyJwt, originAllowed, log = () => {} } = {}) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

  // سجل الاتصالات: connId -> conn meta
  const conns = new Map()            // connId -> { ws, kind:'staff'|'customer', userId, pharmacyId, name, role, phone, rooms:Set, lastSeen, rate:[timestamps], callRate:[timestamps] }
  const byUser = new Map()           // userId -> Set<connId>  (موظفون)
  const byPharmacy = new Map()       // pharmacyId -> Set<connId>
  const rooms = new Map()            // roomName -> Set<connId>

  let connSeq = 0
  const connIdOf = (ws) => ws.__phmpConnId

  const sendTo = (ws, payload) => {
    try { if (ws.readyState === 1) ws.send(JSON.stringify(payload)) } catch { /* تجاهل */ }
  }

  const addToGroup = (map, key, connId) => {
    if (!key) return
    if (!map.has(key)) map.set(key, new Set())
    map.get(key).add(connId)
  }
  const removeFromGroup = (map, key, connId) => {
    const set = map.get(key)
    if (set) { set.delete(connId); if (set.size === 0) map.delete(key) }
  }

  const eachConn = (connIds, fn) => {
    for (const id of connIds || []) {
      const meta = conns.get(id)
      if (meta && meta.ws.readyState === 1) fn(meta, id)
    }
  }

  // إحصاء الموظفين المتصلين بصيدلية (للحضور)
  const pharmacyStaffPeers = (pharmacyId, exceptConnId) => {
    const out = []
    eachConn(byPharmacy.get(pharmacyId) || [], (meta, id) => {
      if (id !== exceptConnId && meta.kind === 'staff') {
        out.push({ userId: meta.userId, name: meta.name, role: meta.role })
      }
    })
    return out
  }

  const broadcastPresence = (pharmacyId) => {
    if (!pharmacyId) return
    const staffPeers = pharmacyStaffPeers(pharmacyId)
    eachConn(byPharmacy.get(pharmacyId) || [], (meta) => {
      sendTo(meta.ws, { type: 'presence', pharmacyId, staffOnline: staffPeers })
    })
  }

  // ===== حضور غرف «المساعد» (assistant:<pharmacyId>) عبر الأجهزة =====
  // عند انضمام موظف لغرفة مساعد صيدليته (أو انفصاله) يُعاد حساب الحضور
  // ويُبثّ لأعضاء الغرفة — فترى واجهة الزبون «موظف متصل» على أي جهاز، وليس
  // في نفس المتصفح فقط (كان الأمر محصوراً في احتياط BroadcastChannel). لا يُخزَّن شيء.
  const assistantRoomPresence = (room) => {
    if (!room || !room.startsWith('assistant:')) return
    const staffOnline = []
    eachConn(rooms.get(room) || [], (m) => {
      if (m.kind === 'staff') staffOnline.push({ name: m.name, role: m.role })
    })
    eachConn(rooms.get(room) || [], (m) => {
      sendTo(m.ws, { type: 'presence', room, online: staffOnline.length > 0, staffOnline })
    })
  }

  // ===== صلاحية غرف المساعد (assistant:<pharmacyId>) =====
  // محصورة بأعضاء الصيدلية المعنية: زبناؤها وموظفوها ومالك المنصة حصراً —
  // لا انضمام ولا إرسال من صيدلية أخرى (منع التنصت/الانتحال عبر أسماء الغرف).
  // غرف الطلبات (order:<id>) تعمل بآلية المراقبة الذاتية كما هي.
  const canJoinAssistantRoom = (meta, room) => {
    if (!room || !room.startsWith('assistant:')) return true
    const phId = room.slice('assistant:'.length)
    if (meta.kind === 'staff') {
      return meta.role === 'super_admin' || !meta.pharmacyId || meta.pharmacyId === phId
    }
    if (meta.kind === 'customer') return !!phId && meta.pharmacyId === phId
    return false
  }

  const cleanupConn = (ws) => {
    const id = connIdOf(ws)
    if (!id) return
    const meta = conns.get(id)
    conns.delete(id)
    if (meta) {
      if (meta.userId) removeFromGroup(byUser, meta.userId, id)
      removeFromGroup(byPharmacy, meta.pharmacyId, id)
      if (meta.rooms) for (const room of meta.rooms) {
        removeFromGroup(rooms, room, id)
        // إشعار أعضاء الغرفة برحيل الطرف (يوقف حالة «متصل»)
        eachConn(rooms.get(room) || [], (m) => {
          sendTo(m.ws, { type: 'peer_left', room, who: meta.name })
        })
        // غرف المساعد: إعادة حساب حضور الموظفين بعد رحيل هذا الطرف
        assistantRoomPresence(room)
      }
      broadcastPresence(meta.pharmacyId)
    }
    log(`🔌 انقطع ${id} (${meta?.kind || '?'}) — الإجمالي: ${conns.size}`)
  }

  wss.on('connection', (ws, req) => {
    // ===== فحص أصل WebSocket (نفس قائمة CORS — راجع origins.js) =====
    // المتصفح يرسل Origin إلزامياً؛ الأصل غير المدرج يُرفض فوراً بالإغلاق
    // 4403 (سياسة الأصل) قبل أي مصادقة. الأصل الغائب مسموح: العملاء غير
    // المتصفحين (اختبارات Node، تطبيق أندرويد عبر النفق) لا يرسلونه أصلاً.
    const reqOrigin = req.headers.origin
    if (originAllowed && reqOrigin && !originAllowed(reqOrigin)) {
      log(`⛔ اتصال WS مرفوض (أصل غير مسموح): ${reqOrigin}`)
      ws.close(4403, 'Origin غير مسموح')
      return
    }
    ws.__phmpConnId = `c${++connSeq}`
    conns.set(connIdOf(ws), { ws, kind: 'pending', rooms: new Set(), rate: [] })
    log(`🔌 اتصال جديد ${connIdOf(ws)} من ${req.socket.remoteAddress}`)

    // مهلة المصادقة: 10 ثوانٍ وإلا يُغلق الاتصال
    const authTimer = setTimeout(() => {
      const meta = conns.get(connIdOf(ws))
      if (meta && meta.kind === 'pending') ws.close(4001, 'مهلة المصادقة')
    }, 10 * 1000)

    ws.on('message', (raw, isBinary) => {
      if (isBinary) return
      const id = connIdOf(ws)
      const meta = conns.get(id)
      if (!meta) return
      if (raw.length > MAX_PAYLOAD) return ws.close(4002, 'حجم الرسالة كبير جداً')

      // تحديد المعدل: إشارات المكالمات لها حد خفيف خاص (30/دقيقة لكل اتصال)
      // بدل الإعفاء الكامل السابق — يمنع إغراق الترحيل دون كسر الإشارة الحرجة
      let msg
      try { msg = JSON.parse(raw.toString()) } catch { return }
      if (msg.type === 'call') {
        const now = Date.now()
        meta.callRate = (meta.callRate || []).filter((ts) => now - ts < CALL_RATE_WINDOW)
        if (meta.callRate.length >= CALL_RATE_LIMIT) {
          return sendTo(ws, { type: 'error', message: 'معدل إشارات المكالمات مرتفع — تمهّل قليلاً' })
        }
        meta.callRate.push(now)
      } else if (msg.type !== 'ping') {
        const now = Date.now()
        meta.rate = meta.rate.filter((ts) => now - ts < RATE_WINDOW)
        if (meta.rate.length >= RATE_LIMIT) return sendTo(ws, { type: 'error', message: 'معدل الرسائل مرتفع — تمهّل قليلاً' })
        meta.rate.push(now)
      }

      if (msg.type === 'ping') {
        meta.lastSeen = Date.now()
        return sendTo(ws, { type: 'pong' })
      }

      // ===== المصادقة =====
      if (msg.type === 'auth') {
        clearTimeout(authTimer)
        let identity = null
        try {
          if (msg.token && verifyJwt) {
            const payload = verifyJwt(msg.token)
            identity = { kind: 'staff', userId: payload.id, name: payload.name, role: payload.role, pharmacyId: payload.pharmacyId || null }
          }
        } catch { /* رمز غير صالح — يُعامل كضيف */ }
        if (!identity && msg.guest && typeof msg.guest.name === 'string' && msg.guest.name.trim()) {
          // زبون (مسجل أو عابر) — نطاقه صيدليته المختارة؛ يُحفظ هاتفه في
          // الذاكرة حصراً (لا قاعدة بيانات) لمطابقة بث طلبه الخاص إليه
          identity = {
            kind: 'customer',
            userId: null,
            name: msg.guest.name.trim().slice(0, 60),
            role: 'customer',
            pharmacyId: typeof msg.guest.pharmacyId === 'string' ? msg.guest.pharmacyId : null,
            phone: typeof msg.guest.phone === 'string' ? msg.guest.phone.slice(0, 30) : '',
          }
        }
        if (!identity) return ws.close(4003, 'مصادقة غير صالحة')
        Object.assign(meta, identity)
        if (identity.userId) addToGroup(byUser, identity.userId, id)
        if (identity.pharmacyId) addToGroup(byPharmacy, identity.pharmacyId, id)
        sendTo(ws, {
          type: 'welcome',
          identity: { kind: meta.kind, userId: meta.userId, name: meta.name, role: meta.role },
          staffOnline: pharmacyStaffPeers(meta.pharmacyId, id),
        })
        broadcastPresence(meta.pharmacyId)
        log(`✅ ${id} مصادق: ${meta.kind} ${meta.name}${meta.pharmacyId ? ` @ ${meta.pharmacyId}` : ''}`)
        return
      }

      // كل ما تبقى يتطلب مصادقة
      if (meta.kind === 'pending') return ws.close(4001, 'مصادقة مطلوبة')

      // ===== رسائل الدردشة =====
      if (msg.type === 'chat') {
        const text = typeof msg.text === 'string' ? msg.text.trim().slice(0, MAX_TEXT) : ''
        if (!text) return
        const room = typeof msg.room === 'string' ? msg.room.slice(0, 80) : null
        // اسم العرض: للضيوف يُعتمد الاسم الذي قدمه (مثل اسم صاحب الطلب)،
        // وللموظفين الاسم الموثق من الجلسة حصراً (منع انتحال الأسماء)
        const displayName = meta.kind === 'customer'
          ? (typeof msg.displayName === 'string' && msg.displayName.trim()
              ? msg.displayName.trim().slice(0, 60)
              : meta.name)
          : meta.name
        const envelope = {
          type: 'chat',
          room,
          from: displayName,
          fromKind: meta.kind,
          fromRole: meta.role,
          fromId: meta.userId || id,
          connId: id,
          text,
          // معرّف رسالة العميل: يُرحَّل كما هو ليتحتفظ بمعرّفه عند الوصول عبر
          // أكثر من قناة (فورية + مؤجلة) — المستقبِل يزيل النسخة المكررة
          cid: typeof msg.cid === 'string' ? msg.cid.slice(0, 48) : undefined,
          ts: Date.now(),
        }
        if (room) {
          // غرف المساعد محصورة بصيدلية الطرف (خصوصية): مرفوض من خارجها
          if (!canJoinAssistantRoom(meta, room)) {
            return sendTo(ws, { type: 'error', message: 'هذه الغرفة تخص صيدلية أخرى' })
          }
          // انضمام تلقائي للغرفة عند أول مشاركة
          if (!meta.rooms.has(room)) { meta.rooms.add(room); addToGroup(rooms, room, id) }
          // غرف المساعد: بث الحضور المحدث لأعضاء الغرفة
          if (room.startsWith('assistant:')) assistantRoomPresence(room)
          // التوجيه المباشر يُكرّم حتى مع الغرفة (v2.4.1 — تكافؤ البروتوكول مع
          // الطبقة السحابية): كان حقل `to` يُهمَل كلياً عند وجود غرفة — وفي
          // التراسل المباشر موظف↔موظف كان كل طرف يشتق اسم غرفة مختلفاً
          // فلا تصل الرسالة أبداً. الآن: أعضاء الغرفة + المستهدف صراحةً.
          envelope.to = msg.to || undefined
          const targets = new Set(rooms.get(room) || [])
          targets.delete(id)
          if (typeof msg.to === 'string' && msg.to) {
            if (msg.to.startsWith('user:')) {
              for (const cid of byUser.get(msg.to.slice(5)) || []) targets.add(cid)
            } else if (msg.to.startsWith('client:')) {
              if (conns.has(msg.to.slice(7))) targets.add(msg.to.slice(7))
            } else if (conns.has(msg.to)) {
              targets.add(msg.to)
            }
            targets.delete(id) // المرسل لا يستقبل رسالته
          }
          eachConn(targets, (m) => sendTo(m.ws, envelope))
          // إذا كان المرسل زبوناً ولم يكن أحد من الموظفين في الغرفة بعد:
          // وجّهها أيضاً لكل موظفي الصيدلية المتصلين (كي تصل دون فتح غرفة مسبقاً)
          if (meta.kind === 'customer' && meta.pharmacyId) {
            const staffConns = new Set()
            eachConn(byPharmacy.get(meta.pharmacyId) || [], (m, mid) => {
              if (mid !== id && m.kind === 'staff') staffConns.add(mid)
            })
            targets.forEach((mid) => staffConns.delete(mid))
            eachConn(staffConns, (m, mid) => {
              sendTo(m.ws, envelope)
              if (!m.rooms.has(room)) { m.rooms.add(room); addToGroup(rooms, room, mid) }
            })
          }
        } else if (typeof msg.to === 'string') {
          // موظف ↔ موظف مباشرة، أو ردّ على اتصال محدد (معرف الاتصال الخام أو بصيغة client:)
          const targets = new Set()
          if (msg.to.startsWith('user:')) {
            for (const cid of byUser.get(msg.to.slice(5)) || []) targets.add(cid)
          } else if (msg.to.startsWith('client:')) {
            const t = conns.get(msg.to.slice(7))
            if (t) targets.add(msg.to.slice(7))
          } else if (conns.has(msg.to)) {
            targets.add(msg.to)
          }
          envelope.to = msg.to
          eachConn(targets, (m) => sendTo(m.ws, envelope))
        }
        return
      }

      // ===== انضمام غرفة (دردشة طلب — دون إرسال رسالة) =====
      if (msg.type === 'join' && typeof msg.room === 'string') {
        const room = msg.room.slice(0, 80)
        // غرف المساعد محصورة بصيدلية الطرف: لا انضمام من صيدلية أخرى
        if (!canJoinAssistantRoom(meta, room)) {
          return sendTo(ws, { type: 'error', message: 'لا يمكنك الانضمام لغرفة مساعد صيدلية أخرى' })
        }
        if (!meta.rooms.has(room)) { meta.rooms.add(room); addToGroup(rooms, room, id) }
        sendTo(ws, { type: 'joined', room, members: [...(rooms.get(room) || [])].length })
        // انضمام موظف لغرفة مساعد: بث حضوره للزبناء المنتظرين عبر الأجهزة
        if (room.startsWith('assistant:')) assistantRoomPresence(room)
        return
      }

      // ===== الطلبات (بث بين الأجهزة — دون أي تخزين) =====
      if (msg.type === 'order') {
        const payload = msg.order
        if (!payload || typeof payload !== 'object') return
        const envelope = { type: 'order', action: String(msg.action || 'new'), order: payload, from: meta.name, fromKind: meta.kind, ts: Date.now() }
        const targets = new Set()
        const addRoomMembers = (room) => { for (const cid of rooms.get(room) || []) if (cid !== id) targets.add(cid) }
        const phId = payload.pharmacyId || meta.pharmacyId
        if (msg.action === 'update') {
          // تحديث حالة: صاحب الطلب (غرفة الطلب) + موظفو صيدليته
          if (typeof msg.room === 'string') addRoomMembers(msg.room)
          if (phId) eachConn(byPharmacy.get(phId) || [], (m, mid) => { if (mid !== id && m.kind === 'staff') targets.add(mid) })
        } else {
          // طلب جديد: موظفو صيدلية الطلب حصراً — لا زبناء آخرين (منع تسرب
          // بيانات زبناء آخرين؛ صاحب الطلب يستقبل عبر آلية المطابقة أدناه)
          if (phId) eachConn(byPharmacy.get(phId) || [], (m, mid) => { if (mid !== id && m.kind === 'staff') targets.add(mid) })
          // مالك المنصة (سوبر أدمين بلا صيدلية): يستقبل بث الطلبات الجديدة
          for (const [cid, m] of conns) {
            if (m.kind === 'staff' && m.role === 'super_admin' && cid !== id) targets.add(cid)
          }
        }
        eachConn(targets, (m) => sendTo(m.ws, envelope))
        return
      }

      // ===== مراقبة طلبات الزبون (استقبال تحديثات حالتها) =====
      if (msg.type === 'watch-orders' && Array.isArray(msg.ids)) {
        for (const raw of msg.ids.slice(0, 50)) {
          const room = `order:${String(raw).slice(0, 80)}`
          if (!meta.rooms.has(room)) { meta.rooms.add(room); addToGroup(rooms, room, id) }
        }
        return
      }

      // ===== إشارات المكالمات (WebRTC — ترحيل فقط، الوسائط ندّ لند) =====
      if (msg.type === 'call') {
        const action = String(msg.action || '')
        const callId = String(msg.callId || '').slice(0, 60)
        if (!action || !callId) return
        const displayName = meta.kind === 'customer'
          ? (typeof msg.displayName === 'string' && msg.displayName.trim()
              ? msg.displayName.trim().slice(0, 60)
              : meta.name)
          : meta.name
        const signal = {
          type: 'call', action, callId,
          media: msg.media === 'video' ? 'video' : 'audio',
          from: displayName, fromKind: meta.kind, fromRole: meta.role,
          fromId: meta.userId || id, fromConn: id,
          sdp: msg.sdp || undefined, candidate: msg.candidate || undefined,
          reason: msg.reason || undefined,
        }

        const targets = new Set()
        const to = typeof msg.to === 'string' ? msg.to : null
        if (to === `pharmacy:${meta.pharmacyId}`) {
          // زبون يتصل بالصيدلية: الموظفون المتصلون بها حصراً — لا زبناء
          // آخرين (كان يرنّ لكل زبناء الصيدلية — تشويش وتسرب حضور)
          eachConn(byPharmacy.get(meta.pharmacyId) || [], (m, mid) => { if (mid !== id && m.kind === 'staff') targets.add(mid) })
        } else if (to?.startsWith('user:')) {
          for (const cid of byUser.get(to.slice(5)) || []) targets.add(cid)
        } else if (to?.startsWith('client:')) {
          const t = conns.get(to.slice(7))
          if (t) targets.add(to.slice(7))
        } else if (to && conns.has(to)) {
          // ردّ مباشر على اتصال محدد (معرف الاتصال الخام — من fromConn)
          targets.add(to)
        } else if (to?.startsWith('room:')) {
          // موظف يتصل بزبون غرفة (طلب): أعضاء الغرفة من غير الموظفين
          const room = to.slice(5)
          eachConn(rooms.get(room) || [], (m, mid) => { if (mid !== id && m.kind !== 'staff') targets.add(mid) })
        }
        eachConn(targets, (m) => sendTo(m.ws, signal))

        // عند قبول المكالمة: أوقف رنين بقية موظفي الصيدلية (أول من يرد يفوز)
        if (action === 'answer' && meta.kind === 'staff' && meta.pharmacyId) {
          eachConn(byPharmacy.get(meta.pharmacyId) || [], (m, mid) => {
            if (mid !== id) sendTo(m.ws, { type: 'call', action: 'taken', callId, by: meta.name })
          })
        }
        return
      }
    })

    ws.on('close', () => { clearTimeout(authTimer); cleanupConn(ws) })
    ws.on('error', () => { clearTimeout(authTimer); cleanupConn(ws) })
  })

  // ===== بث من الخادم مباشرة (وليس ترحيل عميل) =====
  // يُستعمل بعد حفظ الطلب في SQLite: يصل فورياً لموظفي صيدلية الطلب
  // المتصلين + مالك المنصة (سوبر أدمين) + صاحب الطلب نفسه (مطابقة الهاتف
  // أو عضوية غرفة الطلب) — مهما كانت واجهتهم (Pages/Vercel/أندرويد) لأن
  // الجميع متصل بنفس الخادم الفوري الموحد.
  // خصوصية: الزبناء الآخرون لا يستقبلون طلبات غيرهم إطلاقاً (كانوا يستقبلونها).
  const broadcastOrder = (order, action = 'new') => {
    if (!order || typeof order !== 'object' || !order.id) return
    const roomName = `order:${String(order.id).slice(0, 80)}`
    const targets = new Set()
    // موظفو صيدلية الطلب حصراً (لا زبناء آخرين — منع تسرب بيانات الزبناء)
    if (order.pharmacyId) {
      eachConn(byPharmacy.get(order.pharmacyId) || [], (m, mid) => {
        if (m.kind === 'staff') targets.add(mid)
      })
    }
    // مالك المنصة (سوبر أدمين بلا صيدلية): يستقبل بث الطلبات أيضاً
    for (const [cid, m] of conns) {
      if (m.kind === 'staff' && m.role === 'super_admin') targets.add(cid)
    }
    // صاحب الطلب نفسه: الزبون المتصل الذي يطابق هاتفه هاتف الطلب —
    // يُضاف إلى غرفة الطلب كي تصله كل التحديثات اللاحقة عبر المراقبة
    const ownerPhone = normalizePhone(order.customer?.phone)
    if (ownerPhone) {
      for (const [cid, m] of conns) {
        if (m.kind === 'customer' && normalizePhone(m.phone) === ownerPhone) {
          if (m.rooms && !m.rooms.has(roomName)) { m.rooms.add(roomName); addToGroup(rooms, roomName, cid) }
          targets.add(cid)
        }
      }
    }
    // أعضاء غرفة الطلب (الزبون المراقب عبر watch-orders + الموظفون)
    for (const cid of rooms.get(roomName) || []) targets.add(cid)
    const envelope = {
      type: 'order', action: action === 'update' ? 'update' : 'new',
      order, from: 'server', fromKind: 'server', ts: Date.now(),
    }
    eachConn(targets, (m) => sendTo(m.ws, envelope))
  }

  // نبض دوري: إسقاط الاتصالات الميتة
  const heartbeat = setInterval(() => {
    for (const [id, meta] of conns) {
      if (meta.kind !== 'pending' && meta.lastSeen && Date.now() - meta.lastSeen > 90 * 1000) {
        try { meta.ws.terminate() } catch { /* تجاهل */ }
        continue
      }
      if (meta.ws.readyState === 1) sendTo(meta.ws, { type: 'heartbeat' })
    }
  }, HEARTBEAT_MS)
  heartbeat.unref()

  log('🟢 خادم الاتصال الفوري جاهز على /ws (الرسائل والمكالمات بلا تخزين)')
  return { wss, conns, broadcastOrder }
}
