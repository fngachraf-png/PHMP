// PHMP - خادم API المحلي (SQLite + نفق دائم)
// منصة إدارة الصيدلية Pharmacy Management Platform PHMP
//
// تدقيق أمني 2026-10-28 (المساعد المحلي):
// - الأسرار من server/.env فقط (600) — لا قيم افتراضية في الكود.
// - /api/sync · /api/data · /api/backup تتطلب مفتاح API (x-phmp-key).
// - تحديد معدل محاولات الدخول + سجل تدقيق خادمي لكل عملية حساسة.
// - CORS بقائمة أصول مسموحة (قابلة للتوسيع بـPHMP_ALLOWED_ORIGINS).
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { randomUUID, timingSafeEqual } from 'crypto'
import { db, initSchema, setMeta, getMeta, DB_PATH } from './db.js'
import { setupRealtime } from './realtime.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// تحميل .env بلا تبعية إضافية (Node >= 20.12)
try {
  process.loadEnvFile(path.join(__dirname, '..', '.env'))
} catch { /* .env اختياري في التطوير فقط */ }

const PORT = process.env.PORT || 3001
const HOST = process.env.HOST || '127.0.0.1'
const JWT_SECRET = process.env.JWT_SECRET || ''
const API_KEY = process.env.PHMP_API_KEY || ''

if (JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET مفقود أو أقصر من 32 محرفاً — راجع server/.env')
  process.exit(1)
}
if (API_KEY.length < 24) {
  console.error('❌ PHMP_API_KEY مفقود أو أقصر من 24 محرفاً — راجع server/.env')
  process.exit(1)
}

initSchema()

const VALID_ROLES = ['super_admin', 'admin', 'accountant', 'pharmacist', 'cashier']

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '50mb' }))

// ===== الأصول المسموحة (CORS) =====
// أصول Capacitor (تطبيق أندرويد/iOS): WebView يحمّل الواجهة من https://localhost
// (androidScheme: https) — بدون إدراجها هنا يحجب CORS كل طلبات الدخول من التطبيق
// فيفشل تسجيل الدخول. آمنة: متصفحات الويب لا تستطيع انتحال ترويسة Origin،
// وأصل localhost لا يصدر إلا من التطبيق المثبّت على جهاز المستخدم نفسه.
const CAPACITOR_ORIGINS = [
  'https://localhost',   // أندرويد (androidScheme: https — الافتراضي في Capacitor 6)
  'http://localhost',    // إعدادات أندرويد القديمة (androidScheme: http)
  'capacitor://localhost', // iOS (المخطط الافتراضي)
  'ionic://localhost',   // توافق مع حزم Ionic القديمة
]

const ALLOWED_ORIGINS = (process.env.PHMP_ALLOWED_ORIGINS ||
  'https://phmp.pages.dev,https://phmplatform.vercel.app,https://pharmacare-pro-jade.vercel.app')
  .split(',').map((s) => s.trim()).filter(Boolean)

const originAllowed = (origin) => {
  if (!origin) return true // curl / تطبيق أصلي بلا Origin
  if (ALLOWED_ORIGINS.includes(origin) || CAPACITOR_ORIGINS.includes(origin)) return true
  try {
    const host = new URL(origin).hostname
    // معاينات Pages التابعة لنفس المشروع
    if (host === 'phmp.pages.dev' || host.endsWith('.phmp.pages.dev')) return true
    // معاينات Vercel الخاصة بمشروع PHMP فقط (وليس أي *.vercel.app)
    if (host.endsWith('.vercel.app')) {
      return host.startsWith('phmplatform-') || host.startsWith('pharmacare-pro-jade-')
    }
    return false
  } catch {
    return false
  }
}

app.use(cors({
  origin(origin, cb) { cb(null, originAllowed(origin)) },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-phmp-key', 'x-phmp-client-ip'],
  maxAge: 86400,
}))

// ترويسات أمان أساسية
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('Referrer-Policy', 'no-referrer')
  res.set('X-Frame-Options', 'DENY')
  // صلاحيات المنصة: الكاميرا والمايكروفون (المكالمات الصوتية/المرئية WebRTC)
  // والموقع الجغرافي (التوصيل ومشاركة الموقع) مسموحة لنفس الأصل — كان الحجب
  // الكامل السابق يمنع هذه الميزات في التطبيق والمنصة.
  res.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)')
  next()
})

// عنوان العميل الحقيقي: البوابة (Worker/VPC) تكتب x-phmp-client-ip من cf-connecting-ip
const clientIp = (req) => {
  const raw = req.headers['x-phmp-client-ip'] || req.headers['cf-connecting-ip'] ||
    req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''
  return String(raw).split(',')[0].trim().replace(/^::ffff:/, '')
}

