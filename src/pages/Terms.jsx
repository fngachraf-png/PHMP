import { useApp } from '../contexts/AppContext'
import PublicLayout from '../components/PublicLayout'
import { FileText, CircleCheck } from 'lucide-react'

// =====================================================================
// شروط الاستخدام — منصة نظام إدارة الصيدلية فارماسي ماناجمنت پلاتفورم PHMP
// مرجعية: القانون 31.08 (المعاملات الإلكترونية) + 09.08 (حماية المعطيات)
// + 17.04 (مدونة الأدوية والصيدلة) + 53.05 (التبادل الإلكتروني للمعطيات)
// =====================================================================

const Terms = () => {
  const { t, language } = useApp()
  const L = (ar, fr, en) => language === 'ar' ? ar : language === 'fr' ? fr : en

  const sections = [
    {
      title: L('1. التعريفات', '1. Définitions', '1. Definitions'),
      body: L(
        '« المنصة »: تطبيق منصة نظام إدارة الصيدلية فارماسي ماناجمنت پلاتفورم PHMP الرقمي لإدارة الصيدليات وطلب الأدوية. « الصيدلية »: صيدلية مرخصة لها من طرف الوزارة المكلفة بالصحة ومسجلة في المنصة. « الزبون »: كل شخص يطلب دواء عبر واجهة المتجر سواء كزبون عابر أو مشترك. « الموظف »: كل شخص يعمل داخل الصيدلية بحساب وصلاحيات محددة (مدير، صيدلاني، كاشير، محاسب). « المالك »: المشغل الرقمي للمنصة.',
        '« La plateforme » : l\u2019application منصة نظام إدارة الصيدلية فارماسي ماناجمنت پلاتفورم PHMP de gestion de pharmacies et de commande de médicaments. « La pharmacie » : officine agréée par le Ministère de la Santé et inscrite sur la plateforme. « Le client » : toute personne commandant un médicament via la boutique, invité ou membre. « L\u2019employé » : toute personne travaillant dans la pharmacie avec un compte et des permissions (gérant, pharmacien, caissier, comptable). « Le propriétaire » : l\u2019opérateur numérique de la plateforme.',
        '“The Platform”: the منصة نظام إدارة الصيدلية فارماسي ماناجمنت پلاتفورم PHMP digital application for pharmacy management and medicine ordering. “The Pharmacy”: a pharmacy licensed by the Ministry of Health and registered on the Platform. “The Customer”: any person ordering medicine via the shop interface, guest or member. “The Staff”: any person working within the pharmacy with an account and defined permissions (manager, pharmacist, cashier, accountant). “The Owner”: the platform’s digital operator.'
      ),
    },
    {
      title: L('2. قبول الشروط', '2. Acceptation des conditions', '2. Acceptance of Terms'),
      body: L(
        'باستعمالك المنصة (تصفحاً أو طلباً أو إدارةً) فإنك تقر بمطالعتك لهذه الشروط وقبولها كاملة. إذا لم توافق على أي بند منها، يرجى التوقف عن استعمال المنصة. تحتفظ إدارة المنصة بحق تحديث هذه الشروط في أي وقت، ويُعتبَر استمرار الاستعمال بعد التحديث قبولاً للنسخة الجديدة.',
        'En utilisant la plateforme (navigation, commande ou gestion), vous reconnaissez avoir lu et accepté l\u2019intégralité de ces conditions. Si vous n\u2019acceptez pas une clause, veuillez cesser d\u2019utiliser la plateforme. L\u2019administration se réserve le droit de mettre à jour ces conditions à tout moment ; la poursuite de l\u2019utilisation vaut acceptation de la nouvelle version.',
        'By using the Platform (browsing, ordering, or managing), you acknowledge having read and accepted these Terms in full. If you disagree with any clause, please stop using the Platform. The administration reserves the right to update these Terms at any time; continued use after an update constitutes acceptance of the new version.'
      ),
    },
    {
      title: L('3. طبيعة الخدمة', '3. Nature du service', '3. Nature of the Service'),
      body: L(
        'المنصة وسيط تقني رقمي يربط الزبناء بالصيدليات المرخصة، ولا تُقدَّم من خلالها استشارات طبية إطلاقاً. الطلب الإلكتروني للأدوية لا يُغني عن الاستشارة الطبية عند الحاجة. صرف الأدوية يبقى خاضعاً حصراً للترسانة التنظيمية الجاري بها العمل، لاسيما القانون 17.04 المتعلق بمدونة الأدوية والصيدلة ومرسوم التسعير رقم 2.13.852. الأسعار المعروضة هي أسعار البيع العمومي الرسمية بالدرهم المغربي.',
        'La plateforme est un intermédiaire technique reliant les clients aux pharmacies agréées et ne fournit aucune consultation médicale. La commande en ligne de médicaments ne remplace pas une consultation médicale lorsque nécessaire. La délivrance des médicaments reste soumise exclusivement à la réglementation en vigueur, notamment la loi 17.04 (code du médicament) et le décret de tarification n° 2.13.852. Les prix affichés sont les prix de vente publics officiels en dirhams.',
        'The Platform is a technical intermediary connecting customers to licensed pharmacies and provides no medical consultation whatsoever. Online medicine ordering does not replace medical consultation when needed. Medicine dispensing remains exclusively governed by applicable regulations, notably Law 17.04 (Medicines & Pharmacy Code) and pricing Decree 2.13.852. Displayed prices are the official public sale prices in Moroccan dirhams.'
      ),
    },
    {
      title: L('4. التزامات الزبون', '4. Obligations du client', '4. Customer Obligations'),
      body: L(
        'يجب على الزبون: (أ) تقديم اسم كامل ورقم هاتف صحيحين؛ (ب) إرفاق صورة واضحة وصحيحة للوصفة الطبية عند طلب أدوية مقيدة، وإرفاق صورة وثيقة هوية صحيحة عند التسجيل كزبون مشترك؛ (ج) الالتزام بخيار التسليم المختار وتحمل مصاريف الشحن والتوصيل المعلن عنها في الفاتورة؛ (د) الدفع عند الاستلام وفق المبلغ الإجمالي بالفاتورة. كل معلومة خاطئة أو مضللة تعرّض صاحبها لإلغاء الطلب وفق القوانين الجاري بها العمل.',
        'Le client doit : (a) fournir un nom complet et un numéro de téléphone valides ; (b) joindre une photo claire et authentique de l\u2019ordonnance pour les médicaments réservés, et une pièce d\u2019identité authentique pour l\u2019inscription en tant que membre ; (c) respecter le mode de livraison choisi et supporter les frais de livraison indiqués sur la facture ; (d) payer à la réception le montant total de la facture. Toute information fausse ou trompeuse expose son auteur à l\u2019annulation de la commande conformément aux lois en vigueur.',
        'The customer must: (a) provide a valid full name and phone number; (b) attach a clear, authentic prescription photo when ordering restricted medicines, and an authentic ID document photo when registering as a member; (c) honor the chosen delivery option and bear the shipping costs stated on the invoice; (d) pay on delivery per the total invoice amount. Any false or misleading information exposes its author to order cancellation under applicable laws.'
      ),
    },
    {
      title: L('5. الأدوية والوصفات الطبية', '5. Médicaments et ordonnances', '5. Medicines & Prescriptions'),
      body: L(
        'الأدوية المقيدة بوصفة طبية (P) لا تُصرف إلا بعد تحقق الصيدلاني من الوصفة الطبية المرفقة ومن هوية الزبون، طبقاً للقانون 17.04. تحتفظ الصيدلية بحق رفض أي طلب لا تتوفر فيه الشروط التنظيمية، أو عند الاشتباه في طلب غير مشروع، مع إشعار الزبون. صور الوصفات ووثائق الهوية تبقى محفوظة لدى الصيدلية وفق المقتضيات القانونية ولا تُستعمل في أي غرض آخر.',
        'Les médicaments soumis à ordonnance (P) ne sont délivrés qu\u2019après vérification par le pharmacien de l\u2019ordonnance jointe et de l\u2019identité du client, conformément à la loi 17.04. La pharmacie se réserve le droit de refuser toute commande ne remplissant pas les conditions réglementaires ou en cas de suspicion de demande illicite, avec notification au client. Les photos d\u2019ordonnances et de pièces d\u2019identité restent conservées par la pharmacie selon les exigences légales et ne servent à aucune autre fin.',
        'Prescription-only medicines (P) are dispensed only after the pharmacist verifies the attached prescription and the customer\u2019s identity, per Law 17.04. The pharmacy reserves the right to refuse any order not meeting regulatory conditions, or upon suspicion of an unlawful request, with notification to the customer. Prescription and ID photos remain kept by the pharmacy per legal requirements and are used for no other purpose.'
      ),
    },
    {
      title: L('6. الأسعار والفاتورة والدفع', '6. Prix, facture et paiement', '6. Prices, Invoice & Payment'),
      body: L(
        'الأسعار المعروضة بالدرهم المغربي (MAD) هي الأسعار الرسمية المعتمدة. تُصدر الصيدلية فاتورة تفصيلية عند إتمام الطلب تتضمن: اسم الصيدلية وعنوانها ورقم ترخيصها، جدول الأدوية بالكميات والأسعار، مصاريف التوصيل، والمبلغ الإجمالي المستحق. طريقة الدفع المعتمدة حالياً هي الدفع عند الاستلام/التوصيل. يمكن للصيدلية تطبيق تعويضات التأمين الإلزامي (AMO) وفق القانون 65.00 عند اقتضاء الأمر.',
        'Les prix affichés en dirhams marocains (MAD) sont les prix officiels agréés. La pharmacie émet une facture détaillée à la finalisation de la commande incluant : nom, adresse et numéro de licence de la pharmacie, tableau des médicaments avec quantités et prix, frais de livraison et montant total dû. Le paiement à la réception/livraison est actuellement le mode accepté. La pharmacie peut appliquer les remboursements AMO selon la loi 65.00 le cas échéant.',
        'Displayed prices in Moroccan dirhams (MAD) are the official approved prices. The pharmacy issues a detailed invoice on order completion including: pharmacy name, address and license number, medicine table with quantities and prices, delivery fees, and the total amount due. Pay-on-delivery is the currently accepted method. The pharmacy may apply mandatory insurance (AMO) reimbursements under Law 65.00 where applicable.'
      ),
    },
    {
      title: L('7. التوصيل', '7. Livraison', '7. Delivery'),
      body: L(
        'خيارات التسليم: الاستلام الشخصي من مقر الصيدلية، أو التوصيل الذي ينظمه الزبون بنفسه، أو التوصيل عبر الصيدلية إلى العنوان المقدم. تحدد الصيدلية مصاريف التوصيل حسب المسافة وطريقة التسليم، وتظهر بشفافية في الفاتورة قبل الدفع. المنصة غير مسؤولة عن تأخيرات خارج عن إرادة الصيدلية. مصاريف الشحن والتوصيل يتحملها الزبون في كل الأحوال.',
        'Options de livraison : retrait en pharmacie, livraison organisée par le client lui-même, ou livraison par la pharmacie à l\u2019adresse fournie. La pharmacie fixe les frais selon la distance et le mode choisis, affichés en toute transparence sur la facture avant paiement. La plateforme n\u2019est pas responsable des retards indépendants de la volonté de la pharmacie. Les frais de livraison sont dans tous les cas à la charge du client.',
        'Delivery options: pharmacy pickup, self-arranged delivery by the customer, or pharmacy delivery to the provided address. The pharmacy sets delivery fees based on distance and chosen method, displayed transparently on the invoice before payment. The Platform is not responsible for delays beyond the pharmacy\u2019s control. Shipping costs are in all cases borne by the customer.'
      ),
    },
    {
      title: L('8. الحسابات والصلاحيات (الموظفون)', '8. Comptes et permissions (personnel)', '8. Accounts & Permissions (Staff)'),
      body: L(
        'تُنشأ حسابات الموظفين من طرف مدير الصيدلية أو مالك المنصة فقط، وتُمنح الصلاحيات حسب الدور الوظيفي بمقتضى مبدأ الحد الأدنى من الصلاحيات. يُمنع مشاركة بيانات الدخول أو استعمال حساب الغير. تُسجَّل كل العمليات الحساسة في سجل التدقيق الداخلي. يتحمل صاحب الحساب مسؤولية كل عملية تتم من خلاله.',
        'Les comptes du personnel sont créés uniquement par le gérant de la pharmacie ou le propriétaire de la plateforme, avec des permissions selon le rôle selon le principe du moindre privilège. Le partage d\u2019identifiants ou l\u2019usage du compte d\u2019autrui est interdit. Toutes les opérations sensibles sont consignées dans le journal d\u2019audit interne. Le titulaire du compte est responsable de toute opération effectuée via celui-ci.',
        'Staff accounts are created only by the pharmacy manager or platform owner, with permissions granted by role under the least-privilege principle. Sharing credentials or using another\u2019s account is prohibited. All sensitive operations are recorded in the internal audit log. The account holder is responsible for every operation performed through it.'
      ),
    },
    {
      title: L('9. الملكية الفكرية', '9. Propriété intellectuelle', '9. Intellectual Property'),
      body: L(
        'كل عناصر المنصة (التصميم، الشيفرة، الشعارات، قاعدة بيانات الأدوية المنظمة) ملك حصري لمشغل المنصة، ولا يجوز نسخها أو استغلالها تجارياً بدون إذن كتابي مسبق. أسماء الأدوية وبياناتها الرسمية تبقى ملكاً عمومياً وفق ما تنص عليه اللوائح المغربية.',
        'Tous les éléments de la plateforme (conception, code, logos, base de données structurée des médicaments) sont la propriété exclusive de son opérateur ; toute copie ou exploitation commerciale sans autorisation écrite préalable est interdite. Les dénominations et données officielles des médicaments restent du domaine public conformément aux réglementations marocaines.',
        'All platform elements (design, code, logos, structured medicine database) are the exclusive property of its operator; copying or commercial exploitation without prior written permission is prohibited. Official medicine names and data remain public domain per Moroccan regulations.'
      ),
    },
    {
      title: L('10. حدود المسؤولية', '10. Limitation de responsabilité', '10. Limitation of Liability'),
      body: L(
        'تُقدَّم المنصة « كما هي ». لا يتحمل المشغل أي مسؤولية عن: الأضرار الناتجة عن سوء استعمال المنصة، انقطاع الخدمة لأسباب تقنية خارجة عن إرادته، أو الآثار الجانبية للأدوية (مرجعها الوصفة الطبية والفاتورة المعتمدة). المنصة وسيط تقني: المسؤولية المهنية عن صرف الدواء تقع على الصيدلية والصيدلاني المسؤول قانوناً.',
        'La plateforme est fournie « telle quelle ». L\u2019opérateur n\u2019est pas responsable : des dommages liés à une mauvaise utilisation, des interruptions techniques indépendantes de sa volonté, ou des effets secondaires des médicaments (référence : ordonnance et facture agréée). La plateforme est un intermédiaire technique : la responsabilité professionnelle de la délivrance incombe à la pharmacie et au pharmacien responsable.',
        'The Platform is provided “as is”. The operator bears no liability for: damages from misuse, service interruptions beyond its control, or medicine side effects (reference: the prescription and approved invoice). The Platform is a technical intermediary: professional dispensing responsibility lies with the pharmacy and the legally responsible pharmacist.'
      ),
    },
    {
      title: L('11. القانون الواجب التطبيق والتقاضي', '11. Droit applicable et litiges', '11. Governing Law & Disputes'),
      body: L(
        'تخضع هذه الشروط للقانون المغربي، لاسيما القانون 31.08 المتعلق بالمعاملات الإلكترونية والقانون 53.05 المتعلق بالتبادل الإلكتروني للمعطيات القانونية. في حال نشوء نزاع، يُلجأ أولاً إلى التسوية الودية، وإلا تكون المحاكم المغربية المختصة هي الجهة الوحيدة للنظر فيه.',
        'Ces conditions sont régies par le droit marocain, notamment la loi 31.08 sur les transactions électroniques et la loi 53.05 sur l\u2019échange électronique de données juridiques. En cas de litige, une solution amiable sera d\u2019abord recherchée ; à défaut, les tribunaux marocains compétents sont seuls saisis.',
        'These Terms are governed by Moroccan law, notably Law 31.08 on electronic transactions and Law 53.05 on the legal electronic exchange of data. In case of dispute, amicable settlement is sought first; failing that, the competent Moroccan courts have exclusive jurisdiction.'
      ),
    },
    {
      title: L('12. الاتصال', '12. Contact', '12. Contact'),
      body: L(
        'لأي استفسار قانوني حول هذه الشروط: عبر صفحة « من نحن » أو مباشرة لدى الصيدلية المعنية. آخر تحديث: أكتوبر 2026.',
        'Pour toute question juridique concernant ces conditions : via la page « À propos » ou directement auprès de la pharmacie concernée. Dernière mise à jour : octobre 2026.',
        'For any legal inquiry about these Terms: via the “About Us” page or directly with the pharmacy concerned. Last updated: October 2026.'
      ),
    },
  ]

  return (
    <PublicLayout active="terms">
      <div className="space-y-6">
        <div className="text-center space-y-4 pt-4">
          <div className="w-20 h-20 mx-auto rounded-3xl gradient-primary flex items-center justify-center shadow-xl shadow-primary-500/30">
            <FileText className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">{t('termsOfUse')}</h2>
          <p className="text-sm text-gray-500">
            {L('آخر تحديث: أكتوبر 2026 · النسخة 1.0', 'Dernière mise à jour : octobre 2026 · Version 1.0', 'Last updated: October 2026 · Version 1.0')}
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 leading-relaxed">
          {L(
            'تنبيه: هذه الوثيقة لأغراض تنظيمية وتوثيقية على مستوى المنصة، ولا تُغني عن النصوص الرسمية المنشورة في الجريدة الرسمية للمملكة المغربية. عند أي تعارض يُعتمَد النص الرسمي.',
            'Avertissement : ce document est fourni à des fins organisationnelles et documentaires et ne remplace pas les textes officiels publiés au Bulletin officiel du Royaume du Maroc. En cas de conflit, le texte officiel prévaut.',
            'Notice: this document is provided for organizational and documentation purposes and does not replace official texts published in the Official Bulletin of the Kingdom of Morocco. In case of conflict, the official text prevails.'
          )}
        </div>

        <div className="space-y-4">
          {sections.map((s, i) => (
            <div key={i} className="card p-5">
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                <CircleCheck className="w-4 h-4 text-primary-600 flex-shrink-0" />
                {s.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed text-justify">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  )
}

export default Terms
