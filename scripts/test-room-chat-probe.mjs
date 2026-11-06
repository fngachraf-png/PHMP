// فحص بروتوكولي معزول: دردشة غرفة عبر الخادم المحلي المُعدَّل (cid + room)
import WebSocket from 'ws'

const API = 'http://127.0.0.1:3101'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function login(username, password) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!data.token) throw new Error('login failed: ' + JSON.stringify(data))
  return data
}

function connect(authMsg) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${API.replace(/^http/, 'ws')}/ws`)
    const msgs = []
    const state = { ws, msgs, send: (m) => ws.send(JSON.stringify(m)) }
    ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', ...authMsg })))
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString())
      msgs.push(m)
      if (m.type === 'welcome' && !state.welcomed) { state.welcomed = true; resolve(state) }
    })
    state.waitFor = async (pred, ms = 5000) => {
      const end = Date.now() + ms
      while (Date.now() < end) {
        const f = msgs.find(pred)
        if (f) return f
        await sleep(100)
      }
      return null
    }
  })
}

const staffLogin = await login('pharmacist', 'Test@10mn')
const staff = await connect({ token: staffLogin.token })
console.log('staff welcome:', staff.welcomed, staff.msgs.find(m => m.type === 'welcome')?.identity)

const guest = await connect({ guest: { name: 'زبون بروتوكول', phone: '0655443322', pharmacyId: 'ph1' } })
console.log('guest welcome:', guest.welcomed)

const ROOM = 'order:probe-' + Date.now()
staff.send({ type: 'join', room: ROOM })
await sleep(400)
guest.send({ type: 'chat', room: ROOM, text: 'سلام بروتوكولي', displayName: 'زبون بروتوكول', cid: 'cid-1' })
const got = await staff.waitFor((m) => m.type === 'chat' && m.text === 'سلام بروتوكولي')
console.log('guest→staff room chat:', got ? `✅ (cid=${got.cid})` : '❌ لم تصل')
staff.send({ type: 'chat', room: ROOM, text: 'وعليكم السلام', cid: 'cid-2' })
const got2 = await guest.waitFor((m) => m.type === 'chat' && m.text === 'وعليكم السلام')
console.log('staff→guest room chat:', got2 ? `✅ (cid=${got2.cid})` : '❌ لم تصل')

// زبون ثانٍ في نفس الصيدلية: يجب ألا يستقبل رسائل الغرفة (عزل)
const guest2 = await connect({ guest: { name: 'زبون آخر', phone: '0699887766', pharmacyId: 'ph1' } })
guest.send({ type: 'chat', room: ROOM, text: 'رسالة خاصة', displayName: 'زبون بروتوكول', cid: 'cid-3' })
await sleep(1200)
const leak = guest2.msgs.find((m) => m.type === 'chat')
console.log('عزل الغرف عن زبون آخر:', leak ? '❌ تسرّب' : '✅ بلا تسرّب')
process.exit(0)
