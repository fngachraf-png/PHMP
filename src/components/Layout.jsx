import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, FileText, Users, Truck,
  Receipt, BarChart3, Settings, LogOut, Menu, X, Bell, Globe,
  Stethoscope, ChevronDown, Search
} from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../contexts/AppContext'

const Sidebar = ({ isOpen, onClose }) => {
  const { t, isRTL, currentPharmacy, currentUser, logout, language, setLanguage, notifications } = useApp()
  const location = useLocation()

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { path: '/pos', icon: ShoppingCart, label: t('pos') },
    { path: '/inventory', icon: Package, label: t('inventory') },
    { path: '/prescriptions', icon: FileText, label: t('prescriptions') },
    { path: '/customers', icon: Users, label: t('customers') },
    { path: '/suppliers', icon: Truck, label: t('suppliers') },
    { path: '/purchases', icon: Receipt, label: t('purchases') },
    { path: '/reports', icon: BarChart3, label: t('reports') },
    { path: '/settings', icon: Settings, label: t('settings') },
  ]

  const isActive = (path) => location.pathname === path

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
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200">
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary-500/30">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">{t('appName')}</h1>
            <p className="text-xs text-gray-500">{currentPharmacy?.nameEn || 'Pharmacy System'}</p>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pharmacy info card */}
        {currentPharmacy && (
          <div className="px-4 py-4 border-b border-gray-200">
            <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{currentPharmacy.logo}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">
                    {isRTL ? currentPharmacy.name.split(' /')[0] : currentPharmacy.nameEn}
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
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-500/30'
                    : 'text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                <Icon className={`w-5 h-5 ${active ? '' : 'text-gray-500'}`} />
                <span>{item.label}</span>
                {active && (
                  <span className={`${isRTL ? 'mr-auto' : 'ml-auto'} w-1.5 h-1.5 rounded-full bg-white`} />
                )}
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div className="px-4 py-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-xl">
              {currentUser?.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">{currentUser?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{currentUser?.role}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <Globe className="w-4 h-4" />
              <span>{language === 'ar' ? 'EN' : 'ع'}</span>
            </button>
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
  const { t, currentUser } = useApp()
  const [showNotifications, setShowNotifications] = useState(false)
  const { notifications } = useApp()

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="flex items-center justify-between px-4 lg:px-6 h-16">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm font-medium text-gray-500">{t('welcome')},</h2>
            <p className="text-base font-semibold text-gray-900">{currentUser?.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-700" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>

            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
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

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isRTL } = useApp()

  return (
    <div className={`min-h-screen bg-gray-50 ${isRTL ? 'lg:mr-72' : 'lg:ml-72'}`}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout
