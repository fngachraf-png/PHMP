// =====================================================================
// PHMP — نافذة الاستيراد الذكي للمخزون (تكليف المالك v2.3.0)
// ---------------------------------------------------------------------
// ثلاث بوابات لإضافة دواء واحد أو عدة أدوية دفعة واحدة:
//   1) اللائحة الرسمية الموحدة (5917 دواء + CNSS) — بحث واختيار متعدد
//   2) صورة فاتورة/وصل استلام شحنة — OCR بنموذج رؤية عبر Worker المساعد
//   3) ملف Word / PDF / جدول رقمي (xlsx/csv) — تحليل محلي ذكي
// كل المصادر تُحوَّل إلى صفوف موحدة قابلة للتصحيح اليدوي الكامل مع
// مطابقة رسمية (نسبة الثقة) وكشف المكرر بالمخزون — ثم تُقدَّم كدفعة
// «قيد المصادقة» لا يطبقها على المخزون إلا الأدمن (inventory.approve).
// =====================================================================
import { useState, useRef, useMemo } from 'react'
import {
  X, Search, Camera, FileSpreadsheet, Plus, Trash2, CheckCircle2,
  AlertTriangle, Loader2, Sparkles, BadgeCheck, PackagePlus, RefreshCw, Info,
} from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { searchOfficialCatalog, reimbursementRate } from '../../lib/officialCatalog'
import { compressImage } from '../../lib/imageTools'
import { ocrInvoiceImage } from '../../lib/assistantLLM'
import { parseStockFile, parseOcrOutput, buildImportRow } from '../../lib/stockImportParsers'
import { roleHasPermission } from '../../config/permissions'

const TABS = [
  { id: 'catalog', icon: Search },
  { id: 'image', icon: Camera },
  { id: 'file', icon: FileSpreadsheet },
]

// شارة ثقة المطابقة الرسمية
function MatchBadge({ row, t }) {
  const score = row.matchScore || 0
  if (score >= 0.85) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
        <BadgeCheck className="w-3 h-3" /> {t('importMatchOfficial')}
      </span>
    )
  }
  if (score >= 0.55) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        <AlertTriangle className="w-3 h-3" /> {t('importMatchClose')} {Math.round(score * 100)}%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
      <AlertTriangle className="w-3 h-3" /> {t('importMatchUnknown')}
    </span>
  )
}

const WARN_KEYS = {
  lowMatch: 'importWarnLowMatch',
  unknownDrug: 'importWarnUnknown',
  invalidName: 'importWarnName',
  invalidQuantity: 'importWarnQty',
  missingPrice: 'importWarnPrice',
  expired: 'importWarnExpired',
  expiringSoon: 'importWarnExpiring',
}

