import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../contexts/AppContext'
import { directLink } from '../../lib/directLink'
import { analyzeMessage, toDrugCard } from '../../lib/assistantEngine'
import { getAssistantReply, probeWorker } from '../../lib/assistantLLM'
import DirectChat from '../DirectChat'
import {
  Bot, X, Send, Pill, MessageCircle, ShieldCheck, Headphones,
  ReceiptText, Lock, CircleDot, Sparkles,
} from 'lucide-react'

// =====================================================================
// «مساعد PHMP» — الشاتبوت الرسمي للمنصة
// ---------------------------------------------------------------------
// • متعدد اللغات (ar/fr/en) حسب لغة المستخدم، وبالوضعين الفاتح والقاتم
// • يخدم: الموظفين + الزبناء المسجلين + الزبناء العابرين (نوايا مختلفة)
// • بطاقات الأدوية من اللائحة المغربية الرسمية داخل المنصة فقط (5917)
// • تصحيح أسماء الأدوية إملائياً وتوجيه الزبون للدواء المعني
// • لا يجيب خارج سياق المنصة وخدماتها — ولا يولّد روابط (حماية مزدوجة)
// • يحوّل المحادثة إلى الصيدلي أو الكاشير (حسب المتوفر) عبر الاتصال
//   المباشر المستهلك فورياً — بلا أي تسجيل في خوادم المنصة
// =====================================================================

const ASSISTANT_CHAT_ID = 'phmp-assistant-direct'
const PRESENCE_INTERVAL = 20000
const PRESENCE_TTL = 45000

const ROLE_LABEL_KEY = {
  pharmacist: 'assistantRolePharmacist',
  cashier: 'assistantRoleCashier',
  admin: 'assistantRoleAdmin',
  accountant: 'assistantRoleAccountant',
  super_admin: 'assistantRoleAdmin',
}