// ===== سجل التدقيق الخادمي =====
const insertAudit = db.prepare(`
  INSERT INTO audit_log (id, timestamp, user_id, user_name, user_role, action, details, pharmacy_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)

function audit(req, action, details = {}, user = null) {
  try {
    insertAudit.run(
      randomUUID(),
      new Date().toISOString(),
      user?.id || null,
      user?.username || user?.name || null,
      user?.role || null,
      action,
      JSON.stringify({ ...details, ip: clientIp(req) }),
      user?.pharmacyId || null,
    )
  } catch (err) {
    console.error('[audit]', err.message)
  }
}

// ===== تحديد معدل محاولات الدخول (ذاكرة) =====
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 10
const loginAttempts = new Map()

const isRateLimited = (key) => {
  const now = Date.now()
  const rec = loginAttempts.get(key)
  if (!rec || now - rec.start > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { start: now, count: 1 })
    return false
  }
  rec.count += 1
  return rec.count > LOGIN_MAX_ATTEMPTS
}

setInterval(() => {
  const now = Date.now()
  for (const [key, rec] of loginAttempts) {
    if (now - rec.start > LOGIN_WINDOW_MS) loginAttempts.delete(key)
  }
}, 10 * 60 * 1000).unref()

// ===== المصادقة =====
// بعد التحقق من التوقيع يُعاد قراءة الدور والحالة من قاعدة البيانات:
// أي ترقية/تخفيض/توقيف يسري فوراً حتى قبل انتهاء صلاحية الرمز (12 ساعة).
const authenticate = (req, res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'مطلوب تسجيل الدخول' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const fresh = db.prepare('SELECT role, active, pharmacy_id FROM users WHERE id = ?').get(payload.id)
    if (!fresh || !fresh.active) return res.status(401).json({ error: 'الحساب موقوف أو محذوف — سجّل الدخول من جديد' })
    req.user = { ...payload, role: fresh.role, pharmacyId: fresh.pharmacy_id }
    next()
  } catch {
    res.status(401).json({ error: 'جلسة غير صالحة' })
  }
}

// عدد السوبر أدمين النشطين — حماية من فقدان ملكية المنصة نهائياً
const countActiveSuperAdmins = () =>
  db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'super_admin' AND active = 1").get().n

// فحص الصلاحيات حسب الدور
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'ليست لديك الصلاحيات اللازمة' })
  }
  next()
}

// مفتاح API للمسارات التي لا تمر بجلسة مستخدم (مزامنة/استرجاع/نسخ احتياطي)
const safeEqual = (a, b) => {
  const ab = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

const requireApiKey = (req, res, next) => {
  const provided = req.headers['x-phmp-key'] || ''
  if (!provided || !safeEqual(provided, API_KEY)) {
    audit(req, 'api.denied', { path: req.path, method: req.method })
    return res.status(401).json({ error: 'مفتاح API مطلوب أو غير صالح' })
  }
  next()
}

// ===== الصحة =====
app.get('/api/health', (_req, res) => {
  let database = 'error'
  try {
    db.prepare('SELECT 1').get()
    database = 'ok'
  } catch { /* يبقى error */ }
  res.status(database === 'ok' ? 200 : 503).json({
    ok: database === 'ok',
    service: 'PHMP Local Server',
    database,
    version: getMeta('db_version') || '1.0.0',
    uptime: Math.round(process.uptime()),
    time: new Date().toISOString(),
  })
})

// ===== تسجيل الدخول =====
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {}
    if (!username || !password) return res.status(400).json({ error: 'بيانات ناقصة' })

    const key = `${clientIp(req)}|${username}`
    if (isRateLimited(key)) {
      audit(req, 'auth.login.rate_limited', { username })
      return res.status(429).json({ error: 'محاولات كثيرة — أعد المحاولة بعد 15 دقيقة' })
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      audit(req, 'auth.login.failed', { username })
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' })
    }
    if (!user.active) {
      audit(req, 'auth.login.disabled', { username })
      return res.status(403).json({ error: 'هذا الحساب موقوف' })
    }

    loginAttempts.delete(key)
    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id)
    const pharmacy = user.pharmacy_id
      ? db.prepare('SELECT * FROM pharmacies WHERE id = ?').get(user.pharmacy_id)
      : null
    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role, pharmacyId: user.pharmacy_id },
      JWT_SECRET,
      { expiresIn: '12h' },
    )
    audit(req, 'auth.login', { username }, { id: user.id, username: user.username, role: user.role, pharmacyId: user.pharmacy_id })
    res.json({
      token,
      user: {
        id: user.id, username: user.username, name: user.name, nameEn: user.nameEn,
        role: user.role, pharmacyId: user.pharmacy_id, avatar: user.avatar,
      },
      pharmacy,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ===== المستخدمون (إدارة - أدمن وسوبر أدمين) =====
app.get('/api/users', authenticate, requireRole('super_admin', 'admin'), (req, res) => {
  const rows = req.user.role === 'super_admin'
    ? db.prepare('SELECT id, username, name, nameEn, role, pharmacy_id, avatar, active, last_login, created_at FROM users').all()
    : db.prepare('SELECT id, username, name, nameEn, role, pharmacy_id, avatar, active, last_login, created_at FROM users WHERE pharmacy_id = ?').all(req.user.pharmacyId)
  res.json(rows)
})

app.post('/api/users', authenticate, requireRole('super_admin', 'admin'), (req, res) => {
  const { username, password, name, nameEn, role, pharmacyId, avatar } = req.body
  if (!username || !password || !name || !role) return res.status(400).json({ error: 'بيانات ناقصة' })
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'دور غير صالح' })
  // مدير الصيدلية لا ينشئ سوبر أدمين ولا مستخدماً خارج صيدليته
  if (role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'إنشاء مالك منصة يتطلب صلاحية سوبر أدمين' })
  }
  if (req.user.role === 'admin' && pharmacyId && pharmacyId !== req.user.pharmacyId) {
    return res.status(403).json({ error: 'لا يمكنك إضافة مستخدم لصيدلية أخرى' })
  }
  const targetPharmacy = req.user.role === 'admin' ? req.user.pharmacyId : (pharmacyId || null)
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    return res.status(409).json({ error: 'اسم المستخدم مستعمل من قبل' })
  }
  const id = `u${Date.now()}`
  const hash = bcrypt.hashSync(password, 10)
  db.prepare('INSERT INTO users (id, username, password_hash, name, nameEn, role, pharmacy_id, avatar) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, username, hash, name, nameEn || null, role, targetPharmacy, avatar || '👤')
  audit(req, 'user.create', { targetId: id, username, role, pharmacyId: targetPharmacy }, req.user)
  res.status(201).json({ id })
})

app.patch('/api/users/:id', authenticate, requireRole('super_admin', 'admin'), (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!target) return res.status(404).json({ error: 'المستخدم غير موجود' })
  if (target.role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'لا يمكن تعديل مالك المنصة' })
  }
  const { name, role, pharmacyId, active, password, avatar } = req.body
  if (req.user.role === 'admin' && target.pharmacy_id !== req.user.pharmacyId) {
    return res.status(403).json({ error: 'لا يمكنك تعديل مستخدم من صيدلية أخرى' })
  }
  if (role !== undefined && !VALID_ROLES.includes(role)) return res.status(400).json({ error: 'دور غير صالح' })
  if (role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'ترقية إلى مالك منصة تتطلب صلاحية سوبر أدمين' })
  }
  if (req.user.role === 'admin' && pharmacyId !== undefined && pharmacyId !== req.user.pharmacyId) {
    return res.status(403).json({ error: 'لا يمكنك نقل مستخدم إلى صيدلية أخرى' })
  }
  // حماية ملكية المنصة: لا يُخفَّض آخر سوبر أدمين نشط ولا يُوقف
  const isDemotingSuper = target.role === 'super_admin' && role !== undefined && role !== 'super_admin'
  if (isDemotingSuper && countActiveSuperAdmins() <= 1) {
    return res.status(403).json({ error: 'لا يمكن تخفيض آخر مالك منصة نشط — أنشئ أو رقِّ مالكاً آخر أولاً' })
  }
  const isDeactivatingSuper = target.role === 'super_admin' && active === false
  if (isDeactivatingSuper && countActiveSuperAdmins() <= 1) {
    return res.status(403).json({ error: 'لا يمكن إيقاف آخر مالك منصة نشط — أنشئ أو رقِّ مالكاً آخر أولاً' })
  }
  const updates = {}
  if (name !== undefined) { updates.name = name; db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, target.id) }
  // صورة المستخدم (dataURL مضغوط) أو رمز تعبيري — تُخزن في نفس الحقل
  if (avatar !== undefined && typeof avatar === 'string' && avatar.length < 200000) {
    updates.avatar = avatar
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, target.id)
  }
  // سوبر أدمين يمكنه تعديل دور سوبر أدمين آخر (أو تخفيضه بشرط بقاء مالك نشط)
  if (role !== undefined && (target.role !== 'super_admin' || req.user.role === 'super_admin')) {
    updates.role = role
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, target.id)
    // الترقية إلى سوبر أدمين تجعل نطاقه كل الصيدليات
    if (role === 'super_admin') db.prepare('UPDATE users SET pharmacy_id = NULL WHERE id = ?').run(target.id)
  }
  if (pharmacyId !== undefined) { updates.pharmacy_id = pharmacyId; db.prepare('UPDATE users SET pharmacy_id = ? WHERE id = ?').run(pharmacyId, target.id) }
  if (active !== undefined && (target.role !== 'super_admin' || req.user.role === 'super_admin')) {
    updates.active = active ? 1 : 0
    db.prepare('UPDATE users SET active = ? WHERE id = ?').run(updates.active, target.id)
  }
  if (password) { db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), target.id) }
  audit(req, 'user.update', { targetId: target.id, fields: Object.keys(updates), passwordChanged: !!password }, req.user)
  res.json({ ok: true, updates: Object.keys(updates) })
})

app.delete('/api/users/:id', authenticate, requireRole('super_admin', 'admin'), (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!target) return res.status(404).json({ error: 'المستخدم غير موجود' })
  if (target.id === req.user.id) return res.status(403).json({ error: 'لا يمكنك حذف حسابك' })
  // سوبر أدمين يمكنه حذف سوبر أدمين آخر — إلا آخر مالك نشط
  if (target.role === 'super_admin') {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'لا يمكن حذف مالك المنصة' })
    if (countActiveSuperAdmins() <= 1) {
      return res.status(403).json({ error: 'لا يمكن حذف آخر مالك منصة نشط — أنشئ أو رقِّ مالكاً آخر أولاً' })
    }
  }
  if (req.user.role === 'admin' && target.pharmacy_id !== req.user.pharmacyId) {
    return res.status(403).json({ error: 'لا يمكنك حذف مستخدم من صيدلية أخرى' })
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(target.id)
  audit(req, 'user.delete', { targetId: target.id, username: target.username }, req.user)
  res.json({ ok: true })
})

// ===== نقل ملكية المنصة (سوبر أدمين فقط) =====
// عملية حساسة وموثّقة: يُطلب من المالك الحالي تأكيد كلمة مروره، ويُرقّى
// المستهدف إلى سوبر أدمين، ويُخفَّض المالك القديم إلى الدور الذي يختاره
// (أو يبقى سوبر أدمين مشاركاً إن لم يُحدد دوراً جديداً).
app.post('/api/platform/transfer-ownership', authenticate, requireRole('super_admin'), (req, res) => {
  try {
    const { targetUserId, currentPassword, selfNewRole, selfPharmacyId } = req.body || {}
    if (!targetUserId || !currentPassword) {
      return res.status(400).json({ error: 'المستخدم المستهدف وكلمة المرور الحالية إلزاميان' })
    }
    const me = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    if (!me || !bcrypt.compareSync(String(currentPassword), me.password_hash)) {
      audit(req, 'platform.ownership.transfer.denied', { targetUserId }, req.user)
      return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' })
    }
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId)
    if (!target) return res.status(404).json({ error: 'المستخدم المستهدف غير موجود' })
    if (target.id === me.id) return res.status(400).json({ error: 'لا يمكنك نقل الملكية إلى نفسك' })
    if (!target.active) return res.status(400).json({ error: 'المستخدم المستهدف موقوف — فعّله أولاً' })

    // 1) ترقية المستهدف إلى مالك منصة (نطاق كل الصيدليات)
    db.prepare("UPDATE users SET role = 'super_admin', pharmacy_id = NULL WHERE id = ?").run(target.id)
    setMeta('platform_owner', target.id)
    setMeta('platform_owner_transferred_at', new Date().toISOString())

    // 2) دور المالك القديم: تخفيض إلى الدور المختار أو البقاء مالكاً مشاركاً
    let selfDemoted = false
    if (selfNewRole && selfNewRole !== 'super_admin') {
      if (!VALID_ROLES.includes(selfNewRole)) return res.status(400).json({ error: 'دور غير صالح' })
      if (selfNewRole !== 'super_admin' && !selfPharmacyId) {
        return res.status(400).json({ error: 'اختر الصيدلية التي ستنضم إليها بعد نقل الملكية' })
      }
      db.prepare('UPDATE users SET role = ?, pharmacy_id = ? WHERE id = ?').run(selfNewRole, selfPharmacyId || null, me.id)
      selfDemoted = true
    }

    audit(req, 'platform.ownership.transfer', {
      newOwnerId: target.id,
      newOwnerUsername: target.username,
      previousOwnerUsername: me.username,
      previousOwnerNewRole: selfNewRole || 'super_admin',
    }, req.user)
    res.json({ ok: true, selfDemoted, newOwner: { id: target.id, username: target.username, name: target.name } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ===== الطلبات المباشرة (مزامنة عبر الواجهات: Pages / Vercel / أندرويد) =====
// الطلب يُنشأ عند الزبون (ضيف بلا جلسة) ويُحفظ هنا على خادم المالك، ثم يُبث
// فورياً لكل الموظفين المتصلين، وأي واجهة تسأل لاحقاً تجد نفس القائمة —
// فتظهر الطلبات في الواجهات الثلاث آنياً وتُعالَج من أي واجهة على حد سواء.
// (الدردشة وإشارات المكالمات تبقى بلا تخزين إطلاقاً — قاعدة 8 المحدَّثة.)
const ORDER_STATUSES = ['pending', 'accepted', 'preparing', 'ready', 'dispatched', 'completed', 'cancelled']
const ORDER_JSON_MAX = 2 * 1024 * 1024        // 2MB كحد أقصى لكائن الطلب
const ORDER_ITEMS_MAX = 50
const ORDER_RATE_WINDOW = 60 * 60 * 1000      // نافذة ساعة واحدة…
const ORDER_RATE_MAX = 40                     // …لكل IP (إنشاء + تتبع)
const orderRate = new Map()
const orderRateLimited = (key) => {
  const now = Date.now()
  const rec = orderRate.get(key)
  if (!rec || now - rec.start > ORDER_RATE_WINDOW) { orderRate.set(key, { start: now, count: 1 }); return false }
  rec.count += 1
  return rec.count > ORDER_RATE_MAX
}
setInterval(() => {
  const now = Date.now()
  for (const [key, rec] of orderRate) { if (now - rec.start > ORDER_RATE_WINDOW) orderRate.delete(key) }
}, 10 * 60 * 1000).unref()

const strField = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const orderRowToObj = (r) => {
  let data = {}
  try { data = JSON.parse(r.data || '{}') } catch { /* بيانات تالفة → نُرجع الأعمدة */ }
  return {
    ...data,
    id: r.id, number: r.number, pharmacyId: r.pharmacy_id,
    status: r.status, total: r.total,
    createdAt: r.created_at, updatedAt: r.updated_at,
    items: Array.isArray(data.items) ? data.items : [],
    customer: data.customer && typeof data.customer === 'object' ? data.customer : { name: r.customer_name, phone: r.customer_phone },
  }
}

// إنشاء طلب — متاح للزبناء الضيوف (بلا جلسة) مع تحديد معدل لكل IP
app.post('/api/orders', (req, res) => {
  const rateKey = clientIp(req) || 'unknown'
  if (orderRateLimited(rateKey)) {
    return res.status(429).json({ error: 'طلبات كثيرة — أعد المحاولة بعد قليل' })
  }
  const order = req.body && typeof req.body === 'object' ? req.body : null
  if (!order || typeof order !== 'object') return res.status(400).json({ error: 'طلب غير صالح' })
  const id = strField(order.id, 60)
  const pharmacyId = strField(order.pharmacyId, 40)
  if (!/^[\w-]{3,60}$/.test(id)) return res.status(400).json({ error: 'معرّف الطلب غير صالح' })
  if (!pharmacyId || !db.prepare('SELECT id FROM pharmacies WHERE id = ?').get(pharmacyId)) {
    return res.status(400).json({ error: 'صيدلية غير موجودة' })
  }
  if (!Array.isArray(order.items) || order.items.length < 1 || order.items.length > ORDER_ITEMS_MAX) {
    return res.status(400).json({ error: 'بنود الطلب غير صالحة' })
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
  // كائن الطلب الكامل كما تنتجه الواجهة (مع صورة الوصفة إن وجدت)
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
  // تنظيف الحقول الضخمة غير الضرورية للمعالجة (الصور ≤ 1.2MB مشفرة)
  if (full.prescriptionPhoto && typeof full.prescriptionPhoto === 'string' && full.prescriptionPhoto.length > 1_200_000) {
    delete full.prescriptionPhoto
  }
  let serialized
  try { serialized = JSON.stringify(full) } catch { return res.status(400).json({ error: 'طلب غير قابل للتسلسل' }) }
  if (serialized.length > ORDER_JSON_MAX) return res.status(413).json({ error: 'حجم الطلب كبير جداً' })

  const now = new Date().toISOString()
  try {
    const exists = db.prepare('SELECT id, updated_at FROM orders WHERE id = ?').get(id)
    if (exists) {
      // طلب مكرر (إعادة محاولة بعد انقطاع) — نفس المعرف لا يُنشأ مرتين
      return res.json({ ok: true, id, duplicate: true })
    }
    db.prepare(`INSERT INTO orders (id, number, pharmacy_id, customer_name, customer_phone, status, total, item_count, data, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, full.number, pharmacyId, customer.name, customer.phone, status, total, items.length, serialized, full.createdAt, now)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
  full.updatedAt = now
  audit(req, 'order.create', { id, pharmacyId, customer: customer.name, phone: customer.phone, items: items.length, total })
  realtimeRT.broadcastOrder(full, 'new')
  res.status(201).json({ ok: true, id, updatedAt: now })
})

