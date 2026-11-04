// =====================================================================
// PHMP — عميل الاتصال الفوري (WebSocket + احتياط BroadcastChannel)
// ---------------------------------------------------------------------
// مزامنة الرسائل والمكالمات بين الزبون والموظفين عبر الأجهزة:
//  - الوضع الأمثل: WebSocket إلى الطبقة السحابية الدائمة phmp-realtime
//    (Durable Object على حافة Cloudflare — يعمل دائماً حتى لو نام خادم
//    المالك خلف النفق) — التراسل والمكالمات والطلبات بين أي جهازين.
//  - الاحتياطي 1: بوابة خادم المالك (النفق الدائم) عند غياب الطبقة
//    السحابية، مع إعادة تفضيلها دورياً (شفاف — نفس البروتوكول).
//  - الاحتياطي 2: BroadcastChannel (نفس المتصفح) عبر directLink —
//    يبقى الاتصال المباشر محلياً عند غياب النقطتين.
// لا تُخزَّن الرسائل في أي مكان: تُستهلك مباشرة في الجلسة (قاعدة المالك).
// =====================================================================
import { getApiUrl, getLiveUrl } from './api'
import { directLink } from './directLink'

const RECONNECT_BASE = 1000
const RECONNECT_MAX = 20000
const PING_EVERY = 25000
const LIVE_RETRY_AFTER = 3 * 60 * 1000 // بعد فشل الطبقة السحابية: تجربتها مجدداً بعد 3 دقائق

class RealtimeClient {
  constructor() {
    this.ws = null
    this.status = 'idle'            // idle | connecting | online | offline
    this.identity = null            // { kind, userId, name, role }
    this.listeners = new Set()
    this.statusListeners = new Set()
    this.attempt = 0
    this.reconnectTimer = null
    this.pingTimer = null
    this.manualClose = false
    this.queue = []                 // رسائل بانتظار اكتمال الاتصال
    this.roomNames = new Set()      // الغرف الملتحق بها
  }

  // ===== الاشتراك في الأحداث (chat / call / presence / order / welcome…) =====
  onMessage(cb) {
    this.listeners.add(cb)
    // الوضع الاحتياطي: استقبال أحداث BroadcastChannel كذلك (نفس المتصفح)
    const off = directLink.onMessage((msg) => {
      if (this.status !== 'online') cb({ ...msg, via: 'local' })
    })
    return () => {
      this.listeners.delete(cb)
      off()
    }
  }

  onStatus(cb) {
    this.statusListeners.add(cb)
    cb(this.status)
    return () => this.statusListeners.delete(cb)
  }

  emit(payload) {
    this.listeners.forEach((cb) => { try { cb(payload) } catch { /* مستمع معطل */ } })
  }

  setStatus(s) {
    if (this.status === s) return
    this.status = s
    this.statusListeners.forEach((cb) => { try { cb(s) } catch { /* تجاهل */ } })
  }

