import { useState } from 'react'
import { useApp } from '../contexts/AppContext'
import {
  Plus, Search, User, Phone, Mail, MapPin, Award, ShoppingBag,
  Calendar, Edit, Trash2, X, Save
} from 'lucide-react'

const Customers = () => {
  const { t, isRTL, customersData, addCustomer, updateCustomer, deleteCustomer } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', address: '',
    loyaltyPoints: 0, totalPurchases: 0, avatar: '👤'
  })

  const filtered = customersData.filter(c =>
    !searchQuery ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const openNew = () => {
    setEditing(null)
    setFormData({ name: '', phone: '', email: '', address: '', loyaltyPoints: 0, totalPurchases: 0, avatar: '👤' })
    setShowModal(true)
  }

  const openEdit = (customer) => {
    setEditing(customer)
    setFormData(customer)
    setShowModal(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const data = {
      ...formData,
      lastVisit: editing?.lastVisit || new Date().toISOString().split('T')[0]
    }
    if (editing) updateCustomer(editing.id, data)
    else addCustomer(data)
    setShowModal(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <User className="w-7 h-7 text-primary-600" />
            {t('customers')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">{customersData.length} {isRTL ? 'عميل مسجل' : 'registered customers'}</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus className="w-4 h-4" />
          {t('addCustomer')}
        </button>
      </div>

      {/* Search */}
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

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(customer => (
          <div key={customer.id} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-3xl">
                {customer.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">{customer.name}</p>
                {customer.loyaltyPoints > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Award className="w-3 h-3 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-600">{customer.loyaltyPoints} {t('loyaltyPoints')}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="w-3 h-3" />
                <span className="truncate">{customer.phone}</span>
              </div>
              {customer.email && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-3 h-3" />
                  <span className="truncate">{customer.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-3 h-3" />
                <span className="truncate">{customer.address}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-100">
              <div className="text-center p-2 rounded-lg bg-primary-50">
                <p className="text-xs text-gray-500">{t('totalPurchases')}</p>
                <p className="font-bold text-primary-600">{customer.totalPurchases}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-blue-50">
                <p className="text-xs text-gray-500">{t('lastVisit')}</p>
                <p className="font-bold text-blue-600 text-xs">{customer.lastVisit}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button onClick={() => openEdit(customer)} className="btn-secondary text-xs flex-1 py-1.5">
                <Edit className="w-3 h-3" />
                {t('edit')}
              </button>
              <button
                onClick={() => confirm(isRTL ? 'حذف؟' : 'Delete?') && deleteCustomer(customer.id)}
                className="btn-danger text-xs py-1.5 px-3"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">
                {editing ? t('edit') : t('addCustomer')}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">{t('name')}</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="label">{t('phone')}</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="label">{t('email')}</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">{t('address')}</label>
                <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="input" />
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

export default Customers
