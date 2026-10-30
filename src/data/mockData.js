// Mock data for Pharmacy Management Platform PHMP - realistic pharmacy data
// المبيعات التجريبية تُبنى على الأدوية الرسمية للائحة المغربية حتى تُعرض
// أسماء الأدوية بلغة الواجهة الصحيحة (AR/FR/EN) في التقارير والرسوم،
// وترتبط بتكلفة حقيقية (COGS) في تقرير الأرباح.
import { moroccanDrugs } from './moroccanDrugs'

export const pharmacies = [
  {
    id: 'ph1',
    name: 'صيدلية النور',
    nameEn: 'Al Noor Pharmacy',
    nameFr: 'Pharmacie Al Noor',
    address: 'شارع الحسن الثاني، الدار البيضاء',
    addressEn: 'Hassan II Avenue, Casablanca',
    addressFr: 'Avenue Hassan II, Casablanca',
    phone: '+212 522 123 456',
    email: 'alnoor@phmp.ma',
    license: 'PH-2024-001',
    logo: '💊',
    color: 'emerald'
  },
  {
    id: 'ph2',
    name: 'صيدلية الشفاء',
    nameEn: 'Al Shifa Pharmacy',
    nameFr: 'Pharmacie Al Shifa',
    address: 'حي المعاريف، الرباط',
    addressEn: 'Maarif District, Rabat',
    addressFr: 'Quartier Maarif, Rabat',
    phone: '+212 537 765 432',
    email: 'alshifa@phmp.ma',
    license: 'PH-2024-002',
    logo: '⚕️',
    color: 'blue'
  },
  {
    id: 'ph3',
    name: 'صيدلية الحياة',
    nameEn: 'Al Hayat Pharmacy',
    nameFr: 'Pharmacie Al Hayat',
    address: 'زنقة محمد الخامس، مراكش',
    addressEn: 'Mohammed V Street, Marrakech',
    addressFr: 'Rue Mohammed V, Marrakech',
    phone: '+212 524 333 999',
    email: 'alhayat@phmp.ma',
    license: 'PH-2024-003',
    logo: '🏥',
    color: 'purple'
  }
]

// المستخدمون - الأدوار: super_admin (مالك المنصة) > admin > accountant > pharmacist > cashier
export const users = [
  { id: 'u0', username: 'superadmin', password: 'super123', name: 'طارق الشويكة', nameEn: 'Tarik Chouika', role: 'super_admin', pharmacyId: null, avatar: '👑', active: true },
  { id: 'u1', username: 'admin', password: 'admin', name: 'محمد الإدريسي', role: 'admin', pharmacyId: 'ph1', avatar: '👨‍⚕️', active: true },
  { id: 'u2', username: 'pharmacist', password: 'pharma', name: 'فاطمة الزهراء', role: 'pharmacist', pharmacyId: 'ph1', avatar: '👩‍⚕️', active: true },
  { id: 'u3', username: 'cashier', password: 'cashier', name: 'يوسف بن علي', role: 'cashier', pharmacyId: 'ph1', avatar: '🧑‍💼', active: true },
  { id: 'u4', username: 'admin2', password: 'admin', name: 'سعيد أمزيان', role: 'admin', pharmacyId: 'ph2', avatar: '👨‍💼', active: true },
  { id: 'u5', username: 'admin3', password: 'admin', name: 'نورة بنحمو', role: 'admin', pharmacyId: 'ph3', avatar: '👩‍💼', active: true },
  { id: 'u6', username: 'accountant', password: 'account', name: 'خديجة الرامي', role: 'accountant', pharmacyId: 'ph1', avatar: '👩‍💻', active: true },
  { id: 'u7', username: 'pharmacist2', password: 'pharma', name: 'أمينة الودغيري', role: 'pharmacist', pharmacyId: 'ph2', avatar: '👩‍⚕️', active: true },
]

