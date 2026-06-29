/**
 * سكريبت معالجة لائحة الأدوية الرسمية المغربية
 * Moroccan Official Drug List Processor
 *
 * Converts the official Moroccan drug list (CSV from Ministry of Health)
 * into a format compatible with the PharmaCare Pro pharmacy system.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CSV_PATH = path.join(__dirname, 'data', 'moroccan_drugs.csv')
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'moroccanDrugs.js')

// ===========================================
// 1. CSV Parser (handles quoted fields with commas)
// ===========================================
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim())
  const headers = parseCSVLine(lines[0])
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === headers.length) {
      const row = {}
      headers.forEach((h, idx) => {
        row[h] = values[idx]
      })
      rows.push(row)
    }
  }
  return rows
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

// ===========================================
// 2. Parse Prices (handle "1,234.56" format)
// ===========================================
function parsePrice(priceStr) {
  if (!priceStr) return 0
  // Remove quotes and spaces
  const cleaned = priceStr.replace(/['"\s]/g, '').replace(/,/g, '.')
  // Remove any trailing commas that may be left
  const num = parseFloat(cleaned.replace(/[^\d.]/g, ''))
  return isNaN(num) ? 0 : num
}

// ===========================================
// 3. Arabic Drug Name Dictionary
//    (most common DCI -> Arabic translations)
// ===========================================
const ARABIC_TRANSLATIONS = {
  // Painkillers / Analgesics
  'PARACETAMOL': 'باراسيتامول',
  'IBUPROFENE': 'إيبوبروفين',
  'IBUPROFEN': 'إيبوبروفين',
  'ASPIRIN': 'أسبرين',
  'ACIDE ACETYLSALICYLIQUE': 'حمض الأسيتيل ساليسيليك',
  'DICLOFENAC': 'ديكلوفيناك',
  'KETOPROFENE': 'كيتوبروفين',
  'TRAMADOL': 'ترامادول',
  'MORPHINE': 'مورفين',
  'CODEINE': 'كودايين',
  'NEFOPAM': 'نيفوبام',

  // Antibiotics
  'AMOXICILLINE': 'أموكسيسيلين',
  'AMOXICILLINE / ACIDE CLAVULANIQUE': 'أموكسيسيلين + حمض الكلافولانيك',
  'AMPICILLINE': 'أمبيسيلين',
  'AZITHROMYCINE': 'أزيثروميسين',
  'CIPROFLOXACINE': 'سيبروفلوكساسين',
  'LEVOFLOXACINE': 'ليفوفلوكساسين',
  'DOXYCYCLINE': 'دوكسيسيكلين',
  'CEFACLOR': 'سيفاكلور',
  'CEFOTAXIME': 'سيفوتاكسيم',
  'CEFTRIAXONE': 'سيفترياكسون',
  'FLUCLOXACILLINE': 'فلوكلوكساسيلين',
  'GENTAMYCINE': 'جنتاميسين',
  'METRONIDAZOLE': 'ميترونيدازول',

  // Cardiovascular
  'AMLODIPINE': 'أملوديبين',
  'ATENOLOL': 'أتينولول',
  'PROPRANOLOL': 'بروبرانولول',
  'ENALAPRIL': 'إينالابريل',
  'PERINDOPRIL': 'بيريندوبريل',
  'LISINOPRIL': 'ليسينوبريل',
  'LOSARTAN': 'لوزارتان',
  'VALSARTAN': 'فالسارتان',
  'SIMVASTATINE': 'سيمفاستاتين',
  'ATORVASTATINE': 'أتورفاستاتين',
  'FUROSEMIDE': 'فurosemide',
  'HYDROCHLOROTHIAZIDE': 'هيدروكلوروثيازيد',
  'INDAPAMIDE': 'إنداباميد',
  'DIGOXINE': 'ديجوكسين',
  'AMIODARONE': 'أميودارون',
  'NIFEDIPINE': 'نيفيديبين',

  // Diabetes
  'METFORMINE': 'ميتفورمين',
  'GLIBENCLAMIDE': 'جليبنكلاميد',
  'GLIMEPIRIDE': 'جليميبيريد',
  'INSULINE HUMAINE': 'أنسولين بشري',
  'GLICLAZIDE': 'جليكلازيد',
  'PIOGLITAZONE': 'بيوجليتازون',

  // GI
  'OMEPRAZOLE': 'أوميبرازول',
  'LANSOPRAZOLE': 'لانزوبرازول',
  'PANTOPRAZOLE': 'بانتوبرازول',
  'ESOMEPRAZOLE': 'إيزوميبرازول',
  'RANITIDINE': 'رانيتيدين',
  'DOMPERIDONE': 'دومبيريدون',
  'METOCLOPRAMIDE': 'ميتوكلوبراميد',
  'LOPERAMIDE': 'لوبيراميد',

  // Respiratory
  'SALBUTAMOL': 'سالبوتامول',
  'AMBROXOL': 'أمبروكسول',
  'ACETYLCYSTEINE': 'أستيل سيستايين',
  'CHLORPHENAMINE': 'كلورفينيرامين',
  'CETIRIZINE': 'سيتريزين',
  'LORATADINE': 'لوراتادين',
  'MONTELUKAST': 'مونتيلوكاست',

  // CNS
  'DIAZEPAM': 'ديازيبام',
  'ALPRAZOLAM': 'ألبرازولام',
  'CLONAZEPAM': 'كلونازيبام',
  'BROMAZEPAM': 'برومازيبام',
  'FLUOXETINE': 'فلوكسيتين',
  'PAROXETINE': 'باروكسيتين',
  'SERTRALINE': 'سيرترالين',
  'VENLAFAXINE': 'فينلافاكسين',
  'CARBAMAZEPINE': 'كاربامازيبين',
  'PHENOBARBITAL': 'فينوباربيتال',
  'PHENYTOINE': 'فينيتوين',

  // Vitamins
  'ACIDE ASCORBIQUE': 'حمض الأسكوربيك (فيتامين C)',
  'THIAMINE': 'فيتامين B1',
  'PYRIDOXINE': 'فيتامين B6',
  'CYANOCOBALAMINE': 'فيتامين B12',
  'COLECALCIFEROL': 'فيتامين D3',
  'RETINOL': 'فيتامين A',
  'TOCOPHEROL': 'فيتامين E',
  'ACIDE FOLIQUE': 'حمض الفوليك',
  'CALCIUM': 'كالسيوم',
  'FER': 'حديد',

  // Antifungals
  'FLUCONAZOLE': 'فلوكونازول',
  'ITRACONAZOLE': 'إيتراكونازول',
  'KETOCONAZOLE': 'كيتوكونازول',
  'TERBINAFINE': 'تيربينافين',
  'NYSTATINE': 'نيستاتين',

  // Anti-inflammatory
  'PREDNISOLONE': 'بريدنيزولون',
  'PREDNISONE': 'بريدنيزون',
  'DEXAMETHASONE': 'ديكساميثازون',
  'BETAMETHASONE': 'بيتاميثازون',
  'HYDROCORTISONE': 'هيدروكورتيزون',

  // Diabetes / Other
  'LEVOTHYROXINE': 'ليفوثيروكسين',
  'ALLOPURINOL': 'ألوبيورينول',
  'COLCHICINE': 'كولشيسين',

  // Anesthetics
  'LIDOCAINE': 'ليدوكايين',
  'PROCAINE': 'بروكايين',

  // Misc
  'EAU POUR PREPARATION INJECTABLE': 'ماء للتحضير الحقني',
  'CHLORURE DE SODIUM': 'كلوريد الصوديوم',
  'RINGER': 'محلول رينجر',
  'GLUCOSE': 'جلوكوز',
}

// ===========================================
// 4. Category Classifier
//    (Map DCI -> therapeutic category)
// ===========================================
const DCI_CATEGORY_MAP = [
  { keywords: ['PARACETAMOL', 'IBUPROFEN', 'IBUPROFENE', 'ASPIRIN', 'ACIDE ACETYLSALICYLIQUE', 'TRAMADOL', 'MORPHINE', 'CODEINE', 'KETOPROFENE', 'NEFOPAM', 'DICLOFENAC'], category: 'painkillers' },
  { keywords: ['AMOXICILLINE', 'AMPICILLINE', 'AZITHROMYCINE', 'CIPROFLOXACINE', 'LEVOFLOXACINE', 'DOXYCYCLINE', 'CEFACLOR', 'CEFOTAXIME', 'CEFTRIAXONE', 'CEFAZOLINE', 'FLUCLOXACILLINE', 'GENTAMYCINE', 'METRONIDAZOLE', 'CEFIXIME', 'ERITHROMYCINE', 'CLARITHROMYCINE', 'ACIDE CLAVULANIQUE'], category: 'antibiotics' },
  { keywords: ['METFORMINE', 'GLIBENCLAMIDE', 'GLIMEPIRIDE', 'INSULINE', 'GLICLAZIDE', 'PIOGLITAZONE'], category: 'diabetes' },
  { keywords: ['AMLODIPINE', 'ATENOLOL', 'PROPRANOLOL', 'ENALAPRIL', 'PERINDOPRIL', 'LISINOPRIL', 'LOSARTAN', 'VALSARTAN', 'SIMVASTATINE', 'ATORVASTATINE', 'FUROSEMIDE', 'INDAPAMIDE', 'DIGOXINE', 'AMIODARONE', 'NIFEDIPINE', 'RAMIPRIL', 'BISOPROLOL', 'CANDESARTAN', 'IRBESARTAN', 'TELMISARTAN'], category: 'cardiology' },
  { keywords: ['OMEPRAZOLE', 'LANSOPRAZOLE', 'PANTOPRAZOLE', 'ESOMEPRAZOLE', 'RANITIDINE', 'DOMPERIDONE', 'METOCLOPRAMIDE', 'LOPERAMIDE', 'SMECTA', 'DIOSMECTITE'], category: 'gastro' },
  { keywords: ['SALBUTAMOL', 'AMBROXOL', 'ACETYLCYSTEINE', 'CHLORPHENAMINE', 'CETIRIZINE', 'LORATADINE', 'MONTELUKAST', 'THEOPHYLLINE', 'BROMHEXINE'], category: 'cold_flu' },
  { keywords: ['DIAZEPAM', 'ALPRAZOLAM', 'CLONAZEPAM', 'BROMAZEPAM', 'FLUOXETINE', 'PAROXETINE', 'SERTRALINE', 'VENLAFAXINE', 'CARBAMAZEPINE', 'PHENOBARBITAL', 'PHENYTOINE', 'RISPERIDONE', 'OLANZAPINE', 'HALOPERIDOL', 'CHLORPROMAZINE'], category: 'neuro' },
  { keywords: ['FLUCONAZOLE', 'ITRACONAZOLE', 'KETOCONAZOLE', 'TERBINAFINE', 'NYSTATINE', 'MICONAZOLE'], category: 'antifungal' },
  { keywords: ['PREDNISOLONE', 'PREDNISONE', 'DEXAMETHASONE', 'BETAMETHASONE', 'HYDROCORTISONE'], category: 'hormones' },
  { keywords: ['LEVOTHYROXINE', 'ALLOPURINOL', 'COLCHICINE'], category: 'other' },
  { keywords: ['ACIDE ASCORBIQUE', 'THIAMINE', 'PYRIDOXINE', 'CYANOCOBALAMINE', 'COLECALCIFEROL', 'RETINOL', 'TOCOPHEROL', 'ACIDE FOLIQUE', 'CALCIUM', 'FER', 'MAGNESIUM', 'ZINC'], category: 'vitamins' },
  { keywords: ['LIDOCAINE', 'PROCAINE', 'BUPIVACAINE'], category: 'anesthetic' },
]

// Pharma form mapping
const FORM_CATEGORY_HINTS = {
  'SUPPOSITOIRE': 'other',
  'POMMADE': 'skincare',
  'CREME': 'skincare',
  'GEL': 'skincare',
  'COLLYRE': 'eye',
  'SIROP': 'cold_flu',
  'SUSPENSION BUVABLE': 'cold_flu',
  'POUDRE POUR SUSPENSION BUVABLE': 'cold_flu',
  'SOLUTION BUVABLE': 'cold_flu',
  'GRLES': 'cold_flu',
}

function classifyDrug(dci, form) {
  const upperDCI = (dci || '').toUpperCase()

  // 1. Try DCI keyword matching
  for (const rule of DCI_CATEGORY_MAP) {
    for (const keyword of rule.keywords) {
      if (upperDCI.includes(keyword)) {
        return rule.category
      }
    }
  }

  // 2. Try pharmaceutical form hints
  for (const [formKey, cat] of Object.entries(FORM_CATEGORY_HINTS)) {
    if ((form || '').toUpperCase().includes(formKey)) {
      return cat
    }
  }

  // 3. Default
  return 'other'
}

// ===========================================
// 5. Determine if prescription required
// ===========================================
function requiresPrescription(tauxRemb, category) {
  // Reimbursed drugs (70%) typically require prescription in Morocco
  // Plus antibiotics always require prescription
  if (category === 'antibiotics') return true
  if (tauxRemb === '70%') return true
  // Some categories typically Rx
  const rxCategories = ['cardiology', 'diabetes', 'neuro', 'hormones']
  if (rxCategories.includes(category)) return true
  return false
}

// ===========================================
// 6. Generate realistic stock and metadata
// ===========================================
function generateStock(productId) {
  // Deterministic random based on ID
  let hash = 0
  for (let i = 0; i < productId.length; i++) {
    hash = ((hash << 5) - hash) + productId.charCodeAt(i)
    hash = hash & hash
  }
  const r = Math.abs(hash)
  return {
    stock: r % 250 + 10,         // 10-260
    minStock: 10 + (r % 30),     // 10-40
    expiryMonths: 6 + (r % 30),  // 6-36 months
  }
}

// ===========================================
// 7. Translate DCI to Arabic
// ===========================================
function translateToArabic(dci) {
  if (!dci) return ''
  const upper = dci.toUpperCase().trim()

  // Direct match
  if (ARABIC_TRANSLATIONS[upper]) return ARABIC_TRANSLATIONS[upper]

  // Partial match (for combinations)
  for (const [key, value] of Object.entries(ARABIC_TRANSLATIONS)) {
    if (upper.includes(key)) return value
  }

  return dci // fallback to original
}

// ===========================================
// 8. Infer manufacturer from brand name
// ===========================================
const KNOWN_MANUFACTURERS = [
  'SANOFI', 'PFIZER', 'GSK', 'GLAXOSMITHKLINE', 'NOVARTIS', 'MERCK', 'ROCHE',
  'ASTRAZENECA', 'BAYER', 'BOEHRINGER', 'ABBOTT', 'JOHNSON', 'BRISTOL',
  'LILLY', 'ELI', 'SQUIBB', 'WYETH', 'SANDOZ', 'TEVA', 'MYLAN',
  'SERP', 'MEDIPHARM', 'SOTHEMA', 'PHARMALINE', 'GENPHARMA', 'WINTHROP',
  'COOPER', 'BIOTECH', 'PHARMA', 'AGUETTANT'
]

function inferManufacturer(brandName) {
  const upper = (brandName || '').toUpperCase()
  for (const mfr of KNOWN_MANUFACTURERS) {
    if (upper.includes(mfr)) return mfr
  }
  return 'غير محدد / Not specified'
}

// ===========================================
// MAIN PROCESSING
// ===========================================
console.log('📂 Reading CSV file...')
const csvText = fs.readFileSync(CSV_PATH, 'utf-8')
console.log(`✓ Read ${(csvText.length / 1024).toFixed(1)} KB`)

console.log('🔍 Parsing CSV...')
const rawData = parseCSV(csvText)
console.log(`✓ Parsed ${rawData.length} drugs`)

console.log('🔄 Transforming data...')
const drugs = rawData.map((row, idx) => {
  const ppv = parsePrice(row.PPV)
  const ph = parsePrice(row.PH)
  const prixBR = parsePrice(row.PRIX_BR)

  // Build product name with dosage info
  const dosageStr = row.DOSAGE1 && row.UNITE_DOSAGE1
    ? ` ${row.DOSAGE1}${row.UNITE_DOSAGE1}`
    : ''

  const productNameFr = `${row.NOM}${dosageStr}`.trim()
  const productNameAr = `${translateToArabic(row.DCI1)}${dosageStr}`.trim()

  const category = classifyDrug(row.DCI1, row.FORME)
  const taux = row.TAUX_REMBOURSEMENT || '0%'
  const requiresRx = requiresPrescription(taux, category)
  const meta = generateStock(row.CODE)

  // Calculate expiry date
  const expiryDate = new Date()
  expiryDate.setMonth(expiryDate.getMonth() + meta.expiryMonths)

  // Cost is typically 60-70% of selling price
  const cost = ppv > 0 ? Math.round(ppv * 0.65 * 100) / 100 : 0
  const price = ppv > 0 ? ppv : (prixBR > 0 ? prixBR : 0)

  return {
    id: `ma-${idx + 1}`,
    code: row.CODE,
    name: productNameAr,
    nameEn: productNameFr,
    nameAr: productNameAr,
    nameFr: row.NOM,
    dci: row.DCI1,
    dosage: dosageStr.trim(),
    dosageAmount: row.DOSAGE1,
    dosageUnit: row.UNITE_DOSAGE1,
    form: row.FORME,
    presentation: row.PRESENTATION,
    barcode: row.CODE,
    sku: `MA-${row.CODE}`,
    manufacturer: inferManufacturer(row.NOM),
    category: category,
    cost: cost,
    price: price,
    ppv: ppv,
    ph: ph,
    prixBR: prixBR,
    princepsGenerique: row.PRINCEPS_GENERIQUE, // P = brand, G = generic
    tauxRemboursement: taux,
    stock: meta.stock,
    minStock: meta.minStock,
    expiry: expiryDate.toISOString().split('T')[0],
    batch: `BTH-${new Date().getFullYear()}-${(idx % 999).toString().padStart(3, '0')}`,
    requiresPrescription: requiresRx,
    dosage: row.DOSAGE1 && row.UNITE_DOSAGE1
      ? `${row.DOSAGE1}${row.UNITE_DOSAGE1}`
      : (row.FORME || ''),
  }
})

console.log(`✓ Transformed ${drugs.length} drugs`)

// ===========================================
// 9. Statistics
// ===========================================
const stats = {
  total: drugs.length,
  byCategory: {},
  byForm: {},
  withPrice: drugs.filter(d => d.price > 0).length,
  princeps: drugs.filter(d => d.princepsGenerique === 'P').length,
  generic: drugs.filter(d => d.princepsGenerique === 'G').length,
  reimbursed70: drugs.filter(d => d.tauxRemboursement === '70%').length,
}

drugs.forEach(d => {
  stats.byCategory[d.category] = (stats.byCategory[d.category] || 0) + 1
  stats.byForm[d.form] = (stats.byForm[d.form] || 0) + 1
})

console.log('\n📊 Statistics:')
console.log(`   Total drugs: ${stats.total}`)
console.log(`   With pricing: ${stats.withPrice}`)
console.log(`   Princeps (brand): ${stats.princeps}`)
console.log(`   Generic: ${stats.generic}`)
console.log(`   70% reimbursed: ${stats.reimbursed70}`)
console.log('\n   By category:')
Object.entries(stats.byCategory)
  .sort((a, b) => b[1] - a[1])
  .forEach(([cat, count]) => console.log(`     ${cat}: ${count}`))

// ===========================================
// 10. Generate Output File
// ===========================================
const outputContent = `// Auto-generated from official Moroccan drug list (Ministère de la Santé)
// Generated on: ${new Date().toISOString()}
// Source: https://docs.google.com/spreadsheets/d/1CWOWRn4xdJdpewdpggu_pREUicyAJpvf
// Total drugs: ${drugs.length}

export const moroccanDrugs = ${JSON.stringify(drugs, null, 0)}

export const drugStats = ${JSON.stringify(stats, null, 2)}
`

fs.writeFileSync(OUTPUT_PATH, outputContent, 'utf-8')

const fileSize = fs.statSync(OUTPUT_PATH).size
console.log(`\n✅ Output saved to: ${OUTPUT_PATH}`)
console.log(`   File size: ${(fileSize / 1024).toFixed(1)} KB`)
console.log(`\n🎉 Done! ${drugs.length} drugs ready for the pharmacy system.`)
