// =====================================================================
// PHMP — محللات استيراد المخزون الذكي
// ---------------------------------------------------------------------
// تحويل مصادر متعددة إلى صفوف استيراد موحدة قابلة للتحرير والمصادقة:
//   1) جداول رقمية (xlsx/xls/csv) — كشف الترويسات ذاكياً (عربية/فرنسية/
//      إنجليزية) مع تخمين الأعمدة عند غيابها
//   2) ملفات Word (docx) — استخراج النص ثم تحليل سطور الفاتورة
//   3) ملفات PDF — استخراج النص صفحةً صفحة ثم تحليل السطور
//   4) نص OCR لصورة فاتورة/وصل — تحليل سطور متسامح (كمية/سعر/تاريخ/دفعة)
//   5) مطابقة ضبابية مع الكتالوج الرسمي الموحد (5917 دواء + CNSS) لتوثيق
//      الأسماء وتعبئة الأسعار الرسمية وكشف الأدوية غير المعروفة
// التبعيات الثقيلة (xlsx/mammoth/pdfjs) تُحمَّل كسولاً عند الطلب فقط
// كي تبقى الحزمة الأساسية خفيفة.
// =====================================================================

// ===== تطبيع النصوص (نفس منطق officialCatalog — عربي/فرنسي/إنجليزي) =====
export const normText = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[\u0640]/g, '')
    .replace(/[^\p{L}\p{N}\s%.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// تحويل رقم بتنسيقات متعددة: «1 234,56» / «1,234.56» / «12,50 DH» / عربي
export const parseNumber = (v) => {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let s = String(v).trim()
  if (!s) return null
  // إزالة العملات والوحدات والمسافات والفواصل الألفية
  s = s.replace(/(dhs?|mad|درهم|دراهم|dh\b)/gi, '').replace(/\u00a0/g, '').replace(/\s/g, '')
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    // الفاصلة الأخيرة هي الفاصلة العشرية والأخرى ألفية
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')
  } else if (hasComma) {
    const parts = s.split(',')
    // فاصلة واحدة بأرقام كثيرة = ألفية (مثل 1,500)؛ وإلا عشرية
    s = (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3 && !/^0/.test(parts[1]))
      ? s.replace(',', '')
      : s.replace(',', '.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

// ===== تحليل تواريخ الصلاحية بصيغ متعددة → ISO (yyyy-mm-dd) =====
export const parseExpiry = (v) => {
  if (!v) return ''
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  // yyyy-mm-dd (ISO) — مثبت النهاية كي لا يلتقط جزءاً من رقم أطول
  let m = s.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?$/)
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3] || '01').padStart(2, '0')}`
  // dd/mm/yyyy أو dd/mm/yy — الصيغة الأشهر بالفواتير المغربية
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/)
  if (m) {
    const d = String(m[1]).padStart(2, '0')
    const mo = String(m[2]).padStart(2, '0')
    let y = String(m[3])
    if (y.length === 2) y = `20${y}`
    if (Number(m[2]) > 12 && Number(m[1]) <= 12) return `${y}-${d}-01` // كانت mm/dd/yyyy
    return `${y}-${mo}-${d}`
  }
  // mm/yyyy (صلاحية شهرية شائعة على الأغلفة)
  m = s.match(/^(\d{1,2})[-/.](\d{4})$/)
  if (m) return `${m[2]}-${String(m[1]).padStart(2, '0')}-01`
  // mm/yy (03/26 = مارس 2026) أو dd/mm بلا سنة
  m = s.match(/^(\d{1,2})[-/.](\d{2})$/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    const futureYear = new Date().getFullYear() + 2
    if (a >= 1 && a <= 12 && b >= 20) return `20${m[2]}-${String(a).padStart(2, '0')}-01` // mm/yy
    if (b >= 1 && b <= 12) return `${futureYear}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}` // dd/mm
    return `${futureYear}-${String(a).padStart(2, '0')}-01` // شهر فقط والباقي غامض
  }
  return ''
}

// =====================================================================
// ===== 1) محلل سطور الفاتورة (OCR / docx / pdf نص خام) =====
// =====================================================================
// سطور تُتجاهل (ترويسات وتذييلات الفواتير المغربية الشائعة)
const NOISE_PATTERNS = [
  /^(total|totaux|montant|sous.?total|net a payer|net..payer|tva|timbre|remise|escompte|facture|bon|bon de livraison|bl\s|n°|num|numero|date|page|client|patient|pharmacie|grossiste|laboratoire|labo|supplier|warehouse|ice|rc|patente|if|cnss|tel|tel\.|gsm|adresse|code|mode de paiement|signature|cachet|servez|merci|subtotal|grand total|amount|vat|invoice|delivery|shipping)\b/i,
  /^(المجموع|الاجمالي|الإجمالي|المبلغ|الضريبة|الخصم|فاتورة|وصل|رقم|تاريخ|الصفحة|الزبون|المريض|الصيدلية|صيدلية|المخزن|مخزن|شركة|مستودع|العيادة|الهاتف|العنوان|التوقيع|الختم|طريقة الدفع|شكرا)/,
  /^(page \d+|page\s*\/\s*\d+)/i,
]

const isNoiseLine = (line) => {
  const t = line.trim()
  if (t.length < 4 || t.length > 220) return true
  if (!/\p{L}/u.test(t)) return true // بلا حروف إطلاقاً
  if (/^[\s\d./*#,;:()+-]+$/.test(t)) return true
  return NOISE_PATTERNS.some((p) => p.test(t))
}

// استخراج قيم من سطر واحد: { name, quantity, unitPrice, total, expiry, batch }
const parseInvoiceLine = (rawLine) => {
  let line = rawLine.replace(/\u00a0/g, ' ').replace(/\s{2,}/g, ' ').trim()
  if (isNoiseLine(line)) return null

  // استخراج الدفعة (Lot/LOT/N°Lot/الدفعة)
  let batch = ''
  const batchMatch = line.match(/(?:lot|l[oô]t|n°\s*lot|الدفعة)\s*[:.]?\s*([A-Za-z0-9\/-]{2,20})/i)
  if (batchMatch) { batch = batchMatch[1]; line = line.replace(batchMatch[0], ' ') }

  // استخراج تاريخ الصلاحية (أي موقع بالسطر) — البدائل من الأطول للأقصر كي
  // لا يلتقط «10/20» من «10/2027»
  let expiry = ''
  const expMatch = line.match(/(?:exp|expiration|péremption|peremption|d\.exp|الصلاحية|تنتهي)\s*[:.]?\s*(\d{4}[-/.]\d{1,2}(?:[-/.]\d{1,2})?|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[-/.]\d{4}|\d{1,2}[-/.]\d{1,2}(?!\d))/i)
  if (expMatch) { expiry = parseExpiry(expMatch[1]); line = line.replace(expMatch[0], ' ') }

  // الأرقام المتسلسلة بداية السطر (رقم السطر بالفاتورة) تُزال
  line = line.replace(/^\s*\d{1,3}[\s.)-]+/, (m, ...a) => (m.trim().length <= 5 ? '' : m)).trim()

  // كمية صريحة — بالأولوية: «x 3» (المضاعف الشائع) ثم «3x» ثم «QTÉ 3» ثم
  // «الكمية: 4». الأولوية تحسم الالتباس بعد انهيار المسافات: «GEL 12 x 3»
  // الكمية 3 وليست 12 (12 حجم العلبة)
  let quantity = null
  const qtyPatterns = [
    /(?:^|\s)x\s*(\d{1,3})\b/i,
    /(?:^|\s)(\d{1,3}) ?x\b/i,
    /(?:^|\s)q(?:te|ty|té)?\s*[:.]?\s*(\d{1,3})\b/i,
    /(?:^|\s)الكمية\s*[:.]?\s*(\d{1,3})\b/i,
  ]
  for (const qp of qtyPatterns) {
    const qm = line.match(qp)
    if (qm) {
      const v = Number(qm[1])
      if (v >= 1 && v <= 999) { quantity = v; line = line.replace(qm[0], ' ') }
      break
    }
  }

  // الأرقام العشرية بالسطر — تُستخرج بعد إزالة الكمية كي لا تشيخ مؤشراتها
  // وبحدود رقمية (?<!\d / ?!\d) كي لا يلتقط «100» من «1000MG»
  const numTokens = [...line.matchAll(/(?<!\d)(\d{1,3}(?:[ ,]\d{3})*(?:[.,]\d{1,2})?|\d+[.,]\d{1,2})(?!\d)\s*(?:dhs?|mad|درهم)?/gi)]
    .map((m) => ({ value: parseNumber(m[1]), raw: m[0], index: m.index }))
    .filter((n) => n.value !== null && n.value !== 0 && n.value !== 1)

  let unitPrice = null
  let total = null
  // من نهاية السطر: الأخير = المجموع، قبله = سعر الوحدة، وثالث الأخير إن كان
  // عدداً صحيحاً صغيراً = الكمية (تخطيط الفواتير القياسي: اسم كمية سعر مجموع)
  const nums = numTokens.filter((n) => line.includes(n.raw))
  if (nums.length >= 2) {
    const last = nums[nums.length - 1]
    const before = nums[nums.length - 2]
    const third = nums.length >= 3 ? nums[nums.length - 3] : null
    total = last.value
    unitPrice = before.value
    const thirdIsQty = third && Number.isInteger(third.value) && third.value >= 1 && third.value <= 999
    if (quantity === null && thirdIsQty) {
      quantity = third.value
      line = line.slice(0, third.index)
    } else {
      line = line.slice(0, Math.min(before.index, last.index))
    }
    // كمية ضمنية: total/unitPrice عدد صحيح معقول
    if (quantity === null && unitPrice > 0 && total > unitPrice) {
      const q = Math.round(total / unitPrice)
      if (q >= 1 && q <= 999 && Math.abs(total - q * unitPrice) < 0.02 * total) quantity = q
    }
  } else if (nums.length === 1) {
    unitPrice = nums[0].value
    line = line.slice(0, nums[0].index)
  }
  if (quantity === null) quantity = 1

  const name = line.replace(/\s{2,}/g, ' ').replace(/[\s.,;:|-]+$/, '').trim()
  if (name.length < 3) return null

  return {
    name,
    quantity,
    unitPrice,
    total,
    expiry,
    batch,
    barcode: '',
  }
}

export const parseInvoiceText = (text) => {
  const lines = String(text || '').split(/\r?\n/)
  const rows = []
  const seen = new Map()
  for (const line of lines) {
    const row = parseInvoiceLine(line)
    if (!row) continue
    // دمج المكررات (نفس الاسم): تجميع الكميات
    const key = normText(row.name)
    const prev = seen.get(key)
    if (prev) {
      prev.quantity += row.quantity
      if (!prev.expiry && row.expiry) prev.expiry = row.expiry
      if (!prev.batch && row.batch) prev.batch = row.batch
    } else {
      seen.set(key, row)
      rows.push(row)
    }
  }
  return rows
}

// =====================================================================
// ===== 2) جدول رقمي (xlsx/xls/csv) — كشف ترويسة ذكي =====
// =====================================================================
const HEADER_ALIASES = {
  name: ['designation', 'design', 'produit', 'article', 'libelle', 'libellé', 'description', 'nom', 'name', 'medicament', 'médicament', 'dci', 'specialite', 'spécialité', 'دواء', 'المنتج', 'الصنف', 'المادة', 'الاسم', 'البيان', 'الوصف'],
  quantity: ['qte', 'qte.', 'quantite', 'quantité', 'qty', 'quantity', 'quant', 'الكمية', 'العدد', 'كمية'],
  unitPrice: ['pu', 'p.u', 'p.u.', 'prix', 'prix unitaire', 'prix_unity', 'price', 'unit price', 'unitprice', 'pv', 'ppv', 'prix de vente', 'السعر', 'الثمن', 'سعر الوحدة', 'سعر البيع'],
  cost: ['pa', 'p.a', 'prix achat', "prix d'achat", 'prix dachat', 'cost', 'unit cost', 'purchase price', 'سعر الشراء', 'ثمن الشراء', 'تكلفة'],
  total: ['total', 'montant', 'tc', 'tot', 'montant ttc', 'total ttc', 'total ht', 'amount', 'line total', 'المجموع', 'الاجمالي', 'الإجمالي', 'المبلغ'],
  expiry: ['peremption', 'péremption', 'expiration', 'expiry', 'exp', 'date exp', 'date dexpiration', "date d'expiration", 'dlc', 'الصلاحية', 'تاريخ الانتهاء', 'الانتهاء'],
  batch: ['lot', 'n lot', 'n° lot', 'num lot', 'batch', 'batch number', 'lot number', 'الدفعة', 'رقم الدفعة'],
  barcode: ['code', 'code barre', 'code-barre', 'codebarre', 'barcode', 'cip', 'cip13', 'ean', 'ean13', 'ref', 'reference', 'référence', 'الباركود', 'الرمز', 'الكود', 'المرجع'],
}

const detectHeaderMap = (row) => {
  const map = {}
  let hits = 0
  row.forEach((cell, idx) => {
    const c = normText(cell).replace(/[.:/]/g, '').trim()
    if (!c || c.length > 30) return
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some((a) => c === normText(a) || c === normText(a).replace(/\s/g, ''))) {
        if (!(field in map)) { map[field] = idx; hits += 1 }
        break
      }
    }
  })
  return hits >= 2 ? map : null
}

// تخمين الأعمدة بلا ترويسة: الاسم = العمود النصي الأطول، الأرقام من اليمين
const guessColumnMap = (rows) => {
  const width = Math.max(...rows.slice(0, 12).map((r) => r.length))
  const textScore = new Array(width).fill(0)
  const numScore = new Array(width).fill(0)
  rows.slice(0, 30).forEach((r) => {
    r.forEach((cell, idx) => {
      const s = String(cell ?? '').trim()
      if (!s) return
      if (/[\p{L}]{2,}/u.test(s) && s.length >= 3) textScore[idx] += s.length
      else if (parseNumber(s) !== null) numScore[idx] += 1
    })
  })
  const map = {}
  map.name = textScore.indexOf(Math.max(...textScore))
  // الأرقام من اليمين: الأخير total، قبله unitPrice، قبله إن وجد quantity
  const numCols = [...Array(width).keys()].filter((i) => i !== map.name && numScore[i] > 0).sort((a, b) => b - a)
  if (numCols.length >= 2) { map.total = numCols[0]; map.unitPrice = numCols[1] }
  else if (numCols.length === 1) map.unitPrice = numCols[0]
  if (numCols.length >= 3) map.quantity = numCols[2]
  else map.quantity = numCols.find((c) => c !== map.total && c !== map.unitPrice) ?? null
  return map
}

export const rowsFromMatrix = (matrix) => {
  const clean = (matrix || []).map((r) => (Array.isArray(r) ? r : [r])).filter((r) => r.some((c) => String(c ?? '').trim() !== ''))
  if (clean.length === 0) return []
  let map = null
  let dataStart = 0
  for (let i = 0; i < Math.min(10, clean.length); i++) {
    const m = detectHeaderMap(clean[i])
    if (m) { map = m; dataStart = i + 1; break }
  }
  if (!map) map = guessColumnMap(clean)
  if (map.name === undefined || map.name === -1) return []

  const get = (r, key) => (map[key] !== undefined && map[key] !== null && map[key] >= 0 ? r[map[key]] : null)
  const rows = []
  for (let i = dataStart; i < clean.length; i++) {
    const r = clean[i]
    const name = String(get(r, 'name') ?? '').trim()
    if (!name || name.length < 2) continue
    // ترويسة مكررة وسط الجدول تُتجاهل
    if (detectHeaderMap(r)) continue
    const quantity = Math.max(1, Math.round(parseNumber(get(r, 'quantity')) ?? 1))
    const unitPrice = parseNumber(get(r, 'unitPrice'))
    const cost = parseNumber(get(r, 'cost'))
    const total = parseNumber(get(r, 'total'))
    rows.push({
      name,
      quantity,
      unitPrice: unitPrice ?? null,
      cost: cost ?? null,
      total: total ?? null,
      expiry: parseExpiry(get(r, 'expiry')),
      batch: String(get(r, 'batch') ?? '').trim().slice(0, 40),
      barcode: String(get(r, 'barcode') ?? '').replace(/\D/g, '').slice(0, 13),
    })
  }
  return rows
}

// =====================================================================
// ===== 3) مطابقة ضبابية مع الكتالوج الرسمي =====
// =====================================================================
// يُبنى الفهرس كسولاً عند أول استعمال (بعد الاستيراد الديناميكي للكتالوج)
let catalogIndex = null
const ensureCatalogIndex = async () => {
  if (catalogIndex) return catalogIndex
  const { moroccanDrugs } = await import('../data/moroccanDrugs')
  const { cnssMedicines } = await import('../data/cnssMedicines')
  const entries = []
  for (const d of moroccanDrugs) {
    entries.push({
      code: String(d.code || d.barcode || ''),
      name: normText(d.name),
      nameEn: normText(d.nameEn),
      dci: normText(d.dci),
      dosage: d.dosage || '',
      form: d.form || '',
      drug: d,
    })
  }
  for (const m of cnssMedicines) {
    entries.push({
      code: String(m.code || ''),
      name: normText(m.name),
      nameEn: normText(m.name),
      dci: normText(m.dci),
      dosage: m.dosage || '',
      form: m.form || '',
      drug: { ...m, id: m.id || `cnss-${m.code}`, price: m.ppv || 0, cost: m.ph || 0, category: 'other' },
    })
  }
  catalogIndex = entries
  return entries
}

const tokenSet = (s) => new Set(normText(s).split(' ').filter((t) => t.length > 1))
const matchCache = new Map()

/**
 * مطابقة اسم حر مع الكتالوج الرسمي — يعيد أفضل تطابق ودرجة ثقة 0..1
 * الباركود تطابق قاطع (1)، والاسم بتجانس المفردات مع وزن إضافي للبداية
 */
export async function matchOfficial(name, barcode = '') {
  const code = String(barcode || '').replace(/\D/g, '')
  if (code && code.length >= 6) {
    const entries = await ensureCatalogIndex()
    const hit = entries.find((e) => e.code === code)
    if (hit) return { drug: hit.drug, score: 1, byCode: true }
  }
  const key = normText(name)
  if (!key || key.length < 2) return { drug: null, score: 0 }
  if (matchCache.has(key)) return matchCache.get(key)
  const entries = await ensureCatalogIndex()
  const qTokens = tokenSet(name)
  if (qTokens.size === 0) return { drug: null, score: 0 }
  let best = { drug: null, score: 0 }
  for (const e of entries) {
    let score = 0
    if (e.name && (e.name === key || e.nameEn === key)) {
      score = 1
    } else if (e.name && (e.name.includes(key) || key.includes(e.name))) {
      const lenRatio = Math.min(e.name.length, key.length) / Math.max(e.name.length, key.length)
      score = 0.72 + 0.2 * lenRatio
    } else if (e.dci && (e.dci.includes(key) || key.includes(e.dci)) && e.dci.length >= 4) {
      score = 0.78
    } else {
      // مفردات الاسم العربي + العلامة التجارية + الاسم العلمي معاً — اللائحة
      // تخزن غالباً «باراسيتامول 300MG» في name و«DOLIPRANE 300MG» في nameEn
      const eTokens = tokenSet(`${e.name} ${e.nameEn} ${e.dci}`)
      if (eTokens.size > 0) {
        let inter = 0
        qTokens.forEach((t) => { if (eTokens.has(t)) inter += 1 })
        const union = new Set([...qTokens, ...eTokens]).size
        const jaccard = inter / union
        // بداية الاسم نفسها (غالباً DCI أو العلامة) ترفع الثقة
        const sameStart = [...qTokens][0] && [...eTokens][0] && [...qTokens][0] === [...eTokens][0]
        score = jaccard * 0.75 + (sameStart ? 0.2 : 0)
      }
    }
    if (score > best.score) best = { drug: e.drug, score: Math.min(1, score), byCode: false }
    if (best.score === 1) break
  }
  if (matchCache.size > 800) matchCache.clear()
  matchCache.set(key, best)
  return best
}

// =====================================================================
// ===== 4) بناء صفوف الاستيرار الموحدة (مع الكشف والتحذيرات) =====
// =====================================================================
/**
 * يحول صفاً خاماً إلى صف استيراد موحد مع مطابقة رسمية وكشف المخزون القائم
 * @param {object} raw { name, quantity, unitPrice, cost, total, expiry, batch, barcode }
 * @param {Array} existingProducts قائمة المخزون الحالية
 */
export async function buildImportRow(raw, existingProducts) {
  const { drug, score, byCode } = await matchOfficial(raw.name, raw.barcode)
  // كشف مكرر المخزون: باركود أولاً ثم الاسم+الجرعة مطبَّعين
  let existing = null
  const code = String(raw.barcode || '').replace(/\D/g, '')
  if (code.length >= 6) existing = existingProducts.find((p) => String(p.barcode || '').replace(/\D/g, '') === code) || null
  if (!existing) {
    const key = normText(raw.name)
    const keyWithDosage = `${key}|${normText(raw.dosage || drug?.dosage || '')}`
    existing = existingProducts.find((p) => {
      const pk = normText(p.name)
      const pkd = `${pk}|${normText(p.dosage || '')}`
      return pkd === keyWithDosage || pk === key
    }) || null
  }

  // السعر: سعر الشراء إن وُجد صراحة، وإلا من الكتالوج (PH أو تقدير 80% من PPV)
  const catalogCost = drug ? (Number(drug.ph) > 0 ? Number(drug.ph) : (Number(drug.ppv || drug.price) > 0 ? Number(((Number(drug.ppv || drug.price)) * 0.8).toFixed(2)) : 0)) : null
  const catalogPrice = drug ? (Number(drug.ppv || drug.price) > 0 ? Number(drug.ppv || drug.price) : null) : null
  const unitPrice = raw.unitPrice ?? raw.cost ?? catalogCost ?? 0
  const salePrice = catalogPrice ?? (unitPrice > 0 ? Math.round(unitPrice * 1.2 * 100) / 100 : 0)

  const warnings = []
  if (score > 0 && score < 0.55) warnings.push('lowMatch')
  if (!drug) warnings.push('unknownDrug')
  if (!raw.name || raw.name.length < 3) warnings.push('invalidName')
  if (!(raw.quantity >= 1)) warnings.push('invalidQuantity')
  if (!unitPrice) warnings.push('missingPrice')
  if (raw.expiry) {
    const days = (new Date(raw.expiry) - new Date()) / 86400000
    if (days < 0) warnings.push('expired')
    else if (days < 90) warnings.push('expiringSoon')
  }

  return {
    id: `ir-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    // بيانات العرض/التحرير
    name: raw.name,
    nameEn: drug?.nameEn || '',
    dosage: drug?.dosage || raw.dosage || '',
    form: drug?.form || '',
    presentation: drug?.presentation || '',
    category: drug?.category || 'other',
    requiresPrescription: !!drug?.requiresPrescription,
    barcode: code || String(drug?.code || drug?.barcode || '').replace(/\D/g, ''),
    quantity: Math.max(1, Math.round(raw.quantity || 1)),
    cost: unitPrice,
    price: salePrice,
    expiry: raw.expiry || '',
    batch: raw.batch || '',
    // المطابقة والكشف
    matchScore: byCode ? 1 : score,
    matchedById: drug?.id || null,
    officialName: drug?.name || '',
    existingProductId: existing?.id || null,
    isExisting: !!existing,
    existingStock: existing ? existing.stock : 0,
    warnings,
    // إحصاءات الفاتورة الأصلية (للمراجعة)
    _raw: { unitPrice: raw.unitPrice, total: raw.total, cost: raw.cost },
  }
}

