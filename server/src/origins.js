// =====================================================================
// PHMP — الأصول المسموحة (CORS / WebSocket) — وحدة مشتركة
// ---------------------------------------------------------------------
// نفس قائمة الأصول تُستعمل للطلبات HTTP (cors في index.js) ولاتصالات
// WebSocket (فحص Origin في realtime.js) — كي لا يُقبل في WS أصل يرفضه
// HTTP أو العكس. القائمة قابلة للتوسيع بمتغير البيئة PHMP_ALLOWED_ORIGINS.
// =====================================================================

// أصول Capacitor (تطبيق أندرويد/iOS): WebView يحمّل الواجهة من https://localhost
// (androidScheme: https) — بدون إدراجها هنا يحجب CORS كل طلبات الدخول من التطبيق
// فيفشل تسجيل الدخول. آمنة: متصفحات الويب لا تستطيع انتحال ترويسة Origin،
// وأصل localhost لا يصدر إلا من التطبيق المثبّت على جهاز المستخدم نفسه.
export const CAPACITOR_ORIGINS = [
  'https://localhost',     // أندرويد (androidScheme: https — الافتراضي في Capacitor 6)
  'http://localhost',      // إعدادات أندرويد القديمة (androidScheme: http)
  'capacitor://localhost', // iOS (المخطط الافتراضي)
  'ionic://localhost',     // توافق مع حزم Ionic القديمة
]

// بناء دالة فحص الأصل حسب البيئة (تُنشأ مرة عند الإقلاع وتُشارك بين HTTP و WS)
export function makeOriginAllowed(env = process.env) {
  const allowedList = (env.PHMP_ALLOWED_ORIGINS ||
    'https://phmp.pages.dev,https://phmplatform.vercel.app,https://pharmacare-pro-jade.vercel.app')
    .split(',').map((s) => s.trim()).filter(Boolean)

  return (origin) => {
    if (!origin) return true // curl / عميل غير متصفح بلا Origin (اختبارات/تطبيقات أصلية)
    if (allowedList.includes(origin) || CAPACITOR_ORIGINS.includes(origin)) return true
    try {
      const host = new URL(origin).hostname
      // معاينات Pages التابعة لنفس المشروع
      if (host === 'phmp.pages.dev' || host.endsWith('.phmp.pages.dev')) return true
      // معاينات Vercel الخاصة بمشروع PHMP فقط (وليس أي *.vercel.app)
      if (host.endsWith('.vercel.app')) {
        return host.startsWith('phmplatform-') || host.startsWith('pharmacare-pro-jade-')
      }
      return false
    } catch {
      return false
    }
  }
}
