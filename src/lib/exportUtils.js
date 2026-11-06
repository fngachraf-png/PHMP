// =====================================================================
// أدوات التصدير — CSV بترميز UTF-8 مع BOM + حفظ/مشاركة ذكية عبر المنصات
// ---------------------------------------------------------------------
// الـBOM إلزامي كي تُعرض العربية/الفرنسية بشكل سليم عند فتح الملف
// في Excel وLibreOffice (بدونه يظهر ������).
//
// إصلاح خلل أندرويد (v2.4.0): تطبيق الويب المُغلَّف بـCapacitor لا يدعم
// تنزيل الروابط (a[download]) إطلاقاً — كان زر التصدير/التنزيل يفعل شيئاً
// ظاهرياً ثم لا يظهر ملف. المسار الذكي الآن:
//   1) داخل التطبيق (Capacitor): كتابة الملف بـFilesystem ثم فتح لوحة
//      مشاركة أندرويد (حفظ في الملفات / إرسال / طباعة) عبر Share.
//      وإن غاب الشيران: كتابة في Documents مع إشعار بمسار الملف.
//   2) في المتصفح: تنزيل مباشر كما هو، مع Web Share كاحتياط للموبايل.
// filename: اسم الملف بلا امتداد — يُلحق به التاريخ والامتداد تلقائياً.
// rows: مصفوفة صفوف؛ الصف الأول ترويسة الأعمدة.
// =====================================================================

const escapeCell = (value) => {
  const s = String(value ?? '')
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const todayStamp = () => new Date().toISOString().slice(0, 10)

const isNativeApp = () => {
  try { return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.() } catch { return false }
}

// base64 بدون هبوط Node/Buffer (يعمل في المتصفح وWebView على نصوص UTF-8)
const toBase64Utf8 = (text) => {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

// إشعار الواجهة بلغة المستخدم عند حفظ الملف داخلياً (بلا Share)
const notifySaved = (path) => {
  try {
    const lang = (localStorage.getItem('pharmacare_language') || 'ar').replace(/"/g, '')
    const text = lang === 'ar' ? `تم حفظ الملف: ${path}`
      : lang === 'fr' ? `Fichier enregistré : ${path}`
      : `File saved: ${path}`
    window.dispatchEvent(new CustomEvent('phmp:toast', { detail: text }))
  } catch { /* تجاهل */ }
}

// ===== المسار الذكي داخل تطبيق أندرويد (Capacitor) =====
const saveNative = async (filename, mime, base64) => {
  // 1) محاولة المشاركة عبر لوحة النظام (الحفظ في الملفات/الإرسال/الطباعة)
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const written = await Filesystem.writeFile({
      path: `PHMP/${filename}`,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    })
    try {
      const { Share } = await import('@capacitor/share')
      await Share.share({ title: filename, text: filename, url: written.uri, dialogTitle: 'PHMP' })
      return true
    } catch (shareErr) {
      // ألغى المستخدم اللوحة؟ لا يُعد فشلاً — الملف محفوظ في Cache ويمكن
      // الوصول إليه من تطبيق الملفات؛ أما غياب الإضافة فنسقط للكتابة المباشرة
      if (String(shareErr?.message || '').toLowerCase().includes('cancel')) return true
      try {
        const { Directory: D } = await import('@capacitor/filesystem')
        const saved = await Filesystem.writeFile({
          path: `PHMP/${filename}`, data: base64, directory: D.Documents, recursive: true,
        })
        notifySaved(saved?.uri || `Documents/PHMP/${filename}`)
        return true
      } catch { return false }
    }
  } catch {
    // 2) بلا إضافة Filesystem: نسجّل في الخارج إن توفر، وإلا نفشل للطريق العام
    try {
      const { Filesystem: F, Directory: D2 } = await import('@capacitor/filesystem')
      const saved = await F.writeFile({
        path: `PHMP/${filename}`, data: base64, directory: D2.Documents, recursive: true,
      })
      notifySaved(saved?.uri || `Documents/PHMP/${filename}`)
      return true
    } catch { return false }
  }
}

// ===== حفظ عام: تطبيق ← مشاركة/ملفات | متصفح ← تنزيل/مشاركة ويب =====
export const saveFile = async (filename, content, mime = 'text/csv;charset=utf-8;') => {
  const full = `${filename}-${todayStamp()}`
  if (isNativeApp()) {
    const b64 = toBase64Utf8(content)
    const ok = await saveNative(full, mime, b64)
    if (ok) return true
    // فشل المسار الأصلي: نُكمل بالتنزيل التقليدي احتياطاً
  }
  // متصفح: مشاركة الويب أولاً على الأجهزة المحمولة (تسمح الحفظ في الملفات)
  try {
    if (typeof navigator !== 'undefined' && navigator.canShare) {
      const file = new File([content], `${full}.csv`, { type: mime })
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: full })
        return true
      }
    }
  } catch (err) {
    if (String(err?.name) === 'AbortError') return true // ألغى المستخدم اللوحة
    /* نُكمل بالتنزيل المباشر */
  }
  try {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${full}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1500)
    return true
  } catch { return false }
}

// تصدير CSV (نفس التواقيع السابقة — كل مواضع الاستدعاء تعمل بلا تعديل)
export const exportToCSV = (filename, rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return false
  const csv = '\uFEFF' + rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')
  // واجهة متزامنة كما كانت: نطلق المسار الذكي دون تعليق الاستدعاء
  Promise.resolve(saveFile(filename, csv)).catch(() => { /* يبقى التنزيل التقليدي آخر محاولة */ })
  return true
}

// تنسيق الأرقام النقدية بشكل دقيق وموحد في كل التقارير (خانتان عشريتان)
export const money = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
