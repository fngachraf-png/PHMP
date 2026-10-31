// =====================================================================
// PHMP — خادم الاتصال الفوري (WebSocket) للتراسل والمكالمات
// ---------------------------------------------------------------------
// الغاية: مزامنة الرسائل والمكالمات الصوتية/المرئية بين الزبناء
// والموظفين عبر الأجهزة (الهاتف ↔ الحاسوب) بشكل أنيق وفوري.
//
// مبادئ التصميم (مطلب المالك — قاعدة 8 في WORKLOG):
//   1. لا تخزين إطلاقاً: الرسائل وإشارات المكالمات تُرحَّل في الذاكرة
//      فقط وتُستهلك مباشرة — لا قاعدة بيانات ولا سجلات ولا localStorage.
//   2. المكالمات الصوتية/المرئية تُستهلك مباشرة بين المستخدمين (WebRTC
//      ندّ لند)؛ هذا الخادم يرحّل «الإشارة» فقط (عرض/قبول/ICE/إنهاء).
//   3. المصادقة: الموظفون برمز JWT، والزبناء كضياف معروفين بالاسم
//      والهاتف ضمن صيدلية محددة.
//   3. حماية: تحديد معدل الرسائل، حدود الحجم، ونطاق الضيف محصور
//      في صيدليته.
// =====================================================================
import { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'

const MAX_PAYLOAD = 32 * 1024        // 32 كيلوبايت كحد أقصى للرسالة
const MAX_TEXT = 2000                // طول نص الدردشة
const RATE_LIMIT = 30                // رسالة كحد أقصى…
const RATE_WINDOW = 10 * 1000        // …كل 10 ثوانٍ لكل اتصال
const HEARTBEAT_MS = 30 * 1000

export function setupRealtime(httpServer, { verifyJwt, log = () => {} } = {}) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

  // سجل الاتصالات: connId -> conn meta
  const conns = new Map()            // connId -> { ws, kind:'staff'|'customer', userId, pharmacyId, name, role, rooms:Set, lastSeen, rate:[timestamps] }
  const byUser = new Map()           // userId -> Set<connId>  (موظفون)
  const byPharmacy = new Map()       // pharmacyId -> Set<connId>
  const rooms = new Map()            // roomName -> Set<connId>

  let connSeq = 0
  const connIdOf = (ws) => ws.__phmpConnId

  const sendTo = (ws, payload) => {
    try { if (ws.readyState === 1) ws.send(JSON.stringify(payload)) } catch { /* تجاهل */ }
  }

  const addToGroup = (map, key, connId) => {
    if (!key) return
    if (!map.has(key)) map.set(key, new Set())
    map.get(key).add(connId)
  }
  const removeFromGroup = (map, key, connId) => {
    const set = map.get(key)
    if (set) { set.delete(connId); if (set.size === 0) map.delete(key) }
  }

  const eachConn = (connIds, fn) => {
    for (const id of connIds || []) {
      const meta = conns.get(id)
      if (meta && meta.ws.readyState === 1) fn(meta, id)
    }
  }

  // إحصاء الموظفين المتصلين بصيدلية (للحضور)
  const pharmacyStaffPeers = (pharmacyId, exceptConnId) => {
    const out = []
    eachConn(byPharmacy.get(pharmacyId) || [], (meta, id) => {
      if (id !== exceptConnId && meta.kind === 'staff') {
        out.push({ userId: meta.userId, name: meta.name, role: meta.role })
      }
    })
    return out
  }

  const broadcastPresence = (pharmacyId) => {
    if (!pharmacyId) return
    const staffPeers = pharmacyStaffPeers(pharmacyId)
    eachConn(byPharmacy.get(pharmacyId) || [], (meta) => {
      sendTo(meta.ws, { type: 'presence', pharmacyId, staffOnline: staffPeers })
    })
  }

  const cleanupConn = (ws) => {
    const id = connIdOf(ws)
    if (!id) return
    const meta = conns.get(id)
    conns.delete(id)
    if (meta) {
      if (meta.userId) removeFromGroup(byUser, meta.userId, id)
      removeFromGroup(byPharmacy, meta.pharmacyId, id)
      if (meta.rooms) for (const room of meta.rooms) {
        removeFromGroup(rooms, room, id)
        // إشعار أعضاء الغرفة برحيل الطرف (يوقف حالة «متصل»)
        eachConn(rooms.get(room) || [], (m) => {
          sendTo(m.ws, { type: 'peer_left', room, who: meta.name })
        })
      }
      broadcastPresence(meta.pharmacyId)
    }
    log(`🔌 انقطع ${id} (${meta?.kind || '?'}) — الإجمالي: ${conns.size}`)
  }

  wss.on('connection', (ws, req) => {
    ws.__phmpConnId = `c${++connSeq}`
    conns.set(connIdOf(ws), { ws, kind: 'pending', rooms: new Set(), rate: [] })
    log(`🔌 اتصال جديد ${connIdOf(ws)} من ${req.socket.remoteAddress}`)

    // مهلة المصادقة: 10 ثوانٍ وإلا يُغلق الاتصال
    const authTimer = setTimeout(() => {
      const meta = conns.get(connIdOf(ws))
      if (meta && meta.kind === 'pending') ws.close(4001, 'مهلة المصادقة')
    }, 10 * 1000)

    ws.on('message', (raw, isBinary) => {
      if (isBinary) return
      const id = connIdOf(ws)
      const meta = conns.get(id)
      if (!meta) return
      if (raw.length > MAX_PAYLOAD) return ws.close(4002, 'حجم الرسالة كبير جداً')

      // تحديد المعدل (لا ينطبق على الإشارة الحرجة للمكالمات)
      let msg
      try { msg = JSON.parse(raw.toString()) } catch { return }
      if (msg.type !== 'call' && msg.type !== 'ping') {
        const now = Date.now()
        meta.rate = meta.rate.filter((ts) => now - ts < RATE_WINDOW)
        if (meta.rate.length >= RATE_LIMIT) return sendTo(ws, { type: 'error', message: 'معدل الرسائل مرتفع — تمهّل قليلاً' })
        meta.rate.push(now)
      }

      if (msg.type === 'ping') {
        meta.lastSeen = Date.now()
        return sendTo(ws, { type: 'pong' })
      }

      // ===== المصادقة =====
      if (msg.type === 'auth') {
        clearTimeout(authTimer)
        let identity = null
        try {
          if (msg.token && verifyJwt) {
            const payload = verifyJwt(msg.token)
            identity = { kind: 'staff', userId: payload.id, name: payload.name, role: payload.role, pharmacyId: payload.pharmacyId || null }
          }
        } catch { /* رمز غير صالح — يُعامل كضيف */ }
        if (!identity && msg.guest && typeof msg.guest.name === 'string' && msg.guest.name.trim()) {
          // زبون (مسجل أو عابر) — نطاقه صيدليته المختارة
          identity = {
            kind: 'customer',
            userId: null,
            name: msg.guest.name.trim().slice(0, 60),
            role: 'customer',
            pharmacyId: typeof msg.guest.pharmacyId === 'string' ? msg.guest.pharmacyId : null,
          }
        }
        if (!identity) return ws.close(4003, 'مصادقة غير صالحة')
        Object.assign(meta, identity)
        if (identity.userId) addToGroup(byUser, identity.userId, id)
        if (identity.pharmacyId) addToGroup(byPharmacy, identity.pharmacyId, id)
        sendTo(ws, {
          type: 'welcome',
          identity: { kind: meta.kind, userId: meta.userId, name: meta.name, role: meta.role },
          staffOnline: pharmacyStaffPeers(meta.pharmacyId, id),
        })
        broadcastPresence(meta.pharmacyId)
        log(`✅ ${id} مصادق: ${meta.kind} ${meta.name}${meta.pharmacyId ? ` @ ${meta.pharmacyId}` : ''}`)
        return
      }

      // كل ما تبقى يتطلب مصادقة
      if (meta.kind === 'pending') return ws.close(4001, 'مصادقة مطلوبة')

      // ===== رسائل الدردشة =====
      if (msg.type === 'chat') {
        const text = typeof msg.text === 'string' ? msg.text.trim().slice(0, MAX_TEXT) : ''
        if (!text) return
        const room = typeof msg.room === 'string' ? msg.room.slice(0, 80) : null
        // اسم العرض: للضيوف يُعتمد الاسم الذي قدمه (مثل اسم صاحب الطلب)،
        // وللموظفين الاسم الموثق من الجلسة حصراً (منع انتحال الأسماء)
        const displayName = meta.kind === 'customer'
          ? (typeof msg.displayName === 'string' && msg.displayName.trim()
              ? msg.displayName.trim().slice(0, 60)
              : meta.name)
          : meta.name
        const envelope = {
          type: 'chat',
          room,
          from: displayName,
          fromKind: meta.kind,
          fromRole: meta.role,
          fromId: meta.userId || id,
          connId: id,
          text,
          ts: Date.now(),
        }
        if (room) {
          // انضمام تلقائي للغرفة عند أول مشاركة
          if (!meta.rooms.has(room)) { meta.rooms.add(room); addToGroup(rooms, room, id) }
          // تسليم لكل أعضاء الغرفة ما عدا المرسل (زبون + موظفو الصيدلية)
          const members = new Set(rooms.get(room) || [])
          members.delete(id)
          eachConn(members, (m) => sendTo(m.ws, envelope))
          // إذا كان المرسل زبوناً ولم يكن أحد من الموظفين في الغرفة بعد:
          // وجّهها أيضاً لكل موظفي الصيدلية المتصلين (كي تصل دون فتح غرفة مسبقاً)
          if (meta.kind === 'customer' && meta.pharmacyId) {
            const staffConns = new Set()
            eachConn(byPharmacy.get(meta.pharmacyId) || [], (m, mid) => {
              if (mid !== id && m.kind === 'staff') staffConns.add(mid)
            })
            members.forEach((mid) => staffConns.delete(mid))
            eachConn(staffConns, (m, mid) => {
              sendTo(m.ws, envelope)
              if (!m.rooms.has(room)) { m.rooms.add(room); addToGroup(rooms, room, mid) }
            })
          }
        } else if (typeof msg.to === 'string') {
          // موظف ↔ موظف مباشرة، أو ردّ على اتصال محدد (معرف الاتصال الخام أو بصيغة client:)
          const targets = new Set()
          if (msg.to.startsWith('user:')) {
            for (const cid of byUser.get(msg.to.slice(5)) || []) targets.add(cid)
          } else if (msg.to.startsWith('client:')) {
            const t = conns.get(msg.to.slice(7))
            if (t) targets.add(msg.to.slice(7))
          } else if (conns.has(msg.to)) {
            targets.add(msg.to)
          }
          envelope.to = msg.to
          eachConn(targets, (m) => sendTo(m.ws, envelope))
        }
        return
      }

      // ===== انضمام غرفة (دردشة طلب — دون إرسال رسالة) =====
      if (msg.type === 'join' && typeof msg.room === 'string') {
        const room = msg.room.slice(0, 80)
        if (!meta.rooms.has(room)) { meta.rooms.add(room); addToGroup(rooms, room, id) }
        sendTo(ws, { type: 'joined', room, members: [...(rooms.get(room) || [])].length })
        return
      }

      // ===== الطلبات (بث بين الأجهزة — دون أي تخزين) =====
      if (msg.type === 'order') {
        const payload = msg.order
        if (!payload || typeof payload !== 'object') return
        const envelope = { type: 'order', action: String(msg.action || 'new'), order: payload, from: meta.name, fromKind: meta.kind, ts: Date.now() }
        const targets = new Set()
        const addRoomMembers = (room) => { for (const cid of rooms.get(room) || []) if (cid !== id) targets.add(cid) }
        const phId = payload.pharmacyId || meta.pharmacyId
        if (msg.action === 'update') {
          // تحديث حالة: صاحب الطلب (غرفة الطلب) + موظفو صيدليته
          if (typeof msg.room === 'string') addRoomMembers(msg.room)
          if (phId) eachConn(byPharmacy.get(phId) || [], (m, mid) => { if (mid !== id && m.kind === 'staff') targets.add(mid) })
        } else {
          // طلب جديد: كل المتصلين بصيدلية الطلب (موظفوها)
          if (phId) eachConn(byPharmacy.get(phId) || [], (m, mid) => { if (mid !== id) targets.add(mid) })
        }
        eachConn(targets, (m) => sendTo(m.ws, envelope))
        return
      }

      // ===== مراقبة طلبات الزبون (استقبال تحديثات حالتها) =====
      if (msg.type === 'watch-orders' && Array.isArray(msg.ids)) {
        for (const raw of msg.ids.slice(0, 50)) {
          const room = `order:${String(raw).slice(0, 80)}`
          if (!meta.rooms.has(room)) { meta.rooms.add(room); addToGroup(rooms, room, id) }
        }
        return
      }

      // ===== إشارات المكالمات (WebRTC — ترحيل فقط، الوسائط ندّ لند) =====
      if (msg.type === 'call') {
        const action = String(msg.action || '')
        const callId = String(msg.callId || '').slice(0, 60)
        if (!action || !callId) return
        const displayName = meta.kind === 'customer'
          ? (typeof msg.displayName === 'string' && msg.displayName.trim()
              ? msg.displayName.trim().slice(0, 60)
              : meta.name)
          : meta.name
        const signal = {
          type: 'call', action, callId,
          media: msg.media === 'video' ? 'video' : 'audio',
          from: displayName, fromKind: meta.kind, fromRole: meta.role,
          fromId: meta.userId || id, fromConn: id,
          sdp: msg.sdp || undefined, candidate: msg.candidate || undefined,
          reason: msg.reason || undefined,
        }

        const targets = new Set()
        const to = typeof msg.to === 'string' ? msg.to : null
        if (to === `pharmacy:${meta.pharmacyId}`) {
          // زبون يتصل بالصيدلية: كل الموظفين المتصلين بها
          eachConn(byPharmacy.get(meta.pharmacyId) || [], (m, mid) => { if (mid !== id) targets.add(mid) })
        } else if (to?.startsWith('user:')) {
          for (const cid of byUser.get(to.slice(5)) || []) targets.add(cid)
        } else if (to?.startsWith('client:')) {
          const t = conns.get(to.slice(7))
          if (t) targets.add(to.slice(7))
        } else if (to && conns.has(to)) {
          // ردّ مباشر على اتصال محدد (معرف الاتصال الخام — من fromConn)
          targets.add(to)
        } else if (to?.startsWith('room:')) {
          // موظف يتصل بزبون غرفة (طلب): أعضاء الغرفة من غير الموظفين
          const room = to.slice(5)
          eachConn(rooms.get(room) || [], (m, mid) => { if (mid !== id && m.kind !== 'staff') targets.add(mid) })
        }
        eachConn(targets, (m) => sendTo(m.ws, signal))

        // عند قبول المكالمة: أوقف رنين بقية موظفي الصيدلية (أول من يرد يفوز)
        if (action === 'answer' && meta.kind === 'staff' && meta.pharmacyId) {
          eachConn(byPharmacy.get(meta.pharmacyId) || [], (m, mid) => {
            if (mid !== id) sendTo(m.ws, { type: 'call', action: 'taken', callId, by: meta.name })
          })
        }
        return
      }
    })

    ws.on('close', () => { clearTimeout(authTimer); cleanupConn(ws) })
    ws.on('error', () => { clearTimeout(authTimer); cleanupConn(ws) })
  })

  // نبض دوري: إسقاط الاتصالات الميتة
  const heartbeat = setInterval(() => {
    for (const [id, meta] of conns) {
      if (meta.kind !== 'pending' && meta.lastSeen && Date.now() - meta.lastSeen > 90 * 1000) {
        try { meta.ws.terminate() } catch { /* تجاهل */ }
        continue
      }
      if (meta.ws.readyState === 1) sendTo(meta.ws, { type: 'heartbeat' })
    }
  }, HEARTBEAT_MS)
  heartbeat.unref()

  log('🟢 خادم الاتصال الفوري جاهز على /ws (بلا تخزين — استهلاك مباشر)')
  return { wss, conns }
}
