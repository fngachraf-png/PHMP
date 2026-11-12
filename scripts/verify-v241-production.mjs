// =====================================================================
// تحقق إنتاجي v2.4.1 — سلوك الطبقة السحابية المنشورة (phmp-realtime)
// ---------------------------------------------------------------------
// اتصالان ضيفان حقيقيان على الإنتاج: يثبت أن Worker الفوري المنشور
// يكرّم التوجيه المباشر `to` مع الغرفة (سلوك hub الجديد v2.4.1) وأن
// الغرفة الكانونية تعمل — دون أي اعتماد على جاهزية خادم الهاتف.
// =====================================================================
import WebSocket from 'ws'

const BASE = 'https://phmp-realtime.balbolghol-ai.workers.dev'
let passed = 0, failed = 0
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ✅ ${name}`) }
  else { failed++; console.log(`  ❌ ${name} ${extra}`) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function openWs(guest) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/ws`)
    const msgs = []
    const timer = setTimeout(() => reject(new Error('ws timeout')), 12000)
    ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', guest })))
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString())
      msgs.push(m)
      if (m.type === 'welcome' && !state.welcomed) { state.welcomed = true; clearTimeout(timer); resolve(state) }
    })
    ws.on('error', (e) => { clearTimeout(timer); reject(e) })
    const state = {
      ws, msgs, welcomed: false,
      send: (m) => ws.send(JSON.stringify(m)),
      waitFor: (pred, ms = 8000) => new Promise((res) => {
        const end = Date.now() + ms
        const iv = setInterval(() => {
          const f = msgs.find(pred)
          if (f || Date.now() > end) { clearInterval(iv); res(f || null) }
        }, 60)
      }),
    }
  })
}

async function main() {
  console.log('🧪 تحقق إنتاجي v2.4.1 —', BASE)
  const health = await fetch(`${BASE}/api/health`)
  ok('الطبقة السحابية حية', health.status === 200)

  const a = await openWs({ name: 'زبون التحقق أ', phone: '0600000001', pharmacyId: 'ph-probe' })
  const b = await openWs({ name: 'زبون التحقق ب', phone: '0600000002', pharmacyId: 'ph-probe' })
  ok('اتصالان موثقان', a.welcomed && b.welcomed)

  // 1) الغرفة الكانونية للضيفين: الطرفان ينضمان للغرفة نفسها والرسائل تصل بلا to
  const canon = 'dm:canon-probe-a-b'
  a.send({ type: 'join', room: canon })
  b.send({ type: 'join', room: canon })
  await sleep(400)
  a.send({ type: 'chat', room: canon, text: 'سلام إنتاجي من أ', cid: 'prod-1' })
  const gotB = await b.waitFor((m) => m.type === 'chat' && m.cid === 'prod-1')
  ok('غرفة كانونية على الإنتاج: أ → ب', !!gotB)
  b.send({ type: 'chat', room: canon, text: 'وعليكم السلام من ب', cid: 'prod-2' })
  const gotA = await a.waitFor((m) => m.type === 'chat' && m.cid === 'prod-2')
  ok('غرفة كانونية على الإنتاج: ب → أ', !!gotA)
  ok('cid مُرحَّل كما هو (منع التكرار)', gotB?.cid === 'prod-1' && gotA?.cid === 'prod-2')

  // 2) سلوك جديد: to مع الغرفة — الضيف يستهدف معرّف اتصال طرف آخر (raw connId)
  const bConn = b.msgs.find((m) => m.type === 'welcome') // لا يحمل connId — نستخدم مجال آخر:
  // نستخرج معرّف اتصال ب عبر رسالة دردشة منه (connId يُرحَّل في المظروف)
  const bConnId = gotA?.connId
  if (bConnId) {
    a.send({ type: 'join', room: 'dm:probe-legacy-a' })
    await sleep(250)
    a.send({ type: 'chat', room: 'dm:probe-legacy-a', to: `client:${bConnId}`, text: 'توجيه صريح إنتاجي', cid: 'prod-3' })
    const gotTo = await b.waitFor((m) => m.type === 'chat' && m.cid === 'prod-3')
    ok('to مع room يُكرَّم على الإنتاج (سلوك hub الجديد)', !!gotTo)
  } else {
    ok('to مع room يُكرَّم على الإنتاج (سلوك hub الجديد)', false, 'لم يُعرف connId')
  }

  console.log(`\n📊 النتيجة: ${passed} ناجح، ${failed} فاشل`)
  process.exit(failed ? 1 : 0)
}

main().catch((err) => { console.error('💥 فشل:', err.message); process.exit(1) })
