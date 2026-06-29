import { useState } from 'react'
import { useApp } from '../contexts/AppContext'
import {
  Receipt, Plus, Search, Truck, Package, Calendar,
  DollarSign, CheckCircle, Clock, X, Eye
} from 'lucide-react'

const Purchases = () => {
  const { t, isRTL, suppliersData, productsData } = useApp()
  const [searchQuery, setSearchQuery] = useState('')

  // Mock purchase orders
  const [orders] = useState([
    { id: 'po1', number: 'PO-2026-001', supplier: suppliersData[0], date: '2026-06-20', items: 5, total: 12500, status: 'received' },
    { id: 'po2', number: 'PO-2026-002', supplier: suppliersData[1], date: '2026-06-19', items: 3, total: 8400, status: 'pending' },
    { id: 'po3', number: 'PO-2026-003', supplier: suppliersData[3], date: '2026-06-18', items: 8, total: 15600, status: 'received' },
    { id: 'po4', number: 'PO-2026-004', supplier: suppliersData[2], date: '2026-06-17', items: 4, total: 9800, status: 'pending' },
    { id: 'po5', number: 'PO-2026-005', supplier: suppliersData[4], date: '2026-06-15', items: 6, total: 11200, status: 'received' },
  ])

  const filtered = orders.filter(o =>
    !searchQuery ||
    o.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.supplier.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    received: orders.filter(o => o.status === 'received').length,
    totalValue: orders.reduce((sum, o) => sum + o.total, 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-7 h-7 text-primary-600" />
            {t('purchases')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">{t('purchaseOrders')}</p>
        </div>
        <button className="btn-primary">
          <Plus className="w-4 h-4" />
          {t('newOrder')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('all'), value: stats.total, color: 'blue', icon: Receipt },
          { label: t('pending'), value: stats.pending, color: 'amber', icon: Clock },
          { label: t('dispensed'), value: stats.received, color: 'emerald', icon: CheckCircle },
          { label: t('total'), value: `${stats.totalValue.toLocaleString()} ${t('currency')}`, color: 'purple', icon: DollarSign },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="card p-4">
              <div className={`w-10 h-10 rounded-lg bg-${s.color}-50 flex items-center justify-center mb-2`}>
                <Icon className={`w-5 h-5 text-${s.color}-600`} />
              </div>
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          )
        })}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(order => (
          <div key={order.id} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">{order.number}</p>
                  <p className="text-xs text-gray-500">{isRTL ? order.supplier.name : order.supplier.nameEn}</p>
                </div>
              </div>
              <span className={`badge ${order.status === 'received' ? 'badge-success' : 'badge-warning'} text-xs`}>
                {order.status === 'received' ? t('dispensed') : t('pending')}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100">
              <div className="text-center">
                <p className="text-xs text-gray-500">{t('date')}</p>
                <p className="text-sm font-semibold">{order.date}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">{isRTL ? 'المنتجات' : 'Items'}</p>
                <p className="text-sm font-semibold">{order.items}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">{t('total')}</p>
                <p className="text-sm font-bold text-primary-600">{order.total.toLocaleString()}</p>
              </div>
            </div>

            <button className="btn-secondary w-full mt-3 text-xs">
              <Eye className="w-3 h-3" />
              {t('view')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Purchases
