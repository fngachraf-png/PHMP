# فحص تباين دقيق: تركيب الخلفيات الشفافة فوق السطح الداكن #1e293b
# + تفريغ الخصائص المحسوبة لعناصر محددة (دور المستخدم في الشريط الجانبي)
import asyncio, json
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:4173'
API = 'http://127.0.0.1:3101'

COMPOSITE_JS = '''() => {
  const DARK = [30, 41, 59] // #1e293b السطح الداكن الغالب
  const parse = (c) => {
    const m = c && c.match(/rgba?\\(([\\d.]+), ([\\d.]+), ([\\d.]+)(?:, ([\\d.]+))?\\)/)
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null
  }
  const composite = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1,
  })
  const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
  const issues = []
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length) continue
    const cs = getComputedStyle(el)
    const fg = parse(cs.color)
    if (!fg) continue
    // أقرب سلف بغير شفافية كاملة — وإلا السطح الداكن
    let bgNode = el, bg = null
    while (bgNode && bgNode !== document.documentElement) {
      const c = parse(getComputedStyle(bgNode).backgroundColor)
      if (c && c.a > 0.75) { bg = c; break }
      bgNode = bgNode.parentElement
    }
    bg = bg || { r: DARK[0], g: DARK[1], b: DARK[2], a: 1 }
    // تركيب طبقات شبه شفافة فوق السلف
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
    const ratio = (Math.max(L1, L2)) / (Math.min(L1, L2))
    const visible = el.offsetWidth > 0 && el.offsetHeight > 0 && el.innerText && el.innerText.trim().length > 2
    if (visible && ratio < 4.0 && Math.abs(lum(fg) - lum(eff)) > 2) {
      issues.push({ t: el.innerText.slice(0, 32), r: +ratio.toFixed(2), color: cs.color, bgEff: `rgb(${eff.r|0},${eff.g|0},${eff.b|0})` })
    }
  }
  return issues.slice(0, 14)
}'''

DUMP_JS = '''(needle) => {
  const out = []
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length) continue
    if (!el.innerText || !el.innerText.includes(needle)) continue
    const cs = getComputedStyle(el)
    out.push({ text: el.innerText.slice(0, 40), color: cs.color, bg: cs.backgroundColor,
               cls: (el.className || '').toString().slice(0, 120), tag: el.tagName })
  }
  return out.slice(0, 6)
}'''

async def main():
    async with async_playwright() as pw:
        chromium = await pw.chromium.launch()
        ctx = await chromium.new_context()
        page = await ctx.new_page()
        await page.goto(BASE + '/login', wait_until='domcontentloaded')
        for k, v in [('pharmacare_api_url', json.dumps(API)), ('pharmacare_live_url', json.dumps(API)),
                     ('pharmacare_theme', json.dumps('dark')), ('pharmacare_jwt', json.dumps(TOKEN)),
                     ('pharmacare_user', json.dumps(USER_OBJ))]:
            await page.evaluate(f'localStorage.setItem({json.dumps(k)}, {json.dumps(v)})')
        for route in ['/dashboard', '/orders', '/pos', '/inventory', '/reports',
                      '/customers', '/suppliers', '/purchases', '/prescriptions',
                      '/settings', '/guide', '/legal', '/shop', '/login', '/about']:
            await page.goto(BASE + route, wait_until='domcontentloaded')
            await page.wait_for_timeout(1500)
            issues = await page.evaluate(COMPOSITE_JS)
            print(route, '→', json.dumps(issues, ensure_ascii=False) if issues else '✓ بلا مشاكل (<4.0)')
        # تفريغ خصائص عنصر الدور في الشريط الجانبي
        await page.goto(BASE + '/dashboard', wait_until='domcontentloaded')
        await page.wait_for_timeout(1000)
        for needle in ['صيدلاني', 'مدير']:
            info = await page.evaluate(DUMP_JS, needle)
            if info:
                print('عنصر:', needle, '→', json.dumps(info, ensure_ascii=False))
        await chromium.close()

import subprocess
res = subprocess.run(['curl', '-s', '-X', 'POST', API + '/api/auth/login',
                      '-H', 'Content-Type: application/json',
                      '-d', '{"username":"pharmacist","password":"Test@10mn"}'], capture_output=True, text=True)
data = json.loads(res.stdout)
TOKEN = data['token']
USER_OBJ = json.dumps(data['user'], ensure_ascii=False)
asyncio.run(main())
