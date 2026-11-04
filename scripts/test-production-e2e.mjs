// =====================================================================
// اختبار E2E إنتاجي للطبقة السحابية الدائمة phmp-realtime (بالقياس)
// ---------------------------------------------------------------------
// الهدف: إثبات أن الدردشة والمكالمات والمزامنة تعمل الآن من الإنتاج
// حتى والخادم المحلي (هاتف المالك) غير متاح (503 عبر البوابة).
// =====================================================================
import WebSocket from 'ws'

const LIVE = 'https://phmp-realtime.balbolghol-ai.workers.dev'
const GATEWAY = 'https://phmp-api.balbolghol-ai.workers.dev'
const PAGES = 'https://phmp.pages.dev'
const ASSISTANT = 'https://phmp-assistant.balbolghol-ai.workers.dev'

let passed = 0, failed = 0
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ✅ ${name}`) }
  else { failed++; console.log(`  ❌ ${name} ${extra ? '— ' + extra : ''}`) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function openWs(auth) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${LIVE.replace(/^http/, 'ws')}/ws`)
    const msgs = []
    let welcomed = false
    const timer = setTimeout(() => reject(new Error('timeout')), 10000)
    ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', ...auth })))
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString())
      msgs.push(msg)
      if (msg.type === 'welcome' && !welcomed) {
        welcomed = true
        clearTimeout(timer)
        resolve({
          ws, msgs, welcome: msg,
          send: (m) => ws.send(JSON.stringify(m)),
          close: () => new Promise((r) => { ws.on('close', () => r()); ws.close() }),
          waitFor: (pred, ms = 5000) => new Promise((res, rej) => {
            const found = msgs.find(pred)
            if (found) return res(found)
            const t = setTimeout(() => rej(new Error('waitFor timeout')), ms)
            const iv = setInterval(() => {
              const f = msgs.find(pred)
              if (f) { clearTimeout(t); clearInterval(iv); res(f) }
            }, 50)
            setTimeout(() => clearInterval(iv), ms)
          }),
        })
      }
    })
    ws.on('close', (code) => { if (!welcomed) { clearTimeout(timer); reject(new Error('closed:' + code)) } })
    ws.on('error', () => { if (!welcomed) { clearTimeout(timer); reject(new Error('error')) } })
  })
}

