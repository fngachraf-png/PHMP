#!/usr/bin/env python3
# =====================================================================
# PHMP — توليد كل أصول اللوغو من ملفي المالك (وضع قاتم + وضع مشع)
# الاستعمال:  python3 scripts/generate-logo-assets.py
#   المدخل :  /home/z/my-project/upload/*.webp  (لوغو داكن + لوغو فاتح)
#   المخرج :  public/* + android-resources/*
# =====================================================================
import os, sys
from collections import deque
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD = '/home/z/my-project/upload'
DARK_SRC = os.path.join(UPLOAD, '8U06tcM-GusKAMEMQEefO5VuwIbj5Dkrj9_TEU98nM8.webp')   # معدني ذهبي → الوضع القاتم
LIGHT_SRC = os.path.join(UPLOAD, 'jeLZ8qfaA7RdSbDEx7T4T063fvwUYkijsxPeokUQaww.webp') # ذهبي مطفي + أزرق مخضر → الوضع المشع

def is_bg(px):
    """بكسل خلفية شبكية (رمادي فاتح 220-255) — لا يمس ألوان اللوغو (ذهبي/أزرق/فضي محاط)."""
    r, g, b = px[:3]
    if abs(r - g) > 14 or abs(g - b) > 14 or abs(r - b) > 14:
        return False
    return r >= 216 and g >= 216 and b >= 216

def _bg_components(im):
    """كل المكوّنات المتصلة المطابقة لخلفية الشطرنج (رمادي فاتح 216+)."""
    w, h = im.size
    px = im.load()
    visited = [[False] * h for _ in range(w)]
    comps = []
    for y in range(h):
        for x in range(w):
            if not visited[x][y] and is_bg(px[x, y]):
                q = deque([(x, y)]); visited[x][y] = True
                pixels = []
                edge = False
                while q:
                    cx, cy = q.popleft(); pixels.append((cx, cy))
                    if cx in (0, w - 1) or cy in (0, h - 1):
                        edge = True
                    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny] and is_bg(px[nx, ny]):
                            visited[nx][ny] = True
                            q.append((nx, ny))
                comps.append((pixels, edge))
    return comps

def _is_checker(px, pixels):
    """هل يُظهر المكوّن تناوب مربعات الشطرنج (نغمتان متعاقبتان)؟
    يحمي العناصر الفنية المصمتة أحادية النغمة (كبسولة بيضاء/أوراق فضية)."""
    if len(pixels) < 12:
        return True  # ثقوب ضيقة بين تفاصيل التصميم
    lum = [sum(px[p][:3]) / 3 for p in pixels]
    a = sum(1 for l in lum if l < 240)
    b = sum(1 for l in lum if l >= 240)
    n = len(lum)
    return a >= 0.15 * n and b >= 0.15 * n

