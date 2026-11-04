// =====================================================================
// اختبار بروتوكول phmp-realtime محلياً (miniflare عبر wrangler dev)
// ---------------------------------------------------------------------
// يغطي: صحة، مصادقة ضيف/موظف، رفض أصل، دردشة غرفة وDM، خصوصية غرف
// المساعد، بث الطلبات (موظف/سوبر/صاحب الطلب/زبون آخر)، تحديث، تتبع،
// إلغاء، إشارات مكالمات، مزامنة مرآة (سحب/دفع)، حدود المعدل.
// =====================================================================
import WebSocket from 'ws'

const BASE = process.env.PHMP_TEST_BASE || 'http://127.0.0.1:8799'
const JWT_SECRET = 'test-secret-for-local-miniflare-0123456789abcdef'

let passed = 0
let failed = 0
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ✅ ${name}`) }
  else { failed++; console.log(`  ❌ ${name} ${extra}`) }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// عميل WS جاهز: يفتح، يصادق، ويعيد كائناً يجمع الرسائل
function openWs({ auth, origin } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/ws`, { headers: origin ? { Origin: origin } : {} })
    const msgs = []
    const waiters = []
    let welcomed = false
    const timer = setTimeout(() => reject(new Error('ws timeout')), 8000)
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', ...(auth?.token ? { token: auth.token } : {}), ...(auth?.guest ? { guest: auth.guest } : {}) }))
    })
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString())
      msgs.push(msg)
      if (msg.type === 'welcome' && !welcomed) {
        welcomed = true
        clearTimeout(timer)
        resolve({
          ws, msgs, welcome: msg,
          close: () => new Promise((r) => { ws.on('close', () => r()); ws.close() }),
          send: (m) => ws.send(JSON.stringify(m)),
          // انتظار رسالة تطابق شرطاً (مع مهلة)
          waitFor: (pred, ms = 4000) => new Promise((res, rej) => {
            const found = msgs.find(pred)
            if (found) return res(found)
            const t = setTimeout(() => rej(new Error('waitFor timeout')), ms)
            const iv = setInterval(() => {
              const f = msgs.find(pred)
              if (f) { clearTimeout(t); clearInterval(iv); res(f) }
            }, 50)
            setTimeout(() => { clearInterval(iv) }, ms)
          }),
        })
      }
      if (msg.type === 'error' && !welcomed) {
        clearTimeout(timer)
        reject(new Error('auth error: ' + (msg.message || '')))
      }
    })
    ws.on('close', (code) => { if (!welcomed) { clearTimeout(timer); reject(new Error('closed before welcome: ' + code)) } })
    ws.on('error', (e) => { if (!welcomed) { clearTimeout(timer); reject(e) } })
  })
}

