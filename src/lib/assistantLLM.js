// =====================================================================
// طبقة النموذج اللغوي لـ«مساعد PHMP» — Cloudflare Workers AI (نموذج مجاني)
// ---------------------------------------------------------------------
// المعمارية:
//   الواجهة ← Worker ‏phmp-assistant (يحتفظ بالمفاتيح خادمياً) ← Workers AI
//   النموذج الافتراضي: @cf/meta/llama-3.1-8b-instruct-fast (من الحصة
//   المجانية اليومية في Cloudflare) — قابل للتغيير عبر متغير AI_MODEL.
//
// ضمانات عدم الهلوسة:
//   1) لا يُرسل للنموذج سوى سؤال المستخدم + سياق مستخرج من قاعدة بيانات
//      المنصة وقاعدة المعرفة المحلية (نمط RAG) — يُطلب منه التقيّد به.
//   2) كل الروابط تُحذف من مخرجات النموذج إجبارياً (sanitizeReply) —
//      الروابط الرسمية يضيفها المحرك المحلي فقط من قائمة موثقة.
//   3) عند أي فشل/مهلة/خطأ ← سقوط فوري على المحرك المحلي الحتمي.
// =====================================================================

import { ASSISTANT_KB } from '../data/assistantKnowledge.js'

// عنوان Worker الافتراضي (يُنشَر تلقائياً عبر سير assistant-deploy)
// يمكن تجاوزه محلياً عبر localStorage: phmp_assistant_url
const DEFAULT_WORKER_URL = 'https://phmp-assistant.balbolghol-ai.workers.dev'
const URL_OVERRIDE_KEY = 'phmp_assistant_url'
const TIMEOUT_MS = 12000
const PROBE_TIMEOUT_MS = 3500
const PROBE_RETRY_MS = 5 * 60 * 1000

export const getAssistantWorkerUrl = () => {
  try {
    const override = localStorage.getItem(URL_OVERRIDE_KEY)
    if (override && override.startsWith('http')) return override.replace(/\/+$/, '')
  } catch { /* localStorage غير متاح */ }
  return DEFAULT_WORKER_URL
}

// ---------------------------------------------------------------------
// فحص جاهزية العامل مسبقاً (يُخزّن النتيجة): يمنع تعليق الرسائل على مهلة
// طويلة عندما لا يكون العامل منشراً بعد — السقوط للمحرك المحلي يصبح فورياً.
// الحالات: 'up' | 'down' | 'probing'
// ---------------------------------------------------------------------
let workerState = 'probing'
let workerStateTs = 0
let probePromise = null

export const probeWorker = () => {
  if (Date.now() - workerStateTs < PROBE_RETRY_MS && workerState !== 'probing') {
    return Promise.resolve(workerState)
  }
  if (probePromise) return probePromise
  workerStateTs = Date.now()
  probePromise = (async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
    try {
      const res = await fetch(getAssistantWorkerUrl() + '/health', { signal: controller.signal })
      const data = await res.json().catch(() => null)
      workerState = res.ok && data?.ok ? 'up' : 'down'
    } catch {
      workerState = 'down'
    } finally {
      clearTimeout(timer)
      probePromise = null
    }
    return workerState
  })()
  return probePromise
}

// حصيلة المحرك المحلي التي تُمرر كسياق موثوق للنموذج
export const buildLLMContext = ({ drugCards = [], kbEntries = [], language = 'ar', platformInfo = '' }) => {
  const parts = []
  if (platformInfo) parts.push(platformInfo)
  if (kbEntries.length) {
    parts.push('=== KNOWLEDGE BASE EXCERPTS (verified platform/law facts) ===')
    for (const e of kbEntries.slice(0, 3)) {
      parts.push(`[${e.id}] ${e.answer[language] || e.answer.ar}`)
    }
  }
  if (drugCards.length) {
    parts.push('=== MEDICINE RECORDS FROM OFFICIAL MOROCCAN DRUG LIST (verified data) ===')
    for (const d of drugCards.slice(0, 5)) {
      const row = [
        `Name: ${d.name}`,
        d.dci && `INN/DCI: ${d.dci}`,
        d.form && `Form: ${d.form}`,
        d.dosage && `Strength: ${d.dosage}`,
        d.presentation && `Packaging: ${d.presentation}`,
        d.price != null && `Official public price (PPV): ${d.price} MAD`,
        `Prescription: ${d.requiresPrescription ? 'REQUIRED' : 'not required'}`,
        d.reimbursement && `Reimbursement: ${d.reimbursement}`,
        (d.isGeneric || d.isOriginator) && `Type: ${d.isGeneric ? 'generic' : 'originator'}`,
      ].filter(Boolean).join(' | ')
      parts.push(row)
    }
  }
  return parts.join('\n\n')
}

// إزالة كل الروابط من مخرجات النموذج (منع الروابط الوهمية نهائياً)
export const sanitizeReply = (text) => {
  let s = String(text || '').trim()
  // يحذف أي URL (http/https/www) وما حوله من فراغات
  s = s.replace(/(?:https?:\/\/|www\.)\S+/gi, '')
  // يحذف علامات ماركداون قد تكسر العرض
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  s = s.replace(/[*_`#>]+/g, '')
  s = s.replace(/[ \t]+/g, ' ')
  s = s.replace(/\n{3,}/g, '\n\n').trim()
  // سقف للطول (إجابات المساعد موجزة)
  if (s.length > 900) s = s.slice(0, 890).trim() + '…'
  return s
}

/**
 * سؤال النموذج اللغوي عبر Worker كلاودفلير.
 * يرجع النص المنقّح أو null عند أي فشل (المستدعي يسقط على المحرك المحلي).
 */
export const askLLM = async ({ question, history = [], language = 'ar', role = 'guest', context = '' }) => {
  const url = getAssistantWorkerUrl()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        question: String(question || '').slice(0, 600),
        history: (history || []).slice(-6).map((m) => ({ role: m.mine ? 'user' : 'assistant', text: m.text })),
        lang: language,
        role,
        context: String(context || '').slice(0, 4000),
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data || typeof data.reply !== 'string') return null
    const clean = sanitizeReply(data.reply)
    return clean.length >= 2 ? clean : null
  } catch {
    return null // انقطاع/مهلة/JSON غير صالح → المحرك المحلي
  } finally {
    clearTimeout(timer)
  }
}

// مدخل واحد: يتحقق من جاهزية العامل ثم يحاول النموذج ويسقط محلياً دائماً
export const getAssistantReply = async ({ question, history, language, role, drugCards, kbEntries, platformInfo, localFallback }) => {
  const state = await Promise.race([
    probeWorker(),
    new Promise((r) => setTimeout(() => r(workerState), PROBE_TIMEOUT_MS + 500)),
  ])
  if (state === 'down') {
    const local = typeof localFallback === 'function' ? localFallback() : null
    return local ? { ...local, via: 'local' } : null
  }
  const context = buildLLMContext({ drugCards, kbEntries, language, platformInfo })
  const llm = await askLLM({ question, history, language, role, context })
  if (llm) return { text: llm, via: 'llm' }
  const local = typeof localFallback === 'function' ? localFallback() : null
  return local ? { ...local, via: 'local' } : null
}

export { ASSISTANT_KB }
