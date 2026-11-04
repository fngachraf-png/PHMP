// =====================================================================
// PHMP — لوحة دفعات استيراد المخزون (قيد المصادقة / المعتمدة / المرفوضة)
// ---------------------------------------------------------------------
// تعرض الدفعات المقدَّمة من الموظفين (لائحة رسمية / صورة فاتورة / ملف رقمي)
// مع صفوفها الكاملة للفحص — والأدمن (inventory.approve حصراً) يصادق
// فيُطبَّق المخزون فعلياً (زيادة كميات + أصناف جديدة) أو يرفض بسبب مسجّل.
// =====================================================================
import { useState } from 'react'
import {
  ClipboardList, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp,
  Camera, FileSpreadsheet, Search, Sparkles, ShieldCheck,
} from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { roleHasPermission } from '../../config/permissions'

const SOURCE_META = {
  catalog: { icon: Search, key: 'importSourceCatalog' },
  ocr: { icon: Camera, key: 'importSourceOcr' },
  sheet: { icon: FileSpreadsheet, key: 'importSourceSheet' },
  docx: { icon: FileSpreadsheet, key: 'importSourceDocx' },
  pdf: { icon: FileSpreadsheet, key: 'importSourcePdf' },
  txt: { icon: FileSpreadsheet, key: 'importSourceTxt' },
}

const STATUS_META = {
  pending: { key: 'importStatusPending', cls: 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300', icon: Clock },
  approved: { key: 'importStatusApproved', cls: 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300', icon: CheckCircle2 },
  rejected: { key: 'importStatusRejected', cls: 'bg-red-50 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300', icon: XCircle },
}

export default function StockImportsPanel() {
  const { t, stockImports, approveStockImport, rejectStockImport, currentUser, suppliersData, pickName } = useApp()
  const [expanded, setExpanded] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const canApprove = roleHasPermission(currentUser?.role, 'inventory.approve')
  if (!stockImports.length) return null

  const supplierName = (id) => suppliersData.find((s) => s.id === id)?.name || ''

  const doApprove = (id) => {
    const res = approveStockImport(id)
    if (res?.ok) setExpanded(null)
  }

  const doReject = (id) => {
    const res = rejectStockImport(id, rejectReason)
    if (res?.ok) { setRejecting(null); setRejectReason(''); setExpanded(null) }
  }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-violet-600" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('stockImportsPanelTitle')}</h2>
          {stockImports.some((b) => b.status === 'pending') && (
            <span className="text-[11px] font-bold text-white bg-amber-500 rounded-full px-2 py-0.5">
              {stockImports.filter((b) => b.status === 'pending').length}
            </span>
          )}
        </div>
        {canApprove && (
          <span className="hidden sm:flex items-center gap-1 text-[11px] text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5" /> {t('importYouCanApprove')}
          </span>
        )}
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[420px] overflow-y-auto">
        {stockImports.map((batch) => {
          const src = SOURCE_META[batch.source] || SOURCE_META.sheet
          const st = STATUS_META[batch.status] || STATUS_META.pending
          const SrcIcon = src.icon
          const StIcon = st.icon
          const isOpen = expanded === batch.id
          return (
            <div key={batch.id} className="px-4 sm:px-6 py-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button onClick={() => setExpanded(isOpen ? null : batch.id)} className="flex items-center gap-3 text-start min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 flex items-center justify-center shrink-0">
                    <SrcIcon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t(src.key)}</span>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium border rounded-full px-2 py-0.5 ${st.cls}`}>
                        <StIcon className="w-3 h-3" /> {t(st.key)}
                      </span>
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                      {new Date(batch.createdAt).toLocaleString()} · {batch.createdBy} · {batch.rows.length} {t('importItemsUnit')}
                      {batch.invoiceNumber ? ` · ${batch.invoiceNumber}` : ''}
                      {supplierName(batch.supplierId) ? ` · ${supplierName(batch.supplierId)}` : ''}
                    </span>
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  {batch.status === 'pending' && canApprove && (
                    <>
                      <button onClick={() => doApprove(batch.id)} className="btn-primary !py-1.5 !px-3 text-xs">
                        <CheckCircle2 className="w-4 h-4" /> {t('importApproveBtn')}
                      </button>
                      <button onClick={() => { setRejecting(batch.id); setExpanded(batch.id) }} className="btn-secondary !py-1.5 !px-3 text-xs !text-red-600 border-red-300 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20">
                        <XCircle className="w-4 h-4" /> {t('importRejectBtn')}
                      </button>
                    </>
                  )}
                  <button onClick={() => setExpanded(isOpen ? null : batch.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label={t('view')}>
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[560px]">
                      <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400">
                        <tr>
                          <th className="px-2 py-1.5 text-start font-medium">{t('description')}</th>
                          <th className="px-2 py-1.5 text-start font-medium">{t('quantity')}</th>
                          <th className="px-2 py-1.5 text-start font-medium">{t('importCost')}</th>
                          <th className="px-2 py-1.5 text-start font-medium">{t('salePrice')}</th>
                          <th className="px-2 py-1.5 text-start font-medium">{t('importExpiryCol')}</th>
                          <th className="px-2 py-1.5 text-start font-medium">{t('importBatch')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {batch.rows.map((r) => (
                          <tr key={r.id}>
                            <td className="px-2 py-1.5">
                              <span className="font-medium text-gray-800 dark:text-gray-200">{r.name}</span>
                              {r.dosage && <span className="text-gray-400"> · {r.dosage}</span>}
                              {r.isExisting
                                ? <span className="text-emerald-600 dark:text-emerald-400"> ↻</span>
                                : <span className="text-blue-600 dark:text-blue-400"> +</span>}
                            </td>
                            <td className="px-2 py-1.5">{r.quantity}</td>
                            <td className="px-2 py-1.5">{Number(r.cost || 0).toFixed(2)}</td>
                            <td className="px-2 py-1.5">{Number(r.price || 0).toFixed(2)}</td>
                            <td className="px-2 py-1.5">{r.expiry || '—'}</td>
                            <td className="px-2 py-1.5">{r.batch || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {batch.notes && (
                    <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800">
                      📝 {batch.notes}
                    </p>
                  )}
                  {batch.status === 'rejected' && batch.rejectReason && (
                    <p className="px-3 py-2 text-xs text-red-600 dark:text-red-400 border-t border-gray-100 dark:border-gray-800">
                      ✖ {t('importRejectReason')}: {batch.rejectReason}
                    </p>
                  )}
                  {batch.status !== 'pending' && (
                    <p className="px-3 py-2 text-[11px] text-gray-400 border-t border-gray-100 dark:border-gray-800">
                      {t('importReviewedBy')}: {batch.reviewedBy} · {batch.reviewedAt ? new Date(batch.reviewedAt).toLocaleString() : ''}
                    </p>
                  )}
                </div>
              )}

              {rejecting === batch.id && batch.status === 'pending' && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder={t('importRejectReasonPlaceholder')}
                    className="flex-1 min-w-[220px] px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
                  />
                  <button onClick={() => doReject(batch.id)} className="btn-primary !py-2 !px-4 text-xs !bg-red-600 hover:!bg-red-700">
                    {t('importConfirmReject')}
                  </button>
                  <button onClick={() => setRejecting(null)} className="btn-secondary !py-2 !px-4 text-xs">{t('cancel')}</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="px-4 sm:px-6 py-3 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 text-[11px] text-gray-400">
        <Sparkles className="w-3.5 h-3.5" />
        {t('importPanelHint')}
      </div>
    </section>
  )
}
