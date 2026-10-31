import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../contexts/AppContext'
import { realtime } from '../lib/realtime'
import { directLink } from '../lib/directLink'
import sounds from '../lib/sounds'
import { callActions } from './calls/CallManager'
import {
  Send, ShieldCheck, MessageCircle, Phone, Video, MapPin, Wifi, Radio
} from 'lucide-react'

// =====================================================================
// الدردشة المباشرة — PHMP (نسخة محدّثة بمزامنة عبر الأجهزة)
// ---------------------------------------------------------------------
// 1. زبون ↔ كاشير/صيدلاني (غرفة الطلب — أول موظف متصل يرد)
// 2. موظف ↔ موظف (مباشرة بين المستخدمَين — لوحة الزملاء)
// القناة: WebSocket (خادم المنصة عبر النفق) لكل الأجهزة، مع احتياط
// BroadcastChannel (نفس المتصفح). الرسائل تُستهلك فوراً ولا تُخزَّن
// في أي خادم. مكالمات صوتية/مرئية مباشرة (WebRTC ندّ لند) + نغمة
// تنبيه للرسائل الواردة + مشاركة الموقع الجغرافي.
// =====================================================================

const DirectChat = ({
  orderId,                 // غرفة الطلب (زبون ↔ موظفي الصيدلية)
  who,                     // اسم الطرف الحالي (يُعرض للطرف الآخر)
  role,                    // customer | cashier | pharmacist | admin | …
  counterpartLabel,        // تسمية الطرف الآخر للعرض
  compact = false,
  peer,                    // { kind:'user', id, name, avatar? } — دردشة موظف↔موظف
  pharmacyId,              // صيدلية الطلب (لتوجيه مكالمة الزبون لموظفيها)
  enableCalls = true,      // أزرار المكالمات
}) => {
  const { t, language } = useApp()
  const [messages, setMessages] = useState([]) // في الذاكرة فقط (ephemeral)
  const [text, setText] = useState('')
  const [peerOnline, setPeerOnline] = useState(false)
  const [connMode, setConnMode] = useState('offline') // server | local | offline
  const [locating, setLocating] = useState(false)
  const listRef = useRef(null)
  const roomName = orderId ? `order:${orderId}` : (peer ? `dm:${peer.id}` : null)
  const callTarget = peer
    ? `user:${peer.id}`
    : (role === 'customer' || role === 'guest')
      ? (pharmacyId ? `pharmacy:${pharmacyId}` : (orderId ? `room:${roomName}` : null))
      : (orderId ? `room:${roomName}` : null)

  // ===== استقبال الرسائل (خادم فوري + احتياط محلي) + النغمة =====
  useEffect(() => {
    if (!roomName) return
    realtime.joinRoom(roomName)
    const off = realtime.onMessage((msg) => {
      if (!msg) return
      if (msg.type === 'chat') {
        // رسالة عبر الخادم: تخص الغرفة أو موجهة إليّ مباشرة
        const viaServer = msg.via === 'server'
        const mineRoom = msg.room === roomName
        const mineDirect = !msg.room && peer && msg.fromId === peer.id
        if (viaServer && !mineRoom && !mineDirect) return
        // احتياط BroadcastChannel: نفس منطق النسخة السابقة
        if (!viaServer) {
          if (msg.orderId && msg.orderId !== orderId) return
        }
        setMessages((prev) => [...prev, {
          from: msg.from, role: msg.role || msg.fromRole,
          text: msg.text, ts: msg.ts || Date.now(), mine: false,
        }])
        // نغمة تنبيه + اهتزاز للرسالة الواردة
        sounds.message()
      } else if (msg.type === 'presence') {
        if (pharmacyId && msg.pharmacyId === pharmacyId) {
          setPeerOnline((msg.staffOnline || []).length > 0)
        }
      } else if (msg.type === 'peer_left' && msg.room === roomName) {
        setPeerOnline(false)
      }
    })
    return off
  }, [roomName, orderId, peer, pharmacyId])

  // حالة الاتصال (خادم فوري ↔ محلي فقط)
  useEffect(() => {
    const off = realtime.onStatus((s) => setConnMode(s === 'online' ? 'server' : s === 'idle' ? 'offline' : 'local'))
    return off
  }, [])

  // إعلان الحضور محلياً (احتياط BroadcastChannel — نفس المتصفح)
  useEffect(() => {
    if (!orderId) return
    directLink.sendPresence('online', who)
    return () => directLink.sendPresence('offline', who)
  }, [orderId, who])

  // تمرير تلقائي لآخر رسالة
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  // ===== إرسال رسالة =====
  const send = (e) => {
    e?.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    realtime.sendChat({
      room: roomName || undefined,
      to: peer ? `user:${peer.id}` : undefined,
      text: trimmed,
      displayName: who, // اسم العرض (يُعتمد للضيوف — الموظفون باسم جلستهم)
    })
    setMessages((prev) => [...prev, { from: who, role, text: trimmed, ts: Date.now(), mine: true }])
    setText('')
  }

  // ===== مشاركة الموقع الجغرافي (رابط خريطة داخل الدردشة) =====
  const shareLocation = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const { latitude, longitude } = pos.coords
        const link = `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`
        const label = language === 'ar'
          ? `📍 موقعي الحالي: ${link}`
          : language === 'fr'
            ? `📍 Ma position actuelle : ${link}`
            : `📍 My current location: ${link}`
        realtime.sendChat({ room: roomName || undefined, to: peer ? `user:${peer.id}` : undefined, text: label, displayName: who })
        setMessages((prev) => [...prev, { from: who, role, text: label, ts: Date.now(), mine: true }])
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  const timeFmt = (ts) => {
    try { return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }
    catch { return '' }
  }

  const startCall = useCallback((media) => {
    if (!callTarget) return
    callActions.start({
      to: callTarget,
      peerName: peer?.name || counterpartLabel || t('liveChat'),
      peerAvatar: peer?.avatar,
      media,
      displayName: who, // اسم المتصل (يُعتمد للضيوف — الموظفون باسم جلستهم)
    })
  }, [callTarget, peer, counterpartLabel, t, who])

  return (
    <div className={`flex flex-col ${compact ? 'h-72' : 'h-80'} rounded-xl border border-gray-200 overflow-hidden bg-white`}>
      {/* رأس الدردشة + أزرار المكالمة */}
      <div className="px-3 py-2 bg-primary-600 text-white flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-semibold truncate">{peer?.name || t('liveChat')}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* حالة القناة: خادم فوري (عبر الأجهزة) / محلي فقط */}
          <span className="hidden sm:flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-white/15" title={connMode === 'server' ? t('chatViaServer') : t('chatLocalOnly')}>
            {connMode === 'server' ? <Wifi className="w-3 h-3" /> : <Radio className="w-3 h-3" />}
            {connMode === 'server' ? (t('chatLiveSync') || '') : (t('chatLocalOnly') || '')}
          </span>
          {/* مكالمة صوتية */}
          {enableCalls && callTarget && (
            <button onClick={() => startCall('audio')} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors" title={t('callAudio')} aria-label={t('callAudio')}>
              <Phone className="w-4 h-4" />
            </button>
          )}
          {/* مكالمة مرئية */}
          {enableCalls && callTarget && (
            <button onClick={() => startCall('video')} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors" title={t('callVideo')} aria-label={t('callVideo')}>
              <Video className="w-4 h-4" />
            </button>
          )}
          <span className={`w-2 h-2 rounded-full ${peerOnline ? 'bg-emerald-300 animate-pulse' : 'bg-gray-300'}`} title={peerOnline ? t('staffOnline') : ''} />
        </div>
      </div>

      {/* الرسائل — تُستهلك مباشرة ولا تُسجَّل في خادم المنصة */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
        {messages.length === 0 && (
          <p className="text-center text-xs text-gray-400 mt-6 px-4">{t('typeMessage')}</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${m.mine ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'}`}>
              {!m.mine && <p className="text-[10px] font-bold text-primary-700 mb-0.5">{m.from}</p>}
              <p className="leading-snug break-words" dir="auto">{m.text}</p>
              <p className={`text-[10px] mt-1 ${m.mine ? 'text-primary-100' : 'text-gray-400'}`}>{timeFmt(m.ts)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ملاحظة الخصوصية: اتصال مباشر بدون تسجيل في الخادم */}
      <div className="px-3 py-1.5 bg-emerald-50 border-t border-emerald-100 flex items-center gap-1.5">
        <ShieldCheck className="w-3 h-3 text-emerald-600 flex-shrink-0" />
        <p className="text-[10px] text-emerald-700 leading-tight">{t('chatPrivateNote')}</p>
      </div>

      {/* إدخال الرسالة + مشاركة الموقع */}
      <form onSubmit={send} className="p-2 border-t border-gray-200 flex items-center gap-1.5 bg-white">
        <button
          type="button"
          onClick={shareLocation}
          disabled={locating}
          className="p-2 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-50 flex-shrink-0"
          title={t('shareLocation')}
          aria-label={t('shareLocation')}
        >
          <MapPin className={`w-4 h-4 ${locating ? 'animate-pulse text-primary-600' : ''}`} />
        </button>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('typeMessage')}
          className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button type="submit" className="btn-primary px-3 py-2 flex-shrink-0" aria-label={t('sendMessage')}>
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}

export default DirectChat
