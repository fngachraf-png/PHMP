// =====================================================================
// صورة ذكية (مستخدم / صيدلية): تعرض الصورة المرفوعة إن توفرت،
// وإلا الرمز التعبيري المخزن — واجهة موحدة لكل مواضع العرض.
// =====================================================================

export const isImage = (v) => typeof v === 'string' && v.startsWith('data:image')

const SmartAvatar = ({ value, alt = '', size = 36, rounded = 'rounded-xl', textClass = 'text-xl', fallback = '👤', className = '' }) => {
  if (isImage(value)) {
    return (
      <img
        src={value}
        alt={alt}
        className={`object-cover flex-shrink-0 ${rounded} ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className={`flex items-center justify-center flex-shrink-0 ${rounded} ${textClass} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {value || fallback}
    </span>
  )
}

export default SmartAvatar
