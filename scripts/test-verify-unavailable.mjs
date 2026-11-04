// =====================================================================
// اختبار سيناريو «تعذر التحقق» في phmp-realtime (السر غير مضبوط والهاتف
// غير متاح/قديم) — يجب ألا يُنهى موظف: WS يُغلق 4005 (لا 4003) وREST
// يرد 503 verify_unavailable (لا 401) كي تسقط الواجهة للبوابة بهدوء.
// =====================================================================
import WebSocket from 'ws'

const BASE = process.env.PHMP_TEST_BASE || 'http://127.0.0.1:8801'
let passed = 0, failed = 0
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ✅ ${name}`) }
  else { failed++; console.log(`  ❌ ${name} ${extra}`) }
}

const wsCloseCode = (authMsg) => new Promise((resolve) => {
  const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/ws`)
  ws.on('open', () => ws.send(JSON.stringify(authMsg)))
  ws.on('close', (code) => resolve(code))
  ws.on('error', () => {})
  setTimeout(() => resolve('timeout'), 6000)
})

async function main() {
  // موظف برمز سليم الشكل: لا سرّ محلي + لا هاتف → 4005 (لا 4003)
  const code = await wsCloseCode({ type: 'auth', token: 'x'.repeat(36) + '.b.c' })
  ok('WS موظف مع تعذر التحقق: إغلاق 4005 (لا 4003 — لا تُنهى الجلسة)', code === 4005, `code=${code}`)

  // ضيف: يعمل طبيعياً (لا يتأثر بتعذر التحقق)
  const guestCode = await new Promise((resolve) => {
    const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/ws`)
    let welcomed = false
    ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', guest: { name: 'ضيف', phone: '+2126', pharmacyId: 'ph1' } })))
    ws.on('message', (m) => { if (JSON.parse(m.toString()).type === 'welcome') { welcomed = true; ws.close(); resolve('welcomed') } })
    ws.on('close', () => resolve(welcomed ? 'welcomed' : 'closed'))
    setTimeout(() => resolve('timeout'), 6000)
  })
  ok('الضيف يُرحَّب رغم تعذر التحقق (الدردشة تعمل للزبناء)', guestCode === 'welcomed')

  // REST موظف: 503 verify_unavailable (لا 401)
  let res = await fetch(`${BASE}/api/orders`, { headers: { Authorization: 'Bearer x.y.z' } })
  const body = await res.json().catch(() => ({}))
  ok('GET /api/orders مع تعذر التحقق: 503 verify_unavailable', res.status === 503 && body.error === 'verify_unavailable', `status=${res.status}`)

  res = await fetch(`${BASE}/api/orders/ord-1`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x.y.z' }, body: '{}' })
  ok('PATCH مع تعذر التحقق: 503 (لا 401)', res.status === 503)

  // نقاط الزبناء بلا مصادقة تعمل
  res = await fetch(`${BASE}/api/orders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: `v${Date.now()}`, pharmacyId: 'ph1', total: 5, customer: { name: 'ز', phone: '+212600999888' }, items: [{ productId: 'p', name: 'د', price: 5, quantity: 1 }] }),
  })
  ok('إنشاء طلب زبون يعمل رغم تعذر تحقق الموظفين', res.status === 201)

  console.log(`\n📊 النتيجة: ${passed} ناجح، ${failed} فاشل`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('💥', e.message); process.exit(1) })
