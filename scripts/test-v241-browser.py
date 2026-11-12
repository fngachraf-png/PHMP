# =====================================================================
# PHMP — اختبار متصفح حقيقي v2.4.1 (بالقياس) — مزامنة الرسائل
# ---------------------------------------------------------------------
# السيناريوهات الحرفية للشكوى «خلل مزامنة الرسائل بين الزوار والموظفين
# والموظفين فيما بينهم»:
#   1) موظف↔موظف عبر متصفحين مختلفين (Firefox↔Chromium): كان لا يصل شيء
#      إطلاقاً (غرف DM غير متناظرة + تجاهل to مع room).
#   2) زبون→موظف والدردشة مغلقة عند الموظف: إشعار «رسالة جديدة» + ظهور
#      الرسالة عند فتح الطلب (دفتر الجلسة — كانت تضيع للأبد).
#   3) موظف→زبون والزبون عائد للتسوق: إشعار + ظهور الرسالة عند العودة
#      لتتبع الطلب (كانت تضيع ما لم يبقَ الزبون في شاشة التتبع).
#   4) لا تكرار: الرسالة تظهر مرة واحدة لدى المستقبل.
# =====================================================================
import asyncio, json, re, subprocess, sys, time
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:4173'
API = 'http://127.0.0.1:3102'
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
    page.on('console', lambda m: print(f'    [{browser_name}::{m.type}] {m.text[:160]}') if m.type == 'error' else None)
    page.on('pageerror', lambda e: print(f'    [{browser_name}::PAGEERROR] {str(e)[:200]}'))
    await page.goto(BASE + '/login', wait_until='domcontentloaded')
    await set_local(page, 'pharmacare_api_url', json.dumps(API))
    await set_local(page, 'pharmacare_live_url', json.dumps(API))  # الطبقة "السحابية" = الخادم المعزول محلياً
    return ctx, page

async def login_staff(page, username, password):
    await page.goto(BASE + '/login', wait_until='domcontentloaded')
    await page.fill('input[autocomplete="username"]', username)
    await page.fill('input[autocomplete="current-password"]', password)
    await page.click('button[type="submit"]')
    await page.wait_for_url(re.compile(r'.*dashboard.*'), timeout=20000)

async def open_dm_with(page, colleague_name):
    """فتح لوحة الزملاء ثم دردشة زميل محدد بالاسم (الصف بطاقة rounded-xl)"""
    await page.locator('button[aria-label="التواصل مع الزملاء"]').click()
    await page.wait_for_timeout(800)
    row = page.locator('div.rounded-xl', has=page.locator(f'text="{colleague_name}"')).first
    await row.locator('button[title="الدردشة المباشرة"]').click()
    await page.wait_for_timeout(1000)