// قائمة الطلبات — للموظفين (جلسة JWT): سوبر أدمين يرى الكل، وغيره صيدليته
app.get('/api/orders', authenticate, (req, res) => {
  const isSuper = req.user.role === 'super_admin'
  let pharmacyId = strField(req.query.pharmacyId, 40)
  if (!isSuper) pharmacyId = req.user.pharmacyId // غير السوبر أدمين: صيدليته حصراً
  if (pharmacyId && !isSuper && pharmacyId !== req.user.pharmacyId) {
    return res.status(403).json({ error: 'ليست لديك الصلاحيات اللازمة' })
  }
  const since = strField(req.query.since, 40)
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 200)
  let sql = 'SELECT * FROM orders'
  const where = []
  const params = []
  if (pharmacyId) { where.push('pharmacy_id = ?'); params.push(pharmacyId) }
  if (since) { where.push('updated_at > ?'); params.push(since) }
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY created_at DESC LIMIT ?'
  params.push(limit)
  const rows = db.prepare(sql).all(...params)
  audit(req, 'order.list', { pharmacyId: pharmacyId || 'all', count: rows.length }, req.user)
  res.json(rows.map(orderRowToObj))
})

// تعديل طلب (حالة/إسناد/توصيل) — للموظفين، ويُبث فورياً للزبون والزملاء
app.patch('/api/orders/:id', authenticate, (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'الطلب غير موجود' })
  const isSuper = req.user.role === 'super_admin'
  if (!isSuper && row.pharmacy_id !== req.user.pharmacyId) {
    return res.status(403).json({ error: 'هذا الطلب يخص صيدلية أخرى' })
  }
  const { status, assignedTo, deliveryFee, total, notes, deliveryAddress } = req.body || {}
  if (status !== undefined && !ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'حالة غير صالحة' })
  }
  let full
  try { full = JSON.parse(row.data || '{}') } catch { full = {} }
  const changes = {}
  if (status !== undefined) { full.status = status; changes.status = status }
  if (assignedTo !== undefined) { full.assignedTo = strField(assignedTo, 80) || null; changes.assignedTo = full.assignedTo }
  if (deliveryFee !== undefined && Number.isFinite(Number(deliveryFee))) { full.deliveryFee = Number(deliveryFee); changes.deliveryFee = full.deliveryFee }
  if (total !== undefined && Number.isFinite(Number(total))) { full.total = Number(total); changes.total = full.total }
  if (notes !== undefined) { full.notes = strField(notes, 500); changes.notes = full.notes }
  if (deliveryAddress !== undefined) { full.deliveryAddress = strField(deliveryAddress, 300); changes.deliveryAddress = full.deliveryAddress }
  // سجل تاريخ الحالة (يظهر للزبون أينما كان)
  const history = Array.isArray(full.history) ? full.history : []
  if (status !== undefined && status !== row.status) {
    history.push({ status, at: new Date().toISOString(), by: req.user.name || 'موظف' })
  }
  full.history = history.slice(-20)
  const now = new Date().toISOString()
  full.updatedAt = now
  let serialized
  try { serialized = JSON.stringify(full) } catch { return res.status(500).json({ error: 'خطأ تسلسل' }) }
  if (serialized.length > ORDER_JSON_MAX) return res.status(413).json({ error: 'حجم الطلب كبير جداً' })
  db.prepare(`UPDATE orders SET status = ?, total = ?, data = ?, updated_at = ? WHERE id = ?`)
    .run(full.status || row.status, Number.isFinite(Number(full.total)) ? full.total : row.total, serialized, now, row.id)
  audit(req, 'order.update', { id: row.id, ...changes }, req.user)
  realtimeRT.broadcastOrder({ ...full, id: row.id, pharmacyId: row.pharmacy_id }, 'update')
  res.json({ ok: true, id: row.id, updatedAt: now, order: { ...full, id: row.id, pharmacyId: row.pharmacy_id } })
})

