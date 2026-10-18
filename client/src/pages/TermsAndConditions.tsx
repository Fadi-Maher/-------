import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { AlertTriangle, CheckCircle2, FileText, Scale } from "lucide-react";

type TermsSection = {
  id: string;
  title: string;
  paragraphs: string[];
  items?: string[];
};

const terms = {
  ar: {
    title: "الشروط والأحكام",
    intro: "تنظم هذه الشروط استخدام منصة «معاملاتي كير» التابعة لشركة ستريك إكسبريس، بما في ذلك طلب الخدمات، واستقبال عروض الأسعار، واختيار مقدم الخدمة، ومتابعة التحديثات والمرفقات والمحادثات داخل المنصة.",
    updated: "آخر تحديث: 30 أغسطس 2026",
    toc: "محتويات الصفحة",
    noticeTitle: "مسودة للاعتماد بعد المراجعة القانونية",
    notice: "أنا نظام ذكاء اصطناعي ولست محاميًا. هذه صياغة عمل وليست استشارة قانونية رسمية؛ يجب أن يراجعها محامٍ سعودي مؤهل قبل الاعتماد النهائي أو استخدامها في نزاع.",
    acceptance: "باستخدامك معاملاتي كير أو إنشاء طلب أو حساب، فإنك تقر بأنك قرأت هذه الشروط وفهمتها ووافقت عليها. إذا لم توافق، فيجب عليك التوقف عن استخدام المنصة.",
    sections: [
      { id: "definitions", title: "التعريفات", paragraphs: ["يقصد بـ«معاملاتي كير» المنصة الرقمية التي تديرها شركة ستريك إكسبريس، ويقصد بـ«المستخدم» كل من يزور المنصة أو ينشئ طلبًا أو حسابًا، وبـ«مقدم الخدمة» الموظف أو المعقّب أو الجهة التي تقدم عرضًا أو تنفذ خدمة عبر المنصة."], items: ["«الطلب»: المعلومات والمستندات التي يرسلها العميل للحصول على خدمة أو متابعة معاملة.", "«العرض»: السعر ومدة الإنجاز وأي شروط يوضحها مقدم الخدمة قبل الاعتماد.", "«المحتوى»: الرسائل والمرفقات والتحديثات والتقييمات التي تُرسل عبر المنصة."] },
      { id: "platform", title: "طبيعة المنصة ونطاق الخدمة", paragraphs: ["توفر معاملاتي كير بيئة رقمية لتنظيم الطلبات وعرضها على مقدمي الخدمة المؤهلين واستقبال العروض ومقارنة السعر ومدة الإنجاز ومتابعة التنفيذ. لا تُعد المنصة جهة حكومية، ولا تمثل أي جهة تظهر شعاراتها ضمن نطاق الخدمات، ولا يعني ظهور أي شعار وجود شراكة أو اعتماد رسمي.", "قد تختلف نتيجة الخدمة ومدتها بحسب نوع الطلب، واكتمال المستندات، ومتطلبات الجهة ذات العلاقة، واستجابة العميل ومقدم الخدمة."] },
      { id: "eligibility", title: "الأهلية والحساب والتحقق", paragraphs: ["يجب أن يكون المستخدم كامل الأهلية النظامية أو أن يستخدم المنصة تحت إشراف ولي أو ممثل نظامي مخول. يعتمد رقم الجوال الموثق معرفًا أساسيًا لحساب العميل، وقد تطلب المنصة رمز تحقق قبل إظهار الطلبات أو إنشاء سجل جديد."], items: ["يلتزم المستخدم بالمحافظة على سرية رموز التحقق وعدم مشاركتها.", "يتحمل المستخدم مسؤولية صحة بياناته ووسائل التواصل المسجلة.", "يجوز تعليق الوصول عند الاشتباه في استخدام غير مصرح أو محاولة تجاوز الصلاحيات."] },
      { id: "requests", title: "إنشاء الطلبات ودقة المعلومات", paragraphs: ["يلتزم المستخدم بتقديم معلومات صحيحة وكافية ومحدثة، وبألا يرفق مستندات لا يملك حق استخدامها. قد يؤدي نقص المعلومات أو عدم صحتها إلى تأخير الطلب أو رفضه أو الحاجة إلى إعادة تقديمه.", "يحق لمعاملاتي كير طلب إيضاحات أو مستندات إضافية لازمة لمراجعة الطلب، مع مراعاة عدم مطالبة المستخدم ببيانات لا ترتبط بالخدمة المطلوبة."] },
      { id: "quotes", title: "عروض الأسعار واختيار مقدم الخدمة", paragraphs: ["تظهر الطلبات الجديدة لمقدمي الخدمة وفق الصلاحيات المطبقة، ويمكنهم تقديم عروض تتضمن السعر ومدة الإنجاز. يختار العميل العرض المناسب بإرادته، ولا يعني ترتيب العروض أو ظهورها توصية أو ضمانًا من معاملاتي كير."], items: ["يجوز لمقدم الخدمة تعديل عرضه أو سحبه قبل اعتماد العميل وفق حالة الطلب.", "بعد اعتماد عرض واحد، تُغلق بقية العروض ويبدأ مسار تأكيد الاستلام والتنفيذ.", "لا يضمن العرض موافقة جهة خارجية أو نتيجة لا تقع تحت سيطرة مقدم الخدمة."] },
      { id: "deadlines", title: "المهل الزمنية والتنفيذ", paragraphs: ["قد تحدد المنصة مهلة لاستقبال العروض أو اعتمادها أو تأكيد استلام الطلب. عند انتهاء المهلة يجوز إغلاق المرحلة تلقائيًا أو إعادة فتح الاختيار وفق إعدادات الطلب.", "مدد الإنجاز تقديرية ما لم ينص العرض صراحة على خلاف ذلك، وقد تتغير بسبب متطلبات الجهات الخارجية أو نقص المستندات أو أحداث خارجة عن السيطرة المعقولة."] },
      { id: "communications", title: "المحادثات والتحديثات والمرفقات", paragraphs: ["تُستخدم المحادثة وسجل التحديثات لتبادل المعلومات المرتبطة بالطلب المعتمد. يجب ألا تُستخدم لإرسال محتوى غير مشروع أو ضار أو لا يرتبط بالخدمة.", "يعرض العميل اسم مقدم الخدمة ودوره فقط وفق ضوابط الخصوصية، ولا تُعرض بيانات اتصاله. كما لا تُعرض بيانات اتصال العميل لمقدم الخدمة، ويظهر اسمه فقط بعد تحقق شروط الإسناد أو الاعتماد."], items: ["يجب فحص الملفات قبل فتحها وعدم رفع ملفات ضارة أو تنتهك حقوق الغير.", "تُعد التحديثات الظاهرة في سجل الطلب مرجعًا تشغيليًا لحالة العمل وليست شهادة رسمية من جهة حكومية.", "قد تُحذف الملفات أو الرسائل المخالفة أو التي تشكل خطرًا أمنيًا."] },
      { id: "payments", title: "الرسوم والمدفوعات", paragraphs: ["لا تعالج معاملاتي كير المدفوعات داخل المنصة ما لم يظهر مسار دفع رسمي ومحدد بوضوح. قبل تفعيل أي دفع إلكتروني، تكون التسوية المالية بين العميل ومقدم الخدمة وفق القنوات النظامية المتفق عليها وعلى مسؤولية طرفيها.", "يجب أن يوضح مقدم الخدمة ما إذا كان السعر يشمل الرسوم الحكومية أو رسوم الأطراف الأخرى. الرسوم الحكومية أو الخارجية لا تُعد جزءًا من أتعاب مقدم الخدمة إلا إذا نُص على ذلك بوضوح في العرض."] },
      { id: "conduct", title: "الاستخدام المقبول والمحظورات", paragraphs: ["يلتزم المستخدم باستخدام المنصة لأغراض مشروعة فقط، ويحظر إساءة استخدامها أو محاولة الوصول إلى بيانات أو وظائف لا تسمح بها صلاحياته."], items: ["انتحال صفة شخص أو جهة أو تقديم مستندات مزورة أو مضللة.", "محاولة اختراق المنصة أو تعطيلها أو فحصها أمنيًا دون تصريح مكتوب.", "نشر برمجيات ضارة أو رسائل مزعجة أو محتوى مسيء أو مخالف للأنظمة.", "جمع بيانات المستخدمين أو التواصل معهم خارج المسار المسموح للتحايل على ضوابط المنصة."] },
      { id: "reviews", title: "التقييمات والمراجعات", paragraphs: ["يجوز للعميل تقييم الخدمة بعد اكتمال الطلب. يجب أن يكون التقييم صادقًا ومرتبطًا بالتجربة الفعلية وخاليًا من الإساءة أو المعلومات الشخصية. لا تنشئ معاملاتي كير تقييمات وهمية ولا تعدل مضمون التقييم لتغيير معناه، ويجوز لها إزالة المحتوى المخالف بعد المراجعة."] },
      { id: "privacy", title: "الخصوصية وحماية البيانات", paragraphs: ["تُعالج البيانات بالقدر اللازم لإنشاء الحساب، والتحقق من رقم الجوال، وإدارة الطلبات، وتقديم العروض، وتشغيل الإشعارات والدعم. تطبق المنصة الفصل بين الأدوار وتحد من ظهور بيانات الاتصال والحقول الحساسة لمقدمي الخدمة.", "لا ينبغي للمستخدم إدخال بيانات حساسة في المساعد الذكي. لا يُحفظ سجل المحادثة معه إلا بعد موافقة صريحة، ويمكن إيقاف الحفظ لاحقًا. قد تُنقح أرقام الجوال والهوية والبريد ورموز التحقق قبل المعالجة أو التخزين."] },
      { id: "ip", title: "حقوق الملكية الفكرية", paragraphs: ["تعود حقوق تصميم معاملاتي كير وبرمجياتها ونصوصها وعلاماتها لشركة ستريك إكسبريس أو لأصحاب التراخيص ذات العلاقة. لا يجوز نسخ المنصة أو إعادة نشر محتواها أو استخدام علامتها تجاريًا دون إذن مكتوب، مع بقاء حقوق المستخدم في المحتوى الذي يملكه ويرفعه."] },
      { id: "availability", title: "توافر الخدمة والتغييرات", paragraphs: ["نسعى إلى إتاحة المنصة بصورة مستقرة، لكن قد تتوقف مؤقتًا للصيانة أو التحديث أو لأسباب تقنية أو أمنية. يجوز تعديل خصائص المنصة أو إيقاف جزء منها، وسنحاول إشعار المستخدمين بالتغييرات الجوهرية متى كان ذلك ممكنًا."] },
      { id: "liability", title: "حدود المسؤولية", paragraphs: ["تقدم معاملاتي كير أدوات تنظيم وتواصل ومقارنة، ولا تضمن أداء أي جهة حكومية أو طرف خارجي أو نتيجة طلب خارجة عن سيطرتها. وفي الحدود التي تجيزها الأنظمة، لا تتحمل الشركة الأضرار غير المباشرة الناتجة عن تأخر جهة خارجية أو معلومات غير صحيحة قدمها المستخدم أو مقدم الخدمة.", "لا يحد أي نص هنا من مسؤولية لا يجوز نظامًا استبعادها أو تقييدها."] },
      { id: "termination", title: "التعليق والإنهاء", paragraphs: ["يجوز تعليق الحساب أو إنهاء حق الاستخدام أو إزالة المحتوى عند وجود خرق جوهري لهذه الشروط، أو محاولة احتيال أو اختراق، أو انتهاك حقوق مستخدم آخر، أو استخدام المنصة في نشاط مخالف للأنظمة. لا يمنع الإنهاء من حفظ السجلات التي يلزم الاحتفاظ بها نظامًا أو لحماية الحقوق وتسوية النزاعات."] },
      { id: "changes", title: "تعديل الشروط", paragraphs: ["يجوز تحديث هذه الشروط عند تطوير الخدمات أو تغير المتطلبات النظامية. يظهر تاريخ آخر تحديث أعلى الصفحة، وقد يُطلب قبول النسخة المحدثة عند وجود تغيير جوهري. استمرار الاستخدام بعد نفاذ التحديث يعد قبولًا به في الحدود النظامية."] },
      { id: "law", title: "النظام الواجب التطبيق وتسوية النزاعات", paragraphs: ["تخضع هذه الشروط لأنظمة المملكة العربية السعودية. يبدأ التعامل مع أي ملاحظة أو نزاع بالتواصل مع دعم معاملاتي كير ومحاولة الحل وديًا، وإذا تعذر ذلك تختص الجهة القضائية أو شبه القضائية المختصة في المملكة بالنظر فيه وفق الأنظمة النافذة."] },
      { id: "contact", title: "التواصل", paragraphs: ["تُرسل الاستفسارات المتعلقة بهذه الشروط عبر صفحة «تواصل ودعم» في معاملاتي كير. الجهة المشغلة: شركة ستريك إكسبريس، السجل التجاري 7051197981."] },
    ] satisfies TermsSection[],
  },
  en: {
    title: "Terms and Conditions",
    intro: "These terms govern the use of Maalamati Care, a Streak Express platform, including service requests, quotations, provider selection, updates, attachments, and in-platform conversations.",
    updated: "Last updated: 30 August 2026",
    toc: "On this page",
    noticeTitle: "Working draft — legal review required",
    notice: "I am an AI system, not a lawyer. This is a working draft rather than formal legal advice; a qualified Saudi attorney should review it before final adoption or use in a dispute.",
    acceptance: "By using Maalamati Care or creating a request or account, you confirm that you have read, understood, and accepted these terms. If you do not agree, you must stop using the platform.",
    sections: [
      { id: "definitions", title: "Definitions", paragraphs: ["“Maalamati Care” means the digital platform operated by Streak Express; “User” means any visitor, account holder, or requester; and “Service Provider” means an employee, agent, or organization that submits a quotation or performs a service through the platform."], items: ["“Request” means the information and documents submitted for a service or transaction follow-up.", "“Quotation” means the price, completion time, and any conditions stated before acceptance.", "“Content” means messages, attachments, updates, and reviews submitted through the platform."] },
      { id: "platform", title: "Platform role and service scope", paragraphs: ["Maalamati Care organizes requests, makes eligible requests available to service providers, enables quotation comparison, and supports progress tracking. It is not a government authority and does not represent any entity whose logo may appear as an indication of commonly serviced transactions.", "Outcomes and timelines may depend on request type, document completeness, third-party requirements, and the response of the customer and provider."] },
      { id: "eligibility", title: "Eligibility, accounts, and verification", paragraphs: ["Users must have legal capacity or use the platform under an authorized representative. A verified mobile number is the customer's primary account identifier, and a verification code may be required before requests are displayed or a record is created."], items: ["Verification codes must remain confidential.", "Users are responsible for the accuracy of their account and contact information.", "Access may be suspended where unauthorized use or permission circumvention is suspected."] },
      { id: "requests", title: "Requests and information accuracy", paragraphs: ["Users must provide accurate, sufficient, and current information and may only upload documents they are entitled to use. Missing or inaccurate information may delay, reject, or require resubmission of a request.", "Maalamati Care may request relevant clarification or documents needed to review the service while avoiding unnecessary sensitive information."] },
      { id: "quotes", title: "Quotations and provider selection", paragraphs: ["Eligible providers may submit quotations stating price and completion time. The customer independently selects a quotation, and its display or ordering is not a recommendation or guarantee by Maalamati Care."], items: ["A provider may amend or withdraw a quotation before customer acceptance, subject to request status.", "Accepting one quotation closes the remaining quotations and starts provider confirmation and fulfillment.", "A quotation does not guarantee the decision of a government authority or third party."] },
      { id: "deadlines", title: "Deadlines and fulfillment", paragraphs: ["The platform may set deadlines for quotations, acceptance, or provider confirmation. Expiry may automatically close a stage or reopen selection according to request settings.", "Completion times are estimates unless explicitly stated otherwise and may change because of external requirements, missing documents, or events beyond reasonable control."] },
      { id: "communications", title: "Messages, updates, and attachments", paragraphs: ["The conversation and update record are for information related to an accepted request. They must not be used for unlawful, harmful, or unrelated content.", "Customers see only the provider's name and role under the privacy controls. Providers do not receive customer contact details and see the customer's name only after the applicable assignment or acceptance conditions are met."], items: ["Users should inspect files before opening them and must not upload malicious or infringing files.", "Updates are operational records and are not official certificates issued by a government authority.", "Unsafe or non-compliant files and messages may be removed."] },
      { id: "payments", title: "Fees and payments", paragraphs: ["Maalamati Care does not process payments unless an official payment flow is clearly shown. Until such a flow is enabled, financial settlement is arranged through lawful channels between the customer and provider at their responsibility.", "A provider must clarify whether a price includes government or third-party fees. Such fees are separate unless explicitly included in the quotation."] },
      { id: "conduct", title: "Acceptable use and prohibited conduct", paragraphs: ["The platform may only be used for lawful purposes. Users must not attempt to access data or functions outside their permissions."], items: ["Impersonation or submission of forged or misleading documents.", "Unauthorized penetration testing, disruption, or attempted compromise.", "Malware, spam, abusive content, or unlawful material.", "Harvesting user data or bypassing platform safeguards."] },
      { id: "reviews", title: "Ratings and reviews", paragraphs: ["Customers may rate a completed service. A review must be honest, based on the actual experience, and free of abuse or personal information. Maalamati Care does not create fabricated reviews and may remove non-compliant content after review."] },
      { id: "privacy", title: "Privacy and data protection", paragraphs: ["Data is processed as needed for accounts, mobile verification, requests, quotations, notifications, and support. Role separation limits provider access to contact details and sensitive fields.", "Users should not enter sensitive information into the smart assistant. Conversation history is saved only after explicit consent and saving can be disabled later. Mobile numbers, identity numbers, email addresses, and verification codes may be redacted before processing or storage."] },
      { id: "ip", title: "Intellectual property", paragraphs: ["The platform design, software, text, and Maalamati Care marks belong to Streak Express or their respective licensors. They may not be copied, republished, or used commercially without written permission. Users retain rights in content they lawfully own and upload."] },
      { id: "availability", title: "Availability and platform changes", paragraphs: ["The platform may be temporarily unavailable for maintenance, updates, technical issues, or security reasons. Features may change or be discontinued, and reasonable efforts will be made to notify users of material changes where practical."] },
      { id: "liability", title: "Limitation of liability", paragraphs: ["Maalamati Care provides organization, communication, and comparison tools. It does not guarantee the performance of a government authority or third party, or an outcome beyond its control. To the extent permitted by law, the company is not responsible for indirect loss caused by third-party delay or inaccurate information supplied by a user or provider.", "Nothing in these terms excludes or limits liability that cannot lawfully be excluded or limited."] },
      { id: "termination", title: "Suspension and termination", paragraphs: ["Access may be suspended or terminated, and content removed, for a material breach, attempted fraud or compromise, infringement of another user's rights, or unlawful use. Termination does not prevent retention of records required by law or needed to protect rights and resolve disputes."] },
      { id: "changes", title: "Changes to these terms", paragraphs: ["These terms may be updated as services or legal requirements change. The latest revision date appears above, and material changes may require renewed acceptance. Continued use after an update takes effect constitutes acceptance to the extent permitted by law."] },
      { id: "law", title: "Governing law and disputes", paragraphs: ["These terms are governed by the laws of the Kingdom of Saudi Arabia. Concerns should first be raised through Maalamati Care support for an amicable resolution; unresolved matters are subject to the competent judicial or quasi-judicial authority in the Kingdom." ] },
      { id: "contact", title: "Contact", paragraphs: ["Questions about these terms may be submitted through the Maalamati Care Contact & Support page. Operator: Streak Express, Commercial Registration 7051197981."] },
    ] satisfies TermsSection[],
  },
};

