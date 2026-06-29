import { useState } from 'react'
import { useApp } from '../contexts/AppContext'
import {
  BarChart3, TrendingUp, DollarSign, Package, AlertTriangle,
  Calendar, Download, FileText, PieChart, Activity
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const Reports = () => {
  const { t, isRTL, salesData, productsData, categories, prescriptionsData, customersData } = useApp()
  const [activeReport, setActiveReport] = useState('sales')
  const [period, setPeriod] = useState('thisMonth')

  // Sales report data
  const salesByDay = {}
  salesData.forEach(sale => {
    if (!salesByDay[sale.date]) salesByDay[sale.date] = { date: sale.date, sales: 0, orders: 0 }
    salesByDay[sale.date].sales += sale.total
    salesByDay[sale.date].orders += 1
  })
  const salesChartData = Object.values(salesByDay).sort((a, b) => a.date.localeCompare(b.date)).slice(-14)

  // Payment methods distribution
  const paymentMethods = {}
  salesData.forEach(sale => {
    if (!paymentMethods[sale.paymentMethod]) paymentMethods[sale.paymentMethod] = 0
    paymentMethods[sale.paymentMethod] += sale.total
  })
  const paymentData = Object.entries(paymentMethods).map(([name, value]) => ({
    name: t(name),
    value: Math.round(value)
  }))
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6']

  // Top products by revenue
  const productSales = {}
  salesData.forEach(sale => {
    sale.items.forEach(item => {
      if (!productSales[item.productId]) {
        productSales[item.productId] = { name: item.name, quantity: 0, revenue: 0 }
      }
      productSales[item.productId].quantity += item.quantity
      productSales[item.productId].revenue += item.total
    })
  })
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // Inventory value by category
  const categoryValue = {}
  productsData.forEach(p => {
    if (!categoryValue[p.category]) categoryValue[p.category] = 0
    categoryValue[p.category] += p.stock * p.cost
  })
  const categoryData = Object.entries(categoryValue).map(([id, value]) => {
    const cat = categories.find(c => c.id === id)
    return { name: isRTL ? cat?.name : cat?.nameEn, value: Math.round(value) }
  })

  // Profit calculation
  const totalRevenue = salesData.reduce((sum, s) => sum + s.total, 0)
  const totalProfit = salesData.reduce((sum, s) => {
    return sum + s.items.reduce((p, item) => {
      const product = productsData.find(p => p.id === item.productId)
      return p + (product ? (item.price - product.cost) * item.quantity : 0)
    }, 0)
  }, 0)
  const profitMargin = ((totalProfit / totalRevenue) * 100).toFixed(1)

  const expiringProducts = productsData.filter(p => {
    const days = Math.floor((new Date(p.expiry) - new Date()) / (1000 * 60 * 60 * 24))
    return days < 90 && days > 0
  }).sort((a, b) => new Date(a.expiry) - new Date(b.expiry))

  const reports = [
    { id: 'sales', label: t('salesReport'), icon: TrendingUp, color: 'emerald' },
    { id: 'inventory', label: t('inventoryReport'), icon: Package, color: 'blue' },
    { id: 'profit', label: t('profitReport'), icon: DollarSign, color: 'purple' },
    { id: 'expiry', label: t('expiryReport'), icon: AlertTriangle, color: 'amber' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary-600" />
            {t('reports')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">{isRTL ? 'تحليلات وإحصائيات' : 'Analytics & Statistics'}</p>
        </div>
        <div className="flex gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="input">
            <option value="today">{t('today')}</option>
            <option value="thisWeek">{t('thisWeek')}</option>
            <option value="thisMonth">{t('thisMonth')}</option>
            <option value="thisYear">{t('thisYear')}</option>
          </select>
          <button className="btn-secondary">
            <Download className="w-4 h-4" />
            {t('export')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {reports.map(report => {
          const Icon = report.icon
          const active = activeReport === report.id
          return (
            <button
              key={report.id}
              onClick={() => setActiveReport(report.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap font-medium transition-all ${
                active
                  ? `bg-${report.color}-600 text-white shadow-md`
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {report.label}
            </button>
          )
        })}
      </div>

      {/* Sales Report */}
      {activeReport === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: isRTL ? 'إجمالي المبيعات' : 'Total Sales', value: `${totalRevenue.toLocaleString()} ${t('currency')}`, color: 'emerald' },
              { label: isRTL ? 'عدد الطلبات' : 'Orders', value: salesData.length, color: 'blue' },
              { label: isRTL ? 'متوسط الطلب' : 'Avg Order', value: `${(totalRevenue / salesData.length).toFixed(0)} ${t('currency')}`, color: 'purple' },
              { label: isRTL ? 'العملاء' : 'Customers', value: customersData.length, color: 'amber' },
            ].map((kpi, i) => (
              <div key={i} className="card p-5">
                <p className="text-sm text-gray-500">{kpi.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="text-lg font-bold mb-4">{isRTL ? 'المبيعات اليومية' : 'Daily Sales'}</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
                  <YAxis stroke="#9ca3af" fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-6">
              <h3 className="text-lg font-bold mb-4">{isRTL ? 'طرق الدفع' : 'Payment Methods'}</h3>
              <ResponsiveContainer width="100%" height={280}>
                <RePieChart>
                  <Pie data={paymentData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" label>
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-bold mb-4">{t('topSellingProducts')}</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topProducts.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" stroke="#9ca3af" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={11} width={120} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Inventory Report */}
      {activeReport === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: t('totalProducts'), value: productsData.length, color: 'blue' },
              { label: isRTL ? 'قيمة المخزون' : 'Stock Value', value: `${productsData.reduce((s, p) => s + p.stock * p.cost, 0).toLocaleString()} ${t('currency')}`, color: 'emerald' },
              { label: t('lowStockItems'), value: productsData.filter(p => p.stock < p.minStock).length, color: 'amber' },
              { label: t('expiringSoon'), value: expiringProducts.length, color: 'red' },
            ].map((kpi, i) => (
              <div key={i} className="card p-5">
                <p className="text-sm text-gray-500">{kpi.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-bold mb-4">{isRTL ? 'قيمة المخزون حسب الفئة' : 'Inventory Value by Category'}</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
                <YAxis stroke="#9ca3af" fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Profit Report */}
      {activeReport === 'profit' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: isRTL ? 'إجمالي الإيرادات' : 'Revenue', value: `${totalRevenue.toLocaleString()} ${t('currency')}`, color: 'emerald' },
              { label: isRTL ? 'إجمالي الأرباح' : 'Profit', value: `${totalProfit.toLocaleString()} ${t('currency')}`, color: 'blue' },
              { label: isRTL ? 'هامش الربح' : 'Margin', value: `${profitMargin}%`, color: 'purple' },
            ].map((kpi, i) => (
              <div key={i} className="card p-5">
                <p className="text-sm text-gray-500">{kpi.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-bold mb-4">{isRTL ? 'الأدوية الأكثر ربحية' : 'Most Profitable Products'}</h3>
            <div className="space-y-2">
              {topProducts.slice(0, 10).map((product, i) => {
                const max = topProducts[0]?.revenue || 1
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-6 text-sm font-bold text-gray-500">#{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-900">{product.name}</span>
                        <span className="text-sm font-bold text-primary-600">{product.revenue.toLocaleString()} {t('currency')}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full" style={{ width: `${(product.revenue / max) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Expiry Report */}
      {activeReport === 'expiry' && (
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{isRTL ? 'الأدوية قاربت على الانتهاء' : 'Products Expiring Soon'}</h3>
              <span className="badge-danger">{expiringProducts.length} {isRTL ? 'منتج' : 'products'}</span>
            </div>
            <div className="space-y-2">
              {expiringProducts.slice(0, 15).map(product => {
                const days = Math.floor((new Date(product.expiry) - new Date()) / (1000 * 60 * 60 * 24))
                const urgency = days < 30 ? 'red' : days < 60 ? 'amber' : 'yellow'
                return (
                  <div key={product.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center text-xl">
                      {product.image}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{isRTL ? product.name : product.nameEn}</p>
                      <p className="text-xs text-gray-500">{product.manufacturer} • {product.stock} {isRTL ? 'وحدة' : 'units'}</p>
                    </div>
                    <div className="text-end">
                      <span className={`badge ${urgency === 'red' ? 'badge-danger' : urgency === 'amber' ? 'badge-warning' : 'badge-warning'} text-xs`}>
                        {days} {t('days')}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">{product.expiry}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Reports
