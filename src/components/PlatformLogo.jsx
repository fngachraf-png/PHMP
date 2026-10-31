import { useApp } from '../contexts/AppContext'

// =====================================================================
// لوغو المنصة الرسمي — نسختان حسب الوضع:
//   logo.png       (الوضع المشع: ذهبي مطفي + أزرق مخضر)
//   logo-dark.png  (الوضع القاتم: ذهبي معدني لامع)
// مكوّن موحد يضمن تبديل اللوغو فورياً مع تبديل الوضع في كل الواجهات.
// =====================================================================

const PlatformLogo = ({ size = 40, className = '', alt = 'PHMP', withFrame = false }) => {
  const { theme } = useApp()
  const src = theme === 'dark' ? '/logo-dark.png' : '/logo.png'
  if (withFrame) {
    return (
      <div
        className={`rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 bg-white shadow-lg shadow-primary-500/30 ${className}`}
        style={{ width: size, height: size }}
      >
        <img src={src} alt={alt} className="w-full h-full object-contain" style={{ padding: Math.max(2, size * 0.06) }} />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className={`object-contain flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

// =====================================================================
// العلامة المائية للوغو المنصة — خفيفة على جميع الصفحات
// (غير تفاعلية — لا تؤثر على القراءة ولا تظهر في الطباعة)
// =====================================================================
export const PlatformWatermark = ({ isRTL }) => {
  const { theme } = useApp()
  const dark = theme === 'dark'
  return (
    <img
      src={dark ? '/logo-watermark-dark.png' : '/logo-watermark.png'}
      alt=""
      aria-hidden="true"
      className="fixed z-0 pointer-events-none select-none print:hidden"
      style={{
        bottom: '4%',
        [isRTL ? 'left' : 'right']: '4%',
        width: 'clamp(120px, 18vw, 220px)',
        opacity: dark ? 0.07 : 0.05,
      }}
    />
  )
}

export default PlatformLogo