// =====================================================================
// ===== 5) مدخل الملفات: توزيع حسب النوع =====
// =====================================================================
/**
 * تحليل ملف مخزون/فاتورة مدعوم → { rows, source }
 * @param {File} file xlsx/xls/csv/docx/pdf
 */
export async function parseStockFile(file) {
  const name = String(file?.name || '').toLowerCase()
  if (/\.(xlsx|xls|csv)$/.test(name)) return parseSpreadsheet(file)
  if (/\.docx?$/.test(name)) return parseWordDoc(file)
  if (/\.pdf$/.test(name)) return parsePdf(file)
  if (/\.(txt)$/.test(name)) {
    const text = await file.text()
    return { rows: parseInvoiceText(text), source: 'txt' }
  }
  throw new Error('unsupported_file_type')
}

async function parseSpreadsheet(file) {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', raw: false })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { rows: [], source: 'sheet' }
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })
  return { rows: rowsFromMatrix(matrix), source: 'sheet' }
}

async function parseWordDoc(file) {
  const mammoth = await import('mammoth')
  const buf = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buf })
  return { rows: parseInvoiceText(result.value || ''), source: 'docx' }
}

async function parsePdf(file) {
  const pdfjs = await import('pdfjs-dist')
  // عامل WebWorker: يُحمَّل كأصل ثابت عبر Vite (؟url) — وإلا المعالجة المتزامنة
  try {
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    if (workerUrl) pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  } catch { /* متزامن احتياطي */ }
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  let text = ''
  for (let p = 1; p <= Math.min(doc.numPages, 30); p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    // إعادة بناء السطور من مواضع العناصر (y متقارب = سطر واحد)
    const lines = new Map()
    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue
      const y = Math.round(item.transform[5] / 4) // تسامح عمودي
      if (!lines.has(y)) lines.set(y, [])
      lines.get(y).push({ x: item.transform[4], s: item.str })
    }
    const sorted = [...lines.entries()].sort((a, b) => b[0] - a[0])
    for (const [, parts] of sorted) {
      text += parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(' ') + '\n'
    }
  }
  return { rows: parseInvoiceText(text), source: 'pdf' }
}

