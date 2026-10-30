import { useState, useMemo } from 'react'
import { useApp } from '../contexts/AppContext'
import {
  BarChart3, TrendingUp, DollarSign, Package, AlertTriangle,
  Calendar, Download, Printer, FileText, Receipt,
  TrendingDown, ArrowUpRight, ArrowDownRight, Coins, Percent, Wallet
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { getChartTheme, compactNumber } from '../lib/chartTheme'
import { exportToCSV, money } from '../lib/exportUtils'
import { printReport } from '../lib/print'

// =====================================================================
// صفحة التقارير — مؤشرات قابلة للقياس مبنية على بيانات الفواتير
//  * فلترة زمنية فعلية (اليوم/الأسبوع/الشهر/السنة/الكل) مع مقارنة
//    تلقائية بالفترة السابقة المماثلة (% تغير لكل مؤشر)
//  * تصدير CSV (UTF-8 + BOM يفتح سليماً في Excel) + طباعة A4/PDF
//  * جداول ورسوم متجاوبة مع الهاتف والحاسوب + تباين محسن
// =====================================================================

// نطاق الفترة المختارة + نطاق الفترة السابقة المماثلة (للمقارنة)
const getPeriodRange = (period) => {
  const now = new Date()
  const end = new Date(now)
  let start = new Date(now)
  let lengthDays = 1
  if (period === 'today') {
    start.setHours(0, 0, 0, 0)
  } else if (period === 'thisWeek') {
    const day = (now.getDay() + 6) % 7 // الإثنين بداية الأسبوع
    start.setDate(now.getDate() - day)
    start.setHours(0, 0, 0, 0)
    lengthDays = day + 1
  } else if (period === 'thisMonth') {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
    lengthDays = Math.max(1, Math.ceil((now - start) / 86400000))
  } else if (period === 'thisYear') {
    start = new Date(now.getFullYear(), 0, 1)
    lengthDays = Math.max(1, Math.ceil((now - start) / 86400000))
  } else {
    return { start: null, end: null, prevStart: null, prevEnd: null }
  }
  const prevEnd = new Date(start.getTime() - 1)
  const prevStart = new Date(start.getTime() - lengthDays * 86400000)
  return { start, end, prevStart, prevEnd }
}

const inRange = (sale, from, to) => {
  if (!from) return true
  const d = new Date(`${sale.date}T00:00:00`)
  return d >= from && d <= to
}

const pctChange = (current, previous) => {
  if (!previous || previous <= 0) return current > 0 ? 100 : null
  return ((current - previous) / previous) * 100
}

const truncate = (s, n) => (String(s || '').length > n ? `${String(s).slice(0, n - 1)}…` : String(s || ''))

const Reports = () => {
  const { t, isRTL, language, theme, salesData, productsData, categories, pickName, currentPharmacy } = useApp()
  const [activeReport, setActiveReport] = useState('sales')
  const [period, setPeriod] = useState('thisMonth')

  const chart = getChartTheme(theme)
  const L = (ar, fr, en) => (language === 'ar' ? ar : language === 'fr' ? fr : en)

  // ===== فلترة الفواتير حسب الفترة المختارة (كانت معطلة سابقاً) =====
  const range = useMemo(() => getPeriodRange(period), [period])
  const periodSales = useMemo(
    () => (range.start ? salesData.filter((s) => inRange(s, range.start, range.end)) : [...salesData]),
    [salesData, range]
  )
  const prevPeriodSales = useMemo(
    () => (range.prevStart ? salesData.filter((s) => inRange(s, range.prevStart, range.prevEnd)) : []),
    [salesData, range]
  )

  // ===== مؤشرات الفواتير (KPI) بدقة خانتين عشريتين =====
  const kpi = useMemo(() => {
    const sum = (arr, fn) => arr.reduce((acc, s) => acc + fn(s), 0)
    const invoiceCount = periodSales.length
    const prevCount = prevPeriodSales.length
    const grossSales = sum(periodSales, (s) => s.subtotal || 0)          // قبل الضريبة والخصم
    const totalDiscounts = sum(periodSales, (s) => s.discount || 0)
    const totalTax = sum(periodSales, (s) => s.tax || 0)
    const netRevenue = sum(periodSales, (s) => s.total || 0)             // المقبوضات فعلياً
    const avgInvoice = invoiceCount ? netRevenue / invoiceCount : 0
    const prevRevenue = sum(prevPeriodSales, (s) => s.total || 0)
    const prevAvg = prevCount ? prevRevenue / prevCount : 0
    const netSales = grossSales - totalDiscounts                          // صافي المبيعات بدون ضريبة
    return {
      invoiceCount, grossSales, totalDiscounts, totalTax, netRevenue, avgInvoice, netSales,
      changeCount: pctChange(invoiceCount, prevCount),
      changeRevenue: pctChange(netRevenue, prevRevenue),
      changeAvg: pctChange(avgInvoice, prevAvg),
    }
  }, [periodSales, prevPeriodSales])

  // ===== تكلفة البضاعة المباعة (COGS) والأرباح على مستوى الأصناف =====
  const costMap = useMemo(() => {
    const m = {}
    productsData.forEach((p) => { m[p.id] = p.cost || 0 })
    return m
  }, [productsData])

  const productStats = useMemo(() => {
    // حل اسم الدواء حسب لغة الواجهة (إصلاح الترجمة في الرسوم):
    // نبحث عن المنتج الأصلي في قاعدة البيانات (بمعرف productId) ونستعمل
    // pickName الذي يختار الاسم المناسب للغة (name/nameAr/nameFr/nameEn)،
    // وإن لم نجد المنتج نستعمل حقول سطر البيع نفسه بنفس سلسلة الأولويات.
    const resolveName = (item) => {
      const product = item.productId ? productsData.find((p) => p.id === item.productId) : null
      if (product) return pickName(product)
      if (language === 'ar') return item.name || item.nameAr || item.nameEn || item.nameFr || ''
      if (language === 'fr') return item.nameFr || item.nameEn || item.name || item.nameAr || ''
      return item.nameEn || item.nameFr || item.name || item.nameAr || ''
    }
    const map = {}
    periodSales.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        const key = item.productId || item.name
        if (!map[key]) map[key] = { name: resolveName(item), quantity: 0, revenue: 0, cost: 0 }
        map[key].quantity += item.quantity
        map[key].revenue += item.total ?? item.price * item.quantity
        map[key].cost += (costMap[item.productId] ?? 0) * item.quantity
      })
    })
    return Object.values(map).map((p) => ({
      ...p,
      profit: p.revenue - p.cost,
      margin: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0,
    })).sort((a, b) => b.revenue - a.revenue)
  }, [periodSales, costMap, productsData, pickName, language])

  const cogs = productStats.reduce((s, p) => s + p.cost, 0)
  const grossProfit = kpi.netSales - cogs
  const profitMargin = kpi.netSales > 0 ? (grossProfit / kpi.netSales) * 100 : 0
  const profitPerInvoice = kpi.invoiceCount ? grossProfit / kpi.invoiceCount : 0

  // ===== سلاسل الرسوم المبيانية =====
  const salesByDay = useMemo(() => {
    const byDay = {}
    periodSales.forEach((sale) => {
      if (!byDay[sale.date]) byDay[sale.date] = { date: sale.date, sales: 0, orders: 0 }
      byDay[sale.date].sales += sale.total
      byDay[sale.date].orders += 1
    })
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date))
  }, [periodSales])

  const paymentData = useMemo(() => {
    const methods = {}
    periodSales.forEach((sale) => {
      const m = sale.paymentMethod || 'other'
      methods[m] = (methods[m] || 0) + sale.total
    })
    // ترجمة طريقة الدفع: مفاتيح i18n (cash/card/transfer/insurance/on_delivery/other)
    // مع سقوط آمن على القيمة الخام إن ظهرت طريقة غير معروفة
    const label = (m) => (t(m) !== m ? t(m) : m)
    return Object.entries(methods).map(([name, value], i) => ({
      name: label(name),
      value: Math.round(value),
      color: chart.series[i % chart.series.length],
    }))
  }, [periodSales, t, chart])

  // ===== المخزون =====
  const inventory = useMemo(() => {
    const valueCost = productsData.reduce((s, p) => s + (p.stock || 0) * (p.cost || 0), 0)
    const valueRetail = productsData.reduce((s, p) => s + (p.stock || 0) * (p.price || 0), 0)
    const low = productsData.filter((p) => p.stock < p.minStock)
    const out = productsData.filter((p) => (p.stock || 0) <= 0)
    const daysTo = (p) => Math.floor((new Date(p.expiry) - new Date()) / 86400000)
    const expiring = productsData
      .filter((p) => { const d = daysTo(p); return d < 90 && d > 0 })
      .sort((a, b) => new Date(a.expiry) - new Date(b.expiry))
    const categoryValue = {}
    productsData.forEach((p) => {
      categoryValue[p.category] = (categoryValue[p.category] || 0) + (p.stock || 0) * (p.cost || 0)
    })
    const categoryData = Object.entries(categoryValue)
      .map(([id, value]) => {
        const cat = categories.find((c) => c.id === id)
        return { name: cat ? pickName(cat) : id, value: Math.round(value) }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
    return { valueCost, valueRetail, low, out, expiring, categoryData, daysTo }
  }, [productsData, categories, pickName])

  // ===== التبويبات =====
  const reports = [
    { id: 'sales', label: t('salesReport'), icon: TrendingUp, color: 'emerald' },
    { id: 'inventory', label: t('inventoryReport'), icon: Package, color: 'blue' },
    { id: 'profit', label: t('profitReport'), icon: DollarSign, color: 'purple' },
    { id: 'expiry', label: t('expiryReport'), icon: AlertTriangle, color: 'amber' },
  ]
  const activeMeta = reports.find((r) => r.id === activeReport) || reports[0]
  const periodLabel = { today: t('today'), thisWeek: t('thisWeek'), thisMonth: t('thisMonth'), thisYear: t('thisYear'), all: t('allPeriods') }[period]

  // ===== بطاقة مؤشر KPI =====
  const KpiCard = ({ icon: Icon, label, value, sub, change, chipClass }) => (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${chipClass}`}>
          <Icon className="w-[18px] h-[18px]" />
        </div>
        {change !== null && change !== undefined && (
          <span
            className={`flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
              change >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}
            title={t('vsPrevPeriod')}
          >
            {change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-xs sm:text-sm text-gray-600 font-medium leading-snug">{label}</p>
      <p className="text-lg sm:text-xl font-extrabold text-gray-900 mt-1 tabular-nums break-words">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )

  // ===== بيانات التصدير والطباعة حسب التبويب =====
  const getExportData = () => {
    if (activeReport === 'sales') {
      return {
        filename: 'sales-report',
        kpis: [
          [t('invoicesCount'), kpi.invoiceCount],
          [t('grossSales'), `${money(kpi.grossSales)} ${t('currency')}`],
          [t('totalDiscounts'), `${money(kpi.totalDiscounts)} ${t('currency')}`],
          [t('totalTax'), `${money(kpi.totalTax)} ${t('currency')}`],
          [t('netRevenue'), `${money(kpi.netRevenue)} ${t('currency')}`],
          [t('avgInvoice'), `${money(kpi.avgInvoice)} ${t('currency')}`],
        ],
        header: [t('invoiceNumber'), t('invoiceDate'), t('customer'), t('paymentMethod'), t('quantity'), t('grandTotal')],
        rows: [...periodSales]
          .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')))
          .slice(0, 100)
          .map((s) => [
            s.number,
            s.date,
            s.customer?.name || '-',
            s.paymentMethod,
            (s.items || []).reduce((n, i) => n + i.quantity, 0),
            Number(s.total || 0).toFixed(2),
          ]),
      }
    }
    if (activeReport === 'profit') {
      return {
        filename: 'profit-report',
        kpis: [
          [t('netSales'), `${money(kpi.netSales)} ${t('currency')}`],
          [t('cogs'), `${money(cogs)} ${t('currency')}`],
          [t('grossProfit'), `${money(grossProfit)} ${t('currency')}`],
          [t('profitMargin'), `${profitMargin.toFixed(1)}%`],
          [t('profitPerInvoice'), `${money(profitPerInvoice)} ${t('currency')}`],
        ],
        header: [t('description'), t('quantity'), t('netRevenue'), t('cogs'), t('grossProfit'), t('profitMargin')],
        rows: productStats.slice(0, 50).map((p) => [
          p.name,
          p.quantity,
          p.revenue.toFixed(2),
          p.cost.toFixed(2),
          p.profit.toFixed(2),
          `${p.margin.toFixed(1)}%`,
        ]),
      }
    }
    if (activeReport === 'inventory') {
      return {
        filename: 'inventory-report',
        kpis: [
          [t('totalProducts'), productsData.length],
          [t('inventoryValueCost'), `${money(inventory.valueCost)} ${t('currency')}`],
          [t('inventoryValueRetail'), `${money(inventory.valueRetail)} ${t('currency')}`],
          [t('lowStockItems'), inventory.low.length],
          [t('outOfStock'), inventory.out.length],
          [t('expiringSoon'), inventory.expiring.length],
        ],
        header: [t('description'), t('quantity'), t('minStock') || 'Min', t('unitCost'), t('salePrice'), t('stockValue')],
        rows: [...productsData]
          .sort((a, b) => (b.stock * b.cost || 0) - (a.stock * a.cost || 0))
          .slice(0, 100)
          .map((p) => [
            pickName(p) || p.name,
            p.stock,
            p.minStock,
            Number(p.cost || 0).toFixed(2),
            Number(p.price || 0).toFixed(2),
            (p.stock * p.cost || 0).toFixed(2),
          ]),
      }
    }
    return {
      filename: 'expiry-report',
      kpis: [
        [t('expiringIn30'), inventory.expiring.filter((p) => inventory.daysTo(p) <= 30).length],
        [t('expiringSoon'), inventory.expiring.length],
        [t('outOfStock'), inventory.out.length],
      ],
      header: [t('description'), t('expiryDate') || 'Expiry', t('days'), t('quantity')],
      rows: inventory.expiring.slice(0, 100).map((p) => [
        pickName(p) || p.name,
        p.expiry,
        inventory.daysTo(p),
        p.stock,
      ]),
    }
  }
  const exportData = getExportData()

  const handleExportCSV = () => {
    exportToCSV(exportData.filename, [exportData.header, ...exportData.rows])
  }

  const pharmacyName = currentPharmacy ? pickName(currentPharmacy) : t('allPharmacies')

  return (
    <div className="space-y-6">
      {/* ===== الترويسة + الفترة + التصدير ===== */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary-600" />
            {t('reports')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {L('تحليلات وإحصائيات مبنية على الفواتير', 'Analyses et statistiques basées sur les factures', 'Invoice-based analytics & statistics')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Calendar className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="input ps-9 py-2 text-sm"
              aria-label={t('reportPeriod')}
            >
              <option value="today">{t('today')}</option>
              <option value="thisWeek">{t('thisWeek')}</option>
              <option value="thisMonth">{t('thisMonth')}</option>
              <option value="thisYear">{t('thisYear')}</option>
              <option value="all">{t('allPeriods')}</option>
            </select>
          </div>
          <button onClick={handleExportCSV} className="btn-secondary text-sm">
            <Download className="w-4 h-4" />
            {t('exportCSV')}
          </button>
          <button onClick={printReport} className="btn-primary text-sm">
            <Printer className="w-4 h-4" />
            {t('printReport')}
          </button>
        </div>
      </div>

      {/* ===== التبويبات ===== */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {reports.map((report) => {
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

      {/* ===== 1) تقرير المبيعات ===== */}
      {activeReport === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard icon={Receipt} label={t('invoicesCount')} value={kpi.invoiceCount} change={kpi.changeCount} chipClass="bg-emerald-50 text-emerald-600" />
            <KpiCard icon={Coins} label={t('grossSales')} value={money(kpi.grossSales)} sub={t('currency')} chipClass="bg-blue-50 text-blue-600" />
            <KpiCard icon={Percent} label={t('totalDiscounts')} value={money(kpi.totalDiscounts)} sub={t('currency')} chipClass="bg-purple-50 text-purple-600" />
            <KpiCard icon={FileText} label={t('totalTax')} value={money(kpi.totalTax)} sub={t('currency')} chipClass="bg-amber-50 text-amber-600" />
            <KpiCard icon={Wallet} label={t('netRevenue')} value={money(kpi.netRevenue)} sub={t('currency')} change={kpi.changeRevenue} chipClass="bg-emerald-50 text-emerald-600" />
            <KpiCard icon={DollarSign} label={t('avgInvoice')} value={money(kpi.avgInvoice)} sub={t('currency')} change={kpi.changeAvg} chipClass="bg-blue-50 text-blue-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* المبيعات اليومية */}
            <div className="card p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4">{t('dailySales')}</h3>
              <div className="h-60 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} />
                    <XAxis dataKey="date" stroke={chart.axisColor} fontSize={11} tickLine={false} tickFormatter={(d) => d.slice(5)} />
                    <YAxis stroke={chart.axisColor} fontSize={11} tickLine={false} width={48} tickFormatter={compactNumber} />
                    <Tooltip contentStyle={chart.tooltipStyle} itemStyle={chart.tooltipItemStyle} formatter={(v) => money(v)} />
                    <Line type="monotone" dataKey="sales" name={t('netRevenue')} stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* طرق الدفع */}
            <div className="card p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4">{t('paymentMethods')}</h3>
              {paymentData.length === 0 ? (
                <p className="text-sm text-gray-500 py-12 text-center">{t('noInvoicesPeriod')}</p>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-full sm:w-1/2 h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie data={paymentData} cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={2} dataKey="value">
                          {paymentData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={chart.tooltipStyle} itemStyle={chart.tooltipItemStyle} formatter={(v) => money(v)} />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full sm:w-1/2 grid grid-cols-1 gap-2">
                    {paymentData.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                        <span className="flex-1 text-gray-700 font-medium truncate">{entry.name}</span>
                        <span className="font-bold text-gray-900 tabular-nums">{money(entry.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* الأدوية الأكثر مبيعاً */}
          <div className="card p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4">{t('topSellingProducts')}</h3>
            <div className="h-72 sm:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productStats.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} />
                  <XAxis type="number" stroke={chart.axisColor} fontSize={11} tickLine={false} tickFormatter={compactNumber} />
                  <YAxis type="category" dataKey="name" stroke={chart.axisColor} fontSize={11} width={120} tickFormatter={(s) => truncate(s, 14)} />
                  <Tooltip contentStyle={chart.tooltipStyle} itemStyle={chart.tooltipItemStyle} formatter={(v) => money(v)} />
                  <Bar dataKey="revenue" name={t('netRevenue')} fill="#10b981" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* أحدث الفواتير */}
          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">{t('recentInvoices')}</h3>
              <span className="badge-gray">{kpi.invoiceCount}</span>
            </div>
            {periodSales.length === 0 ? (
              <p className="text-sm text-gray-500 py-10 text-center">{t('noInvoicesPeriod')}</p>
            ) : (
              <>
                {/* جدول — الحاسوب */}
                <div className="hidden md:block table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('invoiceNumber')}</th>
                        <th>{t('invoiceDate')}</th>
                        <th>{t('customer')}</th>
                        <th>{t('paymentMethod')}</th>
                        <th>{t('quantity')}</th>
                        <th>{t('grandTotal')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...periodSales]
                        .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')))
                        .slice(0, 25)
                        .map((s) => (
                          <tr key={s.id}>
                            <td className="font-semibold text-primary-700">{s.number}</td>
                            <td>{s.date}{s.time ? ` • ${s.time}` : ''}</td>
                            <td className="max-w-[180px] truncate">{s.customer?.name || '-'}</td>
                            <td>{t(s.paymentMethod) !== s.paymentMethod ? t(s.paymentMethod) : s.paymentMethod}</td>
                            <td>{(s.items || []).reduce((n, i) => n + i.quantity, 0)}</td>
                            <td className="font-bold tabular-nums">{money(s.total)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {/* بطاقات — الهاتف */}
                <div className="md:hidden space-y-2">
                  {[...periodSales]
                    .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')))
                    .slice(0, 15)
                    .map((s) => (
                      <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                        <div className="w-9 h-9 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900">{s.number}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {s.date} • {s.customer?.name || '-'} • {t(s.paymentMethod) !== s.paymentMethod ? t(s.paymentMethod) : s.paymentMethod}
                          </p>
                        </div>
                        <p className="text-sm font-extrabold text-gray-900 tabular-nums">{money(s.total)}</p>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== 2) تقرير المخزون ===== */}
      {activeReport === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard icon={Package} label={t('totalProducts')} value={productsData.length} chipClass="bg-blue-50 text-blue-600" />
            <KpiCard icon={Coins} label={t('inventoryValueCost')} value={money(inventory.valueCost)} sub={t('currency')} chipClass="bg-emerald-50 text-emerald-600" />
            <KpiCard icon={Wallet} label={t('inventoryValueRetail')} value={money(inventory.valueRetail)} sub={t('currency')} chipClass="bg-emerald-50 text-emerald-600" />
            <KpiCard icon={AlertTriangle} label={t('lowStockItems')} value={inventory.low.length} chipClass="bg-amber-50 text-amber-600" />
            <KpiCard icon={TrendingDown} label={t('outOfStock')} value={inventory.out.length} chipClass="bg-red-50 text-red-600" />
            <KpiCard icon={Calendar} label={t('expiringSoon')} value={inventory.expiring.length} chipClass="bg-red-50 text-red-600" />
          </div>

          <div className="card p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4">
              {L('قيمة المخزون حسب الفئة', 'Valeur du stock par catégorie', 'Inventory value by category')}
            </h3>
            <div className="h-72 sm:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventory.categoryData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} />
                  <XAxis dataKey="name" stroke={chart.axisColor} fontSize={11} tickLine={false} interval={0} angle={-30} textAnchor="end" height={60} tickFormatter={(s) => truncate(s, 12)} />
                  <YAxis stroke={chart.axisColor} fontSize={11} tickLine={false} width={52} tickFormatter={compactNumber} />
                  <Tooltip contentStyle={chart.tooltipStyle} itemStyle={chart.tooltipItemStyle} formatter={(v) => money(v)} />
                  <Bar dataKey="value" name={t('inventoryValueCost')} fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* أصناف منخفضة المخزون */}
          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">{t('lowStockItems')}</h3>
              <span className="badge-warning">{inventory.low.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {inventory.low.slice(0, 10).map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-xl flex-shrink-0">{p.image || '💊'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-900 truncate">{pickName(p) || p.name}</p>
                    <p className="text-xs text-amber-700">
                      {L(`المتوفر: ${p.stock} • الحد الأدنى: ${p.minStock}`, `Disponible : ${p.stock} • Min : ${p.minStock}`, `Available: ${p.stock} • Min: ${p.minStock}`)}
                    </p>
                  </div>
                </div>
              ))}
              {inventory.low.length === 0 && (
                <p className="text-sm text-gray-500 py-6 text-center sm:col-span-2">{t('noData')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== 3) تقرير الأرباح ===== */}
      {activeReport === 'profit' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard icon={Coins} label={t('netSales')} value={money(kpi.netSales)} sub={t('currency')} chipClass="bg-blue-50 text-blue-600" />
            <KpiCard icon={Package} label={t('cogs')} value={money(cogs)} sub={t('currency')} chipClass="bg-amber-50 text-amber-600" />
            <KpiCard icon={DollarSign} label={t('grossProfit')} value={money(grossProfit)} sub={t('currency')} chipClass="bg-emerald-50 text-emerald-600" />
            <KpiCard icon={Percent} label={t('profitMargin')} value={`${profitMargin.toFixed(1)}%`} chipClass="bg-purple-50 text-purple-600" />
            <KpiCard icon={Receipt} label={t('profitPerInvoice')} value={money(profitPerInvoice)} sub={t('currency')} chipClass="bg-emerald-50 text-emerald-600" />
            <KpiCard icon={Wallet} label={t('netRevenue')} value={money(kpi.netRevenue)} sub={t('currency')} chipClass="bg-blue-50 text-blue-600" />
          </div>

          <div className="card p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4">{t('mostProfitable')}</h3>
            {productStats.length === 0 ? (
              <p className="text-sm text-gray-500 py-10 text-center">{t('noInvoicesPeriod')}</p>
            ) : (
              <div className="space-y-3">
                {productStats.slice(0, 10).map((product, i) => {
                  const max = productStats[0]?.revenue || 1
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-6 text-sm font-bold text-gray-600 flex-shrink-0">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-bold text-gray-900 truncate">{product.name}</span>
                          <span className="text-sm font-extrabold text-primary-700 tabular-nums whitespace-nowrap">
                            {money(product.profit)} {t('currency')}
                            <span className="text-xs font-semibold text-gray-500 ms-1">({product.margin.toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full"
                            style={{ width: `${Math.max(4, (product.revenue / max) * 100)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
                          <span>{t('quantity')}: {product.quantity}</span>
                          <span className="tabular-nums">{t('netRevenue')}: {money(product.revenue)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== 4) تقرير الصلاحية ===== */}
      {activeReport === 'expiry' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={AlertTriangle} label={t('expiringIn30')} value={inventory.expiring.filter((p) => inventory.daysTo(p) <= 30).length} chipClass="bg-red-50 text-red-600" />
            <KpiCard icon={Calendar} label={L('خلال 60 يوم', 'Sous 60 jours', 'Within 60 days')} value={inventory.expiring.filter((p) => inventory.daysTo(p) > 30 && inventory.daysTo(p) <= 60).length} chipClass="bg-amber-50 text-amber-600" />
            <KpiCard icon={Calendar} label={L('خلال 90 يوم', 'Sous 90 jours', 'Within 90 days')} value={inventory.expiring.filter((p) => inventory.daysTo(p) > 60).length} chipClass="bg-amber-50 text-amber-600" />
            <KpiCard icon={TrendingDown} label={t('outOfStock')} value={inventory.out.length} chipClass="bg-red-50 text-red-600" />
          </div>

          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">
                {L('الأدوية قاربت على الانتهاء', 'Produits proche de la péremption', 'Products expiring soon')}
              </h3>
              <span className="badge-danger">{inventory.expiring.length} {L('منتج', 'produits', 'products')}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {inventory.expiring.slice(0, 16).map((product) => {
                const days = inventory.daysTo(product)
                return (
                  <div key={product.id} className={`flex items-center gap-3 p-3 rounded-xl border ${days <= 30 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="w-10 h-10 rounded-lg bg-white/70 flex items-center justify-center text-xl flex-shrink-0">
                      {product.image || '💊'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${days <= 30 ? 'text-red-900' : 'text-amber-900'}`}>
                        {pickName(product) || product.name}
                      </p>
                      <p className={`text-xs ${days <= 30 ? 'text-red-700' : 'text-amber-700'}`}>
                        {product.manufacturer} • {product.stock} {L('وحدة', 'unités', 'units')}
                      </p>
                    </div>
                    <div className="text-end flex-shrink-0">
                      <span className={`badge ${days <= 30 ? 'badge-danger' : 'badge-warning'} text-xs`}>
                        {days} {t('days')}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">{product.expiry}</p>
                    </div>
                  </div>
                )
              })}
              {inventory.expiring.length === 0 && (
                <p className="text-sm text-gray-500 py-6 text-center sm:col-span-2">{t('noData')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== منطقة طباعة التقرير A4 (لا تظهر على الشاشة — فقط عند الطباعة) ===== */}
      <div className="report-print-area" dir={isRTL ? 'rtl' : 'ltr'}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid #111827', paddingBottom: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{pharmacyName}</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{activeMeta.label}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {t('reportPeriod')}: {periodLabel} • {t('generatedOn')}: {new Date().toLocaleString(isRTL ? 'ar-MA' : language === 'fr' ? 'fr-FR' : 'en-GB')} • {t('currency')}: MAD
          </div>
        </div>
        <table style={{ width: '100%', fontSize: 12, marginBottom: 16 }}>
          <tbody>
            {[0, 1, 2, 3, 4, 5].filter((i) => exportData.kpis[i]).reduce((acc, i) => {
              if (i % 2 === 0) acc.push([exportData.kpis[i], exportData.kpis[i + 1]])
              return acc
            }, []).map((pair, idx) => (
              <tr key={idx}>
                {pair.filter(Boolean).map((k, j) => (
                  <td key={j} style={j % 2 === 0 ? { fontWeight: 700, background: '#f9fafb' } : { fontWeight: 800, textAlign: 'start' }}>
                    {k[0]}
                  </td>
                ))}
                {pair.length === 1 && <td />}
              </tr>
            ))}
          </tbody>
        </table>
        <table style={{ width: '100%', fontSize: 11 }}>
          <thead>
            <tr>
              {exportData.header.map((h) => (
                <th key={h} style={{ background: '#f3f4f6', fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exportData.rows.slice(0, 40).map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: 'center', fontSize: 10, color: '#6b7280', marginTop: 16 }}>
          {t('appName')} — {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}

export default Reports