// Real Moroccan & international pharmaceutical products
export const products = [
  // Analgesics & Antipyretics
  { id: 'p1', name: 'باراسيتامول 500mg', nameEn: 'Paracetamol 500mg', barcode: '6111000010012', sku: 'MED-001', category: 'painkillers', manufacturer: 'Sanofi', cost: 8, price: 15, stock: 245, minStock: 50, expiry: '2026-12-31', batch: 'BTH-2024-A1', requiresPrescription: false, dosage: 'قرص واحد كل 8 ساعات', image: '💊' },
  { id: 'p2', name: 'ايبوبروفين 400mg', nameEn: 'Ibuprofen 400mg', barcode: '6111000010029', sku: 'MED-002', category: 'painkillers', manufacturer: 'Pfizer', cost: 12, price: 22, stock: 180, minStock: 40, expiry: '2026-08-15', batch: 'BTH-2024-B2', requiresPrescription: false, dosage: 'قرص واحد كل 12 ساعة', image: '💊' },
  { id: 'p3', name: 'أسبرين 100mg', nameEn: 'Aspirin 100mg', barcode: '6111000010036', sku: 'MED-003', category: 'painkillers', manufacturer: 'Bayer', cost: 6, price: 12, stock: 320, minStock: 50, expiry: '2027-03-20', batch: 'BTH-2024-C3', requiresPrescription: false, dosage: 'قرص واحد يومياً', image: '💊' },

  // Antibiotics
  { id: 'p4', name: 'أموكسيسيلين 500mg', nameEn: 'Amoxicillin 500mg', barcode: '6111000020011', sku: 'MED-004', category: 'antibiotics', manufacturer: 'GSK', cost: 25, price: 45, stock: 120, minStock: 30, expiry: '2025-11-30', batch: 'BTH-2024-D4', requiresPrescription: true, dosage: 'كبسولة كل 8 ساعات', image: '💊' },
  { id: 'p5', name: 'أزيثروميسين 500mg', nameEn: 'Azithromycin 500mg', barcode: '6111000020028', sku: 'MED-005', category: 'antibiotics', manufacturer: 'Pfizer', cost: 35, price: 65, stock: 85, minStock: 20, expiry: '2025-09-10', batch: 'BTH-2024-E5', requiresPrescription: true, dosage: 'قرص واحد يومياً لمدة 3 أيام', image: '💊' },
  { id: 'p6', name: 'سيبروفلوكساسين 500mg', nameEn: 'Ciprofloxacin 500mg', barcode: '6111000020035', sku: 'MED-006', category: 'antibiotics', manufacturer: 'Bayer', cost: 30, price: 55, stock: 15, minStock: 25, expiry: '2025-07-25', batch: 'BTH-2024-F6', requiresPrescription: true, dosage: 'قرص كل 12 ساعة', image: '💊' },

  // Chronic Disease
  { id: 'p7', name: 'ميتفورمين 850mg', nameEn: 'Metformin 850mg', barcode: '6111000030019', sku: 'MED-007', category: 'diabetes', manufacturer: 'Merck', cost: 18, price: 32, stock: 200, minStock: 40, expiry: '2026-06-30', batch: 'BTH-2024-G7', requiresPrescription: true, dosage: 'قرص مع الوجبات', image: '💊' },
  { id: 'p8', name: 'أتورفاستاتين 20mg', nameEn: 'Atorvastatin 20mg', barcode: '6111000030026', sku: 'MED-008', category: 'cardiology', manufacturer: 'Pfizer', cost: 40, price: 75, stock: 95, minStock: 20, expiry: '2026-04-15', batch: 'BTH-2024-H8', requiresPrescription: true, dosage: 'قرص واحد يومياً مساءً', image: '💊' },
  { id: 'p9', name: 'لوزارتان 50mg', nameEn: 'Losartan 50mg', barcode: '6111000030033', sku: 'MED-009', category: 'cardiology', manufacturer: 'Merck', cost: 32, price: 58, stock: 110, minStock: 25, expiry: '2026-10-20', batch: 'BTH-2024-I9', requiresPrescription: true, dosage: 'قرص واحد يومياً', image: '💊' },

  // Vitamins & Supplements
  { id: 'p10', name: 'فيتامين D3 1000IU', nameEn: 'Vitamin D3 1000IU', barcode: '6111000040016', sku: 'VIT-001', category: 'vitamins', manufacturer: 'Nature Made', cost: 45, price: 85, stock: 150, minStock: 30, expiry: '2027-01-31', batch: 'BTH-2024-J10', requiresPrescription: false, dosage: 'كبسولة يومياً', image: '🟡' },
  { id: 'p11', name: 'فيتامين C 1000mg', nameEn: 'Vitamin C 1000mg', barcode: '6111000040023', sku: 'VIT-002', category: 'vitamins', manufacturer: 'Nature Made', cost: 30, price: 55, stock: 220, minStock: 40, expiry: '2026-12-15', batch: 'BTH-2024-K11', requiresPrescription: false, dosage: 'قرص فوار يومياً', image: '🟠' },
  { id: 'p12', name: 'أوميغا 3', nameEn: 'Omega 3', barcode: '6111000040030', sku: 'VIT-003', category: 'vitamins', manufacturer: 'Nordic Naturals', cost: 85, price: 145, stock: 75, minStock: 20, expiry: '2026-09-30', batch: 'BTH-2024-L12', requiresPrescription: false, dosage: 'كبسولتين يومياً', image: '🐟' },

  // Cold & Flu
  { id: 'p13', name: 'بنادول كولد + فلو', nameEn: 'Panadol Cold + Flu', barcode: '6111000050013', sku: 'MED-010', category: 'cold_flu', manufacturer: 'GSK', cost: 18, price: 32, stock: 165, minStock: 35, expiry: '2026-02-28', batch: 'BTH-2024-M13', requiresPrescription: false, dosage: 'قرص كل 6 ساعات', image: '💊' },
  { id: 'p14', name: 'ستريبسلز', nameEn: 'Strepsils', barcode: '6111000050020', sku: 'MED-011', category: 'cold_flu', manufacturer: 'Reckitt', cost: 22, price: 38, stock: 8, minStock: 30, expiry: '2025-06-15', batch: 'BTH-2024-N14', requiresPrescription: false, dosage: 'استحلاب كل 3 ساعات', image: '🍬' },

  // Skin Care
  { id: 'p15', name: 'كريم بانثينول', nameEn: 'Bepanthen Cream', barcode: '6111000060010', sku: 'SKN-001', category: 'skincare', manufacturer: 'Bayer', cost: 35, price: 62, stock: 60, minStock: 15, expiry: '2027-05-30', batch: 'BTH-2024-O15', requiresPrescription: false, dosage: 'دهن مرتين يومياً', image: '🧴' },
  { id: 'p16', name: 'فيوسيدين كريم', nameEn: 'Fucidin Cream', barcode: '6111000060027', sku: 'SKN-002', category: 'skincare', manufacturer: 'Leo Pharma', cost: 48, price: 85, stock: 42, minStock: 10, expiry: '2025-12-20', batch: 'BTH-2024-P16', requiresPrescription: true, dosage: 'دهن 3 مرات يومياً', image: '🧴' },

  // Baby Care
  { id: 'p17', name: 'حليب نان 1', nameEn: 'Nan 1 Formula', barcode: '6111000070017', sku: 'BAB-001', category: 'baby', manufacturer: 'Nestle', cost: 95, price: 135, stock: 90, minStock: 20, expiry: '2026-08-31', batch: 'BTH-2024-Q17', requiresPrescription: false, dosage: 'حسب عمر الطفل', image: '🍼' },
  { id: 'p18', name: 'فيتامين د للأطفال', nameEn: 'Vitamin D for Babies', barcode: '6111000070024', sku: 'BAB-002', category: 'baby', manufacturer: 'Ddrops', cost: 55, price: 95, stock: 5, minStock: 25, expiry: '2025-05-30', batch: 'BTH-2024-R18', requiresPrescription: false, dosage: 'قطرة يومياً', image: '💧' },

  // Personal Care
  { id: 'p19', name: 'معجون أسنان سنسوداين', nameEn: 'Sensodyne Toothpaste', barcode: '6111000080014', sku: 'PER-001', category: 'personal_care', manufacturer: 'GSK', cost: 28, price: 48, stock: 130, minStock: 25, expiry: '2027-02-28', batch: 'BTH-2024-S19', requiresPrescription: false, dosage: 'مرتين يومياً', image: '🪥' },
  { id: 'p20', name: 'شامبو هيد آند شولدرز', nameEn: 'Head & Shoulders Shampoo', barcode: '6111000080021', sku: 'PER-002', category: 'personal_care', manufacturer: 'P&G', cost: 35, price: 58, stock: 70, minStock: 15, expiry: '2027-06-30', batch: 'BTH-2024-T20', requiresPrescription: false, dosage: 'حسب الحاجة', image: '🧴' },
]

