import { useState, useRef, useEffect } from 'react'
import { useApp } from '../contexts/AppContext'
import { LANGUAGES } from '../i18n/translations'
import { Globe, Check } from 'lucide-react'

// =====================================================================
// مفتاح تبديل اللغات (العربية / Français / English) — RTL للعربية فقط
// variant: 'pill' (شريط عائم) | 'compact' (داخل القوائم)
// =====================================================================

const LanguageSwitcher = ({ variant = 'pill', dark = false }) => {
  const { language, setLanguage, t } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const current = LANGUAGES.find(l => l.id === language) || LANGUAGES[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-full transition-all ${variant === 'pill'
          ? 'px-4 py-2 bg-white/80 backdrop-blur-md shadow-md border border-white/40 hover:bg-white'
          : 'px-3 py-2 bg-gray-100 hover:bg-gray-200 border-0 shadow-none'
        }`}
        aria-label={t('chooseLanguage')}
      >
        <Globe className={`w-4 h-4 ${dark ? 'text-white' : 'text-primary-600'}`} />
        <span className={`text-sm font-medium ${dark ? 'text-white' : 'text-gray-900'}`}>
          {current.flag} {current.label}
        </span>
      </button>

      {open && (
        <div className="absolute top-full mt-2 z-50 w-44 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-slide-up"
          style={{ [document.documentElement.dir === 'rtl' ? 'left' : 'right']: 0 }}>
          {LANGUAGES.map(lang => (
            <button
              key={lang.id}
              onClick={() => { setLanguage(lang.id); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                language === lang.id ? 'bg-primary-50 text-primary-700 font-bold' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-lg">{lang.flag}</span>
              <span className="flex-1 text-start">{lang.label}</span>
              {language === lang.id && <Check className="w-4 h-4 text-primary-600" />}
              <span className="text-[10px] text-gray-400 uppercase">{lang.dir}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default LanguageSwitcher
