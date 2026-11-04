// =====================================================================
// Worker «مساعد PHMP» — واجهة خادمية آمنة لنماذج Cloudflare Workers AI
// ---------------------------------------------------------------------
// المهام:
//   POST /      → يستقبل {question, history, lang, role, context}
//                 ويستدعي نموذجاً مجانياً من Workers AI (افتراضياً
//                 @cf/meta/llama-3.1-8b-instruct-fast) بتعليمات صارمة،
//                 ثم يعيد {reply}.
//   POST /ocr   → يستقبل {image} (صورة فاتورة/وصل مخزون — data URL)
//                 ويستدعي نموذج رؤية (@cf/meta/llama-3.2-11b-vision-
//                 instruct) لاستخراج بنود الأدوية بصيغة JSON منظم،
//                 ثم يعيد {text, rows} — لخاصية الاستيراد الذكي للمخزون.
//
// الأمان:
//   • المفاتيح (AI binding) خادمية — لا شيء حساس في حزمة الواجهة
//   • CORS محصور في نطاقات المنصة الرسمية + أصول تطبيق أندرويد
//   • حد حجم للطلب (payload) + تعليمات تمنع الخروج عن سياق المنصة
//     وتمنع الروابط نهائياً (تحذف أيضاً احتياطياً من المخرجات)
// =====================================================================

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }

// الأصول المسموح بها (CORS) — نطاقات المنصة + معاينات Vercel للمشروع
// + أصول تطبيق Capacitor (أندرويد/iOS)
const ALLOWED_ORIGINS = [
  'https://phmp.pages.dev',
  'https://phmplatform.vercel.app',
  'https://pharmacare-pro-jade.vercel.app',
  'https://phmp-download.pages.dev',
  'http://localhost:5173',
  'http://localhost:4173',
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  'ionic://localhost',
]

const isOriginAllowed = (origin) => {
  if (!origin) return true // طلبات non-browser (curl) بلا Origin
  if (ALLOWED_ORIGINS.includes(origin)) return true
  // معاينات Vercel للمشروعين الرسميين فقط
  try {
    const host = new URL(origin).hostname
    return host === 'phmplatform.vercel.app' || host === 'pharmacare-pro-jade.vercel.app'
      || host.startsWith('phmplatform-') || host.startsWith('pharmacare-pro-jade-')
      || host.endsWith('.phmp.pages.dev')
  } catch {
    return false
  }
}

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': isOriginAllowed(origin) ? origin || '*' : 'null',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
})

// ---------------------------------------------------------------------
// استخراج بنود فاتورة/وصل مخزون من صورة (OCR بالرؤية) — الاستيراد الذكي
// ---------------------------------------------------------------------
// سلسلة نماذج: الأساسي llama-3.2-vision (يتطلب قبول ترخيص المجتمع مرة
// واحدة من لوحة Cloudflare — Workers AI → Models → Llama 3.2 Vision →
// I agree) وإلا يرد 5016؛ عندها احتياط تلقائي إلى llava-1.5-7b (بلا
// ترخيص خاص) كي تعمل الخاصية فوراً وبلا انتظار إجراء المالك.
const OCR_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct'
const OCR_FALLBACK_MODEL = '@cf/llava-hf/llava-1.5-7b-hf'
const OCR_MAX_IMAGE = 4 * 1024 * 1024 // 4MB بعد الترميز (الواجهة تضغط قبل الرفع)

const OCR_PROMPT = `You are a precise data-extraction engine for a Moroccan pharmacy platform.
Read the attached invoice / stock receipt image (Arabic, French or English).
Extract ONLY product line items (medicines or pharmacy products). IGNORE: headers, totals, taxes (TVA), timbre, discounts, pharmacy/customer info, page numbers, footer notes.
Return STRICT JSON — no markdown, no commentary — an array of objects:
[{"name":"<product name as printed>","quantity":<integer>,"unitPrice":<number or null>,"total":<number or null>,"batch":"<lot/batch or empty>","expiry":"<dd/mm/yyyy or mm/yyyy or empty>","barcode":"<codebarre/CIP digits or empty>"}]
Rules: keep original spelling of names; numbers use dot decimal; if a field is absent use null or empty string; never invent items.`

