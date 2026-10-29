// =====================================================================
// مساعد الطباعة — يتحكم في مقاس الورقة ووضع الطباعة ديناميكياً
//
// المشكلة السابقة: @page { size: 80mm } كان مثبتاً بشكل عام في CSS،
// فكانت أي طباعة أخرى (تقرير/صفحة) تخرج بمقاس الفاتورة الحراري.
// الحل: مقاس الورقة يُحقن عند الطلب فقط ثم يُزال بعد الطباعة.
//   - printInvoice() : فاتورة/وصل 80mm  → يظهر .print-area فقط
//   - printReport()  : تقرير A4        → يظهر .report-print-area فقط
// =====================================================================

const STYLE_ID = 'phmp-dynamic-print-style'

const injectPageStyle = (pageCss) => {
  let style = document.getElementById(STYLE_ID)
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = `@media print { ${pageCss} }`
}

const cleanup = (mode) => {
  const style = document.getElementById(STYLE_ID)
  if (style) style.textContent = ''
  document.body.classList.remove('print-mode-invoice', 'print-mode-report')
  void mode
}

const printWithMode = (mode, pageCss) => {
  document.body.classList.add(`print-mode-${mode}`)
  injectPageStyle(pageCss)
  const done = () => cleanup(mode)
  // afterprint يدعمه أغلب المتصفحات؛ ومهلة احتياطية لـ WebView أندرويد
  window.addEventListener('afterprint', done, { once: true })
  window.print()
  setTimeout(done, 800)
}

/** طباعة فاتورة 80mm (طابعة حرارية أو A4 مقصوصة) */
export const printInvoice = () =>
  printWithMode('invoice', '@page { size: 80mm auto; margin: 4mm; }')

/** طباعة/حفظ تقرير A4 (PDF عبر حوار الطباعة) */
export const printReport = () =>
  printWithMode('report', '@page { size: A4; margin: 12mm; }')
