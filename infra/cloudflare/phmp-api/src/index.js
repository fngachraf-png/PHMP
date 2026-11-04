// PHMP — بوابة API عامة عبر Workers VPC إلى خادم الهاتف خلف النفق.
// تمرّر الطلب كما هو (طريقة/ترويسات/جسم) وتضع عنوان العميل الحقيقي في
// x-phmp-client-ip حتى يعمل سجل التدقيق وتحديد المعدل في الخادم.
const ORIGIN_PORT = 3001

const handler = {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/_gateway/health') {
      return Response.json({
        ok: true,
        service: 'phmp-api-gateway',
        publicHost: url.hostname,
        time: new Date().toISOString(),
      })
    }

    const target = new URL(request.url)
    target.protocol = 'http:'
    target.hostname = '127.0.0.1'
    target.port = String(ORIGIN_PORT)

    const headers = new Headers(request.headers)
    headers.set('host', url.hostname)
    headers.set('x-forwarded-host', url.hostname)
    headers.set('x-forwarded-proto', 'https')
    const clientIp = request.headers.get('cf-connecting-ip') || ''
    headers.set('x-phmp-client-ip', clientIp)
    if (clientIp) headers.set('x-forwarded-for', clientIp)

    try {
      return await env.PHMP.fetch(new Request(target.toString(), {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'manual',
      }))
    } catch {
      // الخادم المحلي خلف النفق غير متاح: ردّ JSON موحّد (بدل نص خام) مع
      // ترويسات CORS كي تستطيع الواجهات قراءة الخطأ وعرضه — الأصل نفسه
      // يُردّ إليه (بوابة تمرير: الأصل نفسه من سير التحقق لا من هنا)
      const origin = request.headers.get('origin') || '*'
      return Response.json(
        { error: 'origin_unavailable' },
        {
          status: 503,
          headers: {
            'access-control-allow-origin': origin,
            'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
            'access-control-allow-headers': 'Content-Type,Authorization,x-phmp-key,x-phmp-client-ip',
            'vary': 'Origin',
          },
        },
      )
    }
  },
}

export default handler