export default function StockImportModal({ onClose }) {
  const { t, language, productsData, suppliersData, submitStockImport, currentUser } = useApp()
  const [tab, setTab] = useState('catalog')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  // تبويب اللائحة الرسمية
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogResults, setCatalogResults] = useState([])
  const searchTimer = useRef(null)

  // صفوف المراجعة الموحدة
  const [rows, setRows] = useState([])
  const [source, setSource] = useState(null) // catalog | ocr | sheet/docx/pdf/txt
  const [supplierId, setSupplierId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [notes, setNotes] = useState('')

  const canApprove = roleHasPermission(currentUser?.role, 'inventory.approve')

  const addRows = async (rawRows, src, replace = false) => {
    if (!rawRows.length) return
    setBusy(true)
    setError('')
    try {
      const built = await Promise.all(
        rawRows.slice(0, 150).map((r) => buildImportRow(r, productsData)),
      )
      setRows((prev) => (replace ? built : [...prev, ...built]))
      setSource(src)
      setInfo(t('importParsedRows').replace('{n}', String(built.length)))
    } catch {
      setError(t('importParseError'))
    } finally {
      setBusy(false)
    }
  }

  // ===== بحث اللائحة الرسمية =====
  const onCatalogSearch = (q) => {
    setCatalogQuery(q)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setCatalogResults(q.trim().length >= 2 ? searchOfficialCatalog(q.trim(), 10) : [])
    }, 220)
  }

  const addFromCatalog = (drug) => {
    if (rows.some((r) => r.matchedById === drug.id && r.matchScore === 1)) return
    setRows((prev) => [...prev, {
      id: `ir-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: language === 'ar' ? (drug.nameAr || drug.name) : (drug.nameEn || drug.name),
      nameEn: drug.nameEn || '',
      dosage: drug.dosage || '',
      form: drug.form || '',
      presentation: drug.presentation || '',
      category: drug.category || 'other',
      requiresPrescription: !!drug.requiresPrescription,
      barcode: String(drug.code || drug.barcode || '').replace(/\D/g, ''),
      quantity: 1,
      cost: Number(drug.ph) > 0 ? Number(drug.ph) : (Number(drug.ppv || drug.price) > 0 ? Number((Number(drug.ppv || drug.price) * 0.8).toFixed(2)) : 0),
      price: Number(drug.ppv || drug.price) > 0 ? Number(drug.ppv || drug.price) : 0,
      expiry: '',
      batch: '',
      matchScore: 1,
      matchedById: drug.id || null,
      officialName: drug.name || '',
      existingProductId: null,
      isExisting: false,
      existingStock: 0,
      warnings: [],
    }])
    setSource('catalog')
    setInfo(t('importAddedFromList'))
  }

  // ===== صورة فاتورة (OCR بالرؤية) =====
  const onImagePicked = async (file) => {
    if (!file) return
    setBusy(true)
    setError('')
    setInfo(t('importOcrRunning'))
    try {
      const dataUrl = await compressImage(file, 1600, 0.82)
      const text = await ocrInvoiceImage(dataUrl)
      const rawRows = parseOcrOutput(text)
      if (!rawRows.length) {
        setError(t('importOcrNoItems'))
        setInfo('')
      } else {
        await addRows(rawRows, 'ocr', true)
      }
    } catch (e) {
      setError(e?.status === 413 ? t('importImageTooLarge') : t('importOcrFailed'))
      setInfo('')
    } finally {
      setBusy(false)
    }
  }

  // ===== ملف رقمي =====
  const onFilePicked = async (file) => {
    if (!file) return
    setBusy(true)
    setError('')
    setInfo(t('importParsingFile'))
    try {
      const { rows: rawRows, source: src } = await parseStockFile(file)
      if (!rawRows.length) {
        setError(t('importFileNoItems'))
        setInfo('')
      } else {
        await addRows(rawRows, src, true)
      }
    } catch (e) {
      setError(e?.message === 'unsupported_file_type' ? t('importUnsupportedFile') : t('importParseError'))
      setInfo('')
    } finally {
      setBusy(false)
    }
  }

  // ===== تحرير الصفوف =====
  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r
      const next = { ...r, ...patch }
      // تحذيرات فورية خفيفة عند التحرير
      const warnings = [...(r.warnings || [])].filter((w) => !['invalidName', 'invalidQuantity', 'missingPrice', 'expired'].includes(w))
      if (!next.name || next.name.length < 3) warnings.push('invalidName')
      if (!(next.quantity >= 1)) warnings.push('invalidQuantity')
      if (!next.cost) warnings.push('missingPrice')
      if (next.expiry && (new Date(next.expiry) - new Date()) / 86400000 < 0) warnings.push('expired')
      next.warnings = warnings
      return next
    }))
  }

  const applyOfficial = (row) => {
    const drug = searchOfficialCatalog(row.officialName || row.name, 1)[0]
    if (!drug) return
    updateRow(row.id, {
      name: language === 'ar' ? (drug.nameAr || drug.name) : (drug.nameEn || drug.name),
      dosage: drug.dosage || '',
      form: drug.form || '',
      category: drug.category || 'other',
      barcode: String(drug.code || drug.barcode || '').replace(/\D/g, ''),
      cost: Number(drug.ph) > 0 ? Number(drug.ph) : row.cost,
      price: Number(drug.ppv || drug.price) > 0 ? Number(drug.ppv || drug.price) : row.price,
      matchScore: 1,
      warnings: (row.warnings || []).filter((w) => !['lowMatch', 'unknownDrug'].includes(w)),
    })
  }

  const removeRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id))

  const stats = useMemo(() => ({
    total: rows.length,
    existing: rows.filter((r) => r.isExisting).length,
    warnings: rows.reduce((n, r) => n + (r.warnings?.length ? 1 : 0), 0),
  }), [rows])

  const submit = () => {
    if (!rows.length) return
    const entry = submitStockImport({
      source,
      supplierId: supplierId || null,
      invoiceNumber: invoiceNumber.trim(),
      notes: notes.trim(),
      rows,
    })
    if (entry) onClose()
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-gray-900 w-full max-w-4xl max-h-[94vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {/* الترويسة */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-l from-primary-600 to-violet-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{t('stockImportTitle')}</h2>
              <p className="text-xs text-white/80">{t('stockImportSubtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/15 transition-colors" aria-label={t('cancel')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* التبويبات */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-2 sm:px-4 pt-2 gap-1">
          {TABS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setTab(id); setError(''); setInfo('') }}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                tab === id
                  ? 'border-primary-600 text-primary-700 dark:text-primary-300 bg-primary-50/60 dark:bg-gray-800'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(`importTab_${id}`)}
            </button>
          ))}
        </div>

        {/* المحتوى */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* تبويب اللائحة الرسمية */}
          {tab === 'catalog' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={catalogQuery}
                  onChange={(e) => onCatalogSearch(e.target.value)}
                  placeholder={t('importCatalogPlaceholder')}
                  className={`${inputCls} ps-10`}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                {catalogResults.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{d.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {[d.dci, d.dosage, d.form, d.presentation].filter(Boolean).join(' · ')}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {Number(d.ppv) > 0 && <span className="text-[11px] text-emerald-700 dark:text-emerald-400">PPV {d.ppv} DH</span>}
                        {d.cnss && <span className="text-[10px] font-bold text-white bg-violet-600 rounded px-1.5 py-0.5">CNSS {reimbursementRate(d)}%</span>}
                      </div>
                    </div>
                    <button onClick={() => addFromCatalog(d)} className="shrink-0 btn-primary !py-1.5 !px-3 text-xs">
                      <Plus className="w-4 h-4" /> {t('importAddBtn')}
                    </button>
                  </div>
                ))}
                {catalogQuery.trim().length >= 2 && catalogResults.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-6">{t('importNoResults')}</p>
                )}
                {catalogQuery.trim().length < 2 && (
                  <p className="text-xs text-gray-400 text-center py-6">{t('importCatalogHint')}</p>
                )}
              </div>
            </div>
          )}

          {/* تبويب صورة الفاتورة */}
          {tab === 'image' && (
            <div className="space-y-3">
              <label className="block border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-8 text-center cursor-pointer hover:border-primary-400 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => onImagePicked(e.target.files?.[0])}
                  disabled={busy}
                />
                <Camera className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('importImagePick')}</p>
                <p className="text-xs text-gray-500 mt-1">{t('importImageHint')}</p>
              </label>
              {busy && (
                <div className="flex items-center justify-center gap-2 text-sm text-primary-700 dark:text-primary-300 py-3">
                  <Loader2 className="w-4 h-4 animate-spin" /> {t('importOcrRunning')}
                </div>
              )}
            </div>
          )}

          {/* تبويب الملف الرقمي */}
          {tab === 'file' && (
            <div className="space-y-3">
              <label className="block border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-8 text-center cursor-pointer hover:border-primary-400 transition-colors">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.docx,.doc,.pdf,.txt"
                  className="hidden"
                  onChange={(e) => onFilePicked(e.target.files?.[0])}
                  disabled={busy}
                />
                <FileSpreadsheet className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('importFilePick')}</p>
                <p className="text-xs text-gray-500 mt-1">{t('importFileHint')}</p>
              </label>
              {busy && (
                <div className="flex items-center justify-center gap-2 text-sm text-primary-700 dark:text-primary-300 py-3">
                  <Loader2 className="w-4 h-4 animate-spin" /> {t('importParsingFile')}
                </div>
              )}
            </div>
          )}

          {/* الإشعارات */}
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}
          {info && !error && (
            <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> {info}
            </div>
          )}

          {/* جدول المراجعة والتصحيح اليدوي */}
          {rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <PackagePlus className="w-4 h-4 text-primary-600" />
                  {t('importReviewTitle')} ({rows.length})
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                  <span className="bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full px-2 py-0.5 border border-blue-200 dark:border-blue-800">{t('importNewCount')}: {stats.total - stats.existing}</span>
                  <span className="bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full px-2 py-0.5 border border-emerald-200 dark:border-emerald-800">{t('importRestockCount')}: {stats.existing}</span>
                  {stats.warnings > 0 && <span className="bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full px-2 py-0.5 border border-amber-200 dark:border-amber-800">{t('importWarningsCount')}: {stats.warnings}</span>}
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm min-w-[760px]">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="px-2 py-2 text-start font-medium">#</th>
                      <th className="px-2 py-2 text-start font-medium">{t('description')}</th>
                      <th className="px-2 py-2 text-start font-medium w-20">{t('quantity')}</th>
                      <th className="px-2 py-2 text-start font-medium w-24">{t('importCost')}</th>
                      <th className="px-2 py-2 text-start font-medium w-24">{t('salePrice')}</th>
                      <th className="px-2 py-2 text-start font-medium w-32">{t('importExpiryCol')}</th>
                      <th className="px-2 py-2 text-start font-medium w-24">{t('importBatch')}</th>
                      <th className="px-2 py-2 text-start font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {rows.map((row, idx) => (
                      <tr key={row.id} className={row.warnings?.length ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}>
                        <td className="px-2 py-1.5 text-xs text-gray-400">{idx + 1}</td>
                        <td className="px-2 py-1.5">
                          <input
                            value={row.name}
                            onChange={(e) => updateRow(row.id, { name: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-transparent text-sm font-medium dark:text-gray-100 focus:ring-1 focus:ring-primary-500"
                          />
                          <div className="flex items-center flex-wrap gap-1 mt-1">
                            <MatchBadge row={row} t={t} />
                            {row.isExisting
                              ? <span className="text-[11px] text-emerald-700 dark:text-emerald-400">↻ {t('importExistingItem')} ({row.existingStock})</span>
                              : <span className="text-[11px] text-blue-700 dark:text-blue-400">+ {t('importNewItem')}</span>}
                            {row.dosage && <span className="text-[10px] text-gray-400">{row.dosage}{row.form ? ` · ${row.form}` : ''}</span>}
                            {row.warnings?.map((w) => (
                              <span key={w} className="text-[10px] text-amber-700 dark:text-amber-400">⚠ {t(WARN_KEYS[w]) || w}</span>
                            ))}
                            {row.matchedById && row.matchScore < 1 && (
                              <button onClick={() => applyOfficial(row)} className="text-[10px] text-primary-700 dark:text-primary-300 underline hover:no-underline" title={row.officialName}>
                                {t('importApplyOfficial')}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5"><input type="number" min="1" value={row.quantity} onChange={(e) => updateRow(row.id, { quantity: Math.max(1, Number(e.target.value) || 1) })} className="w-16 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-transparent dark:text-gray-100" /></td>
                        <td className="px-2 py-1.5"><input type="number" min="0" step="0.01" value={row.cost} onChange={(e) => updateRow(row.id, { cost: Number(e.target.value) || 0 })} className="w-20 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-transparent dark:text-gray-100" /></td>
                        <td className="px-2 py-1.5"><input type="number" min="0" step="0.01" value={row.price} onChange={(e) => updateRow(row.id, { price: Number(e.target.value) || 0 })} className="w-20 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-transparent dark:text-gray-100" /></td>
                        <td className="px-2 py-1.5"><input type="date" value={row.expiry} onChange={(e) => updateRow(row.id, { expiry: e.target.value })} className="w-28 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-transparent dark:text-gray-100 text-xs" /></td>
                        <td className="px-2 py-1.5"><input value={row.batch} onChange={(e) => updateRow(row.id, { batch: e.target.value })} placeholder="Lot" className="w-20 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-transparent dark:text-gray-100 text-xs" /></td>
                        <td className="px-2 py-1.5">
                          <button onClick={() => removeRow(row.id)} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30" aria-label={t('delete')}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* التذييل: بيانات الدفعة + التقديم */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 sm:px-6 space-y-3 bg-gray-50 dark:bg-gray-800/50">
          {rows.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
                <option value="">{t('importSupplierOptional')}</option>
                {suppliersData.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder={t('importInvoiceNumber')} className={inputCls} />
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('importNotes')} className={inputCls} />
            </div>
          )}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0" />
              {canApprove ? t('importApproveHintAdmin') : t('importApproveHintStaff')}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="btn-secondary">{t('cancel')}</button>
              <button onClick={submit} disabled={!rows.length || busy} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                <RefreshCw className="w-4 h-4" />
                {t('importSubmitForApproval')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
