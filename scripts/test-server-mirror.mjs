// =====================================================================
// اختبار خادم PHMP المعدَّل (v2.3.0): نقطة /api/auth/verify + مرآة الطلبات
// ---------------------------------------------------------------------
// خادم معزول (منفذ 3105 + قاعدة مؤقتة) + خادم سحابي وهمي (منفذ 3199):
//   1. auth/verify: رمز صالح → 200 بهوية حية، رمز مزيف → 401
//   2. مرآة السحب: طلب سحابي يظهر في SQLite وGET /api/orders
//   3. مرآة الدفع: طلب عبر البوابة يُرفع للخادم السحابي الوهمي
// =====================================================================
import { spawn } from 'child_process'
import crypto from 'crypto'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER = path.join(__dirname, '..', 'server', 'src', 'index.js')
const PORT = 3105
const MOCK_PORT = 3199
const JWT_SECRET = 'test-secret-mirror-0123456789abcdefghijklmnop'
const API_KEY = 'phmp_test_api_key_0123456789abcdef'
const DB = '/tmp/phmp-test-mirror.db'

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

async function main() {
  // ===== قاعدة مؤقتة: مخطط + صيدلية + مستخدمان =====
  const { execSync } = await import('child_process')
  execSync(`rm -f ${DB} ${DB}-wal ${DB}-shm`, { shell: '/bin/bash' })
  process.env.PHMP_DB_PATH = DB
  const { db, initSchema } = await import(path.join(__dirname, '..', 'server', 'src', 'db.js'))
  initSchema()
  db.prepare(`INSERT INTO pharmacies (id, name) VALUES ('ph1', 'صيدلية الاختبار'), ('ph2', 'صيدلية ثانية')`).run()
  db.prepare(`INSERT INTO users (id, username, password_hash, name, role, pharmacy_id, active)
              VALUES ('u1', 'pharm1', 'x', 'صيدلاني اختبار', 'pharmacist', 'ph1', 1),
                     ('su1', 'super', 'x', 'المالك', 'super_admin', NULL, 1)`).run()
  db.close()

  // ===== خادم سحابي وهمي =====
  const pushedBatches = []
  const cloudOrder = {
    id: 'ord-cloud-1', number: 'CMD-CLOUD-1', pharmacyId: 'ph1', status: 'pending', total: 42,
    customer: { name: 'زبون سحابي', phone: '+212611111111', type: 'guest' },
    items: [{ productId: 'p1', name: 'دواء سحابي', price: 42, quantity: 1 }],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
  const mock = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      if (req.url.startsWith('/api/orders/sync') && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, orders: [cloudOrder] }))
      } else if (req.url === '/api/orders/sync' && req.method === 'POST') {
        const data = JSON.parse(body || '{}')
        pushedBatches.push(...(data.orders || []))
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, inserted: (data.orders || []).length, updated: 0 }))
      } else {
        res.writeHead(404); res.end('{}')
      }
    })
  })
  await new Promise((r) => mock.listen(MOCK_PORT, '127.0.0.1', r))

  // ===== إقلاع الخادم المعزول =====
  const server = spawn('node', [SERVER], {
    env: {
      ...process.env,
      PORT: String(PORT), HOST: '127.0.0.1',
      JWT_SECRET, PHMP_API_KEY: API_KEY,
      PHMP_DB_PATH: DB,
      PHMP_LIVE_SYNC_URL: `http://127.0.0.1:${MOCK_PORT}`,
      PHMP_LIVE_SYNC_ENABLED: '1',
      PHMP_ALLOWED_ORIGINS: 'http://localhost:5173',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const serverLog = []
  server.stdout.on('data', (d) => serverLog.push(d.toString()))
  server.stderr.on('data', (d) => serverLog.push('ERR: ' + d.toString()))

  const base = `http://127.0.0.1:${PORT}`
  let up = false
  for (let i = 0; i < 20; i++) {
    try { const r = await fetch(`${base}/api/health`); if (r.ok) { up = true; break } } catch { /* إعادة */ }
    await sleep(500)
  }
  ok('الخادم أقلع', up)

  try {
    // ===== 1. auth/verify =====
    let res = await fetch(`${base}/api/auth/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: signJwt({ id: 'u1', name: 'صيدلاني اختبار', role: 'pharmacist', pharmacyId: 'ph1' }) }),
    })
    let data = await res.json()
    ok('auth/verify برمز صالح: 200 بهوية حية من القاعدة', res.status === 200 && data.ok && data.user.id === 'u1' && data.user.role === 'pharmacist')

    res = await fetch(`${base}/api/auth/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'a.b.c' }),
    })
    ok('auth/verify برمز مزيف: 401', res.status === 401)

    res = await fetch(`${base}/api/auth/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: signJwt({ id: 'ghost', name: 'شبح', role: 'admin' }) }),
    })
    ok('auth/verify لمستخدم غير موجود: 401', res.status === 401)

    // ===== 2. مرآة السحب (أول سحب بعد 8 ثوانٍ من الإقلاع) =====
    console.log('  ⏳ انتظار دورة السحب الأولى (8s)...')
    await sleep(9500)
    const staffToken = signJwt({ id: 'u1', name: 'صيدلاني اختبار', role: 'pharmacist', pharmacyId: 'ph1' })
    res = await fetch(`${base}/api/orders?pharmacyId=ph1`, { headers: { Authorization: `Bearer ${staffToken}` } })
    const orders = await res.json()
    ok('مرآة السحب: الطلب السحابي ظهر في GET /api/orders', Array.isArray(orders) && orders.some((o) => o.id === 'ord-cloud-1'))

    // سحب ثانٍ: لا تكرار (idempotent)
    await sleep(2000)
    res = await fetch(`${base}/api/orders?pharmacyId=ph1`, { headers: { Authorization: `Bearer ${staffToken}` } })
    const orders2 = await res.json()
    ok('مرآة السحب idempotent: طلب واحد فقط لا تكرار', orders2.filter((o) => o.id === 'ord-cloud-1').length === 1)

    // ===== 3. مرآة الدفع: طلب عبر البوابة يُرفع للسحابي الوهمي =====
    res = await fetch(`${base}/api/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'ord-gateway-1', pharmacyId: 'ph1', total: 99,
        customer: { name: 'زبون البوابة', phone: '+212622222222' },
        items: [{ productId: 'p2', name: 'دواء بوابة', price: 99, quantity: 1 }],
        createdAt: new Date().toISOString(),
      }),
    })
    ok('POST /api/orders عبر البوابة: 201', res.status === 201)
    await sleep(2500) // الدفع غير محجوب
    ok('مرآة الدفع: وصل الطلب للخادم السحابي', pushedBatches.some((o) => o.id === 'ord-gateway-1'))
  } finally {
    server.kill('SIGTERM')
    mock.close()
    await sleep(400)
  }

  const logText = serverLog.join('')
  ok('لا أخطاء غير متوقعة في سجل الخادم', !logText.includes('ERR:') && !logText.includes('UnhandledPromiseRejection'))
  console.log(`\n📊 النتيجة: ${passed} ناجح، ${failed} فاشل`)
  process.exit(failed ? 1 : 0)
}

main().catch((err) => { console.error('💥 فشل:', err); process.exit(1) })
