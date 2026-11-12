// =====================================================================
// اختبار بروتوكولي v2.4.1 — خادم الهاتف (server/src/realtime.js)
// ---------------------------------------------------------------------
// يثبت تكافؤ إصلاح التراسل المباشر موظف↔موظف مع الطبقة السحابية:
//   1. DM بغرفتين غير متناظرتين + `to`: تصل في الاتجاهين (كانت تضيع —
//      الخادم يتجاهل `to` عند وجود `room`).
//   2. غرفة DM كانونية متناظرة (نمط العميل الجديد): تعمل بالاتجاهين.
//   3. مظروف الغرفة يحمل `to` المُرحَّل + لا تكرار للعضو المستهدف.
//   4. زبون → غرفة طلب: تصل للموظفين حتى دون انضمام مسبق (بلا تكرار).
// =====================================================================
import { spawn } from 'child_process'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import WebSocket from 'ws'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER = path.join(__dirname, '..', 'server', 'src', 'index.js')
const PORT = 3117
const JWT_SECRET = 'test-secret-phone-dm-0123456789abcdefghij'
const API_KEY = 'phmp_test_api_key_0123456789abcdef'
const DB = '/tmp/phmp-test-phone-dm.db'

let passed = 0, failed = 0
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ✅ ${name}`) }
  else { failed++; console.log(`  ❌ ${name} ${extra}`) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function signJwt(payload) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const header = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 })
  const sig = crypto.createHmac('SHA256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

function openWs(auth) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`)
    const msgs = []
    const timer = setTimeout(() => reject(new Error('ws timeout')), 8000)
    ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', ...auth })))
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString())
      msgs.push(m)
      if (m.type === 'welcome' && !state.welcomed) {
        state.welcomed = true
        clearTimeout(timer)
        resolve(state)
      }
    })
    const state = {
      ws, msgs, welcomed: false,
      send: (m) => ws.send(JSON.stringify(m)),
      close: () => new Promise((r) => { ws.on('close', () => r()); ws.close() }),
      waitFor: (pred, ms = 4000) => new Promise((res) => {
        const found = msgs.find(pred)
        if (found) return res(found)
        const end = Date.now() + ms
        const iv = setInterval(() => {
          const f = msgs.find(pred)
          if (f || Date.now() > end) { clearInterval(iv); res(f || null) }
        }, 50)
      }),
    }
  })
}

