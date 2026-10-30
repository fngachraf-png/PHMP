import { useApp } from '../contexts/AppContext'
import PublicLayout from '../components/PublicLayout'
import {
  Stethoscope, Target, Eye, HeartHandshake, ShieldCheck, Users, Store,
  Pill, Zap, Globe, Building2, Phone, Mail, MapPin, BadgeCheck, Sparkles
} from 'lucide-react'

// =====================================================================
// من نحن — تعريف منصة منصة نظام إدارة الصيدلية فارماسي ماناجمنت پلاتفورم PHMP
// =====================================================================

const About = () => {
  const { t, language } = useApp()
  const L = (ar, fr, en) => language === 'ar' ? ar : language === 'fr' ? fr : en

  const stats = [
    { icon: Store, value: '3+', label: L('صيدليات شريكة', 'Pharmacies partenaires', 'Partner pharmacies') },
    { icon: Pill, value: '5917', label: L('دواء في القاعدة الرسمية', 'Médicaments (liste officielle)', 'Drugs (official list)') },
    { icon: Globe, value: '3', label: L('لغات (عربية/فرنسية/إنجليزية)', 'Langues (AR/FR/EN)', 'Languages (AR/FR/EN)') },
    { icon: Users, value: '5', label: L('أدوار مهنية بتدرج صلاحيات', 'Rôles avec permissions', 'Roles with permissions') },
  ]

  const values = [
    {
      icon: ShieldCheck,
      title: L('الأمان والامتثال', 'Sécurité et conformité', 'Security & Compliance'),
      text: L(
        'نلتزم بالقانون 17.04 (مدونة الأدوية والصيدلة) والقانون 09.08 (حماية المعطيات الشخصية)، مع سجل تدقيق كامل لكل العمليات الحساسة داخل الصيدليات.',
        'Nous respectons la loi 17.04 (code du médicament et de la pharmacie) et la loi 09.08 (protection des données personnelles), avec un journal d\u2019audit complet des opérations sensibles.',
        'We comply with Law 17.04 (Medicines & Pharmacy Code) and Law 09.08 (personal data protection), with a full audit trail for sensitive operations.'
      ),
    },
    {
      icon: Zap,
      title: L('الاتصال المباشر الفوري', 'Connexion directe instantanée', 'Instant Direct Connection'),
      text: L(
        'طلبات الزبناء تصل إلى الصيدلية فوراً عبر قناة اتصال مباشر مشفرة محلياً، والدردشة بين الطرفين تُستهلك مباشرة دون تسجيلها في خوادم المنصة؛ خصوصية تامة.',
        'Les commandes clients parviennent instantanément à la pharmacie via un canal direct local, et le chat entre les deux parties est consommé en direct sans être enregistré sur nos serveurs.',
        'Customer orders reach the pharmacy instantly via a local direct channel, and chat between both parties is consumed live without being recorded on our servers.'
      ),
    },
    {
      icon: HeartHandshake,
      title: L('الزبون أولاً', 'Le client d\u2019abord', 'Customer First'),
      text: L(
        'من اختيار الصيدلية إلى تتبع الطلب خطوة بخطوة وصولاً إلى الفاتورة، صممنا كل خطوة لتكون واضحة وبسيطة، باللغة التي يفضلها الزبون.',
        'Du choix de la pharmacie au suivi de la commande étape par étape jusqu\u2019à la facture, chaque étape est conçue pour être claire et simple, dans la langue préférée du client.',
        'From choosing a pharmacy to step-by-step order tracking through to the invoice, every step is designed to be clear and simple, in the customer\u2019s preferred language.'
      ),
    },
    {
      icon: Sparkles,
      title: L('تقنية حديثة وموثوقة', 'Technologie moderne et fiable', 'Modern & Reliable Technology'),
      text: L(
        'تعمل المنصة بنمط مستقل كلياً (كل البيانات في جهازك) مع إمكانية الربط بخادم محلي SQLite خاص بالصيدلية للنسخ الاحتياطي والمزامنة؛ بياناتك تبقى ملكك.',
        'La plateforme fonctionne en mode autonome (données stockées sur votre appareil) avec possibilité de connexion à un serveur local SQLite pour sauvegarde et synchronisation ; vos données restent les vôtres.',
        'The platform runs fully standalone (all data on your device) with optional connection to a local SQLite server for backup and sync; your data stays yours.'
      ),
    },
  ]

  const audiences = [
    {
      icon: Users,
      title: L('للزبناء', 'Pour les clients', 'For Customers'),
      items: L(
        ['اطلب دواءك من صيدليات معتمدة بدون تنقل', 'تتبع طلبك لحظة بلحظة', 'دفع عند الاستلام بلا مخاطر', 'دردشة مباشرة مع الصيدلي'],
        ['Commandez vos médicaments en pharmacie agréée sans vous déplacer', 'Suivez votre commande en temps réel', 'Paiement à la livraison, sans risque', 'Chat direct avec le pharmacien'],
        ['Order medicine from licensed pharmacies without travel', 'Track your order in real time', 'Pay on delivery, no risk', 'Direct chat with the pharmacist']
      ),
    },
    {
      icon: Building2,
      title: L('للصيدليات', 'Pour les pharmacies', 'For Pharmacies'),
      items: L(
        ['نقطة بيع سريعة بالباركود', 'إدارة مخزون وتنبيهات الصلاحية', 'الطلبات المباشرة من الزبناء', 'تقارير مالية ومبيعات شاملة'],
        ['Point de vente rapide avec code-barres', 'Gestion des stocks et alertes de péremption', 'Commandes directes des clients', 'Rapports financiers et ventes complets'],
        ['Fast POS with barcode support', 'Inventory management & expiry alerts', 'Live incoming customer orders', 'Comprehensive financial & sales reports']
      ),
    },
    {
      icon: Stethoscope,
      title: L('للمنظمات الصحية', 'Pour les organisations de santé', 'For Health Organizations'),
      items: L(
        ['إدارة عدة صيدليات من لوحة واحدة', 'أدوار وصلاحيات دقيقة لكل موظف', 'سجل تدقيق لكل العمليات', 'احترام التشريعات المغربية'],
        ['Gestion de plusieurs pharmacies depuis un seul tableau de bord', 'Rôles et permissions précis par employé', 'Journal d\u2019audit de toutes les opérations', 'Respect de la réglementation marocaine'],
        ['Manage multiple pharmacies from one dashboard', 'Precise roles & permissions per employee', 'Audit log of all operations', 'Compliance with Moroccan regulations']
      ),
    },
  ]

  return (
    <PublicLayout active="about">
      <div className="space-y-10">
        {/* مقدمة */}
        <div className="text-center space-y-4 pt-4">
          <div className="w-20 h-20 mx-auto rounded-3xl gradient-primary flex items-center justify-center shadow-xl shadow-primary-500/30">
            <Stethoscope className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">{t('aboutUs')}</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            {L(
              'منصة رقمية مغربية تجمع الصيدليات والزبناء في مكان واحد: إدارة احترافية للصيدلية من الداخل، وتجربة شراء دواء سهلة وآمنة من الخارج.',
              'Une plateforme numérique marocaine qui réunit pharmacies et clients en un seul endroit : gestion professionnelle de la pharmacie en interne, et expérience d\u2019achat de médicaments simple et sûre en externe.',
              'A Moroccan digital platform bringing pharmacies and customers together in one place: professional pharmacy management inside, and a simple, safe medicine-buying experience outside.'
            )}
          </p>
        </div>

        {/* الرسالة والرؤية */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-primary-100 flex items-center justify-center">
                <Target className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="font-bold text-gray-900">{L('رسالتنا', 'Notre mission', 'Our Mission')}</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {L(
                'تسهيل وصول المغاربة إلى الأدوية الأصلية بأسعار رسمية معتمدة، وتمكين الصيادلة من أدوات رقمية حديثة تُدير صيدلياتهم بكفاءة وامتثال تام للقانون.',
                'Faciliter l\u2019accès des Marocains aux médicaments authentiques aux prix officiels agréés, et doter les pharmaciens d\u2019outils numériques modernes pour gérer leurs officines avec efficacité et conformité totale.',
                'Make authentic medicines at official approved prices accessible to Moroccans, and give pharmacists modern digital tools to run their pharmacies efficiently and in full compliance.'
              )}
            </p>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Eye className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-bold text-gray-900">{L('رؤيتنا', 'Notre vision', 'Our Vision')}</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {L(
                'أن نكون المنصة المرجعية لرقمنة الصيدليات في المغرب، بدءاً من الطلب الإلكتروني وصولاً إلى التكامل الكامل مع منظومة الصحة الرقمية الوطنية.',
                'Devenir la plateforme de référence de la digitalisation des pharmacies au Maroc, de la commande en ligne jusqu\u2019à l\u2019intégration complète avec le système national de santé numérique.',
                'To become the reference platform for pharmacy digitization in Morocco, from e-ordering to full integration with the national digital health system.'
              )}
            </p>
          </div>
        </div>

        {/* أرقام */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s, i) => (
            <div key={i} className="card p-4 text-center">
              <s.icon className="w-6 h-6 text-primary-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900" dir="ltr">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* قيمنا */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">{L('قيمنا', 'Nos valeurs', 'Our Values')}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {values.map((v, i) => (
              <div key={i} className="card p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <v.icon className="w-5 h-5 text-primary-600" />
                  </div>
                  <h4 className="font-bold text-gray-900">{v.title}</h4>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{v.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* لمن هذه المنصة */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">{L('لمن هذه المنصة؟', 'À qui s\u2019adresse la plateforme ?', 'Who Is This Platform For?')}</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {audiences.map((a, i) => (
              <div key={i} className="card p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <a.icon className="w-6 h-6 text-primary-600" />
                  <h4 className="font-bold text-gray-900">{a.title}</h4>
                </div>
                <ul className="space-y-2">
                  {a.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                      <BadgeCheck className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* تواصل معنا */}
        <div className="card p-6 bg-gradient-to-br from-primary-50 to-white">
          <h3 className="text-lg font-bold text-gray-900 mb-3">{L('تواصل معنا', 'Contactez-nous', 'Contact Us')}</h3>
          <div className="grid sm:grid-cols-3 gap-3 text-sm text-gray-600">
            <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary-600" /> <span dir="ltr">+212 6 00 00 00 00</span></p>
            <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary-600" /> <span dir="ltr">contact@phmp.ma</span></p>
            <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary-600" /> {L('المغرب', 'Maroc', 'Morocco')}</p>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}

export default About