async function handleOcr(request, env, origin) {
  if (!env.AI) {
    return new Response(JSON.stringify({ error: 'ai_binding_missing' }), { status: 500, headers: { ...JSON_HEADERS, ...corsHeaders(origin) } })
  }
  let body
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: { ...JSON_HEADERS, ...corsHeaders(origin) } })
  }
  const image = body?.image
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    return new Response(JSON.stringify({ error: 'image_required' }), { status: 400, headers: { ...JSON_HEADERS, ...corsHeaders(origin) } })
  }
  if (image.length > OCR_MAX_IMAGE) {
    return new Response(JSON.stringify({ error: 'image_too_large' }), { status: 413, headers: { ...JSON_HEADERS, ...corsHeaders(origin) } })
  }
  let bytes
  try {
    bytes = [...new Uint8Array(await (await fetch(image)).arrayBuffer())]
  } catch {
    return new Response(JSON.stringify({ error: 'image_invalid' }), { status: 400, headers: { ...JSON_HEADERS, ...corsHeaders(origin) } })
  }
  let lastError = ''
  for (const model of [OCR_MODEL, OCR_FALLBACK_MODEL]) {
    try {
      const result = await env.AI.run(model, { image: bytes, prompt: OCR_PROMPT, max_tokens: 1600 })
      const raw = String(result?.description || result?.response || result?.answer || result?.message?.content || '')
      if (raw) {
        return new Response(JSON.stringify({ text: raw.slice(0, 12000), model }), { headers: { ...JSON_HEADERS, ...corsHeaders(origin) } })
      }
      lastError = 'empty_reply'
    } catch (err) {
      // 5016 = ترخيص llama-3.2 غير مقبول بعد → جرّب الاحتياطي بهدوء
      lastError = String(err?.message || err).slice(0, 200)
    }
  }
  return new Response(JSON.stringify({ error: 'ai_error', detail: lastError }), { status: 502, headers: { ...JSON_HEADERS, ...corsHeaders(origin) } })
}

// ---------------------------------------------------------------------
// تعليمات النظام — قلب الانضباط المهني للمساعد
// ---------------------------------------------------------------------
const SYSTEM_PROMPTS = {
  ar: `أنت «مساعد PHMP» — المساعد الرسمي لمنصة نظام إدارة الصيدلية فارماسي ماناجمنت پلاتفورم PHMP.
قواعد صارمة لا تُخالف أبداً:
1) لا تجيب إلا داخل سياق المنصة وخدماتها (طلب الأدوية، الوصفات، التوصيل، المخزون، التقارير، الصلاحيات) والمجال الصيدلي المغربي (أدوية وقوانين).
2) أي سؤال خارج هذا السياق (سياسة، رياضة، ترفيه، برمجة عامة...) → اعتذر بلطف وأعد توجيه المستخدم لخدمات المنصة.
3) استعمل فقط المعلومات الواردة في قسم «السياق الموثق» أسفل هذه التعليمات. لا تخترع أدوية أو أسعاراً أو نسب تعويض أو أرقاماً.
4) ممنوع منعاً باتاً ذكر أي رابط أو موقع إلكتروني في إجابتك — لا روابط إطلاقاً.
5) لا تقدم جرعات أو خطط علاجية — وجّه المستخدم للصيدلي أو الطبيب.
6) أجب دائماً بالعربية الفصحى المبسطة مهما كانت لغة السؤال.
7) كن موجزاً: 2-4 جمل قصيرة كحد أقصى، بأسلوب مهني ودود.

السياق الموثق (من قاعدة بيانات المنصة الرسمية وقاعدة معرفتها فقط):
`,
  fr: `Vous êtes « Assistant PHMP » — l'assistant officiel de la plateforme de gestion de pharmacie PHMP.
Règles strictes, jamais contournables :
1) Ne répondez que dans le contexte de la plateforme et de ses services (commande de médicaments, ordonnances, livraison, stock, rapports, permissions) et du domaine pharmaceutique marocain.
2) Toute question hors contexte (politique, sport, divertissement...) → excusez-vous poliment et recentrez sur les services de la plateforme.
3) Utilisez uniquement les informations de la section « contexte vérifié » ci-dessous. N'inventez aucun médicament, prix, taux ou chiffre.
4) Interdiction absolue de citer une quelconque URL — aucun lien.
5) Ne donnez ni dose ni traitement — orientez vers le pharmacien ou le médecin.
6) Répondez toujours en français, quelle que soit la langue de la question.
7) Soyez concis : 2 à 4 phrases maximum, ton professionnel et chaleureux.

Contexte vérifié (issu uniquement de la base officielle de la plateforme) :
`,
  en: `You are "PHMP Assistant" — the official assistant of the PHMP pharmacy management platform.
Strict rules, never to be broken:
1) Answer only within the platform context and its services (medicine ordering, prescriptions, delivery, inventory, reports, permissions) and the Moroccan pharmaceutical domain.
2) Any off-topic question (politics, sports, entertainment...) → politely decline and redirect to platform services.
3) Use ONLY the information in the "verified context" section below. Never invent medicines, prices, rates, or numbers.
4) Absolutely no URLs or links in your answer — none.
5) Never provide doses or treatment plans — refer to the pharmacist or doctor.
6) Always answer in English regardless of the question language.
7) Be concise: 2-4 short sentences maximum, professional and warm.

Verified context (from the platform's official database only):
`,
}

