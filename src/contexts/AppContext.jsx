import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { translations, pickName as pickNameI18n, pickAddress as pickAddressI18n } from '../i18n/translations'
import { pharmacies as defaultPharmacies, users as defaultUsers, customers, suppliers, prescriptions, sales } from '../data/mockData'
import { moroccanDrugs } from '../data/moroccanDrugs'
import { categories as moroccanCategories } from '../data/categories'
import { roleHasPermission, ROLE_INFO } from '../config/permissions'
import { api, getAuthToken } from '../lib/api'
import { realtime } from '../lib/realtime'
import sounds from '../lib/sounds'

// Load top drugs by default, full database on demand
const TOP_DRUGS_COUNT = 200

const AppContext = createContext()

// =====================================================================
// دمج قوائم الطلبات (محلي + خادم): الأحدث updatedAt يفوز، والمحلي فقط يبقى،
// والطلبات الدنيا (تتبع الزبون) لا تمسح البنود الكاملة المحلية.
// =====================================================================
const mergeOrders = (local, incoming) => {
  const byId = new Map()
  const push = (o) => {
    if (!o || !o.id) return
    const cur = byId.get(o.id)
    if (!cur) {
      byId.set(o.id, {
        ...o,
        items: Array.isArray(o.items) ? o.items : [],
        customer: o.customer && typeof o.customer === 'object' ? o.customer : { name: '', phone: '' },
      })
      return
    }
    const aT = Date.parse(cur.updatedAt || cur.createdAt || 0) || 0
    const bT = Date.parse(o.updatedAt || o.createdAt || 0) || 0
    if (bT >= aT) {
      byId.set(o.id, {
        ...cur, ...o,
        items: Array.isArray(o.items) && o.items.length ? o.items : cur.items,
        customer: o.customer && typeof o.customer === 'object' ? o.customer : cur.customer,
      })
    }
  }
  ;(Array.isArray(local) ? local : []).forEach(push)
  ;(Array.isArray(incoming) ? incoming : []).forEach(push)
  return [...byId.values()]
    .sort((x, y) => (Date.parse(y.createdAt || 0) || 0) - (Date.parse(x.createdAt || 0) || 0))
    .slice(0, 200)
}

// =====================================================================
// ترحيل البيانات المحلية القديمة (إصلاح جذري لخلل اللغة المختلطة في التقارير):
// مبيعات العرض القديمة (v≤1.6) كانت تحفظ اسماً عربياً واحداً ومعرفات منتجات
// وهمية (p1..p20) لم تعد موجودة في قاعدة الأدوية الرسمية — فظهرت أسماء
// عربية داخل تقارير/مخططات FR وEN رغم إصلاح v1.7 للبيانات الجديدة فقط.
// الحل الجذري: ترحيل مرة واحدة عند الإقلاع —
//  1) إن كانت قائمة المنتجات المحفوظة هي مجموعة العرض القديمة حصراً
//     (p1..p20 بلا أي منتج حقيقي) تُستبدل بالأدوية الرسمية.
//  2) كل بند عرضي في المبيعات غير مرتبط بمنتج قائم يُعاد ربطه بدواء
//     رسمي (بترتيب حتمي ثابت) مع كل مرادفات الاسم بالثلاث لغات، وتُعاد
//     حساب المجاميع. المبيعات الحقيقية (sale-<timestamp>) لا تُمس أبداً.
// =====================================================================
const DATA_VERSION = '1.8.0'

const migrateStoredData = (storedProducts, storedSales, fallbackProducts, officialDrugs) => {
  let products = storedProducts
  let sales = storedSales
  let changed = false

  // (1) قائمة منتجات تجريبية خالصة (p1..p20) ← الأدوية الرسمية
  if (Array.isArray(products) && products.length > 0 &&
      products.every(p => /^p\d+$/.test(String(p?.id || ''))) && products.length <= 30) {
    products = fallbackProducts
    changed = true
  }

  // (2) إعادة ربط بنود العرض القديمة بأدوية رسمية
  const productIds = new Set((products || []).map(p => p.id))
  const pool = (officialDrugs || []).filter(d => d.price > 0)
  if (Array.isArray(sales) && sales.length > 0 && pool.length > 0) {
    sales = sales.map((sale, si) => {
      const isLegacyMock = /^sale-\d{1,3}$/.test(String(sale?.id || ''))
      if (!isLegacyMock || !Array.isArray(sale.items)) return sale
      const needsFix = sale.items.some(it => !it.productId || !productIds.has(it.productId))
      if (!needsFix) return sale
      changed = true
      const items = sale.items.map((it, ji) => {
        if (it.productId && productIds.has(it.productId)) return it
        const p = pool[(si * 7 + ji * 13) % pool.length]
        const qty = it.quantity || 1
        return {
          ...it,
          productId: p.id,
          name: p.nameAr || p.name,
          nameAr: p.nameAr || p.name,
          nameEn: p.nameEn || p.name,
          nameFr: p.nameFr || p.nameEn || p.name,
          price: p.price,
          quantity: qty,
          total: Number((p.price * qty).toFixed(2)),
        }
      })
      const subtotal = Number(items.reduce((s, it) => s + it.total, 0).toFixed(2))
      const discount = (sale.discount || 0) > 0 ? Number((subtotal * 0.1).toFixed(2)) : 0
      const tax = Number((subtotal * 0.05).toFixed(2))
      return { ...sale, items, subtotal, tax, discount, total: Number((subtotal + tax - discount).toFixed(2)) }
    })
  }

  return changed ? { products, sales } : null
}

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
  // الوضع القاتم: يبدأ من التفضيل المحفوظ، وإلا من تفضيل نظام المستخدم
  const [theme, setTheme] = useState(() => {
    const stored = loadState('theme', null)
    if (stored === 'light' || stored === 'dark') return stored
    try {
      return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light'
    } catch { return 'light' }
  })
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')
  const [currentUser, setCurrentUser] = useState(() => loadState('user', null))
  const [currentPharmacy, setCurrentPharmacy] = useState(() => loadState('pharmacy', null))
  // الصيدلية النشطة (للسوبر أدمين: يمكنه التنقل بين الصيدليات أو رؤية الكل)
  const [activePharmacyId, setActivePharmacyId] = useState(() => loadState('activePharmacyId', null))
  // Default to the official Moroccan drug list (curated top 200 for performance)
  const defaultProducts = useMemo(() => {
    return moroccanDrugs.filter(d => d.price > 0).slice(0, TOP_DRUGS_COUNT)
  }, [])

  // ===== ترحيل البيانات القديمة مرة واحدة عند الإقلاع (إن لزم) =====
  // يُنفَّذ قبل إنشاء الحالات حتى لا يومض المحتوى القديم على الشاشة.
  const migratedRef = useMemo(() => {
    try {
      const version = loadState('dataVersion', null)
      if (version === DATA_VERSION) return null
      const storedProducts = loadState('products', null)
      const storedSales = loadState('sales', null)
      const result = migrateStoredData(storedProducts, storedSales, defaultProducts, moroccanDrugs)
      if (result) {
        if (result.products !== storedProducts) {
          localStorage.setItem('pharmacare_products', JSON.stringify(result.products))
        }
        if (result.sales !== storedSales) {
          localStorage.setItem('pharmacare_sales', JSON.stringify(result.sales))
        }
        return result
      }
      return null
    } catch {
      return null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [productsData, setProductsData] = useState(() => migratedRef?.products || loadState('products', defaultProducts))
  const [customersData, setCustomersData] = useState(() => loadState('customers', customers))
  const [suppliersData, setSuppliersData] = useState(() => loadState('suppliers', suppliers))
  const [prescriptionsData, setPrescriptionsData] = useState(() => loadState('prescriptions', prescriptions))
  const [salesData, setSalesData] = useState(() => migratedRef?.sales || loadState('sales', sales))
  // تعليم إصدار البيانات الحالي بعد الإقلاع (يمنع تكرار الترحيل)
  useEffect(() => {
    try { localStorage.setItem('pharmacare_dataVersion', JSON.stringify(DATA_VERSION)) } catch { /* تجاهل */ }
  }, [])
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

  // تطبيق الوضع القاتم على <html> + إخبار المتصفح بلوحة النظام (نماذج/تمرير) + لون شريط الهاتف
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#10b981')
  }, [theme])

  // فحص الخادم المحلي عند الإقلاع + تحديث قائمة الصيدليات من المصدر الموثوق
  // (نقطة عامة بلا جلسة): يضمن أن زبناء المتجر يطلبون من صيدليات قائمة فعلاً
  // على الخادم — وإلا فُشل حفظ الطلب لدى صيدلية حُذفت أو أُعيدت هيكلتها.
  useEffect(() => {
    let alive = true
    api.checkHealth().then(async (online) => {
      if (!alive) return
      setServerStatus((s) => ({ ...s, online }))
      if (!online) return
      try {
        const fresh = await api.fetchPharmacies()
        if (alive && Array.isArray(fresh) && fresh.length > 0) {
          setPharmaciesData((prev) => (JSON.stringify(prev) === JSON.stringify(fresh) ? prev : fresh))
        }
      } catch { /* قائمة محلية سليمة كافية مؤقتاً */ }
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  // مرجع حي لقائمة الطلبات (تستعمله مزامنة الخلفية دون إعادة تسجيل مستمرة)
  const ordersRef = useRef(ordersData)
  useEffect(() => { ordersRef.current = ordersData }, [ordersData])

  // ===== اتصال فوري تلقائي عند استعادة الجلسة (إصلاح خلل جذري v2.1.0) =====
  // كان الاتصال يُفتح عند الدخول اليدوي فقط — فأي إعادة تحميل للصفحة أو إعادة
  // فتح للتطبيق تُبقي الجلسة مستعادة لكن بلا اتصال: لا رسائل ولا مكالمات ولا
  // مزامنة طلبات. الآن يتصل تلقائياً أينما وُجد مستخدم بجلسة صالحة.
  useEffect(() => {
    if (!currentUser) return
    const token = getAuthToken()
    if (!token) return
    realtime.connect({ token, userId: currentUser.id, name: currentUser.name, role: currentUser.role })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

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

  // ===== جسر الاتصال الفوري: الطلبات الواردة من أجهزة أخرى (زبون ↔ موظفون) =====
  // الطلب يُبث من الخادم الفوري بعد حفظه (أو احتياط BroadcastChannel محلياً)؛
  // وتحديثات الحالة تصل الزبون فورياً أينما كان. مع نغمة تنبيه.
  useEffect(() => {
    const off = realtime.onMessage((msg) => {
      if (!msg) return

      // انتهاء صلاحية الجلسة (رمز JWT منتهٍ أو حساب موقوف): إنهاء أنيق بدل
      // البقاء «ظاهرياً متصلاً» بلا استجابة — مع إشعار واضح عند شاشة الدخول.
      if (msg.type === 'session_expired') {
        if (currentUser) {
          api.logout()
          realtime.disconnect()
          setCurrentUser(null)
          setCurrentPharmacy(null)
          setActivePharmacyId(null)
          try { localStorage.setItem('pharmacare_session_expired', JSON.stringify(Date.now())) } catch { /* تجاهل */ }
        }
        return
      }

      // طلب جديد/تحديث حالة (من خادم فوري أو احتياط BroadcastChannel)
      if (msg.type === 'order' && msg.order) {
        const incoming = msg.order
        if (msg.action === 'update') {
          setOrdersData((prev) => {
            const found = prev.some(o => o.id === incoming.id)
            if (!found) return mergeOrders(prev, [incoming])
            return prev.map(o => (o.id === incoming.id ? { ...o, ...incoming, items: incoming.items || o.items } : o))
          })
          // نغمة تنبيه للزبون عند تغير حالة طلبه
          if (!currentUser && currentCustomer) sounds.message()
        } else {
          // طلب جديد: تجاهل التكرار (قد يصل عبر القناتين) + تنبيه صوتي للموظفين
          setOrdersData((prev) => (prev.some(o => o.id === incoming.id) ? prev : [incoming, ...prev].slice(0, 200)))
          if (currentUser) {
            sounds.message()
            setNotifications((prev) => [{
              id: Date.now(),
              title: (language === 'ar' ? 'طلب جديد' : language === 'fr' ? 'Nouvelle commande' : 'New order'),
              message: `${incoming.number || ''} · ${(incoming.customer?.name || '').slice(0, 40)}`,
              time: new Date(),
            }, ...prev].slice(0, 20))
          }
        }
        return
      }

      // احتياط BroadcastChannel: أحداث الطلبات المحلية (نفس المتصفح)
      if (msg.type === 'order_new' && msg.order) {
        const incoming = msg.order
        setOrdersData((prev) => (prev.some(o => o.id === incoming.id) ? prev : [incoming, ...prev].slice(0, 200)))
        if (currentUser) {
          sounds.message()
          setNotifications((prev) => [{
            id: Date.now(),
            title: (language === 'ar' ? 'طلب جديد' : language === 'fr' ? 'Nouvelle commande' : 'New order'),
            message: `${incoming.number || ''} · ${(incoming.customer?.name || '').slice(0, 40)}`,
            time: new Date(),
          }, ...prev].slice(0, 20))
        }
        return
      }
      if (msg.type === 'order_update' && msg.orderId) {
        setOrdersData((prev) => prev.map(o => (o.id === msg.orderId ? { ...o, status: msg.status, ...(msg.order ? msg.order : {}) } : o)))
      }
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, currentCustomer, language])

  // مراقبة طلبات الزبون الحالية (استقبال تحديثاتها عبر الأجهزة)
  useEffect(() => {
    if (!currentCustomer) return
    const myOrderIds = ordersData
      .filter(o => o.customer?.phone === currentCustomer.phone)
      .slice(0, 50)
      .map(o => o.id)
    if (myOrderIds.length > 0) realtime.watchOrders(myOrderIds)
  }, [currentCustomer, ordersData])

  // ===== مزامنة الطلبات مع الخادم (إصلاح خلل جذري v2.1.0) =====
  // الطلب كان يُبث للمتصلين لحظياً فقط، فمن لم يكن متصلاً لا يصله أبداً ولا
  // يظهر في واجهته. الآن: تُحفظ الطلبات على خادم المالك وتُجلب عند الإقلاع
  // وعند كل عودة للاتصال — فتظهر في كل الواجهات (Pages/Vercel/أندرويد) ويمكن
  // معالجتها من أي واجهة. كما تُدفع الطلبات المحلية التي أُنشئت أثناء انقطاع
  // الخادم (زبون بلا اتصال) فور توفره.
  useEffect(() => {
    let cancelled = false

    const pushUnsynced = async (serverOrders) => {
      const phone = currentCustomer?.phone
      if (!phone) return
      const serverIds = new Set((serverOrders || []).map(o => o.id))
      const unsynced = ordersRef.current
        .filter(o => o.customer?.phone === phone && !o._synced && !serverIds.has(o.id))
        .slice(0, 10)
      for (const o of unsynced) {
        try {
          await api.createOrder(o)
          if (!cancelled) setOrdersData(prev => prev.map(x => (x.id === o.id ? { ...x, _synced: true } : x)))
        } catch { /* الخادم رفض — يُعاد عند المزامنة التالية */ }
      }
    }

    const expireSession = () => {
      api.logout()
      realtime.disconnect()
      setCurrentUser(null)
      setCurrentPharmacy(null)
      setActivePharmacyId(null)
      try { localStorage.setItem('pharmacare_session_expired', JSON.stringify(Date.now())) } catch { /* تجاهل */ }
    }

    const syncNow = async () => {
      try {
        if (currentUser) {
          const fresh = await api.fetchOrders({ limit: 200 })
          if (cancelled || !Array.isArray(fresh)) return
          setOrdersData(prev => mergeOrders(prev, fresh))
        } else if (currentCustomer?.phone) {
          const tracked = await api.trackOrders(currentCustomer.phone)
          if (cancelled || !Array.isArray(tracked)) return
          setOrdersData(prev => mergeOrders(prev, tracked))
          await pushUnsynced(tracked)
        }
      } catch (err) {
        if (err?.status === 401 && currentUser) expireSession()
        /* الخادم غير متاح — تعمل المنصة محلياً وتُزامن عند عودة الاتصال */
      }
    }

    syncNow()
    const off = realtime.onStatus((s) => { if (s === 'online') syncNow() })
    return () => { cancelled = true; off() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentCustomer?.phone])

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
    // اتصال فوري (WebSocket) للتراسل والمكالمات عبر الأجهزة — بعد الدخول برمز JWT
    try {
      realtime.connect({
        token: getAuthToken(),
        userId: user.id, name: user.name, role: user.role,
      })
    } catch { /* الاتصال الفوري اختياري — احتياط BroadcastChannel محلي */ }
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
    // مسح رمز جلسة الخادم (JWT) — لا يبقى أي أثر للجلسة
    api.logout()
    realtime.disconnect()
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
  // عند الاتصال بالخادم المحلي: كل عملية تُنفَّذ أولاً على SQLite (المصدر الموثوق)
  // ثم تُعكس محلياً. عند انقطاع الخادم تُنفَّذ محلياً فقط (وضع مستقل).
  const addUser = async (user) => {
    if (!hasPermission('users.manage')) return null
    let newUser = {
      ...user,
      id: `u${Date.now()}`,
      active: user.active !== false,
    }
    // إنشاء على الخادم عند الاتصال (الخادم يولّد المعرف ويُعيد كلمة المرور مشفرة)
    if (serverStatus.online) {
      try {
        const created = await api.createUser({
          username: user.username, password: user.password, name: user.name,
          nameEn: user.nameEn || '', role: user.role, pharmacyId: user.pharmacyId || null,
          avatar: user.avatar || '👤',
        })
        if (created?.id) newUser = { ...newUser, id: created.id, password: undefined }
      } catch (err) {
        throw err // إظهار خطأ الخادم للمستخدم (مثلاً: اسم مستعمل من قبل)
      }
    }
    const { password, ...safeUser } = newUser
    setUsersData((prev) => [safeUser, ...prev])
    logAudit('user_add', { username: safeUser.username, role: safeUser.role, pharmacyId: safeUser.pharmacyId })
    return safeUser
  }

  const updateUser = async (id, updates) => {
    if (!hasPermission('users.manage')) return
    if (serverStatus.online) {
      try {
        const payload = {}
        if (updates.name !== undefined) payload.name = updates.name
        if (updates.role !== undefined) payload.role = updates.role
        if (updates.pharmacyId !== undefined) payload.pharmacyId = updates.pharmacyId
        if (updates.active !== undefined) payload.active = updates.active
        if (updates.avatar !== undefined) payload.avatar = updates.avatar
        if (updates.password) payload.password = updates.password
        await api.updateUserRemote(id, payload)
      } catch (err) {
        throw err
      }
    }
    const { password, ...safeUpdates } = updates
    setUsersData((prev) => prev.map(u => u.id === id ? { ...u, ...safeUpdates, ...(safeUpdates.password ? {} : {}) } : u))
    logAudit('user_update', { userId: id, updates: Object.keys(updates) })
  }

  const deleteUser = async (id) => {
    if (!hasPermission('users.manage')) return
    const target = usersData.find(u => u.id === id)
    // لا يمكن حذف الحساب الذاتي — ولا آخر مالك منصة نشط
    if (!target || id === currentUser?.id) return
    const activeSuperAdmins = usersData.filter(u => u.role === 'super_admin' && u.active !== false).length
    if (target.role === 'super_admin' && !(isSuperAdmin && activeSuperAdmins > 1)) return
    // الأدمن لا يمكنه حذف أدمن آخر أو محاسب؟ الأدمن يدير صيدليته فقط
    if (currentUser?.role === 'admin' && target.pharmacyId !== currentUser.pharmacyId) return
    if (serverStatus.online) {
      try {
        await api.deleteUserRemote(id)
      } catch (err) {
        throw err
      }
    }
    setUsersData((prev) => prev.filter(u => u.id !== id))
    logAudit('user_delete', { username: target.username, role: target.role })
  }

  // ===== نقل ملكية المنصة (سوبر أدمين فقط) =====
  // يُنفَّذ على الخادم بعد تأكيد كلمة المرور، ثم تُحدَّث الحالة المحلية:
  // المستهدف يصبح مالكاً (سوبر أدمين) ويُخفَّض المالك القديم إلى الدور المختار.
  const transferOwnership = async ({ targetUserId, currentPassword, selfNewRole, selfPharmacyId }) => {
    if (!isSuperAdmin) throw new Error('هذه العملية تتطلب صلاحية مالك المنصة')
    const result = await api.transferOwnership({ targetUserId, currentPassword, selfNewRole, selfPharmacyId })
    const target = usersData.find(u => u.id === targetUserId)
    setUsersData((prev) => prev.map(u => {
      if (u.id === targetUserId) return { ...u, role: 'super_admin', pharmacyId: null }
      if (u.id === currentUser.id && selfNewRole && selfNewRole !== 'super_admin') {
        return { ...u, role: selfNewRole, pharmacyId: selfPharmacyId || null }
      }
      return u
    }))
    // إذا خُفّض المالك القديم تُحدَّث جلسته فوراً (الخادم يعيد قراءة الدور من قاعدته)
    if (result?.selfDemoted) {
      setCurrentUser((prev) => prev ? { ...prev, role: selfNewRole, pharmacyId: selfPharmacyId || null } : prev)
    }
    logAudit('platform_ownership_transfer', {
      newOwner: target?.username || targetUserId,
      previousOwnerNewRole: selfNewRole || 'super_admin',
    })
    return result
  }

  // استبدال قائمة المستخدمين المحلية بمستخدمي الخادم الحقيقيين (بعد الدخول أو التحديث)
  const importServerUsers = (serverUsers) => {
    if (!Array.isArray(serverUsers) || serverUsers.length === 0) return false
    setUsersData(serverUsers.map(u => ({ ...u, password: undefined })))
    return true
  }

  // استبدال قائمة الصيدليات المحلية بصيدليات الخادم (بعد الدخول)
  const importServerPharmacies = (serverPharmacies) => {
    if (!Array.isArray(serverPharmacies) || serverPharmacies.length === 0) return false
    setPharmaciesData(serverPharmacies)
    return true
  }

  // المستخدمون الظاهرون حسب الدور
  const visibleUsers = useMemo(() => {
    if (!currentUser) return []
    if (isSuperAdmin) return usersData
    if (currentUser.role === 'admin') return usersData.filter(u => u.pharmacyId === currentUser.pharmacyId)
    return []
  }, [usersData, currentUser, isSuperAdmin])

  // ===== إدارة الصيدليات (سوبر أدمين) =====
  const addPharmacy = async (pharmacy) => {
    if (!hasPermission('pharmacies.manage')) return null
    let newPharmacy = { ...pharmacy, id: `ph${Date.now()}` }
    if (serverStatus.online) {
      try {
        const created = await api.createPharmacy({
          name: pharmacy.name, nameEn: pharmacy.nameEn || pharmacy.name,
          address: pharmacy.address || '', phone: pharmacy.phone || '',
          email: pharmacy.email || '', license: pharmacy.license,
          logo: pharmacy.logo || '💊',
        })
        if (created?.id) newPharmacy = { ...newPharmacy, id: created.id }
      } catch (err) {
        throw err
      }
    }
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
  const registerCustomer = ({ fullName, phone, idPhoto, photo, address }) => {
    const exists = customerAccounts.some(c => c.phone === phone)
    if (exists) return { ok: false, error: 'phoneTaken' }
    const account = {
      id: `cust-${Date.now()}`,
      fullName,
      phone,
      idPhoto: idPhoto || null, // صورة وثيقة الهوية (base64 مضغوط)
      photo: photo || null,     // صورة الزبون الشخصية (base64 مضغوط)
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
  // الطلب يُحفظ فوراً على خادم المالك (SQLite) ويُبث لكل الموظفين المتصلين
  // عبر الخادم الفوري الموحد — فيظهر في الواجهات الثلاث (Pages/Vercel/أندرويد)
  // آنياً ويمكن معالجته من أي واجهة. عند غياب الخادم يعمل محلياً ويُزامن
  // تلقائياً عند عودة الاتصال. الدردشة والمكالمات تبقى بلا تخزين إطلاقاً.
  // =====================================================================
  const addOrder = (order, { silent = false } = {}) => {
    // استيراد طلب ورد من جهاز آخر (له معرّف محدد) — بلا إعادة بث (منع الحلقات)
    if (order.id && order.number) {
      setOrdersData((prev) => (prev.some(o => o.id === order.id) ? prev : [order, ...prev].slice(0, 200)))
      return order
    }
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
    if (!silent) {
      // بث فوري احتياطي (نفس المتصفح) + حفظ على الخادم الذي يبثه لكل الأجهزة
      realtime.announceOrder(newOrder)
      api.createOrder(newOrder)
        .then(() => {
          setOrdersData(prev => prev.map(o => (o.id === newOrder.id ? { ...o, _synced: true } : o)))
        })
        .catch(() => { /* الخادم غير متاح — يُزامن تلقائياً عند عودة الاتصال */ })
    }
    return newOrder
  }

  const updateOrder = (id, updates, broadcast = true) => {
    const target = ordersData.find(o => o.id === id)
    if (!target) return null
    // نحسب الطلب المحدّث فورياً (لا نعتمد على محدّث الحالة غير المتزامن)
    const updated = { ...target, ...updates, updatedAt: new Date().toISOString() }
    setOrdersData(prev => prev.map(o => (o.id === id ? { ...o, ...updates } : o)))
    if (broadcast) {
      // بث احتياطي محلي + حفظ على الخادم (يبثه لكل الأجهزة بما فيها الزبون)
      realtime.announceOrderUpdate(id, updated.status, { order: updated })
      if (currentUser) {
        api.updateOrderRemote(id, updates).catch(() => { /* يُزامن لاحقاً */ })
      }
    }
    return updated
  }

  const cancelOrder = (id, byCustomer = false) => {
    const order = ordersData.find(o => o.id === id)
    if (!order || (order.status !== 'pending' && !byCustomer)) return false
    // الزبون يلغي عبر نقطة مخصصة بتحقق الهاتف (بلا جلسة)؛ الموظف عبر PATCH
    if (byCustomer && currentCustomer?.phone) {
      api.cancelOrderRemote(id, currentCustomer.phone).catch(() => { /* يُزامن لاحقاً */ })
    }
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
  // الطلبات تُزامَن عبر نقاطها المخصصة (أعلاه) عند الإنشاء والتحديث والجلب؛
  // الدردشات وإشارات المكالمات مستثناة عمداً لأنها تُستهلك مباشرة عبر
  // الاتصال الفوري ولا تُسجَّل في خادم المنصة (خصوصية تامة).
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
    theme, setTheme, toggleTheme,
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
    usersData, visibleUsers, addUser, updateUser, deleteUser, transferOwnership, importServerUsers, importServerPharmacies,
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
