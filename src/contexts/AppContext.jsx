import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { translations, pickName as pickNameI18n, pickAddress as pickAddressI18n } from '../i18n/translations'
import { pharmacies as defaultPharmacies, users as defaultUsers, customers, suppliers, prescriptions, sales } from '../data/mockData'
import { moroccanDrugs } from '../data/moroccanDrugs'
import { categories as moroccanCategories } from '../data/categories'
import { roleHasPermission, ROLE_INFO } from '../config/permissions'
import { api } from '../lib/api'
import { directLink } from '../lib/directLink'

// Load top drugs by default, full database on demand
const TOP_DRUGS_COUNT = 200

const AppContext = createContext()

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}

export const AppProvider = ({ children }) => {
  // Load state from localStorage or use defaults
  const loadState = (key, defaultValue) => {
    try {
      const stored = localStorage.getItem(`pharmacare_${key}`)
      return stored ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  }

  const [language, setLanguage] = useState(() => loadState('language', 'ar'))
  const [theme, setTheme] = useState(() => loadState('theme', 'light'))
  const [currentUser, setCurrentUser] = useState(() => loadState('user', null))
  const [currentPharmacy, setCurrentPharmacy] = useState(() => loadState('pharmacy', null))
  // الصيدلية النشطة (للسوبر أدمين: يمكنه التنقل بين الصيدليات أو رؤية الكل)
  const [activePharmacyId, setActivePharmacyId] = useState(() => loadState('activePharmacyId', null))
  // Default to the official Moroccan drug list (curated top 200 for performance)
  const defaultProducts = useMemo(() => {
    return moroccanDrugs.filter(d => d.price > 0).slice(0, TOP_DRUGS_COUNT)
  }, [])
  const [productsData, setProductsData] = useState(() => loadState('products', defaultProducts))
  const [customersData, setCustomersData] = useState(() => loadState('customers', customers))
  const [suppliersData, setSuppliersData] = useState(() => loadState('suppliers', suppliers))
  const [prescriptionsData, setPrescriptionsData] = useState(() => loadState('prescriptions', prescriptions))
  const [salesData, setSalesData] = useState(() => loadState('sales', sales))
  const [notifications, setNotifications] = useState([])
  // المستخدمون (قابلون للإدارة من طرف السوبر أدمين والأدمن)
  const [usersData, setUsersData] = useState(() => loadState('usersData', defaultUsers))
  const [pharmaciesData, setPharmaciesData] = useState(() => loadState('pharmaciesData', defaultPharmacies))
  // سجل التدقيق ( Audit Log )
  const [auditLog, setAuditLog] = useState(() => loadState('auditLog', []))
  // حالة مزامنة الخادم المحلي (SQLite عبر النفق)
  const [serverStatus, setServerStatus] = useState(() => loadState('serverStatus', { online: false, url: '', lastSync: null }))

  // ===== الزبون (واجهة الشراء) =====
  // حسابات الزبناء المشتركين: الاسم الكامل + الهاتف + صورة وثيقة الهوية — محفوظة محلياً فقط
  const [customerAccounts, setCustomerAccounts] = useState(() => loadState('customerAccounts', []))
  // الزبون الحالي للجلسة (عابر أو مشترك)
  const [currentCustomer, setCurrentCustomer] = useState(() => loadState('currentCustomer', null))
  // الطلبات المباشرة من الزبناء (تصل مباشرة عبر الاتصال الفوري، وتُحفظ محلياً لدى الصيدلية — ليست في خادم المنصة)
  const [ordersData, setOrdersData] = useState(() => loadState('orders', []))

  // Persist state
  useEffect(() => { localStorage.setItem('pharmacare_language', JSON.stringify(language)) }, [language])
  useEffect(() => { localStorage.setItem('pharmacare_theme', JSON.stringify(theme)) }, [theme])
  useEffect(() => { localStorage.setItem('pharmacare_user', JSON.stringify(currentUser)) }, [currentUser])
  useEffect(() => { localStorage.setItem('pharmacare_pharmacy', JSON.stringify(currentPharmacy)) }, [currentPharmacy])
  useEffect(() => { localStorage.setItem('pharmacare_activePharmacyId', JSON.stringify(activePharmacyId)) }, [activePharmacyId])
  useEffect(() => { localStorage.setItem('pharmacare_products', JSON.stringify(productsData)) }, [productsData])
  useEffect(() => { localStorage.setItem('pharmacare_customers', JSON.stringify(customersData)) }, [customersData])
  useEffect(() => { localStorage.setItem('pharmacare_suppliers', JSON.stringify(suppliersData)) }, [suppliersData])
  useEffect(() => { localStorage.setItem('pharmacare_prescriptions', JSON.stringify(prescriptionsData)) }, [prescriptionsData])
  useEffect(() => { localStorage.setItem('pharmacare_sales', JSON.stringify(salesData)) }, [salesData])
  useEffect(() => { localStorage.setItem('pharmacare_usersData', JSON.stringify(usersData)) }, [usersData])
  useEffect(() => { localStorage.setItem('pharmacare_pharmaciesData', JSON.stringify(pharmaciesData)) }, [pharmaciesData])
  useEffect(() => { localStorage.setItem('pharmacare_auditLog', JSON.stringify(auditLog.slice(0, 500))) }, [auditLog])
  useEffect(() => { localStorage.setItem('pharmacare_serverStatus', JSON.stringify(serverStatus)) }, [serverStatus])
  useEffect(() => { localStorage.setItem('pharmacare_customerAccounts', JSON.stringify(customerAccounts)) }, [customerAccounts])
  useEffect(() => { localStorage.setItem('pharmacare_currentCustomer', JSON.stringify(currentCustomer)) }, [currentCustomer])
  useEffect(() => { localStorage.setItem('pharmacare_orders', JSON.stringify(ordersData.slice(0, 200))) }, [ordersData])

  // Update HTML attributes when language changes (العربية RTL فقط؛ الفرنسية والإنجليزية LTR)
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
  }, [language])

  // فحص الخادم المحلي عند الإقلاع
  useEffect(() => {
    api.checkHealth().then((online) => {
      setServerStatus((s) => ({ ...s, online }))
    }).catch(() => {})
  }, [])

  // تحديث الطلبات فورياً عند تعديلها من نافذة أخرى (اتصال مباشر زبون ↔ صيدلية)
  // الطلبات تصل مباشرة إلى بيئة الصيدلية ولا تمر عبر خادم المنصة
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'pharmacare_orders' && e.newValue) {
        try {
          const fresh = JSON.parse(e.newValue)
          setOrdersData((prev) => (JSON.stringify(prev) !== JSON.stringify(fresh) ? fresh : prev))
        } catch { /* تجاهل */ }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // الترجمة مع سلسلة احتياطية (اللغة → العربية → المفتاح)
  const t = (key) => translations[language]?.[key] || translations.ar?.[key] || key
  const isRTL = language === 'ar'
  // اختيار الاسم المنسب حسب اللغة (عربي/فرنسي/إنجليزي)
  const pickName = (item) => pickNameI18n(item, language)
  const pickAddress = (item) => pickAddressI18n(item, language)

  // ===== نظام الصلاحيات =====
  const hasPermission = (permission) => roleHasPermission(currentUser?.role, permission)
  const isSuperAdmin = currentUser?.role === 'super_admin'
  const roleInfo = currentUser ? ROLE_INFO[currentUser.role] : null

  // تسجيل حدث في سجل التدقيق
  const logAudit = (action, details = {}) => {
    if (!currentUser) return
    const entry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      details,
      pharmacyId: activePharmacyId || currentPharmacy?.id || null,
    }
    setAuditLog((prev) => [entry, ...prev].slice(0, 500))
  }

  // ===== المصادقة =====
  const login = (user, pharmacy) => {
    setCurrentUser(user)
    // السوبر أدمين: يرى كل الصيدليات افتراضياً (pharmacy = null يعني الكل)
    if (user.role === 'super_admin') {
      setCurrentPharmacy(pharmacy || null)
      setActivePharmacyId('all')
    } else {
      setCurrentPharmacy(pharmacy || pharmaciesData.find(p => p.id === user.pharmacyId) || null)
      setActivePharmacyId(pharmacy?.id || user.pharmacyId)
    }
    const entry = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'login',
      details: { username: user.username },
      pharmacyId: user.role === 'super_admin' ? 'all' : (pharmacy?.id || user.pharmacyId),
    }
    setAuditLog((prev) => [entry, ...prev].slice(0, 500))
  }

  const logout = () => {
    if (currentUser) {
      logAudit('logout')
    }
    setCurrentUser(null)
    setCurrentPharmacy(null)
    setActivePharmacyId(null)
  }

  // تبديل الصيدلية النشطة (سوبر أدمين فقط)
  const switchPharmacy = (pharmacyId) => {
    if (!isSuperAdmin) return
    setActivePharmacyId(pharmacyId)
    if (pharmacyId === 'all') {
      setCurrentPharmacy(null)
    } else {
      setCurrentPharmacy(pharmaciesData.find(p => p.id === pharmacyId) || null)
    }
    logAudit('switch_pharmacy', { to: pharmacyId })
  }

  // ===== إدارة المستخدمين (سوبر أدمين: الكل / أدمن: صيدليته) =====
  const addUser = (user) => {
    if (!hasPermission('users.manage')) return null
    const newUser = {
      ...user,
      id: `u${Date.now()}`,
      active: user.active !== false,
    }
    setUsersData((prev) => [newUser, ...prev])
    logAudit('user_add', { username: newUser.username, role: newUser.role, pharmacyId: newUser.pharmacyId })
    return newUser
  }

  const updateUser = (id, updates) => {
    if (!hasPermission('users.manage')) return
    setUsersData((prev) => prev.map(u => u.id === id ? { ...u, ...updates } : u))
    logAudit('user_update', { userId: id, updates: Object.keys(updates) })
  }

  const deleteUser = (id) => {
    if (!hasPermission('users.manage')) return
    const target = usersData.find(u => u.id === id)
    // لا يمكن حذف السوبر أدمين أو الحساب الذاتي
    if (!target || target.role === 'super_admin' || id === currentUser?.id) return
    // الأدمن لا يمكنه حذف أدمن آخر أو محاسب؟ الأدمن يدير صيدليته فقط
    if (currentUser?.role === 'admin' && target.pharmacyId !== currentUser.pharmacyId) return
    setUsersData((prev) => prev.filter(u => u.id !== id))
    logAudit('user_delete', { username: target.username, role: target.role })
  }

  // المستخدمون الظاهرون حسب الدور
  const visibleUsers = useMemo(() => {
    if (!currentUser) return []
    if (isSuperAdmin) return usersData
    if (currentUser.role === 'admin') return usersData.filter(u => u.pharmacyId === currentUser.pharmacyId)
    return []
  }, [usersData, currentUser, isSuperAdmin])

  // ===== إدارة الصيدليات (سوبر أدمين) =====
  const addPharmacy = (pharmacy) => {
    if (!hasPermission('pharmacies.manage')) return null
    const newPharmacy = { ...pharmacy, id: `ph${Date.now()}` }
    setPharmaciesData((prev) => [...prev, newPharmacy])
    logAudit('pharmacy_add', { name: newPharmacy.name })
    return newPharmacy
  }

  const updatePharmacy = (id, updates) => {
    if (!hasPermission('pharmacies.manage')) return
    setPharmaciesData((prev) => prev.map(p => p.id === id ? { ...p, ...updates } : p))
    logAudit('pharmacy_update', { pharmacyId: id })
  }

  // CRUD operations for products
  const addProduct = (product) => {
    const newProduct = { ...product, id: `p${Date.now()}` }
    setProductsData([newProduct, ...productsData])
    logAudit('product_add', { name: newProduct.name, price: newProduct.price })
    return newProduct
  }

  const updateProduct = (id, updates) => {
    setProductsData(productsData.map(p => p.id === id ? { ...p, ...updates } : p))
    logAudit('product_update', { productId: id, fields: Object.keys(updates) })
  }

  const deleteProduct = (id) => {
    const target = productsData.find(p => p.id === id)
    setProductsData(productsData.filter(p => p.id !== id))
    logAudit('product_delete', { name: target?.name })
  }

  // CRUD operations for customers
  const addCustomer = (customer) => {
    const newCustomer = { ...customer, id: `c${Date.now()}` }
    setCustomersData([newCustomer, ...customersData])
    logAudit('customer_add', { name: newCustomer.name })
    return newCustomer
  }

  const updateCustomer = (id, updates) => {
    setCustomersData(customersData.map(c => c.id === id ? { ...c, ...updates } : c))
    logAudit('customer_update', { customerId: id })
  }

  const deleteCustomer = (id) => {
    setCustomersData(customersData.filter(c => c.id !== id))
    logAudit('customer_delete', { customerId: id })
  }

  // CRUD operations for suppliers
  const addSupplier = (supplier) => {
    const newSupplier = { ...supplier, id: `s${Date.now()}` }
    setSuppliersData([newSupplier, ...suppliersData])
    logAudit('supplier_add', { name: newSupplier.name })
    return newSupplier
  }

  const updateSupplier = (id, updates) => {
    setSuppliersData(suppliersData.map(s => s.id === id ? { ...s, ...updates } : s))
    logAudit('supplier_update', { supplierId: id })
  }

  const deleteSupplier = (id) => {
    setSuppliersData(suppliersData.filter(s => s.id !== id))
    logAudit('supplier_delete', { supplierId: id })
  }

  // CRUD operations for prescriptions
  const addPrescription = (prescription) => {
    const newPrescription = { ...prescription, id: `pr${Date.now()}` }
    setPrescriptionsData([newPrescription, ...prescriptionsData])
    logAudit('prescription_add', { customer: prescription.customerName })
    return newPrescription
  }

  const updatePrescription = (id, updates) => {
    setPrescriptionsData(prescriptionsData.map(p => p.id === id ? { ...p, ...updates } : p))
    logAudit('prescription_update', { prescriptionId: id })
  }

  // Add new sale
  const addSale = (sale) => {
    // Update stock
    sale.items.forEach(item => {
      const product = productsData.find(p => p.id === item.productId)
      if (product) {
        updateProduct(product.id, { stock: product.stock - item.quantity })
      }
    })
    const newSale = { ...sale, id: `sale-${Date.now()}` }
    setSalesData([newSale, ...salesData])
    logAudit('sale_new', { total: sale.total, items: sale.items.length })
    return newSale
  }

  // Load more drugs from the full Moroccan database
  const loadMoreProducts = (count = 100) => {
    const currentIds = new Set(productsData.map(p => p.code))
    const moreDrugs = moroccanDrugs
      .filter(d => d.price > 0 && !currentIds.has(d.code))
      .slice(0, count)
    setProductsData([...productsData, ...moreDrugs])
  }

  // Search across ALL Moroccan drugs (not just loaded ones)
  const searchAllDrugs = (query) => {
    if (!query) return []
    const q = query.toLowerCase()
    return moroccanDrugs.filter(d =>
      (d.name && d.name.toLowerCase().includes(q)) ||
      (d.nameEn && d.nameEn.toLowerCase().includes(q)) ||
      (d.nameFr && d.nameFr.toLowerCase().includes(q)) ||
      (d.dci && d.dci.toLowerCase().includes(q)) ||
      (d.barcode && d.barcode.includes(q))
    ).slice(0, 50)
  }

  // =====================================================================
  // ===== حسابات الزبناء المشتركين (واجهة الشراء) =====
  // التسجيل: الاسم الكامل + رقم الهاتف + صورة واضحة لوثيقة الهوية
  // (البطاقة الوطنية أو جواز السفر أو رخصة السياقة) — محفوظة محلياً
  // =====================================================================
  const registerCustomer = ({ fullName, phone, idPhoto, address }) => {
    const exists = customerAccounts.some(c => c.phone === phone)
    if (exists) return { ok: false, error: 'phoneTaken' }
    const account = {
      id: `cust-${Date.now()}`,
      fullName,
      phone,
      idPhoto: idPhoto || null, // صورة وثيقة الهوية (base64 مضغوط)
      address: address || '',
      memberSince: new Date().toISOString(),
    }
    setCustomerAccounts((prev) => [...prev, account])
    setCurrentCustomer({ ...account, type: 'member' })
    return { ok: true, account }
  }

  const loginCustomerAccount = (fullName, phone) => {
    const account = customerAccounts.find(
      c => c.phone === phone && c.fullName.trim() === (fullName || '').trim()
    )
    if (!account) return { ok: false, error: 'invalidCustomerLogin' }
    setCurrentCustomer({ ...account, type: 'member' })
    return { ok: true, account }
  }

  // زبون عابر: اسم + هاتف فقط، بدون حساب
  const continueAsGuest = (fullName, phone) => {
    const guest = { id: `guest-${Date.now()}`, fullName, phone, type: 'guest' }
    setCurrentCustomer(guest)
    return { ok: true }
  }

  const logoutCustomer = () => setCurrentCustomer(null)

  // =====================================================================
  // ===== الطلبات المباشرة (زبون ← صيدلية) =====
  // الطلب يُبث مباشرة عبر قناة الاتصال (directLink) إلى نوافذ الموظفين،
  // ويُحفظ محلياً في بيئة الصيدلية فقط (localStorage) — لا يُرسل إطلاقاً
  // إلى خادم المنصة. الدردشة تبقى في الذاكرة المؤقتة وتُستهلك فورياً.
  // =====================================================================
  const addOrder = (order) => {
    const newOrder = {
      ...order,
      id: `ord-${Date.now()}`,
      number: `CMD-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
      createdAt: new Date().toISOString(),
      status: 'pending',
      // توجيه ذكي: طلبات الوصفات → الصيدلاني، والباقي → الكاشير (حسب المتوفر)
      preferredRole: order.needsPrescription ? 'pharmacist' : 'cashier',
      assignedTo: null,
    }
    setOrdersData((prev) => [newOrder, ...prev].slice(0, 200))
    // بث فوري إلى الموظفين المتصلين (اتصال مباشر — يُستهلك مباشرة)
    directLink.announceOrder(newOrder)
    return newOrder
  }

  const updateOrder = (id, updates, broadcast = true) => {
    const target = ordersData.find(o => o.id === id)
    if (!target) return null
    // نحسب الطلب المحدّث فورياً (لا نعتمد على محدّث الحالة غير المتزامن)
    const updated = { ...target, ...updates }
    setOrdersData(prev => prev.map(o => (o.id === id ? { ...o, ...updates } : o)))
    if (broadcast) {
      directLink.announceOrderUpdate(id, updates.status || updated.status, { order: updated })
    }
    return updated
  }

  const cancelOrder = (id, byCustomer = false) => {
    const order = ordersData.find(o => o.id === id)
    if (!order || (order.status !== 'pending' && !byCustomer)) return false
    updateOrder(id, { status: 'cancelled', cancelledAt: new Date().toISOString(), cancelledBy: byCustomer ? 'customer' : 'staff' })
    return true
  }

  // الطلبات حسب الصيدلية النشطة (للموظفين)
  const visibleOrders = useMemo(() => {
    if (!currentUser) return []
    if (isSuperAdmin) return ordersData
    return ordersData.filter(o => o.pharmacyId === currentUser.pharmacyId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordersData, currentUser, isSuperAdmin])

  // ===== المزامنة مع الخادم المحلي (SQLite) =====
  // ملاحظة امتثال: الطلبات والدردشات مستثناة عمداً من المزامنة لأنها
  // تُستهلك مباشرة عبر الاتصال الفوري ولا تُسجَّل في خادم المنصة.
  const syncToServer = async () => {
    const payload = {
      products: productsData, customers: customersData, suppliers: suppliersData,
      prescriptions: prescriptionsData, sales: salesData, users: usersData,
      pharmacies: pharmaciesData, auditLog: auditLog.slice(0, 100),
    }
    const ok = await api.sync(payload)
    if (ok) {
      setServerStatus((s) => ({ ...s, online: true, lastSync: new Date().toISOString() }))
      logAudit('server_sync', {})
    }
    return ok
  }

  const value = {
    // State
    language, setLanguage,
    theme, setTheme,
    currentUser, currentPharmacy,
    activePharmacyId, switchPharmacy,
    productsData, customersData, suppliersData, prescriptionsData, salesData,
    notifications,
    isRTL,
    // Helpers
    t, pickName, pickAddress,
    // Auth & RBAC
    login, logout,
    hasPermission, isSuperAdmin, roleInfo,
    usersData, visibleUsers, addUser, updateUser, deleteUser,
    pharmaciesData, addPharmacy, updatePharmacy,
    // أسماء متوافقة قديمة (تستعملها صفحة الدخول)
    users: usersData,
    pharmacies: pharmaciesData,
    auditLog, logAudit,
    // Server sync
    serverStatus, syncToServer,
    categories: moroccanCategories,
    fullDrugDatabase: moroccanDrugs,
    // CRUD
    addProduct, updateProduct, deleteProduct,
    loadMoreProducts,
    searchAllDrugs,
    addCustomer, updateCustomer, deleteCustomer,
    addSupplier, updateSupplier, deleteSupplier,
    addPrescription, updatePrescription,
    addSale,
    // الزبون (واجهة الشراء)
    customerAccounts, registerCustomer, loginCustomerAccount, continueAsGuest, logoutCustomer,
    currentCustomer, setCurrentCustomer,
    // الطلبات المباشرة
    ordersData, addOrder, updateOrder, cancelOrder, visibleOrders,
    // Notifications
    addNotification: (notification) => {
      const newNotif = { ...notification, id: Date.now(), time: new Date() }
      setNotifications([newNotif, ...notifications].slice(0, 20))
    },
    dismissNotification: (id) => {
      setNotifications(notifications.filter(n => n.id !== id))
    }
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
