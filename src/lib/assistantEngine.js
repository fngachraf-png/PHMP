// =====================================================================
// محرك «مساعد PHMP» الذكي — بحث الأدوية وكشف النوايا والإجابة المحلية
// ---------------------------------------------------------------------
// الفلسفة: النتائج المعروضة للمستخدم (بطاقات الأدوية) تُستخرج حصراً من
// قاعدة بيانات المنصة (اللائحة المغربية الرسمية 5917 دواء) — أي أنها
// حقائق موثقة لا توليدية. النموذج اللغوي (إن توفر) يركّب الصياغة فقط
// من السياق المسلَّم له، والمحرك المحلي يضمن إجابة صحيحة دائماً حتى
// بدون اتصال بأي نموذج خارجي (صفر هلوسة + دائم التوفر).
// =====================================================================

import { moroccanDrugs } from '../data/moroccanDrugs.js'
import { ASSISTANT_KB, DOMAIN_SIGNALS } from '../data/assistantKnowledge.js'

// ---------------------------------------------------------------------
// 1) تطبيع النص: توحيد الحروف العربية (همزات/تاء مربوطة/أرقام هندية)
//    + إزالة التشكيل وعلامات الترقيم + توحيد المسافات
// ---------------------------------------------------------------------
const AR_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g
const AR_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g

export const normalizeText = (raw) => {
  if (!raw) return ''
  let s = String(raw).toLowerCase()
  s = s.replace(AR_DIACRITICS, '')
  s = s.replace(AR_DIGITS, (d) => String(d.charCodeAt(0) & 0x0F))
  s = s.replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ة/g, 'ه')
  s = s.replace(/[\u2018\u2019\u02BC']/g, ' ').replace(/[^\p{L}\p{N}\s-]/gu, ' ')
  s = s.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return s
}

const digits = (s) => (String(s || '').match(/\d+/g) || []).join('')

// جسر الكتابة: تحويل الحروف العربية إلى ما يقابلها لاتينياً — لأن أسماء
// الأدوية في اللائحة المغربية الرسمية لاتينية غالباً (مثال: «دوليبران» →
// dolibran ≈ DOLIPRANE). يستعمل للمطابقة العابرة للأنظمة الكتابية فقط.
const AR_TO_LATIN = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a', 'ٱ': 'a', 'ب': 'b', 'ت': 't', 'ث': 't',
  'ج': 'j', 'ح': 'h', 'خ': 'k', 'د': 'd', 'ذ': 'd', 'ر': 'r', 'ز': 'z', 'س': 's',
  'ش': 'ch', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'g', 'ف': 'f',
  'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'o', 'ي': 'i',
  'ة': 'a', 'ء': '', 'ئ': 'i', 'ؤ': 'o', 'ى': 'i',
}
export const arabicToLatin = (s, opts = {}) => {
  const map = opts.gSound ? { ...AR_TO_LATIN, 'ج': 'g' } : AR_TO_LATIN
  const map2 = opts.uSound ? { ...map, 'و': 'u' } : map
  let out = ''
  for (const ch of String(s || '')) out += map2[ch] ?? ch
  return out.replace(/\s+/g, ' ').trim()
}
const hasArabicScript = (s) => /[\u0600-\u06FF]/.test(String(s || ''))

// ---------------------------------------------------------------------
// 2) مسافة Levenshtein (بحد أقصى للطول — خروج مبكر للأداء)
// ---------------------------------------------------------------------
const levenshtein = (a, b, max = 3) => {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  const prev = new Array(b.length + 1)
  const cur = new Array(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    let rowMin = cur[0]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (cur[j] < rowMin) rowMin = cur[j]
    }
    if (rowMin > max) return max + 1
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]
  }
  return prev[b.length]
}

// مسافة بديلة تعامل p/b وv/f كمتكافئين (لا وجود لـp وv في العربية)
const eqivDist = (a, b, max) => Math.min(
  levenshtein(a, b, max),
  levenshtein(a, b.replace(/p/g, 'b').replace(/v/g, 'f'), max),
  levenshtein(a.replace(/p/g, 'b').replace(/v/g, 'f'), b, max)
)

// ---------------------------------------------------------------------
// 3) البحث عن الأدوية: على الاسم التجاري (ثلاث لغات) + الاسم العلمي DCI
//    + الباركود — مع تصحيح إملائي (Levenshtein) وترتيب بالصلة
// ---------------------------------------------------------------------
const DRUG_FIELDS = ['name', 'nameAr', 'nameEn', 'nameFr', 'dci']
const LATIN_FIELDS = new Set(['name', 'nameEn', 'nameFr', 'dci'])

