// PHMP - تهيئة قاعدة البيانات ببيانات البداية (Seed)
// المستخدمون بكلمات مرور مشفرة bcrypt
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { db, initSchema, setMeta } from './db.js'

try {
  process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env'))
} catch { /* اختياري */ }

initSchema()

const SALT_ROUNDS = 10

// كلمات المرور: من ملف اعتمادات محمي (600) عند ضبط PHMP_SEED_PASSWORDS_FILE.
// لا تُطبع أبداً في السجل، ولا تُستعمل القيم الافتراضية في الإنتاج.
const passwordsFile = process.env.PHMP_SEED_PASSWORDS_FILE
let securePasswords = {}
if (passwordsFile) {
  securePasswords = JSON.parse(fs.readFileSync(passwordsFile, 'utf8')).users || {}
} else {
  console.warn('⚠️ PHMP_SEED_PASSWORDS_FILE غير مضبوط — تُستعمل كلمات مرور تجريبية ضعيفة. لا تصلح للإنتاج.')
}

const pharmacies = [
  { id: 'ph1', name: 'صيدلية النور / Al Noor Pharmacy', nameEn: 'Al Noor Pharmacy', address: 'شارع الحسن الثاني، الدار البيضاء', phone: '+212 522 123 456', email: 'alnoor@phmp.ma', license: 'PH-2024-001', logo: '💊', color: 'emerald' },
  { id: 'ph2', name: 'صيدلية الشفاء / Al Shifa Pharmacy', nameEn: 'Al Shifa Pharmacy', address: 'حي المعاريف، الرباط', phone: '+212 537 765 432', email: 'alshifa@phmp.ma', license: 'PH-2024-002', logo: '⚕️', color: 'blue' },
  { id: 'ph3', name: 'صيدلية الحياة / Al Hayat Pharmacy', nameEn: 'Al Hayat Pharmacy', address: 'زنقة محمد الخامس، مراكش', phone: '+212 524 333 999', email: 'alhayat@phmp.ma', license: 'PH-2024-003', logo: '🏥', color: 'purple' },
]

// كلمات المرور الافتراضية - يجب تغييرها في الإنتاج
const users = [
  { id: 'u0', username: 'superadmin', password: 'super123', name: 'طارق الشويكة', nameEn: 'Tarik Chouika', role: 'super_admin', pharmacyId: null, avatar: '👑' },
  { id: 'u1', username: 'admin', password: 'admin', name: 'محمد الإدريسي', nameEn: 'Mohamed Idrissi', role: 'admin', pharmacyId: 'ph1', avatar: '👨‍⚕️' },
  { id: 'u2', username: 'pharmacist', password: 'pharma', name: 'فاطمة الزهراء', nameEn: 'Fatima Zahra', role: 'pharmacist', pharmacyId: 'ph1', avatar: '👩‍⚕️' },
  { id: 'u3', username: 'cashier', password: 'cashier', name: 'يوسف بن علي', nameEn: 'Youssef Ben Ali', role: 'cashier', pharmacyId: 'ph1', avatar: '🧑‍💼' },
  { id: 'u4', username: 'admin2', password: 'admin', name: 'سعيد أمزيان', nameEn: 'Said Amzian', role: 'admin', pharmacyId: 'ph2', avatar: '👨‍💼' },
  { id: 'u5', username: 'admin3', password: 'admin', name: 'نورة بنحمو', nameEn: 'Noura Benhamou', role: 'admin', pharmacyId: 'ph3', avatar: '👩‍💼' },
  { id: 'u6', username: 'accountant', password: 'account', name: 'خديجة الرامي', nameEn: 'Khadija Ramy', role: 'accountant', pharmacyId: 'ph1', avatar: '👩‍💻' },
  { id: 'u7', username: 'pharmacist2', password: 'pharma', name: 'أمينة الودغيري', nameEn: 'Amina Ouadghiri', role: 'pharmacist', pharmacyId: 'ph2', avatar: '👩‍⚕️' },
]

const insertPharmacy = db.prepare(`INSERT OR IGNORE INTO pharmacies (id, name, nameEn, address, phone, email, license, logo, color) VALUES (@id, @name, @nameEn, @address, @phone, @email, @license, @logo, @color)`)
const insertUser = db.prepare(`INSERT OR IGNORE INTO users (id, username, password_hash, name, nameEn, role, pharmacy_id, avatar, active) VALUES (@id, @username, @passwordHash, @name, @nameEn, @role, @pharmacyId, @avatar, 1)`)

console.log('⏳ تهيئة قاعدة البيانات...')

for (const ph of pharmacies) insertPharmacy.run(ph)

for (const u of users) {
  const plain = passwordsFile ? securePasswords[u.username] : u.password
  if (!plain) {
    console.error(`❌ لا توجد كلمة مرور للمستخدم ${u.username} — أضفها في ملف الاعتمادات.`)
    process.exit(1)
  }
  const passwordHash = bcrypt.hashSync(plain, SALT_ROUNDS)
  insertUser.run({ ...u, passwordHash })
}

setMeta('seeded_at', new Date().toISOString())
setMeta('db_version', '1.0.0')

const counts = {
  pharmacies: db.prepare('SELECT COUNT(*) c FROM pharmacies').get().c,
  users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
  products: db.prepare('SELECT COUNT(*) c FROM products').get().c,
}

console.log('✅ تمت التهيئة بنجاح:')
console.log(`   الصيدليات: ${counts.pharmacies} | المستخدمون: ${counts.users} | المنتجات: ${counts.products}`)
console.log('')
console.log('👤 حسابات الدخول (كلمات المرور في ملف الاعتمادات المحمي فقط — لا تُطبع هنا):')
users.forEach(u => console.log(`   ${u.role.padEnd(12)} | ${u.username}`))
