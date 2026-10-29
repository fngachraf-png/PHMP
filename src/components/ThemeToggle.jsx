import { Sun, Moon } from 'lucide-react'
import { useApp } from '../contexts/AppContext'

// =====================================================================
// مفتاح تبديل الوضع الفاتح/الداكن — يعتمد على طبقة .dark المركزية
// variant: 'icon' (داخل الترويسات) | 'pill' (عائم بجانب مبدل اللغة)
// =====================================================================

const ThemeToggle = ({ variant = 'icon' }) => {
  const { theme, toggleTheme, t } = useApp()
  const isDark = theme === 'dark'
  const label = isDark ? t('lightMode') : t('darkMode')

  return (
    <button
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`flex items-center gap-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/40 ${
        variant === 'pill'
          ? 'px-4 py-2 bg-white/80 backdrop-blur-md shadow-md border border-white/40 hover:bg-white text-gray-700'
          : 'p-2 rounded-lg hover:bg-gray-100 text-gray-600'
      }`}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-amber-500" />
      ) : (
        <Moon className="w-5 h-5 text-primary-600" />
      )}
      {variant === 'pill' && (
        <span className="text-sm font-medium">{label}</span>
      )}
    </button>
  )
}

export default ThemeToggle
