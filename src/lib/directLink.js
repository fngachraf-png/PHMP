// =====================================================================
// نظام الاتصال المباشر بين الزبون والصيدلية — PharmaCare Pro (PHMP)
// ---------------------------------------------------------------------
// المبدأ (حسب مطلب المالك): الطلب والدردشة يربطان الزبون بالكاشير أو
// الصيدلاني (حسب المتوفر) بشكل مباشر عبر المنصة؛ يُستهلك المحتوى بشكل
// مباشر في الجلسة (Realtime) ولا يُسجَّل في خادم المنصة إطلاقاً.
//
// التنفيذ التقني:
//  - BroadcastChannel API: بث فوري بين نافذة الزبون ونوافذ الموظفين
//    في نفس الجهاز/المتصفح (وهي القناة التي تستهلك الرسائل مباشرة
//    ولا تحفظها في أي مكان — ولا حتى localStorage).
//  - الرسائل (الدردشة) تبقى في ذاكرة المكون فقط (ephemeral) وتُمحى
//    بإغلاق الصفحة. لا تُرسل لأي خادم ولا تُخزَّن في قاعدة بيانات.
//  - الطلبات تُمرَّر مباشرة إلى بيئة الصيدلية المحلية (localStorage
//    الخاص بالمتصفح) وليس إلى خادم المنصة — كما أن مزامنة الخادم
//    المحلي (syncToServer) تستثني الدردشات عمداً.
//  - احتياط: في حال عدم توفر BroadcastChannel نستعمل أحداث storage.
// =====================================================================

const CHANNEL_NAME = 'phmp_direct_link'

let channel = null
const listeners = new Set()
let initialized = false

const canUseBroadcast = typeof window !== 'undefined' && 'BroadcastChannel' in window

const init = () => {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  if (canUseBroadcast) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME)
      channel.onmessage = (event) => {
        const msg = event.data
        if (!msg || !msg.type) return
        listeners.forEach((cb) => {
          try { cb(msg) } catch { /* مستمع معطل */ }
        })
      }
    } catch {
      channel = null
    }
  }

  if (!channel) {
    // احتياط: أحداث storage (تصل بين النوافذ فقط عند تغيّر القيمة)
    window.addEventListener('storage', (event) => {
      if (event.key !== '__phmp_direct_link' || !event.newValue) return
      try {
        const msg = JSON.parse(event.newValue)
        if (!msg || !msg.type) return
        listeners.forEach((cb) => {
          try { cb(msg) } catch { /* مستمع معطل */ }
        })
      } catch { /* رسالة غير صالحة */ }
    })
  }
}

export const directLink = {
  // الاشتراك في الرسائل المباشرة (تُستهلك فورياً)
  onMessage(callback) {
    init()
    listeners.add(callback)
    return () => listeners.delete(callback)
  },

  // إرسال رسالة مباشرة (بث فوري — لا يُحفظ في أي خادم)
  send(message) {
    init()
    const payload = { ...message, ts: Date.now(), via: canUseBroadcast && channel ? 'bc' : 'storage' }
    if (channel) {
      try { channel.postMessage(payload) } catch { /* تجاهل */ }
    } else if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('__phmp_direct_link', JSON.stringify(payload))
        // نحذفها فوراً حتى لا تبقى أي أثر مخزَّن (استهلاك مباشر)
        setTimeout(() => localStorage.removeItem('__phmp_direct_link'), 50)
      } catch { /* تجاهل */ }
    }
  },

  // رسائل الدردشة المباشرة
  sendChat(orderId, from, role, text) {
    this.send({ type: 'chat', orderId, from, role, text })
  },

  // إشعار حضور (متصل/غير متصل) — يسمح بمعرفة "حسب المتوفر"
  sendPresence(presence, who) {
    this.send({ type: 'presence', presence, who })
  },

  // إشعار طلب جديد (يصل فورياً لصفحة الطلبات المباشرة)
  announceOrder(order) {
    this.send({ type: 'order_new', order })
  },

  // إشعار تحديث حالة الطلب
  announceOrderUpdate(orderId, status, extra = {}) {
    this.send({ type: 'order_update', orderId, status, ...extra })
  },
}

export default directLink