// تتبع طلبات الزبون عبر الأجهزة — بالهاتف فقط وحقول دنيا (بلا بنود ولا صور)
app.get('/api/orders/track', (req, res) => {
  const rateKey = clientIp(req) || 'unknown'
  if (orderRateLimited(rateKey)) {
    return res.status(429).json({ error: 'طلبات كثيرة — أعد المحاولة بعد قليل' })
  }
  const phone = strField(req.query.phone, 30).replace(/[\s-]/g, '')
  if (!/^\+?\d{6,20}$/.test(phone)) return res.status(400).json({ error: 'رقم هاتف غير صالح' })
  const rows = db.prepare(
    `SELECT id, number, pharmacy_id, status, total, item_count, created_at, updated_at
     FROM orders WHERE customer_phone = ? ORDER BY created_at DESC LIMIT 50`
  ).all(phone)
  res.json(rows.map((r) => ({
    id: r.id, number: r.number, pharmacyId: r.pharmacy_id, status: r.status,
    total: r.total, itemCount: r.item_count, createdAt: r.created_at, updatedAt: r.updated_at,
  })))
})

// إلغاء طلب من طرف الزبون — بلا جلسة: يتحقق من هاتف صاحب الطلب حصراً
// وبحالة قابلة للإلغاء (قيد الانتظار) كي لا يُلغي أحد طلب غيره.
app.post('/api/orders/:id/cancel', (req, res) => {
  const rateKey = clientIp(req) || 'unknown'
  if (orderRateLimited(rateKey)) {
    return res.status(429).json({ error: 'طلبات كثيرة — أعد المحاولة بعد قليل' })
  }
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'الطلب غير موجود' })
  const phone = strField(req.body?.phone, 30).replace(/[\s-]/g, '')
  const rowPhone = strField(row.customer_phone, 30).replace(/[\s-]/g, '')
  if (!phone || phone !== rowPhone) {
    return res.status(403).json({ error: 'رقم الهاتف لا يطابق صاحب الطلب' })
  }
  if (row.status !== 'pending' && row.status !== 'accepted') {
    return res.status(409).json({ error: 'الطلب قيد المعالجة — تواصل مع الصيدلية لإلغائه' })
  }
  let full
  try { full = JSON.parse(row.data || '{}') } catch { full = {} }
  const now = new Date().toISOString()
  const history = Array.isArray(full.history) ? full.history : []
  history.push({ status: 'cancelled', at: now, by: 'customer' })
  full.status = 'cancelled'
  full.cancelledAt = now
  full.cancelledBy = 'customer'
  full.history = history.slice(-20)
  full.updatedAt = now
  let serialized
  try { serialized = JSON.stringify(full) } catch { return res.status(500).json({ error: 'خطأ تسلسل' }) }
  db.prepare('UPDATE orders SET status = ?, data = ?, updated_at = ? WHERE id = ?')
    .run('cancelled', serialized, now, row.id)
  audit(req, 'order.cancel_customer', { id: row.id, phone }, null)
  realtimeRT.broadcastOrder({ ...full, id: row.id, pharmacyId: row.pharmacy_id }, 'update')
  res.json({ ok: true, id: row.id, updatedAt: now })
})

