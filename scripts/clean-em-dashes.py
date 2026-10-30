#!/usr/bin/env python3
# =====================================================================
# PHMP — تنظيف المحتوى المعروض من العلامات الزائدة (—)
# تستبدل كل شرطة طويلة معروضة بعلامة ترقيم سليمة حسب اللغة:
#   العربية: «؛» أو «،» أو أقواس  |  الفرنسية: « ;»  |  الإنجليزية: «;» أو «,»
#   الفواصل القصيرة بين عنصرين: «·» (نقطة وسطية)
# كل استبدال مُدقَّق يدوياً ويُتحقق من فرادته قبل الكتابة.
# =====================================================================
import sys, os
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (ملف، [أزواج (قديم، جديد)])
JOBS = {
  # ---------------- i18n: العربية ----------------
  'src/i18n/ar.js': [
    ("الرسمية — يستوجب", "الرسمية؛ يستوجب"),
    ("والصيدلية — صرف الأدوية", "والصيدلية؛ صرف الأدوية"),
    ("بدون تسجيل — أدخل اسمك", "بدون تسجيل؛ أدخل اسمك"),
    ("بنفسك — التكلفة", "بنفسك؛ التكلفة"),
    ("والصيدلية — يُستهلك", "والصيدلية؛ يُستهلك"),
    ("وصفة — يُفضَّل", "وصفة؛ يُفضَّل"),
    ("صيدليتنا — شفاء عاجل", "صيدليتنا، وشفاء عاجل"),
    ("مساعد PHMP — مساعد منصة", "مساعد PHMP، مساعد منصة"),
    ("بالصيدلية — الدردشة", "بالصيدلية؛ الدردشة"),
    ("DCI — حتى مع خطأ إملائي) وسأصححه", "DCI، حتى مع خطأ إملائي) وسأصححه"),
    ("أو الباركود — مثال:", "أو الباركود، مثال:"),
    ("للتعويض — انقر على نتيجة", "للتعويض؛ انقر على نتيجة"),
  ],
  # ---------------- i18n: الإنجليزية ----------------
  'src/i18n/en.js': [
    ("staff accounts — requires", "staff accounts; requires"),
    ("intermediary — medicine dispensing", "intermediary; medicine dispensing"),
    ("No registration — just enter", "No registration; just enter"),
    ("yourself — at your cost", "yourself, at your cost"),
    ("and pharmacy — consumed live", "and pharmacy; consumed live"),
    ("a prescription — pharmacist preferred", "a prescription; pharmacist preferred"),
    ("your trust — wishing", "your trust, wishing"),
    ("PHMP Assistant — assistant of the Pharmacy", "PHMP Assistant, the assistant of the Pharmacy"),
    ("staff member — direct chat", "staff member; direct chat"),
    ("No exact match — here are", "No exact match; here are"),
    ("INN/DCI — even misspelled):", "INN/DCI, even misspelled):"),
    ("or barcode — e.g. doliprane, AUGMENTIN, 61117…", "or barcode (e.g. doliprane, AUGMENTIN, 61117…)"),
    ("medicines list — click a result", "medicines list; click a result"),
  ],
  # ---------------- i18n: الفرنسية ----------------
  'src/i18n/fr.js': [
    ("du personnel — nécessite", "du personnel ; nécessite"),
    ("intermédiaire technique — la délivrance", "intermédiaire technique ; la délivrance"),
    ("Sans inscription — saisissez", "Sans inscription ; saisissez"),
    ("la livraison — à vos frais", "la livraison ; à vos frais"),
    ("et la pharmacie — consommée", "et la pharmacie ; consommée"),
    ("avec ordonnance — à privilégier", "avec ordonnance ; à privilégier"),
    ("votre confiance — prompt rétablissement", "votre confiance et prompt rétablissement"),
    ("l’Assistant PHMP — assistant de", "l’Assistant PHMP, assistant de"),
    ("de la pharmacie — discussion directe", "de la pharmacie ; discussion directe"),
    ("ou DCI — même mal orthographié)", "ou DCI, même mal orthographié)"),
    ("ou code-barres — ex. : doliprane, AUGMENTIN, 61117…", "ou code-barres (ex. : doliprane, AUGMENTIN, 61117…)"),
    ("remboursables — cliquez sur un résultat", "remboursables ; cliquez sur un résultat"),
  ],
  # ---------------- صفحات: فواصل قصيرة بين عنصرين → نقطة وسطية ----------------
  'src/pages/Inventory.jsx': [
    ("text-gray-500\"> — {d.dci}", "text-gray-500\"> · {d.dci}"),
  ],
  'src/pages/Legal.jsx': [
    ("{t('legalOpenSource')} — {ref.sourceLabel}", "{t('legalOpenSource')} · {ref.sourceLabel}"),
  ],
  'src/pages/LiveOrders.jsx': [
    ("{t('viewIdPhoto')} — {t('memberBadge')}", "{t('viewIdPhoto')} · {t('memberBadge')}"),
    ("{t('markCompleted')} — {t('generateInvoice')}", "{t('markCompleted')} · {t('generateInvoice')}"),
  ],
  'src/components/CheckoutModal.jsx': [
    ("👤 {acc.fullName} — <span dir=\"ltr\">", "👤 {acc.fullName} · <span dir=\"ltr\">"),
  ],
  'src/components/CustomerAccountModal.jsx': [
    ("{acc.fullName} — <span dir=\"ltr\">", "{acc.fullName} · <span dir=\"ltr\">"),
  ],
  'src/components/chatbot/PHMPAssistant.jsx': [
    ("+ ' — ' + t('assistantEscalateIntro')", "+ ' · ' + t('assistantEscalateIntro')"),
  ],
  'src/components/PhotoUpload.jsx': [
    ("setError(t('error') + ' — ' +", "setError(t('error') + ' · ' +"),
  ],
  # ---------------- تذييلات الطباعة (تقارير/فواتير) ----------------
  'src/pages/Reports.jsx': [
    ("{t('appName')} — {new Date().getFullYear()}", "{t('appName')} · {new Date().getFullYear()}"),
  ],
  'src/components/InvoicePrint.jsx': [
    ("{t('appName')} — {new Date().getFullYear()}", "{t('appName')} · {new Date().getFullYear()}"),
  ],
  # ---------------- About ----------------
  'src/pages/About.jsx': [
    ("خوادم المنصة — خصوصية تامة.", "خوادم المنصة؛ خصوصية تامة."),
    ("والمزامنة — بياناتك تبقى ملكك.", "والمزامنة؛ بياناتك تبقى ملكك."),
    ("et synchronisation — vos données restent les vôtres.", "et synchronisation ; vos données restent les vôtres."),
    ("backup and sync — your data stays yours.", "backup and sync; your data stays yours."),
    ("'دفع عند الاستلام — بدون مخاطر'", "'دفع عند الاستلام بلا مخاطر'"),
    ("'Paiement à la livraison — sans risque'", "'Paiement à la livraison, sans risque'"),
    ("'Pay on delivery — no risk'", "'Pay on delivery, no risk'"),
  ],
  # ---------------- Guide ----------------
  'src/pages/Guide.jsx': [
    ("لاستعمال المنصة — للزبناء", "لاستعمال المنصة، للزبناء"),
    ("étape par étape — pour les clients", "étape par étape, pour les clients"),
    ("step-by-step guide — for customers", "step-by-step guide for customers"),
    ("'من الهاتف أو الحاسوب — بدون تسجيل إلزامي'", "'من الهاتف أو الحاسوب بلا تسجيل إلزامي'"),
    ("'Depuis mobile ou ordinateur — sans inscription obligatoire'", "'Depuis mobile ou ordinateur, sans inscription obligatoire'"),
    ("'From phone or computer — no mandatory signup'", "'From phone or computer, no mandatory signup'"),
  ],
  # ---------------- Login ----------------
  'src/pages/Login.jsx': [
    ("والمزيد - كل ذلك في مكان واحد.", "والمزيد، كل ذلك في مكان واحد."),
    ("plus encore — tout en un seul endroit.", "plus encore, tout en un seul endroit."),
    ("and more — all in one place.", "and more, all in one place."),
  ],
  # ---------------- Platform ----------------
  'src/pages/Platform.jsx': [
    ("'لوحة تحكم مالك المنصة - إشراف شامل", "'لوحة تحكم مالك المنصة؛ إشراف شامل"),
    ("du propriétaire — supervision complète", "du propriétaire ; supervision complète"),
    ("control panel - full oversight", "control panel; full oversight"),
  ],
  # ---------------- Privacy ----------------
  'src/pages/Privacy.jsx': [
    ("(اختياري — للتوصيل)", "(اختياري، للتوصيل)"),
    ("(optionnelle — livraison)", "(optionnelle, pour la livraison)"),
    ("(optional — for delivery)", "(optional, for delivery)"),
    ("أكتوبر 2026 — النسخة 1.0", "أكتوبر 2026 · النسخة 1.0"),
    ("octobre 2026 — Version 1.0", "octobre 2026 · Version 1.0"),
    ("October 2026 — Version 1.0", "October 2026 · Version 1.0"),
    ("بدون خادم مركزي — طلباتك ومحادثاتك", "بدون خادم مركزي؛ طلباتك ومحادثاتك"),
    ("sans serveur central — vos commandes", "sans serveur central ; vos commandes"),
    ("without a central server — your orders", "without a central server; your orders"),
  ],
  # ---------------- Terms ----------------
  'src/pages/Terms.jsx': [
    ("باستعمالك المنصة — تصفحاً أو طلباً أو إدارةً — فإنك", "باستعمالك المنصة (تصفحاً أو طلباً أو إدارةً) فإنك"),
    ("la plateforme — navigation, commande ou gestion — vous reconnaissez", "la plateforme (navigation, commande ou gestion), vous reconnaissez"),
    ("the Platform — browsing, ordering, or managing — you acknowledge", "the Platform (browsing, ordering, or managing), you acknowledge"),
    ("أكتوبر 2026 — النسخة 1.0", "أكتوبر 2026 · النسخة 1.0"),
    ("octobre 2026 — Version 1.0", "octobre 2026 · Version 1.0"),
    ("October 2026 — Version 1.0", "October 2026 · Version 1.0"),
  ],
  # ---------------- Download ----------------
  'src/pages/Download.jsx': [
    ("yes — an internet connection is required", "yes: an internet connection is required"),
    ("(Tablettes) — وهو مناسب جداً", "(Tablettes)، وهو مناسب جداً"),
    ("et les tablettes — idéal pour le comptoir", "et les tablettes ; idéal pour le comptoir"),
    ("and tablets — ideal for the pharmacy counter.", "and tablets, ideal for the pharmacy counter."),
    ("'فشل التثبيت — ماذا أفعل؟'", "'فشل التثبيت، ماذا أفعل؟'"),
    ("L’installation échoue — que faire ?", "L’installation échoue : que faire ?"),
    ("Installation failed — what should I do?", "Installation failed. What should I do?"),
    ("من الرابط الرسمي — لا تحمّله من أي مصدر آخر.", "من الرابط الرسمي؛ لا تحمّله من أي مصدر آخر."),
    ("depuis le lien officiel — jamais depuis une autre source.", "depuis le lien officiel ; jamais depuis une autre source."),
    ("from the official link — never from any other source.", "from the official link; never from any other source."),
    ("'الخيار الأول: نسخة الويب — بدون تثبيت'", "'الخيار الأول: نسخة الويب بلا تثبيت'"),
    ("version web — sans installation", "version web, sans installation"),
    ("'Option 1: Web version — no installation'", "'Option 1: Web version, no installation'"),
    ("في أي متصفح حديث — لا تحتاج إلى تحميل", "في أي متصفح حديث؛ لا تحتاج إلى تحميل"),
    ("navigateur moderne — aucun téléchargement", "navigateur moderne ; aucun téléchargement"),
    ("modern browser — no download, no installation", "modern browser: no download, no installation"),
    ("باسم مالك المنصة — حمّله فقط من الرابط الرسمي أدناه.", "باسم مالك المنصة؛ حمّله فقط من الرابط الرسمي أدناه."),
    ("au nom du propriétaire — téléchargez-le uniquement", "au nom du propriétaire ; téléchargez-le uniquement"),
    ("in the owner’s name — download it only from the official link below.", "in the owner’s name; download it only from the official link below."),
  ],
  # ---------------- قاعدة معرفة المساعد ----------------
  'src/data/assistantKnowledge.js': [
    ("والتأمين — وتظهر كلها في تقارير", "والتأمين؛ وتظهر كلها في تقارير"),
    ("et assurance — toutes visibles", "et assurance ; toutes visibles"),
    ("and insurance — all reflected", "and insurance; all reflected"),
    ("أو رخصة السياقة) — وهي محفوظة محلياً", "أو رخصة السياقة)، وهي محفوظة محلياً"),
    ("ou permis) — conservée localement", "ou permis) ; conservée localement"),
    ("driving licence) — stored locally", "driving licence); stored locally"),
    ("اسم أي دواء — حتى مع خطأ إملائي — وسأصححه", "اسم أي دواء (حتى مع خطأ إملائي) وسأصححه"),
    ("médicament — même mal orthographié — je le corrige", "médicament (même mal orthographié), je le corrige"),
    ("medicine name — even misspelled — and I will correct it", "medicine name (even misspelled) and I will correct it"),
    ("أو أنظمة علاجية — هذا اختصاص", "أو أنظمة علاجية؛ هذا اختصاص"),
    ("thérapeutiques — cela relève", "thérapeutiques ; cela relève"),
    ("treatment regimens — that is exclusively", "treatment regimens; that is exclusively"),
    ("30/60/90 يوماً — مع فلترة", "30/60/90 يوماً؛ مع فلترة"),
    ("30/60/90 jours — avec filtre", "30/60/90 jours ; avec filtre"),
    ("30/60/90-day expiries — with real time filtering", "30/60/90-day expiries; with real time filtering"),
  ],
}

def main():
    total = ok = 0
    for rel, pairs in JOBS.items():
        path = os.path.join(REPO, rel)
        s = open(path, encoding='utf-8').read()
        for old, new in pairs:
            total += 1
            n = s.count(old)
            if n == 0:
                print(f'  ✗ NOT FOUND in {rel}: {old[:60]}...')
            elif n > 1:
                print(f'  ✗ AMBIGUOUS ({n}x) in {rel}: {old[:60]}...')
            else:
                s = s.replace(old, new)
                ok += 1
        open(path, 'w', encoding='utf-8').write(s)
    print(f'— اكتمل: {ok}/{total} استبدالاً ناجحاً —')
    if ok != total:
        sys.exit(1)

if __name__ == '__main__':
    main()
