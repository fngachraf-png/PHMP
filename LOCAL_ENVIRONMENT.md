# 📘 دليل البيئة المحلية — منصة نظام إدارة الصيدلية فارماسي ماناجمنت پلاتفورم PHMP

> **هذا الملف موجَّه إلى المساعد الآلي المسؤول عن البيئة المحلية** الذي يشرف على قاعدة SQLite المحلية، النفق الدائم، المزامنة، النسخ الاحتياطي، والمراقبة.
> آخر تحديث: v1.4.0 — 2026-10-29.

---

## 🏗️ البنية العامة

```
┌──────────────────────────────┐
│ الواجهة (Cloudflare Pages)   │
│ https://phmp.pages.dev       │
│ (وVercel احتياطي)            │
└──────────────┬───────────────┘
               │ HTTPS + x-phmp-key
               ▼
┌──────────────────────────────┐
│ Worker: phmp-api             │
│ https://phmp-api.            │
│   balbolghol-ai.workers.dev  │
│ (يعيد توجيه كل الطلبات)      │
└──────────────┬───────────────┘
               │ Workers VPC (env.PHMP)
               ▼
┌──────────────────────────────┐
│ VPC Service: phmp-app        │
│ Tunnel: phmp-api             │
└──────────────┬───────────────┘
               │ cloudflared (http2)
               ▼
┌──────────────────────────────┐
│ الخادم المحلي                │
│ Express + SQLite             │
│ 127.0.0.1:3001               │
└──────────────────────────────┘
```

### لماذا Workers VPC؟

حساب Cloudflare المستعمل **لا يملك Zone/نطاقاً مسجلاً**، لذلك لا يمكن ربط `hostname` مخصص بنفق named (`cloudflared tunnel route dns` يفشل). الحل المثبت هو:

- نفق **named** يعطي اتصالاً دائماً (token) بدون نطاق.
- **Workers VPC service** يربط Worker بالنفق عبر معرف الخدمة.
- **Worker** على `workers.dev` يعطي عنوان HTTPS ثابتاً: `https://phmp-api.balbolghol-ai.workers.dev`.

هذا يعطي عنواناً ثابتاً لا يتغير مع إعادة التشغيل، دون الحاجة إلى نطاق.

### المعرّفات (ليست أسراراً)

| العنصر | القيمة |
|---|---|
| حساب Cloudflare | `02fcf95818efed008f495dd6e02c3ef6` |
| Worker | `phmp-api` — `https://phmp-api.balbolghol-ai.workers.dev` |
| VPC Service | `phmp-app` — `01a184a7-cc40-7a01-8dd9-a0f034b2b71e` |
| Tunnel | `phmp-api` — `276f9bee-2dca-491a-8105-a441f7547852` |
| الخادم المحلي | `127.0.0.1:3001` |
| ملفات VPC | `infra/cloudflare/phmp-api/` |

> ⚠️ **التوكن** (`CLOUDFLARE_TUNNEL_TOKEN`) و**مفتاح API** و**JWT_SECRET** أسرار — مكانها `server/.env` بصلاحية 600 فقط، ولا تُرفع إلى Git.

---

## 📋 التنصيب الأولي (مرة واحدة)

### 1) الخادم وقاعدة البيانات

```bash
cd /root/PHMP/server
npm ci                      # better-sqlite3 يحتاج أدوات بناء C++ — وws للاتصال الفوري (v2.0.0+)
cp .env.example .env        # ثم املأ الأسرار (600)
chmod 600 .env

# ملف اعتمادات كلمات المرور (600) — بنية: {"users": {"superadmin": "...", ...}}
export PHMP_SEED_PASSWORDS_FILE=/root/.credentials/phmp.json
npm run seed
```

- **بعد أي `git pull` منذ v2.0.0**: `cd server && npm install` (أضيفت حزمة `ws` لخادم الاتصال الفوري) ثم `phmp-guard.sh restart`.
- قاعدة البيانات: `server/data/phmp.db` (WAL). يمكن تغيير المسار بـ `PHMP_DB_PATH` للاختبارات.
- `npm run seed` يفشل إذا كان `PHMP_SEED_PASSWORDS_FILE` مضبوطاً وينقص مستخدم؛ لا يطبع أي كلمة مرور.
- **لا تشغّل seed على قاعدة إنتاج موجودة** إلا بعد نسخة احتياطية؛ `INSERT OR IGNORE` لا يغيّر كلمات مرور قائمة.

### 2) النفق الدائم

```bash
cd /root/PHMP/server/tunnel
bash setup-tunnel.sh        # يوثّق الإنشاء/deploy؛ لا يعيد إنشاء ما هو موجود
bash start-tunnel.sh        # تشغيل يدوي (الحارس يشغّله عادة)
```