  // ===== الاتصال =====
  // للموظفين: connect({ token, userId, name, role }) — للزبناء: connect({ guest: { name, phone, pharmacyId } })
  // idempotent: إن كان الاتصال قائماً بنفس الهوية فلا يُعاد فتحه — يُستدعى بأمان
  // عند الإقلاع (استعادة الجلسة) وعند الدخول اليدوي معاً.
  // تبديل الهوية (ضيف ↔ موظف أو مستخدم آخر): يُفكَّك المقبس القديم نظيفاً
  // ويُفتح اتصال جديد بالمصادقة الجديدة — كان يُستبدل المرجع فقط فيبقى
  // المقبس موثقاً بالهوية القديمة (خلل جذري v2.2.0).
  connect(auth) {
    if (typeof window === 'undefined') return
    const sameIdentity = (a, b) => {
      if (!a || !b) return false
      // موظفون: نفس المستخدم حصراً (كان أي رمزين يُعتبران نفس الهوية —
      // فتبديل الحساب على نفس المتصفح لا يفتح اتصالاً بهوية الموظف الجديد)
      if (a.token && b.token) return a.userId === b.userId
      if (a.guest && b.guest) return a.guest.name === b.guest.name && a.guest.pharmacyId === b.guest.pharmacyId
      return false
    }
    const live = this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)
    if (live && sameIdentity(this.auth, auth)) {
      this.auth = auth // تحديث المرجع فقط (نفس الهوية — الرمز نفسه)
      return
    }
    this.auth = auth
    // هوية مختلفة على مقبس قائم: تفكيك نظيف ثم اتصال جديد بالمصادقة الجديدة
    if (live) this.teardownSocket()
    this.manualClose = false
    this.attempt = 0
    if (auth?.token) {
      this.identity = { kind: 'staff', userId: auth.userId, name: auth.name, role: auth.role }
    } else if (auth?.guest) {
      this.identity = { kind: 'customer', name: auth.guest.name, role: 'customer' }
    }
    this.open()
  }

  // تفكيك نظيف للمقبس الحالي دون جدولة إعادة اتصال (لتبديل الهوية فقط):
  // تُزال معالجاته كي لا تُغيّر الحالة ولا تُجدول إعادة اتصال بعد الإغلاق
  teardownSocket() {
    const old = this.ws
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    clearInterval(this.pingTimer)
    this.pingTimer = null
    this.queue = [] // رسائل الانتظار مرتبطة بالهوية السابقة — لا تُرسل بالجديدة
    this.ws = null
    if (old) {
      old.onopen = null
      old.onmessage = null
      old.onclose = null
      old.onerror = null
      try { old.close() } catch { /* تجاهل */ }
    }
  }

  open() {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return
    this.setStatus(this.attempt === 0 ? 'connecting' : 'offline')
    // اختيار نقطة الاتصال: الطبقة السحابية الدائمة أولاً؛ وعند تعذرها
    // (تعذر شبكي/نشر لاحق) نستعمل بوابة خادم المالك ونعيد تفضيل السحابية
    // بعد مهلة — التبديل شفاف: نفس البروتوكول على النقطتين.
    this.useLive = Date.now() >= (this.liveDownUntil || 0)
    let base
    try {
      base = this.useLive ? getLiveUrl() : getApiUrl()
    } catch {
      this.scheduleReconnect(); return
    }
    let url
    try {
      url = base.replace(/^http/, 'ws') + '/ws'
    } catch {
      this.scheduleReconnect(); return
    }
    let ws
    try { ws = new WebSocket(url) } catch { this.scheduleReconnect(); return }
    this.ws = ws
    this.welcomed = false

    const failTimer = setTimeout(() => {
      if (ws.readyState !== 1) { try { ws.close() } catch { /* تجاهل */ } }
    }, 6000)

    ws.onopen = () => {
      clearTimeout(failTimer)
      const authMsg = this.auth?.token
        ? { type: 'auth', token: this.auth.token }
        : { type: 'auth', guest: this.auth?.guest || {} }
      try { ws.send(JSON.stringify(authMsg)) } catch { /* تجاهل */ }
    }

    ws.onmessage = (event) => {
      let msg
      try { msg = JSON.parse(event.data) } catch { return }
      if (msg.type === 'welcome') {
        this.attempt = 0
        this.welcomed = true
        if (this.useLive) this.liveDownUntil = 0 // الطبقة السحابية حية
        this.setStatus('online')
        // إعادة الانضمام للغرف والمراقبة بعد انقطاع
        this.roomNames.forEach((room) => this.send({ type: 'join', room }))
        if (this.watchIds?.length) this.send({ type: 'watch-orders', ids: this.watchIds })
        // تصريف الرسائل المنتظرة
        const q = this.queue.splice(0)
        q.forEach((m) => this.send(m))
        this.emit({ ...msg, via: 'server' })
        this.keepAlive()
        return
      }
      if (msg.type === 'pong') return
      if (msg.type === 'heartbeat') {
        try { ws.send(JSON.stringify({ type: 'ping' })) } catch { /* تجاهل */ }
        return
      }
      this.emit({ ...msg, via: 'server' })
    }

    ws.onclose = (event) => {
      clearTimeout(failTimer)
      clearInterval(this.pingTimer)
      this.setStatus('offline')
      // نقطة الاتصال السحابية لم تُصادقنا أبداً (غير منشورة/تعذر وصول/تعذر
      // تحقق — 4005): بدّل للبوابة فوراً بلا انتظار التراجع الأسي
      if (this.useLive && !this.welcomed) {
        this.liveDownUntil = Date.now() + LIVE_RETRY_AFTER
        this.attempt = 0
        if (!this.manualClose) this.open()
        return
      }
      // 4003 = مصادقة غير صالحة (رمز JWT منتهٍ أو حساب موقوف): لا إعادة اتصال،
      // بل إشعار صريح للواجهة كي تنهي الجلسة بأناقة بدل البقاء «ظاهرياً متصلاً».
      if (event.code === 4003) {
        this.emit({ type: 'session_expired', via: 'server' })
        return
      }
      if (!this.manualClose) this.scheduleReconnect()
    }

    ws.onerror = () => { /* onclose سيتولى الأمر */ }
  }

  scheduleReconnect() {
    if (this.reconnectTimer || this.manualClose) return
    this.attempt += 1
    const delay = Math.min(RECONNECT_BASE * Math.pow(1.6, this.attempt - 1), RECONNECT_MAX)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.open()
    }, delay)
  }

  keepAlive() {
    clearInterval(this.pingTimer)
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping' })
    }, PING_EVERY)
  }

  disconnect() {
    this.manualClose = true
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    clearInterval(this.pingTimer)
    if (this.ws) { try { this.ws.close() } catch { /* تجاهل */ } }
    this.ws = null
    this.setStatus('idle')
  }

  // ===== الإرسال =====
  send(payload) {
    if (this.ws && this.ws.readyState === 1) {
      try { this.ws.send(JSON.stringify(payload)); return true } catch { /* تجاهل */ }
    }
    return false
  }

  sendOrQueue(payload) {
    if (this.send(payload)) return true
    if (this.status === 'connecting') { this.queue.push(payload); return true }
    return false
  }

  // ===== الدردشة =====
  // room: غرفة طلب (زبون ↔ موظفي الصيدلية) | to: user:<id> أو client:<id> مباشرة
  // displayName: اسم الطرف الحالي (يُعتمد للضيوف؛ الموظفون دوماً باسم جلستهم الموثقة)
  sendChat({ room, to, text, displayName }) {
    if (room) this.roomNames.add(room)
    const ok = this.sendOrQueue({ type: 'chat', room, to, text, displayName })
    if (ok) return 'server'
    // احتياط: بث محلي (نفس المتصفح) — يُرسل اسم الغرفة كما هو؛ المستقبِل
    // (DirectChat) يقبل المعرّف الخام وصيغة الغرفة معاً (order:/dm:)
    directLink.sendChat(room || `dm:${to}`, displayName || this.identity?.name || 'PHMP', this.identity?.role || 'user', text)
    return 'local'
  }

  joinRoom(room) {
    if (!room) return
    this.roomNames.add(room)
    this.send({ type: 'join', room })
  }

  // ===== مراقبة طلبات الزبون (استقبال تحديثات الحالة عبر الأجهزة) =====
  watchOrders(ids) {
    this.watchIds = (ids || []).slice(0, 50)
    this.send({ type: 'watch-orders', ids: this.watchIds })
  }

  // ===== إشارات المكالمات (WebRTC — الوسائط ندّ لند مباشرة) =====
  sendCall(payload) {
    return this.sendOrQueue({ type: 'call', ...payload })
  }

  // ===== الطلبات (بث عبر الخادم كي تصل لكل أجهزة الصيدلية — دون تخزين) =====
  announceOrder(order) {
    const ok = this.sendOrQueue({ type: 'order', action: 'new', order })
    directLink.announceOrder(order) // احتياط محلي دائماً
    return ok
  }

  announceOrderUpdate(orderId, status, extra = {}) {
    const ok = this.sendOrQueue({
      type: 'order', action: 'update',
      room: `order:${orderId}`,
      order: { id: orderId, status, ...extra },
    })
    directLink.announceOrderUpdate(orderId, status, extra)
    return ok
  }
}

export const realtime = new RealtimeClient()
export default realtime