export const categories = [
  { id: 'painkillers', name: 'مسكنات وأدوية الألم', nameEn: 'Painkillers', color: 'red', icon: '💊' },
  { id: 'antibiotics', name: 'مضادات حيوية', nameEn: 'Antibiotics', color: 'purple', icon: '🧬' },
  { id: 'diabetes', name: 'أدوية السكري', nameEn: 'Diabetes', color: 'orange', icon: '🩸' },
  { id: 'cardiology', name: 'أدوية القلب والضغط', nameEn: 'Cardiology', color: 'red', icon: '❤️' },
  { id: 'vitamins', name: 'فيتامينات ومكملات', nameEn: 'Vitamins', color: 'yellow', icon: '🌟' },
  { id: 'cold_flu', name: 'البرد والإنفلونزا', nameEn: 'Cold & Flu', color: 'blue', icon: '🤧' },
  { id: 'skincare', name: 'العناية بالبشرة', nameEn: 'Skincare', color: 'pink', icon: '✨' },
  { id: 'baby', name: 'العناية بالأطفال', nameEn: 'Baby Care', color: 'cyan', icon: '👶' },
  { id: 'personal_care', name: 'العناية الشخصية', nameEn: 'Personal Care', color: 'teal', icon: '🧼' },
]

export const customers = [
  { id: 'c1', name: 'أحمد بن محمد', nameEn: 'Ahmed Ben Mohamed', phone: '+212 661 234 567', email: 'ahmed@email.com', address: 'الدار البيضاء', loyaltyPoints: 245, totalPurchases: 1850, lastVisit: '2026-06-18', avatar: '👨' },
  { id: 'c2', name: 'خديجة العلوي', nameEn: 'Khadija Alaoui', phone: '+212 662 345 678', email: 'khadija@email.com', address: 'الرباط', loyaltyPoints: 580, totalPurchases: 4200, lastVisit: '2026-06-20', avatar: '👩' },
  { id: 'c3', name: 'يوسف التازي', nameEn: 'Youssef Tazi', phone: '+212 663 456 789', email: 'youssef@email.com', address: 'مراكش', loyaltyPoints: 120, totalPurchases: 950, lastVisit: '2026-06-15', avatar: '🧑' },
  { id: 'c4', name: 'سارة بنعمر', nameEn: 'Sara Benamar', phone: '+212 664 567 890', email: 'sara@email.com', address: 'فاس', loyaltyPoints: 320, totalPurchases: 2800, lastVisit: '2026-06-19', avatar: '👩' },
  { id: 'c5', name: 'كريم الإدريسي', nameEn: 'Karim Idrissi', phone: '+212 665 678 901', email: 'karim@email.com', address: 'طنجة', loyaltyPoints: 95, totalPurchases: 680, lastVisit: '2026-06-12', avatar: '👨' },
  { id: 'c6', name: 'مريم الحسني', nameEn: 'Meryem Hassani', phone: '+212 666 789 012', email: 'mariam@email.com', address: 'أكادير', loyaltyPoints: 410, totalPurchases: 3450, lastVisit: '2026-06-21', avatar: '👩' },
]

