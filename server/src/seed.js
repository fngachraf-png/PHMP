// PHMP - تهيئة قاعدة البيانات ببيانات البداية (Seed)
// المستخدمون بكلمات مرور مشفرة bcrypt
import bcrypt from 'bcryptjs'
import { db, initSchema, setMeta } from './db.js'

initSchema()

const SALT_ROUNDS = 10

const pharmacies = [
  { id: 'ph1', name: 'صيدلية النور / Al Noor Pharmacy', nameEn: 'Al Noor Pharmacy', address: 'شارع الحسن الثاني، الدار البيضاء', phone: '+212 522 123 456', email: 'alnoor@pharmacare.ma', license: 'PH-2024-001', logo: '💊', color: 'emerald' },
  { id: 'ph2', name: 'صيدلية الشفاء / Al Shifa Pharmacy', nameEn: 'Al Shifa Pharmacy', address: 'حي المعاريف، الرباط', phone: '+212 537 765 432', email: 'alshifa@pharmacare.ma', license: 'PH-2024-002', logo: '⚕️', color: 'blue' },
  { id: 'ph3', name: 'صيدلية الحياة / Al Hayat Pharmacy', nameEn: 'Al Hayat Pharmacy', address: 'زنقة محمد الخامس، مراكش', phone: '+212 524 333 999', email: 'alhayat@pharmacare.ma', license: 'PH-2024-003', logo: '🏥', color: 'purple' },
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
  const passwordHash = bcrypt.hashSync(u.password, SALT_ROUNDS)
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
console.log('👤 حسابات الدخول (وضع تجريبي - غيّر كلمات المرور في الإنتاج):')
users.forEach(u => console.log(`   ${u.role.padEnd(12)} | ${u.username.padEnd(14)} | ${u.password}`))