async def main():
    async with async_playwright() as pw:
        firefox = await pw.firefox.launch()
        chromium = await pw.chromium.launch()

        print('— 1) موظف↔موظف عبر متصفحين (Firefox↔Chromium): كان لا يصل شيء')
        ctxA, staffA = await new_page(firefox, 'ff-pharmacist')
        await login_staff(staffA, 'pharmacist', 'Test@10mn')
        await staffA.wait_for_timeout(1500)
        okA_jwt = await staffA.evaluate('localStorage.getItem("pharmacare_jwt") !== null')
        ok('دخول الصيدلانية (Firefox)', okA_jwt)

        ctxB, staffB = await new_page(chromium, 'cr-cashier')
        await login_staff(staffB, 'cashier', 'Test@10mn')
        await staffB.wait_for_timeout(1500)
        ok('دخول الكاشير (Chromium)', await staffB.evaluate('localStorage.getItem("pharmacare_jwt") !== null'))

        # الصيدلانية تفتح دردشة الكاشير بالاسم الصريح (يوسف بن علي)
        await open_dm_with(staffA, 'يوسف بن علي')
        inputA = staffA.locator('input[placeholder*="اكتب"]')
        ok('دردشة زميل مفتوحة لدى الصيدلانية', await inputA.count() > 0)
        # الكاشير يفتح دردشة الصيدلانية بالاسم الصريح (فاطمة الزهراء)
        await open_dm_with(staffB, 'فاطمة الزهراء')
        inputB = staffB.locator('input[placeholder*="اكتب"]')
        ok('دردشة زميل مفتوحة لدى الكاشير', await inputB.count() > 0)

        # الصيدلانية ترسل → الكاشير يستقبل (كان مستحيلاً قبل v2.4.1)
        await inputA.first.fill('سلام يا يوسف، تحقق من الطلب الجديد')
        await inputA.first.press('Enter')
        await staffA.wait_for_timeout(1800)
        got_B = await staffB.evaluate('document.body.innerText.includes("تحقق من الطلب الجديد")')
        ok('رسالة الصيدلانية (Firefox) وصلت الكاشير (Chromium)', got_B)

        # الكاشير يرد → الصيدلانية تستقبل
        gotA_before = await staffA.evaluate('document.body.innerText.split("أهلاً، سأتولاه حالاً").length - 1')
        await inputB.first.fill('أهلاً، سأتولاه حالاً')
        await inputB.first.press('Enter')
        await staffB.wait_for_timeout(1800)
        got_A = await staffA.evaluate('document.body.innerText.includes("سأتولاه حالاً")')
        ok('رد الكاشير وصل الصيدلانية (الاتجاه المعاكس)', got_A)
        dupA = await staffA.evaluate('document.body.innerText.split("سأتولاه حالاً").length - 1')
        ok('لا تكرار للرسالة لدى المستقبل', dupA == gotA_before + 1, f'قبل={gotA_before} بعد={dupA}')

        print('— 2) زبون→موظف والدردشة مغلقة عند الموظف: إشعار + ظهور عند الفتح')
        ctxC, cust = await new_page(chromium, 'cr-customer')
        await cust.goto(BASE + '/shop', wait_until='domcontentloaded')
        await cust.wait_for_timeout(1000)
        await cust.evaluate('''() => {
          localStorage.setItem('pharmacare_currentCustomer', JSON.stringify({
            id: 'guest-e2e-v241', fullName: 'زبون المزامنة', phone: '0655112233', type: 'guest' }))
        }''')
        await cust.reload(wait_until='domcontentloaded')
        await cust.wait_for_timeout(1200)
        await cust.locator('button.card').first.click()
        await cust.wait_for_timeout(800)
        add_btn = cust.locator('button.btn-primary').filter(has=cust.locator('svg.lucide-plus'))
        if await add_btn.count() == 0:
            add_btn = cust.locator('button.btn-primary:has(svg)')
        await add_btn.first.click()
        await cust.wait_for_timeout(500)
        await cust.locator('button:has(svg.lucide-shopping-cart)').first.click()
        await cust.wait_for_timeout(600)
        await cust.locator('button.btn-primary.w-full.py-3').first.click()
        await cust.wait_for_timeout(600)
        await cust.locator('button.btn-primary.w-full.py-3').first.click()
        await cust.wait_for_timeout(500)
        await cust.locator('button:has-text("التالي")').first.click()
        await cust.wait_for_timeout(500)
        await cust.locator('button:has-text("إرسال الطلب")').first.click()
        await cust.wait_for_timeout(2500)
        order_num = await cust.evaluate('(document.body.innerText.match(/CMD-\\d+-\\d+/) || [])[0] || ""')
        print(f'    رقم الطلب: {order_num}')
        ok('الطلب أُنشئ (واجهة الزبون)', bool(order_num))

        # الموظفة (Firefox) في /orders ولا تفتح الطلب — الدردشة مغلقة
        await staffA.goto(BASE + '/orders', wait_until='domcontentloaded')
        await staffA.wait_for_timeout(1500)
        seen = await staffA.evaluate(f'document.body.innerText.includes("{order_num}")')
        ok('الطلب ظهر في قائمة الموظفة لحظياً', seen)

        # الزبون يرسل رسالة من دردشة التتبع
        chat_c = cust.locator('input[placeholder*="اكتب"]')
        ok('دردشة التتبع ظاهرة للزبون', await chat_c.count() > 0)
        await chat_c.first.fill('مرحبا، هل الطلب جاهز؟')
        await chat_c.first.press('Enter')
        await cust.wait_for_timeout(2000)

        # الموظفة (بلا دردشة مفتوحة): جرس الإشعارات يظهر «رسالة جديدة» بنصها
        await staffA.locator('button[aria-label="Notifications"]').click()
        await staffA.wait_for_timeout(700)
        notif = await staffA.evaluate('document.body.innerText.includes("رسالة جديدة") && document.body.innerText.includes("مرحبا، هل الطلب جاهز؟")')
        ok('إشعار «رسالة جديدة» لدى الموظفة (دردشة مغلقة)', notif)
        await staffA.screenshot(path=f'{SHOT}/v241-staff-notice.png')
        await staffA.locator('div.fixed.inset-0.z-40').click()  # إغلاق اللوحة (الخلفية)
        await staffA.wait_for_timeout(400)

        # فتح الطلب الآن: الدردشة تترطّب من دفتر الجلسة — الرسالة ظاهرة
        await staffA.locator(f'button.card:has-text("{order_num}")').first.click()
        await staffA.wait_for_timeout(1800)
        hydrated = await staffA.evaluate('document.body.innerText.includes("مرحبا، هل الطلب جاهز؟")')
        ok('رسالة الزبون ظاهرة عند فتح الطلب (ترطيب دفتر الجلسة)', hydrated)
        dup_staff = await staffA.evaluate('document.body.innerText.split("مرحبا، هل الطلب جاهز؟").length - 1')
        ok('الرسالة مرة واحدة حصراً لدى الموظفة', dup_staff == 1, f'عدد={dup_staff}')

        print('— 3) موظف→زبون والزبون عائد للتسوق: إشعار + ظهور عند العودة')
        # الزبون يعود للتسوق (الدردشة تُفكَّك)
        await cust.locator('button:has-text("مواصلة التسوق")').first.click()
        await cust.wait_for_timeout(800)
        # الموظفة ترد من دردشة الطلب المفتوحة
        chat_s = staffA.locator('input[placeholder*="اكتب"]')
        ok('دردشة الطلب مفتوحة لدى الموظفة للرد', await chat_s.count() > 0)
        await chat_s.first.fill('أهلاً، طلبك جاهز للاستلام')
        await chat_s.first.press('Enter')
        await staffA.wait_for_timeout(2000)
        # الزبون في صفحة التسوق: يتلقى الإشعار الصوتي (لا يظهر نصاً) — العودة للتتبع تعرضه
        orders_btn = cust.locator('button[aria-label="طلباتي"]')
        ok('زر «طلباتي» متاح للزبون أثناء التسوق', await orders_btn.count() > 0)
        if await orders_btn.count():
            await orders_btn.first.click()
            await cust.wait_for_timeout(700)
            card = cust.locator(f'button:has-text("{order_num}")').first
            await card.click()
            await cust.wait_for_timeout(1800)
        got_cust = await cust.evaluate('document.body.innerText.includes("طلبك جاهز للاستلام")')
        ok('رد الموظفة ظاهر للزبون بعد عودته للتتبع (ترطيب)', got_cust)
        dup_cust = await cust.evaluate('document.body.innerText.split("طلبك جاهز للاستلام").length - 1')
        ok('رد الموظفة مرة واحدة حصراً لدى الزبون', dup_cust == 1, f'عدد={dup_cust}')

        await staffA.screenshot(path=f'{SHOT}/v241-staff-chat.png')
        await cust.screenshot(path=f'{SHOT}/v241-customer-chat.png')

        # تنظيف
        for ctx in (ctxA, ctxB, ctxC):
            try: await ctx.close()
            except: pass
        try: await firefox.close()
        except: pass
        try: await chromium.close()
        except: pass

    print(f'\n📊 النتيجة: {passed} ناجح، {failed} فاشل')
    sys.exit(1 if failed else 0)

asyncio.run(main())
