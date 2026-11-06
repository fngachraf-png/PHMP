# =====================================================================
# PHMP — اختبار متصفح حقيقي متعدد المتصفحات (بالقياس) — v2.4.0
# السيناريوهات الحرفية للشكوى:
#   1) موظف في Firefox + زبون في Chromium: طلب يصل لحظياً بلا إعادة تحميل
#   2) دردشة زبون→موظف ثم موظف→زبون عبر متصفحين مختلفين
#   3) قبول الطلب يصل الزبون لحظياً (تتبع)
#   4) الترجمة: الفرنسية — الأدوار والأصناف بالفرنسية
#   5) الوضع القاتم: لقطات شاشة لصفحات مفاتيح (تُفحص بصرياً)
# =====================================================================
import asyncio, json, sys, re
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:4173'
API = 'http://127.0.0.1:3101'
SHOT = '/tmp/render'

passed, failed = 0, 0
def ok(name, cond, extra=''):
    global passed, failed
    if cond: passed += 1; print(f'  ✅ {name}')
    else: failed += 1; print(f'  ❌ {name} {extra}')

async def set_local(page, key, value):
    await page.evaluate(f'localStorage.setItem({json.dumps(key)}, {json.dumps(value)})')

async def new_page(browser, browser_name, locale='ar'):
    ctx = await browser.new_context(locale=locale)
    page = await ctx.new_page()
    page.on('console', lambda m: print(f'    [{browser_name}::{m.type}] {m.text[:180]}') if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: print(f'    [{browser_name}::PAGEERROR] {str(e)[:220]}'))
    await page.goto(BASE + '/login', wait_until='domcontentloaded')
    await set_local(page, 'pharmacare_api_url', json.dumps(API))
    await set_local(page, 'pharmacare_live_url', json.dumps(API))  # الطبقة "السحابية" = الخادم المعزول محلياً
    return ctx, page

async def login_staff(page, username, password):
    await page.goto(BASE + '/login', wait_until='domcontentloaded')
    await page.fill('input[autocomplete="username"]', username)
    await page.fill('input[autocomplete="current-password"]', password)
    await page.click('button[type="submit"]')
    await page.wait_for_url(re.compile(r'.*dashboard.*'), timeout=15000)

