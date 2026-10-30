import { useRef, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { compressImage, isClearEnough } from '../lib/imageTools'
import { Camera, ImagePlus, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react'

// =====================================================================
// رفع صورة (وثيقة الهوية / الوصفة الطبية) مع التقاط مباشر بالكاميرا
// يتحقق من وضوح الصورة ويضغطها قبل الحفظ المحلي
// =====================================================================

const PhotoUpload = ({ value, onChange, label, hint, required = false, capture = 'environment', maxDim = 1024 }) => {
  const { t } = useApp()
  const fileRef = useRef(null)
  const cameraRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)

  const handleFile = async (file) => {
    setError('')
    setBusy(true)
    try {
      const base64 = await compressImage(file, maxDim, 0.75)
      const clear = await isClearEnough(base64, 420)
      if (!clear) {
        setError(t('error') + ' · ' + (t('idDocumentHint')))
        // نعرض الصورة مع تحذير الوضوح، ونترك القرار للمستخدم مع علامة
        onChange(base64, false)
      } else {
        onChange(base64, true)
      }
    } catch {
      setError(t('error'))
    }
    setBusy(false)
  }

  return (
    <div className="space-y-2">
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <input ref={cameraRef} type="file" accept="image/*" capture={capture} className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

      {value ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-emerald-300 bg-emerald-50">
          <img
            src={value}
            alt={label}
            onClick={() => setPreview(true)}
            className="w-full h-40 object-cover cursor-zoom-in"
          />
          <div className="absolute top-2 inset-inline-end-2 bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {t('photoAttached')}
          </div>
          <div className="flex gap-2 p-2">
            <button type="button" onClick={() => cameraRef.current?.click()} className="btn-secondary flex-1 text-xs py-1.5">
              <Camera className="w-3.5 h-3.5" /> {t('changePhoto')}
            </button>
            <button type="button" onClick={() => onChange(null, false)} className="btn-danger text-xs py-1.5 px-3">
              {t('delete')}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => cameraRef.current?.click()} disabled={busy}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50 hover:bg-primary-100 transition-colors">
            <Camera className="w-6 h-6 text-primary-600" />
            <span className="text-xs font-semibold text-primary-700">{busy ? t('loading') : t('takePhoto')}</span>
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors">
            <ImagePlus className="w-6 h-6 text-gray-600" />
            <span className="text-xs font-semibold text-gray-700">{t('uploadFile')}</span>
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" /> {error}
        </p>
      )}
      {hint && !value && <p className="text-xs text-gray-500">{hint}</p>}

      {/* معاينة موسعة */}
      {preview && value && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(false)}>
          <img src={value} alt={label} className="max-w-full max-h-[90vh] rounded-lg" />
        </div>
      )}
    </div>
  )
}

export default PhotoUpload
