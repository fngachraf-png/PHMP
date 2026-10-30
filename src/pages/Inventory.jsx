import { useState, useMemo } from 'react'
import { useApp } from '../contexts/AppContext'
import { exportToCSV, money } from '../lib/exportUtils'
import { searchOfficialCatalog, reimbursementRate, OFFICIAL_CATALOG_SIZE, CNSS_LIST_COUNT } from '../lib/officialCatalog'
import {
  Plus, Search, Edit, Trash2, Filter, Package, AlertTriangle,
  Calendar, TrendingDown, Barcode, Pill, X, Save, Download,
  Layers, Box, ChevronDown, Shield, Database, BadgeCheck, Sparkles
} from 'lucide-react'

const Inventory = () => {
  const { t, isRTL, productsData, categories, addProduct, updateProduct, deleteProduct, loadMoreProducts, fullDrugDatabase , pickName, language} = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [viewMode, setViewMode] = useState('table')
  // المنتقي الرسمي: بحث في اللائحة الرسمية الموحدة لتعبئة النموذج بنقرة
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogResults, setCatalogResults] = useState([])

  const [formData, setFormData] = useState({
    name: '', nameEn: '', barcode: '', sku: '', manufacturer: '',
    category: 'painkillers', cost: 0, price: 0, stock: 0, minStock: 10,
    expiry: '', batch: '', requiresPrescription: false, dosage: '', image: '💊'
  })

  const onCatalogSearch = (q) => {
    setCatalogQuery(q)
    setCatalogResults(q.trim().length >= 2 ? searchOfficialCatalog(q, 8) : [])
  }

  // تعبئة النموذج من اللائحة الرسمية (اسم بالثلاث لغات + باركود + أسعار + تعويض)
  const pickFromCatalog = (d) => {
    setFormData((f) => ({
      ...f,
      name: d.nameAr || d.name || f.name,
      nameEn: d.nameEn || d.name || f.nameEn,
      nameFr: d.nameFr || d.nameEn || d.name,
      barcode: d.code || d.barcode || f.barcode,
      sku: d.sku || `MA-${d.code}`,
      manufacturer: d.manufacturer || f.manufacturer,
      category: d.category || 'other',
      cost: d.cost || f.cost,
      price: d.price || d.ppv || f.price,
      dosage: d.dosage || f.dosage,
      form: d.form || f.form,
      presentation: d.presentation || f.presentation,
      dci: d.dci || f.dci,
      requiresPrescription: d.requiresPrescription ?? false,
      tauxRemboursement: d.tauxRemboursement ?? '',
      cnss: !!d.cnss,
      ppv: d.ppv || d.price || 0,
      ph: d.ph || d.cost || 0,
    }))
    setCatalogResults([])
    setCatalogQuery(d.nameEn || d.name || '')
  }

  const filteredProducts = useMemo(() => {
    return productsData.filter(p => {
      const matchesSearch = !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode.includes(searchQuery) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase())

      let matchesStatus = true
      if (filterStatus === 'low') matchesStatus = p.stock < p.minStock
      else if (filterStatus === 'out') matchesStatus = p.stock <= 0
      else if (filterStatus === 'expiring') {
        const days = Math.floor((new Date(p.expiry) - new Date()) / (1000 * 60 * 60 * 24))
        matchesStatus = days < 90 && days > 0
      }

      const matchesCategory = filterCategory === 'all' || p.category === filterCategory

      return matchesSearch && matchesStatus && matchesCategory
    })
  }, [productsData, searchQuery, filterStatus, filterCategory])

  const getStockStatus = (product) => {
    if (product.stock <= 0) return { label: t('outOfStock'), class: 'badge-danger', icon: '🚫' }
    if (product.stock < product.minStock) return { label: t('lowStock'), class: 'badge-warning', icon: '⚠️' }
    return { label: t('inStock'), class: 'badge-success', icon: '✅' }
  }

  const getExpiryStatus = (product) => {
    const days = Math.floor((new Date(product.expiry) - new Date()) / (1000 * 60 * 60 * 24))
    if (days < 0) return { label: t('expired'), class: 'badge-danger' }
    if (days < 30) return { label: `${days}d`, class: 'badge-danger' }
    if (days < 90) return { label: `${days}d`, class: 'badge-warning' }
    return { label: `${days}d`, class: 'badge-success' }
  }

  const openAddModal = () => {
    setEditingProduct(null)
    setFormData({
      name: '', nameEn: '', barcode: '', sku: '', manufacturer: '',
      category: 'painkillers', cost: 0, price: 0, stock: 0, minStock: 10,
      expiry: '', batch: '', requiresPrescription: false, dosage: '', image: '💊'
    })
    setShowModal(true)
  }

  const openEditModal = (product) => {
    setEditingProduct(product)
    setFormData({ ...product })
    setShowModal(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (editingProduct) {
      updateProduct(editingProduct.id, formData)
    } else {
      addProduct(formData)
    }
    setShowModal(false)
  }

  const handleDelete = (id) => {
    if (confirm(language === 'ar' ? 'هل أنت متأكد من الحذف؟' : language === 'fr' ? 'Confirmer la suppression ?' : 'Are you sure you want to delete?')) {
      deleteProduct(id)
    }
  }

  const stats = {
    total: productsData.length,
    inStock: productsData.filter(p => p.stock > p.minStock).length,
    lowStock: productsData.filter(p => p.stock < p.minStock && p.stock > 0).length,
    outOfStock: productsData.filter(p => p.stock <= 0).length,
    expiring: productsData.filter(p => {
      const days = Math.floor((new Date(p.expiry) - new Date()) / (1000 * 60 * 60 * 24))
      return days < 90 && days > 0
    }).length,
    totalValue: productsData.reduce((sum, p) => sum + (p.stock * p.cost), 0)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-7 h-7 text-primary-600" />
            {t('inventory')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {language === 'ar' ? 'إدارة المنتجات والأدوية' : language === 'fr' ? 'Gestion des produits et médicaments' : 'Manage products and medications'}
          </p>
        </div>
        <div className="flex gap-2">
          {/* تصدير قائمة الأصناف المعروضة (مع الفلاتر) — CSV يفتح سليماً في Excel */}
          <button
            onClick={() => exportToCSV('inventory', [
              [
                t('description'), t('sku') || 'SKU', t('barcode'),
                t('quantity'), t('minStock') || 'Min', t('unitCost'),
                t('salePrice'), t('stockValue'), t('expiryDate') || 'Expiry',
              ],
              ...filteredProducts.map((p) => [
                pickName(p) || p.name, p.sku || '', p.barcode || '',
                p.stock, p.minStock,
                Number(p.cost || 0).toFixed(2), Number(p.price || 0).toFixed(2),
                (p.stock * p.cost || 0).toFixed(2), p.expiry || '',
              ]),
            ])}
            className="btn-secondary"
            title={t('exportCSV')}
          >
            <Download className="w-4 h-4" />
            {t('export')}
          </button>
          <button onClick={openAddModal} className="btn-primary">
            <Plus className="w-4 h-4" />
            {t('addProduct')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: t('all'), value: stats.total, color: 'blue', icon: Layers },
          { label: t('inStock'), value: stats.inStock, color: 'emerald', icon: Box },
          { label: t('lowStock'), value: stats.lowStock, color: 'amber', icon: TrendingDown },
          { label: t('outOfStockItems'), value: stats.outOfStock, color: 'red', icon: X },
          { label: t('expiringSoon'), value: stats.expiring, color: 'purple', icon: Calendar },
          { label: t('totalInDatabase'), value: fullDrugDatabase?.length || 0, color: 'indigo', icon: Package },
        ].map((stat, i) => {
          const Icon = stat.icon
          return (
            <div key={i} className="card p-4">
              <div className={`w-10 h-10 rounded-lg bg-${stat.color}-50 flex items-center justify-center mb-2`}>
                <Icon className={`w-5 h-5 text-${stat.color}-600`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Source attribution */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-sm">
        <Shield className="w-4 h-4 text-emerald-600" />
        <span className="text-emerald-700">
          {isRTL
            ? `البيانات من اللائحة الرسمية لوزارة الصحة المغربية - ${fullDrugDatabase?.length || 0} دواء معتمد`
            : `Data from official Moroccan Ministry of Health - ${fullDrugDatabase?.length || 0} approved drugs`}
        </span>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search')}
              className="input ps-10"
            />
            <Search className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} w-4 h-4 text-gray-400`} />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="input lg:w-48"
          >
            <option value="all">{t('all')} {t('category')}</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input lg:w-48"
          >
            <option value="all">{t('all')} {t('status')}</option>
            <option value="low">{t('lowStock')}</option>
            <option value="out">{t('outOfStock')}</option>
            <option value="expiring">{t('expiringSoon')}</option>
          </select>
        </div>
      </div>

      {/* Products Table - desktop */}
      <div className="card overflow-hidden">
        <div className="hidden md:block table-container">
          <table className="table">
            <thead>
              <tr>
                <th className="w-12"></th>
                <th>{t('productName')}</th>
                <th>{t('category')}</th>
                <th>{t('barcode')}</th>
                <th>{t('price')}</th>
                <th>{t('reimbursement')}</th>
                <th>{t('stock')}</th>
                <th>{t('expiryDate')}</th>
                <th>{t('status')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredProducts.map(product => {
                const stockStatus = getStockStatus(product)
                const expiryStatus = getExpiryStatus(product)
                const category = categories.find(c => c.id === product.category)
                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td>
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center text-xl">
                        {category?.icon || '💊'}
                      </div>
                    </td>
                    <td>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          {pickName(product)}
                        </p>
                        <p className="text-xs text-gray-500">{product.dci || product.manufacturer}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {product.requiresPrescription && (
                            <span className="badge-info text-xs">Rx</span>
                          )}
                          {product.princepsGenerique === 'G' && (
                            <span className="badge-success text-xs">{t('generic')}</span>
                          )}
                          {(product.cnss || reimbursementRate(product) > 0) && (
                            <span className="badge-success text-[10px] flex items-center gap-0.5">
                              <BadgeCheck className="w-3 h-3" /> CNSS{reimbursementRate(product) > 0 ? ` ${reimbursementRate(product)}%` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge-gray text-xs">
                        {category?.icon} {pickName(category).split(' ')[0]}
                      </span>
                    </td>
                    <td className="text-xs font-mono text-gray-600">{product.barcode}</td>
                    <td>
                      <p className="font-bold text-gray-900">{product.price?.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{t('currency')}</p>
                    </td>
                    <td>
                      {product.tauxRemboursement === '70%' ? (
                        <span className="badge-info text-xs">{product.tauxRemboursement}</span>
                      ) : (
                        <span className="badge-gray text-xs">{product.tauxRemboursement || '0%'}</span>
                      )}
                    </td>
                    <td>
                      <p className={`font-bold ${
                        product.stock <= 0 ? 'text-red-600' :
                        product.stock < product.minStock ? 'text-amber-600' :
                        'text-gray-900'
                      }`}>
                        {product.stock}
                      </p>
                      <p className="text-xs text-gray-500">min: {product.minStock}</p>
                    </td>
                    <td>
                      <span className={`badge ${expiryStatus.class} text-xs`}>
                        {product.expiry}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${stockStatus.class} text-xs`}>
                        {stockStatus.label}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"
                          title={t('edit')}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"
                          title={t('delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Products cards - mobile */}
        <div className="md:hidden divide-y divide-gray-100">
          {filteredProducts.map(product => {
            const stockStatus = getStockStatus(product)
            const expiryStatus = getExpiryStatus(product)
            const category = categories.find(c => c.id === product.category)
            return (
              <div key={product.id} className="p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center text-xl shrink-0">
                    {category?.icon || '💊'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm leading-snug">
                      {pickName(product)}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{product.dci || product.manufacturer}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {product.requiresPrescription && <span className="badge-info text-xs">Rx</span>}
                      {product.princepsGenerique === 'G' && <span className="badge-success text-xs">{t('generic')}</span>}
                      <span className={`badge ${stockStatus.class} text-xs`}>{stockStatus.label}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => openEditModal(product)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600" aria-label={t('edit')}>
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(product.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600" aria-label={t('delete')}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-gray-50 rounded-lg py-1.5">
                    <p className="text-[10px] text-gray-500">{t('price')}</p>
                    <p className="text-sm font-bold text-gray-900">{product.price?.toFixed(1)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-1.5">
                    <p className="text-[10px] text-gray-500">{t('stock')}</p>
                    <p className={`text-sm font-bold ${product.stock <= 0 ? 'text-red-600' : product.stock < product.minStock ? 'text-amber-600' : 'text-gray-900'}`}>{product.stock}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-1.5">
                    <p className="text-[10px] text-gray-500">{t('reimbursement')}</p>
                    <p className="text-sm font-bold text-gray-900">{product.tauxRemboursement || '0%'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-1.5">
                    <p className="text-[10px] text-gray-500">{t('expiryDate')}</p>
                    <p className="text-[11px] font-semibold mt-0.5">{product.expiry}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Load More */}
        {filteredProducts.length > 0 && productsData.length < (fullDrugDatabase?.length || 0) && (
          <div className="p-4 border-t border-gray-200 text-center">
            <button onClick={() => loadMoreProducts(200)} className="btn-primary">
              <Database className="w-4 h-4" />
              {t('loadMore')} ({productsData.length} / {fullDrugDatabase?.length || 0})
            </button>
          </div>
        )}

        {filteredProducts.length === 0 && (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">{t('noData')}</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8 animate-slide-up">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <h3 className="text-xl font-bold text-gray-900">
                {editingProduct ? t('editProduct') : t('addProduct')}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* ===== المنتقي الرسمي: إضافة سريعة من اللائحة الرسمية ===== */}
              {!editingProduct && (
                <div className="p-4 rounded-xl border-2 border-primary-200 bg-primary-50/60 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-bold text-primary-800 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" /> {t('officialCatalogPicker')}
                    </p>
                    <span className="text-[11px] text-primary-700 bg-primary-100 rounded-full px-2 py-0.5 font-semibold tabular-nums">
                      {OFFICIAL_CATALOG_SIZE.toLocaleString()}{CNSS_LIST_COUNT > 0 ? ` + CNSS ${CNSS_LIST_COUNT.toLocaleString()}` : ''}
                    </span>
                  </div>
                  <div className="relative">
                    <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      className="input ps-9"
                      value={catalogQuery}
                      onChange={(e) => onCatalogSearch(e.target.value)}
                      placeholder={t('officialCatalogSearchHint')}
                      dir="auto"
                    />
                  </div>
                  {catalogResults.length > 0 && (
                    <div className="space-y-1 max-h-56 overflow-y-auto rounded-xl bg-white border border-primary-100 p-1.5 shadow-sm">
                      {catalogResults.map((d) => {
                        const rate = reimbursementRate(d)
                        return (
                          <button
                            type="button"
                            key={`${d.code}-${d.id}`}
                            onClick={() => pickFromCatalog(d)}
                            className="w-full text-start p-2 rounded-lg hover:bg-primary-50 transition-colors flex items-center gap-2"
                          >
                            <Pill className="w-4 h-4 text-primary-600 flex-shrink-0" />
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-semibold text-gray-900 truncate">
                                {d.nameEn || d.name}
                                {d.dci && <span className="text-[11px] font-normal text-gray-500"> · {d.dci}</span>}
                              </span>
                              <span className="block text-[11px] text-gray-500 truncate">
                                {d.dosage ? `${d.dosage} • ` : ''}{d.presentation || d.form || ''}
                                {d.ppv ? ` • PPV ${Number(d.ppv).toFixed(2)} MAD` : ''}
                              </span>
                            </span>
                            {(d.cnss || rate > 0) && (
                              <span className="badge-success text-[10px] flex items-center gap-0.5 flex-shrink-0">
                                <BadgeCheck className="w-3 h-3" /> CNSS{rate > 0 ? ` ${rate}%` : ''}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <p className="text-[11px] text-gray-500">{t('officialCatalogNote')}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('productName')} (AR)</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">{t('productName')} (EN)</label>
                  <input
                    type="text"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label flex items-center gap-1"><Barcode className="w-3 h-3" /> {t('barcode')}</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">{t('sku')}</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('manufacturer')}</label>
                  <input
                    type="text"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">{t('category')}</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="label">{t('cost')}</label>
                  <input
                    type="number"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                    className="input"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="label">{t('sellingPrice')}</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="input"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="label">{t('stock')}</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                    className="input"
                    min="0"
                  />
                </div>
                <div>
                  <label className="label">{t('minStock')}</label>
                  <input
                    type="number"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                    className="input"
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label flex items-center gap-1"><Calendar className="w-3 h-3" /> {t('expiryDate')}</label>
                  <input
                    type="date"
                    value={formData.expiry}
                    onChange={(e) => setFormData({ ...formData, expiry: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">{t('batchNumber')}</label>
                  <input
                    type="text"
                    value={formData.batch}
                    onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">{t('dosage')}</label>
                <input
                  type="text"
                  value={formData.dosage}
                  onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                  className="input"
                  placeholder={language === 'ar' ? 'مثال: قرص كل 8 ساعات' : language === 'fr' ? 'ex. : 1 comprimé toutes les 8 heures' : 'e.g., 1 tablet every 8 hours'}
                />
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <input
                  type="checkbox"
                  id="requiresPrescription"
                  checked={formData.requiresPrescription}
                  onChange={(e) => setFormData({ ...formData, requiresPrescription: e.target.checked })}
                  className="w-4 h-4 text-primary-600"
                />
                <label htmlFor="requiresPrescription" className="text-sm font-medium text-amber-900 cursor-pointer">
                  {t('requiresPrescription')}
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  {t('cancel')}
                </button>
                <button type="submit" className="btn-primary">
                  <Save className="w-4 h-4" />
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Inventory
