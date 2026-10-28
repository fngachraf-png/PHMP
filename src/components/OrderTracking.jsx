import { useApp } from '../contexts/AppContext'
import DirectChat from './DirectChat'
import InvoicePrint from './InvoicePrint'
import {
  Clock, CheckCircle2, Package, Store, Truck, CheckCheck, XCircle,
  MapPin, Phone, Printer, MessageCircle, ReceiptText, Stethoscope
} from 'lucide-react'

// =====================================================================
// تتبع طلب الزبون: خط زمني للحالة + دردشة مباشرة مع الموظف المتاح
// (الكاشير أو الصيدلاني حسب المتوفر) + فاتورة قابلة للطباعة عند الإتمام
// =====================================================================

const OrderTracking = ({ order, onCancel }) => {
  const { t, isRTL, language, pickName, pickAddress } = useApp()

  if (!order) return null

  const isDelivery = order.deliveryMethod !== 'pickup'
  const flow = [
    { id: 'pending', label: t('statusPending'), icon: Clock, color: 'gray' },
    { id: 'accepted', label: t('statusAccepted'), icon: CheckCircle2, color: 'blue' },
    { id: 'preparing', label: t('statusPreparing'), icon: Package, color: 'amber' },
    isDelivery
      ? { id: 'dispatched', label: t('statusDispatched'), icon: Truck, color: 'indigo' }
      : { id: 'ready', label: t('statusReady'), icon: Store, color: 'cyan' },
    { id: 'completed', label: t('statusCompleted'), icon: CheckCheck, color: 'emerald' },
  ]
  const currentIndex = flow.findIndex(s => s.id === order.status)
  const cancelled = order.status === 'cancelled'
  const completed = order.status === 'completed'

  const staffLabel = order.assignedTo?.name ||
    (order.preferredRole === 'pharmacist' ? t('rolePharmacist') : t('roleCashier'))

  return (
    <div className="space-y-4">
      {/* بطاقة الحالة */}
      <div className="card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">{t('orderNumber')}</p>
            <h3 className="text-xl font-bold text-gray-900" dir="ltr">{order.number}</h3>
          </div>
          {order.status === 'pending' && (
            <button onClick={() => onCancel?.(order.id)} className="btn-danger text-xs py-1.5 px-3">
              <XCircle className="w-3.5 h-3.5" /> {t('cancelOrder')}
            </button>
          )}
        </div>

        {/* الخط الزمني */}
        {cancelled ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <XCircle className="w-8 h-8 text-red-500" />
            <div>
              <p className="font-bold text-red-700">{t('statusCancelled')}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between relative">
            {flow.map((s, i) => {
              const Icon = s.icon
              const done = i <= currentIndex
              const isCurrent = i === currentIndex
              return (
                <div key={s.id} className="flex flex-col items-center gap-1.5 relative z-10">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    done ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-300'
                  } ${isCurrent ? 'ring-4 ring-primary-100 scale-110' : ''}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-[10px] font-medium text-center leading-tight max-w-[64px] ${done ? 'text-gray-900' : 'text-gray-400'}`}>
                    {s.label}
                  </span>
                  {i < flow.length - 1 && (
                    <div className={`absolute top-5 ${isRTL ? 'right-full' : 'left-full'} w-[calc(100%-2.5rem)] h-0.5 -translate-y-1/2 ${i < currentIndex ? 'bg-primary-600' : 'bg-gray-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* معلومات الصيدلية */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-gray-700">
            <Store className="w-4 h-4 text-primary-600" />
            <span className="font-semibold">{order.pharmacy ? pickName(order.pharmacy) : ''}</span>
          </div>
          {order.pharmacy?.address && (
            <p className="flex items-center gap-2 text-xs text-gray-500">
              <MapPin className="w-3.5 h-3.5" /> {pickAddress(order.pharmacy)}
            </p>
          )}
          {order.pharmacy?.phone && (
            <p className="flex items-center gap-2 text-xs text-gray-500" dir="ltr">
              <Phone className="w-3.5 h-3.5" /> {order.pharmacy.phone}
            </p>
          )}
        </div>

        {/* أدوية الطلب */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('orderItems')}</p>
          <div className="space-y-1.5">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm bg-white border border-gray-100 rounded-lg px-3 py-2">
                <span className="flex items-center gap-1.5">
                  <span className="text-gray-800">{pickName(item)}</span>
                  {item.requiresPrescription && (
                    <span className="badge-info text-[10px] flex items-center gap-0.5">
                      <Stethoscope className="w-2.5 h-2.5" /> Rx
                    </span>
                  )}
                </span>
                <span className="text-gray-500 text-xs">× {item.quantity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* المجموع */}
        <div className="flex items-center justify-between border-t border-gray-200 pt-3">
          <span className="font-bold text-gray-900">{completed ? t('grandTotal') : t('subtotal')}</span>
          <span className="text-xl font-bold text-primary-600">
            {Number(completed ? order.total : order.subtotal).toFixed(2)} {t('currency')}
          </span>
        </div>
        {completed && order.deliveryFee > 0 && (
          <p className="text-xs text-gray-500 text-end">
            ({t('subtotal')}: {order.subtotal?.toFixed(2)} + {t('deliveryFee')}: {order.deliveryFee?.toFixed(2)})
          </p>
        )}

        {/* الفاتورة عند الإتمام */}
        {completed && (
          <div className="pt-2">
            <InvoicePrint sale={order} mode="invoice" />
          </div>
        )}
      </div>

      {/* الدردشة المباشرة مع الموظف (اتصال مباشر — لا يُسجَّل في الخادم) */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <MessageCircle className="w-4 h-4 text-primary-600" />
          <span>{t('connectedWith')}: <b className="text-gray-900">{staffLabel}</b></span>
        </div>
        <DirectChat
          orderId={order.id}
          who={order.customer?.name}
          role="customer"
          counterpartLabel={staffLabel}
        />
        <p className="text-[11px] text-center text-gray-400 leading-relaxed">{t('directConnectionNote')}</p>
      </div>
    </div>
  )
}

export default OrderTracking
