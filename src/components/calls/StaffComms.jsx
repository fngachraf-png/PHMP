import { useState, useEffect, useMemo, useRef } from 'react'
import { useApp } from '../../contexts/AppContext'
import { realtime } from '../../lib/realtime'
import sounds from '../../lib/sounds'
import { callActions } from '../calls/CallManager'
import DirectChat from '../DirectChat'
import SmartAvatar from '../SmartAvatar'
import { ROLE_INFO } from '../../config/permissions'
import {
  Users, Phone, Video, MessageCircle, X, Search, Wifi, WifiOff
} from 'lucide-react'

// =====================================================================
// لوحة التواصل الداخلي (للموظفين) — كاشير ↔ موظفون + مالك ↔ الجميع
// ---------------------------------------------------------------------
// دليل الزملاء المتصلين: دردشة مباشرة ومكالمة صوتية/مرئية مع أي زميل
// (WebRTC ندّ لند — تُستهلك مباشرة بين المستخدمين بلا أي خادم وسائط).
// الحضور: من خادم الاتصال الفوري (نفس الصيدلية).
// =====================================================================

const StaffComms = () => {
  const { t, language, isRTL, currentUser, usersData, pharmaciesData, pickName } = useApp()
  const [open, setOpen] = useState(false)
  const [activePeer, setActivePeer] = useState(null) // زميل الدردشة المفتوحة
  const [onlineIds, setOnlineIds] = useState(new Set())
  const [connOnline, setConnOnline] = useState(false)
  const [search, setSearch] = useState('')
  const btnRef = useRef(null)

  // حالة الاتصال الفوري + حضور الزملاء
  useEffect(() => {
    const offStatus = realtime.onStatus((s) => setConnOnline(s === 'online'))
    const off = realtime.onMessage((msg) => {
      if (msg?.type === 'presence' && msg.staffOnline) {
        setOnlineIds(new Set(msg.staffOnline.map(p => p.userId)))
      }
    })
    return () => { offStatus(); off() }
  }, [])

  // الزملاء: نفس الصيدلية (سوبر أدمين: الجميع)
  const colleagues = useMemo(() => {
    if (!currentUser) return []
    let list = usersData.filter(u => u.id !== currentUser.id && u.active !== false)
    if (currentUser.role !== 'super_admin') {
      list = list.filter(u => u.pharmacyId === currentUser.pharmacyId)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(u => (u.name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q))
    }
    return list
  }, [currentUser, usersData, search])

  // نغمة عند فتح اللوحة إن كانت هناك رسائل جديدة — تُدار عبر DirectChat نفسه
  if (!currentUser) return null

  const roleLabel = (role) => {
    const info = ROLE_INFO[role]
    if (!info) return role
    return language === 'ar' ? info.ar : language === 'fr' ? (info.fr || info.en) : info.en
  }

  const startCall = (peer, media) => {
    callActions.start({
      to: `user:${peer.id}`,
      peerName: peer.name,
      peerAvatar: peer.avatar,
      media,
    })
  }

  return (
    <>
      {/* زر لوحة التواصل — في ترويسة الموظفين */}
      <button
        ref={btnRef}
        onClick={() => { setOpen(!open); if (!open) sounds.vibrate(30) }}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label={t('staffComms')}
        title={t('staffComms')}
      >
        <Users className="w-5 h-5 text-gray-700" />
        {onlineIds.size > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setActivePeer(null) }} />
          <div
            className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-slide-up"
            style={{
              top: Math.max(72, 64),
              [isRTL ? 'left' : 'right']: 8,
              width: 'min(400px, calc(100vw - 16px))',
              height: 'min(560px, calc(100dvh - 90px))',
            }}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {!activePeer ? (
              <div className="flex flex-col h-full">
                {/* رأس اللوحة */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary-600" />
                    <h3 className="font-bold text-gray-900 text-sm">{t('staffComms')}</h3>
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {connOnline ? <Wifi className="w-3 h-3 text-emerald-600" /> : <WifiOff className="w-3 h-3 text-gray-400" />}
                      {connOnline ? t('commsLive') : t('commsLocal')}
                    </span>
                  </div>
                  <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
                </div>

                {/* بحث */}
                <div className="p-2.5 border-b border-gray-100">
                  <div className="relative">
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t('searchColleague')}
                      className="input py-2 ps-9 text-sm"
                    />
                    <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
                  </div>
                </div>

                {/* قائمة الزملاء */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {colleagues.length === 0 && (
                    <p className="text-center text-xs text-gray-400 py-8">{t('noColleagues')}</p>
                  )}
                  {colleagues.map(u => {
                    const online = onlineIds.has(u.id)
                    const info = ROLE_INFO[u.role] || {}
                    return (
                      <div key={u.id} className={`flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-gray-50 transition-colors ${activePeer?.id === u.id ? 'bg-primary-50' : ''}`}>
                        <div className="relative flex-shrink-0">
                          <SmartAvatar value={u.avatar} alt={u.name} size={38} rounded="rounded-full" textClass="text-xl" />
                          <span className={`absolute -bottom-0.5 ${isRTL ? 'left-0' : 'right-0'} w-3 h-3 rounded-full border-2 border-white ${online ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {info.badge} {roleLabel(u.role)}
                            {currentUser.role === 'super_admin' && u.pharmacyId ? ` · ${pickName(pharmaciesData.find(p => p.id === u.pharmacyId) || {})}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button onClick={() => setActivePeer(u)} className="p-2 rounded-lg text-primary-600 hover:bg-primary-50 transition-colors" title={t('liveChat')} aria-label={t('liveChat')}>
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button onClick={() => startCall(u, 'audio')} className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors" title={t('callAudio')} aria-label={t('callAudio')}>
                            <Phone className="w-4 h-4" />
                          </button>
                          <button onClick={() => startCall(u, 'video')} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors" title={t('callVideo')} aria-label={t('callVideo')}>
                            <Video className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* دردشة مباشرة مع الزميل */}
                <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                  <button onClick={() => setActivePeer(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600" aria-label={t('back')}>
                    <X className="w-4 h-4" />
                  </button>
                  <SmartAvatar value={activePeer.avatar} alt={activePeer.name} size={28} rounded="rounded-full" textClass="text-base" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{activePeer.name}</p>
                    <p className="text-[10px] text-gray-500">
                      {onlineIds.has(activePeer.id) ? `● ${t('staffOnline')}` : t('staffOffline')}
                    </p>
                  </div>
                </div>
                <div className="flex-1 p-2.5 min-h-0">
                  <DirectChat
                    who={currentUser.name}
                    role={currentUser.role}
                    counterpartLabel={activePeer.name}
                    peer={{ kind: 'user', id: activePeer.id, name: activePeer.name, avatar: activePeer.avatar }}
                    compact
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}

export default StaffComms
