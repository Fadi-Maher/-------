/**
 * Basic answers for the "assistant knowledge" page (/settings/assistant), taken
 * from the package draft (reference/faq_drafts_for_knowledge_page.md). Every
 * answer restates text that is already published on the site (home, track,
 * terms, refund policy, agent join pages and footer). Questions that need the
 * owner's own information (support hours, cities, packages, documents per
 * service, first-quote time) are intentionally NOT included.
 *
 * Inserted once with scripts/seed-assistant-faqs.ts; afterwards the owner edits
 * them from the knowledge page like any other entry.
 */
export type KnowledgeSeedEntry = {
  questionAr: string;
  answerAr: string;
  questionEn: string;
  answerEn: string;
  sortOrder: number;
};

export const BASIC_KNOWLEDGE: KnowledgeSeedEntry[] = [
  {
    questionAr: "كيف أطلب خدمة؟",
    answerAr:
      "اضغط «طلب خدمة» في الصفحة الرئيسية، واختر الخدمة وفئتها، واكتب اسمك ورقم جوالك وملخصًا قصيرًا لطلبك. بعد التحقق من رقم جوالك يُحفظ الطلب، وتتابعه برقم الجوال نفسه.",
    questionEn: "How do I request a service?",
    answerEn:
      "Tap \"Request a service\" on the home page, choose the service and its category, then enter your name, mobile number and a short summary. After you verify your mobile number, your request is saved and you can follow it with the same number.",
    sortOrder: 10,
  },
  {
    questionAr: "كيف أتابع طلبي؟",
    answerAr:
      "افتح صفحة «تتبع الطلب»، وأدخل رقم جوالك، ثم أدخل رمز التحقق. ستظهر لك جميع طلباتك المرتبطة بهذا الرقم مع حالتها والتحديثات والمرفقات.",
    questionEn: "How do I track my request?",
    answerEn:
      "Open the \"Track request\" page, enter your mobile number and the verification code. You will see all requests linked to that number with their status, updates and attachments.",
    sortOrder: 20,
  },
  {
    questionAr: "كيف تعمل عروض الأسعار؟",
    answerAr:
      "يظهر طلبك لمقدمي الخدمة المؤهلين، فيرسلون عروضًا تتضمن السعر ومدة الإنجاز. تقارن بين العروض وتختار المناسب لك. بعد اعتماد عرض واحد تُغلق بقية العروض ويبدأ التنفيذ. يمكن لمقدم الخدمة تعديل عرضه أو سحبه قبل أن تعتمده.",
    questionEn: "How do quotes work?",
    answerEn:
      "Your request is shown to qualified service providers, who send quotes with a price and completion time. You compare them and choose the one that suits you. Once you accept one quote, the others close and work begins. A provider can edit or withdraw a quote before you accept it.",
    sortOrder: 30,
  },
  {
    questionAr: "كم سعر الخدمة؟",
    answerAr:
      "يختلف السعر حسب الخدمة والجهة المعنية. يحدده مقدم الخدمة في عرضه، وتطّلع عليه قبل الاختيار. اسأل مقدم الخدمة هل يشمل السعر الرسوم الحكومية أو رسوم الأطراف الأخرى، لأنها لا تُحتسب ضمن أتعابه إلا إذا نُص على ذلك في العرض.",
    questionEn: "How much does a service cost?",
    answerEn:
      "The price depends on the service and the authority involved. The provider sets it in their quote, and you see it before choosing. Check whether the price includes government or third-party fees; these are not part of the provider's fee unless the quote says so.",
    sortOrder: 40,
  },
  {
    questionAr: "كيف أدفع؟",
    answerAr:
      "لا تعالج معاملاتي كير المدفوعات داخل المنصة حاليًا. تتم التسوية المالية بينك وبين مقدم الخدمة الذي اخترته، حسب العرض المتفق عليه وعبر القنوات النظامية. لا ترسل بيانات بطاقتك أو رموز التحقق في المحادثة.",
    questionEn: "How do I pay?",
    answerEn:
      "Maalamati Care does not currently process payments on the platform. Payment is settled between you and the provider you chose, according to the agreed quote and through official channels. Never send card details or verification codes in the chat.",
    sortOrder: 50,
  },
  {
    questionAr: "كم تستغرق مدة الإنجاز؟",
    answerAr:
      "تظهر مدة الإنجاز المتوقعة في كل عرض قبل أن تختاره. المدد تقديرية، وقد تتغير بسبب متطلبات الجهة المعنية أو نقص المستندات.",
    questionEn: "How long does it take?",
    answerEn:
      "Each quote shows the expected completion time before you choose it. Times are estimates and may change due to authority requirements or missing documents.",
    sortOrder: 60,
  },
  {
    questionAr: "هل يمكنني إلغاء طلبي؟",
    answerAr:
      "قبل اعتماد عرض السعر يمكنك إلغاء الطلب أو ترك مهلة العروض تنتهي. أما بعد اعتماد العرض فتواصل فورًا مع الدعم ومع مقدم الخدمة، وتُراجع إمكانية الإلغاء والاسترداد حسب ما أُنجز. التفاصيل في صفحة «سياسة الاسترداد والإلغاء».",
    questionEn: "Can I cancel my request?",
    answerEn:
      "Before you accept a quote, you can cancel the request or let the quote deadline pass. After accepting a quote, contact support and the provider right away; cancellation and refund are reviewed based on the work already done. See the \"Refund and cancellation policy\" page for details.",
    sortOrder: 70,
  },
  {
    questionAr: "كيف أطلب استرداد مبلغ؟",
    answerAr:
      "أرسل طلبك من صفحة «تواصل ودعم»، واذكر فيه رقم جوالك الموثق ورقم الطلب وسبب الإلغاء، وأرفق إثبات الدفع. لا ترسل بيانات البطاقة أو رموز التحقق أو مستندات هوية غير لازمة. قد تُستثنى الرسوم الحكومية ورسوم الأطراف الخارجية من الاسترداد.",
    questionEn: "How do I request a refund?",
    answerEn:
      "Send your request from the \"Contact & support\" page with your verified mobile number, request number, cancellation reason and proof of payment. Do not send card details, verification codes or unnecessary ID documents. Government and third-party fees may be non-refundable.",
    sortOrder: 80,
  },
  {
    questionAr: "هل تظهر المرفقات في صفحة التتبع؟",
    answerAr: "نعم، تظهر المرفقات التي يضيفها فريق العمل ضمن سجل التحديثات المرتبط بطلبك.",
    questionEn: "Do attachments appear on the tracking page?",
    answerEn: "Yes. Attachments added by the team appear in your request's update history.",
    sortOrder: 90,
  },
  {
    questionAr: "هل يرى مقدم الخدمة رقم جوالي؟",
    answerAr:
      "لا. بيانات تواصلك لا تظهر لمقدم الخدمة، ويظهر له اسمك فقط بعد إسناد الطلب أو اعتماد عرضه. يتم التواصل والتبادل عبر المحادثة وسجل الطلب داخل المنصة.",
    questionEn: "Can the provider see my mobile number?",
    answerEn:
      "No. Your contact details are not shown to the provider; they only see your name after the request is assigned or their quote is accepted. Communication happens through the in-platform chat and request record.",
    sortOrder: 100,
  },
  {
    questionAr: "هل معاملاتي كير جهة حكومية؟",
    answerAr:
      "لا. معاملاتي كير منصة رقمية تنظم طلباتك وتعرضها على مقدمي الخدمة لتقارن عروضهم وتتابع التنفيذ. ظهور شعارات الجهات في الموقع لا يعني وجود شراكة أو اعتماد رسمي منها.",
    questionEn: "Is Maalamati Care a government entity?",
    answerEn:
      "No. Maalamati Care is a digital platform that organizes your requests and shows them to service providers so you can compare quotes and follow progress. Logos of authorities on the site do not imply partnership or official endorsement.",
    sortOrder: 110,
  },
  {
    questionAr: "كيف أنضم كمعقّب؟",
    answerAr:
      "افتح صفحة «انضم كمعقّب»، وتحقق من رقم جوالك السعودي، واختر «معقب»، ثم أكمل بياناتك وارفع الهوية الوطنية ورخصة العمل. تراجع الإدارة طلبك، ويظهر لك القرار أو سبب الرفض عند تسجيل الدخول من «دخول المعقبين». يُقبل طلب واحد لكل رقم جوال.",
    questionEn: "How do I join as an agent?",
    answerEn:
      "Open the \"Join as an agent\" page, verify your Saudi mobile number, choose \"Agent\", complete your details and upload your national ID and work license. Management reviews your application, and you will see the decision or the rejection reason when you sign in from \"Agent login\". One application is accepted per mobile number.",
    sortOrder: 120,
  },
  {
    questionAr: "كيف أتواصل مع الدعم؟",
    answerAr: "من صفحة «تواصل ودعم» في الموقع، أو عبر واتساب الدعم على الرقم 0530204050.",
    questionEn: "How do I contact support?",
    answerEn: "Use the \"Contact & support\" page on the site, or WhatsApp our support team at 0530204050.",
    sortOrder: 130,
  },
  {
    questionAr: "ما البيانات التي لا يجب أن أشاركها في المحادثة؟",
    answerAr:
      "لا تشارك رقم الهوية أو كلمات المرور أو بيانات البطاقة البنكية أو رموز التحقق في المحادثة. أرفق المستندات المطلوبة فقط داخل سجل الطلب عند الحاجة.",
    questionEn: "What should I not share in the chat?",
    answerEn:
      "Do not share ID numbers, passwords, bank card details or verification codes in the chat. Upload only the required documents inside the request record when needed.",
    sortOrder: 140,
  },
  {
    questionAr: "من الجهة التي تدير معاملاتي كير؟",
    answerAr: "تديرها شركة ستريك إكسبريس، السجل التجاري 7051197981.",
    questionEn: "Who operates Maalamati Care?",
    answerEn: "It is operated by Streak Express, Commercial Registration 7051197981.",
    sortOrder: 150,
  },
];
