// مكوّن حماية الصلاحيات - يعرض المحتوى فقط إذا توفرت الصلاحية المطلوبة
import { useApp } from '../contexts/AppContext'

export const PermissionGate = ({ permission, children, fallback = null }) => {
  const { hasPermission } = useApp()
  if (!hasPermission(permission)) return fallback
  return children
}

// رسالة عدم توفر الصلاحية
export const NoPermission = ({ title, message }) => {
  const { isRTL, t } = useApp()
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">
        {title || (isRTL ? 'غير مصرح لك بالوصول' : 'Access Denied')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm">
        {message || (isRTL ? 'ليست لديك الصلاحيات اللازمة للوصول إلى هذه الصفحة. تواصل مع مالك المنصة أو مدير الصيدلية.' : 'You do not have the required permissions to access this page. Contact the platform owner or pharmacy manager.')}
      </p>
    </div>
  )
}

export default PermissionGate
