import { useRef, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { compressImage } from '../lib/imageTools'
import { Camera, ImagePlus, Trash2, Loader2 } from 'lucide-react'

// =====================================================================
// رفع لوغو / صورة شخصية (مربع) مع معاينة فورية وضغط تلقائي قبل الحفظ
// (256px JPEG ≈ 15-30KB) — يُستعمل في: إضافة صيدلية، إنشاء مستخدم،
// حساب الزبون المسجل. الصورة تُحفظ base64 في نفس الحقل (logo/avatar).
// =====================================================================

const LogoUpload = ({ value, onChange, label, hint, size = 88, rounded = 'rounded-2xl' }) => {
  const { t } = useApp()
  const fileRef = useRef(null)
  const cameraRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const isImg = typeof value === 'string' && value.startsWith('data:image')

  const handleFile = async (file) => {
    if (!file) return
    setBusy(true)
    try {
      const base64 = await compressImage(file, 256, 0.8)
      onChange(base64)
    } catch { /* ملف غير صالح — نتجاهل */ }
    setBusy(false)
  }

  return (
    <div className="space-y-1.5">
      {label && <label className="label">{label}</label>}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

      <div className="flex items-center gap-3">
        <div
          className={`${rounded} border-2 border-dashed flex items-center justify-center overflow-hidden flex-shrink-0 bg-gray-50 ${isImg ? 'border-primary-300' : 'border-gray-300'}`}
          style={{ width: size, height: size }}
        >
          {busy ? (
            <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
          ) : isImg ? (
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImagePlus className="w-6 h-6 text-gray-400" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
              className="btn-secondary text-xs py-1.5 px-3">
              <ImagePlus className="w-3.5 h-3.5" />
              {isImg ? t('changePhoto') : t('uploadFile')}
            </button>
            <button type="button" onClick={() => cameraRef.current?.click()} disabled={busy}
              className="btn-secondary text-xs py-1.5 px-3">
              <Camera className="w-3.5 h-3.5" />
              {t('takePhoto')}
            </button>
          </div>
          {isImg && (
            <button type="button" onClick={() => onChange(null)} className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 w-fit">
              <Trash2 className="w-3 h-3" /> {t('delete')}
            </button>
          )}
          {hint && !isImg && <p className="text-[11px] text-gray-500 max-w-[220px]">{hint}</p>}
        </div>
      </div>
    </div>
  )
}

export default LogoUpload