// توقيع JWT يدوي HS256 (نفس ما يفعله الخادم بjsonwebtoken)
async function signJwt(payload, secret) {
  const enc = new TextEncoder()
  const b64url = (bytes) => Buffer.from(bytes).toString('base64url')
  const header = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = b64url(enc.encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 })))
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`))
  return `${header}.${body}.${b64url(new Uint8Array(sig))}`
}

async function main() {
  console.log('🧪 اختبار phmp-realtime محلياً —', BASE)

  // ===== 1. الصحة =====
  let res = await fetch(`${BASE}/api/health`)
  ok('GET /api/health = 200', res.status === 200)
  let body = await res.json()
  ok('health ok:true', body.ok === true)

  res = await fetch(`${BASE}/api/health?deep=1`)
  body = await res.json()
  ok('deep health ok:true (DO حي)', body.ok === true && body.sockets !== undefined)

  // ===== 2. رفض مسار مجهول =====
  res = await fetch(`${BASE}/api/unknown`)
  ok('404 لمسار مجهول', res.status === 404)

  // ===== 3. أصل غير مسموح: يُرفض WS =====
  let originRejected = false
  try {
    await openWs({ auth: { guest: { name: 'مخترق' } }, origin: 'https://evil.example.com' })
  } catch (e) {
    originRejected = String(e).includes('403') || String(e).includes('closed before welcome')
  }
  ok('WS بأصل مجهول يُرفض (403 قبل الترقية)', originRejected)

  // ===== 4. مصادقة ضيف + ترحيب =====
  const guest = await openWs({ auth: { guest: { name: 'زبون تجريبي', phone: '+212600000001', pharmacyId: 'ph1' } } })
  ok('ضيف: welcome بالاسم والدور', guest.welcome.identity.kind === 'customer' && guest.welcome.identity.name === 'زبون تجريبي')

  // ===== 5. مصادقة موظف (JWT محلي عبر JWT_SECRET) =====
  const staffToken = await signJwt({ id: 'u-staff1', name: 'صيدلاني تجريبي', role: 'pharmacist', pharmacyId: 'ph1' }, JWT_SECRET)
  const staff = await openWs({ auth: { token: staffToken } })
  ok('موظف: welcome بالاسم والدور والصيدلية', staff.welcome.identity.kind === 'staff' && staff.welcome.identity.role === 'pharmacist')

  // حضور: الضيف يستقبل presence بموظف واحد على الأقل (الرسالة الثانية — بعد دخول الموظف)
  const presence = await guest.waitFor((m) => m.type === 'presence' && m.pharmacyId === 'ph1' && (m.staffOnline || []).some((s) => s.name === 'صيدلاني تجريبي'))
  ok('presence يصل للضيف بعد اتصال موظف', (presence.staffOnline || []).some((s) => s.name === 'صيدلاني تجريبي'))

  // ===== 6. سوبر أدمين =====
  const superToken = await signJwt({ id: 'u-super1', name: 'المالك', role: 'super_admin', pharmacyId: null }, JWT_SECRET)
  const superAdmin = await openWs({ auth: { token: superToken } })
  ok('سوبر أدمين: welcome', superAdmin.welcome.identity.role === 'super_admin')

  // ===== 7. دردشة غرفة طلب: زبون → موظف =====
  const room = 'order:test-ord-1001'
  staff.send({ type: 'join', room })
  await sleep(300)
  guest.send({ type: 'chat', room, text: 'مرحباً، هل الطلب جاهز؟', displayName: 'زبون تجريبي' })
  const chatReceived = await staff.waitFor((m) => m.type === 'chat' && m.room === room && m.text.includes('جاهز'))
  ok('دردشة غرفة: وصلت للموظف باسم المرسل', chatReceived.from === 'زبون تجريبي' && chatReceived.fromKind === 'customer')

  // رد الموظف يصل للزبون
  staff.send({ type: 'chat', room, text: 'نعم قيد التحضير الآن', displayName: 'اسم مزيف' })
  const reply = await guest.waitFor((m) => m.type === 'chat' && m.room === room && m.text.includes('التحضير'))
  ok('رد الموظف يصل للزبون باسم جلسته الموثقة (لا الانتحال)', reply.from === 'صيدلاني تجريبي')

  // ===== 8. DM موظف ↔ موظف =====
  const staff2Token = await signJwt({ id: 'u-staff2', name: 'كاشير تجريبي', role: 'cashier', pharmacyId: 'ph1' }, JWT_SECRET)
  const staff2 = await openWs({ auth: { token: staff2Token } })
  staff.send({ type: 'chat', to: 'user:u-staff2', text: 'تحقق من الطلب 1001 رجاءً' })
  const dm = await staff2.waitFor((m) => m.type === 'chat' && m.to === 'user:u-staff2')
  ok('DM موظف→موظف عبر معرف المستخدم', dm.text.includes('1001') && dm.fromId === 'u-staff1')

  // ===== 9. خصوصية غرف المساعد: زبون صيدلية أخرى مرفوض =====
  const guest2 = await openWs({ auth: { guest: { name: 'زبون صيدلية 2', phone: '+212600000002', pharmacyId: 'ph2' } } })
  guest2.send({ type: 'chat', room: 'assistant:ph1', text: 'تجسس؟' })
  const rejectMsg = await guest2.waitFor((m) => m.type === 'error')
  ok('غرفة مساعد صيدلية أخرى: رفض خادمي', (rejectMsg.message || '').includes('صيدلية أخرى'))

  // غرفة مساعد صيدليته تعمل + حضور الموظف
  const ph1AssistantRoom = 'assistant:ph1'
  guest.send({ type: 'join', room: ph1AssistantRoom })
  await sleep(200)
  staff.send({ type: 'join', room: ph1AssistantRoom })
  const assistantPresence = await guest.waitFor((m) => m.type === 'presence' && m.room === ph1AssistantRoom && m.online === true)
  ok('غرفة المساعد: حضور الموظف يبث للزبون', (assistantPresence.staffOnline || []).length > 0)

  // ===== 10. إنشاء طلب عبر REST + البث الفوري =====
  const orderId = `ord-${Date.now()}`
  res = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: orderId, pharmacyId: 'ph1', total: 120.5,
      customer: { name: 'زبون تجريبي', phone: '+212600000001' },
      items: [{ productId: 'p1', name: 'دواء أ', price: 60.25, quantity: 2 }],
    }),
  })
  body = await res.json()
  ok('POST /api/orders = 201', res.status === 201 && body.ok === true)
  const staffGotOrder = await staff.waitFor((m) => m.type === 'order' && m.action === 'new' && m.order.id === orderId)
  ok('بث الطلب للموظف', staffGotOrder.order.total === 120.5)
  const superGotOrder = await superAdmin.waitFor((m) => m.type === 'order' && m.order.id === orderId)
  ok('بث الطلب للسوبر أدمين', !!superGotOrder)
  const guestGotOwnOrder = await guest.waitFor((m) => m.type === 'order' && m.order.id === orderId)
  ok('بث الطلب لصاحبه (مطابقة الهاتف)', guestGotOwnOrder.order.customer.name === 'زبون تجريبي')
  // زبون آخر لا يستقبل شيئاً
  await sleep(600)
  ok('زبون آخر: لا يستقبل طلب غيره', !guest2.msgs.some((m) => m.type === 'order' && m.order?.id === orderId))

  // ===== 11. طلب مكرر idempotent =====
  res = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: orderId, pharmacyId: 'ph1', total: 120.5,
      customer: { name: 'زبون تجريبي', phone: '+212600000001' },
      items: [{ productId: 'p1', name: 'دواء أ', price: 60.25, quantity: 2 }],
    }),
  })
  body = await res.json()
  ok('طلب مكرر: duplicate:true بلا خطأ', res.status === 200 && body.duplicate === true)

  // ===== 12. جلب الطلبات (موظف) =====
  res = await fetch(`${BASE}/api/orders?pharmacyId=ph1`, { headers: { Authorization: `Bearer ${staffToken}` } })
  const orders = await res.json()
  ok('GET /api/orders للموظف: القائمة تحوي الطلب', Array.isArray(orders) && orders.some((o) => o.id === orderId))

  // بدون توكن: 401
  res = await fetch(`${BASE}/api/orders`)
  ok('GET /api/orders بلا جلسة: 401', res.status === 401)

  // توكن مزيف: 401
  res = await fetch(`${BASE}/api/orders`, { headers: { Authorization: 'Bearer aaa.bbb.ccc' } })
  ok('توكن مزيف: 401', res.status === 401)

  // موظف صيدلية أخرى: لا يرى طلبات ph1
  const staffPh2Token = await signJwt({ id: 'u-staff3', name: 'موظف صيدلية 2', role: 'pharmacist', pharmacyId: 'ph2' }, JWT_SECRET)
  res = await fetch(`${BASE}/api/orders`, { headers: { Authorization: `Bearer ${staffPh2Token}` } })
  const ph2Orders = await res.json()
  ok('عزل الصيدليات: موظف ph2 لا يرى طلبات ph1', Array.isArray(ph2Orders) && !ph2Orders.some((o) => o.id === orderId))

  // ===== 13. تحديث الطلب (PATCH) + البث =====
  res = await fetch(`${BASE}/api/orders/${orderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({ status: 'accepted' }),
  })
  body = await res.json()
  ok('PATCH الحالة = 200 مع history', res.status === 200 && body.order?.status === 'accepted' && (body.order.history || []).length === 1)
  const updateForGuest = await guest.waitFor((m) => m.type === 'order' && m.action === 'update' && m.order.id === orderId && m.order.status === 'accepted')
  ok('تحديث الحالة يبث لصاحب الطلب فورياً', !!updateForGuest)

  // حالة غير صالحة
  res = await fetch(`${BASE}/api/orders/${orderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({ status: 'حالة-غير-صالحة' }),
  })
  ok('حالة غير صالحة: 400', res.status === 400)

  // ===== 14. تتبع بالهاتف =====
  res = await fetch(`${BASE}/api/orders/track?phone=%2B212600000001`)
  const tracked = await res.json()
  ok('track بالهاتف: يجد الطلب بحقول دنيا', Array.isArray(tracked) && tracked.some((o) => o.id === orderId) && !('items' in tracked[0]))

  // هاتف غير صالح
  res = await fetch(`${BASE}/api/orders/track?phone=abc`)
  ok('track بهاتف غير صالح: 400', res.status === 400)

  // ===== 15. إلغاء الطلب من الزبون =====
  res = await fetch(`${BASE}/api/orders/${orderId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+212600000001' }),
  })
  body = await res.json()
  ok('إلغاء بهاتف صاحب الطلب: 200', res.status === 200 && body.ok === true)
  const cancelForStaff = await staff.waitFor((m) => m.type === 'order' && m.order.id === orderId && m.order.status === 'cancelled')
  ok('الإلغاء يبث للموظف', !!cancelForStaff)
  // هاتف خاطئ: 403
  const orderId2 = `ord-${Date.now()}-2`
  await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: orderId2, pharmacyId: 'ph1', total: 50,
      customer: { name: 'زبون تجريبي', phone: '+212600000001' },
      items: [{ productId: 'p1', name: 'دواء ب', price: 50, quantity: 1 }],
    }),
  })
  res = await fetch(`${BASE}/api/orders/${orderId2}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+212600000999' }),
  })
  ok('إلغاء بهاتف خاطئ: 403', res.status === 403)

  // ===== 16. إشارات مكالمات: زبون يتصل بالصيدلية =====
  const callId = `call-${Date.now()}`
  guest.send({ type: 'call', action: 'offer', callId, media: 'audio', to: 'pharmacy:ph1', sdp: 'v=0 fake sdp' })
  const callSignal = await staff.waitFor((m) => m.type === 'call' && m.callId === callId && m.action === 'offer')
  ok('إشارة المكالمة تصل للموظف (وسائط ندّ لند)', callSignal.from === 'زبون تجريبي' && callSignal.media === 'audio')
  // موظف يقبل → «taken» لبقية الموظفين + الإجابة للزبون
  staff.send({ type: 'call', action: 'answer', callId, to: `client:${callSignal.fromConn}`, sdp: 'answer sdp' })
  const answerForGuest = await guest.waitFor((m) => m.type === 'call' && m.callId === callId && m.action === 'answer')
  ok('قبول المكالمة يصل للزبون', !!answerForGuest)
  const takenForStaff2 = await staff2.waitFor((m) => m.type === 'call' && m.callId === callId && m.action === 'taken')
  ok('«taken» يوقف رنين بقية الموظفين', (takenForStaff2.by || '') === 'صيدلاني تجريبي')
  // زبون آخر لا يستقبل إشارة الصيدلية
  ok('زبون آخر: لا يستقبل مكالمة الصيدلية', !guest2.msgs.some((m) => m.type === 'call' && m.callId === callId))

  // ===== 17. مرآة المزامنة (سحب/دفع) =====
  res = await fetch(`${BASE}/api/orders/sync`, { headers: { Authorization: `Bearer ${superToken}` } })
  body = await res.json()
  ok('سحب المرآة (سوبر): يجد الطلبات', res.status === 200 && body.orders.some((o) => o.id === orderId2))
  // سحب بغير سوبر: 401
  res = await fetch(`${BASE}/api/orders/sync`, { headers: { Authorization: `Bearer ${staffToken}` } })
  ok('سحب المرآة لغير السوبر: 401', res.status === 401)
  // دفع طلبات من المسار الاحتياطي
  const pushId = `ord-push-${Date.now()}`
  res = await fetch(`${BASE}/api/orders/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superToken}` },
    body: JSON.stringify({
      orders: [{
        id: pushId, pharmacyId: 'ph1', number: 'CMD-PUSH-1', total: 75,
        customer: { name: 'زبون البوابة', phone: '+212600000003' },
        items: [{ productId: 'p2', name: 'دواء ج', price: 75, quantity: 1 }],
        status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }],
    }),
  })
  body = await res.json()
  ok('دفع المرآة: inserted=1', res.status === 200 && body.inserted === 1)
  // دفعة محدثة لنفس الطلب: updated=1
  res = await fetch(`${BASE}/api/orders/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superToken}` },
    body: JSON.stringify({
      orders: [{
        id: pushId, pharmacyId: 'ph1', number: 'CMD-PUSH-1', total: 80,
        customer: { name: 'زبون البوابة', phone: '+212600000003' },
        items: [{ productId: 'p2', name: 'دواء ج', price: 80, quantity: 1 }],
        status: 'accepted', createdAt: new Date().toISOString(), updatedAt: new Date(Date.now() + 5000).toISOString(),
      }],
    }),
  })
  body = await res.json()
  ok('دفع تحديث أحدث: updated=1', res.status === 200 && body.updated === 1)
  res = await fetch(`${BASE}/api/orders/track?phone=%2B212600000003`)
  const pushed = await res.json()
  const pushedOrder = pushed.find((o) => o.id === pushId)
  ok('الطلب المدفوع يظهر بالتتبع بحالته المحدثة', pushedOrder && pushedOrder.status === 'accepted' && pushedOrder.total === 80)

  // ===== 18. حدود المعدل: سيل دردشة → error =====
  let sawRateError = false
  for (let i = 0; i < 35; i++) {
    guest.send({ type: 'chat', room, text: `سيل ${i}` })
    await sleep(15)
  }
  await sleep(500)
  sawRateError = guest.msgs.some((m) => m.type === 'error' && (m.message || '').includes('معدل'))
  ok('سيل الرسائل: خطأ تحديد المعدل', sawRateError)

  // ===== 19. ping/pong =====
  guest.send({ type: 'ping' })
  const pong = await guest.waitFor((m) => m.type === 'pong', 3000)
  ok('ping → pong', !!pong)

  // ===== 20. peer_left عند انفصال الموظف من غرفة الطلب =====
  staff2.send({ type: 'join', room: 'order:shared-room-1' })
  superAdmin.send({ type: 'join', room: 'order:shared-room-1' })
  await sleep(200)
  await staff2.close()
  const peerLeft = await superAdmin.waitFor((m) => m.type === 'peer_left' && m.room === 'order:shared-room-1')
  ok('peer_left عند انفصال عضو الغرفة', (peerLeft.who || '') === 'كاشير تجريبي')

  // ===== 21. مصادقة غير صالحة: إغلاق 4003 =====
  const badAuth = await new Promise((resolve) => {
    const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/ws`)
    ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', token: 'garbage.token.here' })))
    ws.on('close', (code) => resolve(code))
    setTimeout(() => resolve('timeout'), 5000)
  })
  ok('توكن غير صالح: إغلاق 4003', badAuth === 4003)

  // إغلاق نظيف
  await Promise.allSettled([guest.close(), staff.close(), superAdmin.close(), guest2.close()])

  console.log(`\n📊 النتيجة: ${passed} ناجح، ${failed} فاشل`)
  process.exit(failed ? 1 : 0)
}

main().catch((err) => { console.error('💥 فشل الاختبار:', err.message); process.exit(1) })
