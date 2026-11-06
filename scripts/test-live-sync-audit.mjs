// =====================================================================
// PHMP — فحص حي لمزامنة الإنتاج (بالقياس) — يُحاكي سيناريوهات الشكوى:
//   1) مصادقة موظف على الطبقة السحابية (تعتمد JWT_SECRET أو هاتف المالك)
//   2) دردشة زبون → موظف عبر غرفة طلب
//   3) دردشة موظف → زبون
//   4) طلب جديد (REST) يصل الموظف بثاً فورياً
//   5) تحديث حالة الطلب يصل الزبون المراقب
//   6) دردشة موظف → موظف (user:<id>)
// =====================================================================
import WebSocket from 'ws'

const LIVE = 'https://phmp-realtime.balbolghol-ai.workers.dev'
const GATEWAY = 'https://phmp-api.balbolghol-ai.workers.dev'

let passed = 0, failed = 0
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ✅ ${name}`) }
  else { failed++; console.log(`  ❌ ${name} ${extra ? '— ' + extra : ''}`) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function connect(authMsg, { timeout = 12000 } = {}) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${LIVE.replace(/^http/, 'ws')}/ws`)
    const msgs = []
    const state = { ws, msgs, welcomed: false, closedCode: null }
    const timer = setTimeout(() => { if (!state.welcomed) resolve(state) }, timeout)
    ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', ...authMsg })))
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString())
      msgs.push(msg)
      if (msg.type === 'welcome' && !state.welcomed) {
        state.welcomed = true
        clearTimeout(timer)
        resolve(state)
      }
      if (msg.type === 'heartbeat') { try { ws.send(JSON.stringify({ type: 'ping' })) } catch { /* ignore */ } }
    })
    ws.on('close', (code) => { state.closedCode = code; clearTimeout(timer); if (!state.welcomed) resolve(state) })
    ws.on('error', () => { /* onclose سيتولى */ })
    state.send = (m) => { try { ws.send(JSON.stringify(m)) } catch { /* ignore */ } }
    state.waitFor = async (pred, ms = 6000) => {
      const end = Date.now() + ms
      while (Date.now() < end) {
        const found = msgs.find(pred)
        if (found) return found
        await sleep(120)
      }
      return msgs.find(pred) || null
    }
  })
}

// ===== 1) دخول موظف عبر البوابة لاستخراج JWT حقيقي =====
console.log('— 1) دخول موظف عبر البوابة (test/Tch@10mn)')
let token = null, staffId = null
try {
  const res = await fetch(`${GATEWAY}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'test', password: 'Tch@10mn' }),
  })
  const data = await res.json().catch(() => ({}))
  ok('دخول الموظف 200', res.ok, `status=${res.status} ${JSON.stringify(data).slice(0, 120)}`)
  token = data.token || null
  staffId = data.user?.id || null
  if (data.user) console.log(`     user: id=${data.user.id} name=${data.user.name} role=${data.user.role} pharmacyId=${data.user.pharmacyId}`)
  var STAFF_PH = data.user?.pharmacyId || 'ph2'
} catch (e) {
  ok('دخول الموظف 200', false, e.message)
}

if (!token) { console.log('لا رمز — توقف'); process.exit(1) }

// ===== 2) مصادقة الموظف على الطبقة السحابية =====
console.log('— 2) مصادقة الموظف على الطبقة السحابية (wss://phmp-realtime…/ws)')
const staff = await connect({ token })
ok('ترحيب الطبقة السحابية للموظف', staff.welcomed, `closedCode=${staff.closedCode}`)
const welcomeMsg = staff.msgs.find((m) => m.type === 'welcome')
if (welcomeMsg) console.log(`     identity: ${JSON.stringify(welcomeMsg.identity)}`)
else if (staff.closedCode) console.log(`     أُغلق برمز ${staff.closedCode} (4005=تعذر التحقق عبر الهاتف، 4003=رمز فاسد)`)

if (!staff.welcomed) { console.log('فشلت مصادقة الموظف على السحابية — هذا هو الخلل الجذري المحتمل'); process.exit(1) }

// ===== 3) دردشة زبون → موظف عبر غرفة طلب =====
console.log('— 3) دردشة زبون → موظف عبر غرفة طلب')
const guest = await connect({ guest: { name: 'زبون فحص', phone: '+212600110022', pharmacyId: STAFF_PH } })
ok('ترحيب الزبون', guest.welcomed, `closedCode=${guest.closedCode}`)
if (guest.welcomed) {
  const ROOM = 'order:audit-' + Date.now()
  staff.send({ type: 'join', room: ROOM })
  await sleep(400)
  guest.send({ type: 'chat', room: ROOM, text: 'مرحبا، هل الدواء متوفر؟', displayName: 'زبون فحص' })
  const got = await staff.waitFor((m) => m.type === 'chat' && m.text?.includes('متوفر'), 6000)
  ok('رسالة الزبون وصلت الموظف عبر السحابية', !!got, got ? '' : 'لم تصل خلال 6 ثوانٍ')
  // ===== 4) رد الموظف → الزبون =====
  staff.send({ type: 'chat', room: ROOM, text: 'نعم متوفر، أهلاً بك' })
  const got2 = await guest.waitFor((m) => m.type === 'chat' && m.text?.includes('أهلاً'), 6000)
  ok('رد الموظف وصل الزبون عبر السحابية', !!got2)
} else {
  ok('رسالة الزبون وصلت الموظف عبر السحابية', false, 'الزبون لم يُرحَّب')
  ok('رد الموظف وصل الزبون عبر السحابية', false, 'الزبون لم يُرحَّب')
}

// ===== 5) طلب جديد REST → بث فوري للموظف =====
console.log('— 5) طلب جديد عبر REST يُبث فورياً للموظف')
const orderId = 'ord-audit-' + Date.now()
const orderPayload = {
  id: orderId, number: 'CMD-AUDIT-' + Date.now().toString().slice(-5),
  pharmacyId: STAFF_PH,
  customer: { name: 'زبون فحص', phone: '+212600110022', type: 'guest' },
  items: [{ productId: 'doliprane-1000', name: 'DOLIPRANE 1000mg', price: 15.5, quantity: 2, requiresPrescription: false }],
  total: 31, status: 'pending', createdAt: new Date().toISOString(),
  deliveryMethod: 'pickup', paymentMethod: 'on_delivery', preferredRole: 'cashier',
}
let created = false
try {
  const res = await fetch(`${LIVE}/api/orders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderPayload),
  })
  const data = await res.json().catch(() => ({}))
  created = res.status === 201 || data.duplicate === true
  ok('حفظ الطلب على السحابية 201', created, `status=${res.status} ${JSON.stringify(data).slice(0, 140)}`)
} catch (e) { ok('حفظ الطلب على السحابية 201', false, e.message) }
const orderMsg = await staff.waitFor((m) => m.type === 'order' && m.order?.id === orderId, 6000)
ok('بث الطلب وصل الموظف لحظياً', !!orderMsg, orderMsg ? `action=${orderMsg.action}` : 'لم يصل خلال 6 ثوانٍ')

