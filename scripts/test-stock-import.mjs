// =====================================================================
// اختبار محللات الاستيراد الذكي (stockImportParsers) — بالقياس
// ---------------------------------------------------------------------
// نسخ ESM مؤقتة للوحدات ثم: الأرقام والتواريخ الفرنسية/العربية، تحليل
// سطور الفواتير، كشف ترويسات الجداول بالثلاث لغات، مخرجات OCR (JSON
// ونص حر)، المطابقة الضبابية مع اللائحة الرسمية، وبناء صفوف الاستيراد
// مع كشف المخزون القائم والتحذيرات.
// =====================================================================
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const TMP = '/tmp/phmp-import-test'

// نسخة ESM قابلة للاستيراد من Node (الجذر بلا type:module)
fs.rmSync(TMP, { recursive: true, force: true })
fs.mkdirSync(path.join(TMP, 'src/lib'), { recursive: true })
fs.mkdirSync(path.join(TMP, 'src/data'), { recursive: true })
fs.writeFileSync(path.join(TMP, 'package.json'), JSON.stringify({ type: 'module' }))
let parserSrc = fs.readFileSync(path.join(ROOT, 'src/lib/stockImportParsers.js'), 'utf8')
// Node ESM يتطلب امتدادات صريحة (Vite لا يمانع — لكن النسخة للاختبار فقط)
parserSrc = parserSrc.replaceAll("'../data/moroccanDrugs'", "'../data/moroccanDrugs.js'")
parserSrc = parserSrc.replaceAll("'../data/cnssMedicines'", "'../data/cnssMedicines.js'")
fs.writeFileSync(path.join(TMP, 'src/lib/stockImportParsers.js'), parserSrc)
fs.copyFileSync(path.join(ROOT, 'src/data/moroccanDrugs.js'), path.join(TMP, 'src/data/moroccanDrugs.js'))
fs.copyFileSync(path.join(ROOT, 'src/data/cnssMedicines.js'), path.join(TMP, 'src/data/cnssMedicines.js'))

const P = await import(path.join(TMP, 'src/lib/stockImportParsers.js'))
const { parseNumber, parseExpiry, parseInvoiceText, rowsFromMatrix, parseOcrOutput, matchOfficial, buildImportRow, normText } = P