async def main():
    async with async_playwright() as pw:
        firefox = await pw.firefox.launch()
        chromium = await pw.chromium.launch()
        print('— 1) موظف (Firefox) + زبون (Chromium): طلب لحظي بلا إعادة تحميل')

        ctx_f, staff = await new_page(firefox, 'firefox')
        await login_staff(staff, 'pharmacist', 'Test@10mn')
        await staff.goto(BASE + '/orders', wait_until='domcontentloaded')
        await staff.wait_for_timeout(1500)
        staff_online = await staff.evaluate('localStorage.getItem("pharmacare_jwt") !== null')
        ok('دخول الموظف في Firefox', staff_online)

        ctx_c, cust = await new_page(chromium, 'chromium')
        # زبون: متجر → صيدلية → سلة → دفع (مسار واجهة حقيقي كامل)
        await cust.goto(BASE + '/shop', wait_until='domcontentloaded')
        await cust.wait_for_timeout(1000)
        await cust.evaluate('''() => {
          localStorage.setItem('pharmacare_currentCustomer', JSON.stringify({
            id: 'guest-e2e', fullName: 'زبون القياس', phone: '0611223344', type: 'guest' }))
        }''')
        await cust.reload(wait_until='domcontentloaded')
        await cust.wait_for_timeout(1200)
        # اختيار الصيدلية الأولى (بطاقة card)
        await cust.locator('button.card').first.click()
        await cust.wait_for_timeout(800)
        # إضافة أول منتج متاح (زر btn-primary بداخله أيقونة plus)
        add_btn = cust.locator('button.btn-primary').filter(has=cust.locator('svg.lucide-plus'))
        if await add_btn.count() == 0:
            add_btn = cust.locator('button.btn-primary:has(svg)')
        await add_btn.first.click()
        await cust.wait_for_timeout(500)
        # فتح السلة (زر أيقونة عربة) ثم زر إتمام الطلب ذو w-full داخل اللوحة
        await cust.locator('button:has(svg.lucide-shopping-cart)').first.click()
        await cust.wait_for_timeout(600)
        await cust.locator('button.btn-primary.w-full.py-3').first.click()
        await cust.wait_for_timeout(600)
        # الخطوة 1: بطاقة الزبون المُسجّل مسبقاً → متابعة (تقفز للخطوة 3)
        cont = cust.locator('button.btn-primary.w-full.py-3').first
        await cont.click()
        await cust.wait_for_timeout(500)
        # الخطوة 3 (توصيل): زر «التالي»
        await cust.locator('button:has-text("التالي")').first.click()
        await cust.wait_for_timeout(500)
        # الخطوة 4: «إرسال الطلب»
        await cust.locator('button:has-text("إرسال الطلب")').first.click()
        await cust.wait_for_timeout(2500)
        # الطلب وصل موظف Firefox دون أي إعادة تحميل؟
        order_seen = await staff.evaluate('''() => {
          const s = document.body.innerText
          return s.includes('CMD-') && (s.includes('زبون القياس') || s.includes('قيد الانتظار') || s.includes('pending'))
        }''')
        ok('الطلب الجديد ظهر لموظف Firefox لحظياً (بلا إعادة تحميل)', order_seen)
        await staff.screenshot(path=f'{SHOT}/e2e-staff-order-firefox.png')
        # الموظف يحدد الطلب **بالرقم نفسه** من القائمة (يفتح الدردشة — DirectChat مُركّب)
        order_num = await cust.evaluate('(document.body.innerText.match(/CMD-\\d+-\\d+/) || [])[0] || ""')
        print(f'    رقم الطلب: {order_num}')
        order_card = staff.locator(f'button.card:has-text("{order_num}")')
        await order_card.click()
        await staff.wait_for_timeout(1500)
        staff_chat_ready = await staff.locator('input[placeholder*="اكتب"]').count() > 0
        ok('دردشة الطلب مفتوحة لدى الموظف (Firefox)', staff_chat_ready)

        print('— 2) دردشة زبون→موظف ثم موظف→زبون عبر متصفحين')
        # الزبون يفتح تتبع الطلب (OrderTracking) وفيه دردشة
        chat_input_c = cust.locator('input[placeholder*="اكتب"], input[placeholder*="message" i], input[placeholder*="Écrire" i]')
        if await chat_input_c.count() == 0:
            # ربما يحتاج فتح التتبع
            track = cust.locator('button:has-text("تتبع"), a:has-text("طلباتي"), button:has-text("تتبع طلبك")')
            if await track.count():
                await track.first.click()
                await cust.wait_for_timeout(800)
            chat_input_c = cust.locator('input[placeholder*="اكتب"], input[placeholder*="message" i], input[placeholder*="Écrire" i]')
        chat_ok = await chat_input_c.count() > 0
        ok('نافذة الدردشة ظاهرة للزبون', chat_ok)
        if chat_ok:
            await chat_input_c.first.fill('مرحبا، هل الطلب قيد التحضير؟')
            await chat_input_c.first.press('Enter')
            await cust.wait_for_timeout(1500)
            # تشخيص: حالة الاتصال لدى الطرفين
            for label, pg in [('cust', cust), ('staff', staff)]:
                diag = await pg.evaluate('''() => {
                  const badge = [...document.querySelectorAll('span')].map(s => s.innerText).join('¦')
                  return { hasWifi: document.body.innerText.includes('مزامنة حية') || document.body.innerText.includes('Live'),
                           badge: badge.slice(0, 200) }
                }''')
                print(f'    [diag:{label}]', json.dumps(diag, ensure_ascii=False))
            got_staff = await staff.evaluate('document.body.innerText.includes("هل الطلب قيد التحضير")')
            ok('رسالة الزبون (Chromium) وصلت موظف Firefox لحظياً', got_staff)
            # الموظف يرد عبر دردشة الطلب في LiveOrders (افتح الدردشة إن لزم)
            chat_input_s = staff.locator('input[placeholder*="اكتب"], input[placeholder*="message" i], input[placeholder*="Écrire" i]')
            if await chat_input_s.count() == 0:
                open_chat = staff.locator('button:has-text("دردشة"), button[title*="دردشة"]')
                if await open_chat.count():
                    await open_chat.first.click()
                    await staff.wait_for_timeout(600)
                chat_input_s = staff.locator('input[placeholder*="اكتب"], input[placeholder*="message" i], input[placeholder*="Écrire" i]')
            if await chat_input_s.count():
                await chat_input_s.first.fill('أهلاً، جارٍ تحضير طلبك الآن')
                await chat_input_s.first.press('Enter')
                await staff.wait_for_timeout(1200)
                got_cust = await cust.evaluate('document.body.innerText.includes("جارٍ تحضير طلبك")')
                ok('رد الموظف (Firefox) وصل الزبون Chromium لحظياً', got_cust)
            else:
                ok('رد الموظف (Firefox) وصل الزبون Chromium لحظياً', False, 'لا مربع دردشة لدى الموظف')

        print('— 3) قبول الطلب يصل الزبون لحظياً')
        accept = staff.locator('button:has-text("قبول الطلب"), button:has-text("قبول")')
        if await accept.count():
            await accept.first.click()
            await staff.wait_for_timeout(2000)
            cust_status = await cust.evaluate('document.body.innerText.includes("مقبول") || document.body.innerText.includes("قيد التحضير") || document.body.innerText.includes("accepted")')
            ok('تحديث حالة الطلب وصل الزبون لحظياً', cust_status)
        else:
            ok('تحديث حالة الطلب وصل الزبون لحظياً', False, 'زر القبول غير موجود')

        print('— 4) الترجمة الفرنسية: الأدوار والأصناف')
        ctx_fr, fr_page = await new_page(chromium, 'chromium', locale='fr')
        await set_local(fr_page, 'pharmacare_language', json.dumps('fr'))
        jwt_val = (await staff.evaluate('localStorage.getItem("pharmacare_jwt")')).replace('"', '')
        user_val = await staff.evaluate('localStorage.getItem("pharmacare_user")')
        await set_local(fr_page, 'pharmacare_jwt', jwt_val)
        await set_local(fr_page, 'pharmacare_user', user_val)
        await fr_page.goto(BASE + '/dashboard', wait_until='domcontentloaded')
        await fr_page.wait_for_timeout(1800)
        # الشريط الجانبي/الرأس يعرض دور الموظف عبر ROLE_INFO — يجب أن يكون بالفرنسية
        dash_text = await fr_page.evaluate('document.body.innerText')
        role_fr = ('Pharmacien' in dash_text) or ('Comptable' in dash_text) or ('Propriétaire' in dash_text)
        ok('أسماء الأدوار بالفرنسية في واجهة FR', role_fr)
        await fr_page.goto(BASE + '/inventory', wait_until='domcontentloaded')
        await fr_page.wait_for_timeout(1500)
        # فحص خيارات قائمة الأصناف نصياً (options لا تظهر في innerText)
        cat_fr = await fr_page.evaluate('''() => {
          const sel = [...document.querySelectorAll('select')].find(s =>
            [...s.options].some(o => o.value && o.value !== 'all'))
          if (!sel) return ''
          return [...sel.options].map(o => o.textContent).join(' | ')
        }''')
        ok('أصناف المخزون بالفرنسية في واجهة FR',
           any(w in (cat_fr or '') for w in ['Antalgiques', 'Antibiotiques', 'Diabète', 'Autres']),
           f'got: {str(cat_fr)[:120]}')
        await fr_page.screenshot(path=f'{SHOT}/e2e-fr-inventory.png')

        print('— 5) الوضع القاتم: لقطات صفحات المفاتيح (chromium — بجلسة موظف)')
        ctx_d, dark = await new_page(chromium, 'chromium')
        await set_local(dark, 'pharmacare_theme', json.dumps('dark'))
        await set_local(dark, 'pharmacare_jwt', jwt_val)
        await set_local(dark, 'pharmacare_user', user_val)
        contrast_all = []
        for route, name in [('/login', 'login'), ('/dashboard', 'dashboard'), ('/pos', 'pos'),
                            ('/orders', 'orders'), ('/reports', 'reports'), ('/settings', 'settings'),
                            ('/shop', 'shop'), ('/inventory', 'inventory')]:
            await dark.goto(BASE + route, wait_until='domcontentloaded')
            await dark.wait_for_timeout(1600)
            await dark.screenshot(path=f'{SHOT}/dark-{name}.png')
            issues = await dark.evaluate('''() => {
              const issues = []
              for (const el of document.querySelectorAll('body *')) {
                if (el.children.length) continue
                const cs = getComputedStyle(el)
                const m = cs.backgroundColor && cs.backgroundColor.match(/rgba?\\(([\\d.]+), ([\\d.]+), ([\\d.]+)/)
                if (!m) continue
                const lum = 0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]
                const fc = cs.color.match(/rgba?\\(([\\d.]+), ([\\d.]+), ([\\d.]+)/)
                if (!fc) continue
                const flum = 0.299 * +fc[1] + 0.587 * +fc[2] + 0.114 * +fc[3]
                const ratio = (Math.max(lum, flum) + 12) / (Math.min(lum, flum) + 12)
                const visible = el.offsetWidth > 0 && el.offsetHeight > 0 && el.innerText && el.innerText.trim().length > 2
                if (visible && ratio < 2.2) issues.push({ t: el.innerText.slice(0, 30), r: +ratio.toFixed(2) })
              }
              return issues.slice(0, 6)
            }''')
            if issues:
                contrast_all.append({ 'page': name, 'issues': issues })
        print('     مشاكل تباين مرصودة:', json.dumps(contrast_all, ensure_ascii=False) if contrast_all else 'لا شيء')
        ok('لقطات الوضع القاتم التُقطت', True)

        await firefox.close(); await chromium.close()
    print(f'\nالنتيجة: {passed} ناجح / {failed} فاشل')
    sys.exit(1 if failed else 0)

asyncio.run(main())