async function main() {
  console.log('🧪 اختبار v2.4.1 — تكافؤ DM في خادم الهاتف —')
  const { execSync } = await import('child_process')
  execSync(`rm -f ${DB} ${DB}-wal ${DB}-shm`, { shell: '/bin/bash' })
  process.env.PHMP_DB_PATH = DB
  const { db, initSchema } = await import(path.join(__dirname, '..', 'server', 'src', 'db.js'))
  initSchema()
  db.prepare(`INSERT INTO pharmacies (id, name) VALUES ('ph1', 'صيدلية الاختبار')`).run()
  db.prepare(`INSERT INTO users (id, username, password_hash, name, role, pharmacy_id, active)
              VALUES ('u-staff1', 'pharm1', 'x', 'صيدلاني أول', 'pharmacist', 'ph1', 1),
                     ('u-staff2', 'cash1', 'x', 'كاشير أول', 'cashier', 'ph1', 1)`).run()
  db.close()

  const server = spawn('node', [SERVER], {
    env: {
      ...process.env,
      PORT: String(PORT), HOST: '127.0.0.1',
      JWT_SECRET, PHMP_API_KEY: API_KEY, PHMP_DB_PATH: DB,
      PHMP_ALLOWED_ORIGINS: 'http://localhost:5173',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const log = []
  server.stdout.on('data', (d) => log.push(d.toString()))
  server.stderr.on('data', (d) => log.push('ERR: ' + d.toString()))

  let up = false
  for (let i = 0; i < 20; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/api/health`); if (r.ok) { up = true; break } } catch { /* إعادة */ }
    await sleep(500)
  }
  ok('الخادم أقلع', up)

  try {
    const t1 = signJwt({ id: 'u-staff1', name: 'صيدلاني أول', role: 'pharmacist', pharmacyId: 'ph1' })
    const t2 = signJwt({ id: 'u-staff2', name: 'كاشير أول', role: 'cashier', pharmacyId: 'ph1' })
    const staff = await openWs({ token: t1 })
    const staff2 = await openWs({ token: t2 })
    ok('موظفان متصلان', staff.welcomed && staff2.welcomed)

    // ===== 1. DM بغرف غير متناظرة + to =====
    staff.send({ type: 'join', room: 'dm:legacy-u-staff2' })
    staff2.send({ type: 'join', room: 'dm:legacy-u-staff1' })
    await sleep(300)
    staff.send({ type: 'chat', room: 'dm:legacy-u-staff2', to: 'user:u-staff2', text: 'داخلية ١' })
    const got1 = await staff2.waitFor((m) => m.type === 'chat' && m.text === 'داخلية ١')
    ok('غرفة المرسل + to: تصل للمستهدف', !!got1 && got1.fromId === 'u-staff1')
    staff2.send({ type: 'chat', room: 'dm:legacy-u-staff1', to: 'user:u-staff1', text: 'داخلية ٢' })
    const got2 = await staff.waitFor((m) => m.type === 'chat' && m.text === 'داخلية ٢')
    ok('الاتجاه المعاكس: تصل', !!got2)
    const dup = staff.msgs.filter((m) => m.type === 'chat' && m.text === 'داخلية ٢').length
    ok('لا تكرار للعضو المستهدف', dup === 1)
    ok('مظروف الغرفة يحمل to', got1.to === 'user:u-staff2')

    // ===== 2. غرفة كانونية متناظرة =====
    const canon = 'dm:' + ['u-staff1', 'u-staff2'].sort().join(':')
    staff.send({ type: 'join', room: canon })
    staff2.send({ type: 'join', room: canon })
    await sleep(300)
    staff.send({ type: 'chat', room: canon, text: 'كانونية ١' })
    const c1 = await staff2.waitFor((m) => m.type === 'chat' && m.room === canon && m.text === 'كانونية ١')
    ok('كانونية: الاتجاه الأول', !!c1)
    staff2.send({ type: 'chat', room: canon, text: 'كانونية ٢' })
    const c2 = await staff.waitFor((m) => m.type === 'chat' && m.room === canon && m.text === 'كانونية ٢')
    ok('كانونية: الاتجاه المعاكس', !!c2)

    // ===== 3. زبون → غرفة طلب بلا انضمام مسبق للموظف =====
    const guest = await openWs({ guest: { name: 'زبون الفحص', phone: '+212655000111', pharmacyId: 'ph1' } })
    ok('الضيف متصل', guest.welcomed)
    guest.send({ type: 'chat', room: 'order:phone-dm-1', text: 'هل الطلب جاهز؟', displayName: 'زبون الفحص' })
    const g1 = await staff.waitFor((m) => m.type === 'chat' && m.room === 'order:phone-dm-1')
    ok('رسالة الزبون تصل للموظف (انضمام قسري)', !!g1)
    // رد الموظف يصل للزبون (الزبون انضم تلقائياً عند الإرسال)
    staff.send({ type: 'chat', room: 'order:phone-dm-1', text: 'جاهز خلال دقائق' })
    const g2 = await guest.waitFor((m) => m.type === 'chat' && m.text === 'جاهز خلال دقائق')
    ok('رد الموظف يصل للزبون', !!g2)

    await Promise.allSettled([staff.close(), staff2.close(), guest.close()])
  } finally {
    server.kill('SIGTERM')
  }

  console.log(`\n📊 النتيجة: ${passed} ناجح، ${failed} فاشل`)
  if (failed) { console.log(log.slice(-25).join('')); process.exit(1) }
  process.exit(0)
}

main().catch((err) => { console.error('💥 فشل الاختبار:', err.message); process.exit(1) })
