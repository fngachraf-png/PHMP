import { useState } from 'react'
import { useApp } from '../contexts/AppContext'
import PhotoUpload from './PhotoUpload'
import { X, UserRound, UserRoundCheck, BadgeCheck, CircleCheck, LogIn } from 'lucide-react'

// =====================================================================
// نافذة حساب الزبون (من ترويسة المتجر): تسجيل حساب مشترك / دخول /
// متابعة كعابر — نفس منطق CheckoutModal لكن مستقلة ليراها الزبون
// قبل إتمام الطلب
// =====================================================================

const CustomerAccountModal = ({ open, onClose }) => {
  const { t, customerAccounts, registerCustomer, loginCustomerAccount, continueAsGuest } = useApp()

  const [mode, setMode] = useState('choose') // choose | guest | login | register
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [idPhoto, setIdPhoto] = useState(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (!open) return null

  const nameValid = fullName.trim().length >= 3
  const phoneValid = phone.replace(/\D/g, '').length >= 10

  const close = () => {
    setMode('choose'); setError(''); setDone(false)
    setFullName(''); setPhone(''); setIdPhoto(null)
    onClose()
  }

  const submit = () => {
    setError('')
    if (!nameValid) return setError(t('fullNameRequired'))
    if (!phoneValid) return setError(t('phoneRequired'))

    if (mode === 'guest') {
      continueAsGuest(fullName.trim(), phone.trim())
      setDone('guest')
    } else if (mode === 'login') {
      const res = loginCustomerAccount(fullName.trim(), phone.trim())
      if (!res.ok) return setError(t(res.error))
      setDone('login')
    } else if (mode === 'register') {
      if (!idPhoto) return setError(t('idPhotoRequired'))
      const res = registerCustomer({ fullName: fullName.trim(), phone: phone.trim(), idPhoto })
      if (!res.ok) return setError(t(res.error))
      setDone('register')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col animate-slide-up">
        {/* الرأس */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{t('myAccount')}</h3>
            <p className="text-xs text-gray-500">{t('customerAccountSubtitle')}</p>
          </div>
          <button onClick={close} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        {/* المحتوى */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* نجاح */}
          {done ? (
            <div className="text-center space-y-4 py-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
                <CircleCheck className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="font-bold text-gray-900">
                {done === 'register' ? t('registerSuccess') : done === 'login' ? t('welcomeBack') : t('continueAsGuest')}
              </p>
              <p className="text-sm text-gray-500">{fullName.trim()}</p>
              <button onClick={close} className="btn-primary w-full py-3">
                <LogIn className="w-4 h-4" /> {t('continueShopping')}
              </button>
            </div>
          ) : mode === 'choose' ? (
            <div className="space-y-3">
              <button onClick={() => setMode('register')}
                className="w-full p-4 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50/50 hover:bg-primary-50 text-start transition-all">
                <div className="flex items-center gap-3">
                  <BadgeCheck className="w-8 h-8 text-emerald-600" />
                  <div>
                    <p className="font-bold text-gray-900">{t('memberRegister')}</p>
                    <p className="text-xs text-gray-500">{t('idDocumentHint')}</p>
                  </div>
                </div>
              </button>
              <button onClick={() => setMode('login')}
                className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 text-start transition-all">
                <div className="flex items-center gap-3">
                  <UserRoundCheck className="w-8 h-8 text-primary-600" />
                  <div>
                    <p className="font-bold text-gray-900">{t('memberLogin')}</p>
                    <p className="text-xs text-gray-500">{t('haveAccount')}</p>
                  </div>
                </div>
              </button>
              <button onClick={() => setMode('guest')}
                className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-start transition-all">
                <div className="flex items-center gap-3">
                  <UserRound className="w-8 h-8 text-gray-500" />
                  <div>
                    <p className="font-bold text-gray-900">{t('guestCustomer')}</p>
                    <p className="text-xs text-gray-500">{t('guestNote')}</p>
                  </div>
                </div>
              </button>
              {customerAccounts.length === 0 && (
                <p className="text-xs text-center text-gray-400">{t('noAccount')}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="label">{t('fullName')} <span className="text-red-500">*</span></label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="input" placeholder={t('fullName')} />
              </div>
              <div>
                <label className="label">{t('phoneNumber')} <span className="text-red-500">*</span></label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="input" placeholder="06 XX XX XX XX" dir="ltr" />
              </div>

              {mode === 'register' && (
                <PhotoUpload
                  value={idPhoto}
                  onChange={(v) => setIdPhoto(v)}
                  label={t('uploadIdPhoto')}
                  hint={t('idDocumentHint')}
                  required
                />
              )}

              {mode === 'login' && customerAccounts.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">{t('haveAccount')}:</p>
                  <div className="space-y-1">
                    {customerAccounts.slice(-3).reverse().map(acc => (
                      <button key={acc.id} type="button"
                        onClick={() => { setFullName(acc.fullName); setPhone(acc.phone) }}
                        className="w-full text-start px-2 py-1.5 rounded hover:bg-white text-sm">
                        👤 {acc.fullName} — <span dir="ltr">{acc.phone}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
              )}

              <div className="flex gap-2">
                <button onClick={() => { setMode('choose'); setError('') }} className="btn-secondary text-sm">
                  {t('back')}
                </button>
                <button onClick={submit} className="btn-primary flex-1 text-sm">{t('confirm')}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CustomerAccountModal
