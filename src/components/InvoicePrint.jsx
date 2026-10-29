import { useApp } from '../contexts/AppContext'
import { Printer, Receipt, Truck, Stethoscope, Download } from 'lucide-react'
import { printInvoice } from '../lib/print'
import { exportToCSV } from '../lib/exportUtils'

// =====================================================================
// فاتورة البيع / وصل التوصيل — قابل للطباعة
// يطبع إلزامياً: اسم الصيدلية + اسم الدواء + سعره + طريقة الدفع
// يدعم: مبيعات نقطة البيع (POS) والطلبات المباشرة من الزبناء
// =====================================================================

const paymentLabels = {
  cash: { ar: 'نقدي', fr: 'Espèces', en: 'Cash' },
  card: { ar: 'بطاقة بنكية', fr: 'Carte bancaire', en: 'Card' },
  transfer: { ar: 'تحويل بنكي', fr: 'Virement', en: 'Bank transfer' },
  insurance: { ar: 'تأمين', fr: 'Assurance', en: 'Insurance' },
  on_delivery: { ar: 'الدفع عند الاستلام/التوصيل', fr: 'Paiement à la livraison', en: 'Pay on pickup/delivery' },
}

const InvoicePrint = ({ sale, mode = 'invoice' }) => {
  const { t, language, isRTL, currentPharmacy, pickName, pickAddress } = useApp()
  if (!sale) return null

  const isOrder = !!sale.deliveryMethod // طلب مباشر من الزبون
  const pharmacy = sale.pharmacy || currentPharmacy || {}
  const items = sale.items || []
  const paymentLabel = paymentLabels[sale.paymentMethod]?.[language] || sale.paymentMethod || t('paymentOnDelivery')

  const deliveryMethods = {
    pickup: t('pickupAtPharmacy'),
    customer_delivery: t('deliveryByCustomer'),
    pharmacy_delivery: t('deliveryByPharmacy'),
  }

  const title = mode === 'delivery' ? t('deliveryNote') : t('invoice')
  const now = new Date(sale.date ? `${sale.date}T${sale.time || '00:00'}` : (sale.createdAt || Date.now()))

  // تصدير الفاتورة كملف CSV (UTF-8 + BOM) — يُفتح سليماً في Excel بالعربية
  const exportInvoiceCSV = () => {
    const rows = [
      [t('description'), t('quantity'), t('unitPrice'), t('lineTotal')],
      ...items.map((item) => [
        pickName(item) || item.name || '',
        item.quantity,
        Number(item.price).toFixed(2),
        (item.price * item.quantity).toFixed(2),
      ]),
      ['', '', t('subtotal'), Number(sale.subtotal || 0).toFixed(2)],
      ...(sale.discount > 0 ? [['', '', t('discount'), `-${Number(sale.discount).toFixed(2)}`]] : []),
      ...(sale.tax > 0 ? [['', '', t('tax'), Number(sale.tax || 0).toFixed(2)]] : []),
      ...(isOrder && sale.deliveryFee > 0 ? [['', '', t('deliveryFee'), Number(sale.deliveryFee || 0).toFixed(2)]] : []),
      ['', '', t('grandTotal'), Number(sale.total || 0).toFixed(2)],
      ['', '', t('paymentMethod'), paymentLabel],
    ]
    exportToCSV(sale.number || 'invoice', rows)
  }

  return (
    <div className="space-y-4">
      {/* ===== منطقة الطباعة ===== */}
      <div
        className="print-area bg-white text-gray-900 rounded-xl border border-gray-200 mx-auto"
        style={{ maxWidth: '80mm', width: '100%', padding: '14px 12px', fontSize: '12px', fontFamily: isRTL ? "'Cairo', sans-serif" : "'Inter', sans-serif" }}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* رأس الفاتورة: اسم الصيدلية إلزامي */}
        <div style={{ textAlign: 'center', borderBottom: '2px dashed #d1d5db', paddingBottom: '10px' }}>
          <div style={{ fontSize: '22px', fontWeight: 800, lineHeight: 1.3 }}>
            {pharmacy.logo ? `${pharmacy.logo} ` : ''}{pickName(pharmacy) || pharmacy.name || t('appName')}
          </div>
          {pharmacy.address && <div style={{ fontSize: '10px', color: '#4b5563', marginTop: 2 }}>{pickAddress(pharmacy)}</div>}
          <div style={{ fontSize: '10px', color: '#4b5563' }}>
            {pharmacy.phone ? `${t('phone')}: ${pharmacy.phone}` : ''}
            {pharmacy.license ? ` • ${t('licenseNumber')}: ${pharmacy.license}` : ''}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, marginTop: 8, letterSpacing: 1 }}>{title}</div>
        </div>

        {/* معلومات الفاتورة */}
        <div style={{ padding: '8px 0', borderBottom: '1px dashed #d1d5db', fontSize: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{isOrder ? t('orderNumber') : t('invoiceNumber')}:</span>
            <span style={{ fontWeight: 700 }}>{isOrder ? sale.number : sale.number}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <span>{t('invoiceDate')}:</span>
            <span>{now.toLocaleDateString(isRTL ? 'ar-MA' : language === 'fr' ? 'fr-FR' : 'en-GB')} {now.toLocaleTimeString(language === 'fr' ? 'fr-FR' : undefined, { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {sale.customer && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span>{t('customer')}:</span>
              <span style={{ fontWeight: 600 }}>{sale.customer.name || sale.customer.fullName}</span>
            </div>
          )}
          {sale.customer?.phone && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span>{t('phone')}:</span>
              <span>{sale.customer.phone}</span>
            </div>
          )}
          {sale.servedBy && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span>{t('servedBy')}:</span>
              <span>{sale.servedBy}</span>
            </div>
          )}
        </div>

        {/* جدول الأدوية: اسم الدواء + الكمية + السعر إلزامي */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6, fontSize: '10px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #9ca3af' }}>
              <th style={{ textAlign: isRTL ? 'right' : 'left', padding: '4px 2px' }}>{t('description')}</th>
              <th style={{ textAlign: 'center', padding: '4px 2px', width: '24px' }}>{t('quantity')}</th>
              <th style={{ textAlign: 'center', padding: '4px 2px', width: '42px' }}>{t('unitPrice')}</th>
              <th style={{ textAlign: isRTL ? 'left' : 'right', padding: '4px 2px', width: '46px' }}>{t('lineTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px dotted #d1d5db' }}>
                <td style={{ padding: '4px 2px' }}>
                  {pickName(item) || item.name}
                  {item.requiresPrescription && <span title={t('requiresPrescription')}> ⚕</span>}
                </td>
                <td style={{ textAlign: 'center', padding: '4px 2px' }}>{item.quantity}</td>
                <td style={{ textAlign: 'center', padding: '4px 2px' }}>{Number(item.price).toFixed(2)}</td>
                <td style={{ textAlign: isRTL ? 'left' : 'right', padding: '4px 2px', fontWeight: 600 }}>
                  {(item.price * item.quantity).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* المجاميع */}
        <div style={{ marginTop: 8, fontSize: '11px' }}>
          {sale.discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
              <span>{t('discount')}</span>
              <span>-{Number(sale.discount || 0).toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <span>{t('subtotal')}</span>
            <span>{Number(sale.subtotal || 0).toFixed(2)} {t('currency')}</span>
          </div>
          {sale.tax > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span>{t('tax')}</span>
              <span>{Number(sale.tax || 0).toFixed(2)} {t('currency')}</span>
            </div>
          )}
          {isOrder && sale.deliveryFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span>{t('deliveryFee')}</span>
              <span>{Number(sale.deliveryFee || 0).toFixed(2)} {t('currency')}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: '1px solid #9ca3af', fontWeight: 800, fontSize: '13px' }}>
            <span>{t('grandTotal')}</span>
            <span>{Number(sale.total || 0).toFixed(2)} {t('currency')}</span>
          </div>
          {/* طريقة الدفع إلزامية */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontWeight: 700 }}>
            <span>{t('paymentMethod')}</span>
            <span>{paymentLabel}</span>
          </div>
          {isOrder && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span>{t('deliveryMethod')}</span>
              <span>{deliveryMethods[sale.deliveryMethod] || sale.deliveryMethod}</span>
            </div>
          )}
        </div>

        {/* تذييل */}
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '2px dashed #d1d5db', textAlign: 'center', fontSize: '9.5px', color: '#4b5563' }}>
          <div style={{ fontWeight: 700, color: '#111827' }}>{t('thanksMsg')}</div>
          {sale.needsPrescription && <div style={{ marginTop: 3 }}>{t('invoiceFooter')}</div>}
          <div style={{ marginTop: 3 }}>
            {t('appName')} • {new Date().getFullYear()} — PHMP
          </div>
        </div>
      </div>

      {/* أزرار الطباعة والتصدير (لا تظهر في الورقة) */}
      <div className="no-print flex items-center justify-center gap-2 flex-wrap">
        <button onClick={printInvoice} className="btn-primary text-sm">
          <Printer className="w-4 h-4" />
          {mode === 'delivery' ? t('printDeliveryNote') : t('printInvoice')}
        </button>
        <button onClick={exportInvoiceCSV} className="btn-secondary text-sm">
          <Download className="w-4 h-4" />
          {t('exportCSV')}
        </button>
      </div>
    </div>
  )
}

export default InvoicePrint
