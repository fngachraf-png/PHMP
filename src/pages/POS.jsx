import { useState, useMemo } from 'react'
import { useApp } from '../contexts/AppContext'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote,
  Wallet, Building, Receipt, X, Check, User, Barcode,
  Tag, Percent, Calculator, FileText, Printer, Stethoscope
} from 'lucide-react'

const POS = () => {
  const { t, isRTL, productsData, customersData, addSale, currentUser } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [discount, setDiscount] = useState(0)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [completedSale, setCompletedSale] = useState(null)
  const [activeCategory, setActiveCategory] = useState('all')

  const posCategories = [
    { id: 'all', label: t('all'), icon: '🏷️' },
    { id: 'painkillers', label: isRTL ? 'مسكنات' : 'Painkillers', icon: '💊' },
    { id: 'antibiotics', label: isRTL ? 'مضادات حيوية' : 'Antibiotics', icon: '🧬' },
    { id: 'diabetes', label: isRTL ? 'سكري' : 'Diabetes', icon: '🩸' },
    { id: 'cardiology', label: isRTL ? 'القلب' : 'Cardiology', icon: '❤️' },
    { id: 'vitamins', label: isRTL ? 'فيتامينات' : 'Vitamins', icon: '🌟' },
    { id: 'cold_flu', label: isRTL ? 'برد' : 'Cold', icon: '🤧' },
    { id: 'skincare', label: isRTL ? 'بشرة' : 'Skincare', icon: '✨' },
    { id: 'gastro', label: isRTL ? 'معدة' : 'Gastro', icon: '🫄' },
    { id: 'neuro', label: isRTL ? 'أعصاب' : 'Neuro', icon: '🧠' },
  ]

  const filteredProducts = useMemo(() => {
    return productsData.filter(p => {
      const matchesSearch = !searchQuery ||
        (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.dci && p.dci.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.barcode && p.barcode.includes(searchQuery))
      const matchesCategory = activeCategory === 'all' || p.category === activeCategory
      return matchesSearch && matchesCategory
    }).slice(0, 60) // Limit for performance
  }, [productsData, searchQuery, activeCategory])

  const addToCart = (product) => {
    if (product.stock <= 0) return
    const existing = cart.find(item => item.productId === product.id)
    if (existing) {
      if (existing.quantity >= product.stock) return
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        nameEn: product.nameEn,
        price: product.price,
        quantity: 1,
        maxStock: product.stock,
        image: product.image || '💊'
      }])
    }
  }

  const updateQuantity = (productId, delta) => {
    setCart(cart.map(item => {
      if (item.productId === productId) {
        const newQty = item.quantity + delta
        if (newQty < 1) return item
        if (newQty > item.maxStock) return item
        return { ...item, quantity: newQty }
      }
      return item
    }))
  }

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.productId !== productId))
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const discountAmount = (subtotal * discount) / 100
  const taxAmount = (subtotal - discountAmount) * 0.05
  const total = subtotal - discountAmount + taxAmount

  const handleCheckout = () => {
    if (cart.length === 0) return
    setShowPaymentModal(true)
  }

  const completeSale = () => {
    const sale = {
      number: `INV-2026-${String(Date.now()).slice(-4)}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      customer: selectedCustomer || { name: t('walkInCustomer'), avatar: '👤' },
      items: cart,
      subtotal: subtotal,
      tax: taxAmount,
      discount: discountAmount,
      total: total,
      paymentMethod: paymentMethod,
      cashier: currentUser?.name
    }

    const newSale = addSale(sale)
    setCompletedSale(newSale)
    setShowPaymentModal(false)
    setShowReceiptModal(true)
    // Reset
    setCart([])
    setSelectedCustomer(null)
    setDiscount(0)
    setAmountPaid('')
  }

  const newSale = () => {
    setShowReceiptModal(false)
    setCompletedSale(null)
  }

  const change = Math.max(0, parseFloat(amountPaid || 0) - total)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-primary-600" />
            {t('pos')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">{t('newSale')}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 font-semibold">
            {new Date().toLocaleDateString(isRTL ? 'ar-MA' : 'en-US')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products section */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search */}
          <div className="card p-4">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchProducts')}
                className="input ps-12 py-3 text-base"
              />
              <Search className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-4' : 'left-4'} w-5 h-5 text-gray-400`} />
              <Barcode className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-4' : 'right-4'} w-5 h-5 text-gray-400`} />
            </div>

            {/* Categories */}
            <div className="flex gap-2 mt-3 overflow-x-auto pb-2 scrollbar-thin">
              {posCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-all ${
                    activeCategory === cat.id
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-500/30'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Products grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map(product => {
              const catIcon = product.category === 'painkillers' ? '💊' :
                              product.category === 'antibiotics' ? '🧬' :
                              product.category === 'cardiology' ? '❤️' :
                              product.category === 'diabetes' ? '🩸' :
                              product.category === 'cold_flu' ? '🤧' :
                              product.category === 'vitamins' ? '🌟' :
                              product.category === 'gastro' ? '🫄' :
                              product.category === 'neuro' ? '🧠' :
                              product.category === 'skincare' ? '✨' :
                              product.category === 'eye' ? '👁️' :
                              product.category === 'antifungal' ? '🍄' :
                              product.category === 'hormones' ? '⚗️' : '🧪'
              return (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0}
                className={`card p-4 text-start transition-all hover:shadow-md hover:-translate-y-0.5 ${
                  product.stock <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center text-2xl">
                    {catIcon}
                  </div>
                  {product.requiresPrescription && (
                    <span className="badge-info text-xs">
                      <Stethoscope className="w-3 h-3 me-1" />
                      Rx
                    </span>
                  )}
                </div>
                <p className="font-semibold text-sm text-gray-900 line-clamp-2 leading-tight mb-1">
                  {isRTL ? product.name : product.nameEn}
                </p>
                <p className="text-xs text-gray-500 mb-2 line-clamp-1">{product.dci || product.manufacturer}</p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-lg font-bold text-primary-600">{product.price?.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{t('currency')}</p>
                  </div>
                  <span className={`badge ${product.stock > product.minStock ? 'badge-success' : product.stock > 0 ? 'badge-warning' : 'badge-danger'} text-xs`}>
                    {product.stock}
                  </span>
                </div>
              </button>
              )
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="card p-12 text-center">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">{t('noData')}</p>
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="lg:col-span-1">
          <div className="card sticky top-20 max-h-[calc(100vh-6rem)] flex flex-col">
            {/* Cart header */}
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary-600" />
                {t('cart')}
                {cart.length > 0 && (
                  <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {cart.length}
                  </span>
                )}
              </h2>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  {isRTL ? 'مسح الكل' : 'Clear all'}
                </button>
              )}
            </div>

            {/* Customer */}
            <div className="px-5 py-3 border-b border-gray-200">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                {t('customer')}
              </label>
              <select
                value={selectedCustomer?.id || ''}
                onChange={(e) => {
                  const cust = customersData.find(c => c.id === e.target.value)
                  setSelectedCustomer(cust || null)
                }}
                className="input text-sm"
              >
                <option value="">{t('walkInCustomer')}</option>
                {customersData.map(c => (
                  <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>
                ))}
              </select>
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2 min-h-[200px] max-h-[40vh]">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <ShoppingCart className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-900">{t('emptyCart')}</p>
                  <p className="text-xs text-gray-500 mt-1">{t('addProductsToStart')}</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.productId} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 group">
                    <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-lg flex-shrink-0">
                      {item.image}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {isRTL ? item.name : item.nameEn}
                      </p>
                      <p className="text-xs text-gray-500">{item.price} × {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQuantity(item.productId, -1)}
                        className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-200"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center text-xs font-bold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, 1)}
                        className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-200"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Totals */}
            {cart.length > 0 && (
              <div className="border-t border-gray-200 p-5 space-y-3 bg-gray-50">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>{t('subtotal')}</span>
                    <span className="font-semibold">{subtotal.toFixed(2)} {t('currency')}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-600 flex items-center gap-1">
                      <Percent className="w-3 h-3" />
                      {t('discount')}
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={discount}
                        onChange={(e) => setDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                        className="w-12 px-1.5 py-0.5 text-xs text-end border border-gray-300 rounded"
                        min="0"
                        max="100"
                      />
                      <span className="text-gray-600">%</span>
                      <span className="font-semibold text-red-600 ms-2">-{discountAmount.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>{t('tax')} (5%)</span>
                    <span className="font-semibold">{taxAmount.toFixed(2)} {t('currency')}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-300">
                    <span>{t('total')}</span>
                    <span className="text-primary-600">{total.toFixed(2)} {t('currency')}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  className="btn-primary w-full py-3 text-base"
                >
                  <Receipt className="w-5 h-5" />
                  {t('completeSale')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">{t('paymentMethod')}</h3>
              <button onClick={() => setShowPaymentModal(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Total */}
              <div className="bg-primary-50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-600">{t('total')}</p>
                <p className="text-3xl font-bold text-primary-700">{total.toFixed(2)} {t('currency')}</p>
              </div>

              {/* Payment methods */}
              <div>
                <label className="label">{t('paymentMethod')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'cash', icon: Banknote, label: t('cash'), color: 'emerald' },
                    { id: 'card', icon: CreditCard, label: t('card'), color: 'blue' },
                    { id: 'transfer', icon: Building, label: t('transfer'), color: 'purple' },
                    { id: 'insurance', icon: Wallet, label: t('insurance'), color: 'amber' },
                  ].map(method => {
                    const Icon = method.icon
                    const active = paymentMethod === method.id
                    return (
                      <button
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                          active
                            ? `border-${method.color}-500 bg-${method.color}-50`
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`w-6 h-6 ${active ? `text-${method.color}-600` : 'text-gray-500'}`} />
                        <span className={`text-sm font-medium ${active ? `text-${method.color}-700` : 'text-gray-700'}`}>
                          {method.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Amount paid (for cash) */}
              {paymentMethod === 'cash' && (
                <>
                  <div>
                    <label className="label">{t('amountPaid')}</label>
                    <input
                      type="number"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="input text-lg font-semibold"
                      placeholder={total.toFixed(2)}
                      autoFocus
                    />
                  </div>
                  {amountPaid && parseFloat(amountPaid) >= total && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-emerald-700">{t('change')}</span>
                      <span className="text-lg font-bold text-emerald-700">{change.toFixed(2)} {t('currency')}</span>
                    </div>
                  )}
                  {/* Quick amount buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    {[total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100].map((amt, i) => (
                      <button
                        key={i}
                        onClick={() => setAmountPaid(amt.toFixed(2))}
                        className="btn-secondary text-xs py-1.5"
                      >
                        {amt.toFixed(0)}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <button
                onClick={completeSale}
                disabled={paymentMethod === 'cash' && parseFloat(amountPaid || 0) < total}
                className="btn-primary w-full py-3 text-base"
              >
                <Check className="w-5 h-5" />
                {t('completeSale')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary-100 flex items-center justify-center mb-3">
                <Check className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{t('success')}</h3>
              <p className="text-sm text-gray-500 mt-1">{completedSale.number}</p>

              <div className="bg-gray-50 rounded-xl p-4 mt-6 text-start space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('customer')}</span>
                  <span className="font-semibold">{completedSale.customer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('total')}</span>
                  <span className="font-bold text-primary-600">{completedSale.total.toFixed(2)} {t('currency')}</span>
                </div>
                {completedSale.paymentMethod === 'cash' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('amountPaid')}</span>
                      <span>{parseFloat(amountPaid).toFixed(2)} {t('currency')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('change')}</span>
                      <span className="font-semibold text-emerald-600">{change.toFixed(2)} {t('currency')}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-2 mt-6">
                <button onClick={() => window.print()} className="btn-secondary flex-1">
                  <Printer className="w-4 h-4" />
                  {t('print')}
                </button>
                <button onClick={newSale} className="btn-primary flex-1">
                  {t('newSale')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default POS
