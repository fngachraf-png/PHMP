// PHMP - خادم API المحلي (SQLite + نفق دائم)
// منصة إدارة الصيدلية PharmaCare Pro
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { db, initSchema, setMeta, getMeta, DB_PATH } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'phmp-local-secret-change-me-in-production'

initSchema()

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))

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

// ===== الصحة =====
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'PHMP Local Server',
    database: 'SQLite',
    dbPath: DB_PATH,
    version: getMeta('db_version') || '1.0.0',
    time: new Date().toISOString(),
  })
})

// ===== تسجيل الدخول =====
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ error: 'بيانات ناقصة' })
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' })
    }
    if (!user.active) return res.status(403).json({ error: 'هذا الحساب موقوف' })
    db.prepare('UPDATE users SET last_login = datetime("now") WHERE id = ?').run(user.id)
    const pharmacy = user.pharmacy_id
      ? db.prepare('SELECT * FROM pharmacies WHERE id = ?').get(user.pharmacy_id)
      : null
    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role, pharmacyId: user.pharmacy_id },
      JWT_SECRET,
      { expiresIn: '12h' }
    )
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
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    return res.status(409).json({ error: 'اسم المستخدم مستعمل من قبل' })
  }
  const id = `u${Date.now()}`
  const hash = bcrypt.hashSync(password, 10)
  db.prepare('INSERT INTO users (id, username, password_hash, name, nameEn, role, pharmacy_id, avatar) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, username, hash, name, nameEn || null, role, pharmacyId || null, avatar || '👤')
  res.status(201).json({ id })
})

app.patch('/api/users/:id', authenticate, requireRole('super_admin', 'admin'), (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!target) return res.status(404).json({ error: 'المستخدم غير موجود' })
  if (target.role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'لا يمكن تعديل مالك المنصة' })
  }
  const { name, role, pharmacyId, active, password } = req.body
  const updates = {}
  if (name !== undefined) { updates.name = name; db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, target.id) }
  if (role !== undefined && target.role !== 'super_admin') { updates.role = role; db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, target.id) }
  if (pharmacyId !== undefined) { updates.pharmacy_id = pharmacyId; db.prepare('UPDATE users SET pharmacy_id = ? WHERE id = ?').run(pharmacyId, target.id) }
  if (active !== undefined && target.role !== 'super_admin') { updates.active = active ? 1 : 0; db.prepare('UPDATE users SET active = ? WHERE id = ?').run(updates.active, target.id) }
  if (password) { db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), target.id) }
  res.json({ ok: true, updates: Object.keys(updates) })
})

app.delete('/api/users/:id', authenticate, requireRole('super_admin', 'admin'), (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!target) return res.status(404).json({ error: 'المستخدم غير موجود' })
  if (target.role === 'super_admin') return res.status(403).json({ error: 'لا يمكن حذف مالك المنصة' })
  if (target.id === req.user.id) return res.status(403).json({ error: 'لا يمكنك حذف حسابك' })
  db.prepare('DELETE FROM users WHERE id = ?').run(target.id)
  res.json({ ok: true })
})

// ===== الصيدليات =====
app.get('/api/pharmacies', (_req, res) => {
  res.json(db.prepare('SELECT * FROM pharmacies').all())
})

app.post('/api/pharmacies', authenticate, requireRole('super_admin'), (req, res) => {
  const { name, nameEn, address, phone, email, license, logo } = req.body
  if (!name || !license) return res.status(400).json({ error: 'الاسم ورقم الترخيص إلزاميان' })
  const id = `ph${Date.now()}`
  db.prepare('INSERT INTO pharmacies (id, name, nameEn, address, phone, email, license, logo, color) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, name, nameEn || name, address || '', phone || '', email || '', license, logo || '💊', 'blue')
  res.status(201).json({ id })
})

// ===== المزامنة الكاملة (من الواجهة إلى SQLite) =====
app.post('/api/sync', (req, res) => {
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

    let counts = { products: 0, customers: 0, suppliers: 0, prescriptions: 0, sales: 0, auditLog: 0 }
    const tx = db.transaction(() => {
      for (const p of products) { try { upsertProduct.run(p); counts.products++ } catch { /* skip malformed */ } }
      for (const c of customers) { try { upsertCustomer.run(c); counts.customers++ } catch {} }
      for (const s of suppliers) { try { upsertSupplier.run(s); counts.suppliers++ } catch {} }
      for (const p of prescriptions) { try { upsertPrescription.run({ ...p, medications: JSON.stringify(p.medications || []) }); counts.prescriptions++ } catch {} }
      for (const s of sales) {
        try {
          upsertSale.run({ ...s, itemsJson: JSON.stringify(s.items || []), createdAt: s.date || s.createdAt || new Date().toISOString() })
          counts.sales++
        } catch {}
      }
      for (const a of auditLog) { try { upsertAudit.run({ ...a, detailsJson: JSON.stringify(a.details || {}) }); counts.auditLog++ } catch {} }
    })
    tx()
    setMeta('last_sync', new Date().toISOString())
    res.json({ ok: true, synced: counts, lastSync: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ===== استرجاع كل البيانات =====
app.get('/api/data', (_req, res) => {
  const products = db.prepare('SELECT * FROM products').all().map(rowToProduct)
  const customers = db.prepare('SELECT * FROM customers').all()
  const sales = db.prepare('SELECT * FROM sales').all().map(s => ({ ...s, items: JSON.parse(s.items || '[]') }))
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
app.get('/api/backup', (_req, res) => {
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
  const fname = `phmp-backup-${new Date().toISOString().slice(0, 10)}.json`
  fs.writeFileSync(path.join(__dirname, '..', 'data', fname), JSON.stringify(backup, null, 2))
  res.json({ ok: true, file: fname, sizes: Object.fromEntries(Object.entries(backup).map(([k, v]) => [k, Array.isArray(v) ? v.length : v])) })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log('✅ خادم PHMP المحلي يعمل الآن')
  console.log(`   محلياً:   http://localhost:${PORT}`)
  console.log(`   قاعدة البيانات: ${DB_PATH}`)
  console.log('   بانتظار تشغيل النفق الدائم (راجع tunnel/start-tunnel.sh)')
})
