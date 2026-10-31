import { Link } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Store, Info, BookOpen, FileText, ShieldCheck, Lock, Download } from 'lucide-react'
import PlatformLogo from './PlatformLogo'

// =====================================================================
// التذييل الموحد لكل الصفحات العامة (من نحن / الدليل / الشروط /
// الخصوصية / التحميل / متجر الصيدلية / صفحة الدخول)
// نسخة واحدة تضمن تناسقاً مثالياً بين كل صفحات المنصة.
// =====================================================================

const PublicFooter = () => {
  const { t } = useApp()

  const navItems = [
    { to: '/shop', label: t('shopTitle'), icon: Store, key: 'shop' },
    { to: '/about', label: t('aboutUs'), icon: Info, key: 'about' },
    { to: '/guide', label: t('howToUse'), icon: BookOpen, key: 'guide' },
    { to: '/download', label: t('downloadApp'), icon: Download, key: 'download' },
    { to: '/terms', label: t('termsOfUse'), icon: FileText, key: 'terms' },
    { to: '/privacy', label: t('privacyPolicy'), icon: ShieldCheck, key: 'privacy' },
  ]

  return (
    <footer className="border-t border-gray-200 bg-gray-50/50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <PlatformLogo size={26} alt="PHMP" />
              <span className="font-bold text-gray-900">{t('footerBrand')}</span>
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
            <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">{t('footerLegalNote')}</p>
          </div>
        </div>
        <p className="mt-6 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} {t('footerBrand')} · {t('allRightsReserved')}
        </p>
      </div>
    </footer>
  )
}

export default PublicFooter
