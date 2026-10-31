import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../../contexts/AppContext'
import { realtime } from '../../lib/realtime'
import sounds from '../../lib/sounds'
import SmartAvatar from '../SmartAvatar'
import {
  Phone, PhoneOff, Video, VideoOff, Mic, MicOff, PhoneIncoming, PhoneOutgoing,
  AlertCircle, ShieldCheck
} from 'lucide-react'

// =====================================================================
// مدير المكالمات الصوتية والمرئية — PHMP
// ---------------------------------------------------------------------
// مكالمات مباشرة بين المستخدمين (WebRTC ندّ لند): الوسائط تُستهلك
// مباشرة بين الطرفين ولا تمر بأي خادم؛ خادم المنصة يرحّل «إشارة»
// الاتصال فقط (عرض/قبول/ICE/إنهاء) في الذاكرة دون أي تخزين.
//
// الاتصال الممكن:
//   زبون ↔ موظفي الصيدلية (كاشير/صيدلاني حسب المتوفر — أول من يرد يفوز)
//   كاشير ↔ الموظفين (زملاء نفس الصيدلية) + مالك المنصة مع الجميع
// =====================================================================

// ناقل داخلي: أي مكوّن (الدردشة/لوحة الزملاء) يطلق مكالمة عبر callActions.start
let triggerCall = null
export const callActions = {
  start(opts) { if (triggerCall) triggerCall(opts) },
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

const fmtDuration = (sec) => {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const CallManager = () => {
  const { t, language } = useApp()
  const [call, setCall] = useState(null) // حالة المكالمة الحالية
  const callRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [permissionError, setPermissionError] = useState('')

  const setCallState = useCallback((next) => {
    callRef.current = typeof next === 'function' ? next(callRef.current) : next
    setCall(callRef.current)
  }, [])

  // ===== تنظيف كامل للمكالمة =====
  const teardown = useCallback(() => {
    const c = callRef.current
    if (c) {
      try { c.pc?.close() } catch { /* تجاهل */ }
      c.localStream?.getTracks()?.forEach((track) => { try { track.stop() } catch { /* تجاهل */ } })
      clearInterval(c.timer)
    }
    sounds.ringStop()
    setCallState(null)
    setDuration(0)
    setMuted(false)
    setCamOff(false)
    setPermissionError('')
  }, [setCallState])

  // ===== إنشاء اتصال ندّ لند =====
  const createPeer = useCallback((callId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        realtime.sendCall({ action: 'ice', callId, candidate: event.candidate, to: callRef.current?.replyTo })
      }
    }
    pc.ontrack = (event) => {
      const stream = event.streams[0]
      setCallState((prev) => prev ? { ...prev, remoteStream: stream } : prev)
    }
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      if (state === 'connected') {
        setCallState((prev) => {
          if (!prev || prev.phase === 'active') return prev
          sounds.ringStop()
          const timer = setInterval(() => setDuration((d) => d + 1), 1000)
          return { ...prev, phase: 'active', timer, startedAt: Date.now() }
        })
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        const cur = callRef.current
        if (cur && cur.phase !== 'ended') {
          try { realtime.sendCall({ action: 'end', callId, to: cur.replyTo }) } catch { /* تجاهل */ }
          teardown()
        }
      }
    }
    return pc
  }, [setCallState, teardown])

  // ===== بدء مكالمة صادرة =====
  const startOutgoing = useCallback(async ({ to, peerName, media = 'audio', peerAvatar, displayName }) => {
    if (callRef.current) return // مكالمة جارية بالفعل
    setPermissionError('')
    // الحصول على المايكروفون/الكاميرا (يطلب إذن المتصفح/التطبيق)
    let localStream
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: media === 'video' ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      })
    } catch {
      setCallState({ phase: 'error', peerName, peerAvatar, media, error: 'permission', localStream: null, pc: null, timer: null, replyTo: null, callId: `err-${Date.now()}` })
      setTimeout(() => { if (callRef.current?.phase === 'error') teardown() }, 3500)
      return
    }
    const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const pc = createPeer(callId)
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream))

    setCallState({
      phase: 'outgoing', callId, to, replyTo: to,
      peerName, peerAvatar, media, pc, localStream, timer: null,
    })
    sounds.outgoing()
    sounds.vibrate([60])

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      realtime.sendCall({ action: 'offer', callId, to, media, sdp: offer, displayName })
    } catch {
      teardown()
    }
  }, [createPeer, setCallState, teardown])

  useEffect(() => { triggerCall = startOutgoing }, [startOutgoing])

  // ===== استقبال إشارات المكالمات =====
  useEffect(() => {
    const off = realtime.onMessage(async (msg) => {
      if (!msg || msg.type !== 'call') return
      const cur = callRef.current

      // ---- عرض مكالمة واردة ----
      if (msg.action === 'offer') {
        if (cur) {
          // مشغول بمكالمة أخرى — ارفض تلقائياً
          realtime.sendCall({ action: 'reject', callId: msg.callId, to: msg.fromConn, reason: 'busy' })
          return
        }
        setCallState({
          phase: 'incoming', callId: msg.callId, replyTo: msg.fromConn,
          peerName: msg.from, peerRole: msg.fromRole, media: msg.media,
          offerSdp: msg.sdp, pc: null, localStream: null, timer: null,
        })
        sounds.ringStart()
      }

      // ---- رد بالقبول (عند المتصل) ----
      else if (msg.action === 'answer' && cur?.callId === msg.callId && cur.phase === 'outgoing') {
        try {
          await cur.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
          setCallState((prev) => prev ? { ...prev, phase: 'connecting' } : prev)
        } catch { /* تجاهل */ }
      }

      // ---- مرشحو ICE ----
      else if (msg.action === 'ice' && cur?.callId === msg.callId && cur.pc) {
        try { await cur.pc.addIceCandidate(new RTCIceCandidate(msg.candidate)) } catch { /* تجاهل */ }
      }

      // ---- رفض ----
      else if (msg.action === 'reject' && cur?.callId === msg.callId) {
        sounds.callEnd()
        setCallState((prev) => prev ? { ...prev, phase: 'ended', endReason: msg.reason || 'rejected' } : prev)
        setTimeout(() => { if (callRef.current?.phase === 'ended') teardown() }, 1400)
      }

      // ---- زميل آخر ردّ على مكالمة الزبون (أوقف الرنين) ----
      else if (msg.action === 'taken' && cur?.callId === msg.callId && cur.phase === 'incoming') {
        teardown()
      }

      // ---- إنهاء ----
      else if (msg.action === 'end' && cur?.callId === msg.callId) {
        sounds.callEnd()
        setCallState((prev) => prev ? { ...prev, phase: 'ended' } : prev)
        setTimeout(() => { if (callRef.current?.phase === 'ended') teardown() }, 1000)
      }

      // ---- إلغاء من المتصل قبل الرد ----
      else if (msg.action === 'cancel' && cur?.callId === msg.callId && cur.phase === 'incoming') {
        teardown()
      }
    })
    return off
  }, [setCallState, teardown])

  // ===== ربط تدفقات الفيديو بالعناصر =====
  useEffect(() => {
    if (localVideoRef.current && call?.localStream) {
      localVideoRef.current.srcObject = call.localStream
    }
    if (remoteVideoRef.current && call?.remoteStream) {
      remoteVideoRef.current.srcObject = call.remoteStream
    }
  }, [call?.localStream, call?.remoteStream, call?.phase])

  // ===== إغلاق نظيف عند تفكيك المكوّن =====
  useEffect(() => () => { teardown(); triggerCall = null }, [teardown])

  if (!call) return null

  // ===== أزرار التحكم =====
  const hangup = () => {
    const c = callRef.current
    if (c?.phase === 'incoming') {
      realtime.sendCall({ action: 'reject', callId: c.callId, to: c.replyTo })
    } else if (c && c.phase !== 'ended') {
      realtime.sendCall({ action: 'end', callId: c.callId, to: c.replyTo })
    }
    sounds.callEnd()
    teardown()
  }

  const acceptIncoming = async () => {
    const c = callRef.current
    if (!c || c.phase !== 'incoming') return
    sounds.ringStop()
    setPermissionError('')
    let localStream
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: c.media === 'video' ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      })
    } catch {
      realtime.sendCall({ action: 'reject', callId: c.callId, to: c.replyTo, reason: 'permission' })
      teardown()
      return
    }
    const pc = createPeer(c.callId)
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream))
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(c.offerSdp))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      realtime.sendCall({ action: 'answer', callId: c.callId, to: c.replyTo, sdp: answer })
      setCallState({ ...c, phase: 'connecting', pc, localStream, offerSdp: null })
      sounds.vibrate([80])
    } catch {
      realtime.sendCall({ action: 'reject', callId: c.callId, to: c.replyTo, reason: 'error' })
      teardown()
    }
  }

  const toggleMute = () => {
    const c = callRef.current
    if (!c?.localStream) return
    const next = !muted
    c.localStream.getAudioTracks().forEach((track) => { track.enabled = !next })
    setMuted(next)
  }

  const toggleCam = () => {
    const c = callRef.current
    if (!c?.localStream || c.media !== 'video') return
    const next = !camOff
    c.localStream.getVideoTracks().forEach((track) => { track.enabled = !next })
    setCamOff(next)
  }

  const statusText = () => {
    if (call.phase === 'incoming') return t('callIncoming')
    if (call.phase === 'outgoing') return t('callRinging')
    if (call.phase === 'connecting') return t('callConnecting')
    if (call.phase === 'active') return fmtDuration(duration)
    if (call.phase === 'ended') return call.endReason === 'busy' ? t('callBusy') : t('callEnded')
    if (call.phase === 'error') return t('callFailed')
    return ''
  }

  const isVideoCall = call.media === 'video'
  const showVideoStage = isVideoCall && ['active', 'connecting'].includes(call.phase)

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-gray-950/95 backdrop-blur-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="relative w-full h-full max-w-2xl mx-auto flex flex-col">
        {/* فيديو الطرف البعيد (مكالمة مرئية نشطة) */}
        {showVideoStage && (
          <>
            <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover bg-black" />
            {/* الفيديو المحلي — نافذة عائمة */}
            <video ref={localVideoRef} autoPlay playsInline muted className={`absolute top-4 w-28 h-40 sm:w-36 sm:h-48 object-cover rounded-2xl border-2 border-white/40 shadow-2xl z-10 ${camOff ? 'opacity-30' : ''} ${language === 'ar' ? 'left-4' : 'right-4'}`} />
          </>
        )}

        <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-6 text-center">
          {/* شارة الاتصال المباشر (خصوصية) */}
          <div className="absolute top-4 flex items-center gap-1.5 text-[11px] text-emerald-300/90 bg-emerald-500/10 border border-emerald-400/20 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            {t('callPrivateNote')}
          </div>

          {!showVideoStage && (
            <div className="relative mb-6">
              <div className={`w-32 h-32 sm:w-36 sm:h-36 rounded-full overflow-hidden border-4 ${call.phase === 'incoming' ? 'border-emerald-400 animate-pulse' : 'border-white/20'} shadow-2xl bg-gray-800`}>
                <SmartAvatar value={call.peerAvatar} alt={call.peerName} size={128} rounded="rounded-full" textClass="text-6xl" className="w-full h-full" />
              </div>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex w-9 h-9 rounded-full items-center justify-center bg-primary-600 text-white shadow-lg">
                {call.phase === 'incoming' ? <PhoneIncoming className="w-4 h-4" /> : <PhoneOutgoing className="w-4 h-4" />}
              </span>
            </div>
          )}

          <h2 className={`text-2xl sm:text-3xl font-bold text-white drop-shadow-lg ${showVideoStage ? 'absolute top-16 inset-x-0 px-6 truncate' : ''}`}>
            {call.peerName}
          </h2>
          <p className={`mt-2 text-sm font-medium ${call.phase === 'active' ? 'text-emerald-300' : 'text-gray-300'} ${showVideoStage ? 'absolute top-24 inset-x-0 px-6' : ''}`}>
            {isVideoCall ? `📹 ${t('callVideo')} · ` : `🔊 ${t('callAudio')} · `}
            {statusText()}
          </p>

          {call.phase === 'error' && (
            <div className="mt-24 bg-red-500/15 border border-red-400/30 text-red-200 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 max-w-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {t('callMicBlocked')}
            </div>
          )}

          {call.phase === 'ended' && (
            <div className="mt-4 bg-gray-800/80 text-gray-200 text-xs px-4 py-2 rounded-full">
              {call.endReason === 'busy' ? t('callBusy') : t('callEnded')}
            </div>
          )}
        </div>

        {/* أزرار التحكم */}
        <div className="relative z-20 pb-10 sm:pb-14 flex items-center justify-center gap-4">
          {call.phase === 'incoming' ? (
            <>
              <button onClick={hangup} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-xl shadow-red-900/40 flex items-center justify-center transition-transform hover:scale-105 active:scale-95" aria-label={t('callReject')}>
                <PhoneOff className="w-7 h-7" />
              </button>
              <button onClick={acceptIncoming} className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-900/40 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 animate-pulse" aria-label={t('callAccept')}>
                {isVideoCall ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
              </button>
            </>
          ) : (
            <>
              {['active', 'connecting'].includes(call.phase) && (
                <>
                  <button onClick={toggleMute} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${muted ? 'bg-white text-gray-900' : 'bg-white/15 text-white hover:bg-white/25'}`} aria-label={t('callMute')} title={t('callMute')}>
                    {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  {isVideoCall && (
                    <button onClick={toggleCam} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${camOff ? 'bg-white text-gray-900' : 'bg-white/15 text-white hover:bg-white/25'}`} aria-label={t('callCamera')} title={t('callCamera')}>
                      {camOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    </button>
                  )}
                </>
              )}
              <button onClick={hangup} disabled={call.phase === 'ended'} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white shadow-xl shadow-red-900/40 flex items-center justify-center transition-transform hover:scale-105 active:scale-95" aria-label={t('callEnd')}>
                <PhoneOff className="w-7 h-7" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default CallManager
