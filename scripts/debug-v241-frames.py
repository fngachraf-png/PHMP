# تشخيص حي: التقاط إطارات WebSocket لدى الموظف والزبون
import asyncio, json, re
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:4173'
API = 'http://127.0.0.1:3102'

WS_LOG = '''(() => {
  if (window.__wsPatched) return
  window.__wsPatched = true
  window.__wsLog = []
  const Orig = window.WebSocket
  function Patched(url, ...rest) {
    const ws = new Orig(url, ...rest)
    ws.addEventListener('message', (ev) => {
      try { window.__wsLog.push({ dir: 'in', t: Date.now(), data: String(ev.data).slice(0, 300) }) } catch {}
    })
    const origSend = ws.send.bind(ws)
    ws.send = (d) => { try { window.__wsLog.push({ dir: 'out', t: Date.now(), data: String(d).slice(0, 300) }) } catch {}
      return origSend(d) }
    return ws
  }
  Patched.prototype = Orig.prototype
  Patched.OPEN = Orig.OPEN
  Patched.CLOSED = Orig.CLOSED
  window.WebSocket = Patched
})()'''

async def setup(browser, name, locale='ar'):
    ctx = await browser.new_context(locale=locale)
    page = await ctx.new_page()
    await page.add_init_script(WS_LOG)
    page.on('pageerror', lambda e: print(f'    [{name}::PAGEERROR] {str(e)[:180]}'))
    await page.goto(BASE + '/login', wait_until='domcontentloaded')
    await page.evaluate(f'localStorage.setItem("pharmacare_api_url", {json.dumps(API)})')
    await page.evaluate(f'localStorage.setItem("pharmacare_live_url", {json.dumps(API)})')
    return ctx, page

async def main():
    async with async_playwright() as pw:
        firefox = await pw.firefox.launch()
        chromium = await pw.chromium.launch()
        ctxA, staff = await setup(firefox, 'staff')
        await staff.goto(BASE + '/login')
        await staff.fill('input[autocomplete="username"]', 'pharmacist')
        await staff.fill('input[autocomplete="current-password"]', 'Test@10mn')
        await staff.click('button[type="submit"]')
        await staff.wait_for_url(re.compile(r'.*dashboard.*'), timeout=20000)
        await staff.goto(BASE + '/orders', wait_until='domcontentloaded')
        await staff.wait_for_timeout(1500)

        ctxC, cust = await setup(chromium, 'cust')
        await cust.goto(BASE + '/shop', wait_until='domcontentloaded')
        await cust.wait_for_timeout(800)
        await cust.evaluate('''() => localStorage.setItem('pharmacare_currentCustomer', JSON.stringify({
            id: 'guest-dbg', fullName: 'زبون التشخيص', phone: '0677889900', type: 'guest' }))''')
        await cust.reload(wait_until='domcontentloaded')
        await cust.wait_for_timeout(1200)
        await cust.locator('button.card').first.click()
        await cust.wait_for_timeout(700)
        add_btn = cust.locator('button.btn-primary').filter(has=cust.locator('svg.lucide-plus'))
        if await add_btn.count() == 0: add_btn = cust.locator('button.btn-primary:has(svg)')
        await add_btn.first.click(); await cust.wait_for_timeout(400)
        await cust.locator('button:has(svg.lucide-shopping-cart)').first.click(); await cust.wait_for_timeout(500)
        await cust.locator('button.btn-primary.w-full.py-3').first.click(); await cust.wait_for_timeout(500)
        await cust.locator('button.btn-primary.w-full.py-3').first.click(); await cust.wait_for_timeout(400)
        await cust.locator('button:has-text("التالي")').first.click(); await cust.wait_for_timeout(400)
        await cust.locator('button:has-text("إرسال الطلب")').first.click(); await cust.wait_for_timeout(2500)
        order_num = await cust.evaluate('(document.body.innerText.match(/CMD-\\d+-\\d+/) || [])[0] || ""')
        print('order:', order_num)

        chat_c = cust.locator('input[placeholder*="اكتب"]')
        print('cust chat input count:', await chat_c.count())
        if await chat_c.count():
            await chat_c.first.fill('رسالة تشخيصية')
            await chat_c.first.press('Enter')
            await cust.wait_for_timeout(2500)

        # فحص صفحة الموظف بعد وصول الرسالة
        bell_visible = await staff.locator('button[aria-label="Notifications"]').count()
        badge = await staff.evaluate('''() => {
          const b = document.querySelector('button[aria-label="Notifications"]')
          return b ? b.querySelector('span') !== null : null
        }''')
        print(f'staff: bell={bell_visible} badge={badge}')
        await staff.locator('button[aria-label="Notifications"]').click()
        await staff.wait_for_timeout(600)
        panel_text = await staff.evaluate('document.body.innerText.slice(0, 900)')
        print('staff panel text:', json.dumps(panel_text, ensure_ascii=False)[:500])

        for label, pg in (('staff', staff), ('cust', cust)):
            log = await pg.evaluate('JSON.stringify((window.__wsLog || []).slice(-6))')
            print(f'=== {label} ws frames (last 6) ===')
            for line in json.loads(log):
                print('  ', line['dir'], line['data'][:170])

        for ctx in (ctxA, ctxC):
            try: await ctx.close()
            except: pass
        await firefox.close(); await chromium.close()

asyncio.run(main())
