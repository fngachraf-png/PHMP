import { useApp } from '../contexts/AppContext'
import PublicLayout from '../components/PublicLayout'
import {
  Smartphone, Download, Globe, Monitor, Chrome, ShieldCheck, CheckCircle2,
  Settings, Search, PackageOpen, TriangleAlert, Wifi, HardDrive, Cpu, CircleCheck
} from 'lucide-react'

// =====================================================================
// التحميل والتثبيت — كيف تحصل على منصة PharmaCare Pro (PHMP)
// 1) نسخة الويب مباشرة على أي جهاز (بدون تثبيت)
// 2) تطبيق أندرويد APK بخطوات تثبيت مفصلة
// =====================================================================

const APK_URL = 'https://phmp-download.pages.dev/PharmaCare-Pro.apk'
const WEB_URL = 'https://phmp.pages.dev/'

const DownloadPage = () => {
  const { t, language } = useApp()
  const L = (ar, fr, en) => language === 'ar' ? ar : language === 'fr' ? fr : en

  // ===== خطوات تثبيت أندرويد =====
  const androidSteps = [
    {
      icon: Download,
      title: L('1. حمّل ملف التطبيق (APK)', '1. Téléchargez le fichier APK', '1. Download the APK file'),
      text: L(
        'اضغط زر «تحميل التطبيق لأندرويد» أعلاه من متصفح هاتفك مباشرة. حجم الملف حوالي 4 ميغابايت فقط، وينتهي التحميل خلال ثوانٍ حتى مع اتصال متواضع.',
        'Appuyez sur le bouton « Télécharger pour Android » ci-dessus depuis le navigateur de votre téléphone. Le fichier ne fait qu\u2019environ 4 Mo, le téléchargement prend quelques secondes même avec une connexion modeste.',
        'Tap the "Download for Android" button above directly from your phone browser. The file is only about 4 MB, and the download finishes within seconds even on a modest connection.'
      ),
    },
    {
      icon: Search,
      title: L('2. افتح الملف من شريط الإشعارات', '2. Ouvrez le fichier depuis la barre de notifications', '2. Open the file from the notification bar'),
      text: L(
        'عند انتهاء التحميل، اسحب شريط الإشعارات واضغط على الملف PharmaCare-Pro.apk. إن لم يظهر، افتح تطبيق «الملفات» ثم مجلد Downloads (التنزيلات) وابحث عنه هناك.',
        'Une fois le téléchargement terminé, tirez la barre de notifications et appuyez sur le fichier PharmaCare-Pro.apk. S\u2019il n\u2019apparaît pas, ouvrez l\u2019application « Fichiers » puis le dossier Downloads et recherchez-le.',
        'When the download completes, pull down the notification bar and tap the PharmaCare-Pro.apk file. If it does not appear, open the "Files" app, go to the Downloads folder and look for it there.'
      ),
    },
    {
      icon: Settings,
      title: L('3. اسمح بالتثبيت من هذا المصدر', '3. Autorisez l\u2019installation depuis cette source', '3. Allow installation from this source'),
      text: L(
        'بما أن التطبيق موقّع رقمياً من مالك المنصة وغير معروض في متجر Play، سيطلب أندرويد إذناً لمرة واحدة: اضغط «الإعدادات» ثم فعّل «السماح من هذا المصدر» (Allow from this source) ثم ارجع واضغط «تثبيت». هذا إجراء قياسي لأي تطبيق خارج المتجر ولا يغيّر إعدادات جهازك الأخرى.',
        'L\u2019application étant signée numériquement par le propriétaire de la plateforme et non publiée sur le Play Store, Android demandera une autorisation unique : appuyez sur « Paramètres », activez « Autoriser depuis cette source », puis revenez et appuyez sur « Installer ». C\u2019est une procédure standard pour toute application hors magasin et cela ne modifie pas vos autres réglages.',
        'Since the app is digitally signed by the platform owner and not listed on the Play Store, Android will ask for a one-time permission: tap "Settings", enable "Allow from this source", then go back and tap "Install". This is standard for any app outside the store and does not change your other device settings.'
      ),
    },
    {
      icon: CircleCheck,
      title: L('4. افتح التطبيق وسجّل الدخول', '4. Ouvrez l\u2019application et connectez-vous', '4. Open the app and sign in'),
      text: L(
        'بعد انتهاء التثبيت اضغط «فتح». تصل مباشرة إلى واجهة المتجر لطلب الدواء، ولدخول الموظفين استعمل زر «دخول الموظفين» بحسابك الرسمي الذي أنشأه مالك المنصة.',
        'Après l\u2019installation, appuyez sur « Ouvrir ». Vous arrivez directement sur la boutique pour commander, et pour l\u2019accès du personnel, utilisez le bouton « Accès personnel » avec votre compte officiel créé par le propriétaire.',
        'After installation, tap "Open". You land directly on the shop to order medicine; for staff access, use the "Staff Login" button with your official account created by the platform owner.'
      ),
    },
  ]

  // ===== أسئلة الشائعة حول التثبيت =====
  const faqs = [
    {
      q: L('لماذا يظهر تحذير «التطبيق غير معروف»؟', 'Pourquoi l\u2019avertissement « application inconnue » ?', 'Why does an "unknown app" warning appear?'),
      a: L(
        'لأن التطبيق يُوزَّع مباشرة من موقع المنصة الرسمي وليس عبر متجر Play. التطبيق موقّع رقمياً بتوقيع ساري 30 سنة باسم مالك المنصة، والتحذير مجرد تنبيه أندرويد القياسي لأي مصدر خارج المتجر. اطمئن وواصل التثبيت بعد السماح من المصدر.',
        'Parce que l\u2019application est distribuée directement depuis le site officiel de la plateforme et non via le Play Store. Elle est signée numériquement avec un certificat valable 30 ans au nom du propriétaire ; l\u2019avertissement n\u2019est que le rappel standard d\u2019Android. Vous pouvez continuer l\u2019installation en toute sécurité.',
        'Because the app is distributed directly from the platform\u2019s official site rather than the Play Store. It is digitally signed with a 30-year certificate in the owner\u2019s name; the warning is just Android\u2019s standard reminder for any source outside the store. It is safe to continue after allowing the source.'
      ),
    },
    {
      q: L('هل أحتاج إلى الإنترنت لاستعمال المنصة؟', 'Ai-je besoin d\u2019Internet pour utiliser la plateforme ?', 'Do I need internet to use the platform?'),
      a: L(
        'لتصفح المتجر وإرسال الطلبات ودخول الموظفين نعم، يلزم اتصال بالإنترنت لأن المنصة متصلة بخادم الصيدلية المحلي عبر نفق آمن. الواجهة نفسها خفيفة جداً وتعمل بسلاسة حتى على شبكات 3G.',
        'Pour parcourir la boutique, envoyer des commandes et la connexion du personnel, oui : une connexion Internet est nécessaire car la plateforme communique avec le serveur local de la pharmacie via un tunnel sécurisé. L\u2019interface est très légère et fonctionne fluidement même en 3G.',
        'For browsing the shop, sending orders and staff sign-in, yes — an internet connection is required because the platform communicates with the pharmacy\u2019s local server through a secure tunnel. The interface itself is very light and runs smoothly even on 3G.'
      ),
    },
    {
      q: L('هل يمكن استعمال المنصة بدون تثبيت أي تطبيق؟', 'Puis-je utiliser la plateforme sans installer d\u2019application ?', 'Can I use the platform without installing any app?'),
      a: L(
        'نعم. المنصة تعمل كاملة من أي متصفح حديث (Chrome / Firefox / Safari / Edge) عبر الرابط الرسمي، وكل الميزات متاحة: التصفح، الطلب، التتبع، والدخول كموظف. التطبيق ليس سوى غلاف أندرويد مريح يفتح نفس المنصة بملء الشاشة وبدون شريط المتصفح.',
        'Oui. La plateforme fonctionne intégralement depuis tout navigateur moderne (Chrome / Firefox / Safari / Edge) via le lien officiel, avec toutes les fonctionnalités : navigation, commande, suivi et accès personnel. L\u2019application n\u2019est qu\u2019une coquille Android pratique qui ouvre la même plateforme en plein écran, sans barre de navigateur.',
        'Yes. The platform works fully in any modern browser (Chrome / Firefox / Safari / Edge) via the official link, with all features: browsing, ordering, tracking and staff access. The app is simply a convenient Android wrapper that opens the same platform full-screen without a browser bar.'
      ),
    },
    {
      q: L('ما هي المتطلبات الدنيا للأندرويد؟', 'Quelles sont les configurations Android minimales ?', 'What are the minimum Android requirements?'),
      a: L(
        'أندرويد 8.0 (Oreo) أو أحدث، حوالي 100 ميغابايت من المساحة الحرة، وأي معالج حديث. التطبيق يعمل أيضاً على الأجهزة الاقتصادية واللوحات الإلكترونية (Tablettes) — وهو مناسب جداً للاستعمال على مكتب الصيدلية.',
        'Android 8.0 (Oreo) ou ultérieur, environ 100 Mo d\u2019espace libre et n\u2019importe quel processeur récent. L\u2019application fonctionne aussi sur les appareils économiques et les tablettes — idéal pour le comptoir de la pharmacie.',
        'Android 8.0 (Oreo) or newer, about 100 MB of free space, and any modern processor. The app also runs on budget devices and tablets — ideal for the pharmacy counter.'
      ),
    },
    {
      q: L('فشل التثبيت — ماذا أفعل؟', 'L\u2019installation échoue — que faire ?', 'Installation failed — what should I do?'),
      a: L(
        'تأكد أولاً أن المساحة كافية (100MB على الأقل) وأن الملف اكتمل تحميله (الحجم النهائي حوالي 4MB وليس 0KB). إن ظهر «التطبيق مثبت بالفعل» فأزل النسخة القديمة من الإعدادات ثم أعد التثبيت. إن استمر الفشل، أعد تحميل الملف من الرابط الرسمي — لا تحمّله من أي مصدر آخر.',
        'Vérifiez d\u2019abord l\u2019espace disponible (au moins 100 Mo) et que le fichier est complet (environ 4 Mo, pas 0 Ko). Si le message « application déjà installée » apparaît, désinstallez l\u2019ancienne version puis réinstallez. En cas d\u2019échec persistant, retéléchargez depuis le lien officiel — jamais depuis une autre source.',
        'First check that you have enough space (at least 100 MB) and that the file fully downloaded (about 4 MB, not 0 KB). If it says "app already installed", remove the old version from settings then reinstall. If it keeps failing, re-download from the official link — never from any other source.'
      ),
    },
  ]

  return (
    <PublicLayout active="download">
      <div className="space-y-6">
        {/* ===== الترويسة ===== */}
        <div className="text-center pt-4">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto shadow-xl shadow-primary-500/30 mb-4">
            <Download className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{t('downloadApp')}</h1>
          <p className="text-gray-600 mt-2 max-w-2xl mx-auto leading-relaxed">
            {L(
              'كل ما تحتاجه للوصول إلى منصة PharmaCare Pro: نسخة الويب الفورية على أي جهاز، أو تطبيق أندرويد رسمي بخطوات تثبيت واضحة خطوة بخطوة.',
              'Tout ce qu\u2019il faut pour accéder à PharmaCare Pro : la version web immédiate sur tout appareil, ou l\u2019application Android officielle avec un guide d\u2019installation pas à pas.',
              'Everything you need to access PharmaCare Pro: the instant web version on any device, or the official Android app with a clear step-by-step installation guide.'
            )}
          </p>
        </div>

        {/* ===== الخيار 1: نسخة الويب ===== */}
        <section className="card p-5 lg:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {L('الخيار الأول: نسخة الويب — بدون تثبيت', 'Option 1 : version web — sans installation', 'Option 1: Web version — no installation')}
              </h2>
              <p className="text-sm text-gray-500">
                {L('تعمل فوراً على أي هاتف أو حاسوب أو لوحة إلكترونية', 'Fonctionne immédiatement sur téléphone, ordinateur ou tablette', 'Works instantly on any phone, computer or tablet')}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            {L(
              'افتح الرابط الرسمي للمنصة في أي متصفح حديث — لا تحتاج إلى تحميل أو تثبيت أي شيء، ولا توجد خطوات تسجيل معقدة للزبناء. كل الميزات متاحة: تصفح الأدوية، إرسال الطلب مع صورة الوصفة، التتبع اللحظي، والدخول كموظف بحسابك الرسمي. لإضافة اختصار يشبه التطبيقات على شاشتك الرئيسية، استعمل خيار «إضافة إلى الشاشة الرئيسية» من قائمة المتصفح.',
              'Ouvrez le lien officiel de la plateforme dans tout navigateur moderne — aucun téléchargement ni installation, ni inscription compliquée pour les clients. Toutes les fonctionnalités sont disponibles : parcours des médicaments, envoi de commande avec photo d\u2019ordonnance, suivi en temps réel et accès personnel. Pour ajouter un raccourci sur votre écran d\u2019accueil, utilisez « Ajouter à l\u2019écran d\u2019accueil » depuis le menu du navigateur.',
              'Open the platform\u2019s official link in any modern browser — no download, no installation, and no complicated sign-up for customers. All features are available: browsing medicines, submitting orders with a prescription photo, real-time tracking, and staff sign-in with your official account. To add an app-like shortcut to your home screen, use "Add to Home Screen" from the browser menu.'
            )}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a href={WEB_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors shadow-lg shadow-blue-500/25">
              <Monitor className="w-5 h-5" />
              {L('افتح نسخة الويب الآن', 'Ouvrir la version web', 'Open the web version')}
            </a>
            <div className="flex items-center gap-2 text-xs text-gray-500 px-3">
              <Chrome className="w-4 h-4" />
              {L('Chrome • Firefox • Safari • Edge', 'Chrome • Firefox • Safari • Edge', 'Chrome • Firefox • Safari • Edge')}
            </div>
          </div>
        </section>

        {/* ===== الخيار 2: تطبيق أندرويد ===== */}
        <section className="card p-5 lg:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {L('الخيار الثاني: تطبيق أندرويد (APK)', 'Option 2 : application Android (APK)', 'Option 2: Android app (APK)')}
              </h2>
              <p className="text-sm text-gray-500">
                {L('موقّع رقمياً رسمياً • ملء الشاشة • حوالي 4MB', 'Signé officiellement • plein écran • environ 4 Mo', 'Officially signed • full screen • about 4 MB')}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            {L(
              'تطبيق أندرويد الرسمي للمنصة يفتح نفس الواجهة بملء الشاشة الكاملة (الوضع الغامر) دون شريط متصفح، مع أداء أسرع وأشعار أوثق. الملف موقّع رقمياً بتوقيع ساري 30 سنة باسم مالك المنصة — حمّله فقط من الرابط الرسمي أدناه.',
              'L\u2019application Android officielle ouvre la même interface en plein écran immersif sans barre de navigateur, avec de meilleures performances. Le fichier est signé numériquement avec un certificat valable 30 ans au nom du propriétaire — téléchargez-le uniquement depuis le lien officiel ci-dessous.',
              'The official Android app opens the same interface in immersive full screen without a browser bar, with faster performance. The file is digitally signed with a 30-year certificate in the owner\u2019s name — download it only from the official link below.'
            )}
          </p>
          <a href={APK_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors shadow-lg shadow-emerald-500/25 mb-2">
            <Download className="w-5 h-5" />
            {L('تحميل التطبيق لأندرويد (APK)', 'Télécharger pour Android (APK)', 'Download for Android (APK)')}
          </a>
          <p className="text-[11px] text-gray-400" dir="ltr">PharmaCare-Pro.apk • v1.3.0+ • ~4 MB • Android 8.0+</p>
        </section>

        {/* ===== خطوات التثبيت ===== */}
        <section className="card p-5 lg:p-6">
          <div className="flex items-center gap-2 mb-5">
            <PackageOpen className="w-6 h-6 text-primary-600" />
            <h2 className="text-xl font-bold text-gray-900">
              {L('خطوات التثبيت على أندرويد', 'Étapes d\u2019installation sur Android', 'Android installation steps')}
            </h2>
          </div>
          <div className="space-y-4">
            {androidSteps.map((step, i) => (
              <div key={i} className="flex gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <step.icon className="w-5 h-5 text-primary-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 text-sm mb-1">{step.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== المتطلبات ===== */}
        <section className="card p-5 lg:p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Cpu className="w-6 h-6 text-primary-600" />
            {L('المتطلبات التقنية', 'Configuration requise', 'Technical requirements')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Smartphone, label: L('أندرويد 8.0 أو أحدث', 'Android 8.0 ou plus récent', 'Android 8.0 or newer') },
              { icon: HardDrive, label: L('100MB مساحة حرة على الأقل', 'Au moins 100 Mo d\u2019espace libre', 'At least 100 MB free space') },
              { icon: Wifi, label: L('اتصال إنترنت (3G تكفي)', 'Connexion Internet (la 3G suffit)', 'Internet connection (3G is enough)') },
            ].map((req, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <req.icon className="w-5 h-5 text-primary-600 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700">{req.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ===== الأسئلة الشائعة ===== */}
        <section className="card p-5 lg:p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary-600" />
            {L('أسئلة شائعة حول التحميل والتثبيت', 'Questions fréquentes sur le téléchargement', 'Download & install FAQ')}
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <details key={i} className="group rounded-xl border border-gray-200 bg-white overflow-hidden">
                <summary className="flex items-center gap-3 p-4 cursor-pointer select-none list-none">
                  <TriangleAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-gray-900 flex-1">{faq.q}</span>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform text-xs">▾</span>
                </summary>
                <div className="px-4 pb-4 pt-0 text-sm text-gray-600 leading-relaxed border-t border-gray-100">
                  <p className="pt-3">{faq.a}</p>
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* ===== ملاحظة أمان ===== */}
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 flex gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="font-bold text-emerald-800 text-sm mb-1">
              {L('مصدر التحميل الرسمي الوحيد', 'Source officielle unique de téléchargement', 'The only official download source')}
            </p>
            <p className="text-sm text-emerald-700 leading-relaxed">
              {L(
                'لا تُحمّل التطبيق أو المنصة من أي رابط آخر غير الروابط المذكورة في هذه الصفحة. أي نسخة من مصدر مجهول قد تكون معدلة وغير موثوقة. الروابط الرسمية: نسخة الويب phmp.pages.dev وتطبيق APK عبر phmp-download.pages.dev.',
                'Ne téléchargez jamais l\u2019application ou la plateforme depuis un autre lien que ceux de cette page. Toute copie d\u2019une source inconnue peut être modifiée. Liens officiels : version web phmp.pages.dev et APK via phmp-download.pages.dev.',
                'Never download the app or platform from any link other than the ones on this page. Copies from unknown sources may be modified. Official links: web version phmp.pages.dev and APK via phmp-download.pages.dev.'
              )}
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}

export default DownloadPage