- `start-tunnel.sh` يفضّل `/usr/local/bin/cloudflared` (وليس نسخة npm القديمة) ويستعمل `--metrics 127.0.0.1:20244`.
- النفق يعمل بـ `--protocol http2` لأن QUIC متذبذب على شبكة الهاتف.
- **IPv4 فقط** (`--edge-ip-version 4`): تهيئة ICMPv6 كانت تُعلّق cloudflared بعد سطر `ICMP proxy … IPv4` بلا أي اتصال (حتى 2026-10-31). الخيار يمنع التعليق والاتصال يتم خلال ثوانٍ — لا تُزله.
- بعد التشغيل تحقق: `curl http://127.0.0.1:20244/ready` → 200 (يعني اتصالاً فعلياً بالحافة).

### 3) Worker + VPC

```bash
cd /root/PHMP/infra/cloudflare/phmp-api
npx wrangler deploy
```

- يجب أن تكون خدمة VPC `phmp-app` موجودة مسبقاً في لوحة Cloudflare ومرتبطة بالنفق `phmp-api` والمنفذ `127.0.0.1:3001`.
- الـ binding في `wrangler.toml`: `[[vpc_services]] binding = "PHMP"`.
- Worker يحقن `x-phmp-client-ip` من `cf-connecting-ip` كي يعمل سجل التدقيق وتحديد المعدل على الخادم.

---

## ⚙️ التشغيل اليومي والمراقبة

### الحارس `phmp-guard.sh`

| الأمر | الوظيفة |
|---|---|
| `phmp-guard.sh boot` | ينتظر الشبكة 15ث ثم يشغّل الخادم والنفق إن لم يكونا حيّين |
| `phmp-guard.sh check` | كل 5 دقائق: فحص صحة الخادم + فحص `/ready` للنفق |
| `phmp-guard.sh restart` | إيقاف وإعادة تشغيل الخادم والنفق |
| `phmp-guard.sh status` | حالة الخادم/النفق + آخر 5 أسطر من السجل |

- **النفق يُعتبر حياً فقط إذا أعاد `/ready` الرمز 200**، لا بمجرد وجود العملية. هذا يمنع حالة «عملية مجمّدة بلا اتصال».
- الخادم يُعاد تشغيله بعد **3 فحوص فاشلة متتالية** (~15 دقيقة) لتجنّب الوميض.
- النفق يُعاد تشغيله فوراً عند فشل `/ready` (مع مهلة انتظار 20ث قبل الحكم).

### cron المثبت

```cron
@reboot        /root/.local/bin/phmp-guard.sh boot
*/5 * * * *    /root/.local/bin/phmp-guard.sh check
20 3 * * *     /root/PHMP/server/scripts/backup.sh
```

> على أندرويد/Termux: فعّل `termux-wake-lock` (يفعله `start-tunnel.sh` تلقائياً إن وُجد) وعطّل تحسين البطارية لتطبيق Termux، وإلا قد يقتل النظام الخادم.

### فحص الصحة (من العنوان العام، لا localhost)

```bash
curl -s https://phmp-api.balbolghol-ai.workers.dev/api/health
# {"ok":true,"service":"PHMP Local Server","database":"ok",...}
```

### السجلات

| الملف | المحتوى |
|---|---|
| `server/logs/server.log` | stdout/stderr الخادم |
| `server/logs/tunnel.log` | سجل cloudflared (ابحث عن `Registered tunnel connection`) |
| `server/logs/guard.log` | قرارات الحارس (إقلاع/فشل/إعادة تشغيل) |
| `server/logs/backup.log` | نتائج النسخ الاحتياطي |

---

## 💾 النسخ الاحتياطي والاستعادة

- السكربت: `server/scripts/backup.sh` → يستدعي `server/src/backup.js`.
- الطريقة: `VACUUM INTO` (نسخة ذرية متسقة أثناء التشغيل) ثم `quick_check`.
- المسار: `server/data/backups/phmp-YYYY-MM-DDTHH-MM-SSZ.db`.
- الاحتفاظ: آخر **30** نسخة (الأقدم يُحذف تلقائياً).
- يدوي:

```bash
cd /root/PHMP/server && npm run backup
```

- استعادة:

```bash
/root/.local/bin/phmp-guard.sh stop 2>/dev/null || true
cp server/data/backups/<file>.db server/data/phmp.db
rm -f server/data/phmp.db-wal server/data/phmp.db-shm
/root/.local/bin/phmp-guard.sh restart
```

> لا تنسخ `phmp.db` مباشرة أثناء الكتابة؛ استعمل النسخة الاحتياطية أو أوقف الخادم أولاً.

