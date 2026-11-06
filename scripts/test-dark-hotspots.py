# فحص تباين الوضع القاتم في المناطق الحارة للزبون: تتبع الطلب + الدردشة + نافذة الدفع
import asyncio, json, subprocess
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:4173'
API = 'http://127.0.0.1:3101'

res = subprocess.run(['curl', '-s', '-X', 'POST', API + '/api/auth/login',
                      '-H', 'Content-Type: application/json',
                      '-d', '{"username":"pharmacist","password":"Test@10mn"}'], capture_output=True, text=True)
TOKEN = json.loads(res.stdout)['token']

COMPOSITE_JS = open('/dev/null').read()  # placeholder

SCAN = '''() => {
  const DARK = [30, 41, 59]
  const parse = (c) => {
    const m = c && c.match(/rgba?\\(([\\d.]+), ([\\d.]+), ([\\d.]+)(?:, ([\\d.]+))?\\)/)
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null
  }
  const composite = (fg, bg) => ({ r: fg.r*fg.a + bg.r*(1-fg.a), g: fg.g*fg.a + bg.g*(1-fg.a), b: fg.b*fg.a + bg.b*(1-fg.a), a: 1 })
  const lum = (c) => 0.2126*c.r + 0.7152*c.g + 0.0722*c.b
  const issues = []
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length) continue
    const cs = getComputedStyle(el)
    const fg = parse(cs.color)
    if (!fg) continue
    let node = el, layers = []
    while (node && node !== document.documentElement) {
      const c = parse(getComputedStyle(node).backgroundColor)
      if (c && c.a > 0) layers.push(c)
      if (c && c.a > 0.75) break
      node = node.parentElement
    }
    let eff = { r: DARK[0], g: DARK[1], b: DARK[2], a: 1 }
    for (const layer of layers.reverse()) eff = composite(layer, eff)
    const L1 = lum(fg) + 0.05, L2 = lum(eff) + 0.05
    const ratio = Math.max(L1, L2) / Math.min(L1, L2)
    const visible = el.offsetWidth > 0 && el.offsetHeight > 0 && el.innerText && el.innerText.trim().length > 2
    if (visible && ratio < 4.0 && Math.abs(lum(fg) - lum(eff)) > 2) {
      issues.push({ t: el.innerText.slice(0, 32), r: +ratio.toFixed(2), color: cs.color, bgEff: `rgb(${eff.r|0},${eff.g|0},${eff.b|0})` })
    }
  }
  return issues.slice(0, 12)
}'''

async def main():
    async with async_playwright() as pw:
        chromium = await pw.chromium.launch()
        ctx = await chromium.new_context()
        page = await ctx.new_page()
        await page.goto(BASE + '/login', wait_until='domcontentloaded')
        for k, v in [('pharmacare_api_url', json.dumps(API)), ('pharmacare_live_url', json.dumps(API)),
                     ('pharmacare_theme', json.dumps('dark'))]:
            await page.evaluate(f'localStorage.setItem({json.dumps(k)}, {json.dumps(v)})')

        # ===== الزبون: متجر → طلب → تتبع + دردشة (الوضع القاتم) =====
        await page.goto(BASE + '/shop', wait_until='domcontentloaded')
        await page.wait_for_timeout(1000)
        await page.evaluate('''() => localStorage.setItem('pharmacare_currentCustomer', JSON.stringify({
            id: 'guest-dc', fullName: 'زبون القاتم', phone: '0677889900', type: 'guest' }))''')
        await page.reload(wait_until='domcontentloaded')
        await page.wait_for_timeout(1200)
        if await page.locator('button.card').count():
            await page.locator('button.card').first.click()
            await page.wait_for_timeout(700)
        add_btn = page.locator('button.btn-primary').filter(has=page.locator('svg.lucide-plus'))
        await add_btn.first.click()
        await page.wait_for_timeout(400)
        await page.locator('button:has(svg.lucide-shopping-cart)').first.click()
        await page.wait_for_timeout(500)
        await page.locator('button.btn-primary.w-full.py-3').first.click()
        await page.wait_for_timeout(400)
        await page.locator('button.btn-primary.w-full.py-3').first.click()
        await page.wait_for_timeout(400)
        await page.locator('button:has-text("التالي")').first.click()
        await page.wait_for_timeout(400)
        await page.locator('button:has-text("إرسال الطلب")').first.click()
        await page.wait_for_timeout(2200)
        issues = await page.evaluate(SCAN)
        print('تتبع الطلب + دردشة (زبون، قاتم) →', json.dumps(issues, ensure_ascii=False) if issues else '✓ نظيف')
        await page.screenshot(path='/tmp/render/dark-tracking.png')

        # ===== موظف: تفاصيل الطلب مع الدردشة (الوضع القاتم) =====
        for k, v in [('pharmacare_jwt', json.dumps(TOKEN.replace('"', '')))]:
            await page.evaluate(f'localStorage.setItem({json.dumps(k)}, {json.dumps(v)})')
        await page.evaluate('''() => { localStorage.removeItem('pharmacare_currentCustomer') }''')
        user = subprocess.run(['curl', '-s', '-X', 'POST', API + '/api/auth/login',
                               '-H', 'Content-Type: application/json',
                               '-d', '{"username":"pharmacist","password":"Test@10mn"}'], capture_output=True, text=True)
        u = json.loads(user.stdout)['user']
        await page.evaluate(f'localStorage.setItem("pharmacare_user", {json.dumps(json.dumps(u, ensure_ascii=False))})')
        await page.goto(BASE + '/orders', wait_until='domcontentloaded')
        await page.wait_for_timeout(1500)
        card = page.locator('button.card:has-text("CMD-")')
        if await card.count():
            await card.first.click()
            await page.wait_for_timeout(1200)
            issues = await page.evaluate(SCAN)
            print('تفاصيل الطلب + دردشة الموظف (قاتم) →', json.dumps(issues, ensure_ascii=False) if issues else '✓ نظيف')
            await page.screenshot(path='/tmp/render/dark-order-detail.png')
        # ===== نافذة الدفع (الوضع القاتم) =====
        await page.goto(BASE + '/shop', wait_until='domcontentloaded')
        await page.wait_for_timeout(900)
        await page.evaluate('''() => localStorage.setItem('pharmacare_currentCustomer', JSON.stringify({
            id: 'guest-dc2', fullName: 'زبون القاتم', phone: '0677889900', type: 'guest' }))''')
        await page.reload(wait_until='domcontentloaded')
        await page.wait_for_timeout(1000)
        if await page.locator('button.card').count():
            await page.locator('button.card').first.click()
            await page.wait_for_timeout(600)
        add_btn = page.locator('button.btn-primary').filter(has=page.locator('svg.lucide-plus'))
        await add_btn.first.click()
        await page.wait_for_timeout(300)
        await page.locator('button:has(svg.lucide-shopping-cart)').first.click()
        await page.wait_for_timeout(400)
        await page.locator('button.btn-primary.w-full.py-3').first.click()
        await page.wait_for_timeout(500)
        issues = await page.evaluate(SCAN)
        print('نافذة الدفع (قاتم) →', json.dumps(issues, ensure_ascii=False) if issues else '✓ نظيف')
        await page.screenshot(path='/tmp/render/dark-checkout.png')
        await chromium.close()

asyncio.run(main())
