import { useState } from 'react'
import { useApp } from '../contexts/AppContext'
import PhotoUpload from './PhotoUpload'
import {
  X, UserRound, UserRoundCheck, Stethoscope, Truck, Store, Bike, PackageCheck,
  ArrowRight, ArrowLeft, ShieldCheck, Info, BadgeCheck
} from 'lucide-react'

// =====================================================================
// إتمام الطلب (الزبون): زبون عابر / زبون مشترك (تسجيل بالاسم الكامل +
// الهاتف + صورة واضحة لوثيقة الهوية) + صورة الوصفة للأدوية المقيدة +
// خيار التوصيل (بنفسه أو عبر الصيدلية — المصاريف على الزبون)
// =====================================================================

const CheckoutModal = ({ open, onClose, cart, subtotal, hasRxItems, pharmacy, onPlaceOrder }) => {
  const { t, language, isRTL, pickName, customerAccounts, registerCustomer, loginCustomerAccount, continueAsGuest, currentCustomer } = useApp()

  // الهوية
  const [identityMode, setIdentityMode] = useState('choose') // choose | guest | login | register
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [idPhoto, setIdPhoto] = useState(null)
  const [idPhotoClear, setIdPhotoClear] = useState(false)
  const [formError, setFormError] = useState('')

  // الوصفة الطبية
  const [rxPhoto, setRxPhoto] = useState(null)
  const [rxPhotoClear, setRxPhotoClear] = useState(false)

  // التوصيل
  const [deliveryMethod, setDeliveryMethod] = useState('pickup')
  const [deliveryAddress, setDeliveryAddress] = useState('')

  const [step, setStep] = useState(1) // 1: هوية 2: وصفة 3: توصيل 4: تأكيد
  const [placing, setPlacing] = useState(false)

  if (!open) return null

  const nameValid = fullName.trim().length >= 3
  const phoneValid = phone.replace(/\D/g, '').length >= 10
  const Arrow = isRTL ? ArrowLeft : ArrowRight

  const submitIdentity = () => {
    setFormError('')
    if (!nameValid) return setFormError(t('fullNameRequired'))
    if (!phoneValid) return setFormError(t('phoneRequired'))

    if (identityMode === 'guest') {
      continueAsGuest(fullName.trim(), phone.trim())
    } else if (identityMode === 'login') {
      const res = loginCustomerAccount(fullName.trim(), phone.trim())
      if (!res.ok) return setFormError(t(res.error))
    } else if (identityMode === 'register') {
      if (!idPhoto) return setFormError(t('idPhotoRequired'))
      const res = registerCustomer({ fullName: fullName.trim(), phone: phone.trim(), idPhoto, address: deliveryAddress })
      if (!res.ok) return setFormError(t(res.error))
    }
    setStep(hasRxItems ? 2 : 3)
  }

  const submitPrescription = () => {
    if (hasRxItems && !rxPhoto) return setFormError(t('prescriptionPhotoRequired'))
    setFormError('')
    setStep(3)
  }

  const submitDelivery = () => {
    setFormError('')
    if (deliveryMethod !== 'pickup' && deliveryMethod !== 'customer_delivery' && deliveryAddress.trim().length < 5) {
      return setFormError(t('address'))
    }
    setStep(4)
  }

  const confirmOrder = () => {
    setPlacing(true)
    onPlaceOrder({
      customer: {
        name: currentCustomer.fullName,
        phone: currentCustomer.phone,
        type: currentCustomer.type,
        idPhoto: currentCustomer.type === 'member' ? currentCustomer.idPhoto : null,
      },
      prescriptionPhoto: hasRxItems ? rxPhoto : null,
      deliveryMethod,
      deliveryAddress: deliveryMethod === 'pickup' ? '' : deliveryAddress.trim(),
    })
  }

  const deliveryOptions = [
    { id: 'pickup', icon: Store, title: t('pickupAtPharmacy'), note: t('pickupNote') },
    { id: 'customer_delivery', icon: Bike, title: t('deliveryByCustomer'), note: t('deliveryByCustomerNote') },
    { id: 'pharmacy_delivery', icon: Truck, title: t('deliveryByPharmacy'), note: t('deliveryByPharmacyNote') },
  ]

  const steps = [t('customer'), hasRxItems ? t('prescriptionDoc') : null, t('deliveryMethod'), t('confirm')].filter(Boolean)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col animate-slide-up">
        {/* الرأس */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{t('checkout')}</h3>
            <p className="text-xs text-gray-500">{pharmacy ? (t('choosePharmacy') + ': ' + pickName(pharmacy)) : ''}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        {/* مؤشر الخطوات */}
        <div className="px-5 py-3 flex items-center gap-1 bg-gray-50 border-b border-gray-200 overflow-x-auto">
          {steps.map((label, i) => (
            <div key={i} className="flex items-center gap-1 flex-shrink-0">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step > i ? 'bg-primary-600 text-white' : step === i + 1 ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500' : 'bg-gray-200 text-gray-500'}`}>
                {step > i + 1 ? '✓' : i + 1}
              </span>
              <span className={`text-xs font-medium whitespace-nowrap ${step === i + 1 ? 'text-gray-900' : 'text-gray-500'}`}>{label}</span>
              {i < steps.length - 1 && <span className="w-4 h-px bg-gray-300 mx-0.5" />}
            </div>
          ))}
        </div>

        {/* المحتوى */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{formError}</div>
          )}

          {/* ===== الخطوة 1: الهوية ===== */}
          {step === 1 && (
            <>
              {identityMode === 'choose' && currentCustomer ? (
                /* زبون مسجل الدخول مسبقاً (من نافذة حسابي) — تخطي الهوية */
                <div className="space-y-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                    <p className="text-sm text-emerald-700">{t('welcomeBack')}</p>
                    <p className="font-bold text-gray-900 mt-1">
                      {currentCustomer.fullName}
                      <span className={`ms-2 text-[10px] px-1.5 py-0.5 rounded-full ${currentCustomer.type === 'member' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                        {currentCustomer.type === 'member' ? t('memberBadge') : t('guestBadge')}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5" dir="ltr">{currentCustomer.phone}</p>
                  </div>
                  <button onClick={() => setStep(hasRxItems ? 2 : 3)} className="btn-primary w-full py-3">
                    {t('next')} <Arrow className="w-4 h-4" />
                  </button>
                  <button onClick={() => setIdentityMode('switch')}
                    className="w-full text-xs text-gray-500 hover:text-primary-600 py-1">
                    {t('switchIdentity')}
                  </button>
                </div>
              ) : (identityMode === 'choose' || identityMode === 'switch') ? (
                <div className="space-y-3">
                  <button onClick={() => setIdentityMode('guest')}
                    className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 text-start transition-all">
                    <div className="flex items-center gap-3">
                      <UserRound className="w-8 h-8 text-gray-500" />
                      <div>
                        <p className="font-bold text-gray-900">{t('guestCustomer')}</p>
                        <p className="text-xs text-gray-500">{t('guestNote')}</p>
                      </div>
                    </div>
                  </button>
                  <button onClick={() => setIdentityMode('login')}
                    className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 text-start transition-all">
                    <div className="flex items-center gap-3">
                      <UserRoundCheck className="w-8 h-8 text-primary-600" />
                      <div>
                        <p className="font-bold text-gray-900">{t('memberLogin')}</p>
                        <p className="text-xs text-gray-500">{t('haveAccount')}</p>
                      </div>
                    </div>
                  </button>
                  <button onClick={() => setIdentityMode('register')}
                    className="w-full p-4 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50/50 hover:bg-primary-50 text-start transition-all">
                    <div className="flex items-center gap-3">
                      <BadgeCheck className="w-8 h-8 text-emerald-600" />
                      <div>
                        <p className="font-bold text-gray-900">{t('memberRegister')}</p>
                        <p className="text-xs text-gray-500">{t('idDocumentHint')}</p>
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

                  {identityMode === 'register' && (
                    <PhotoUpload
                      value={idPhoto}
                      onChange={(v, clear) => { setIdPhoto(v); setIdPhotoClear(clear) }}
                      label={t('uploadIdPhoto')}
                      hint={t('idDocumentHint')}
                      required
                    />
                  )}

                  {identityMode === 'login' && customerAccounts.length > 0 && (
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

                  <div className="flex gap-2">
                    <button onClick={() => { setIdentityMode('choose'); setFormError('') }} className="btn-secondary text-sm">
                      {t('back')}
                    </button>
                    <button onClick={submitIdentity} className="btn-primary flex-1 text-sm">
                      {t('next')} <Arrow className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== الخطوة 2: الوصفة الطبية ===== */}
          {step === 2 && hasRxItems && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                <Stethoscope className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">{t('prescriptionNeededMsg')}</p>
              </div>
              <ul className="text-sm space-y-1">
                {cart.filter(i => i.requiresPrescription).map((i, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {pickName(i)} {i.requiresPrescription && <span className="badge-info text-[10px]">Rx</span>}
                  </li>
                ))}
              </ul>
              <PhotoUpload
                value={rxPhoto}
                onChange={(v, clear) => { setRxPhoto(v); setRxPhotoClear(clear) }}
                label={t('uploadPrescriptionPhoto')}
                hint={t('prescriptionPhotoRequired')}
                required
                maxDim={1280}
              />
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="btn-secondary text-sm">{t('back')}</button>
                <button onClick={submitPrescription} className="btn-primary flex-1 text-sm">
                  {t('next')} <Arrow className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ===== الخطوة 3: التوصيل ===== */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                {deliveryOptions.map(opt => {
                  const Icon = opt.icon
                  const active = deliveryMethod === opt.id
                  return (
                    <button key={opt.id} onClick={() => setDeliveryMethod(opt.id)}
                      className={`w-full p-4 rounded-xl border-2 text-start transition-all ${active ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex items-start gap-3">
                        <Icon className={`w-6 h-6 mt-0.5 ${active ? 'text-primary-600' : 'text-gray-400'}`} />
                        <div className="flex-1">
                          <p className={`font-bold ${active ? 'text-primary-800' : 'text-gray-900'}`}>{opt.title}</p>
                          <p className="text-xs text-gray-500">{opt.note}</p>
                        </div>
                        {active && <ShieldCheck className="w-5 h-5 text-primary-600" />}
                      </div>
                    </button>
                  )
                })}
              </div>

              {deliveryMethod === 'pharmacy_delivery' && (
                <div>
                  <label className="label">{t('address')}</label>
                  <textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="input min-h-[70px]" rows={2} />
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800">{t('deliveryFeeNote')}</p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(hasRxItems ? 2 : 1)} className="btn-secondary text-sm">{t('back')}</button>
                <button onClick={submitDelivery} className="btn-primary flex-1 text-sm">
                  {t('next')} <Arrow className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ===== الخطوة 4: التأكيد ===== */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('customer')}</span>
                  <span className="font-semibold">
                    {currentCustomer?.fullName}
                    <span className={`ms-2 text-[10px] px-1.5 py-0.5 rounded-full ${currentCustomer?.type === 'member' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                      {currentCustomer?.type === 'member' ? t('memberBadge') : t('guestBadge')}
                    </span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('phone')}</span>
                  <span dir="ltr">{currentCustomer?.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('deliveryMethod')}</span>
                  <span className="font-semibold">{deliveryOptions.find(d => d.id === deliveryMethod)?.title}</span>
                </div>
                {hasRxItems && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('prescriptionDoc')}</span>
                    <span className="font-semibold text-emerald-600">✓ {t('photoAttached')}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-2 space-y-1.5">
                  {cart.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-gray-700">{pickName(item)} × {item.quantity}</span>
                      <span className="font-medium">{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1.5 border-t border-gray-200 font-bold text-base">
                    <span>{t('subtotal')}</span>
                    <span className="text-primary-600">{subtotal.toFixed(2)} {t('currency')}</span>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex gap-2">
                <PackageCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-800">{t('paymentOnDelivery')}</p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(3)} className="btn-secondary text-sm">{t('back')}</button>
                <button onClick={confirmOrder} disabled={placing} className="btn-primary flex-1 text-sm">
                  {placing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t('placeOrder')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CheckoutModal
