import { useState } from 'react'
import { useApp } from '../contexts/AppContext'
import {
  Plus, Search, Truck, Phone, Mail, MapPin, Star,
  Edit, Trash2, X, Save, Award
} from 'lucide-react'

const Suppliers = () => {
  const { t, isRTL, suppliersData, addSupplier, updateSupplier, deleteSupplier } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  const [formData, setFormData] = useState({
    name: '', nameEn: '', contact: '', phone: '', email: '',
    address: '', category: '', rating: 4.5
  })

  const filtered = suppliersData.filter(s =>
    !searchQuery ||
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.contact.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const openNew = () => {
    setEditing(null)
    setFormData({ name: '', nameEn: '', contact: '', phone: '', email: '', address: '', category: '', rating: 4.5 })
    setShowModal(true)
  }

  const openEdit = (supplier) => {
    setEditing(supplier)
    setFormData(supplier)
    setShowModal(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (editing) updateSupplier(editing.id, formData)
    else addSupplier({ ...formData, totalOrders: 0 })
    setShowModal(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-primary-600" />
            {t('suppliers')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">{suppliersData.length} {isRTL ? 'مورد' : 'suppliers'}</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus className="w-4 h-4" />
          {t('addSupplier')}
        </button>
      </div>

      <div className="card p-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search')}
            className="input ps-10"
          />
          <Search className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} w-4 h-4 text-gray-400`} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(supplier => (
          <div key={supplier.id} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">{isRTL ? supplier.name : supplier.nameEn}</p>
                  <p className="text-xs text-gray-500">{supplier.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg">
                <Star className="w-3 h-3 text-amber-500 fill-current" />
                <span className="text-xs font-bold text-amber-700">{supplier.rating}</span>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Award className="w-3 h-3" />
                <span className="truncate">{supplier.contact}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="w-3 h-3" />
                <span className="truncate">{supplier.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Mail className="w-3 h-3" />
                <span className="truncate">{supplier.email}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-100">
              <div className="text-center p-2 rounded-lg bg-primary-50">
                <p className="text-xs text-gray-500">{isRTL ? 'الطلبات' : 'Orders'}</p>
                <p className="font-bold text-primary-600">{supplier.totalOrders}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-blue-50">
                <p className="text-xs text-gray-500">{isRTL ? 'الحالة' : 'Status'}</p>
                <p className="font-bold text-blue-600 text-xs">{isRTL ? 'نشط' : 'Active'}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button onClick={() => openEdit(supplier)} className="btn-secondary text-xs flex-1 py-1.5">
                <Edit className="w-3 h-3" />
                {t('edit')}
              </button>
              <button
                onClick={() => confirm(isRTL ? 'حذف؟' : 'Delete?') && deleteSupplier(supplier.id)}
                className="btn-danger text-xs py-1.5 px-3"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">
                {editing ? t('edit') : t('addSupplier')}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('name')} (AR)</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" required />
                </div>
                <div>
                  <label className="label">{t('name')} (EN)</label>
                  <input type="text" value={formData.nameEn} onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })} className="input" required />
                </div>
              </div>
              <div>
                <label className="label">{t('contactPerson')}</label>
                <input type="text" value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })} className="input" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('phone')}</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input" required />
                </div>
                <div>
                  <label className="label">{t('email')}</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input" />
                </div>
              </div>
              <div>
                <label className="label">{t('address')}</label>
                <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">{t('category')}</label>
                <input type="text" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="input" placeholder={isRTL ? 'مثال: أدوية' : 'e.g., Medicine'} />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">{t('cancel')}</button>
                <button type="submit" className="btn-primary"><Save className="w-4 h-4" />{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Suppliers