// ===== 6) الزبون يراقب طلبه ويستلم تحديث الحالة =====
if (guest.welcomed) {
  guest.send({ type: 'watch-orders', ids: [orderId] })
  await sleep(400)
  const res2 = await fetch(`${LIVE}/api/orders/${orderId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'accepted' }),
  })
  ok('تحديث حالة الطلب 200', res2.ok, `status=${res2.status}`)
  const upd = await guest.waitFor((m) => m.type === 'order' && m.action === 'update' && m.order?.id === orderId, 6000)
  ok('تحديث الحالة وصل الزبون المراقب لحظياً', !!upd, upd ? `status=${upd.order?.status}` : 'لم يصل خلال 6 ثوانٍ')
} else {
  ok('تحديث حالة الطلب 200', false, 'الزبون غير متصل')
  ok('تحديث الحالة وصل الزبون المراقب لحظياً', false, 'الزبون غير متصل')
}

// ===== 7) مصادقة موظف ثانٍ + دردشة موظف↔موظف =====
console.log('— 7) دردشة موظف → موظف (user:<id>)')
let token2 = null
try {
  const res = await fetch(`${GATEWAY}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Tch@10mn' }),
  })
  const data = await res.json().catch(() => ({}))
  token2 = data.token || null
  if (data.user) console.log(`     staff2: id=${data.user.id} role=${data.user.role} pharmacyId=${data.user.pharmacyId}`)
} catch { /* ignore */ }
if (token2 && staffId) {
  const staff2 = await connect({ token: token2 })
  ok('ترحيب الموظف الثاني', staff2.welcomed, `closedCode=${staff2.closedCode}`)
  if (staff2.welcomed) {
    staff2.send({ type: 'chat', to: `user:${staffId}`, text: 'سلام، تحقق من الطلب الجديد' })
    const got3 = await staff.waitFor((m) => m.type === 'chat' && m.text?.includes('الطلب الجديد'), 6000)
    ok('رسالة موظف→موظف عبر السحابية', !!got3, got3 ? '' : `منId المرسل؟ لم تصل خلال 6ث (staff1 id=${staffId})`)
  } else ok('رسالة موظف→موظف عبر السحابية', false, 'الموظف الثاني لم يُرحَّب')
} else {
  ok('ترحيب الموظف الثاني', false, 'لم يُحصل على رمز ثانٍ (admin2 قد تكون كلمة المرور مختلفة)')
  ok('رسالة موظف→موظف عبر السحابية', false, '—')
}

console.log(`\nالنتيجة: ${passed} ناجح / ${failed} فاشل`)
process.exit(failed ? 1 : 0)
