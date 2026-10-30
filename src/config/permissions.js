// نظام الصلاحيات RBAC - منصة Pharmacy Management Platform PHMP
// الأدوار: سوبر أدمين (مالك المنصة) > أدمن > محاسب > صيدلاني > كاشير

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  ACCOUNTANT: 'accountant',
  PHARMACIST: 'pharmacist',
  CASHIER: 'cashier',
}

// ترتيب هرمي للأدوار (لأغراض العرض والمقارنة)
export const ROLE_LEVELS = {
  super_admin: 100,
  admin: 80,
  accountant: 60,
  pharmacist: 40,
  cashier: 20,
}

// بيانات العرض لكل دور
export const ROLE_INFO = {
  super_admin: {
    ar: 'مالك المنصة', en: 'Platform Owner', fr: 'Propriétaire',
    shortAr: 'مالك المنصة', shortEn: 'Owner', shortFr: 'Propriétaire',
    color: 'violet', badge: '👑', level: 100,
  },
  admin: {
    ar: 'مدير الصيدلية', en: 'Pharmacy Manager', fr: 'Directeur de pharmacie',
    shortAr: 'مدير', shortEn: 'Admin', shortFr: 'Directeur',
    color: 'blue', badge: '🛡️', level: 80,
  },
  accountant: {
    ar: 'محاسب', en: 'Accountant', fr: 'Comptable',
    shortAr: 'محاسب', shortEn: 'Accountant', shortFr: 'Comptable',
    color: 'amber', badge: '📊', level: 60,
  },
  pharmacist: {
    ar: 'صيدلاني', en: 'Pharmacist', fr: 'Pharmacien',
    shortAr: 'صيدلاني', shortEn: 'Pharmacist', shortFr: 'Pharmacien',
    color: 'emerald', badge: '⚕️', level: 40,
  },
  cashier: {
    ar: 'كاشير', en: 'Cashier', fr: 'Caissier',
    shortAr: 'كاشير', shortEn: 'Cashier', shortFr: 'Caissier',
    color: 'gray', badge: '🧾', level: 20,
  },
}

// مصفوفة الصلاحيات: كل صلاحية = قائمة الأدوار المسموح لها
export const PERMISSIONS = {
  // إدارة المنصة (سوبر أدمين فقط)
  'platform.manage': [ROLES.SUPER_ADMIN],
  'audit.view': [ROLES.SUPER_ADMIN],
  'users.manage_all': [ROLES.SUPER_ADMIN],
  'pharmacies.manage': [ROLES.SUPER_ADMIN],
  'pharmacy.switch': [ROLES.SUPER_ADMIN],

  // لوحة التحكم
  'dashboard.view': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.PHARMACIST, ROLES.CASHIER],

  // نقطة البيع
  'pos.use': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PHARMACIST, ROLES.CASHIER],

  // الطلبات المباشرة من الزبناء (واجهة الشراء)
  'orders.view': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PHARMACIST, ROLES.CASHIER],
  'orders.manage': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PHARMACIST, ROLES.CASHIER],

  // المخزون
  'inventory.view': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.PHARMACIST],
  'inventory.manage': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PHARMACIST],

  // الوصفات الطبية
  'prescriptions.view': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.PHARMACIST],
  'prescriptions.manage': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PHARMACIST],

  // الزبائن
  'customers.view': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.PHARMACIST, ROLES.CASHIER],
  'customers.manage': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PHARMACIST, ROLES.CASHIER],

  // الموردون
  'suppliers.view': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT],
  'suppliers.manage': [ROLES.SUPER_ADMIN, ROLES.ADMIN],

  // المشتريات
  'purchases.view': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT],
  'purchases.manage': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT],

  // التقارير
  'reports.view': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.PHARMACIST],
  'reports.financial': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT],

  // الإعدادات
  'settings.view': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'settings.manage': [ROLES.SUPER_ADMIN, ROLES.ADMIN],

  // إدارة المستخدمين (ضمن الصيدلية)
  'users.view': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'users.manage': [ROLES.SUPER_ADMIN, ROLES.ADMIN],

  // النسخ الاحتياطي
  'backup.manage': [ROLES.SUPER_ADMIN, ROLES.ADMIN],

  // المراجع القانونية (الجميع - التزام مهني)
  'legal.view': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.PHARMACIST, ROLES.CASHIER],
}

// التحقق من صلاحية دور معين
export const roleHasPermission = (role, permission) => {
  if (!role) return false
  const allowed = PERMISSIONS[permission]
  if (!allowed) return false
  return allowed.includes(role)
}

// قائمة الصلاحيات المتاحة لدور معين
export const getRolePermissions = (role) =>
  Object.keys(PERMISSIONS).filter((p) => roleHasPermission(role, p))

// عناصر القائمة الجانبية مع صلاحياتها
export const MENU_PERMISSIONS = {
  '/platform': 'platform.manage',
  '/dashboard': 'dashboard.view',
  '/pos': 'pos.use',
  '/orders': 'orders.view',
  '/inventory': 'inventory.view',
  '/prescriptions': 'prescriptions.view',
  '/customers': 'customers.view',
  '/suppliers': 'suppliers.view',
  '/purchases': 'purchases.view',
  '/reports': 'reports.view',
  '/legal': 'legal.view',
  '/settings': 'settings.view',
}