// ===== الصيدليات =====
app.get('/api/pharmacies', (_req, res) => {
  res.json(db.prepare('SELECT id, name, nameEn, address, phone, email, license, logo, color, created_at FROM pharmacies').all())
})

app.post('/api/pharmacies', authenticate, requireRole('super_admin'), (req, res) => {
  const { name, nameEn, address, phone, email, license, logo } = req.body
  if (!name || !license) return res.status(400).json({ error: 'الاسم ورقم الترخيص إلزاميان' })
  const id = `ph${Date.now()}`
  db.prepare('INSERT INTO pharmacies (id, name, nameEn, address, phone, email, license, logo, color) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, name, nameEn || name, address || '', phone || '', email || '', license, logo || '💊', 'blue')
  audit(req, 'pharmacy.create', { targetId: id, license }, req.user)
  res.status(201).json({ id })
})

// ===== المزامنة الكاملة (من الواجهة إلى SQLite) =====
app.post('/api/sync', requireApiKey, (req, res) => {
  try {
    const { products = [], customers = [], suppliers = [], prescriptions = [], sales = [], users = [], pharmacies = [], auditLog = [] } = req.body
    const upsertProduct = db.prepare(`
      INSERT INTO products (id, code, barcode, name, nameEn, nameFr, dci, dosage, form, presentation, sku, manufacturer, category, cost, price, ppv, prixBR, stock, min_stock, expiry, batch, requires_prescription, taux_remboursement, princeps_generique)
      VALUES (@id, @code, @barcode, @name, @nameEn, @nameFr, @dci, @dosage, @form, @presentation, @sku, @manufacturer, @category, @cost, @price, @ppv, @prixBR, @stock, @minStock, @expiry, @batch, @requiresPrescription, @tauxRemboursement, @princepsGenerique)
      ON CONFLICT(id) DO UPDATE SET
        stock = excluded.stock, price = excluded.price, cost = excluded.cost,
        expiry = excluded.expiry, batch = excluded.batch, updated_at = datetime('now')
    `)
    const upsertCustomer = db.prepare(`INSERT OR IGNORE INTO customers (id, name, phone, email, address, loyalty_points, total_purchases, last_visit) VALUES (@id, @name, @phone, @email, @address, @loyaltyPoints, @totalPurchases, @lastVisit)`)
    const upsertSupplier = db.prepare(`INSERT OR IGNORE INTO suppliers (id, name, contact_name, phone, email, address) VALUES (@id, @name, @contactName, @phone, @email, @address)`)
    const upsertPrescription = db.prepare(`INSERT OR IGNORE INTO prescriptions (id, customer_name, doctor, date, status, medications, notes) VALUES (@id, @customerName, @doctor, @date, @status, @medications, @notes)`)
    const upsertSale = db.prepare(`INSERT OR IGNORE INTO sales (id, customer_name, user_name, subtotal, discount, total, payment_method, amount_paid, items, created_at) VALUES (@id, @customerName, @userName, @subtotal, @discount, @total, @paymentMethod, @amountPaid, @itemsJson, @createdAt)`)
    const upsertAudit = db.prepare(`INSERT OR IGNORE INTO audit_log (id, timestamp, user_id, user_name, user_role, action, details, pharmacy_id) VALUES (@id, @timestamp, @userId, @userName, @userRole, @action, @detailsJson, @pharmacyId)`)
    const upsertPharmacy = db.prepare(`
      INSERT INTO pharmacies (id, name, nameEn, address, phone, email, license, logo, color)
      VALUES (@id, @name, @nameEn, @address, @phone, @email, @license, @logo, @color)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name, nameEn = excluded.nameEn, address = excluded.address,
        phone = excluded.phone, email = excluded.email, license = excluded.license,
        logo = excluded.logo, color = excluded.color
    `)
    const findUser = db.prepare('SELECT id FROM users WHERE id = ?')
    const insertUser = db.prepare(`INSERT INTO users (id, username, password_hash, name, nameEn, role, pharmacy_id, avatar, active) VALUES (@id, @username, @passwordHash, @name, @nameEn, @role, @pharmacyId, @avatar, @active)`)
    const updateUser = db.prepare(`UPDATE users SET name=@name, nameEn=@nameEn, role=@role, pharmacy_id=@pharmacyId, avatar=@avatar, active=@active WHERE id=@id`)

    // تطبيع: better-sqlite3 يرفض أي معامل مسمّى ناقص، وكان ذلك يُسقط السجلات بصمت.
    const asStr = (v, d = null) => (v === undefined || v === null || v === '' ? d : String(v))
    const asNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)
    const asBool = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0)
    const normProduct = (p) => ({
      id: String(p.id), code: asStr(p.code), barcode: asStr(p.barcode), name: String(p.name),
      nameEn: asStr(p.nameEn), nameFr: asStr(p.nameFr), dci: asStr(p.dci), dosage: asStr(p.dosage),
      form: asStr(p.form), presentation: asStr(p.presentation), sku: asStr(p.sku),
      manufacturer: asStr(p.manufacturer), category: asStr(p.category),
      cost: asNum(p.cost), price: asNum(p.price),
      ppv: p.ppv === undefined || p.ppv === null ? null : asNum(p.ppv),
      prixBR: p.prixBR === undefined || p.prixBR === null ? null : asNum(p.prixBR),
      stock: asNum(p.stock), minStock: asNum(p.minStock, 10),
      expiry: asStr(p.expiry), batch: asStr(p.batch),
      requiresPrescription: asBool(p.requiresPrescription),
      tauxRemboursement: asStr(p.tauxRemboursement, '0%'),
      princepsGenerique: asStr(p.princepsGenerique),
    })
    const normCustomer = (c) => ({
      id: String(c.id), name: String(c.name), phone: asStr(c.phone), email: asStr(c.email),
      address: asStr(c.address), loyaltyPoints: asNum(c.loyaltyPoints),
      totalPurchases: asNum(c.totalPurchases), lastVisit: asStr(c.lastVisit),
    })
    const normSupplier = (s) => ({
      id: String(s.id), name: String(s.name), contactName: asStr(s.contactName),
      phone: asStr(s.phone), email: asStr(s.email), address: asStr(s.address),
    })
    const normPrescription = (p) => ({
      id: String(p.id), customerName: asStr(p.customerName), doctor: asStr(p.doctor),
      date: asStr(p.date), status: asStr(p.status, 'pending'),
      medications: JSON.stringify(p.medications || []), notes: asStr(p.notes),
    })
    const normSale = (s) => ({
      id: String(s.id), customerName: asStr(s.customerName), userName: asStr(s.userName),
      subtotal: asNum(s.subtotal), discount: asNum(s.discount), total: asNum(s.total),
      paymentMethod: asStr(s.paymentMethod, 'cash'), amountPaid: asNum(s.amountPaid),
      itemsJson: JSON.stringify(s.items || []),
      createdAt: s.date || s.createdAt || new Date().toISOString(),
    })
    const normPharmacy = (p) => ({
      id: String(p.id), name: String(p.name), nameEn: asStr(p.nameEn, String(p.name)),
      address: asStr(p.address, ''), phone: asStr(p.phone, ''), email: asStr(p.email, ''),
      license: asStr(p.license, ''), logo: asStr(p.logo, '💊'), color: asStr(p.color, 'blue'),
    })
    const normAudit = (a) => ({
      id: String(a.id), timestamp: a.timestamp || new Date().toISOString(),
      userId: asStr(a.userId), userName: asStr(a.userName), userRole: asStr(a.userRole),
      action: String(a.action), detailsJson: JSON.stringify(a.details || {}),
      pharmacyId: asStr(a.pharmacyId),
    })

    let counts = { products: 0, customers: 0, suppliers: 0, prescriptions: 0, sales: 0, pharmacies: 0, users: 0, auditLog: 0 }
    const tx = db.transaction(() => {
      for (const p of products) { try { upsertProduct.run(normProduct(p)); counts.products++ } catch { /* skip malformed */ } }
      for (const c of customers) { try { upsertCustomer.run(normCustomer(c)); counts.customers++ } catch {} }
      for (const s of suppliers) { try { upsertSupplier.run(normSupplier(s)); counts.suppliers++ } catch {} }
      for (const p of prescriptions) { try { upsertPrescription.run(normPrescription(p)); counts.prescriptions++ } catch {} }
      for (const s of sales) { try { upsertSale.run(normSale(s)); counts.sales++ } catch {} }
      for (const ph of pharmacies) { try { upsertPharmacy.run(normPharmacy(ph)); counts.pharmacies++ } catch {} }
      for (const u of users) {
        // لا تُخزَّن كلمة المرور الصريحة أبداً: تُهشَّر عند الإنشاء فقط،
        // ولا تُستبدل كلمة مرور مستخدم موجود عبر المزامنة.
        try {
          const exists = findUser.get(u.id)
          if (exists) {
            updateUser.run({
              id: u.id, name: u.name, nameEn: u.nameEn || null, role: u.role,
              pharmacyId: u.pharmacyId || null, avatar: u.avatar || '👤', active: u.active === false ? 0 : 1,
            })
          } else {
            insertUser.run({
              id: u.id, username: u.username,
              passwordHash: bcrypt.hashSync(String(u.password || randomUUID()), 10),
              name: u.name, nameEn: u.nameEn || null, role: u.role,
              pharmacyId: u.pharmacyId || null, avatar: u.avatar || '👤',
              active: u.active === false ? 0 : 1,
            })
          }
          counts.users++
        } catch {}
      }
      for (const a of auditLog) { try { upsertAudit.run(normAudit(a)); counts.auditLog++ } catch {} }
    })
    tx()
    setMeta('last_sync', new Date().toISOString())
    audit(req, 'data.sync', { synced: counts })
    res.json({ ok: true, synced: counts, lastSync: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ===== استرجاع كل البيانات =====
app.get('/api/data', requireApiKey, (req, res) => {
  const products = db.prepare('SELECT * FROM products').all().map(rowToProduct)
  const customers = db.prepare('SELECT * FROM customers').all()
  const sales = db.prepare('SELECT * FROM sales').all().map(s => ({ ...s, items: JSON.parse(s.items || '[]') }))
  audit(req, 'data.read', {
    products: products.length, customers: customers.length, sales: sales.length,
  })
  res.json({
    products, customers, sales,
    suppliers: db.prepare('SELECT * FROM suppliers').all(),
    prescriptions: db.prepare('SELECT * FROM prescriptions').all().map(p => ({ ...p, medications: JSON.parse(p.medications || '[]') })),
    pharmacies: db.prepare('SELECT * FROM pharmacies').all(),
    orders: db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 500').all().map((o) => { try { return { ...JSON.parse(o.data || '{}'), id: o.id, updatedAt: o.updated_at } } catch { return null } }).filter(Boolean),
    lastSync: getMeta('last_sync'),
  })
})

function rowToProduct(r) {
  return {
    id: r.id, code: r.code, barcode: r.barcode, name: r.name, nameEn: r.nameEn, nameFr: r.nameFr,
    dci: r.dci, dosage: r.dosage, form: r.form, presentation: r.presentation, sku: r.sku,
    manufacturer: r.manufacturer, category: r.category, cost: r.cost, price: r.price, ppv: r.ppv, prixBR: r.prixBR,
    stock: r.stock, minStock: r.min_stock, expiry: r.expiry, batch: r.batch,
    requiresPrescription: !!r.requires_prescription, tauxRemboursement: r.taux_remboursement, princepsGenerique: r.princeps_generique,
  }
}

// ===== سجل التدقيق =====
app.get('/api/audit', authenticate, requireRole('super_admin'), (_req, res) => {
  const rows = db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 500').all()
  res.json(rows.map(r => ({ ...r, details: JSON.parse(r.details || '{}') })))
})

// ===== النسخ الاحتياطي =====
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups')
const BACKUP_KEEP = 30

app.get('/api/backup', requireApiKey, (req, res) => {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dbFile = `phmp-${stamp}.db`
    const dbTarget = path.join(BACKUP_DIR, dbFile)
    // لقطة ذرّية متسقة أثناء التشغيل (WAL)
    db.prepare('VACUUM INTO ?').run(dbTarget)

    const backup = {
      created_at: new Date().toISOString(),
      version: getMeta('db_version'),
      pharmacies: db.prepare('SELECT * FROM pharmacies').all(),
      users: db.prepare('SELECT id, username, name, role, pharmacy_id, active FROM users').all(),
      products: db.prepare('SELECT * FROM products').all(),
      customers: db.prepare('SELECT * FROM customers').all(),
      suppliers: db.prepare('SELECT * FROM suppliers').all(),
      prescriptions: db.prepare('SELECT * FROM prescriptions').all(),
      sales: db.prepare('SELECT * FROM sales').all(),
      orders: db.prepare('SELECT id, number, pharmacy_id, customer_name, customer_phone, status, total, item_count, data, created_at, updated_at FROM orders').all(),
      audit_log: db.prepare('SELECT * FROM audit_log').all(),
    }
    const jsonFile = `phmp-backup-${stamp}.json`
    fs.writeFileSync(path.join(BACKUP_DIR, jsonFile), JSON.stringify(backup, null, 2))

    // الاحتفاظ بآخر 30 نسخة فقط
    for (const prefix of ['phmp-', 'phmp-backup-']) {
      const files = fs.readdirSync(BACKUP_DIR)
        .filter((f) => f.startsWith(prefix) && (f.endsWith('.db') || f.endsWith('.json')))
        .sort()
      for (const old of files.slice(0, Math.max(0, files.length - BACKUP_KEEP))) {
        fs.unlinkSync(path.join(BACKUP_DIR, old))
      }
    }

    const sizes = Object.fromEntries(Object.entries(backup).map(([k, v]) => [k, Array.isArray(v) ? v.length : v]))
    audit(req, 'data.backup', { dbFile, jsonFile })
    res.json({ ok: true, file: jsonFile, dbFile, sizes })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const server = app.listen(PORT, HOST, () => {
  console.log('✅ خادم PHMP المحلي يعمل الآن')
  console.log(`   محلياً:   http://${HOST}:${PORT}`)
  console.log(`   قاعدة البيانات: ${DB_PATH}`)
  console.log('   بانتظار تشغيل النفق الدائم (راجع tunnel/start-tunnel.sh)')
})

// ===== خادم الاتصال الفوري (WebSocket) — التراسل والمكالمات بلا تخزين =====
// المكالمات الصوتية/المرئية تُستهلك مباشرة بين المستخدمين (WebRTC ندّ لند)؛
// هذا الخادم يرحّل الرسائل وإشارات الاتصال في الذاكرة فقط. الطلبات وحدها
// تُحفظ في SQLite وتُبث عبر broadcastOrder بعد كل حفظ (قاعدة 8 المحدَّثة).
const realtimeRT = setupRealtime(server, {
  // تحقق حي من JWT: يعيد قراءة الدور والحالة من قاعدة البيانات — أي توقيف
  // أو تخفيض يسري فوراً على الاتصال الفوري أيضاً (لا ينتظر انتهاء الرمز).
  verifyJwt: (token) => {
    const payload = jwt.verify(token, JWT_SECRET)
    const fresh = db.prepare('SELECT role, active, pharmacy_id FROM users WHERE id = ?').get(payload.id)
    if (!fresh || !fresh.active) throw new Error('الحساب موقوف أو محذوف')
    return { ...payload, role: fresh.role, pharmacyId: fresh.pharmacy_id }
  },
  log: (m) => console.log(m),
})

// إغلاق نظيف (يحافظ على سلامة WAL)
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\n${sig} — إغلاق الخادم...`)
    server.close(() => {
      try { db.close() } catch {}
      process.exit(0)
    })
    setTimeout(() => process.exit(0), 5000).unref()
  })
}