def remove_checkerboard(im):
    """إزالة خلفية الشطرنج: مكوّن الحواف بالكامل + كل المكوّنات المغلقة
    ذات النمط الشبكي المتناوب، ثم تنظيف هالة التنعيم حول الحواف."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    removed = set()
    for pixels, edge in _bg_components(im):
        if edge or _is_checker(px, pixels):
            removed.update(pixels)
    for (x, y) in removed:
        px[x, y] = (0, 0, 0, 0)
    # هالة التنعيم: بكسلات رمادية فاتحة ملاصقة للمنطقة المحذوفة → شفافة
    halo = [(x, y) for (x, y) in removed]
    for (x, y) in list(halo):
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in removed:
                r, g, b = px[nx, ny][:3]
                if abs(r-g) <= 14 and abs(g-b) <= 14 and r >= 200:
                    px[nx, ny] = (0, 0, 0, 0)
                    removed.add((nx, ny))
    return im

def content_bbox(im, pad_ratio=0.04):
    """صندوق المحتوى (بكسلات غير شفافة) مع هامش نسبي."""
    alpha = im.getchannel('A')
    bbox = alpha.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    pad = int(max(r - l, b - t) * pad_ratio)
    l, t = max(0, l - pad), max(0, t - pad)
    r, b = min(im.width, r + pad), min(im.height, b + pad)
    return im.crop((l, t, r, b))

def square_pad(im, size):
    """لوغو مربع: تمركز المحتوى على قماشة مربعة شفافة."""
    im = im.copy()
    side = max(im.width, im.height)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    return canvas.resize((size, size), Image.LANCZOS)

def on_background(im, size, bg=(255, 255, 255, 255), scale=1.0):
    """لوغو على خلفية مصمتة (أيقونات تطبيق/فافيكون) — scale=1.0 يملأ القماشة."""
    side = int(size * 0.86) if scale == 1.0 else int(size * scale)
    logo = im.copy()
    logo.thumbnail((side, side), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), bg)
    canvas.paste(logo, ((size - logo.width) // 2, (size - logo.height) // 2), logo)
    return canvas

def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path)
    print(f'  ✓ {os.path.relpath(path, REPO)}  ({im.width}x{im.height}, {os.path.getsize(path)//1024}KB)')

def adaptive_foreground(im, size):
    """طبقة أمامية للأيقونة التكيفية (Android 8+):
    قماشة 108dp والمنطقة الآمنة دائرة قطرها 66dp (≈61%) —
    اللوغو شفاف الخلفية مشغّل ~53% من القماشة (الطبقة الخلفية بيضاء)
    كي لا تُقتطع أي تفصيلة في أصغر أقنعة المشغّلات (تم التحقق هندسياً)."""
    side = int(size * 0.53)
    logo = im.copy()
    logo.thumbnail((side, side), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.paste(logo, ((size - logo.width) // 2, (size - logo.height) // 2), logo)
    return canvas

def splash_image(im, width, height, logo_ratio=0.30):
    """شاشة البداية: لوغو المنصة على خلفية بيضاء (CENTER_CROP آمن —
    حجم اللوغو نسبة من الضلع الأقصر كي لا يُقتطع في أي اتجاه)."""
    short_side = min(width, height)
    side = int(short_side * logo_ratio)
    logo = im.copy()
    logo.thumbnail((side, side), Image.LANCZOS)
    canvas = Image.new('RGB', (width, height), (255, 255, 255))
    canvas.paste(logo, ((width - logo.width) // 2, (height - logo.height) // 2), logo)
    return canvas

def main():
    print('— تحميل الملفين وفصل الخلفية الشبكية —')
    dark = content_bbox(remove_checkerboard(Image.open(DARK_SRC)))
    light = content_bbox(remove_checkerboard(Image.open(LIGHT_SRC)))
    # معاينة سريعة للتحقق البصري
    for name, im in (('dark', dark), ('light', light)):
        prev = Image.new('RGBA', (560, 280))
        for i, bg in enumerate(((255,255,255,255), (15,23,42,255))):
            tile = Image.new('RGBA', (270, 270), bg)
            tile.paste(im.resize((250,250), Image.LANCZOS), (10,10), im.resize((250,250), Image.LANCZOS))
            prev.paste(tile, (i*280+5, 5))
        prev.convert('RGB').save(f'/tmp/logo/preview-{name}.jpg', quality=88)
        print(f'  معاينة: /tmp/logo/preview-{name}.jpg  (bbox {im.width}x{im.height})')

    P = lambda *p: os.path.join(REPO, 'public', *p)
    print('— لوغوهات الواجهة (شفافة) —')
    save(square_pad(light, 512), P('logo.png'))                       # الوضع المشع
    save(square_pad(dark, 512), P('logo-dark.png'))                   # الوضع القاتم
    save(square_pad(dark, 256), P('logo-watermark.png'))              # علامة مائية على خلفيات فاتحة (معدني = تباين أعلى)
    save(square_pad(dark, 256), P('logo-watermark-dark.png'))         # علامة مائية على خلفيات قاتمة

    print('— فافيكون (مشع افتراضي + قاتم عبر prefers-color-scheme) —')
    for s in (16, 32):
        save(on_background(light, s), P(f'favicon-{s}.png'))
        save(on_background(dark, s), P(f'favicon-dark-{s}.png'))
    ico_sizes = [on_background(light, s) for s in (16, 32, 48)]
    ico_sizes[0].save(P('favicon.ico'), sizes=[(16,16),(32,32),(48,48)], append_images=ico_sizes[1:])
    print(f'  ✓ public/favicon.ico ({os.path.getsize(P("favicon.ico"))//1024}KB)')

    print('— أيقونات PWA / لمس iOS / أندرويد (خلفية بيضاء، منطقة أمان maskable) —')
    save(on_background(light, 180, scale=0.90), P('apple-touch-icon.png'))
    save(on_background(light, 192, scale=0.78), P('icons', 'icon-192.png'))
    save(on_background(light, 512, scale=0.78), P('icons', 'icon-512.png'))
    A = lambda *p: os.path.join(REPO, 'android-resources', *p)
    for dpi, size in (('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)):
        save(on_background(light, size, scale=0.86), A('icons', f'mipmap-{dpi}', 'ic_launcher.png'))
    save(on_background(light, 512, scale=0.86), A('icons', 'icon-512', 'ic_launcher.png'))

    print('— الأيقونة التكيفية Android 8+ (الطبقة الأمامية — إصلاح أيقونة كاباسيتور) —')
    # قماشة 108dp: mdpi=108px … xxxhdpi=432px — المنطقة الآمنة 66dp (61%)
    for dpi, size in (('mdpi',108),('hdpi',162),('xhdpi',216),('xxhdpi',324),('xxxhdpi',432)):
        save(adaptive_foreground(light, size), A('icons', f'mipmap-{dpi}', 'ic_launcher_foreground.png'))
    save(adaptive_foreground(light, 432), A('icons', 'ic_launcher_foreground-432.png'))

    print('— شاشة البداية بشعار المنصة (كل الكثافات عمودي/أفقي) —')
    SPLASHES = {
        'drawable': (480, 320),
        'drawable-land-mdpi': (480, 320), 'drawable-land-hdpi': (800, 480),
        'drawable-land-xhdpi': (1280, 720), 'drawable-land-xxhdpi': (1600, 960),
        'drawable-land-xxxhdpi': (1920, 1280),
        'drawable-port-mdpi': (320, 480), 'drawable-port-hdpi': (480, 800),
        'drawable-port-xhdpi': (720, 1280), 'drawable-port-xxhdpi': (960, 1600),
        'drawable-port-xxxhdpi': (1280, 1920),
    }
    for folder, (w, h) in SPLASHES.items():
        save(splash_image(light, w, h), A('splash', folder, 'splash.png'))
    print('— اكتمل توليد الأصول —')

if __name__ == '__main__':
    main()