export const suppliers = [
  { id: 's1', name: 'سانوفي المغرب', nameEn: 'Sanofi Maroc', contact: 'كريم بن صالح', phone: '+212 522 111 222', email: 'contact@sanofi.ma', address: 'الدار البيضاء', rating: 4.8, totalOrders: 156, category: 'أدوية' },
  { id: 's2', name: 'فايزر المغرب', nameEn: 'Pfizer Maroc', contact: 'نادية العمراني', phone: '+212 522 333 444', email: 'info@pfizer.ma', address: 'الدار البيضاء', rating: 4.9, totalOrders: 89, category: 'أدوية' },
  { id: 's3', name: 'نستله المغرب', nameEn: 'Nestle Maroc', contact: 'محمد الفاسي', phone: '+212 522 555 666', email: 'nestle@nestle.ma', address: 'الرباط', rating: 4.7, totalOrders: 45, category: 'تغذية' },
  { id: 's4', name: 'باير المغرب', nameEn: 'Bayer Maroc', contact: 'فاطمة الزرهوني', phone: '+212 522 777 888', email: 'bayer@bayer.ma', address: 'الدار البيضاء', rating: 4.6, totalOrders: 67, category: 'أدوية' },
  { id: 's5', name: 'GSK المغرب', nameEn: 'GSK Maroc', contact: 'يوسف بناني', phone: '+212 522 999 000', email: 'gsk@gsk.ma', address: 'الدار البيضاء', rating: 4.5, totalOrders: 92, category: 'أدوية' },
]

