import { Link, useLocation } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeToggle from './ThemeToggle'
import { Stethoscope, Store, Info, BookOpen, FileText, ShieldCheck, Lock, HeartPulse, Download } from 'lucide-react'

// =====================================================================
// التخطيط الموحد للصفحات العامة (من نحن / دليل الاستخدام / الشروط /
// الخصوصية / التحميل والتثبيت) — ترويسة بروابط التنقل + زر دخول
// الموظفين + تذييل
// =====================================================================

const PublicLayout = ({ children, active }) => {
  const { t, isRTL } = useApp()

  const navItems = [
    { to: '/shop', label: t('shopTitle'), icon: Store, key: 'shop' },
    { to: '/about', label: t('aboutUs'), icon: Info, key: 'about' },
    { to: '/guide', label: t('howToUse'), icon: BookOpen, key: 'guide' },
    { to: '/download', label: t('downloadApp'), icon: Download, key: 'download' },
    { to: '/terms', label: t('termsOfUse'), icon: FileText, key: 'terms' },
    { to: '/privacy', label: t('privacyPolicy'), icon: ShieldCheck, key: 'privacy' },
  ]

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-primary-50/60 via-white to-white dark:from-slate-900/60 dark:via-slate-900 dark:to-slate-900 flex flex-col">
      {/* ===== الترويسة ===== */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-gray-200 safe-top">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link to="/shop" className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/30">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 truncate">{t('appName')}</h1>
              <p className="text-[11px] text-gray-500 truncate">PHMP • {t('appTagline')}</p>
            </div>
          </Link>

          {/* روابط التنقل — شاشات كبيرة */}
          <nav className="hidden md:flex items-center gap-1 mx-auto">
            {navItems.map(item => (
              <Link key={item.key} to={item.to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active === item.key
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}>
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 ms-auto md:ms-0">
            <ThemeToggle variant="icon" />
            <div className="hidden sm:block">
              <LanguageSwitcher variant="compact" />
            </div>
            <Link to="/login"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold transition-colors shadow-md">
              <Lock className="w-4 h-4" />
              <span className="hidden sm:inline">{t('staffLoginBtn')}</span>
            </Link>
          </div>
        </div>

        {/* روابط التنقل — الهواتف */}
        <nav className="md:hidden flex items-center gap-1 overflow-x-auto px-3 pb-2 scrollbar-thin">
          {navItems.map(item => (
            <Link key={item.key} to={item.to}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                active === item.key
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}>
              <item.icon className="w-3.5 h-3.5" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* مفتاح اللغة + الوضع للهواتف */}
        <div className="sm:hidden pb-2 px-4 flex items-center justify-between gap-2">
          <LanguageSwitcher variant="compact" />
        </div>
      </header>

      {/* ===== المحتوى ===== */}
      <main className="max-w-4xl w-full mx-auto p-4 pb-16 safe-bottom flex-1">
        {children}
      </main>

      {/* ===== التذييل ===== */}
      <footer className="border-t border-gray-200 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <HeartPulse className="w-4 h-4 text-primary-600" />
                <span className="font-bold text-gray-900">{t('appName')}</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{t('footerMission')}</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-2 text-xs uppercase tracking-wider">{t('quickLinks')}</p>
              <div className="flex flex-col gap-1.5">
                {navItems.map(item => (
                  <Link key={item.key} to={item.to} className="text-gray-500 hover:text-primary-600 text-xs transition-colors">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-2 text-xs uppercase tracking-wider">{t('staffAccess')}</p>
              <Link to="/login" className="flex items-center gap-1.5 text-gray-500 hover:text-primary-600 text-xs transition-colors">
                <Lock className="w-3.5 h-3.5" /> {t('staffLoginBtn')}
              </Link>
              <p className="text-[11px] text-gray-400 mt-3 leading-relaxed" dir={isRTL ? 'rtl' : 'ltr'}>
                {t('footerLegalNote')}
              </p>
            </div>
          </div>
          <p className="mt-6 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} {t('appName')} — {t('allRightsReserved')}
          </p>
        </div>
      </footer>
    </div>
  )
}

export default PublicLayout
