import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { translations } from '../i18n/translations'
import { pharmacies, users, customers, suppliers, prescriptions, sales } from '../data/mockData'
import { moroccanDrugs } from '../data/moroccanDrugs'
import { categories as moroccanCategories } from '../data/categories'

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

  // Persist state
  useEffect(() => { localStorage.setItem('pharmacare_language', JSON.stringify(language)) }, [language])
  useEffect(() => { localStorage.setItem('pharmacare_theme', JSON.stringify(theme)) }, [theme])
  useEffect(() => { localStorage.setItem('pharmacare_user', JSON.stringify(currentUser)) }, [currentUser])
  useEffect(() => { localStorage.setItem('pharmacare_pharmacy', JSON.stringify(currentPharmacy)) }, [currentPharmacy])
  useEffect(() => { localStorage.setItem('pharmacare_products', JSON.stringify(productsData)) }, [productsData])
  useEffect(() => { localStorage.setItem('pharmacare_customers', JSON.stringify(customersData)) }, [customersData])
  useEffect(() => { localStorage.setItem('pharmacare_suppliers', JSON.stringify(suppliersData)) }, [suppliersData])
  useEffect(() => { localStorage.setItem('pharmacare_prescriptions', JSON.stringify(prescriptionsData)) }, [prescriptionsData])
  useEffect(() => { localStorage.setItem('pharmacare_sales', JSON.stringify(salesData)) }, [salesData])

  // Update HTML attributes when language changes
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
  }, [language])

  const t = (key) => translations[language]?.[key] || key
  const isRTL = language === 'ar'

  const login = (user, pharmacy) => {
    setCurrentUser(user)
    setCurrentPharmacy(pharmacy)
  }

  const logout = () => {
    setCurrentUser(null)
    setCurrentPharmacy(null)
  }

  // CRUD operations for products
  const addProduct = (product) => {
    const newProduct = { ...product, id: `p${Date.now()}` }
    setProductsData([newProduct, ...productsData])
    return newProduct
  }

  const updateProduct = (id, updates) => {
    setProductsData(productsData.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  const deleteProduct = (id) => {
    setProductsData(productsData.filter(p => p.id !== id))
  }

  // CRUD operations for customers
  const addCustomer = (customer) => {
    const newCustomer = { ...customer, id: `c${Date.now()}` }
    setCustomersData([newCustomer, ...customersData])
    return newCustomer
  }

  const updateCustomer = (id, updates) => {
    setCustomersData(customersData.map(c => c.id === id ? { ...c, ...updates } : c))
  }

  const deleteCustomer = (id) => {
    setCustomersData(customersData.filter(c => c.id !== id))
  }

  // CRUD operations for suppliers
  const addSupplier = (supplier) => {
    const newSupplier = { ...supplier, id: `s${Date.now()}` }
    setSuppliersData([newSupplier, ...suppliersData])
    return newSupplier
  }

  const updateSupplier = (id, updates) => {
    setSuppliersData(suppliersData.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  const deleteSupplier = (id) => {
    setSuppliersData(suppliersData.filter(s => s.id !== id))
  }

  // CRUD operations for prescriptions
  const addPrescription = (prescription) => {
    const newPrescription = { ...prescription, id: `pr${Date.now()}` }
    setPrescriptionsData([newPrescription, ...prescriptionsData])
    return newPrescription
  }

  const updatePrescription = (id, updates) => {
    setPrescriptionsData(prescriptionsData.map(p => p.id === id ? { ...p, ...updates } : p))
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

  const value = {
    // State
    language, setLanguage,
    theme, setTheme,
    currentUser, currentPharmacy,
    productsData, customersData, suppliersData, prescriptionsData, salesData,
    notifications,
    isRTL,
    // Helpers
    t,
    // Auth
    login, logout,
    pharmacies, users,
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