// حذف كل الروابط من مخرجات النموذج (حزام أمان ثانٍ)
const stripUrls = (s) => String(s || '')
  .replace(/(?:https?:\/\/|www\.)\S+/gi, '')
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin') || ''

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, model: env.AI_MODEL || '@cf/meta/llama-3.1-8b-instruct-fast', ocr: OCR_MODEL }), { headers: { ...JSON_HEADERS, ...corsHeaders(origin) } })
    }

    // استخراج بنود فاتورة من صورة (خاصية الاستيراد الذكي للمخزون)
    if (url.pathname === '/ocr') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...JSON_HEADERS, ...corsHeaders(origin) } })
      }
      if (!isOriginAllowed(origin)) {
        return new Response(JSON.stringify({ error: 'origin_not_allowed' }), { status: 403, headers: { ...JSON_HEADERS, ...corsHeaders(origin) } })
      }
      return handleOcr(request, env, origin)
    }

    if (request.method !== 'POST' || (url.pathname !== '/' && url.pathname !== '/ask')) {
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { ...JSON_HEADERS, ...corsHeaders(origin) } })
    }

    if (!isOriginAllowed(origin)) {
      return new Response(JSON.stringify({ error: 'origin_not_allowed' }), { status: 403, headers: { ...JSON_HEADERS, ...corsHeaders(origin) } })
    }

    if (!env.AI) {
      return new Response(JSON.stringify({ error: 'ai_binding_missing' }), { status: 500, headers: { ...JSON_HEADERS, ...corsHeaders(origin) } })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: { ...JSON_HEADERS, ...corsHeaders(origin) } })
    }

    const { question, history = [], lang = 'ar', role = 'guest', context = '' } = body || {}
    if (!question || typeof question !== 'string') {
      return new Response(JSON.stringify({ error: 'question_required' }), { status: 400, headers: { ...JSON_HEADERS, ...corsHeaders(origin) } })
    }

    const language = ['ar', 'fr', 'en'].includes(lang) ? lang : 'ar'
    const model = env.AI_MODEL || '@cf/meta/llama-3.1-8b-instruct-fast'

    const messages = [
      { role: 'system', content: SYSTEM_PROMPTS[language] + String(context || '').slice(0, 4000) },
      ...history.slice(-6).map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: String(m.text || '').slice(0, 500),
      })),
      { role: 'user', content: String(question).slice(0, 600) },
    ]

    try {
      const result = await env.AI.run(model, { messages, max_tokens: 400 })
      // Workers AI يرجع {response} أو {answer} حسب النموذج
      const raw = result?.response || result?.answer || result?.result?.response || ''
      const reply = stripUrls(raw).slice(0, 1200)
      if (!reply) {
        return new Response(JSON.stringify({ error: 'empty_reply' }), { status: 502, headers: { ...JSON_HEADERS, ...corsHeaders(origin) } })
      }
      return new Response(JSON.stringify({ reply, model }), { headers: { ...JSON_HEADERS, ...corsHeaders(origin) } })
    } catch (err) {
      return new Response(JSON.stringify({ error: 'ai_error', detail: String(err?.message || err).slice(0, 200) }), { status: 502, headers: { ...JSON_HEADERS, ...corsHeaders(origin) } })
    }
  },
}