// فهرس مسبق التطبيع (يبنى مرة واحدة عند أول استخدام — 5917 دواء)
let drugIndex = null
const buildIndex = () => {
  if (drugIndex) return drugIndex
  drugIndex = []
  for (const d of moroccanDrugs) {
    const entry = { drug: d, fields: {}, tokens: {} }
    for (const f of DRUG_FIELDS) {
      const norm = normalizeText(d[f])
      if (norm) {
        entry.fields[f] = norm
        entry.tokens[f] = norm.split(' ').filter((w) => w.length >= 3)
      }
    }
    drugIndex.push(entry)
  }
  return drugIndex
}

/**
 * البحث عن دواء — يرجع قائمة مطابقات مرتبة:
 * { drug, score, field } — score: 100 تطابق تام، 85 بداية، 70 تضمين،
 * 40-55 على مستوى الكلمات، 30-40 تصحيح إملائي (Levenshtein ≤ 2)
 */
export const searchDrugs = (query, limit = 6) => {
  const q = normalizeText(query)
  if (!q || q.length < 2) return []
  const qDigits = digits(query)
  // جسر الكتابة: إن كتب المستخدم بالعربية نبحث أيضاً بصيغه اللاتينية
  // المقابلة (الأسماء التجارية في اللائحة الرسمية لاتينية غالباً)، مع
  // متغيرات النطق المغربي الشائع (ج = g مثل اوجمنتين/AUGMENTIN،
  // و = u مثل اوغمنتين) — كلها تخضع لخصم ثقة فتظهر كتأكيد «هل تقصد».
  // ⚠️ الجسر للمدخلات «الشبيهة بالأسماء» فقط (≤3 كلمات بلا أدوات استفهام)
  // حتى لا تولّد الجمل الكاملة مطابقات زائفة عبر المسافة الضبابية.
  const QUESTION_WORDS = new Set([
    'من', 'ما', 'ماذا', 'هل', 'كيف', 'اين', 'أين', 'لماذا', 'لمادا', 'متي', 'متى', 'في', 'علي', 'على', 'مع',
    'الى', 'إلى', 'عن', 'و', 'او', 'أو', 'يا', 'انا', 'أنا', 'نحن', 'انت', 'أنت', 'هو', 'هي', 'هذا', 'هذي',
    'هذه', 'ذلك', 'التي', 'الذي', 'عند', 'عندي', 'لدي', 'اريد', 'أريد', 'ابغ', 'أبحث', 'يمكن', 'ممكن', 'عندكم',
    'what', 'where', 'how', 'why', 'when', 'who', 'is', 'are', 'do', 'does', 'can', 'you', 'i', 'me', 'my',
    'we', 'for', 'and', 'of', 'to', 'in', 'on', 'with', 'please', 'que', 'quoi', 'ou', 'où', 'comment',
    'pourquoi', 'quand', 'qui', 'est', 'je', 'tu', 'il', 'elle', 'le', 'la', 'les', 'des', 'une', 'un',
    'de', 'du', 'au', 'aux', 'et', 'pour', 'avec', 'sur',
  ])
  const allTokens = q.split(' ').filter((w) => w.length >= 2)
  const nameLike = allTokens.length > 0 && allTokens.length <= 3 && allTokens.every((w) => !QUESTION_WORDS.has(w))
  const latinVariants = new Set()
  if (hasArabicScript(q) && nameLike) {
    for (const opts of [{}, { gSound: true }, { gSound: true, uSound: true }]) {
      const v = normalizeText(arabicToLatin(q, opts))
      if (v && v !== q) latinVariants.add(v)
    }
  }
  const queries = [q, ...[...latinVariants]].map((qq, qi) => ({
    q: qq,
    cross: qi > 0,
    tokens: qq.split(' ').filter((w) => w.length >= 3),
  }))
  const results = []

  for (const entry of buildIndex()) {
    let best = 0
    let bestField = null

    // البحث بالباركود (دقيق جداً)
    if (qDigits && qDigits.length >= 6 && entry.drug.barcode && entry.drug.barcode.includes(qDigits)) {
      best = 100; bestField = 'barcode'
    }

    for (const f of DRUG_FIELDS) {
      const norm = entry.fields[f]
      if (!norm) continue

      for (const { q: qq, cross, tokens: qTokens } of queries) {
        let s = 0
        if (norm === qq) s = cross ? 90 : 100
        else if (norm.startsWith(qq)) s = (qq.length >= 3 ? 85 : 60) - (cross ? 8 : 0)
        else if (qq.length >= 3 && norm.includes(qq)) s = 70 - (cross ? 8 : 0)

        if (!s) {
          // مطابقة على مستوى الكلمات (مثال: «دوليبران 1000»)
          let tokScore = 0
          // الرموز الرقمية (مثل 2022 أو 200mg) تُطابق بالتساوي/البادئة فقط —
          // التطابق الضبابي بين الأرقام بلا معنى (2022 ≈ 200U خطأ شائع)
          const numericish = (w) => /^\d/.test(w)
          for (const qt of qTokens) {
            for (const wt of entry.tokens[f] || []) {
              if (wt === qt) tokScore = Math.max(tokScore, 55)
              else if (wt.startsWith(qt) && qt.length >= 4) tokScore = Math.max(tokScore, 45)
              else if (!numericish(qt) && !numericish(wt)) {
                const minLen = Math.min(qt.length, wt.length)
                if (minLen >= 4) {
                  const maxDist = minLen >= 10 ? 3 : 2
                  const d = eqivDist(qt, wt, maxDist)
                  if (d <= maxDist) tokScore = Math.max(tokScore, d === 1 ? 40 : 32)
                }
                // بادئة مشتركة طويلة (أخطاء تصريف شائعة)
                let cp = 0
                while (cp < qt.length && cp < wt.length && qt[cp] === wt[cp]) cp++
                if (cp >= 5 && Math.abs(qt.length - wt.length) <= 4) tokScore = Math.max(tokScore, 32)
              }
            }
          }
          s = tokScore - (cross ? 6 : 0)
          // تصحيح إملائي على كامل العبارة (أسماء قصيرة)
          if (!s && qq.length >= 5 && qq.length <= 18 && Math.abs(norm.length - qq.length) <= 3) {
            const d = eqivDist(qq, norm, 2)
            if (d <= 2) s = (d === 1 ? 42 : 32) - (cross ? 4 : 0)
          }
        }
        // DCI له أولوية إضافية (الاسم العلمي أقوى دلالة)
        if (s > 0 && f === 'dci' && s < 100) s += 8
        if (s > best) { best = s; bestField = f }
      }
    }

    if (best >= 30) results.push({ drug: entry.drug, score: best, field: bestField })
  }

  results.sort((a, b) => b.score - a.score || (a.drug.name || '').localeCompare(b.drug.name || ''))
  // إزالة التكرار حسب الكود (نفس الدواء باسمين)
  const seen = new Set()
  return results.filter((r) => {
    const key = r.drug.code || r.drug.id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, limit)
}

// ---------------------------------------------------------------------
// 4) كشف النية: تحية / شكر / طلب تحويل لموظف / سؤال قاعدة معرفة /
//    بحث دواء / خارج النطاق
// ---------------------------------------------------------------------
// ملاحظة: لا نستخدم \b مع الأنماط العربية — حدود الكلمة \b في JS يعتمد
// [A-Za-z0-9_] فقط فلا يلتصق بالحروف العربية؛ نستبدله بـ (?![\p{L}])
const GREETING_RE = /^(سلام|السلام عليكم|السلام|مرحبا|مرحبتين|اهلا|أهلا|صباح الخير|مساء الخير|هاي|hello|hi|hey|bonjour|bonsoir|salut|salam|good morning|good evening)(?![\p{L}])/iu
const THANKS_RE = /(شكرا|شكراً|مشكور|جزاك|thanks|thank you|merci|thx)/iu
const BYE_RE = /^(باي|وداعا|مع السلامة|الى اللقاء|goodbye|bye|au revoir)(?![\p{L}])/iu
const ESCALATE_RE = /(صيدلي|صيدلاني|كاشير|موظف|انسان|إنسان|شخص حقيقي|تحدث مع|احداث مع|كلام مباشر|مباشر|pharmacien|pharmacist|caissier|cashier|employe|employé|staff|human|agent|talk to|speak to|parler)/iu

// هل السؤال داخل نطاق المنصة/الصيدلة؟ (قبل رفض خارج النطاق)
export const isWithinDomain = (text) => {
  const norm = normalizeText(text)
  if (!norm) return false
  return DOMAIN_SIGNALS.some((sig) => norm.includes(normalizeText(sig)))
}

/**
 * تحليل رسالة المستخدم — يرجع:
 * { intent, kbEntry?, drugMatches?, confident }
 */
export const analyzeMessage = (text) => {
  const norm = normalizeText(text)
  const trimmed = String(text || '').trim()

  if (!trimmed) return { intent: 'unknown', confident: false }

  if (GREETING_RE.test(trimmed) && norm.split(' ').length <= 4) return { intent: 'greeting', confident: true }
  if (THANKS_RE.test(trimmed) && norm.split(' ').length <= 5) return { intent: 'thanks', confident: true }
  if (BYE_RE.test(trimmed) && norm.split(' ').length <= 4) return { intent: 'bye', confident: true }
  if (ESCALATE_RE.test(trimmed)) return { intent: 'escalate', confident: true }

  // ===== البحث عن دواء (على قاعدة 5917) =====
  const drugMatches = searchDrugs(trimmed, 6)
  const strongDrug = drugMatches[0]?.score >= 70

  // ===== أفضل مدخلة قاعدة معرفة (بالكلمات الدالة الثلاثية اللغات) =====
  let kbEntry = null
  let kbScore = 0
  for (const entry of ASSISTANT_KB) {
    let score = 0
    for (const lang of ['ar', 'fr', 'en']) {
      for (const kw of entry.keywords[lang] || []) {
        const nk = normalizeText(kw)
        if (!nk) continue
        // عبارة كاملة داخل السؤال = وزن أعلى
        if (norm.includes(nk)) score += nk.includes(' ') ? 3 : 2
        else {
          // كلمة مفتاحية تظهر كاملة كـ token
          for (const tok of norm.split(' ')) {
            if (tok === nk || (nk.length >= 5 && tok.startsWith(nk))) { score += 1; break }
          }
        }
      }
    }
    if (score > kbScore) { kbScore = score; kbEntry = entry }
  }

  // دواء قوي المطابقة له الأولوية (اسم دواء صريح في السؤال)
  if (strongDrug && (!kbEntry || kbScore < 4)) {
    return { intent: 'drug', drugMatches, confident: true }
  }

  if (kbEntry && kbScore >= 2) {
    // بطاقات الأدوية المطابقة ترفق بجواب المعرفة (مثال: «سعر الدوليبران»)
    return { intent: 'kb', kbEntry, drugMatches: drugMatches.filter((m) => m.score >= 30), confident: kbScore >= 3 }
  }

  if (strongDrug) return { intent: 'drug', drugMatches, confident: true }
  // أي مطابقة دوائية مقبولة (≥30) لها الأولوية على الرفض — المستخدم كتب
  // اسماً شبيهاً بدواء فنعرض أقرب النتائج «هل تقصد» بدل الاعتذار
  if (drugMatches.length > 0 && drugMatches[0].score >= 30) {
    return { intent: 'drug', drugMatches, confident: false }
  }

  // داخل المجال لكن بدون مطابقة → إجابة عامة موجهة (أو نموذج لغوي عند توفره)
  if (isWithinDomain(trimmed)) return { intent: 'domain-unknown', confident: false }

  return { intent: 'offtopic', confident: true }
}

// ---------------------------------------------------------------------
// 5) بطاقة دواء موحدة للعرض (حسب لغة المستخدم) — من قاعدة المنصة فقط
// ---------------------------------------------------------------------
export const toDrugCard = (drug, language) => {
  if (!drug) return null
  const pick = (...vals) => vals.find((v) => v && String(v).trim()) || ''
  return {
    id: drug.id || drug.code,
    name: language === 'ar' ? pick(drug.nameAr, drug.name, drug.nameFr, drug.nameEn)
      : language === 'fr' ? pick(drug.nameFr, drug.nameEn, drug.name, drug.nameAr)
        : pick(drug.nameEn, drug.nameFr, drug.name, drug.nameAr),
    dci: drug.dci || '',
    form: drug.form || '',
    dosage: drug.dosage || '',
    presentation: drug.presentation || '',
    price: drug.price ?? drug.ppv ?? null,
    requiresPrescription: !!drug.requiresPrescription,
    reimbursement: drug.tauxRemboursement || '',
    isGeneric: drug.princepsGenerique === 'G',
    isOriginator: drug.princepsGenerique === 'P',
  }
}

export default { normalizeText, searchDrugs, analyzeMessage, toDrugCard, isWithinDomain }
