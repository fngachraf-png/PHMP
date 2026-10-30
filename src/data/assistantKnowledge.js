// =====================================================================
// قاعدة معرفة «مساعد PHMP» — المصدر الوحيد لأجوبة المساعد المحلية
// ---------------------------------------------------------------------
// المبدأ: صفر هلوسة. كل جواب هنا مكتوب ومصنف مسبقاً ومستمد من:
//   1) خدمات المنصة الفعلية (سير الطلب، الوصفات، التوصيل، الفواتير...)
//   2) المراجع القانونية المغربية الموثقة في src/data/legalReferences.js
//   3) اللائحة المغربية الرسمية للأدوية (5917 دواء في قاعدة المنصة)
// النموذج اللغوي (Cloudflare) لا يولّد معلومات من عنده: يركّب فقط من
// المقاطع المسلمة له من هنا ومن بطاقات الأدوية المستخرجة من قاعدة البيانات.
//
// audience: guest = الزبون العابر | customer = الزبون المسجل | staff = الموظفون
// =====================================================================

export const ASSISTANT_KB = [
  // ============================ خدمات المنصة ============================
  {
    id: 'how-to-order',
    audience: ['guest', 'customer', 'staff'],
    keywords: {
      ar: ['كيف أطلب', 'كيف اطلب', 'طلب دواء', 'أطلب', 'اشتري', 'شراء', 'الطلب', 'السلة', 'طلبية'],
      fr: ['commander', 'commande', 'acheter', 'achat', 'panier', 'comment commander'],
      en: ['order', 'buy', 'purchase', 'cart', 'how to order', 'shopping'],
    },
    answer: {
      ar: 'لطلب دواء من المنصة: افتح واجهة المتجر، اختر الصيدلية، ابحث عن الدواء بالاسم (عربي أو فرنسي أو بالاسم العلمي DCI)، أضفه إلى السلة ثم أكمل الطلب. الأدوية المقيدة تتطلب إرفاق صورة الوصفة الطبية، ويمكنك اختيار التوصيل أو الاستلام من الصيدلية. الدفع يكون عند الاستلام.',
      fr: 'Pour commander un médicament : ouvrez la boutique, choisissez la pharmacie, recherchez le médicament par nom (arabe, français ou DCI), ajoutez-le au panier puis validez la commande. Les médicaments restreints exigent une photo de l’ordonnance, et vous choisissez la livraison ou le retrait en pharmacie. Le paiement se fait à la livraison.',
      en: 'To order a medicine: open the shop, choose the pharmacy, search the medicine by name (Arabic, French, or INN/DCI), add it to the cart, then complete the order. Restricted medicines require a photo of the prescription, and you can choose delivery or pharmacy pickup. Payment is on delivery.',
    },
    source: 'platform',
  },
  {
    id: 'prescription-rules',
    audience: ['guest', 'customer', 'staff'],
    keywords: {
      ar: ['وصفة', 'وصفة طبية', 'بوصفة', 'دون وصفة', 'بدون وصفة', 'مقيدة', 'إلزامية'],
      fr: ['ordonnance', 'prescription', 'sans ordonnance', 'sur ordonnance'],
      en: ['prescription', 'ordonnance', 'without prescription', 'prescription-only'],
    },
    answer: {
      ar: 'وفق القانون 17.04 (مدونة الأدوية والصيدلة) تُصنف الأدوية المغربية إلى مصروفة بوصفة إلزامية وأخرى تصرف دون وصفة. في المنصة، كل دواء يحمل شارة واضحة تدل على فئته: «يصرف بوصفة طبية إلزامية» أو «يصرف دون وصفة». عند طلب دواء مقيد يجب إرفاق صورة وصفة طبية واضحة قبل صرفه، ويحتفظ بها الموظف لأرشفتها.',
      fr: 'Conformément à la loi 17-04 (Code du médicament et de la pharmacie), les médicaments marocains sont classés en médicaments sur ordonnance obligatoire et médicaments délivrables sans ordonnance. Sur la plateforme, chaque médicament porte un badge indiquant sa classe. Pour un médicament restreint, une photo claire de l’ordonnance est exigée avant la délivrance, et elle est archivée par l’employé.',
      en: 'Under Law 17-04 (Code of Medicine and Pharmacy), Moroccan medicines are classified as prescription-only or over-the-counter. On the platform, every medicine carries a clear badge showing its class. Ordering a restricted medicine requires a clear photo of the prescription before dispensing, and it is archived by the staff.',
    },
    source: 'assistantLaw17_04',
  },
  {
    id: 'delivery',
    audience: ['guest', 'customer', 'staff'],
    keywords: {
      ar: ['توصيل', 'التوصيل', 'يوصل', 'التوصيل الذاتي', 'استلام', 'مصاريف التوصيل'],
      fr: ['livraison', 'livrer', 'retrait', 'frais de livraison'],
      en: ['delivery', 'deliver', 'pickup', 'shipping', 'delivery fees'],
    },
    answer: {
      ar: 'توفر المنصة ثلاثة خيارات عند إتمام الطلب: الاستلام من الصيدلية، التوصيل الذاتي، أو التوصيل عبر الصيدلية. مصاريف التوصيل على حساب الزبون وتحددها الصيدلية عند قبول الطلب وتظهر في الفاتورة قبل التأكيد.',
      fr: 'La plateforme propose trois options : retrait en pharmacie, livraison par vos soins, ou livraison par la pharmacie. Les frais de livraison sont à la charge du client ; ils sont fixés par la pharmacie à l’acceptation et apparaissent sur la facture avant confirmation.',
      en: 'The platform offers three options: pharmacy pickup, self-pickup, or delivery by the pharmacy. Delivery fees are paid by the customer; they are set by the pharmacy on acceptance and shown on the invoice before confirmation.',
    },
    source: 'platform',
  },
  {
    id: 'payment',
    audience: ['guest', 'customer', 'staff'],
    keywords: {
      ar: ['الدفع', 'دفع', 'طريقة الدفع', 'نقدا', 'بطاقة', 'عند الاستلام'],
      fr: ['paiement', 'payer', 'espèces', 'carte', 'à la livraison'],
      en: ['payment', 'pay', 'cash', 'card', 'on delivery'],
    },
    answer: {
      ar: 'طلبات المتجر تُدفع عند الاستلام. أما داخل الصيدلية فتقبل المنصة في نقطة البيع: النقد، البطاقة، التحويل البنكي، والتأمين — وتظهر كلها في تقارير المبيعات وتُطبع في الفاتورة الرسمية.',
      fr: 'Les commandes de la boutique se paient à la livraison. En pharmacie, le point de vente accepte : espèces, carte, virement et assurance — toutes visibles dans les rapports de vente et imprimées sur la facture officielle.',
      en: 'Shop orders are paid on delivery. Inside the pharmacy, the point of sale accepts: cash, card, bank transfer, and insurance — all reflected in sales reports and printed on the official invoice.',
    },
    source: 'platform',
  },
  {
    id: 'guest-vs-member',
    audience: ['guest', 'customer', 'staff'],
    keywords: {
      ar: ['زبون عابر', 'مسجل', 'مشترك', 'حساب', 'تسجيل', 'بطاقة الهوية', 'الهوية'],
      fr: ['invité', 'client inscrit', 'compte', 'inscription', 'carte d’identité'],
      en: ['guest', 'registered', 'account', 'sign up', 'id card', 'identity'],
    },
    answer: {
      ar: 'يمكنك الطلب كزبون عابر دون حساب، أو تسجيل حساب مشترك من زر «حسابي» في المتجر. التسجيل يتطلب الاسم الكامل ورقم الهاتف وصورة واضحة لوثيقة الهوية (البطاقة الوطنية أو جواز السفر أو رخصة السياقة) — وهي محفوظة محلياً في جهازك ولا ترفع لأي خادم خارجي. الزبون المسجل يتتبع طلباته ويتخطى خطوة إعادة إدخال بياناته عند كل طلب.',
      fr: 'Vous pouvez commander en tant que client de passage sans compte, ou créer un compte client via le bouton « Mon compte ». L’inscription exige le nom complet, le téléphone et une photo claire d’une pièce d’identité (CIN, passeport ou permis) — conservée localement sur votre appareil, jamais envoyée à un serveur externe. Le client inscrit suit ses commandes et saute la saisie de ses données à chaque commande.',
      en: 'You can order as a walk-in guest without an account, or register a customer account via the "My account" button. Registration requires a full name, phone number, and a clear photo of an identity document (CIN, passport, or driving licence) — stored locally on your device, never sent to an external server. Registered customers track their orders and skip re-entering their details each time.',
    },
    source: 'platform',
  },
  {
    id: 'track-order',
    audience: ['guest', 'customer', 'staff'],
    keywords: {
      ar: ['تتبع', 'تتبع الطلب', 'أين طلبي', 'حالة الطلب', 'طلبي'],
      fr: ['suivi', 'suivre', 'où est ma commande', 'statut de la commande', 'ma commande'],
      en: ['track', 'tracking', 'where is my order', 'order status', 'my order'],
    },
    answer: {
      ar: 'بعد إتمام الطلب تحصل على رقم طلب (مثال CMD-2026-XXXXX) ووصل تتبع. حالة الطلب تتحدث مباشرة: قيد الانتظار ← مقبول ← قيد التحضير ← جاهز ← في الطريق ← مكتمل. الزبون المسجل يرى كل طلباته من زر «طلباتي» في واجهة المتجر.',
      fr: 'Après validation, vous recevez un numéro de commande (ex. CMD-2026-XXXXX) et un reçu de suivi. Le statut se met à jour en direct : en attente, acceptée, en préparation, prête, en route, terminée. Le client inscrit voit toutes ses commandes via « Mes commandes » dans la boutique.',
      en: 'After completing an order you receive an order number (e.g. CMD-2026-XXXXX) and a tracking receipt. The status updates live: pending, accepted, preparing, ready, dispatched, completed. Registered customers see all their orders via "My orders" in the shop.',
    },
    source: 'platform',
  },
  {
    id: 'invoice',
    audience: ['guest', 'customer', 'staff'],
    keywords: {
      ar: ['فاتورة', 'الفاتورة', 'وصل', 'إيصال'],
      fr: ['facture', 'reçu', 'ticket'],
      en: ['invoice', 'receipt', 'bill'],
    },
    answer: {
      ar: 'كل طلب مكتمل يولد فاتورة رسمية قابلة للطباعة (مقاس حراري 80mm) تتضمن اسم الصيدلية ورقم الترخيص، بنود الأدوية والكميات، الأسعار، طريقة الدفع والمجموع. يمكن للموظف طباعتها أو تصديرها CSV، وللزبون الحصول على نسخة عند التسليم.',
      fr: 'Chaque commande terminée génère une facture officielle imprimable (80mm) : nom et licence de la pharmacie, lignes de médicaments, quantités, prix, mode de paiement et total. L’employé peut l’imprimer ou l’exporter en CSV ; le client en reçoit une copie à la remise.',
      en: 'Every completed order generates a printable official invoice (80mm thermal) with the pharmacy name and licence, medicine lines and quantities, prices, payment method, and total. Staff can print or export it to CSV; the customer receives a copy on handover.',
    },
    source: 'platform',
  },
  {
    id: 'prices-ppv',
    audience: ['guest', 'customer', 'staff'],
    keywords: {
      ar: ['سعر', 'السعر', 'أسعار', 'تسعير', 'كم ثمن', 'بكم', 'غلاء', 'رخيص'],
      fr: ['prix', 'coûte', 'tarif', 'cher'],
      en: ['price', 'cost', 'how much', 'expensive', 'cheap'],
    },
    answer: {
      ar: 'أسعار الأدوية في المنصة مطابقة للسعر العمومي الرسمي للبيع (PPV) الوارد في اللائحة المغربية للأدوية، طبقاً للمرسوم 2.13.852 المتعلق بتحديد أسعار البيع العمومي. لا يمكن للصيدلية تسجيل دواء بسعر يخالف السعر المعتمد، وتُراجع اللوائح بقرارات لوزير الصحة وتُحدَّث في المنصة.',
      fr: 'Les prix sur la plateforme sont conformes au Prix Public de Vente (PPV) de la liste marocaine des médicaments, conformément au décret 2-13.852 relatif à la fixation des prix de vente au public. Une pharmacie ne peut enregistrer un médicament à un prix non conforme ; les listes sont révisées par arrêtés du Ministre de la Santé et mises à jour dans la plateforme.',
      en: 'Prices on the platform match the official Public Sale Price (PPV) from the Moroccan medicines list, per Decree 2-13.852 on public sale price setting. A pharmacy cannot register a medicine at a non-compliant price; lists are revised by ministerial orders and updated in the platform.',
    },
    source: 'assistantDecreePrices',
  },
  {
    id: 'reimbursement',
    audience: ['guest', 'customer', 'staff'],
    keywords: {
      ar: ['تعويض', 'التعويض', 'التغطية', 'تأمين', 'AMO', 'CNSS', 'يُعوّض', 'نسبة التعويض'],
      fr: ['remboursement', 'rembourser', 'assurance', 'AMO', 'CNSS', 'couverture'],
      en: ['reimbursement', 'refund', 'insurance', 'AMO', 'CNSS', 'coverage'],
    },
    answer: {
      ar: 'نسبة التعويض تظهر في بطاقة كل دواء داخل المنصة، وهي مستمدة من لوائح الأدوية القابلة لإرجاع المصاريف في إطار التأمين الإجباري عن المرض AMO (القانون 65.00 - مدونة التغطية الصحية الأساسية). الصندوق الوطني للضمان الاجتماعي CNSS هو الجهة المكلفة بالتعويض، وتتحدث النسب بقرارات لوزير الصحة.',
      fr: 'Le taux de remboursement figure sur la fiche de chaque médicament ; il est issu des listes des médicaments remboursables dans le cadre de l’AMO (loi 65-00 - Code de couverture sanitaire de base). La CNSS assure le remboursement ; les taux sont mis à jour par arrêtés du Ministre de la Santé.',
      en: 'The reimbursement rate appears on each medicine card; it derives from the reimbursable medicines lists under the mandatory health insurance AMO (Law 65-00 - Basic Health Coverage Code). The CNSS handles reimbursement; rates are updated by ministerial orders.',
    },
    source: 'assistantLaw65_00',
  },
  {
    id: 'generics',
    audience: ['guest', 'customer', 'staff'],
    keywords: {
      ar: ['جنيس', 'جنسية', 'بديل', 'أصلي', 'برنسيس', 'تعميم', 'استبدال'],
      fr: ['générique', 'generique', 'princeps', 'substitution', 'équivalent'],
      en: ['generic', 'originator', 'princeps', 'substitution', 'equivalent'],
    },
    answer: {
      ar: 'المنصة تميز بين الدواء الأصلي (Princeps) والدواء الجنيس (Générique) في بطاقة كل دواء، استناداً إلى المرجع المغربي للأدوية الجنيسة الصادر عن الوكالة AMMPS. يمكنك مقارنة الأسعار لاختيار البديل الأنجع اقتصادياً، والصيدلي هو من يوجهك لقواعد الاستبدال حسب الوصفة والتوفر.',
      fr: 'La plateforme distingue médicament princeps et générique sur chaque fiche, selon le Répertoire Marocain des Médicaments Génériques publié par l’AMMPS. Vous pouvez comparer les prix pour choisir l’alternative la plus économique ; le pharmacien vous oriente sur les règles de substitution selon l’ordonnance et la disponibilité.',
      en: 'The platform distinguishes originator (Princeps) and generic medicines on each card, based on the Moroccan Reference of Generic Medicines published by AMMPS. You can compare prices to choose the most cost-effective alternative; the pharmacist guides you on substitution rules according to the prescription and availability.',
    },
    source: 'assistantLaw10_22',
  },
  {
    id: 'law-17-04',
    audience: ['guest', 'customer', 'staff'],
    keywords: {
      ar: ['القانون 17', '17.04', 'مدونة الأدوية', 'مدونة الصيدلة', 'القوانين', 'القانون المنظم'],
      fr: ['loi 17', '17-04', 'code du médicament', 'code de la pharmacie', 'lois'],
      en: ['law 17', '17-04', 'medicine code', 'pharmacy code', 'laws', 'regulation'],
    },
    answer: {
      ar: 'القانون 17.04 هو مدونة الأدوية والصيدلة بالمغرب (صادر بتنفيذه الظهير الشريف بتاريخ 22 نونبر 2006). ينظم إنتاج الأدوية واستيرادها وتوزيعها، والمؤسسات الصيدلية، وشروط الصرف، وتصنيف الأدوية (القائمة الأولى والثانية، والمصروفة بوصفة إلزامية)، وواجبات الصيدلي، وترخيص العرض في السوق AMM. المنصة تطبقه عملياً: كل دواء موسوم بفئة صرفه، والوصفات إلزامية ومؤرشفة للمقيد.',
      fr: 'La loi 17-04 constitue le Code du médicament et de la pharmacie marocain (dahir du 22 novembre 2006). Elle régit la production, l’importation et la distribution, les établissements pharmaceutiques, les conditions de délivrance, la classification (Listes I et II, ordonnance obligatoire), les devoirs du pharmacien et l’autorisation de mise sur le marché (AMM). La plateforme l’applique : chaque médicament est étiqueté par classe, ordonnances obligatoires et archivées pour les produits restreints.',
      en: 'Law 17-04 is the Moroccan Code of Medicine and Pharmacy (Royal Decree of 22 November 2006). It governs production, import and distribution, pharmaceutical establishments, dispensing conditions, classification (Lists I & II, prescription-only), pharmacist duties, and market authorization (AMM). The platform applies it practically: every medicine is tagged by dispensing class, with mandatory archived prescriptions for restricted products.',
    },
    source: 'assistantLaw17_04',
  },
  {
    id: 'law-10-22',
    audience: ['guest', 'customer', 'staff'],
    keywords: {
      ar: ['القانون 10', '10.22', 'AMMPS', 'الوكالة المغربية للأدوية', 'الوكالة'],
      fr: ['loi 10', '10-22', 'AMMPS', 'agence du médicament'],
      en: ['law 10', '10-22', 'AMMPS', 'medicines agency'],
    },
    answer: {
      ar: 'القانون 10.22 أنشأ الوكالة المغربية للأدوية ومنتجات الصحة (AMMPS) لتوحيد تدبير الأدوية: منح إذن العرض في السوق AMM، مراقبة الجودة، اليقظة الدوائية، التسعير ومراقبة الأسعار، والتواصل الدوائي. قاعدة أدوية المنصة (5917 دواء) مبنية على اللائحة المغربية للأدوية المسجلة لدى الوكالة.',
      fr: 'La loi 10-22 a créé l’Agence Marocaine du Médicament et des Produits de Santé (AMMPS) : autorisation de mise sur le marché (AMM), contrôle qualité, pharmacovigilance, fixation et contrôle des prix, communication pharmaceutique. La base de la plateforme (5 917 médicaments) s’appuie sur la liste marocaine des médicaments enregistrés auprès de l’Agence.',
      en: 'Law 10-22 created the Moroccan Agency for Medicines and Health Products (AMMPS): market authorization (AMM), quality control, pharmacovigilance, pricing and price control, and pharmaceutical communication. The platform database (5,917 medicines) is built on the Moroccan list of medicines registered with the Agency.',
    },
    source: 'assistantLaw10_22',
  },
  {
    id: 'drug-list',
    audience: ['guest', 'customer', 'staff'],
    keywords: {
      ar: ['لائحة الأدوية', 'اللائحة المغربية', 'قاعدة الأدوية', 'كم دواء', 'الأدوية المتوفرة'],
      fr: ['liste des médicaments', 'liste marocaine', 'base de données', 'combien de médicaments'],
      en: ['drug list', 'medicine list', 'moroccan list', 'database', 'how many medicines'],
    },
    answer: {
      ar: 'قاعدة المنصة تضم 5917 دواء من اللائحة المغربية الرسمية للأدوية المسجلة (المصدر: الوكالة AMMPS)، مع الاسم التجاري والعلمي DCI والشكل والتوضيب والسعر العمومي PPV ونسبة التعويض وحالة الأصلي/الجنيس. اكتب لي اسم أي دواء — حتى مع خطأ إملائي — وسأصححه لك وأعرض بطاقته.',
      fr: 'La base de la plateforme contient 5 917 médicaments de la liste marocaine officielle des médicaments enregistrés (source : AMMPS), avec nom commercial, DCI, forme, conditionnement, prix public PPV, taux de remboursement et statut princeps/générique. Tapez un nom de médicament — même mal orthographié — je le corrige et affiche sa fiche.',
      en: 'The platform database holds 5,917 medicines from the official Moroccan list of registered medicines (source: AMMPS), with trade name, INN/DCI, form, packaging, public price PPV, reimbursement rate, and originator/generic status. Type any medicine name — even misspelled — and I will correct it and show its card.',
    },
    source: 'assistantLaw10_22',
  },
  {
    id: 'safety-dosage',
    audience: ['guest', 'customer', 'staff'],
    keywords: {
      ar: ['جرعة', 'الجرعة', 'كم آخذ', 'كم اخذ', 'كيف أستعمل', 'طريقة الاستعمال', 'أعطني وصفة', 'علاج'],
      fr: ['dose', 'dosage', 'combien prendre', 'posologie', 'traitement'],
      en: ['dose', 'dosage', 'how much should i take', 'how to take', 'treatment'],
    },
    answer: {
      ar: 'لا أقدم جرعات أو أنظمة علاجية — هذا اختصاص الصيدلي أو الطبيب وحده، التزاماً بالقانون 17.04 وبسياسات المنصة. أستطيع إخبارك بالبيانات الرسمية المسجلة للدواء (شكله، تركيزه، توضيبه، فئة صرفه، سعره الرسمي). للاستشارة في الجرعة أو الاستعمال، استعمل زر «التحدث مع الصيدلي أو الكاشير» وسأحولك فوراً حسب المتوفر.',
      fr: 'Je ne fournis ni doses ni schémas thérapeutiques — cela relève exclusivement du pharmacien ou du médecin, conformément à la loi 17-04 et aux politiques de la plateforme. Je peux vous donner les données officielles enregistrées du médicament (forme, dosage, conditionnement, classe de délivrance, prix officiel). Pour une consultation, utilisez « Parler au pharmacien ou au caissier » et je vous transfère selon disponibilité.',
      en: 'I do not provide doses or treatment regimens — that is exclusively the pharmacist’s or doctor’s role, in line with Law 17-04 and platform policy. I can give you the medicine’s official registered data (form, strength, packaging, dispensing class, official price). For dosage or usage advice, use "Talk to the pharmacist or cashier" and I will transfer you to whoever is available.',
    },
    source: 'assistantLaw17_04',
  },
  {
    id: 'emergency',
    audience: ['guest', 'customer', 'staff'],
    keywords: {
      ar: ['مستعجل', 'مستعجلة', 'طارئ', 'إسعاف', 'سم', 'تسمم', 'حالة خطيرة'],
      fr: ['urgence', 'urgent', 'secours', 'empoisonnement', 'SAMU'],
      en: ['emergency', 'urgent', 'poison', 'help now', 'ambulance'],
    },
    answer: {
      ar: 'في الحالات المستعجلة اتصل فوراً بالأرقام الرسمية للنجدة بالمغرب: 15 (الإسعاف/الحماية المدنية) أو 19 (الشرطة) أو 177 (الدرك الملكي خارج المدن)، ثم تواصل مع الصيدلية. أنا مساعد معلومات ولا أتعامل مع الحالات الطارئة.',
      fr: 'En cas d’urgence, appelez immédiatement les numéros officiels au Maroc : 15 (SAMU / Protection civile), 19 (Police) ou 177 (Gendarmerie royale hors villes), puis contactez la pharmacie. Je suis un assistant d’information ; je ne gère pas les urgences.',
      en: 'In emergencies, immediately call the official Moroccan emergency numbers: 15 (SAMU / Civil Protection), 19 (Police), or 177 (Royal Gendarmerie outside cities), then contact the pharmacy. I am an information assistant and do not handle emergencies.',
    },
    source: 'platform',
  },
  {
    id: 'privacy',
    audience: ['guest', 'customer', 'staff'],
    keywords: {
      ar: ['خصوصية', 'الخصوصية', 'بياناتي', 'حماية البيانات', 'تخزين'],
      fr: ['confidentialité', 'privacy', 'mes données', 'protection des données'],
      en: ['privacy', 'my data', 'data protection', 'gdpr'],
    },
    answer: {
      ar: 'المنصة تعتمد مبدأ «محلي أولاً»: بيانات الطلبات والدردشة المباشرة تُستهلك فوراً ولا تُسجل في خادم المنصة إطلاقاً. حسابات الموظفين محفوظة في قاعدة محلية محمية على مستوى الصيدلية، وصور الهوية للزبناء المسجلين تبقى في جهاز الزبون. لمزيد من التفاصيل راجع صفحة «سياسة الخصوصية» في تذييل المتجر.',
      fr: 'La plateforme applique le principe « local d’abord » : commandes et discussions directes sont consommées à la volée et jamais enregistrées sur le serveur de la plateforme. Les comptes employés sont dans une base locale protégée au niveau de la pharmacie ; les photos d’identité restent sur l’appareil du client. Voir la « Politique de confidentialité » en bas de la boutique.',
      en: 'The platform follows a "local-first" principle: orders and direct chats are consumed instantly and never recorded on the platform server. Staff accounts live in a protected local database at the pharmacy; customers’ ID photos stay on the customer’s device. See the "Privacy Policy" page in the shop footer.',
    },
    source: 'platform',
  },
  {
    id: 'android-app',
    audience: ['guest', 'customer', 'staff'],
    keywords: {
      ar: ['تطبيق', 'التطبيق', 'تحميل', 'تثبيت', 'أندرويد', 'APK', 'الهاتف'],
      fr: ['application', 'télécharger', 'installer', 'android', 'APK'],
      en: ['app', 'download', 'install', 'android', 'apk', 'mobile'],
    },
    answer: {
      ar: 'المنصة تعمل فوراً من المتصفح، ويتوفر تطبيق أندرويد رسمي موقّع يحمّل من صفحة «التحميل والتثبيت» في المنصة (الرابط phmp-download.pages.dev/PHMP.apk). الصفحة تشرح خطوات التثبيت الأربع والمتطلبات (أندرويد 8.0 فما فوق). تجنب أي مصدر تحميل غير رسمي.',
      fr: 'La plateforme fonctionne directement dans le navigateur ; une application Android officielle signée est disponible sur la page « Téléchargement et installation » (phmp-download.pages.dev/PHMP.apk), avec les 4 étapes d’installation et les prérequis (Android 8.0+). Évitez toute source non officielle.',
      en: 'The platform runs instantly in the browser; an official signed Android app is available on the "Download & install" page (phmp-download.pages.dev/PHMP.apk), with the 4 installation steps and requirements (Android 8.0+). Avoid any unofficial download source.',
    },
    source: 'platform',
  },
  // ============================ واجهة الموظفين ============================
  {
    id: 'staff-features',
    audience: ['staff'],
    keywords: {
      ar: ['المنصة ماذا توفر', 'مميزات', 'وظائف المنصة', 'ماذا أستطيع', 'لوحة التحكم'],
      fr: ['fonctionnalités', 'que propose', 'tableau de bord'],
      en: ['features', 'what can i do', 'dashboard', 'capabilities'],
    },
    answer: {
      ar: 'للموظفين توفر المنصة: لوحة تحكم بمؤشرات اليوم، نقطة بيع POS مع سلة وطرق دفع، إدارة مخزون بتنبيهات النفاد والصلاحية، الوصفات الطبية، العملاء والموردون والمشتريات، تقارير KPI (مبيعات/أرباح/مخزون/صلاحية) مع تصدير CSV وطباعة A4، وإدارة المنصة للمالك (صيدليات، مستخدمون، سجل تدقيق، مصفوفة صلاحيات). كل شيء بثلاث لغات وبوضع قاتم.',
      fr: 'Pour les employés : tableau de bord d’indicateurs, point de vente POS avec panier et modes de paiement, gestion de stock avec alertes rupture/péremption, ordonnances, clients, fournisseurs et achats, rapports KPI (ventes/bénéfices/stock/péremption) avec export CSV et impression A4, et gestion de la plateforme pour le propriétaire. Le tout en 3 langues et mode sombre.',
      en: 'For staff: a KPI dashboard, POS with cart and payment methods, inventory management with out-of-stock and expiry alerts, prescriptions, customers, suppliers and purchases, KPI reports (sales/profit/inventory/expiry) with CSV export and A4 printing, and platform management for the owner. All in 3 languages with dark mode.',
    },
    source: 'platform',
  },
  {
    id: 'staff-reports',
    audience: ['staff'],
    keywords: {
      ar: ['تقارير', 'التقارير', 'تصدير', 'CSV', 'طباعة تقرير', 'KPI', 'أرباح', 'هامش'],
      fr: ['rapports', 'export', 'bénéfices', 'marge', 'KPI'],
      en: ['reports', 'export', 'profit', 'margin', 'kpi'],
    },
    answer: {
      ar: 'صفحة التقارير تعرض مؤشرات مبنية على الفواتير: عدد الفواتير، المبيعات، الخصومات، الضريبة، صافي المقبوضات، تكلفة المبيعات COGS، الربح الإجمالي والهامش، قيمة المخزون، والصلاحيات 30/60/90 يوماً — مع فلترة زمنية فعلية ومقارنة بالفترة السابقة. زر «تصدير CSV» ينتج ملفاً يفتح العربية سليماً في Excel، و«طباعة PDF» يفتح نسخة A4 نظيفة.',
      fr: 'La page Rapports affiche des KPI basés sur les factures : nombre, ventes, remises, TVA, encaissements nets, COGS, bénéfice et marge, valeur du stock, péremptions 30/60/90 jours — avec filtre temporel réel et comparaison à la période précédente. « Exporter CSV » produit un fichier lisible dans Excel ; « Imprimer PDF » ouvre une version A4 propre.',
      en: 'The Reports page shows invoice-based KPIs: count, sales, discounts, tax, net collected, COGS, gross profit and margin, stock value, and 30/60/90-day expiries — with real time filtering and comparison to the previous period. "Export CSV" produces an Excel-friendly file; "Print PDF" opens a clean A4 version.',
    },
    source: 'platform',
  },
  {
    id: 'staff-roles',
    audience: ['staff'],
    keywords: {
      ar: ['صلاحيات', 'الصلاحيات', 'أدوار', 'الأدوار', 'مصفوفة', 'من يستطيع', 'مالك', 'مدير', 'محاسب'],
      fr: ['permissions', 'rôles', 'matrice', 'gérant', 'comptable'],
      en: ['permissions', 'roles', 'matrix', 'who can', 'manager', 'accountant'],
    },
    answer: {
      ar: 'المنصة تطبق صلاحيات هرمية RBAC بخمسة أدوار: مالك المنصة (سوبر أدمن) ثم مدير الصيدلية ثم المحاسب والصيدلاني ثم الكاشير. مصفوفة الصلاحيات في صفحة إدارة المنصة مشتقة مباشرة من مصدر الحقيقة PERMISSIONS: فالمخزون ونقطة البيع متاحان حسب الصلاحية للمدير والمحاسب والصيدلاني والكاشير، بينما إدارة المستخدمين وإدارة المنصة للمالك والمدير فقط.',
      fr: 'La plateforme applique un RBAC hiérarchique à 5 rôles : propriétaire (super admin), gérant, comptable, pharmacien, caissier. La matrice des permissions est dérivée directement de la source de vérité PERMISSIONS ; la gestion des utilisateurs et de la plateforme est réservée au propriétaire et au gérant.',
      en: 'The platform applies hierarchical RBAC with 5 roles: owner (super admin), pharmacy manager, accountant, pharmacist, cashier. The permissions matrix is derived directly from the PERMISSIONS source of truth; user and platform management are reserved to the owner and manager.',
    },
    source: 'platform',
  },
  {
    id: 'staff-login',
    audience: ['guest', 'staff'],
    keywords: {
      ar: ['دخول الموظفين', 'تسجيل الدخول', 'الدخول', 'كلمة المرور', 'حساب الموظف'],
      fr: ['connexion', 'se connecter', 'mot de passe', 'connexion employé'],
      en: ['login', 'sign in', 'password', 'staff login'],
    },
    answer: {
      ar: 'دخول الموظفين يتم من زر «دخول الموظفين» في ترويسة المتجر أو عبر صفحة /login، بالحسابات الرسمية التي ينشئها مالك المنصة أو مدير الصيدلية (مصادقة JWT مشفرة عبر الخادم المحلي). لا توجد حسابات تجريبية؛ عند نسيان كلمة المرور راجع مدير صيدليتك لإعادة تعيينها.',
      fr: 'La connexion employé se fait via « Connexion employés » dans l’en-tête de la boutique ou la page /login, avec les comptes officiels créés par le propriétaire ou le gérant (authentification JWT via le serveur local). Aucun compte démo ; en cas d’oubli, contactez votre gérant pour réinitialiser.',
      en: 'Staff sign in via the "Staff login" button in the shop header or the /login page, using official accounts created by the owner or pharmacy manager (JWT authentication via the local server). There are no demo accounts; if you forget your password, ask your manager to reset it.',
    },
    source: 'platform',
  },
]

// مجالات الكلمات الدالة العامة (لكشف "داخل النطاق" قبل أي مطابقة)
export const DOMAIN_SIGNALS = [
  // عربي
  'دواء', 'دواء', 'أدوية', 'ادوية', 'صيدل', 'صيدلية', 'وصفة', 'علاج', 'دوائي', 'مرض',   'سعر', 'أسعار', 'تعويض', 'تأمين', 'جنيس', 'مخزون', 'تقرير', 'فاتورة', 'طلب', 'توصيل', 'جرعة',
  'صيدلي', 'كاشير', 'منصة', 'PHMP', 'AMMPS', 'AMO', 'CNSS',
  // فرنسي
  'médicament', 'medicament', 'pharma', 'pharmacien', 'ordonnance', 'prix', 'remboursement',
  'assurance', 'générique', 'generique', 'stock', 'rapport', 'facture', 'commande', 'livraison',
  'dose', 'plateforme', 'pharmacie',
  // إنجليزي
  'medicine', 'drug', 'pharmacy', 'pharmacist', 'prescription', 'price', 'reimbursement',
  'insurance', 'generic', 'inventory', 'report', 'invoice', 'order', 'delivery', 'dose',
  'platform', 'cashier',
]

export default ASSISTANT_KB
