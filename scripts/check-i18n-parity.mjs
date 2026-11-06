// فحص تكافؤ مفاتيح الترجمة بالثلاث لغات (ar/fr/en) — يُخرج المفاتيح الناقصة
import { ar } from '../src/i18n/ar.js'
import { fr } from '../src/i18n/fr.js'
import { en } from '../src/i18n/en.js'

const keys = (o) => new Set(Object.keys(o))
const A = keys(ar), F = keys(fr), E = keys(en)
const diff = (name, missingFrom) => {
  const miss = []
  for (const k of A) if (!missingFrom.has(k)) miss.push(k)
  return miss
}
const missFr = diff('fr', F)
const missEn = diff('en', E)
const extraFr = [...F].filter((k) => !A.has(k))
const extraEn = [...E].filter((k) => !A.has(k))
console.log(`ar=${A.size} fr=${F.size} en=${E.size}`)
console.log('ناقص في fr:', missFr.length ? missFr.join(', ') : 'لا شيء')
console.log('ناقص في en:', missEn.length ? missEn.join(', ') : 'لا شيء')
console.log('زائد في fr (غير موجود بـar):', extraFr.length ? extraFr.join(', ') : 'لا شيء')
console.log('زائد في en (غير موجود بـar):', extraEn.length ? extraEn.join(', ') : 'لا شيء')
// قيم فارغة أو مجرد المفتاح نفسه
const suspicious = (o, name) => {
  const bad = Object.entries(o).filter(([k, v]) => typeof v !== 'string' || !v.trim() || v.trim() === k)
  if (bad.length) console.log(`قيم مشبوهة في ${name}:`, bad.map(([k]) => k).join(', '))
}
suspicious(ar, 'ar'); suspicious(fr, 'fr'); suspicious(en, 'en')
