// =====================================================================
// PHMP — phmp-realtime: طبقة الاتصال الفوري الدائمة على حافة Cloudflare
// ---------------------------------------------------------------------
// موجّه رقيق: CORS + تمرير /ws و/api/orders* إلى RealtimeHub (Durable
// Object واحد عالمي — مقياس المنصة الحالي). الخادم المحلي (هاتف المالك)
// يبقى مصدر تسجيل الدخول والمستخدمين والمزامنة الكاملة عبر البوابة
// phmp-api — هذه الطبقة تضمن أن الدردشة والمكالمات والطلبات لا تنقطع
// أبداً مهل كان هاتف المالك متصلاً أم لا.
// =====================================================================
import { RealtimeHub } from './hub.js'
import { makeOriginAllowed, jsonResponse } from './shared.js'

export { RealtimeHub }

const originAllowed = makeOriginAllowed()

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': originAllowed(origin) ? (origin || '*') : 'null',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-phmp-key',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
})

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin') || ''

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    // فحص صحة سطحي (سريع — بلا إيقاظ الـDO) وعميق عند ?deep=1
    if (url.pathname === '/api/health') {
      if (url.searchParams.get('deep') === '1') {
        const hub = env.HUB.get(env.HUB.idFromName('global'))
        const res = await hub.fetch(new Request('https://hub/api/health'))
        const info = await res.json().catch(() => ({}))
        return jsonResponse({ ...info, ok: !!info.ok, service: 'phmp-realtime' }, 200, corsHeaders(origin))
      }
      return jsonResponse({ ok: true, service: 'phmp-realtime', time: new Date().toISOString() }, 200, corsHeaders(origin))
    }

    // كل ما تبقى يخص الـDO: WebSocket + طلبات REST للطلبات والمزامنة
    const isWs = request.headers.get('Upgrade') === 'websocket'
    const isOrdersApi = url.pathname === '/api/orders' || url.pathname.startsWith('/api/orders/')
    if (!isWs && !isOrdersApi) {
      return jsonResponse({ error: 'not_found' }, 404, corsHeaders(origin))
    }
    if (!isWs && origin && !originAllowed(origin)) {
      return jsonResponse({ error: 'origin_not_allowed' }, 403, corsHeaders(origin))
    }

    // تمرير عنوان العميل الحقيقي (تحدید المعدل في الـDO)
    const headers = new Headers(request.headers)
    headers.set('x-phmp-client-ip', request.headers.get('cf-connecting-ip') || '')
    // الجسم يُستهلك مرة واحدة هنا (قراءة كاملة) — يمنع أخطاء التدفقات
    // المتروكة عند الردود المبكرة من الـDO (كتعذر التحقق 503)
    let body
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.arrayBuffer().catch(() => undefined)
      if (body && body.byteLength === 0) body = undefined
    }
    const hub = env.HUB.get(env.HUB.idFromName('global'))
    const res = await hub.fetch(new Request(url.toString(), {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    }))
    // إعادة الرد مع ترويسات CORS (استنساخ ترويسات الرد الأصلية)
    const outHeaders = new Headers(res.headers)
    for (const [k, v] of Object.entries(corsHeaders(origin))) outHeaders.set(k, v)
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: outHeaders, webSocket: res.webSocket })
  },
}