export const prescriptions = [
  {
    id: 'pr1',
    number: 'RX-2026-001',
    patientId: 'c1',
    patientName: 'أحمد بن محمد',
    doctorName: 'د. محمد العلمي',
    diagnosis: 'التهاب الحلق',
    date: '2026-06-20',
    status: 'dispensed',
    medications: [
      { productId: 'p4', name: 'أموكسيسيلين 500mg', dosage: 'كبسولة كل 8 ساعات', duration: '7 أيام' },
      { productId: 'p13', name: 'بنادول كولد + فلو', dosage: 'قرص كل 6 ساعات', duration: '5 أيام' }
    ],
    notes: 'التزم بالجرعة المحددة'
  },
  {
    id: 'pr2',
    number: 'RX-2026-002',
    patientId: 'c4',
    patientName: 'سارة بنعمر',
    doctorName: 'د. فاطمة بنعلي',
    diagnosis: 'ارتفاع ضغط الدم',
    date: '2026-06-19',
    status: 'dispensed',
    medications: [
      { productId: 'p9', name: 'لوزارتان 50mg', dosage: 'قرص يومياً', duration: '30 يوم' },
    ],
    notes: 'متابعة مع الطبيب بعد شهر'
  },
  {
    id: 'pr3',
    number: 'RX-2026-003',
    patientId: 'c2',
    patientName: 'خديجة العلوي',
    doctorName: 'د. علي بنحدو',
    diagnosis: 'التهاب جلدي',
    date: '2026-06-21',
    status: 'pending',
    medications: [
      { productId: 'p16', name: 'فيوسيدين كريم', dosage: 'دهن 3 مرات يومياً', duration: '10 أيام' }
    ],
    notes: 'تجنب التعرض للشمس'
  },
  {
    id: 'pr4',
    number: 'RX-2026-004',
    patientId: 'c6',
    patientName: 'مريم الحسني',
    doctorName: 'د. حسن المرابط',
    diagnosis: 'سكري النوع 2',
    date: '2026-06-18',
    status: 'dispensed',
    medications: [
      { productId: 'p7', name: 'ميتفورمين 850mg', dosage: 'قرص مع الوجبات', duration: '90 يوم' }
    ],
    notes: 'فحص السكر بانتظام'
  },
  {
    id: 'pr5',
    number: 'RX-2026-005',
    patientId: 'c3',
    patientName: 'يوسف التازي',
    doctorName: 'د. رشيد الإدريسي',
    diagnosis: 'التهاب الجيوب الأنفية',
    date: '2026-06-21',
    status: 'pending',
    medications: [
      { productId: 'p5', name: 'أزيثروميسين 500mg', dosage: 'قرص يومياً', duration: '3 أيام' }
    ],
    notes: ''
  },
]