/**
 * تحليل رد OCR (نص خام أو JSON منظّم من نموذج الرؤية)
 */
export const parseOcrOutput = (text) => {
  const raw = String(text || '')
  // محاولة JSON أولاً (نموذج الرؤية يُوجَّه لإخراج JSON)
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[0])
      if (Array.isArray(arr) && arr.length > 0 && arr.some((o) => o && (o.name || o.designation || o.nom))) {
        return arr.map((o) => ({
          name: String(o.name || o.designation || o.nom || o.product || '').trim(),
          quantity: parseNumber(o.quantity ?? o.qty ?? o.qte ?? o.quantite) ?? 1,
          unitPrice: parseNumber(o.unitPrice ?? o.price ?? o.prix ?? o.pu),
          cost: parseNumber(o.cost),
          total: parseNumber(o.total ?? o.montant),
          expiry: parseExpiry(o.expiry || o.expiration || o.peremption || o.expirationDate),
          batch: String(o.batch || o.lot || '').trim().slice(0, 40),
          barcode: String(o.barcode || o.code || o.cip || '').replace(/\D/g, '').slice(0, 13),
        })).filter((r) => r.name && r.name.length >= 2)
      }
    } catch { /* سقوط لتحليل النص الحر */ }
  }
  return parseInvoiceText(raw)
}
