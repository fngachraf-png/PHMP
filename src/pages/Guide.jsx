import { useApp } from '../contexts/AppContext'
import PublicLayout from '../components/PublicLayout'
import {
  BookOpen, Store, Search, ShoppingCart, UserRoundCheck, Stethoscope, Truck,
  ClipboardList, FileText, Lock, LayoutDashboard, Package, MessageCircle,
  ChevronDown, ChevronUp, Smartphone, Monitor
} from 'lucide-react'
import { useState } from 'react'

// =====================================================================
// دليل الاستخدام — شرح مبسط لكيفية استخدام المنصة (الزبون + الموظف)
// =====================================================================

const Guide = () => {
  const { t, language, isRTL } = useApp()
  const L = (ar, fr, en) => language === 'ar' ? ar : language === 'fr' ? fr : en
  const [openFaq, setOpenFaq] = useState(null)

  const customerSteps = [
    {
      icon: Store,
      title: L('1. اختر صيدليتك', '1. Choisissez votre pharmacie', '1. Choose your pharmacy'),
      text: L(
        'من الصفحة الرئيسية تظهر لك كل الصيدليات المعتمدة في المنصة مع عنوانها ورقم هاتفها ورقم ترخيصها. اضغط على الصيدلية التي تريدها.',
        'La page d\u2019accueil affiche toutes les pharmacies agréées avec adresse, téléphone et numéro de licence. Cliquez sur la pharmacie de votre choix.',
        'The home page shows all licensed pharmacies with their address, phone and license number. Tap the pharmacy you want.'
      ),
    },
    {
      icon: Search,
      title: L('2. ابحث عن دوائك', '2. Recherchez votre médicament', '2. Search for your medicine'),
      text: L(
        'اكتب اسم الدواء أو مادته الفعالة، أو تصفح حسب الفئة العلاجية. الأدوية التي تحمل شارة "بوصفة فقط" تتطلب صورة وصفة طبية.',
        'Tapez le nom du médicament ou sa substance active, ou naviguez par catégorie thérapeutique. Les médicaments portant la mention « Ordonnance uniquement » nécessitent une photo d\u2019ordonnance.',
        'Type the medicine name or active ingredient, or browse by therapeutic category. Medicines marked "Rx only" require a prescription photo.'
      ),
    },
    {
      icon: ShoppingCart,
      title: L('3. أضف إلى السلة وأتمم الطلب', '3. Ajoutez au panier et commandez', '3. Add to cart & checkout'),
      text: L(
        'اضغط زر (+) لإضافة الأدوية للسلة، ثم افتح السلة واضغط "إتمام الطلب". حدد هويتك: زبون عابر (اسم + هاتف فقط) أو مشترك (تسجيل حساب بصورة وثيقة الهوية).',
        'Ajoutez les médicaments au panier avec (+), puis ouvrez le panier et cliquez « Commande ». Choisissez votre identité : invité (nom + téléphone) ou membre (compte avec photo de pièce d\u2019identité).',
        'Add medicines to the cart with (+), then open the cart and tap "Checkout". Choose your identity: guest (name + phone) or member (account with ID document photo).'
      ),
    },
    {
      icon: Stethoscope,
      title: L('4. أرفق الوصفة إن لزم', '4. Joignez l\u2019ordonnance si nécessaire', '4. Attach prescription if needed'),
      text: L(
        'إذا كانت سلتك تحتوي أدوية مقيدة، سيلزمك إرفاق صورة واضحة للوصفة الطبية. يمكنك التقاطها بالكاميرا مباشرة أو اختيار ملف.',
        'Si votre panier contient des médicaments réservés, vous devez joindre une photo claire de l\u2019ordonnance. Prenez-la avec la caméra ou choisissez un fichier.',
        'If your cart contains restricted medicines, you must attach a clear photo of the prescription. Take it with the camera or pick a file.'
      ),
    },
    {
      icon: Truck,
      title: L('5. اختر طريقة التسليم', '5. Choisissez le mode de livraison', '5. Choose delivery method'),
      text: L(
        'ثلاثة خيارات: الاستلام من الصيدلية، تنظيم التوصيل بنفسك، أو التوصيل عبر الصيدلية إلى عنوانك. مصاريف الشحن والتوصيل يتحملها الزبون.',
        'Trois options : retrait en pharmacie, livraison organisée par vous-même, ou livraison par la pharmacie à votre adresse. Les frais de livraison sont à la charge du client.',
        'Three options: pharmacy pickup, self-arranged delivery, or pharmacy delivery to your address. Shipping costs are borne by the customer.'
      ),
    },
    {
      icon: ClipboardList,
      title: L('6. تتبع طلبك مباشرة', '6. Suivez votre commande en direct', '6. Track your order live'),
      text: L(
        'بعد الإرسال يصل طلبك فوراً للصيدلية. تابع حالته لحظة بلحظة: بانتظار القبول ← التحضير ← جاهز/في الطريق ← مكتمل، مع دردشة مباشرة مع الموظف والدفع عند الاستلام.',
        'Après l\u2019envoi, votre commande parvient immédiatement à la pharmacie. Suivez son statut en direct : en attente ← préparation ← prête/en livraison ← terminée, avec chat direct avec l\u2019employé et paiement à la réception.',
        'After sending, your order reaches the pharmacy instantly. Track its status live: pending ← preparing ← ready/dispatched ← completed, with direct chat with staff and payment on delivery.'
      ),
    },
  ]

  const staffSteps = [
    {
      icon: Lock,
      title: L('1. سجل الدخول', '1. Connectez-vous', '1. Sign in'),
      text: L(
        'من زر « دخول الموظفين » أعلى المتجر أو مباشرة عبر الرابط /login. اختر الصيدلية ثم أدخل اسم المستخدم وكلمة المرور. الحسابات التجريبية متاحة لتجربة كل دور.',
        'Depuis le bouton « Espace personnel » en haut de la boutique ou directement via /login. Choisissez la pharmacie puis saisissez identifiant et mot de passe. Des comptes de démonstration sont disponibles pour chaque rôle.',
        'From the "Staff Login" button at the top of the shop or directly via /login. Pick your pharmacy then enter username and password. Demo accounts are available for each role.'
      ),
    },
    {
      icon: LayoutDashboard,
      title: L('2. لوحة التحكم والصلاحيات', '2. Tableau de bord et permissions', '2. Dashboard & permissions'),
      text: L(
        'كل دور يرى ما يحتاجه فقط: المدير كل شيء في صيدليته، الصيدلاني نقطة البيع والوصفات والمخزون، الكاشير نقطة البيع فقط، المحاسب التقارير المالية، ومالك المنصة كل الصيدليات.',
        'Chaque rôle voit uniquement ce dont il a besoin : le gérant tout dans sa pharmacie, le pharmacien la caisse/ordonnances/stock, le caissier la caisse, le comptable les rapports, et le propriétaire toutes les pharmacies.',
        'Each role sees only what it needs: manager everything in their pharmacy, pharmacist POS/prescriptions/inventory, cashier POS only, accountant financial reports, and the platform owner all pharmacies.'
      ),
    },
    {
      icon: Package,
      title: L('3. إدارة المخزون والمبيعات', '3. Gestion du stock et des ventes', '3. Inventory & sales management'),
      text: L(
        'نقطة البيع تدعم الباركود والبحث الفوري مع خصم تلقائي من المخزون. صفحة المخزون تنبهك للأصناف المنخفضة وقرب انتهاء الصلاحية، مع إصدار فاتورة قابلة للطباعة لكل عملية.',
        'Le point de vente prend en charge le code-barres et la recherche instantanée avec déduction automatique du stock. La page stock vous alerte sur les articles faibles et les péremptions proches, avec facture imprimable pour chaque vente.',
        'The POS supports barcode and instant search with automatic stock deduction. The inventory page alerts you on low stock and near-expiry items, with a printable invoice for every sale.'
      ),
    },
    {
      icon: MessageCircle,
      title: L('4. الطلبات المباشرة من الزبناء', '4. Commandes clients en direct', '4. Live customer orders'),
      text: L(
        'الطلبات تصل فورياً مع وميض وعدّاد. طلبات الوصفات تُوجَّه تلقائياً للصيدلاني والباقي للكاشير. راجع صورة الوصفة ووثيقة هوية المشترك، حدد مصاريف التوصيل، ثم أتمم الطلب بإصدار الفاتورة.',
        'Les commandes arrivent instantanément avec clignotement et compteur. Les ordonnances sont routées vers le pharmacien, le reste vers le caissier. Vérifiez la photo d\u2019ordonnance et la pièce d\u2019identité, fixez les frais de livraison, puis finalisez avec la facture.',
        'Orders arrive instantly with flash and counter. Prescriptions are auto-routed to the pharmacist, the rest to the cashier. Review the prescription photo and member ID, set delivery fees, then complete with an invoice.'
      ),
    },
  ]

  const faqs = [
    {
      q: L('كيف أسجل حساباً كزبون مشترك؟', 'Comment créer un compte client membre ?', 'How do I create a member customer account?'),
      a: L(
        'اضغط زر « حسابي » في أعلى المتجر (أو خلال إتمام الطلب) واختر « تسجيل حساب جديد ». ستحتاج: الاسم الكامل، رقم الهاتف، وصورة واضحة لوثيقة الهوية (البطاقة الوطنية أو جواز السفر أو رخصة السياقة). التسجيل يمنحك تتبعاً أسهل لطلباتك السابقة.',
        'Cliquez sur « Mon compte » en haut de la boutique (ou lors de la commande) et choisissez « Créer un compte ». Vous aurez besoin de : nom complet, numéro de téléphone et photo claire de votre pièce d\u2019identité (CIN, passeport ou permis). L\u2019inscription facilite le suivi de vos commandes.',
        'Tap "My Account" at the top of the shop (or during checkout) and choose "Create new account". You\u2019ll need: full name, phone number, and a clear photo of your ID document (CIN, passport or driving license). Registration makes tracking your orders easier.'
      ),
    },
    {
      q: L('هل أحتاج حساباً للطلب؟', 'Ai-je besoin d\u2019un compte pour commander ?', 'Do I need an account to order?'),
      a: L(
        'لا. يمكنك الطلب كزبون عابر بإدخال اسمك ورقم هاتفك فقط عند إتمام الطلب. الحساب المشترك اختياري ويضيف راحة تتبع الطلبات.',
        'Non. Vous pouvez commander en tant que client invité avec simplement votre nom et téléphone lors du paiement. Le compte membre est optionnel et ajoute un confort de suivi.',
        'No. You can order as a guest with just your name and phone at checkout. The member account is optional and adds tracking convenience.'
      ),
    },
    {
      q: L('كيف يدخل الموظفون (مدير/صيدلاني/كاشير)؟', 'Comment le personnel se connecte-t-il ?', 'How do staff (manager/pharmacist/cashier) sign in?'),
      a: L(
        'اضغط زر القفل « دخول الموظفين » في أعلى يمين المتجر، أو افتح الرابط المباشر /login. بعد الدخول تُوجَّه تلقائياً إلى لوحة التحكم حسب صلاحياتك.',
        'Cliquez sur le bouton cadenas « Espace personnel » en haut de la boutique, ou ouvrez directement /login. Après connexion, vous êtes redirigé vers le tableau de bord selon vos permissions.',
        'Tap the lock button "Staff Login" at the top of the shop, or open /login directly. After signing in you\u2019re redirected to the dashboard per your permissions.'
      ),
    },
    {
      q: L('لماذا تُطلب صورة وثيقة الهوية؟', 'Pourquoi une photo de pièce d\u2019identité est demandée ?', 'Why is an ID document photo required?'),
      a: L(
        'التحقق من الهوية إلزامي لصرف الأدوية المقيدة بالوصفة الطبية حسب مدونة الأدوية والصيدلة المغربية (القانون 17.04). الصورة تُستعمل للتحقق فقط وتبقى محفوظة محلياً لدى الصيدلية.',
        'La vérification d\u2019identité est obligatoire pour délivrer les médicaments soumis à ordonnance conformément au code du médicament marocain (loi 17.04). La photo sert uniquement à la vérification et reste stockée localement chez la pharmacie.',
        'Identity verification is mandatory for dispensing prescription-only medicines under the Moroccan Medicines & Pharmacy Code (Law 17.04). The photo is used for verification only and stays stored locally at the pharmacy.'
      ),
    },
    {
      q: L('كيف تُحسب مصاريف التوصيل؟', 'Comment les frais de livraison sont-ils calculés ?', 'How are delivery fees calculated?'),
      a: L(
        'يحددها موظف الصيدلية عند قبول الطلب حسب طريقة التوصيل التي اخترتها والمسافة، وتظهر لك بوضوح في الفاتورة النهائية قبل الدفع عند الاستلام. مصاريف الشحن والتوصيل يتحملها الزبون.',
        'Ils sont fixés par l\u2019employé de la pharmacie à l\u2019acceptation de la commande selon le mode choisi et la distance, et apparaissent clairement sur la facture finale avant le paiement à la réception. Les frais sont à la charge du client.',
        'They are set by pharmacy staff when accepting the order based on your chosen method and distance, and clearly appear on the final invoice before pay-on-delivery. Shipping costs are borne by the customer.'
      ),
    },
    {
      q: L('هل بياناتي وطلباتي محفوظة في خادم خارجي؟', 'Mes données et commandes sont-elles stockées sur un serveur externe ?', 'Are my data and orders stored on an external server?'),
      a: L(
        'لا. الطلبات والدردشة تسير عبر اتصال مباشر بين جهازك والصيدلية وتُستهلك فورياً دون تسجيلها في خادم المنصة. بيانات الإدارة تُحفظ محلياً في جهاز الصيدلية مع إمكانية مزامنتها مع خادمها الخاص فقط.',
        'Non. Les commandes et le chat transitent par une connexion directe entre votre appareil et la pharmacie, consommés en direct sans enregistrement sur nos serveurs. Les données de gestion sont stockées localement chez la pharmacie avec synchronisation optionnelle vers son propre serveur.',
        'No. Orders and chat go through a direct connection between your device and the pharmacy, consumed live without being recorded on the platform\u2019s servers. Management data is stored locally at the pharmacy with optional sync to its own private server only.'
      ),
    },
    {
      q: L('هل يمكن استعمال المنصة على الهاتف؟', 'La plateforme fonctionne-t-elle sur mobile ?', 'Does the platform work on mobile?'),
      a: L(
        'نعم. الواجهة متجاوبة مع كل الشاشات، وهناك تطبيق أندرويد رسمي بوضع ملء الشاشة يمكن تحميله من صفحة التحميل الخاصة بالمنصة.',
        'Oui. L\u2019interface est responsive sur tous les écrans, et une application Android officielle en mode plein écran est disponible sur la page de téléchargement de la plateforme.',
        'Yes. The interface is responsive on all screens, and an official Android app with full-screen mode is available on the platform\u2019s download page.'
      ),
    },
  ]

  return (
    <PublicLayout active="guide">
      <div className="space-y-10">
        {/* مقدمة */}
        <div className="text-center space-y-4 pt-4">
          <div className="w-20 h-20 mx-auto rounded-3xl gradient-primary flex items-center justify-center shadow-xl shadow-primary-500/30">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">{t('howToUse')}</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            {L(
              'دليل مبسط خطوة بخطوة لاستعمال المنصة، للزبناء الراغبين في طلب الدواء، وللموظفين المسيرين للصيدلية.',
              'Un guide simple étape par étape, pour les clients qui commandent des médicaments et pour le personnel qui gère la pharmacie.',
              'A simple step-by-step guide for customers ordering medicine, and for staff managing the pharmacy.'
            )}
          </p>
        </div>

        {/* ===== قسم الزبون ===== */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{L('دليل الزبون: كيف تطلب دواءك؟', 'Guide client : comment commander ?', 'Customer Guide: how to order?')}</h3>
              <p className="text-xs text-gray-500 flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> {L('من الهاتف أو الحاسوب بلا تسجيل إلزامي', 'Depuis mobile ou ordinateur, sans inscription obligatoire', 'From phone or computer, no mandatory signup')}</p>
            </div>
          </div>
          <div className="space-y-3">
            {customerSteps.map((s, i) => (
              <div key={i} className="card p-4 flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <s.icon className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-1">{s.title}</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== قسم الموظف ===== */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{L('دليل الموظف: إدارة الصيدلية', 'Guide personnel : gérer la pharmacie', 'Staff Guide: managing the pharmacy')}</h3>
              <p className="text-xs text-gray-500 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> {L('يتطلب تسجيل دخول بحساب موظف', 'Nécessite une connexion avec un compte personnel', 'Requires a staff account sign-in')}</p>
            </div>
          </div>
          <div className="space-y-3">
            {staffSteps.map((s, i) => (
              <div key={i} className="card p-4 flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <s.icon className="w-5 h-5 text-gray-700" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-1">{s.title}</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== الأسئلة الشائعة ===== */}
        <section>
          <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">{L('الأسئلة الشائعة', 'Questions fréquentes', 'Frequently Asked Questions')}</h3>
          <div className="space-y-2">
            {faqs.map((f, i) => (
              <div key={i} className="card overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-3 p-4 text-start hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-sm text-gray-900">{f.q}</span>
                  {openFaq === i
                    ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* روابط سريعة */}
        <div className="card p-5 bg-gradient-to-br from-primary-50 to-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-gray-700 font-medium">
            {L('جاهز للبدء؟ اطلب دواءك الآن أو اطّلع على حقوقك وسياساتنا.', 'Prêt à commencer ? Commandez vos médicaments ou consultez nos politiques.', 'Ready to start? Order your medicine now or review our policies.')}
          </p>
          <div className="flex gap-2">
            <a href="#/shop" className="btn-primary text-sm">{t('shopTitle')}</a>
            <a href="#/terms" className="btn-secondary text-sm">{t('termsOfUse')}</a>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}

export default Guide
