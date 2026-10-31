import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, FileText, Users, Truck,
  Receipt, BarChart3, Settings, LogOut, Menu, X, Bell,
  Scale, Crown, Building2, Wifi, WifiOff, Home, Inbox
} from 'lucide-react'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useApp } from '../contexts/AppContext'
import { ROLE_INFO } from '../config/permissions'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeToggle from './ThemeToggle'
import SmartAvatar, { isImage } from './SmartAvatar'
import PlatformLogo, { PlatformWatermark } from './PlatformLogo'
import StaffComms from './calls/StaffComms'

const Sidebar = ({ isOpen, onClose }) => {
  const { t, isRTL, currentPharmacy, currentUser, logout, language, hasPermission, isSuperAdmin, activePharmacyId, switchPharmacy, pharmaciesData, serverStatus, visibleOrders, pickName } = useApp()
  const location = useLocation()

  // عدد الطلبات المعلقة (شارة القائمة الجانبية)
  const pendingOrdersCount = useMemo(
    () => visibleOrders.filter(o => o.status === 'pending').length,
    [visibleOrders]
  )

  const menuItems = [
    { path: '/platform', icon: Crown, label: t('platform'), permission: 'platform.manage', superOnly: true },
    { path: '/dashboard', icon: LayoutDashboard, label: t('dashboard'), permission: 'dashboard.view' },
    { path: '/pos', icon: ShoppingCart, label: t('pos'), permission: 'pos.use' },
    { path: '/orders', icon: Inbox, label: t('liveOrders'), permission: 'orders.view', badge: pendingOrdersCount },
    { path: '/inventory', icon: Package, label: t('inventory'), permission: 'inventory.view' },
    { path: '/prescriptions', icon: FileText, label: t('prescriptions'), permission: 'prescriptions.view' },
    { path: '/customers', icon: Users, label: t('customers'), permission: 'customers.view' },
    { path: '/suppliers', icon: Truck, label: t('suppliers'), permission: 'suppliers.view' },
    { path: '/purchases', icon: Receipt, label: t('purchases'), permission: 'purchases.view' },
    { path: '/reports', icon: BarChart3, label: t('reports'), permission: 'reports.view' },
    { path: '/legal', icon: Scale, label: t('legalRef'), permission: 'legal.view' },
    { path: '/settings', icon: Settings, label: t('settings'), permission: 'settings.view' },
  ].filter(item => hasPermission(item.permission))

  const isActive = (path) => location.pathname === path

  const roleLabel = (role) => {
    const info = ROLE_INFO[role]
    if (!info) return role
    if (language === 'fr') return info.fr || info.en
    if (language === 'en') return info.en
    return info.ar
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed top-0 ${isRTL ? 'right-0' : 'left-0'} h-full w-72 bg-white border-${isRTL ? 'l' : 'r'} border-gray-200 z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full'}
        lg:translate-x-0 flex flex-col
      `}>
        {/* لوغو المنصة الرسمي (يتبدل حسب الوضع الفاتح/القاتم) */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200">
          <PlatformLogo size={46} withFrame alt="PHMP" />
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">{t('appShortName')}</h1>
            <p className="text-xs text-gray-500">{currentPharmacy ? pickName(currentPharmacy) : (isSuperAdmin ? t('allPharmacies') : 'Pharmacy System')}</p>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 rounded-lg hover:bg-gray-100" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pharmacy selector for super admin */}
        {isSuperAdmin && (
          <div className="px-4 py-3 border-b border-gray-200">
            <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {language === 'ar' ? 'الصيدلية النشطة' : language === 'fr' ? 'Pharmacie active' : 'Active Pharmacy'}
            </label>
            <select
              value={activePharmacyId || 'all'}
              onChange={(e) => switchPharmacy(e.target.value)}
              className="input py-1.5 text-sm"
            >
              <option value="all">👑 {t('allPharmacies')}</option>
              {pharmaciesData.map(ph => (
                <option key={ph.id} value={ph.id}>{isImage(ph.logo) ? '🏥' : ph.logo} {pickName(ph)}</option>
              ))}
            </select>
          </div>
        )}

        {/* Pharmacy info card (non-super-admin) */}
        {currentPharmacy && !isSuperAdmin && (
          <div className="px-4 py-4 border-b border-gray-200">
            <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <SmartAvatar value={currentPharmacy.logo} alt={pickName(currentPharmacy)} size={34} rounded="rounded-lg" fallback="💊" textClass="text-2xl" className="bg-white" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">
                    {pickName(currentPharmacy)}
                  </p>
                  <p className="text-xs text-gray-600 truncate">{currentPharmacy.license}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${active
                    ? item.superOnly
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-500/30'
                      : 'bg-primary-600 text-white shadow-md shadow-primary-500/30'
                    : 'text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                <Icon className={`w-5 h-5 ${active ? '' : 'text-gray-500'}`} />
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className="ms-auto bg-amber-400 text-gray-900 text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
                {active && item.badge === undefined && (
                  <span className={`${isRTL ? 'mr-auto' : 'ml-auto'} w-1.5 h-1.5 rounded-full bg-white`} />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Server status */}
        <div className="px-4 pb-2">
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${serverStatus.online ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-500'}`}>
            {serverStatus.online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>
              {serverStatus.online ? t('serverOnline') : t('serverOffline')}
            </span>
          </div>
        </div>

        {/* User section */}
        <div className="px-4 py-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <SmartAvatar
              value={currentUser?.avatar}
              alt={currentUser?.name}
              size={40}
              rounded="rounded-full"
              textClass="text-xl"
              className={currentUser?.role === 'super_admin' ? 'bg-gradient-to-br from-violet-500 to-violet-700' : 'bg-gradient-to-br from-primary-500 to-primary-700'}
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">{currentUser?.name}</p>
              <p className="text-xs text-gray-500">
                {currentUser ? roleLabel(currentUser.role) : ''}
              </p>
            </div>
            {currentUser?.role === 'super_admin' && (
              <Crown className="w-4 h-4 text-violet-500" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="compact" />
            <button
              onClick={logout}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('logout')}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

const Header = ({ onMenuClick }) => {
  const { t, currentUser, isRTL, language, visibleOrders, notifications } = useApp()
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifPos, setNotifPos] = useState(null)
  const bellRef = useRef(null)

  const pendingOrders = visibleOrders.filter(o => o.status === 'pending').length

  // حساب موضع قائمة الإشعارات من موضع الزر نفسه (fixed + تثبيت داخل الشاشة)
  // — يمنع خروج القائمة عن حدود الشاشة في RTL/الهاتف ويمنع تشويه عرض المنصة
  const toggleNotifications = () => {
    if (!showNotifications) {
      const rect = bellRef.current?.getBoundingClientRect()
      if (rect) {
        const M = 8
        const width = Math.min(320, window.innerWidth - M * 2)
        // في RTL الزر قرب الحافة اليسرى ← نحاذي حافة القائمة اليسرى مع الزر؛
        // في LTR الزر قرب الحافة اليمنى ← نحاذي حافة القائمة اليمنى مع الزر
        let left = isRTL ? rect.left : rect.right - width
        left = Math.max(M, Math.min(left, window.innerWidth - width - M))
        const top = Math.min(rect.bottom + M, window.innerHeight - 140)
        setNotifPos({ top, left, width })
      }
    }
    setShowNotifications(!showNotifications)
  }

  // إغلاق قائمة الإشعارات عند التمرير/Escape/تغيير الحجم كي لا تنفصل عن زرها
  useEffect(() => {
    if (!showNotifications) return
    const close = () => setShowNotifications(false)
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [showNotifications])

  const roleLabel = (role) => {
    const info = ROLE_INFO[role]
    if (!info) return role
    if (language === 'fr') return info.fr || info.en
    if (language === 'en') return info.en
    return info.ar
  }

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 safe-top">
      <div className="flex items-center justify-between px-4 lg:px-6 h-16">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-medium text-gray-500 truncate">{t('welcome')},</h2>
            <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">
              {currentUser?.name}
              <span className={`hidden sm:inline-block ms-2 text-xs px-2 py-0.5 rounded-full ${currentUser?.role === 'super_admin' ? 'bg-violet-100 text-violet-700' : 'bg-primary-50 text-primary-700'}`}>
                {currentUser ? roleLabel(currentUser.role) : ''}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Live orders quick badge */}
          {pendingOrders > 0 && (
            <Link
              to="/orders"
              className="relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold hover:bg-amber-100 transition-colors animate-pulse-slow"
            >
              <Inbox className="w-3.5 h-3.5" />
              {pendingOrders}
            </Link>
          )}

          {/* Theme toggle — الوضع الفاتح/الداكن */}
          <ThemeToggle variant="icon" />

          {/* لوحة التواصل الداخلي — دردشة ومكالمات مع الزملاء (كاشير ↔ موظفون) */}
          <StaffComms />

          {/* Notifications */}
          <div className="relative">
            <button
              ref={bellRef}
              onClick={toggleNotifications}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Notifications"
              aria-expanded={showNotifications}
            >
              <Bell className="w-5 h-5 text-gray-700" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>

            {showNotifications && notifPos && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <div
                  className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 max-h-80 sm:max-h-96 overflow-y-auto animate-slide-up"
                  style={{ top: notifPos.top, left: notifPos.left, width: notifPos.width }}
                >
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{t('notifications')}</h3>
                    <span className="text-xs text-gray-500">{notifications.length}</span>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-gray-500">{t('noData')}</p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {notifications.map((notif) => (
                        <div key={notif.id} className="px-4 py-3 hover:bg-gray-50">
                          <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                          <p className="text-xs text-gray-500 mt-1">{notif.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

// شريط تنقل سفلي للهواتف - الوصول السريع للصفحات الرئيسية
const MobileBottomNav = () => {
  const { hasPermission, t, visibleOrders } = useApp()
  const location = useLocation()
  const pendingOrders = visibleOrders.filter(o => o.status === 'pending').length

  const items = [
    { path: '/dashboard', icon: Home, label: t('dashboard'), permission: 'dashboard.view' },
    { path: '/pos', icon: ShoppingCart, label: t('pos'), permission: 'pos.use' },
    { path: '/orders', icon: Inbox, label: t('liveOrders'), permission: 'orders.view', badge: pendingOrders },
    { path: '/inventory', icon: Package, label: t('inventory'), permission: 'inventory.view' },
    { path: '/platform', icon: Crown, label: t('platform'), permission: 'platform.manage' },
  ].filter(item => hasPermission(item.permission))
    // نعرض 4 عناصر كحد أقصى مع إبراز الطلبات المباشرة عند وجود طلبات
    .sort((a, b) => (b.badge || 0) - (a.badge || 0))
    .slice(0, 4)

  const isActive = (path) => location.pathname === path

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16">
        {items.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-1 min-w-[64px] rounded-lg transition-colors ${
                active ? (item.path === '/platform' ? 'text-violet-600' : 'text-primary-600') : 'text-gray-500'
              }`}
            >
              <span className="relative">
                <Icon className="w-5 h-5" />
                {item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-amber-400 text-gray-900 text-[9px] font-bold min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium truncate max-w-[64px]">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isRTL } = useApp()

  return (
    <div className={`min-h-[100dvh] bg-gray-50 ${isRTL ? 'lg:mr-72' : 'lg:ml-72'}`}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <PlatformWatermark isRTL={isRTL} />
      <div className="flex flex-col min-h-[100dvh] relative z-[1]">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  )
}

export default Layout