// بطاقة دواء داخل رسالة المساعد — بيانات موثقة من قاعدة المنصة
const DrugCardView = ({ drug, t }) => (
  <div className="mt-2 rounded-xl bg-white border border-primary-100 overflow-hidden text-start">
    <div className="px-3 pt-2.5 pb-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-gray-900 leading-snug break-words">{drug.name}</p>
        <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${drug.requiresPrescription ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {drug.requiresPrescription ? t('assistantPrescriptionRequired') : t('assistantNoPrescription')}
        </span>
      </div>
      {drug.dci && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{drug.dci}</p>}
      <div className="flex flex-wrap gap-1 mt-1.5">
        {drug.dosage && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md">{drug.dosage}</span>}
        {drug.form && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md max-w-[150px] truncate">{drug.form}</span>}
        {drug.presentation && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md max-w-[150px] truncate">{drug.presentation}</span>}
        {drug.isGeneric && <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-md font-semibold">{t('assistantGeneric')}</span>}
        {drug.isOriginator && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md font-semibold">{t('assistantOriginator')}</span>}
        {drug.reimbursement && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-md">{t('assistantReimbursement')}: {drug.reimbursement}</span>}
      </div>
    </div>
    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 border-t border-gray-100">
      <span className="text-xs font-extrabold text-primary-700 tabular-nums">
        {drug.price != null ? `${Number(drug.price).toFixed(2)} ${t('currency')}` : ''}
        <span className="text-[10px] font-medium text-gray-400 ms-1">{t('assistantReferencePrice')}</span>
      </span>
      <Link
        to={`/shop?q=${encodeURIComponent(drug.name)}`}
        className="flex items-center gap-1 text-[11px] font-bold text-primary-600 hover:text-primary-800 transition-colors"
      >
        <Pill className="w-3 h-3" />
        {t('assistantViewInShop')}
      </Link>
    </div>
  </div>
)

const PHMPAssistant = () => {
  const { t, language, isRTL, currentUser, currentCustomer } = useApp()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState('chat') // chat | escalate
  const [messages, setMessages] = useState([]) // {id, mine, text, drugs?, sourceKey?, escalate?}
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [staffPresence, setStaffPresence] = useState(null) // {name, role, ts}
  const [pendingChat, setPendingChat] = useState(false) // موظف: طلب دردشة وارد
  const [unread, setUnread] = useState(0)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const idRef = useRef(1)

  // الدور الحالي للمساعد: موظف / زبون مسجل / زبون عابر
  const audience = currentUser ? 'staff' : (currentCustomer ? 'customer' : 'guest')
  const displayName = currentUser?.name || currentCustomer?.fullName || t('assistantGuestLabel')
  const staffRoleLabel = staffPresence ? (t(ROLE_LABEL_KEY[staffPresence.role] || 'assistantRoleStaff')) : ''

  // رسالة الترحيب مشتقة (تتحدث فوراً عند تغيير اللغة أو الدور)
  const welcomeKey = audience === 'staff' ? 'assistantWelcomeStaff'
    : audience === 'customer' ? 'assistantWelcomeCustomer' : 'assistantWelcomeGuest'
  const welcomeText = t(welcomeKey).replace('{name}', displayName || '')

  // ===== حضور الموظفين (البث) — «حسب المتوفر» =====
  const isStaffSide = audience === 'staff'
  useEffect(() => {
    if (!isStaffSide || !currentUser) return
    const announce = () => directLink.send({
      type: 'assistant_presence', presence: 'online',
      who: currentUser.name, role: currentUser.role, ts: Date.now(),
    })
    announce()
    const iv = setInterval(announce, PRESENCE_INTERVAL)
    const leave = () => directLink.send({ type: 'assistant_presence', presence: 'offline', who: currentUser.name, ts: Date.now() })
    window.addEventListener('beforeunload', leave)
    return () => { clearInterval(iv); leave(); window.removeEventListener('beforeunload', leave) }
  }, [isStaffSide, currentUser])

  // الزبون يفتح اللوحة → يطلب حضوراً فورياً (لا ينتظر البث الدوري)
  // + يشغّل فحص جاهزية عامل النموذج مسبقاً (يمنع تعليق أول رسالة)
  useEffect(() => {
    if (!open) return
    if (!isStaffSide) directLink.send({ type: 'assistant_presence_probe', ts: Date.now() })
    probeWorker().catch(() => {})
  }, [open, isStaffSide])

  // ===== الاستماع: حضور الموظفين + طلبات الدردشة + رسائل التحويل =====
  const presenceRef = useRef(null)
  useEffect(() => {
    const off = directLink.onMessage((msg) => {
      if (msg.type === 'assistant_presence') {
        if (msg.presence === 'online' && msg.who) {
          presenceRef.current = { name: msg.who, role: msg.role, ts: msg.ts }
          setStaffPresence(presenceRef.current)
        } else if (msg.presence === 'offline' && msg.who === presenceRef.current?.name) {
          presenceRef.current = null
          setStaffPresence(null)
        }
        return
      }
      // زبون يطلب حضوراً فورياً → الموظف يجيب فوراً (تجاوز البث الدوري)
      if (msg.type === 'assistant_presence_probe' && isStaffSide && currentUser) {
        directLink.send({
          type: 'assistant_presence', presence: 'online',
          who: currentUser.name, role: currentUser.role, ts: Date.now(),
        })
        return
      }
      // طلب دردشة من زبون عبر المساعد → إشعار الموظف وفتح التحويل مباشرة
      if (msg.type === 'assistant_chat_request' && isStaffSide) {
        setPendingChat(true)
        if (open) {
          setView('escalate')
          setPendingChat(false)
        } else {
          setUnread((u) => u + 1)
        }
        return
      }
      // رسالة مباشرة أثناء التحويل واللوحة مغلقة → شارة
      if (msg.type === 'chat' && msg.orderId === ASSISTANT_CHAT_ID && !open) {
        setUnread((u) => u + 1)
      }
    })
    return off
  }, [isStaffSide, open, currentUser])

  // انتهاء صلاحية الحضور (TTL)
  useEffect(() => {
    const iv = setInterval(() => {
      setStaffPresence((p) => (p && Date.now() - p.ts > PRESENCE_TTL ? null : p))
    }, 10000)
    return () => clearInterval(iv)
  }, [])

  // تمرير تلقائي
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, typing, view])

  const pushMessage = (msg) => setMessages((prev) => [...prev, { id: idRef.current++, ...msg }])

  // ===== بناء الجواب المحلي الحتمي (سقوط آمن دائم) =====
  const buildLocalAnswer = useCallback((analysis) => {
    if (analysis.intent === 'greeting') return { text: welcomeText }
    if (analysis.intent === 'thanks') return { text: t('assistantReplyThanks') }
    if (analysis.intent === 'bye') return { text: t('assistantReplyBye') }
    if (analysis.intent === 'escalate') return { text: t('assistantEscalateIntro'), escalate: true }
    if (analysis.intent === 'offtopic') return { text: t('assistantOffTopic') }
    if (analysis.intent === 'domain-unknown') return { text: t('assistantGenericGuidance') }

    if (analysis.intent === 'drug') {
      const cards = (analysis.drugMatches || []).map((m) => toDrugCard(m.drug, language)).filter(Boolean)
      if (cards.length && analysis.confident) {
        return { text: t('assistantResults').replace('{count}', String(cards.length)), drugs: cards }
      }
      if (cards.length) {
        return { text: t('assistantNoExactMatch'), drugs: cards.slice(0, 4) }
      }
      return { text: t('assistantNoDrugFound') }
    }

    if (analysis.intent === 'kb') {
      const entry = analysis.kbEntry
      const drugCards = (analysis.drugMatches || []).map((m) => toDrugCard(m.drug, language)).filter(Boolean)
      return { text: entry.answer[language] || entry.answer.ar, sourceKey: entry.source, drugs: drugCards.slice(0, 3) }
    }
    return { text: t('assistantGenericGuidance') }
  }, [language, t, welcomeText])

  // ===== إرسال رسالة =====
  const handleSend = async (rawText) => {
    const text = String(rawText ?? input).trim()
    if (!text || typing) return
    setInput('')
    pushMessage({ mine: true, text })
    const analysis = analyzeMessage(text)
    setTyping(true)

    // النوايا الحتمية تُجاب فوراً ومحلياً (لا تحتاج نموذجاً)
    const immediate = ['greeting', 'thanks', 'bye', 'escalate', 'offtopic']
    const isConfident = (analysis.intent === 'drug' && analysis.confident)
      || (analysis.intent === 'kb' && analysis.confident)

    try {
      if (immediate.includes(analysis.intent) || isConfident) {
        await new Promise((r) => setTimeout(r, 350)) // إيقاع طبيعي
        pushMessage({ mine: false, ...buildLocalAnswer(analysis) })
      } else {
        // صياغة النموذج اللغوي (كلاودفلير) بسياق موثق + سقوط محلي آمن
        const drugCards = (analysis.drugMatches || []).map((m) => toDrugCard(m.drug, language)).filter(Boolean)
        const reply = await getAssistantReply({
          question: text,
          history: messages.slice(-6),
          language,
          role: audience,
          drugCards,
          kbEntries: analysis.kbEntry ? [analysis.kbEntry] : [],
          platformInfo: t('appName'),
          localFallback: () => buildLocalAnswer(analysis),
        })
        const local = reply || buildLocalAnswer(analysis)
        pushMessage({ mine: false, ...local })
      }
    } catch {
      pushMessage({ mine: false, text: t('assistantErr') })
    } finally {
      setTyping(false)
    }
  }

  // ===== بدء التحويل إلى موظف =====
  const startEscalation = () => {
    setView('escalate')
    if (!isStaffSide) {
      // إعلان الطلب لكل نوافذ الموظفين (يُستهلك مباشرة — لا يسجل)
      directLink.send({
        type: 'assistant_chat_request',
        from: displayName,
        customerName: displayName,
        customerType: audience,
        ts: Date.now(),
      })
    } else {
      setPendingChat(false)
      setUnread(0)
    }
  }

  // ===== الرقائق السريعة حسب الجمهور =====
  const quickChips = useMemo(() => {
    if (audience === 'staff') {
      return [
        { label: t('assistantQuickDrugs'), action: () => pushMessage({ mine: false, text: t('assistantAskDrugName') }) },
        { label: t('assistantQuickLaws'), action: () => handleSend(language === 'ar' ? 'ما هي القوانين المنظمة لقطاع الأدوية والصيدلة بالمغرب؟' : language === 'fr' ? 'Quelles sont les lois qui régissent le secteur du médicament au Maroc ?' : 'What laws govern the medicine and pharmacy sector in Morocco?') },
        { label: t('assistantQuickPrescription'), action: () => handleSend(language === 'ar' ? 'ما هي الأدوية التي تحتاج وصفة طبية إلزامية؟' : language === 'fr' ? 'Quels médicaments exigent une ordonnance obligatoire ?' : 'Which medicines require a mandatory prescription?') },
      ]
    }
    return [
      { label: t('assistantQuickOrder'), action: () => handleSend(language === 'ar' ? 'كيف أطلب دواء من المنصة؟' : language === 'fr' ? 'Comment commander un médicament sur la plateforme ?' : 'How do I order a medicine on the platform?') },
      { label: t('assistantQuickDrugs'), action: () => pushMessage({ mine: false, text: t('assistantAskDrugName') }) },
      { label: t('assistantQuickPrescription'), action: () => handleSend(language === 'ar' ? 'ما هي الأدوية التي تحتاج وصفة طبية إلزامية؟' : language === 'fr' ? 'Quels médicaments exigent une ordonnance obligatoire ?' : 'Which medicines require a mandatory prescription?') },
      { label: t('assistantQuickHuman'), action: startEscalation },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience, language, t])

  const sourceLabel = (sourceKey) => {
    const map = {
      platform: t('appShortName'),
      assistantLaw17_04: t('assistantLaw17_04'),
      assistantLaw10_22: t('assistantLaw10_22'),
      assistantLaw65_00: t('assistantLaw65_00'),
      assistantDecreePrices: t('assistantDecreePrices'),
    }
    return map[sourceKey] || ''
  }

  const launcherBadge = pendingChat || unread > 0

  return (
    <>
      {/* ===== زر الإطلاق العائم ===== */}
      <button
        onClick={() => {
          const willOpen = !open
          setOpen(willOpen)
          if (willOpen) {
            setUnread(0)
            // موظف لديه طلب دردشة وارد → يفتح مباشرة على واجهة التحويل
            if (isStaffSide && pendingChat) {
              setView('escalate')
              setPendingChat(false)
            } else if (view === 'escalate' && !isStaffSide) {
              setView('chat')
            }
          }
        }}
        aria-label={t('assistantOpen')}
        className={`fixed bottom-5 end-5 z-[70] w-14 h-14 rounded-full gradient-primary text-white shadow-xl shadow-primary-600/40 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 ${open ? 'scale-90 opacity-90' : ''}`}
      >
        {open ? <X className="w-6 h-6" /> : <Bot className="w-7 h-7" />}
        {launcherBadge && !open && (
          <span className="absolute -top-1 -end-1 w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center animate-pulse">
            {unread > 0 ? unread : '!'}
          </span>
        )}
      </button>

      {/* ===== لوحة المساعد ===== */}
      {open && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          role="dialog"
          aria-label={t('assistantName')}
          className="fixed bottom-[5.5rem] end-5 z-[70] w-[min(calc(100vw-2.5rem),380px)] h-[min(72vh,580px)] rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden flex flex-col"
        >
          {/* الترويسة */}
          <div className="gradient-primary px-4 py-3 text-white flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-tight">{t('assistantName')}</p>
              <p className="text-[11px] text-white/85 truncate">{t('assistantTagline')}</p>
            </div>
            {view === 'escalate' && (
              <button onClick={() => setView('chat')} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors" aria-label={t('assistantClose')}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* شريط الحالة: جاهزية الموظفين للمستفيدين */}
          {!isStaffSide && view === 'chat' && (
            <div className="px-4 py-2 bg-primary-50 border-b border-primary-100 flex items-center gap-2 text-[11px] flex-shrink-0">
              <span className={`flex items-center gap-1.5 font-semibold ${staffPresence ? 'text-emerald-700' : 'text-gray-500'}`}>
                <CircleDot className={`w-3.5 h-3.5 ${staffPresence ? 'text-emerald-600' : 'text-gray-400'}`} />
                {staffPresence
                  ? `${t('assistantStaffOnline')}: ${staffPresence.name} (${staffRoleLabel})`
                  : t('assistantNoStaff')}
              </span>
            </div>
          )}

          {view === 'chat' ? (
            <>
              {/* الرسائل */}
              <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 bg-gray-50">
                {/* ترحيب مشتق */}
                <div className="flex justify-start">
                  <div className="max-w-[88%] px-3.5 py-2.5 rounded-2xl rounded-bl-sm bg-white border border-gray-200 text-gray-900 text-sm leading-relaxed shadow-sm">
                    {welcomeText}
                  </div>
                </div>

                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[88%] ${m.mine
                      ? 'px-3.5 py-2.5 rounded-2xl rounded-br-sm bg-primary-600 text-white text-sm leading-relaxed'
                      : 'px-3.5 py-2.5 rounded-2xl rounded-bl-sm bg-white border border-gray-200 text-gray-900 text-sm leading-relaxed shadow-sm w-full'}`}
                    >
                      <p className="break-words whitespace-pre-line">{m.text}</p>
                      {m.drugs?.length > 0 && (
                        <div className="space-y-2">
                          {m.drugs.map((d) => <DrugCardView key={d.id} drug={d} t={t} />)}
                        </div>
                      )}
                      {m.escalate && (
                        <button
                          onClick={startEscalation}
                          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold transition-colors"
                        >
                          <Headphones className="w-3.5 h-3.5" />
                          {t('assistantAskHuman')}
                        </button>
                      )}
                      {!m.mine && m.sourceKey && (
                        <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                          <ReceiptText className="w-3 h-3" />
                          {t('assistantSources')}: {sourceLabel(m.sourceKey)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {typing && (
                  <div className="flex justify-start">
                    <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white border border-gray-200 shadow-sm flex items-center gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                      <span className="text-[10px] text-gray-400 ms-1">{t('assistantTyping')}</span>
                    </div>
                  </div>
                )}

                {/* الرقائق السريعة */}
                {messages.length === 0 && !typing && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {quickChips.map((chip) => (
                      <button
                        key={chip.label}
                        onClick={chip.action}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white border border-primary-200 text-primary-700 text-[11px] font-semibold hover:bg-primary-50 transition-colors shadow-sm"
                      >
                        <Sparkles className="w-3 h-3" />
                        {chip.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* تنبيه الاستشارة */}
              <div className="px-3 py-1.5 bg-amber-50 border-t border-amber-100 flex items-center gap-1.5 flex-shrink-0">
                <Lock className="w-3 h-3 text-amber-600 flex-shrink-0" />
                <p className="text-[10px] text-amber-700 leading-tight">{t('assistantDisclaimer')}</p>
              </div>

              {/* الإدخال */}
              <form
                onSubmit={(e) => { e.preventDefault(); handleSend() }}
                className="p-2.5 border-t border-gray-200 flex items-center gap-2 bg-white flex-shrink-0"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t('assistantPlaceholder')}
                  className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  maxLength={300}
                />
                <button type="submit" disabled={!input.trim() || typing} className="btn-primary px-3 py-2 rounded-xl disabled:opacity-50" aria-label={t('sendMessage')}>
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            /* ===== واجهة التحويل: دردشة مباشرة مع الموظف ===== */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2 text-[11px] text-gray-600 flex-shrink-0">
                <MessageCircle className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />
                <span className="font-semibold leading-snug">
                  {isStaffSide
                    ? t('assistantCustomerChatRequest')
                    : (staffPresence
                        ? t('assistantConnectingYou').replace('{role}', staffRoleLabel) + ' ' + staffPresence.name
                        : t('assistantNoStaff') + ' — ' + t('assistantEscalateIntro'))}
                </span>
              </div>
              <div className="flex-1 min-h-0 p-3 overflow-y-auto">
                <DirectChat
                  orderId={ASSISTANT_CHAT_ID}
                  who={displayName}
                  role={audience === 'staff' ? 'staff' : 'customer'}
                  counterpartLabel={isStaffSide ? t('assistantGuestLabel') : (staffRoleLabel || t('assistantRoleStaff'))}
                  compact
                />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default PHMPAssistant
