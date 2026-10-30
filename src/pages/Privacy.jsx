import { useApp } from '../contexts/AppContext'
import PublicLayout from '../components/PublicLayout'
import { ShieldCheck, Database, MessageCircle, Lock, UserCheck, FileCheck, Eye, Trash2 } from 'lucide-react'

// =====================================================================
// سياسة الخصوصية — منصة نظام إدارة الصيدلية فارماسي ماناجمنت پلاتفورم PHMP
// مرجعية: القانون 09.08 (حماية الأشخاص الذاتيين تجاه معالجة المعطيات
// ذات الطابع الشخصي) + القانون 43.20 (الخدمات الموثوقة للمعاملات)
// =====================================================================

const Privacy = () => {
  const { t, language } = useApp()
  const L = (ar, fr, en) => language === 'ar' ? ar : language === 'fr' ? fr : en

  const dataBlocks = [
    {
      icon: UserCheck,
      title: L('بيانات الزبون العابر', 'Données du client invité', 'Guest customer data'),
      items: L(
        ['الاسم الكامل (للنداء به)', 'رقم الهاتف (للتواصل بشأن الطلب)'],
        ['Nom complet (pour l\u2019appel)', 'Numéro de téléphone (communication sur la commande)'],
        ['Full name (for addressing)', 'Phone number (order communication)']
      ),
      note: L('تُستعمل خلال جلسة الطلب وتُحفظ في جهاز الزبون فقط.', 'Utilisées durant la session de commande et stockées uniquement sur l\u2019appareil du client.', 'Used during the order session and stored on the customer\u2019s device only.'),
    },
    {
      icon: FileCheck,
      title: L('بيانات الزبون المشترك', 'Données du client membre', 'Member customer data'),
      items: L(
        ['الاسم الكامل + رقم الهاتف', 'صورة وثيقة الهوية (إلزامية للتحقق من الأدوية المقيدة)', 'العنوان (اختياري — للتوصيل)'],
        ['Nom complet + téléphone', 'Photo de pièce d\u2019identité (obligatoire pour les médicaments réservés)', 'Adresse (optionnelle — livraison)'],
        ['Full name + phone number', 'ID document photo (mandatory for restricted medicines)', 'Address (optional — for delivery)']
      ),
      note: L('تُحفظ محلياً لدى الصيدلية لأغراض التحقق القانوني وفق القانون 17.04، ولا تُرسل إلى أي خادم خارجي.', 'Stockées localement chez la pharmacie pour vérification légale selon la loi 17.04 ; aucune transmission à un serveur externe.', 'Stored locally at the pharmacy for legal verification per Law 17.04; never sent to any external server.'),
    },
    {
      icon: FileCheck,
      title: L('الوصفات الطبية', 'Ordonnances médicales', 'Medical prescriptions'),
      items: L(
        ['صورة الوصفة المرفقة عند طلب أدوية مقيدة'],
        ['Photo de l\u2019ordonnance jointe lors d\u2019une commande de médicaments réservés'],
        ['Photo of the prescription attached when ordering restricted medicines']
      ),
      note: L('تبقى محفوظة لدى الصيدلية المختصة وفق مدونة الأدوية والصيدلة، وتُعاين من طرف الصيدلاني قبل الصرف.', 'Conservées par la pharmacie concernée selon le code du médicament et de la pharmacie, et vérifiées par le pharmacien avant délivrance.', 'Kept by the concerned pharmacy per the Medicines & Pharmacy Code, and reviewed by the pharmacist before dispensing.'),
    },
    {
      icon: Database,
      title: L('بيانات التسيير الداخلي للصيدلية', 'Données de gestion interne', 'Internal management data'),
      items: L(
        ['المخزون والمبيعات والعملاء والموردون', 'حسابات الموظفين وأدوارهم وسجل التدقيق'],
        ['Stock, ventes, clients, fournisseurs', 'Comptes du personnel, rôles et journal d\u2019audit'],
        ['Inventory, sales, customers, suppliers', 'Staff accounts, roles and audit log']
      ),
      note: L('تُخزَّن في جهاز الصيدلية (وضع محلي مستقل)، مع إمكانية مزامنتها مع خادم SQLite خاص بالصيدلية نفسها فقط عبر نفق مشفر.', 'Stockées sur l\u2019appareil de la pharmacie (mode autonome), avec synchronisation possible uniquement vers son propre serveur SQLite via un tunnel chiffré.', 'Stored on the pharmacy\u2019s device (standalone mode), with optional sync to the pharmacy\u2019s own SQLite server only via an encrypted tunnel.'),
    },
  ]

  const principles = [
    {
      icon: MessageCircle,
      title: L('الاتصال المباشر بدون تسجيل', 'Connexion directe sans enregistrement', 'Direct connection without recording'),
      text: L(
        'طلبات الزبناء والدردشة تسير عبر قناة اتصال مباشر بين جهاز الزبون وجهاز الصيدلية وتُستهلك فورياً. لا تُسجَّل المحادثات في أي خادم تابع للمنصة ولا في أي قاعدة بيانات مركزية.',
        'Les commandes et le chat transitent par un canal direct entre l\u2019appareil du client et celui de la pharmacie, consommés en direct. Aucune conversation n\u2019est enregistrée sur un serveur de la plateforme ni dans une base centrale.',
        'Customer orders and chat travel through a direct channel between the customer\u2019s and the pharmacy\u2019s devices, consumed live. No conversation is recorded on any platform server or central database.'
      ),
    },
    {
      icon: Lock,
      title: L('التخزين المحلي أولاً', 'Stockage local d\u2019abord', 'Local-first storage'),
      text: L(
        'البنية الافتراضية للمنصة تعمل بدون خادم مركزي: كل البيانات في متصفح المستخدم أو جهاز الصيدلية. المزامنة اختيارية وتتم فقط مع الخادم الخاص بالصيدلية.',
        'L\u2019architecture par défaut fonctionne sans serveur central : toutes les données résident dans le navigateur de l\u2019utilisateur ou l\u2019appareil de la pharmacie. La synchronisation est optionnelle et uniquement vers le serveur propre de la pharmacie.',
        'The platform\u2019s default architecture runs without a central server: all data lives in the user\u2019s browser or the pharmacy\u2019s device. Sync is optional and only to the pharmacy\u2019s own server.'
      ),
    },
    {
      icon: Eye,
      title: L('الحد من الوصول (RBAC)', 'Restriction d\u2019accès (RBAC)', 'Least-privilege access (RBAC)'),
      text: L(
        'داخل الصيدلية، كل موظف لا يرى إلا ما تسمح به صلاحياته: الكاشير لا يطلع على التقارير المالية، والمحاسب لا يصل إلى إدارة الحسابات. كل عملية حساسة تُوثَّق في سجل التدقيق باسم صاحبها وتوقيتها.',
        'Au sein de la pharmacie, chaque employé ne voit que ce que ses permissions autorisent : le caissier n\u2019accède pas aux rapports financiers, le comptable ne gère pas les comptes. Chaque opération sensible est consignée dans le journal d\u2019audit avec nom et horodatage.',
        'Within the pharmacy, each employee sees only what their permissions allow: the cashier cannot view financial reports, the accountant cannot manage accounts. Every sensitive operation is logged in the audit trail with the operator\u2019s name and timestamp.'
      ),
    },
    {
      icon: Trash2,
      title: L('حق الحذف والتصحيح', 'Droit de suppression et de rectification', 'Right to erasure & rectification'),
      text: L(
        'يمكن للزبون حذف بيانات جلسته فوراً عبر زر الخروج في واجهة المتجر. لطلب حذف بيانات الحساب المشترك أو صور الوصفات المحفوظة لدى الصيدلية، يكفي التوجه إلى الصيدلية المعنية التي تلتزم بالاستجابة وفق القانون 09.08.',
        'Le client peut effacer les données de sa session via le bouton de déconnexion. Pour demander la suppression du compte membre ou des photos d\u2019ordonnances conservées par la pharmacie, il suffit de s\u2019adresser à la pharmacie concernée, tenue de répondre conformément à la loi 09.08.',
        'Customers can instantly clear their session data via the logout button in the shop. To request deletion of member account data or prescription photos kept by the pharmacy, simply contact the pharmacy concerned, which must respond per Law 09.08.'
      ),
    },
  ]

  const sections = [
    {
      title: L('1. المرجع القانوني', '1. Cadre juridique', '1. Legal Framework'),
      body: L(
        'تخضع معالجة المعطيات ذات الطابع الشخصي في هذه المنصة للقانون 09.08 (الحماية للأشخاص الذاتيين تجاه معالجة المعطيات ذات الطابع الشخصي) ومرسومه التطبيقي 2.09.165، والقانون 43.20 المتعلق بالخدمات الموثوقة للمعاملات الإلكترونية. يعتمد مبدأنا العام: نجمع الحد الأدنى من البيانات اللازمة لإنجاز الخدمة فقط.',
        'Le traitement des données personnelles sur cette plateforme est régi par la loi 09.08 (protection des personnes physiques à l\u2019égard du traitement des données à caractère personnel) et son décret d\u2019application 2.09.165, ainsi que la loi 43.20 sur les services de confiance pour les transactions électroniques. Notre principe général : collecter le strict minimum nécessaire à la prestation.',
        'Personal data processing on this platform is governed by Law 09.08 (protection of individuals regarding personal data processing) and its implementing Decree 2.09.165, plus Law 43.20 on trusted services for electronic transactions. Our general principle: collect only the strict minimum needed for the service.'
      ),
    },
    {
      title: L('2. ماذا نجمع ولماذا؟', '2. Que collectons-nous et pourquoi ?', '2. What do we collect and why?'),
      body: L(
        'لا نجمع أية بيانات على مستوى مركزي. كل بيانات المنصة تعمل بنمط « محلي أولاً » كما هو مفصل في الجداول أدناه، والغرض من كل عنصر مرتبط مباشرة بالخدمة المطلوبة (إتمام الطلب، التحقق القانوني، أو تسيير الصيدلية).',
        'Nous ne collectons aucune donnée au niveau central. Toutes les données fonctionnent en mode « local d\u2019abord » comme détaillé ci-dessous, chaque élément étant directement lié au service demandé (finalisation de commande, vérification légale ou gestion de pharmacie).',
        'We collect no data at a central level. All platform data operates “local-first” as detailed below, with every element directly tied to the requested service (order completion, legal verification, or pharmacy management).'
      ),
    },
    {
      title: L('3. مشاركة البيانات مع الغير', '3. Partage avec des tiers', '3. Sharing with third parties'),
      body: L(
        'لا تبيع المنصة ولا تؤجر أو تشارك أية بيانات شخصية مع أي طرف ثالث إعلاني أو تجاري. البيانات تنتقل فقط بين الزبون والصيدلية المعنية بطلبه عبر قناة الاتصال المباشر.',
        'La plateforme ne vend, ne loue ni ne partage de données personnelles avec des tiers publicitaires ou commerciaux. Les données transitent uniquement entre le client et la pharmacie concernée par sa commande via le canal direct.',
        'The Platform neither sells, rents, nor shares any personal data with advertising or commercial third parties. Data flows only between the customer and the pharmacy handling their order via the direct channel.'
      ),
    },
    {
      title: L('4. مدة الحفظ', '4. Durée de conservation', '4. Retention period'),
      body: L(
        'بيانات الجلسة عند الزبون تبقى في جهازه حتى يقوم بحذفها أو الخروج. صور الوصفات ووثائق الهوية لدى الصيدلية تُحفَظ للمدة التي تقتضيها النصوص التنظيمية الجاري بها العمل في قطاع الأدوية، ثم تُتلف بأمان.',
        'Les données de session chez le client restent sur son appareil jusqu\u2019à suppression ou déconnexion. Les photos d\u2019ordonnances et pièces d\u2019identité chez la pharmacie sont conservées pendant la durée requise par la réglementation pharmaceutique en vigueur, puis détruites de manière sécurisée.',
        'Session data on the customer\u2019s device remains there until deleted or logged out. Prescription photos and ID documents at the pharmacy are kept for the duration required by pharmaceutical regulations in force, then securely destroyed.'
      ),
    },
    {
      title: L('5. أمن المعلومات', '5. Sécurité de l\u2019information', '5. Information Security'),
      body: L(
        'تعتمد المنصة على نفق مشفر عند الاتصال بخادم الصيدلية الخاص، وكلمات مرور مُعمّاة (bcrypt) في الخادم المحلي، وسجل تدقيق غير قابل للتلاعب لكل العمليات الحساسة. مع ذلك، لا يُعتبَر أي نظام آمناً 100%، لذا نلتزم بإبلاغ الأطراف المعنية في حال أي اختراق مؤكد.',
        'La plateforme s\u2019appuie sur un tunnel chiffré vers le serveur privé de la pharmacie, des mots de passe hachés (bcrypt) sur le serveur local et un journal d\u2019audit inaltérable des opérations sensibles. Néanmoins, aucun système n\u2019est sûr à 100 % ; nous nous engageons à informer les parties concernées en cas de violation confirmée.',
        'The Platform relies on an encrypted tunnel to the pharmacy\u2019s private server, hashed passwords (bcrypt) on the local server, and a tamper-evident audit log of sensitive operations. Still, no system is 100% secure; we commit to notifying affected parties upon any confirmed breach.'
      ),
    },
    {
      title: L('6. حقوقك', '6. Vos droits', '6. Your Rights'),
      body: L(
        'وفق القانون 09.08، لكل شخص الحق في: الاطلاع على معطياته، تصحيحها، حذفها، ومعارضة معالجتها لأسباب مشروعة. لممارسة هذه الحقوق تجاه بيانات الصيدلية، تواصل مع الصيدلية المعنية مباشرة. تجاه بيانات جلستك في المتجر، يمكنك حذفها فوراً بزر الخروج.',
        'Conformément à la loi 09.08, toute personne dispose d\u2019un droit d\u2019accès, de rectification, de suppression et d\u2019opposition pour motif légitime. Pour exercer ces droits sur les données de la pharmacie, contactez directement la pharmacie concernée. Pour les données de votre session boutique, effacez-les instantanément via le bouton de déconnexion.',
        'Under Law 09.08, every person has the right to access, rectify, erase, and object to processing of their data for legitimate reasons. To exercise these rights over pharmacy data, contact the pharmacy directly. For your shop session data, erase it instantly via the logout button.'
      ),
    },
    {
      title: L('7. الأطفال', '7. Mineurs', '7. Minors'),
      body: L(
        'الخدمة موجهة للراشدين. لا يجوز للأشخاص دون 18 سنة إنشاء حساب مشترك إلا بطلب وإشراف من ولي الأمر، وذلك في حدود النصوص الجاري بها العمل.',
        'Le service s\u2019adresse aux majeurs. Les personnes de moins de 18 ans ne peuvent créer un compte membre sauf demande et supervision d\u2019un tuteur légal, dans les limites des textes en vigueur.',
        'The service is aimed at adults. Persons under 18 may not create a member account except upon request and under a legal guardian\u2019s supervision, within the limits of applicable texts.'
      ),
    },
    {
      title: L('8. تحديثات هذه السياسة', '8. Mises à jour de cette politique', '8. Updates to this Policy'),
      body: L(
        'قد نحدث هذه السياسة عند تطوير خدماتنا أو تغير المتطلبات القانونية. سيظهر تاريخ آخر تحديث أعلى الصفحة، والاستمرار في الاستعمال بعد التحديث يعني الموافقة. آخر تحديث: أكتوبر 2026.',
        'Cette politique peut être mise à jour lors de l\u2019évolution de nos services ou des exigences légales. La date de dernière mise à jour figure en haut de page ; la poursuite de l\u2019utilisation vaut acceptation. Dernière mise à jour : octobre 2026.',
        'This policy may be updated as our services or legal requirements evolve. The last-update date appears at the top; continued use constitutes acceptance. Last updated: October 2026.'
      ),
    },
  ]

  return (
    <PublicLayout active="privacy">
      <div className="space-y-6">
        <div className="text-center space-y-4 pt-4">
          <div className="w-20 h-20 mx-auto rounded-3xl gradient-primary flex items-center justify-center shadow-xl shadow-primary-500/30">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">{t('privacyPolicy')}</h2>
          <p className="text-sm text-gray-500">
            {L('آخر تحديث: أكتوبر 2026 — النسخة 1.0', 'Dernière mise à jour : octobre 2026 — Version 1.0', 'Last updated: October 2026 — Version 1.0')}
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800 leading-relaxed">
          {L(
            'مبدؤنا الأساسي: « محلي أولاً ». تعمل هذه المنصة بدون خادم مركزي — طلباتك ومحادثاتك تسير مباشرة إلى الصيدلية وتُستهلك فورياً، وبياناتك تبقى في جهازك أو جهاز الصيدلية المعنية فقط.',
            'Notre principe fondamental : « local d\u2019abord ». Cette plateforme fonctionne sans serveur central — vos commandes et conversations vont directement à la pharmacie et sont consommées en direct ; vos données restent sur votre appareil ou celui de la pharmacie concernée uniquement.',
            'Our core principle: “local-first”. This platform runs without a central server — your orders and chats go directly to the pharmacy and are consumed live; your data stays on your device or the concerned pharmacy\u2019s device only.'
          )}
        </div>

        {/* ماذا نجمع */}
        <section>
          <h3 className="text-lg font-bold text-gray-900 mb-3">{L('ماذا نجمع وكيف يُحفظ؟', 'Que collectons-nous et comment est-ce stocké ?', 'What we collect & how it\u2019s stored')}</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {dataBlocks.map((b, i) => (
              <div key={i} className="card p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <b.icon className="w-4.5 h-4.5 text-primary-600" />
                  </div>
                  <h4 className="font-bold text-sm text-gray-900">{b.title}</h4>
                </div>
                <ul className="space-y-1 mb-2">
                  {b.items.map((item, j) => (
                    <li key={j} className="text-xs text-gray-600 flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0 mt-1.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-gray-400 leading-relaxed border-t border-gray-100 pt-2">{b.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* مبادئنا */}
        <section>
          <h3 className="text-lg font-bold text-gray-900 mb-3">{L('مبادئ حماية الخصوصية عندنا', 'Nos principes de protection de la vie privée', 'Our privacy protection principles')}</h3>
          <div className="space-y-3">
            {principles.map((p, i) => (
              <div key={i} className="card p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <p.icon className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900 mb-1">{p.title}</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{p.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* البنود القانونية */}
        <div className="space-y-4">
          {sections.map((s, i) => (
            <div key={i} className="card p-5">
              <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed text-justify">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  )
}

export default Privacy
