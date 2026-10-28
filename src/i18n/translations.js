// نظام الترجمة الثلاثي: العربية / Français / English
import { ar } from './ar'
import { fr } from './fr'
import { en } from './en'

export const translations = { ar, fr, en }

// اللغات المدعومة (تُستخدم في مفاتيح التبديل)
export const LANGUAGES = [
  { id: 'ar', label: 'العربية', short: 'ع', flag: '🇲🇦', dir: 'rtl' },
  { id: 'fr', label: 'Français', short: 'FR', flag: '🇫🇷', dir: 'ltr' },
  { id: 'en', label: 'English', short: 'EN', flag: '🇬🇧', dir: 'ltr' },
]

export const getLanguageInfo = (lang) => LANGUAGES.find(l => l.id === lang) || LANGUAGES[0]

// الترجمة مع سلسلة احتياطية: اللغة الحالية → العربية → المفتاح نفسه
export const useTranslation = (language) => {
  return (key) => {
    return translations[language]?.[key] || translations.ar?.[key] || key
  }
}

// اختيار الاسم المناسب للعنصر حسب اللغة (يدعم name / nameAr / nameFr / nameEn)
export const pickName = (item, language) => {
  if (!item) return ''
  if (language === 'ar') return item.name || item.nameAr || item.nameEn || item.nameFr || ''
  if (language === 'fr') return item.nameFr || item.nameEn || item.name || item.nameAr || ''
  return item.nameEn || item.name || item.nameAr || item.nameFr || ''
}

// اختيار العنوان المناسب حسب اللغة (يدعم address / addressFr / addressEn)
export const pickAddress = (item, language) => {
  if (!item) return ''
  if (language === 'ar') return item.address || item.addressFr || item.addressEn || ''
  if (language === 'fr') return item.addressFr || item.address || item.addressEn || ''
  return item.addressEn || item.address || item.addressFr || ''
}