---

## 🔗 ربط الواجهة

1. افتح المنصة → **الإعدادات ← الخادم المحلي**.
2. عنوان الخادم الافتراضي: `https://phmp-api.balbolghol-ai.workers.dev` (يمكن تركه كما هو).
3. أدخل **مفتاح API** مرة واحدة واضغط حفظ. يُحفظ في `localStorage` لهذا المتصفح فقط.
4. اضغط **مزامنة الآن**.

- مفتاح API **لا يُضمَّن في حزمة الواجهة العامة** (لا يوجد `VITE_PHMP_API_KEY` في CI). هذا مقصود: المفتاح في حزمة عامة يصبح مكشوفاً.
- `VITE_PHMP_API_KEY` مدعوم فقط للبناء المحلي الخاص إن رغبت، ولا يُنصح به للنشر العام.
- إذا ظهر «غير متصل»: تحقق من `/api/health` العام أولاً، ثم من إدخال المفتاح.

---

## 🔌 واجهات API

| الطريقة | المسار | الوصف | الحماية |
|---|---|---|---|
| GET | `/api/health` | فحص الصحة | عام |
| POST | `/api/auth/login` | دخول (JWT + bcrypt) | عام + تحديد معدل 10/15د |
| GET | `/api/users` | قائمة المستخدمين | JWT (أدمن+) |
| POST/PATCH/DELETE | `/api/users[/:id]` | إدارة المستخدمين (إنشاء سوبر أدمين للسوبر أدمين فقط؛ حماية آخر مالك نشط) | JWT (أدمن+) |
| POST | `/api/platform/transfer-ownership` | نقل ملكية المنصة (تأكيد بكلمة المرور الحالية) | JWT (سوبر أدمين) |
| GET | `/api/pharmacies` | قائمة الصيدليات | عام |
| POST | `/api/pharmacies` | إضافة صيدلية | JWT (سوبر أدمين) |
| POST | `/api/sync` | مزامنة كاملة | **x-phmp-key** |
| GET | `/api/data` | استرجاع كل البيانات | **x-phmp-key** |
| GET | `/api/audit` | سجل التدقيق | JWT (سوبر أدمين) |
| GET | `/api/backup` | نسخة احتياطية JSON | **x-phmp-key** |
| **WebSocket** | `/ws` | **الاتصال الفوري**: رسائل/مكالمات/طلبات (ترحيل في الذاكرة فقط — بلا أي تخزين) | مصادقة أول رسالة (JWT للموظفين / ضيف للزبناء) |

> `x-phmp-key` يُرسل في الترويسة. الطلبات بدونه أو بمفتاح خاطئ → **401**. CORS يسمح فقط بأصول `PHMP_ALLOWED_ORIGINS`.

### الاتصال الفوري (WebSocket `/ws`) — منذ v2.0.0

- **المصادقة**: أول رسالة `{type:'auth', token}` للموظفين أو `{type:'auth', guest:{name, phone, pharmacyId}}` للزبناء (مهلة 10 ثوانٍ).
- **ما يُرحَّل (في الذاكرة فقط — لا قاعدة بيانات ولا سجلات)**: دردشة الطلبات (غرف `order:<id>`)، دردشة موظف↔موظف (`to: user:<id>`)، حضور الصيدلية، الطلبات الجديدة وتحديثاتها (`watch-orders`)، وإشارات مكالمات WebRTC (offer/answer/ice/end/reject/taken).
- **المكالمات الصوتية/المرئية**: الوسائط تُستهلك **مباشرة بين المستخدمين** (WebRTC ندّ لند عبر STUN العام)؛ الخادم يرحّل الإشارة فقط. ملاحظة: خلف NAT متماثل صارم قد يلزم خادم TURN مستقبلاً.
- **الحماية**: حد 32KB للرسالة، 30 رسالة/10ث لكل اتصال، مهلة مصادقة، نبض كل 30ث، وإسقاط الاتصالات الميتة.
- **احتياط الواجهة**: عند غياب الخادم تعمل الدردشة عبر BroadcastChannel داخل نفس المتصفح تلقائياً.

---

## 🗄️ مخطط قاعدة البيانات (SQLite)

الجداول: `pharmacies`, `users`, `products`, `customers`, `suppliers`, `prescriptions`, `sales`, `audit_log`, `meta`.

- الملف: `server/data/phmp.db` — الوضع WAL.
- المستخدمون: 8 حسابات (superadmin + 3 مديري صيدليات + محاسب + 2 صيدلاني + كاشير) بكلمات مرور bcrypt.
- سجل التدقيق: كل عملية حساسة مع `ip`, `user_agent`, `action`, `details`, `created_at`.

---

## 🛡️ نموذج الأمان

