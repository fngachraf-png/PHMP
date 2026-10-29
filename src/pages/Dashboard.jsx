import { useApp } from '../contexts/AppContext'
import {
  TrendingUp, TrendingDown, DollarSign, Package, Users, AlertTriangle,
  Calendar, ShoppingBag, ArrowUp, ArrowDown, Clock, CheckCircle2,
  Activity, Heart, Pill, Stethoscope
} from 'lucide-react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { getChartTheme } from '../lib/chartTheme'
import { Link } from 'react-router-dom'

const Dashboard = () => {
  const { t, isRTL, productsData, salesData, customersData, prescriptionsData, currentPharmacy , pickName, language, theme} = useApp()
  const chart = getChartTheme(theme)

  // Calculate KPIs
  const today = new Date().toISOString().split('T')[0]
  const todaySales = salesData.filter(s => s.date === today)
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0)

  const lowStockProducts = productsData.filter(p => p.stock < p.minStock)
  const expiringProducts = productsData.filter(p => {
    const days = Math.floor((new Date(p.expiry) - new Date()) / (1000 * 60 * 60 * 24))
    return days < 90 && days > 0
  })

  const totalProducts = productsData.length
  const totalCustomers = customersData.length

  const KPIS = [
    {
      label: t('todaySales'),
      value: `${todayRevenue.toFixed(2)} ${t('currency')}`,
      change: '+12.5%',
      changeType: 'up',
      icon: DollarSign,
      color: 'emerald',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600'
    },
    {
      label: t('totalProducts'),
      value: totalProducts,
      change: '+3',
      changeType: 'up',
      icon: Package,
      color: 'blue',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600'
    },
    {
      label: t('totalCustomers'),
      value: totalCustomers,
      change: '+8.2%',
      changeType: 'up',
      icon: Users,
      color: 'purple',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600'
    },
    {
      label: t('lowStockItems'),
      value: lowStockProducts.length,
      change: lowStockProducts.length > 0 ? t('attention') : t('good'),
      changeType: lowStockProducts.length > 0 ? 'down' : 'up',
      icon: AlertTriangle,
      color: 'amber',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600'
    }
  ]

  // Top selling products
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
    .slice(0, 5)
    .map((p, i) => ({
      name: pickName(p).split(' ')[0],
      revenue: p.revenue,
      quantity: p.quantity,
      rank: i + 1
    }))

  // Category distribution for pie chart
  const categoryData = {}
  productsData.forEach(p => {
    if (!categoryData[p.category]) categoryData[p.category] = 0
    categoryData[p.category] += p.stock * p.cost
  })

  const pieData = Object.entries(categoryData).slice(0, 6).map(([name, value]) => ({
    name: name,
    value: Math.round(value)
  }))

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  // Weekly sales chart
  const weeklyData = [
    { day: language === 'ar' ? 'الإثنين' : language === 'fr' ? 'Lun' : 'Mon', sales: 8500 },
    { day: language === 'ar' ? 'الثلاثاء' : language === 'fr' ? 'Mar' : 'Tue', sales: 9200 },
    { day: language === 'ar' ? 'الأربعاء' : language === 'fr' ? 'Mer' : 'Wed', sales: 7800 },
    { day: language === 'ar' ? 'الخميس' : language === 'fr' ? 'Jeu' : 'Thu', sales: 10100 },
    { day: language === 'ar' ? 'الجمعة' : language === 'fr' ? 'Ven' : 'Fri', sales: 11500 },
    { day: language === 'ar' ? 'السبت' : language === 'fr' ? 'Sam' : 'Sat', sales: 12300 },
    { day: language === 'ar' ? 'الأحد' : language === 'fr' ? 'Dim' : 'Sun', sales: 9800 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{t('dashboard')}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {pickName(currentPharmacy)} • {new Date().toLocaleDateString(language === 'ar' ? 'ar-MA' : language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/pos" className="btn-primary">
            <ShoppingBag className="w-4 h-4" />
            {t('newSale')}
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {KPIS.map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <div key={i} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl ${kpi.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${kpi.textColor}`} />
                </div>
                <span className={`flex items-center gap-1 text-xs font-semibold ${kpi.changeType === 'up' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {kpi.changeType === 'up' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  {kpi.change}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
              <p className="text-sm text-gray-600 mt-1">{kpi.label}</p>
            </div>
          )
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales trend */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{t('salesTrend')}</h3>
              <p className="text-sm text-gray-500">{t('weeklySales')}</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-semibold">+15.3%</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} />
              <XAxis dataKey="day" stroke={chart.axisColor} fontSize={12} tickLine={false} />
              <YAxis stroke={chart.axisColor} fontSize={12} tickLine={false} />
              <Tooltip
                contentStyle={chart.tooltipStyle}
                itemStyle={chart.tooltipItemStyle}
              />
              <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={2} fill="url(#colorSales)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category distribution */}
        <div className="card p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-1">{language === 'ar' ? 'توزيع الفئات' : language === 'fr' ? 'Répartition par catégorie' : 'Categories'}</h3>
          <p className="text-sm text-gray-500 mb-4">{language === 'ar' ? 'حسب قيمة المخزون' : language === 'fr' ? 'Par valeur de stock' : 'By inventory value'}</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={chart.tooltipStyle} itemStyle={chart.tooltipItemStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {pieData.slice(0, 4).map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                <span className="text-gray-700 truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lists row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top selling products */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">{t('topSellingProducts')}</h3>
            <Activity className="w-5 h-5 text-primary-600" />
          </div>
          <div className="space-y-3">
            {topProducts.map((product, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                  i === 0 ? 'bg-amber-100 text-amber-700' :
                  i === 1 ? 'bg-gray-100 text-gray-700' :
                  i === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-blue-50 text-blue-700'
                }`}>
                  #{product.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.quantity} {language === 'ar' ? 'وحدة' : language === 'fr' ? 'unités' : 'units'}</p>
                </div>
                <p className="text-sm font-bold text-primary-600">{product.revenue.toFixed(0)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">{t('alerts')}</h3>
            <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-full">
              {lowStockProducts.length + expiringProducts.length}
            </span>
          </div>
          <div className="space-y-3">
            {lowStockProducts.slice(0, 3).map((product) => (
              <div key={`low-${product.id}`} className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-900">{pickName(product).split(' ')[0]}</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {language === 'ar' ? `مخزون منخفض: ${product.stock} (الحد الأدنى ${product.minStock})` : language === 'fr' ? `Stock faible : ${product.stock} (min ${product.minStock})` : `Low stock: ${product.stock} (min ${product.minStock})`}
                  </p>
                </div>
              </div>
            ))}
            {expiringProducts.slice(0, 2).map((product) => {
              const days = Math.floor((new Date(product.expiry) - new Date()) / (1000 * 60 * 60 * 24))
              return (
                <div key={`exp-${product.id}`} className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                  <Clock className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-900">{pickName(product).split(' ')[0]}</p>
                    <p className="text-xs text-red-700 mt-0.5">
                      {language === 'ar' ? `ينتهي خلال ${days} يوم` : language === 'fr' ? `Expire dans ${days} jours` : `Expires in ${days} days`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent sales */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">{t('recentSales')}</h3>
            <CheckCircle2 className="w-5 h-5 text-primary-600" />
          </div>
          <div className="space-y-3">
            {salesData.slice(0, 5).map((sale) => (
              <div key={sale.id} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                  <Pill className="w-4 h-4 text-primary-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {sale.customer?.name || (isRTL ? 'عميل عابر' : 'Walk-in')}
                  </p>
                  <p className="text-xs text-gray-500">{sale.number}</p>
                </div>
                <div className="text-end">
                  <p className="text-sm font-bold text-gray-900">{sale.total.toFixed(0)}</p>
                  <p className="text-xs text-gray-500">{sale.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
