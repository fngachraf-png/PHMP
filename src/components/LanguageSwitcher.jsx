import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../contexts/AppContext'
import { LANGUAGES } from '../i18n/translations'
import { Globe, Check } from 'lucide-react'

// =====================================================================
// مفتاح تبديل اللغات (العربية / Français / English) — RTL للعربية فقط
// variant: 'pill' (شريط عائم) | 'compact' (داخل القوائم)
// القائمة تحسب موضعها من موضع الزر: تفتح للأسفل إن توفرت مساحة،
// وللأعلى إن كان الزر قريبا من أسفل الشاشة (إصلاح القص في الشريط الجانبي)،
// وتُثبَّت دائما داخل حدود الشاشة (fixed) مع إغلاق عند التمرير/Escape.
// ⚠️ إصلاح حرج: القائمة تُعرض عبر createPortal إلى body (خارج wrapRef)،
// لذا يجب أن يفحص كاشف النقر الخارجي القائمة نفسها (menuRef) أيضا —
// وإلا فإن mousedown على أي خيار يُغلق القائمة قبل وصول حدث click
// إليه فلا تستجيب الخيارات إطلاقا (خلل «الإختيارات لا تستجيب»).
// =====================================================================

const MENU_W = 176   // w-44
const MENU_H = 200   // الارتفاع التقديري للقائمة (3 لغات)
const MARGIN = 8

const LanguageSwitcher = ({ variant = 'pill' }) => {
  const { language, setLanguage, t } = useApp()
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState(null)
  const btnRef = useRef(null)
  const wrapRef = useRef(null)
  const menuRef = useRef(null) // حاوية القائمة المنقولة إلى body

  const toggle = () => {
    if (open) { setOpen(false); return }
    const rect = btnRef.current?.getBoundingClientRect()
    if (!rect) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    // توسيط أفقي على الزر مع التثبيت داخل الشاشة
    let left = rect.left + rect.width / 2 - MENU_W / 2
    left = Math.max(MARGIN, Math.min(left, vw - MENU_W - MARGIN))
    // فتح للأسفل إن توفرت مساحة، وإلا للأعلى، وإلا احتواء داخل الشاشة
    let top
    if (rect.bottom + MENU_H + MARGIN <= vh) {
      top = rect.bottom + MARGIN
    } else if (rect.top - MENU_H - MARGIN >= 0) {
      top = rect.top - MENU_H - MARGIN
    } else {
      top = Math.max(MARGIN, Math.min(rect.bottom + MARGIN, vh - MENU_H - MARGIN))
    }
    setMenuPos({ top, left, width: MENU_W })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      // الزر الأصلي (wrapRef) أو القائمة المنقولة (menuRef) كلاهما «داخل»
      // المبدّل — النقر على أي منهما ليس نقرا خارجياً ولا يُغلق القائمة
      // قبل أن يُكمل الحدث مساره (click) على الخيار المضغوط.
      if (wrapRef.current?.contains(e.target)) return
      if (menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    // إغلاق عند التمرير أو تغيير الحجم كي لا تنفصل القائمة عن زرها (fixed)
    const onClose = () => setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [open])

  const current = LANGUAGES.find(l => l.id === language) || LANGUAGES[0]

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        onClick={toggle}
        className={`flex items-center gap-2 rounded-full transition-all ${variant === 'pill'
          ? 'px-4 py-2 bg-white/80 backdrop-blur-md shadow-md border border-white/40 hover:bg-white'
          : 'px-3 py-2 bg-gray-100 hover:bg-gray-200 border-0 shadow-none'
        }`}
        aria-label={t('chooseLanguage')}
        aria-expanded={open}
      >
        <Globe className="w-4 h-4 text-primary-600" />
        <span className="text-sm font-medium text-gray-900">
          {current.flag} {current.label}
        </span>
      </button>

      {/* createPortal إلى body: الشريط الجانبي يحمل transform — أي سلف مُحوّل
          يحوّل fixed إلى تموضع نسبي له فتخرج القائمة عن حدود الشاشة */}
      {open && menuPos && createPortal(
        <div
          ref={menuRef}
          data-lang-menu
          className="fixed z-[60] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-slide-up"
          style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
        >
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
        </div>,
        document.body
      )}
    </div>
  )
}

export default LanguageSwitcher
