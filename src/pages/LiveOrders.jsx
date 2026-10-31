import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../contexts/AppContext'
import DirectChat from '../components/DirectChat'
import InvoicePrint from '../components/InvoicePrint'
import {
  Inbox, Stethoscope, UserRound, BadgeCheck, Phone, MapPin, Bike, Truck, Store,
  CheckCircle2, Package, CheckCheck, XCircle, Printer, Eye, MessageCircle, Banknote, Clock
} from 'lucide-react'

// =====================================================================
// الطلبات المباشرة (واجهة الموظف: الكاشير أو الصيدلاني حسب المتوفر)
// - الطلبات تصل مباشرة من واجهة الزبون عبر الاتصال الفوري (directLink)
// - طلبات الوصفات يُفضَّل أن يتولاها الصيدلاني، والباقي الكاشير
// - مراجعة صورة الوصفة + وثيقة هوية الزبون المشترك
// - تحديد مصاريف التوصيل (على حساب الزبون) ثم إصدار الفاتورة
// =====================================================================

const statusFlow = ['pending', 'accepted', 'preparing', 'ready', 'dispatched', 'completed']

const LiveOrders = () => {
  const {
    t, isRTL, language, currentUser, visibleOrders, updateOrder, pickName, logAudit, currentPharmacy,
  } = useApp()

  const [selectedId, setSelectedId] = useState(null)
  const [viewingPhoto, setViewingPhoto] = useState(null) // {src, label}
  const [deliveryFeeInput, setDeliveryFeeInput] = useState('')
  const [invoiceOrder, setInvoiceOrder] = useState(null)
  const [flashIds, setFlashIds] = useState([])

  // وميض الطلبات الجديدة الواصلة فورياً
  const [knownIds, setKnownIds] = useState(null)
  useEffect(() => {
    const ids = visibleOrders.map(o => o.id)
    if (knownIds === null) {
      setKnownIds(ids)
    } else {
      const fresh = ids.filter(id => !knownIds.includes(id))
      if (fresh.length > 0) {
        setFlashIds(fresh)
        setTimeout(() => setFlashIds([]), 6000)
      }
      setKnownIds(ids)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleOrders])

  const selected = visibleOrders.find(o => o.id === selectedId)

  const sortedOrders = useMemo(() => {
    const rank = (o) => {
      const i = statusFlow.indexOf(o.status)
      return i === -1 ? 99 : i
    }
    return [...visibleOrders].sort((a, b) => rank(a) - rank(b) || new Date(b.createdAt) - new Date(a.createdAt))
  }, [visibleOrders])

  const counts = useMemo(() => ({
    pending: visibleOrders.filter(o => o.status === 'pending').length,
    active: visibleOrders.filter(o => ['accepted', 'preparing', 'ready', 'dispatched'].includes(o.status)).length,
    done: visibleOrders.filter(o => ['completed', 'cancelled'].includes(o.status)).length,
  }), [visibleOrders])

  // ===== الإجراءات =====
  const acceptOrder = (order) => {
    updateOrder(order.id, {
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
      assignedTo: { id: currentUser.id, name: currentUser.name, role: currentUser.role },
    })
    logAudit('order_accept', { orderId: order.id, number: order.number })
  }

  const advanceStatus = (order, nextStatus) => {
    const updates = { status: nextStatus, [`${nextStatus}At`]: new Date().toISOString() }
    if (nextStatus === 'completed') {
      const fee = Number(deliveryFeeInput) || order.deliveryFee || 0
      updates.deliveryFee = fee
      updates.total = order.subtotal + fee
      updates.paymentMethod = order.paymentMethod || 'on_delivery'
      updates.servedBy = currentUser.name
      logAudit('order_complete', { orderId: order.id, total: updates.total })
    } else {
      logAudit('order_status', { orderId: order.id, status: nextStatus })
    }
    const updated = updateOrder(order.id, updates)
    if (nextStatus === 'completed' && updated) {
      setInvoiceOrder(updated)
    }
  }

  const rejectOrder = (order) => {
    updateOrder(order.id, { status: 'cancelled', cancelledAt: new Date().toISOString(), cancelledBy: 'staff' })
    logAudit('order_reject', { orderId: order.id })
  }

  const statusBadge = (status) => {
    const map = {
      pending: 'bg-gray-100 text-gray-700',
      accepted: 'bg-blue-100 text-blue-700',
      preparing: 'bg-amber-100 text-amber-700',
      ready: 'bg-cyan-100 text-cyan-700',
      dispatched: 'bg-indigo-100 text-indigo-700',
      completed: 'bg-emerald-100 text-emerald-700',
      cancelled: 'bg-red-100 text-red-600',
    }
    const key = 'status' + status.charAt(0).toUpperCase() + status.slice(1)
    return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${map[status] || 'bg-gray-100'}`}>{t(key)}</span>
  }

  const deliveryIcon = { pickup: Store, customer_delivery: Bike, pharmacy_delivery: Truck }
  const DeliveryIcon = (m) => deliveryIcon[m] || Store
  const deliveryLabel = (m) => m === 'pickup' ? t('pickupAtPharmacy') : m === 'customer_delivery' ? t('deliveryByCustomer') : t('deliveryByPharmacy')

  return (
    <div className="space-y-4">
      {/* الترويسة */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Inbox className="w-7 h-7 text-primary-600" />
            {t('liveOrders')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">{t('directConnectionNote')}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 font-semibold">{t('pendingOrders')}: {counts.pending}</span>
          <span className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-semibold">{t('statusPreparing')}: {counts.active}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ===== قائمة الطلبات ===== */}
        <div className="lg:col-span-2 space-y-3">
          {sortedOrders.length === 0 && (
            <div className="card p-12 text-center">
              <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">{t('noOrdersYet')}</p>
            </div>
          )}
          {sortedOrders.map(order => {
            const DIcon = DeliveryIcon(order.deliveryMethod)
            const isNew = flashIds.includes(order.id)
            const isSel = selectedId === order.id
            return (
              <button
                key={order.id}
                onClick={() => { setSelectedId(order.id); setInvoiceOrder(null); setDeliveryFeeInput(order.deliveryFee || '') }}
                className={`w-full card p-4 text-start transition-all ${isSel ? 'ring-2 ring-primary-500' : 'hover:shadow-md'} ${isNew ? 'animate-pulse-slow border-primary-400 bg-primary-50/40' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-gray-900 text-sm" dir="ltr">{order.number}</span>
                  {statusBadge(order.status)}
                </div>
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-700">
                  <UserRound className="w-3.5 h-3.5 text-gray-400" />
                  <span className="font-medium truncate">{order.customer?.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${order.customer?.type === 'member' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                    {order.customer?.type === 'member' ? t('memberBadge') : t('guestBadge')}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><DIcon className="w-3 h-3" /> {deliveryLabel(order.deliveryMethod)}</span>
                  {order.needsPrescription && (
                    <span className="flex items-center gap-1 text-amber-600 font-semibold">
                      <Stethoscope className="w-3 h-3" /> Rx
                    </span>
                  )}
                  <span className="ms-auto font-bold text-primary-600">{Number(order.subtotal).toFixed(2)}</span>
                </div>
                {order.preferredRole === 'pharmacist' && order.status === 'pending' && (
                  <p className="mt-1.5 text-[10px] text-violet-600 font-medium">{t('preferredStaffRx')}</p>
                )}
              </button>
            )
          })}
        </div>

        {/* ===== تفاصيل الطلب ===== */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="card p-12 text-center border-dashed">
              <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">{t('noOrdersYet')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* بطاقة العميل */}
              <div className="card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900" dir="ltr">{selected.number}</h3>
                  {statusBadge(selected.status)}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-2 font-semibold text-gray-900">
                      <UserRound className="w-4 h-4 text-primary-600" /> {selected.customer?.name}
                    </p>
                    <p className="flex items-center gap-2 text-gray-600 text-xs" dir="ltr">
                      <Phone className="w-3.5 h-3.5" /> {selected.customer?.phone}
                    </p>
                    {selected.deliveryMethod !== 'pickup' && selected.deliveryAddress && (
                      <p className="flex items-start gap-2 text-gray-600 text-xs">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {selected.deliveryAddress}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    {selected.customer?.type === 'member' && selected.customer?.idPhoto && (
                      <button onClick={() => setViewingPhoto({ src: selected.customer.idPhoto, label: t('viewIdPhoto') })}
                        className="btn-secondary text-xs py-1.5 w-full">
                        <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" /> {t('viewIdPhoto')} · {t('memberBadge')}
                      </button>
                    )}
                    {selected.needsPrescription && selected.prescriptionPhoto && (
                      <button onClick={() => setViewingPhoto({ src: selected.prescriptionPhoto, label: t('viewPrescription') })}
                        className="btn-secondary text-xs py-1.5 w-full">
                        <Stethoscope className="w-3.5 h-3.5 text-amber-600" /> {t('viewPrescription')}
                      </button>
                    )}
                  </div>
                </div>

                {/* الأدوية */}
                <div className="border-t border-gray-100 pt-3 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-500 uppercase">{t('orderItems')}</p>
                  {selected.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{pickName(item)}</span>
                        {item.requiresPrescription && <span className="badge-info text-[10px]">Rx</span>}
                      </span>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {item.price.toFixed(2)} × {item.quantity} = <b className="text-gray-900">{(item.price * item.quantity).toFixed(2)}</b>
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
                    <span>{t('subtotal')}</span>
                    <span className="text-primary-600">{Number(selected.subtotal).toFixed(2)} {t('currency')}</span>
                  </div>
                </div>

                {/* مصاريف التوصيل */}
                {selected.status !== 'completed' && selected.status !== 'cancelled' && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <label className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                      <Banknote className="w-3.5 h-3.5" /> {t('setDeliveryFee')} ({t('deliveryFeeNote')})
                    </label>
                    <input
                      type="number" min="0" step="0.5"
                      value={deliveryFeeInput}
                      onChange={(e) => setDeliveryFeeInput(e.target.value)}
                      className="input mt-1.5 py-1.5 text-sm w-32" dir="ltr" placeholder="0.00"
                    />
                  </div>
                )}

                {/* الإجراءات حسب الحالة */}
                {selected.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => acceptOrder(selected)} className="btn-primary flex-1">
                      <CheckCircle2 className="w-4 h-4" /> {t('acceptOrder')}
                    </button>
                    <button onClick={() => rejectOrder(selected)} className="btn-danger px-4">
                      <XCircle className="w-4 h-4" /> {t('rejectOrder')}
                    </button>
                  </div>
                )}
                {selected.status === 'accepted' && (
                  <button onClick={() => advanceStatus(selected, 'preparing')} className="btn-primary w-full">
                    <Package className="w-4 h-4" /> {t('markPreparing')}
                  </button>
                )}
                {selected.status === 'preparing' && (
                  <div className="grid grid-cols-2 gap-2">
                    {selected.deliveryMethod === 'pickup' ? (
                      <button onClick={() => advanceStatus(selected, 'ready')} className="btn-primary col-span-2">
                        <Store className="w-4 h-4" /> {t('markReady')}
                      </button>
                    ) : (
                      <button onClick={() => advanceStatus(selected, 'dispatched')} className="btn-primary col-span-2">
                        <Truck className="w-4 h-4" /> {t('markDispatched')}
                      </button>
                    )}
                  </div>
                )}
                {(selected.status === 'ready' || selected.status === 'dispatched') && (
                  <button onClick={() => advanceStatus(selected, 'completed')} className="btn-primary w-full">
                    <CheckCheck className="w-4 h-4" /> {t('markCompleted')} · {t('generateInvoice')}
                  </button>
                )}
                {selected.status === 'completed' && (
                  <button onClick={() => setInvoiceOrder(selected)} className="btn-secondary w-full">
                    <Printer className="w-4 h-4" /> {t('printInvoice')}
                  </button>
                )}

                {/* الموظف المكلف */}
                {selected.assignedTo && (
                  <p className="text-xs text-gray-500 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    {t('assignedTo')}: <b>{selected.assignedTo.name}</b> ({t('role' + selected.assignedTo.role.charAt(0).toUpperCase() + selected.assignedTo.role.slice(1))})
                  </p>
                )}
              </div>

              {/* الدردشة المباشرة مع الزبون */}
              <div className="card p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <MessageCircle className="w-4 h-4 text-primary-600" />
                  <span>{t('connectedWith')}: <b className="text-gray-900">{selected.customer?.name}</b></span>
                </div>
                <DirectChat
                  orderId={selected.id}
                  who={currentUser.name}
                  role={currentUser.role}
                  counterpartLabel={selected.customer?.name}
                  pharmacyId={selected.pharmacyId}
                />
                <p className="text-[11px] text-center text-gray-400 leading-relaxed">{t('chatPrivateNote')}</p>
              </div>

              {/* الفاتورة بعد الإتمام */}
              {invoiceOrder && (
                <div className="card p-4">
                  <InvoicePrint sale={invoiceOrder} mode="invoice" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* معاينة الصور (الوصفة / الهوية) */}
      {viewingPhoto && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setViewingPhoto(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h4 className="font-bold text-gray-900">{viewingPhoto.label}</h4>
              <button onClick={() => setViewingPhoto(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">✕</button>
            </div>
            <img src={viewingPhoto.src} alt={viewingPhoto.label} className="w-full max-h-[75dvh] object-contain bg-gray-50" />
          </div>
        </div>
      )}
    </div>
  )
}

export default LiveOrders