export default function TermsAndConditions() {
  const { isEnglish } = useLanguage();
  const copy = isEnglish ? terms.en : terms.ar;

  return (
    <div className="public-flat min-h-screen overflow-x-hidden bg-[#f5f9ff] text-[#102a43]" dir={isEnglish ? "ltr" : "rtl"}>
      <PublicHeader onChooseService={() => window.location.assign("/#request")} />
      <main>
        <section className="relative overflow-hidden border-b border-[#dce8f6] bg-[#eaf7ff] py-14 sm:py-20">
          <span className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-[#ccecff]/55" />
          <span className="absolute -bottom-28 left-[12%] h-56 w-56 rounded-[4rem] bg-[#a9ead4]/24 rotate-12" />
          <div className="container relative">
            <div className="max-w-4xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-xs font-black text-[#0878f9]"><Scale className="h-4 w-4" />{isEnglish ? "Legal information" : "معلومات قانونية"}</span>
              <h1 className="font-display mt-5 text-4xl font-black tracking-[-0.075em] text-[#102a43] sm:text-6xl"><span className="box-decoration-clone bg-[#0878f9] px-2.5 py-1 text-white">{copy.title}</span></h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-[#526d85] sm:text-lg">{copy.intro}</p>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-bold text-[#60778f]"><span className="rounded-full border border-[#cfe1f1] bg-white/75 px-3 py-1.5">{copy.updated}</span><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#19a961]" />{isEnglish ? "Applies to public and account services" : "تسري على الخدمات العامة وخدمات الحساب"}</span></div>
            </div>
          </div>
        </section>

        <section className="py-10 sm:py-14">
          <div className="container grid gap-8 lg:grid-cols-[270px_minmax(0,1fr)] lg:items-start">
            <aside className="rounded-3xl border border-[#dce8f6] bg-white p-5 shadow-[0_12px_28px_rgba(28,104,182,.06)] lg:sticky lg:top-24">
              <div className="flex items-center gap-2 text-sm font-black text-[#17334f]"><FileText className="h-5 w-5 text-[#0878f9]" />{copy.toc}</div>
              <nav className="mt-4 max-h-[62vh] space-y-1 overflow-y-auto pe-1">
                {copy.sections.map((section, index) => <a key={section.id} href={`#${section.id}`} className="flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-bold leading-5 text-[#60778f] transition-colors hover:bg-[#eef7ff] hover:text-[#0878f9]"><span className="mt-0.5 grid h-5 min-w-5 place-items-center rounded-md bg-[#edf5fc] text-[10px] text-[#0878f9]">{index + 1}</span><span>{section.title}</span></a>)}
              </nav>
            </aside>

            <div className="min-w-0">
              <div className="mb-5 rounded-2xl border border-[#f0d9a4] bg-[#fff9e9] p-5 text-[#6f5318]">
                <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><h2 className="text-sm font-black">{copy.noticeTitle}</h2><p className="mt-2 text-sm leading-7">{copy.notice}</p></div></div>
              </div>
              <div className="mb-5 rounded-2xl border border-[#bfe0fa] bg-[#edf8ff] p-5 text-sm font-bold leading-7 text-[#31516e]">{copy.acceptance}</div>
              <div className="space-y-5">
                {copy.sections.map((section, index) => (
                  <article id={section.id} key={section.id} className="scroll-mt-24 rounded-3xl border border-[#dce8f6] bg-white p-5 shadow-[0_12px_28px_rgba(28,104,182,.05)] sm:p-7">
                    <header className="flex items-start gap-4 border-b border-[#e7eff8] pb-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eaf3ff] text-sm font-black text-[#0878f9]">{index + 1}</span>
                      <h2 className="font-display pt-1 text-xl font-black leading-8 tracking-[-0.04em] text-[#17334f] sm:text-2xl">{section.title}</h2>
                    </header>
                    <div className="mt-5 space-y-4 text-sm leading-8 text-[#526d85] sm:text-base">
                      {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                      {section.items ? <ul className="space-y-3">{section.items.map(item => <li key={item} className="flex items-start gap-3"><CheckCircle2 className="mt-1.5 h-4 w-4 shrink-0 text-[#19a961]" /><span>{item}</span></li>)}</ul> : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
