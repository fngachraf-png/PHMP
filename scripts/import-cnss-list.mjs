#!/usr/bin/env node
/**
 * =====================================================================
 * سحب لائحة أدوية CNSS الرسمية (الأدوية المؤهلة للتعويض — 8991 دواء)
 * =====================================================================
 * المصدر الرسمي: https://www.cnss.ma/ar/لائحة-الأدوية-القابلة-للتعويض
 * (وأيضا: https://www.cnss.ma/fr/listes-des-medicaments)
 *
 * ⚠️ مهم: خوادم CNSS تحجب الاتصالات الصادرة من مراكز البيانات السحابية
 * (تم التحقق: حجب كامل من AWS/Vercel وغيرها). لذلك يُشغَّل هذا السكريبت
 * من شبكة محلية مغربية (جهاز المالك) حيث الموقع متاح:
 *
 *    node scripts/import-cnss-list.mjs                       # سحب مباشر من cnss.ma
 *    node scripts/import-cnss-list.mjs --file صفحة.html      # من صفحة محفوظة (Ctrl+S)
 *    node scripts/import-cnss-list.mjs --file لائحة.csv      # من ملف CSV
 *    node scripts/import-cnss-list.mjs --out src/data/cnssMedicines.js
 *
 * بعد التوليد: أعد بناء الواجهة (npm run build) — يلتقطها "المنتقي الرسمي"
 * في نافذة إضافة دواء تلقائيا، وتظهر شارة «CNSS • قابل للتعويض» على الأدوية.
 *
 * بنية الإخراج (لكل دواء): { code, lab, name, dci, dosage, form,
 *                            presentation, ppv, ph }
 * يُدمج مع قاعدة المنصة (moroccanDrugs) عبر كود CIP (الباركود) في
 * src/lib/officialCatalog.js — بلا أي ازدواجية.
 * =====================================================================
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const args = process.argv.slice(2)
const argOf = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : null
}
const URL_ARG = argOf('--url') || 'https://www.cnss.ma/fr/listes-des-medicaments'
const FILE_ARG = argOf('--file')
const OUT_ARG = argOf('--out') || path.join(ROOT, 'src', 'data', 'cnssMedicines.js')

// ---------- أدوات عامة ----------
const clean = (s) => String(s ?? '')
  .replace(/<[^>]*>/g, ' ')          // إزالة وسوم HTML داخل الخلايا
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/\s+/g, ' ')
  .trim()

// أرقام بتنسيق فرنسي/عربي: "2.882,00" أو "2 882,00" أو "2,882.00" → 2882.00
const toNum = (s) => {
  if (s === null || s === undefined) return null
  let t = String(s).replace(/[^\d.,\-]/g, '')
  if (!t) return null
  if (t.includes(',') && t.includes('.')) {
    t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  } else if (t.includes(',')) {
    t = t.replace(/\s/g, '').replace(',', '.')
  }
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

// ---------- قراءة المدخل ----------
const readInput = async () => {
  if (FILE_ARG) {
    return fs.readFileSync(path.resolve(FILE_ARG), 'utf-8')
  }
  console.log(`⏳ سحب اللائحة من: ${URL_ARG}`)
  const res = await fetch(URL_ARG, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,ar;q=0.8',
      Referer: 'https://www.cnss.ma/',
      'Upgrade-Insecure-Requests': '1',
    },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`فشل السحب: HTTP ${res.status}`)
  const html = await res.text()
  console.log(`   تم استلام ${Math.round(html.length / 1024)} KB`)
  return html
}

// ---------- استخراج الجداول من HTML ----------
const extractTables = (html) => {
  const tables = []
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi
  let tm
  while ((tm = tableRe.exec(html)) !== null) {
    const rows = []
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    let rm
    while ((rm = rowRe.exec(tm[1])) !== null) {
      const cells = []
      const cellRe = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi
      let cm
      while ((cm = cellRe.exec(rm[1])) !== null) cells.push(clean(cm[1]))
      if (cells.length > 0) rows.push(cells)
    }
    if (rows.length > 1) tables.push(rows)
  }
  return tables
}

// ---------- قراءة CSV (كشف الفاصل تلقائياً) ----------
const parseCSV = (text) => {
  const delim = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ','
  const rows = []
  let row = [], cell = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') inQ = false
      else cell += c
    } else if (c === '"') inQ = true
    else if (c === delim) { row.push(cell.trim()); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell.trim()); cell = ''
      if (row.some((x) => x !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell.trim())
  if (row.some((x) => x !== '')) rows.push(row)
  return rows
}

// ---------- مطابقة الأعمدة (فرنسية + عربية) ----------
const COLUMN_MATCHERS = {
  code: [/^\s*code/i, /cip/i, /الرمز|الشفرة|الباركود/, /^\s*code\s*cl/i],
  lab: [/labo/i, /laboratoire/i, /الشركة|المختبر|المعامل/],
  name: [/^(nom|d[eé]nomination)/i, /m[ée]dicament/i, /sp[ée]cialit[ée]/i, /اسم الدواء|الدواء|التسمية/],
  dci: [/^dci/i, /substance/i, /المادة|الاسم العلمي|دي سي آي/],
  dosage: [/dosage/i, /dose/i, /الجرعة|التركيز/],
  form: [/forme/i, /الشكل الصيدلاني|الشكل/],
  presentation: [/pr[ée]sentation/i, /cond/i, /العبوة|التعبئة/],
  ppv: [/ppv/i, /prix.*vente/i, /سعر البيع/],
  ph: [/^ph\b/i, /prix.*hop/i, /prix.*h[ôo]pital/i, /سعر المستشفى/],
}

const matchColumns = (headerRow) => {
  const map = {}
  headerRow.forEach((h, idx) => {
    const hh = h.toLowerCase()
    for (const [field, patterns] of Object.entries(COLUMN_MATCHERS)) {
      if (map[field] === undefined && patterns.some((p) => p.test(hh) || p.test(h))) {
        map[field] = idx
      }
    }
  })
  return map
}

// ---------- المعالجة الرئيسية ----------
const run = async () => {
  const input = await readInput()
  const isCSV = FILE_ARG ? /\.(csv|txt)$/i.test(FILE_ARG) : false
  const tables = isCSV ? [parseCSV(input)] : extractTables(input)
  console.log(`📦 جدول(ات) مكتشفة: ${tables.length}`)

  let best = null
  for (const rows of tables) {
    // جرب أول 5 صفوف كترويسة محتملة
    for (let h = 0; h < Math.min(5, rows.length); h++) {
      const map = matchColumns(rows[h])
      const hasEssential = map.code !== undefined && map.name !== undefined
      if (hasEssential && (!best || rows.length > best.rows.length)) {
        best = { header: h, map, rows }
      }
    }
  }
  if (!best) {
    console.error('❌ لم يُعثر على جدول الأدوية. تأكد أن الملف هو صفحة اللائحة أو CSV لها.')
    console.error('   الأعمدة المتوقعة: CODE/CIP, LABORATOIRE, NOM, DCI, DOSAGE, FORME, PRESENTATION, PPV, PH')
    process.exit(1)
  }

  const { header, map, rows } = best
  const get = (row, field) => (map[field] !== undefined ? row[map[field]] ?? '' : '')
  const medicines = []
  const seen = new Set()
  for (let i = header + 1; i < rows.length; i++) {
    const row = rows[i]
    const code = String(get(row, 'code')).replace(/\D/g, '')
    const name = get(row, 'name')
    if (!code || code.length < 7 || !name) continue
    if (seen.has(code)) continue
    seen.add(code)
    medicines.push({
      code,
      lab: get(row, 'lab'),
      name,
      dci: get(row, 'dci'),
      dosage: get(row, 'dosage'),
      form: get(row, 'form'),
      presentation: get(row, 'presentation'),
      ppv: toNum(get(row, 'ppv')),
      ph: toNum(get(row, 'ph')),
    })
  }

  if (medicines.length === 0) {
    console.error('❌ لم تُستخرج أي أدوية — راجع بنية الملف.')
    process.exit(1)
  }

  const header_comment = `// =====================================================================
// لائحة أدوية CNSS الرسمية — الأدوية المؤهلة للتعويض
// المصدر: ${FILE_ARG ? `ملف محلي (${FILE_ARG})` : URL_ARG}
// عدد الأدوية: ${medicines.length}
// تاريخ السحب: ${new Date().toISOString()}
//
// يُولَّد آلياً بواسطة: node scripts/import-cnss-list.mjs
// لا تحرر يدوياً — أعد التوليد لتحديث اللائحة من المصدر الرسمي.
// يُدمج مع قاعدة المنصة في src/lib/officialCatalog.js عبر كود CIP.
// =====================================================================
`

  const body = `export const cnssMedicines = ${JSON.stringify(medicines)}

export const CNSS_META = {
  source: ${JSON.stringify(FILE_ARG ? 'ملف محلي' : URL_ARG)},
  count: ${medicines.length},
  importedAt: ${JSON.stringify(new Date().toISOString())},
}
`
  fs.mkdirSync(path.dirname(OUT_ARG), { recursive: true })
  fs.writeFileSync(OUT_ARG, header_comment + body, 'utf-8')

  const withPpv = medicines.filter((m) => m.ppv).length
  console.log(`✅ تم استخراج ${medicines.length} دواء (منها ${withPpv} بسعر PPV) → ${path.relative(ROOT, OUT_ARG)}`)
  console.log(`   عينة: ${medicines[0].code} | ${medicines[0].name} | ${medicines[0].dci}`)
  console.log('   أعد بناء الواجهة (npm run build) ثم ادفع التغيير لتفعيلها في المنتقي الرسمي.')
}

run().catch((e) => {
  console.error('❌', e.message)
  console.error('   إن فشل السحب المباشر من هذه الشبكة (CNSS تحجب السحابة)، احفظ صفحة اللائحة من المتصفح ثم:')
  console.error('   node scripts/import-cnss-list.mjs --file <الصفحة-المحفوظة>.html')
  process.exit(1)
})
