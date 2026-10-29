// PHMP - خادم API المحلي (SQLite + نفق دائم)
// منصة إدارة الصيدلية PharmaCare Pro
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
  res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
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
const authenticate = (req, res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'مطلوب تسجيل الدخول' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'جلسة غير صالحة' })
  }
}

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
  const { name, role, pharmacyId, active, password } = req.body
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
  const updates = {}
  if (name !== undefined) { updates.name = name; db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, target.id) }
  if (role !== undefined && target.role !== 'super_admin') { updates.role = role; db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, target.id) }
  if (pharmacyId !== undefined) { updates.pharmacy_id = pharmacyId; db.prepare('UPDATE users SET pharmacy_id = ? WHERE id = ?').run(pharmacyId, target.id) }
  if (active !== undefined && target.role !== 'super_admin') { updates.active = active ? 1 : 0; db.prepare('UPDATE users SET active = ? WHERE id = ?').run(updates.active, target.id) }
  if (password) { db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), target.id) }
  audit(req, 'user.update', { targetId: target.id, fields: Object.keys(updates), passwordChanged: !!password }, req.user)
  res.json({ ok: true, updates: Object.keys(updates) })
})

app.delete('/api/users/:id', authenticate, requireRole('super_admin', 'admin'), (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!target) return res.status(404).json({ error: 'المستخدم غير موجود' })
  if (target.role === 'super_admin') return res.status(403).json({ error: 'لا يمكن حذف مالك المنصة' })
  if (target.id === req.user.id) return res.status(403).json({ error: 'لا يمكنك حذف حسابك' })
  if (req.user.role === 'admin' && target.pharmacy_id !== req.user.pharmacyId) {
    return res.status(403).json({ error: 'لا يمكنك حذف مستخدم من صيدلية أخرى' })
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(target.id)
  audit(req, 'user.delete', { targetId: target.id, username: target.username }, req.user)
  res.json({ ok: true })
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
