# مساعد PHMP — Worker خادمي (Cloudflare Workers AI)

واجهة خادمية آمنة يستهلكها شاتبوت «مساعد PHMP» داخل المنصة. يستدعي
نموذجاً **مجانياً** من Cloudflare Workers AI (افتراضياً
`@cf/meta/llama-3.1-8b-instruct-fast`) مع تعليمات نظام صارمة تضمن:

- البقاء داخل سياق المنصة وخدماتها والمجال الصيدلي المغربي حصراً.
- استعمال المعلومات الموثقة الممررة إليه فقط (نمط RAG من قاعدة
  بيانات المنصة وقاعدة معرفتها) — لا اختراع أدوية أو أسعار أو أرقام.
- حذف أي روابط من المخرجات نهائياً (يمنع الروابط الوهمية).
- عدم تقديم جرعات أو خطط علاجية (تحويل للصيدلي/الطبيب).
- الإجابة بلغة المستخدم (ar/fr/en) مهما كانت لغة السؤال.

عند عدم توفر هذا العامل أو فشله، تسقط الواجهة تلقائياً على المحرك
المحلي الحتمي المدمج (بحث الأدوية + قاعدة المعرفة) — فلا يتعطل
المساعد أبداً ولا تتأثر جودة بطاقات الأدوية.

## النشر

يتم تلقائياً عبر سير `.github/workflows/assistant-deploy.yml` عند كل
دفع يعدّل هذا المجلد (يستعمل أسرار `CLOUDFLARE_API_TOKEN` و
`CLOUDFLARE_ACCOUNT_ID` الموجودة مسبقاً في المستودع)، أو يدوياً:

```bash
cd infra/cloudflare/phmp-assistant
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... npx wrangler deploy
```

العنوان بعد النشر: `https://phmp-assistant.<subdomain>.workers.dev`
(مضبوط افتراضياً في `src/lib/assistantLLM.js`).

## نقاط النهاية

| المسار | الوظيفة |
|---|---|
| `POST /` (أو `/ask`) | `{question, history?, lang?, role?, context?}` → `{reply, model}` |
| `GET /health` | فحص الجاهزية |

## تغيير النموذج

عدّل `AI_MODEL` في `[vars]` بـ`wrangler.toml` أو مرّره كمتغير بيئة
عند النشر. مرشّحان مجانيان جاهزان: `@cf/meta/llama-3.1-8b-instruct-fast`
(افتراضي — أفضل عربية) و`@cf/meta/llama-3.2-3b-instruct-fast` (أخف).