// Generate sales history
const generateSales = () => {
  // بناء المبيعات التجريبية من الأدوية الرسمية (نفس قاعدة المنصة) — يضمن:
  //  1) أسماء أدوية مترجمة بالثلاث لغات في كل الرسوم والجداول والتصدير
  //  2) ارتباط المنتجات بالتكلفة الفعلية فيتسم تقرير الأرباح دقيقاً
  const officialDrugs = moroccanDrugs.filter(d => d.price > 0).slice(0, 120)
  const sales = []
  const today = new Date()
  const paymentMethods = ['cash', 'card', 'transfer', 'insurance']

  for (let i = 0; i < 30; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const itemsCount = Math.floor(Math.random() * 4) + 1
    const items = []

    for (let j = 0; j < itemsCount; j++) {
      const product = officialDrugs[Math.floor(Math.random() * officialDrugs.length)]
      const qty = Math.floor(Math.random() * 3) + 1
      items.push({
        productId: product.id,
        name: product.nameAr || product.name,
        nameAr: product.nameAr || product.name,
        nameEn: product.nameEn || product.name, // لعرض الاسم حسب لغة الواجهة في التقارير والرسوم
        nameFr: product.nameFr || product.nameEn || product.name,
        price: product.price,
        quantity: qty,
        total: Number((product.price * qty).toFixed(2))
      })
    }

    const subtotal = Number(items.reduce((sum, item) => sum + item.total, 0).toFixed(2))
    const customer = customers[Math.floor(Math.random() * customers.length)]

    sales.push({
      id: `sale-${i + 1}`,
      number: `INV-2026-${String(i + 1).padStart(4, '0')}`,
      date: date.toISOString().split('T')[0],
      time: `${10 + Math.floor(Math.random() * 10)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
      customer: customer,
      items: items,
      subtotal: subtotal,
      tax: Number((subtotal * 0.05).toFixed(2)),
      discount: i % 5 === 0 ? Number((subtotal * 0.1).toFixed(2)) : 0,
      total: Number((subtotal + subtotal * 0.05 - (i % 5 === 0 ? subtotal * 0.1 : 0)).toFixed(2)),
      paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      cashier: ['يوسف بن علي', 'فاطمة الزهراء', 'محمد الإدريسي'][Math.floor(Math.random() * 3)]
    })
  }

  return sales
}

export const sales = generateSales()

// Monthly sales trend data
export const monthlyTrend = [
  { month: 'يناير', sales: 45200, orders: 320 },
  { month: 'فبراير', sales: 52100, orders: 365 },
  { month: 'مارس', sales: 48800, orders: 340 },
  { month: 'أبريل', sales: 56700, orders: 398 },
  { month: 'ماي', sales: 61400, orders: 425 },
  { month: 'يونيو', sales: 67300, orders: 467 },
]

export const weeklyTrend = [
  { day: 'الإثنين', sales: 8500 },
  { day: 'الثلاثاء', sales: 9200 },
  { day: 'الأربعاء', sales: 7800 },
  { day: 'الخميس', sales: 10100 },
  { day: 'الجمعة', sales: 11500 },
  { day: 'السبت', sales: 12300 },
  { day: 'الأحد', sales: 9800 },
]
