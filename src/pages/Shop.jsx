import { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import LanguageSwitcher from '../components/LanguageSwitcher'
import CheckoutModal from '../components/CheckoutModal'
import CustomerAccountModal from '../components/CustomerAccountModal'
import OrderTracking from '../components/OrderTracking'
import {
  Stethoscope, Store, MapPin, Phone, Search, ShoppingCart, Trash2, Plus, Minus,
  ArrowRight, ArrowLeft, PackageSearch, ClipboardList, LogOut, X, BadgeCheck,
  ShieldCheck, Truck, Stethoscope as StethoscopeIcon, Lock, UserRound,
  Info, BookOpen, FileText, Download
} from 'lucide-react'

// =====================================================================
// واجهة الزبون لشراء الدواء — PHMP
// 1) عرض الصيدليات المتوفرة في المنصة واختيار واحدة
// 2) تصفح الأدوية وطلبها (الأدوية المقيدة تتطلب صورة وصفة طبية)
// 3) زبون عابر أو مشترك (تسجيل: الاسم الكامل + الهاتف + صورة وثيقة الهوية)
// 4) خيارات التوصيل + الدفع عند الاستلام
// 5) اتصال مباشر بالكاشير/الصيدلاني (حسب المتوفر) — يُستهلك مباشرة
//    عبر المنصة ولا يُسجَّل في خادمها
// =====================================================================

const Shop = () => {
  const {
    t, language, isRTL, pharmaciesData, productsData, pickName, pickAddress,
    currentCustomer, logoutCustomer, addOrder, cancelOrder,
    ordersData, categories,
  } = useApp()

  const [step, setStep] = useState('pharmacies') // pharmacies | browse | tracking
  const [pharmacyId, setPharmacyId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [activeOrderId, setActiveOrderId] = useState(null)
  const [myOrdersOpen, setMyOrdersOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [toast, setToast] = useState('')

  // دعم رابط البحث المباشر ?q= (من بطاقات دواء «مساعد PHMP» وغيرها)
  const [searchParams] = useSearchParams()
  const urlQueryRef = useRef('')
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      urlQueryRef.current = q
      setSearchQuery(q)
      // إن اختار الزبون صيدلية مسبقاً ننتقل مباشرة لشاشة التصفح
      if (pharmacyId) setStep('browse')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const pharmacy = pharmaciesData.find(p => p.id === pharmacyId)
  const Arrow = isRTL ? ArrowLeft : ArrowRight

  // الطلبات المرتبطة بهاتف الزبون الحالي
  const myOrders = useMemo(() => {
    if (!currentCustomer?.phone) return []
    return ordersData.filter(o => o.customer?.phone === currentCustomer.phone)
  }, [ordersData, currentCustomer])

  const activeOrder = ordersData.find(o => o.id === activeOrderId)

  // ===== تصفية المنتجات =====
  const filteredProducts = useMemo(() => {
    return productsData.filter(p => {
      const q = searchQuery.toLowerCase()
      const matchesSearch = !q ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
        (p.nameFr && p.nameFr.toLowerCase().includes(q)) ||
        (p.dci && p.dci.toLowerCase().includes(q))
      const matchesCategory = activeCategory === 'all' || p.category === activeCategory
      return matchesSearch && matchesCategory
    }).slice(0, 80)
  }, [productsData, searchQuery, activeCategory])

  // ===== السلة =====
  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id)
      if (existing) {
        if (existing.quantity >= (product.stock || 99)) return prev
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, {
        productId: product.id,
        name: product.name, nameEn: product.nameEn, nameFr: product.nameFr,
        price: product.price, quantity: 1,
        requiresPrescription: !!product.requiresPrescription,
        image: product.image || '💊',
      }]
    })
    setToast(pickName(product) + ' ✓')
    setTimeout(() => setToast(''), 1500)
  }

  const updateQty = (productId, delta) => {
    setCart(prev => prev.map(i => {
      if (i.productId !== productId) return i
      const q = i.quantity + delta
      if (q < 1) return i
      return { ...i, quantity: q }
    }))
  }

  const removeFromCart = (productId) => setCart(prev => prev.filter(i => i.productId !== productId))

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const cartCount = cart.reduce((n, i) => n + i.quantity, 0)
  const hasRxItems = cart.some(i => i.requiresPrescription)

  // ===== إرسال الطلب (اتصال مباشر بالصيدلية) =====
  const placeOrder = ({ customer, prescriptionPhoto, deliveryMethod, deliveryAddress }) => {
    const order = addOrder({
      pharmacyId: pharmacy.id,
      pharmacy,
      customer,
      items: cart,
      needsPrescription: hasRxItems,
      prescriptionPhoto,
      deliveryMethod,
      deliveryAddress,
      subtotal,
      deliveryFee: 0, // يحددها الموظف حسب طريقة التوصيل
      total: subtotal, // المؤقت؛ المبلغ النهائي عند الإتمام
      paymentMethod: 'on_delivery',
    })
    setCart([])
    setCartOpen(false)
    setCheckoutOpen(false)
    setActiveOrderId(order.id)
    setStep('tracking')
  }

  const handleCancelOrder = (orderId) => {
    cancelOrder(orderId, true)
  }

  // ===== واجهة اختيار الصيدلية =====
  const renderPharmacies = () => (
    <div className="space-y-6">
      <div className="text-center space-y-3 pt-4">
        <div className="w-20 h-20 mx-auto rounded-3xl gradient-primary flex items-center justify-center shadow-xl shadow-primary-500/30">
          <Store className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('availablePharmacies')}</h2>
        <p className="text-gray-600 max-w-md mx-auto text-sm">{t('shopSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pharmaciesData.map(ph => (
          <button
            key={ph.id}
            onClick={() => { setPharmacyId(ph.id); setStep('browse'); setSearchQuery(urlQueryRef.current); setCart([]) }}
            className="card p-5 text-start hover:shadow-lg hover:-translate-y-1 transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center text-3xl flex-shrink-0">
                {ph.logo}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 truncate group-hover:text-primary-700">{pickName(ph)}</h3>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" /> {pickAddress(ph)}
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5" dir="ltr">
                  <Phone className="w-3 h-3" /> {ph.phone}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="badge-success text-[10px] flex items-center gap-1">
                    <BadgeCheck className="w-3 h-3" /> {ph.license}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-primary-600 text-sm font-semibold">
              {t('choosePharmacy')} <Arrow className="w-4 h-4" />
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  // ===== واجهة تصفح الأدوية =====
  const renderBrowse = () => (
    <div className="space-y-4">
      {/* شريط الصيدلية */}
      <div className="card p-4 flex items-center gap-3">
        <button onClick={() => setStep('pharmacies')} className="btn-secondary text-xs py-1.5 px-3">
          <ArrowLeft className="w-3.5 h-3.5 rtl-flip" /> {t('backToPharmacies')}
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-2xl">{pharmacy?.logo}</span>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 truncate">{pharmacy && pickName(pharmacy)}</p>
            <p className="text-xs text-gray-500 truncate">{pickAddress(pharmacy)}</p>
          </div>
        </div>
      </div>

      {/* البحث */}
      <div className="card p-3">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchMedicine')}
            className="input ps-12 py-3"
          />
          <Search className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-4' : 'left-4'} w-5 h-5 text-gray-400`} />
        </div>
        {/* الفئات */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-thin">
          <button onClick={() => setActiveCategory('all')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeCategory === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {t('all')}
          </button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeCategory === cat.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              <span>{cat.icon}</span> {pickName(cat)}
            </button>
          ))}
        </div>
      </div>

      {/* شبكة الأدوية */}
      {filteredProducts.length === 0 ? (
        <div className="card p-12 text-center">
          <PackageSearch className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{t('noResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredProducts.map(product => (
            <div key={product.id} className="card p-4 flex flex-col hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-2">
                <span className="text-2xl">{product.image || '💊'}</span>
                {product.requiresPrescription && (
                  <span className="badge-info text-[10px] flex items-center gap-0.5">
                    <StethoscopeIcon className="w-2.5 h-2.5" /> {t('rxOnly')}
                  </span>
                )}
              </div>
              <p className="font-semibold text-sm text-gray-900 line-clamp-2 leading-tight mb-1 min-h-[2.4em]">
                {pickName(product)}
              </p>
              <p className="text-xs text-gray-500 line-clamp-1 mb-2">{product.dci || product.manufacturer || ''}</p>
              <div className="flex items-center justify-between mt-auto">
                <div>
                  <p className="text-base font-bold text-primary-600">{Number(product.price).toFixed(2)}</p>
                  <p className="text-[10px] text-gray-500">{t('currency')}</p>
                </div>
                <button onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                  className="btn-primary px-2.5 py-1.5 text-xs">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ===== تتبع الطلب =====
  const renderTracking = () => activeOrder ? (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => { setStep('browse'); setActiveOrderId(null) }} className="btn-secondary text-xs py-1.5 px-3 mb-4">
        <ArrowLeft className="w-3.5 h-3.5 rtl-flip" /> {t('continueShopping')}
      </button>
      <OrderTracking order={activeOrder} onCancel={handleCancelOrder} />
    </div>
  ) : null

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-primary-50/60 via-white to-white">
      {/* ===== الترويسة ===== */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-gray-200 safe-top">
        <div className="max-w-6xl mx-auto flex items-center gap-3 px-4 h-16">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/30">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 truncate">{t('shopTitle')}</h1>
              <p className="text-[11px] text-gray-500 truncate">{t('appShortName')} • {t('appTagline')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* دخول الموظفين (مدير / صيدلاني / كاشير / محاسب / مالك المنصة) */}
            <Link to="/login" title={t('staffLoginBtn')}
              className="relative p-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white transition-colors shadow-md"
              aria-label={t('staffLoginBtn')}>
              <Lock className="w-5 h-5" />
            </Link>

            {/* حساب الزبون: تسجيل / دخول — أو شارة الجلسة الحالية */}
            {currentCustomer ? (
              <div className="hidden sm:flex items-center gap-2 text-xs bg-gray-100 rounded-full px-3 py-1.5">
                <span>{currentCustomer.type === 'member' ? '👤' : '👋'}</span>
                <span className="font-medium text-gray-700 max-w-[120px] truncate">{currentCustomer.fullName}</span>
                <button onClick={logoutCustomer} title={t('logoutCustomer')} className="text-gray-400 hover:text-red-500">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button onClick={() => setAccountOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white border border-gray-200 hover:border-primary-300 hover:bg-primary-50 text-sm font-semibold text-gray-700 transition-all"
                aria-label={t('myAccount')}>
                <UserRound className="w-5 h-5 text-primary-600" />
                <span className="hidden md:inline">{t('myAccount')}</span>
              </button>
            )}

            {myOrders.length > 0 && (
              <button onClick={() => setMyOrdersOpen(true)}
                className="relative p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors" aria-label={t('myOrders')}>
                <ClipboardList className="w-5 h-5 text-gray-700" />
                <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-[10px] font-bold w-4.5 h-4.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center">
                  {myOrders.length}
                </span>
              </button>
            )}

            <button onClick={() => setCartOpen(true)}
              className="relative p-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white transition-colors shadow-md shadow-primary-500/30" aria-label={t('cart')}>
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-400 text-gray-900 text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            <div className="hidden sm:block">
              <LanguageSwitcher variant="compact" />
            </div>
          </div>
        </div>
        {/* مفتاح اللغة للهواتف */}
        <div className="sm:hidden pb-2 px-4">
          <LanguageSwitcher variant="compact" />
        </div>
      </header>

      {/* ===== المحتوى ===== */}
      <main className="max-w-6xl mx-auto p-4 pb-28 safe-bottom">
        {step === 'pharmacies' && renderPharmacies()}
        {step === 'browse' && renderBrowse()}
        {step === 'tracking' && renderTracking()}
      </main>

      {/* ===== زر السلة العائم (موبايل) ===== */}
      {step === 'browse' && cartCount > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)}
          className="sm:hidden fixed bottom-5 inset-x-4 z-40 btn-primary py-3 shadow-2xl shadow-primary-600/40 justify-between">
          <span className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> {cartCount} {t('cartItems')}
          </span>
          <span className="font-bold">{subtotal.toFixed(2)} {t('currency')}</span>
        </button>
      )}

      {/* ===== إشعار الإضافة ===== */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-xl animate-slide-up">
          {toast}
        </div>
      )}

      {/* ===== نافذة السلة ===== */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90dvh] flex flex-col animate-slide-up">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary-600" /> {t('cart')}
              </h3>
              <button onClick={() => setCartOpen(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {cart.length === 0 ? (
                <div className="text-center py-10">
                  <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">{t('emptyCart')}</p>
                </div>
              ) : cart.map(item => (
                <div key={item.productId} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <span className="text-xl w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0">{item.image}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{pickName(item)}</p>
                    <p className="text-xs text-gray-500">
                      {item.price.toFixed(2)} {t('currency')}
                      {item.requiresPrescription && <span className="ms-1 text-amber-600">• Rx</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.productId, -1)} className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <button onClick={() => updateQty(item.productId, 1)} className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                  <button onClick={() => removeFromCart(item.productId)} className="p-1.5 text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-gray-200 p-4 space-y-3 bg-gray-50 rounded-b-2xl">
                {hasRxItems && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 flex items-start gap-2">
                    <StethoscopeIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{t('prescriptionNeededMsg')}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{t('subtotal')}</span>
                  <span className="font-bold text-gray-900">{subtotal.toFixed(2)} {t('currency')}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{t('deliveryMethod')}</span>
                  <span>{t('deliveryFeeNote')}</span>
                </div>
                <button onClick={() => { setCartOpen(false); setCheckoutOpen(true) }}
                  className="btn-primary w-full py-3">
                  <Lock className="w-4 h-4" /> {t('checkout')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== نافذة حساب الزبون (تسجيل/دخول) ===== */}
      <CustomerAccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
      />

      {/* ===== إتمام الطلب ===== */}
      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        cart={cart}
        subtotal={subtotal}
        hasRxItems={hasRxItems}
        pharmacy={pharmacy}
        onPlaceOrder={placeOrder}
      />

      {/* ===== طلباتي ===== */}
      {myOrdersOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85dvh] flex flex-col animate-slide-up">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary-600" /> {t('myOrders')}
              </h3>
              <button onClick={() => setMyOrdersOpen(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {myOrders.length === 0 && <p className="text-center text-sm text-gray-500 py-8">{t('noData')}</p>}
              {myOrders.map(o => (
                <button key={o.id} onClick={() => { setActiveOrderId(o.id); setMyOrdersOpen(false); setStep('tracking') }}
                  className="w-full p-3 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50/50 text-start transition-all">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-gray-900" dir="ltr">{o.number}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      o.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      o.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                      o.status === 'pending' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {t('status' + o.status.charAt(0).toUpperCase() + o.status.slice(1))}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {o.items.length} {t('orderItems')} • {Number(o.subtotal).toFixed(2)} {t('currency')}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* تذييل */}
      <footer className="border-t border-gray-200 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-primary-600" />
                <span className="font-bold text-gray-900">{t('appName')}</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{t('footerMission')}</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-2 text-xs uppercase tracking-wider">{t('quickLinks')}</p>
              <div className="flex flex-col gap-1.5">
                <Link to="/about" className="flex items-center gap-1.5 text-gray-500 hover:text-primary-600 text-xs transition-colors"><Info className="w-3.5 h-3.5" /> {t('aboutUs')}</Link>
                <Link to="/guide" className="flex items-center gap-1.5 text-gray-500 hover:text-primary-600 text-xs transition-colors"><BookOpen className="w-3.5 h-3.5" /> {t('howToUse')}</Link>
                <Link to="/download" className="flex items-center gap-1.5 text-gray-500 hover:text-primary-600 text-xs transition-colors"><Download className="w-3.5 h-3.5" /> {t('downloadApp')}</Link>
              </div>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-2 text-xs uppercase tracking-wider">{t('legalPages')}</p>
              <div className="flex flex-col gap-1.5">
                <Link to="/terms" className="flex items-center gap-1.5 text-gray-500 hover:text-primary-600 text-xs transition-colors"><FileText className="w-3.5 h-3.5" /> {t('termsOfUse')}</Link>
                <Link to="/privacy" className="flex items-center gap-1.5 text-gray-500 hover:text-primary-600 text-xs transition-colors"><ShieldCheck className="w-3.5 h-3.5" /> {t('privacyPolicy')}</Link>
              </div>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-2 text-xs uppercase tracking-wider">{t('staffAccess')}</p>
              <Link to="/login" className="flex items-center gap-1.5 text-gray-500 hover:text-primary-600 text-xs transition-colors">
                <Lock className="w-3.5 h-3.5" /> {t('staffLoginBtn')}
              </Link>
              <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">{t('footerLegalNote')}</p>
            </div>
          </div>
          <p className="mt-6 pt-4 border-t border-gray-200 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-gray-400">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> {t('directConnectionNote')}</span>
            <span>• © {new Date().getFullYear()} {t('appName')} — {t('allRightsReserved')}</span>
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Shop