let passed = 0, failed = 0
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ✅ ${name}`) }
  else { failed++; console.log(`  ❌ ${name} ${extra !== '' ? '— ' + extra : ''}`) }
}
const near = (a, b, eps = 0.001) => Math.abs(a - b) < eps

// ===== 1. parseNumber =====
ok('parseNumber «1 234,56»', near(parseNumber('1 234,56'), 1234.56))
ok('parseNumber «12,50 DH»', near(parseNumber('12,50 DH'), 12.5))
ok('parseNumber «1,500» (ألفية)', parseNumber('1,500') === 1500)
ok('parseNumber «1.234,56»', near(parseNumber('1.234,56'), 1234.56))
ok('parseNumber عربي «45 درهم»', parseNumber('45 درهم') === 45)
ok('parseNumber null للأبجدي', parseNumber('abc') === null)

// ===== 2. parseExpiry =====
ok('parseExpiry «05/2027» شهرية', P.parseExpiry('05/2027') === '2027-05-01')
ok('parseExpiry «12/09/2028»', P.parseExpiry('12/09/2028') === '2028-09-12')
ok('parseExpiry «2027-03-15»', P.parseExpiry('2027-03-15') === '2027-03-15')
ok('parseExpiry «03-26» قرن', P.parseExpiry('03/26') === '2026-03-01')
ok('parseExpiry فارغ', P.parseExpiry('') === '')

// ===== 3. parseInvoiceText (فاتورة مغربية فرنسية واقعية) =====
const invoiceFr = `PHARMACIE ATLAS - RABAT
FACTURE N° FA-2026-118
ICE: 0012345678000  RC: 12345
Client: PHARMACIE CENTRALE
--------------------------------------
DOLIPRANE 1000MG CPR 8        12  2,10  25,20
AMOXIL 500MG GEL 12          x 3  18,75  56,25
AUGMENTIN 1G CPR 14   Lot:BX2026   exp:10/2027   5  32,40  162,00
VENTOLINE 100MCG SPR  Exp: 15/03/2027  2  21,00  42,00
SMECTA 3G SACH 30             10  13,20  132,00
TOTAL TTC                    417,65
TVA 7%                        27,29
Merci de votre confiance`
const rowsFr = parseInvoiceText(invoiceFr)
ok('فاتورة فرنسية: 5 بنود (الترويسة والتجميعات مستبعدة)', rowsFr.length === 5, `got ${rowsFr.length}: ${rowsFr.map(r => r.name).join(' | ')}`)
const doliprane = rowsFr.find((r) => /doliprane/i.test(r.name))
ok('DOLIPRANE: كمية 12 وسعر 2.10', doliprane && doliprane.quantity === 12 && near(doliprane.unitPrice, 2.1))
const amoxil = rowsFr.find((r) => /amoxil/i.test(r.name))
ok('AMOXIL: كمية صريحة x3', amoxil && amoxil.quantity === 3)
const augmentin = rowsFr.find((r) => /augmentin/i.test(r.name))
ok('AUGMENTIN: دفعة + صلاحية مستخرجان', augmentin && augmentin.batch === 'BX2026' && augmentin.expiry === '2027-10-01' && augmentin.quantity === 5, JSON.stringify(augmentin))

// فاتورة عربية
const invoiceAr = `صيدلية النور
فاتورة رقم 2026-77
دوليبران 1000 ملغ علبة 8     6   2.10  12.60
أموكسيسيلين 500 ملغ      الكمية: 4    9.50  38.00
المجموع: 50.60`
const rowsAr = parseInvoiceText(invoiceAr)
ok('فاتورة عربية: بندان (المجموع مستبعد)', rowsAr.length === 2, JSON.stringify(rowsAr))
const ar1 = rowsAr[0]
ok('بند عربي: كمية وسعر', ar1 && ar1.quantity === 6 && near(ar1.unitPrice, 2.1), JSON.stringify(ar1))

// ===== 4. rowsFromMatrix (جداول بترويسات) =====
const sheetFr = [
  ['Désignation', 'Qté', 'P.U', 'Prix Achat', 'Total', 'Péremption', 'Lot', 'Code'],
  ['DOLIPRANE 500MG CPR 16', 20, 1.85, 1.55, 31.0, '12/2027', 'DL26', '3400930000001'],
  ['ASPPEGIC 1000 SACH', 8, 3.2, 2.7, 21.6, '05/2028', '', ''],
]
const mFr = rowsFromMatrix(sheetFr)
ok('جدول بترويسة فرنسية: بندان', mFr.length === 2)
ok('ترويسة فرنسية: الكمية والسعر والتاريخ والدفعة والباركود', mFr[0].quantity === 20 && near(mFr[0].unitPrice, 1.85) && mFr[0].expiry === '2027-12-01' && mFr[0].batch === 'DL26' && mFr[0].barcode === '3400930000001', JSON.stringify(mFr[0]))

const sheetAr = [
  ['الصنف', 'الكمية', 'سعر البيع', 'سعر الشراء', 'الصلاحية'],
  ['بانادول اكسترا 24', 15, 14.5, 11.8, '2027-08-01'],
]
const mAr = rowsFromMatrix(sheetAr)
ok('ترويسة عربية: بند بالسعرين', mAr.length === 1 && mAr[0].quantity === 15 && near(mAr[0].unitPrice, 14.5) && near(mAr[0].cost, 11.8), JSON.stringify(mAr))

const sheetNoHeader = [
  ['Ventoline spray', '2', '21.00', '42.00'],
  ['Rhinatec gouttes', '1', '18.30', '18.30'],
]
const mNo = rowsFromMatrix(sheetNoHeader)
ok('بلا ترويسة: تخمين الأعمدة (اسم + كمية + سعر + مجموع)', mNo.length === 2 && mNo[0].name === 'Ventoline spray' && mNo[0].quantity === 2, JSON.stringify(mNo))

// ===== 5. parseOcrOutput =====
const ocrJson = '```json\n[{"name":"DOLIPRANE 1000MG","quantity":10,"unitPrice":2.1,"total":21,"batch":"DL1","expiry":"03/2028","barcode":"3400930000029"},{"name":"CLAMOXYL 1G","quantity":4,"unitPrice":22.5,"total":90}]\n```'
const ocrRows = parseOcrOutput(ocrJson)
ok('OCR JSON: بندان بكل الحقول', ocrRows.length === 2 && ocrRows[0].quantity === 10 && ocrRows[0].expiry === '2028-03-01' && ocrRows[0].batch === 'DL1')
ok('OCR JSON: بند بلا دفعة/صلاحية', ocrRows[1].batch === '' && ocrRows[1].expiry === '')
const ocrRaw = parseOcrOutput('DOLIPRANE 1000MG CPR 8   6  2,10  12,60\nTOTAL 12,60')
ok('OCR نص حر: بند واحد (TOTAL مستبعد)', ocrRaw.length === 1 && ocrRaw[0].quantity === 6)

// ===== 6. matchOfficial (اللائحة الرسمية الفعلية) =====
// اللائحة تخزن الاسم العربي/العلمي في name والعلامة في nameEn —
// نستعمل أسماء موثقة الوجودة فعلياً (تم التحقق منها في القاعدة)
const m1 = await matchOfficial('DOLIPRANE 300MG')
ok('مطابقة: DOLIPRANE 300MG موجودة باللائحة (nameEn مطابق)', m1.drug && m1.score >= 0.85, `score=${m1.score} name=${m1.drug?.name}`)
const m1b = await matchOfficial('AUGMENTIN 500 / 125MG / MG')
ok('مطابقة: AUGMENTIN بالعلامة التجارية', m1b.drug && m1b.score >= 0.55, `score=${m1b.score} name=${m1b.drug?.name}`)
const m2 = await matchOfficial('دواء خيالي غير موجود إطلاقاً xyz123')
ok('مطابقة: غير معروف → درجة منخفضة', !m2.drug || m2.score < 0.55, `score=${m2.score}`)
const m3 = await matchOfficial('ما Whatever 3000ML', '6118001230068')
ok('مطابقة بالباركود: قاطعة (1.0)', m3.drug && m3.score === 1 && m3.byCode === true, `score=${m3.score}`)
const m4 = await matchOfficial('ELOXATINE 5 MG/ML 200MG')
ok('مطابقة: اسم علمي فرنسي دقيق', m4.drug && m4.score >= 0.85, `score=${m4.score} got=${m4.drug?.name}`)

// ===== 7. buildImportRow: كشف المخزون القائم + التحذيرات =====
const existing = [
  { id: 'p-exist-1', name: 'DOLIPRANE 1000MG CPR 8', dosage: '1000MG', barcode: '3400930000029', stock: 40, cost: 2, price: 2.6 },
]
const b1 = await buildImportRow({ name: 'DOLIPRANE 1000MG CPR 8', quantity: 12, unitPrice: 2.1, total: null, cost: null, expiry: '', batch: '', barcode: '3400930000029' }, existing)
ok('بناء الصف: صنف قائم بالباركود → تزويد (isExisting)', b1.isExisting && b1.existingProductId === 'p-exist-1' && b1.existingStock === 40, JSON.stringify({ isE: b1.isExisting, id: b1.existingProductId }))
ok('بناء الصف: الكمية والسعر من الفاتورة', b1.quantity === 12 && near(b1.cost, 2.1))
const b2 = await buildImportRow({ name: 'دواء خيالي غير موجود xyz', quantity: 0, unitPrice: null, cost: null, total: null, expiry: '2020-01-01', batch: '', barcode: '' }, existing)
ok('بناء الصف: تحذيرات (مجهول + كمية + سعر + منتهي)', b2.warnings.includes('unknownDrug') && b2.warnings.includes('invalidQuantity') && b2.warnings.includes('missingPrice') && b2.warnings.includes('expired'), JSON.stringify(b2.warnings))
const b3 = await buildImportRow({ name: 'ASPREGIC 1000 SACHETS', quantity: 5, unitPrice: null, cost: null, total: null, expiry: '', batch: '', barcode: '' }, existing)
ok('بناء الصف: سعر من الكتالوج عند غيابه بالفاتورة (تقدير 80% من PPV)', b3.cost > 0 && b3.price >= b3.cost, `cost=${b3.cost} price=${b3.price}`)

console.log(`\n📊 النتيجة: ${passed} ناجح، ${failed} فاشل`)
process.exit(failed ? 1 : 0)
