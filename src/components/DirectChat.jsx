import { useState, useEffect, useRef } from 'react'
import { useApp } from '../contexts/AppContext'
import { directLink } from '../lib/directLink'
import { Send, ShieldCheck, MessageCircle } from 'lucide-react'

// =====================================================================
// الدردشة المباشرة بين الزبون والموظف (الكاشير أو الصيدلاني حسب المتوفر)
// ---------------------------------------------------------------------
// اتصال مباشر عبر المنصة (BroadcastChannel): الرسائل تُستهلك فورياً في
// الجلسة، لا تُخزَّن في أي خادم ولا في قاعدة بيانات — بمجرد إغلاق
// الصفحة تختفي. هذا هو "الاتصال المباشر الذي يستهلك مباشرة".
// =====================================================================

const DirectChat = ({ orderId, who, role, counterpartLabel, compact = false }) => {
  const { t } = useApp()
  const [messages, setMessages] = useState([]) // في الذاكرة فقط (ephemeral)
  const [text, setText] = useState('')
  const [peerOnline, setPeerOnline] = useState(false)
  const listRef = useRef(null)

  // استقبال الرسائل المباشرة + إشعارات الحضور
  useEffect(() => {
    if (!orderId) return
    const off = directLink.onMessage((msg) => {
      if (msg.orderId && msg.orderId !== orderId) return
      if (msg.type === 'chat') {
        setMessages((prev) => [...prev, { from: msg.from, role: msg.role, text: msg.text, ts: msg.ts, mine: false }])
      } else if (msg.type === 'presence') {
        setPeerOnline(msg.presence === 'online')
      }
    })
    // إعلان الحضور عند الدخول
    directLink.sendPresence('online', who)
    const leave = () => directLink.sendPresence('offline', who)
    window.addEventListener('beforeunload', leave)
    return () => { off(); leave(); window.removeEventListener('beforeunload', leave) }
  }, [orderId, who])

  // تمرير تلقائي لآخر رسالة
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  const send = (e) => {
    e?.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    directLink.sendChat(orderId, who, role, trimmed)
    setMessages((prev) => [...prev, { from: who, role, text: trimmed, ts: Date.now(), mine: true }])
    setText('')
  }

  const timeFmt = (ts) => {
    try { return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }
    catch { return '' }
  }

  return (
    <div className={`flex flex-col ${compact ? 'h-72' : 'h-80'} rounded-xl border border-gray-200 overflow-hidden bg-white`}>
      {/* رأس الدردشة */}
      <div className="px-4 py-2.5 bg-primary-600 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          <span className="text-sm font-semibold">{t('liveChat')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className={`w-2 h-2 rounded-full ${peerOnline ? 'bg-emerald-300 animate-pulse' : 'bg-gray-300'}`} />
          <span>{peerOnline ? counterpartLabel + ' • ' + t('staffOnline') : counterpartLabel}</span>
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
              <p className="leading-snug break-words">{m.text}</p>
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

      {/* إدخال الرسالة */}
      <form onSubmit={send} className="p-2 border-t border-gray-200 flex items-center gap-2 bg-white">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('typeMessage')}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button type="submit" className="btn-primary px-3 py-2" aria-label={t('sendMessage')}>
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}

export default DirectChat
