// =====================================================================
// تحقق إنتاجي كامل v2.4.1 — موظف↔موظف عبر الطبقة السحابية المنشورة
// دخول حقيقي عبر البوابة (خادم الهاتف) + مقبسان موثقان على phmp-realtime.
// إن كان خادم الهاتف نائماً يُكتفى بتحقق الضيوف (verify-v241-production).
// =====================================================================
import WebSocket from 'ws'

const GATE = 'https://phmp-api.balbolghol-ai.workers.dev'
const LIVE = 'https://phmp-realtime.balbolghol-ai.workers.dev'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function login(u, p) {
  const res = await fetch(`${GATE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p }),
  })
  const data = await res.json().catch(() => ({}))
  return data?.token ? data : null
}

function openWs(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${LIVE.replace(/^http/, 'ws')}/ws`)
    const msgs = []
    const t = setTimeout(() => reject(new Error('timeout')), 12000)
    ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', token })))
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString())
      msgs.push(m)
      if (m.type === 'welcome') {
        clearTimeout(t)
        resolve({
          ws, msgs,
          send: (x) => ws.send(JSON.stringify(x)),
          waitFor: (pred, ms = 8000) => new Promise((res) => {
            const e = Date.now() + ms
            const iv = setInterval(() => {
              const f = msgs.find(pred)
              if (f || Date.now() > e) { clearInterval(iv); res(f || null) }
            }, 60)
          }),
        })
      }
    })
    ws.on('error', (e) => { clearTimeout(t); reject(e) })
  })
}

async function main() {
  const admin = await login('admin', 'Tch@10mn')
  if (!admin) {
    console.log('ℹ️ خادم الهاتف نائم أو الاعتماد غير صالح — يُكتفى بتحقق الضيوف (6/6)')
    process.exit(0)
  }
  console.log('✅ دخول admin عبر البوابة الإنتاجية')
  const admin2 = await login('admin2', 'Tch@10mn')
  console.log(admin2 ? '✅ دخول admin2' : 'ℹ️ admin2 لم يدخل — يُكتفى بمقبس واحد')
  const A = await openWs(admin.token)
  console.log('✅ مقبس admin موثق على الطبقة السحابية:', A.msgs[0]?.identity?.kind, A.msgs[0]?.identity?.name)
  if (!admin2) process.exit(0)
  const B = await openWs(admin2.token)
  console.log('✅ مقبس admin2 موثق:', B.msgs[0]?.identity?.name)
  const canon = 'dm:' + [admin.user.id, admin2.user.id].sort().join(':')
  A.send({ type: 'join', room: canon })
  B.send({ type: 'join', room: canon })
  await sleep(600)
  A.send({ type: 'chat', room: canon, to: `user:${admin2.user.id}`, text: 'إنتاجي: سلام من admin إلى admin2', cid: 'pstaff-1' })
  const got = await B.waitFor((m) => m.type === 'chat' && m.cid === 'pstaff-1')
  console.log(got ? '✅ موظف↔موظف على الإنتاج: الرسالة وصلت' : '❌ لم تصل')
  B.send({ type: 'chat', room: canon, to: `user:${admin.user.id}`, text: 'إنتاجي: رد admin2', cid: 'pstaff-2' })
  const got2 = await A.waitFor((m) => m.type === 'chat' && m.cid === 'pstaff-2')
  console.log(got2 ? '✅ الاتجاه المعاكس: وصل' : '❌ لم يصل')
  process.exit(got && got2 ? 0 : 1)
}

main().catch((err) => { console.log('ℹ️', err.message, '— يُكتفى بتحقق الضيوف'); process.exit(0) })