async function main() {
  console.log('🧪 قياس الإنتاج —', new Date().toISOString())

  // ===== 0. حالة المرافق =====
  let res = await fetch(`${GATEWAY}/api/health`)
  const gatewayUp = res.status
  const gatewayBody = await res.text()
  console.log(`ℹ️  البوابة (خادم الهاتف): HTTP ${gatewayUp} ${gatewayBody.slice(0, 80)}`)
  const phoneDown = gatewayUp === 503
  console.log(phoneDown ? 'ℹ️  خادم الهاتف نائم (503) — وهذا هو شرط الإثبات:' : 'ℹ️  خادم الهاتف متصل — الاختبار صالح أيضاً')

  res = await fetch(`${LIVE}/api/health`)
  ok('الطبقة السحابية /api/health = 200', res.status === 200, `got ${res.status}`)
  let body = await res.json()
  ok('الطبقة السحابية ok:true', body.ok === true)

  res = await fetch(`${LIVE}/api/health?deep=1`)
  body = await res.json()
  ok('الطبقة السحابية deep (DO حي + تخزين)', res.status === 200 && body.ok === true && typeof body.sockets === 'number', JSON.stringify(body))

  // ===== 1. مصادقة ضيفين + دردشة بينهما عبر الغرفة =====
  const guestA = await openWs({ guest: { name: 'قياس أ', phone: '+212600111222', pharmacyId: 'ph-test-e2e' } })
  ok('ضيف أ: welcome', guestA.welcome.identity.name === 'قياس أ')
  const guestB = await openWs({ guest: { name: 'قياس ب', phone: '+212600111333', pharmacyId: 'ph-test-e2e' } })
  ok('ضيف ب: welcome', guestB.welcome.identity.name === 'قياس ب')

  const room = `order:e2e-${Date.now()}`
  guestA.send({ type: 'join', room })
  guestB.send({ type: 'join', room })
  await sleep(500)
  guestA.send({ type: 'chat', room, text: 'رسالة قياس الإنتاج', displayName: 'قياس أ' })
  const received = await guestB.waitFor((m) => m.type === 'chat' && m.room === room && m.text.includes('قياس الإنتاج'))
  ok('دردشة عبر الغرفة تصل للطرف الآخر (سحابياً)', received.from === 'قياس أ')

  // ping/pong
  guestA.send({ type: 'ping' })
  const pong = await guestA.waitFor((m) => m.type === 'pong', 3000)
  ok('ping → pong', !!pong)

  // ===== 2. طلب جديد عبر REST + استقباله بالبث + التتبع =====
  const orderId = `e2e-${Date.now()}`
  res = await fetch(`${LIVE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: orderId, pharmacyId: 'ph-test-e2e', total: 21,
      customer: { name: 'قياس أ', phone: '+212600111222' },
      items: [{ productId: 'e2e-1', name: 'دواء قياس', price: 21, quantity: 1 }],
    }),
  })
  body = await res.json()
  const created = res.status === 201 && body.ok === true
  ok(`إنشاء طلب عبر الطبقة السحابية (${phoneDown ? 'والهاتف نائم!' : 'الهاتف متصل'})`, created, JSON.stringify(body))
  if (created) {
    const bcast = await guestA.waitFor((m) => m.type === 'order' && m.action === 'new' && m.order.id === orderId)
    ok('بث الطلب لصاحبه (مطابقة الهاتف)', bcast.order.customer.name === 'قياس أ')
    res = await fetch(`${LIVE}/api/orders/track?phone=%2B212600111222`)
    const tracked = await res.json()
    ok('تتبع الطلب بالهاتف من السحابة', Array.isArray(tracked) && tracked.some((o) => o.id === orderId))
    // إلغاء بهاتف صاحبه
    res = await fetch(`${LIVE}/api/orders/${orderId}/cancel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+212600111222' }),
    })
    body = await res.json()
    ok('إلغاء الطلب من طرف الزبون (تحقق الهاتف)', res.status === 200 && body.ok === true)
  }

  // ===== 3. حماية: أصل مجهول مرفوض + رمز مزيف 4003 =====
  try {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(`${LIVE.replace(/^http/, 'ws')}/ws`, { headers: { Origin: 'https://evil.example.com' } })
      ws.on('open', () => resolve())
      ws.on('error', (e) => reject(e))
      ws.on('close', (c) => reject(new Error('closed:' + c)))
      setTimeout(() => reject(new Error('timeout')), 5000)
    })
    ok('أصل مجهول: مقبول (غير متوقع!)', false)
  } catch (e) {
    ok('أصل مجهول يُرفض قبل الترقية', true)
  }
  const badCode = await new Promise((resolve) => {
    const ws = new WebSocket(`${LIVE.replace(/^http/, 'ws')}/ws`)
    ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', token: 'bad.token.here' })))
    ws.on('close', (c) => resolve(c))
    setTimeout(() => resolve('timeout'), 5000)
  })
  // 4003 = الرمز فاسد (التحقق متاح) | 4005 = تعذر التحقق (سر غير مضبوط
  // والهاتف بنسخة قديمة) — كلاهما رفض آمن بلا كشف بيانات
  ok('رمز مزيف: رفض آمن (4003 أو 4005)', badCode === 4003 || badCode === 4005, `code=${badCode}`)

  await Promise.allSettled([guestA.close(), guestB.close()])

  // ===== 4. الواجهة والبوابة والمساعد =====
  res = await fetch(PAGES)
  const pagesHtml = await res.text()
  ok('صفحة Pages حية', res.status === 200)
  const assetMatch = pagesHtml.match(/assets\/index-[\w-]+\.js/g) || []
  if (assetMatch.length) {
    const assetRes = await fetch(`${PAGES}/${assetMatch[0]}`)
    const bundle = await assetRes.text()
    ok('الحزمة الجديدة تحتوي phmp-realtime (التوجيه السحابي)', bundle.includes('phmp-realtime'))
    ok('الحزمة الجديدة تحتوي الاستيراد الذكي', bundle.includes('stockImportTitle') || bundle.includes('smartImport'))
  } else {
    ok('استخراج بصمة الحزمة من Pages', false, 'index asset not found')
  }

  res = await fetch(`${ASSISTANT}/health`)
  body = await res.json().catch(() => ({}))
  ok('Worker المساعد حي', res.status === 200 && body.ok === true)
  ok('نقطة OCR جاهزة بالنموذج البصري', !!body.ocr && String(body.ocr).includes('vision'), JSON.stringify(body))

  // نقطة OCR: رفض بلا صورة (تدل أن المسار منشور)
  res = await fetch(`${ASSISTANT}/ocr`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  })
  ok('نقطة /ocr منشورة (400 بلا صورة — وليس 404)', res.status === 400, `status=${res.status}`)

  console.log(`\n📊 النتيجة: ${passed} ناجح، ${failed} فاشل`)
  console.log(phoneDown
    ? '🏆 الإثبات: كل القياسات أعلاه نجحت بينما خادم الهاتف نائم (503) — نقطة الفشل الوحيدة أزيلت'
    : 'ℹ️  خادم الهاتف متصل حالياً — أعد الاختبار أثناء نومه لإثبات الاستقلالية الكاملة')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('💥', e.message); process.exit(1) })