1. **الأسرار**: `JWT_SECRET` (64 حرفاً) و`PHMP_API_KEY` (53 حرفاً) و`CLOUDFLARE_TUNNEL_TOKEN` في `server/.env` (600). الخادم يفشل سريعاً إذا غاب الأولان.
2. **كلمات المرور**: عُطّلت الافتراضية (`super123`...) ووُلّدت كلمات قوية لكل الحسابات. لا تُكتب في المستودع.
3. **مفتاح API**: يحمي `/api/sync|data|backup` من الفاحصين العشوائيين. **ليس سراً حقيقياً** لأن الموظف يحتاجه في متصفحه؛ الحماية الفعلية للبيانات الحساسة تتطلب ربط الدخول بـ JWT (أولوية قادمة).
4. **JWT**: صلاحية الدخول، الأدوار (RBAC)، وتحديد المعدل.
5. **CORS**: قائمة أصول محددة (`PHMP_ALLOWED_ORIGINS`) بدل `*`.
6. **الترويسات**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` (كاميرا/مايكروفون/موقع مسموحة لنفس الأصل — مطلوبة للمكالمات ومشاركة الموقع)، HSTS عبر Cloudflare.
7. **التدقيق**: IP الحقيقي عبر `x-phmp-client-ip` من Worker؛ لا يُثق بـ `x-forwarded-for` من العميل.
8. **النسخ الاحتياطي**: لا يحتوي طلبات/دردشة/مكالمات (مستثناة عمداً — تُستهلك مباشرة ولا تُخزّن).
9. **سريان الأدوار فورياً**: طبقة المصادقة تعيد قراءة الدور والحالة من SQLite في كل طلب — التخفيض/التوقيف يسري فوراً حتى قبل انتهاء صلاحية رمز JWT (12 ساعة).

> ⚠️ **حدود معروفة**: مفتاح API يظهر في متصفح أي موظف يستعمله، ويمكن استخراجه. لا تعتبره حماية كافية للبيانات الطبية. الخطوة التالية: JWT كامل + صلاحيات لكل مسار.

---

## 🧪 استكشاف الأعطال

| العرض | السبب المحتمل | الحل |
|---|---|---|
| `503` من العنوان العام | النفق بلا اتصال (عملية مجمّدة) | `phmp-guard.sh status` ثم `curl 127.0.0.1:20244/ready`؛ إن فشل: `restart` |
| `502/503` مع `Registered tunnel connection` | الخادم المحلي متوقف | `curl 127.0.0.1:3001/api/health`؛ `phmp-guard.sh check` |
| `401` على `/api/data` | مفتاح API ناقص/خاطئ | أدخل المفتاح في الإعدادات |
| `429` على الدخول | 10 محاولات/15د | انتظر أو أعد تشغيل الخادم (يمسح الذاكرة) |
| `403 error code: 1010` | Cloudflare يحجب User-Agent (Python-urllib) | استعمل curl أو متصفح |
| النفق يعمل لكن `conns: 0` | نسخة cloudflared قديمة/مجمّدة | تأكد من `/usr/local/bin/cloudflared` ≥ 2026.10.4 وأعد التشغيل |
| `better-sqlite3` لا يُبنى | نقص أدوات البناء | `apt install build-essential python3` ثم `npm rebuild` |

### أوامر تشخيص سريعة

```bash
/root/.local/bin/phmp-guard.sh status
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/api/health
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:20244/ready
curl -s -o /dev/null -w '%{http_code}\n' https://phmp-api.balbolghol-ai.workers.dev/api/health
tail -20 /root/PHMP/server/logs/tunnel.log
```

---

## 🔁 التنسيق مع بقية الفريق

> 📘 **ملفات المعرفة المشتركة (إلزامية):**
> - `WORKLOG.md` — سجل العمل وقواعد التنسيق (اقرأه أولاً).
> - `CHANGELOG.md` — سجل التغييرات بالإصدارات.
> - هذا الملف — دليل البيئة المحلية.

- كل إنجاز يُسجَّل في `WORKLOG.md` بمعرّف Task ID.
- أي تعديل على المخطط: حدّث `server/src/db.js` ثم `npm run seed` (على قاعدة اختبار) ووثّق هنا.
- تحديثات الواجهة تصل تلقائياً من `main` عبر Cloudflare Pages.
- عند تحديث الأدوية: المساعد الرئيسي يحدّث `src/data/moroccanDrugs.js` ثم `POST /api/sync`.
- ⚠️ **امتثال**: الطلبات المباشرة والدردشة مستثناة عمداً من أي مزامنة أو نسخ احتياطي (تُستهلك فوراً ولا تُخزَّن — مطلب المالك).
