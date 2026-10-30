// =====================================================================
// الكتالوج الرسمي الموحد للأدوية
// ---------------------------------------------------------------------
// يدمج قاعدتي البيانات الرسميتين في فهرس واحد قابل للبحث:
//   1) اللائحة الوزارية الرسمية (moroccanDrugs — 5917 دواء بأسعار
//      PPV/PH ونسب التعويض وأصلي/جنيس)
//   2) لائحة CNSS للأدوية المؤهلة للتعويض (cnssMedicines — تُسحب من
//      cnss.ma عبر scripts/import-cnss-list.mjs وتُدمج بلا ازدواجية)
// المفتاح الموحد: كود CIP (الباركود) — إن وُجد الدواء في اللائحتين
// تُعزَّز بياناته بشارة CNSS واسم المختبر، وإن وُجد في CNSS فقط يُضاف.
// يُستعمل في: «المنتقي الرسمي» بنافذة إضافة دواء + شارات التعويض.
// =====================================================================
import { moroccanDrugs } from '../data/moroccanDrugs'
import { cnssMedicines, CNSS_META } from '../data/cnssMedicines'

// خريطة CNSS حسب كود CIP
const CNSS_BY_CODE = new Map(cnssMedicines.map((m) => [m.code, m]))

// الفهرس الموحد: قاعدة الوزارة مع شارة CNSS عند التطابق
const catalog = moroccanDrugs.map((d) => {
  const cnssHit = CNSS_BY_CODE.get(d.code || d.barcode)
  return cnssHit
    ? { ...d, cnss: true, lab: cnssHit.lab || d.manufacturer }
    : { ...d, cnss: false }
})

// أدوية CNSS غير الموجودة في القاعدة الوزارية → تُضاف للفهرس
const knownCodes = new Set(moroccanDrugs.map((d) => d.code || d.barcode))
cnssMedicines.forEach((m) => {
  if (knownCodes.has(m.code)) return
  catalog.push({
    id: `cnss-${m.code}`,
    code: m.code,
    barcode: m.code,
    sku: `MA-${m.code}`,
    name: m.name,
    nameAr: m.name,
    nameEn: m.name,
    nameFr: m.name,
    dci: m.dci,
    dosage: m.dosage,
    form: m.form,
    presentation: m.presentation,
    manufacturer: m.lab || 'غير محدد / Not specified',
    price: m.ppv || 0,
    cost: m.ph || (m.ppv ? Number((m.ppv * 0.8).toFixed(2)) : 0),
    ppv: m.ppv,
    ph: m.ph,
    princepsGenerique: null,
    tauxRemboursement: m.ppv ? '' : '',
    category: 'other',
    cnss: true,
    source: 'cnss',
  })
})

export const OFFICIAL_CATALOG_SIZE = catalog.length
export const CNSS_LIST_COUNT = cnssMedicines.length
export { CNSS_META }

// تطبيع البحث: بلا تشكيل/همزات + توحيد التاء المربوطة (بحث عربي مرن)
const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * البحث في الكتالوج الرسمي الموحد (اسم/اسم علمي DCI/باركود/مختبر)
 * @param {string} query نص البحث (حرفان على الأقل)
 * @param {number} limit أقصى عدد للنتائج
 */
export const searchOfficialCatalog = (query, limit = 8) => {
  const q = norm(query)
  if (q.length < 2) return []
  const out = []
  for (const d of catalog) {
    if (
      (d.name && norm(d.name).includes(q)) ||
      (d.nameEn && norm(d.nameEn).includes(q)) ||
      (d.nameFr && norm(d.nameFr).includes(q)) ||
      (d.dci && norm(d.dci).includes(q)) ||
      (d.code && String(d.code).includes(q.replace(/\D/g, '') || '⍰')) ||
      (d.lab && d.cnss && norm(d.lab).includes(q))
    ) {
      out.push(d)
      if (out.length >= limit) break
    }
  }
  return out
}

/** هل الدواء (بكود CIP) ضمن لائحة CNSS القابلة للتعويض؟ */
export const isCnssReimbursable = (code) => CNSS_BY_CODE.has(String(code ?? '').replace(/\D/g, ''))

/** نسبة التعويض كرقم من نص «70%» أو 0 */
export const reimbursementRate = (drug) => {
  if (!drug) return 0
  if (typeof drug.tauxRemboursement === 'number') return drug.tauxRemboursement
  const n = Number(String(drug.tauxRemboursement ?? '').replace('%', ''))
  return Number.isFinite(n) ? n : 0
}
