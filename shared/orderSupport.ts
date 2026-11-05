export type SupportLanguage = "ar" | "en";
export type SupportTurn = { role: "user" | "assistant"; content: string };
export type SupportAction = { label: string; href: string };
export type SupportReply = {
  intent: string;
  text: string;
  suggestions: string[];
  actions: SupportAction[];
  handoff: boolean;
};
export const supportIntents = [
  {
    id: "tracking",
    ar: "حالة الطلب",
    en: "Request status",
    promptAr: "كيف أعرف مستجدات طلبي؟",
    promptEn: "How do I get an update?",
    descriptionAr: "المتابعة والتحقق الآمن",
    descriptionEn: "Request updates and support",
  },
  {
    id: "quotes",
    ar: "عروض الأسعار",
    en: "Price quotes",
    promptAr: "كيف أقارن عروض الأسعار؟",
    promptEn: "How do I compare quotes?",
    descriptionAr: "المقارنة واختيار العرض",
    descriptionEn: "Compare and select a quote",
  },
  {
    id: "delay",
    ar: "تأخر الطلب",
    en: "Delayed request",
    promptAr: "طلبي متأخر، ماذا أفعل؟",
    promptEn: "My request is delayed",
    descriptionAr: "المدة والخطوة التالية",
    descriptionEn: "Turnaround and next steps",
  },
  {
    id: "edit",
    ar: "تعديل الطلب",
    en: "Edit a request",
    promptAr: "أريد تعديل بيانات طلبي",
    promptEn: "I want to edit my request",
    descriptionAr: "تغيير التفاصيل بأمان",
    descriptionEn: "Change details safely",
  },
  {
    id: "cancel",
    ar: "الإلغاء والاسترجاع",
    en: "Cancellation & refund",
    promptAr: "كيف ألغي الطلب؟",
    promptEn: "How can I cancel a request?",
    descriptionAr: "السياسة ومراجعة الفريق",
    descriptionEn: "Policy and team review",
  },
  {
    id: "files",
    ar: "المستندات والمرفقات",
    en: "Documents & files",
    promptAr: "أين أجد مرفقات طلبي؟",
    promptEn: "Where are my request files?",
    descriptionAr: "المحادثة الخاصة بالطلب",
    descriptionEn: "Your private request conversation",
  },
  {
    id: "payment",
    ar: "الدفع والفواتير",
    en: "Payments & invoices",
    promptAr: "لدي سؤال عن الدفع",
    promptEn: "I have a payment question",
    descriptionAr: "إرشادات دون مشاركة بيانات البطاقة",
    descriptionEn: "Guidance without card details",
  },
  {
    id: "account",
    ar: "الدخول إلى الحساب",
    en: "Account access",
    promptAr: "لا أستطيع الدخول إلى حسابي",
    promptEn: "I cannot sign in",
    descriptionAr: "الدخول والتحقق من الجوال",
    descriptionEn: "Sign-in and mobile verification",
  },
  {
    id: "new_request",
    ar: "طلب جديد",
    en: "New request",
    promptAr: "كيف أقدم طلبًا جديدًا؟",
    promptEn: "How do I submit a new request?",
    descriptionAr: "اختيار الخدمة وإرسال التفاصيل",
    descriptionEn: "Choose a service and submit details",
  },
] as const;

export function normalizeSupportText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776))
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function redactSupportText(text: string, maxLength = 1200) {
  return text
    .normalize("NFKC")
    .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776))
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[بيانات محجوبة]")
    .replace(/(?:\+?\d[\d\s-]{4,}\d)/g, "[بيانات محجوبة]")
    .replace(/\b(?:password|otp|cvv|pin)\s*[:=]\s*\S+/gi, "[بيانات محجوبة]")
    .replace(
      /(?:كلمة المرور|كلمه المرور|رمز التحقق|الرمز السري)\s*[:=]\s*\S+/g,
      "[بيانات محجوبة]"
    )
    .trim()
    .slice(0, maxLength);
}
const patterns: [string, RegExp][] = [
  [
    "human",
    /موظف|انسان|بشري|تصعيد|شكوي|شكوى|تواصل مع|human|agent|complaint|person|representative/,
  ],
  ["privacy", /خصوصي|امن|بيانات محجوبه|بطاقتي|privacy|password|otp|cvv|secret/],
  ["cancel", /الغ|استرج|استرد|cancel|refund/],
  [
    "delay",
    /تاخر|متاخر|تاخير|متي|مده|موعد|delay|late|when|turnaround|deadline/,
  ],
  ["edit", /تعديل|اغير|تغيير|عدل|edit|change|modify/],
  ["payment", /دفع|فاتور|سداد|بطاقه|pay|invoice|bill|charged/],
  ["files", /مرفق|مستند|ملف|وثيق|attach|document|file/],
  ["quotes", /عرض|عروض|سعر|اسعار|quote|price|offer/],
  [
    "account",
    /دخول|حساب|تحقق|رمز|تسجيل|login|log in|sign in|account|verification/,
  ],
  [
    "new_request",
    /جديد|اقدم|ارسل طلب|خدمه جديد|new request|submit|new service/,
  ],
  [
    "tracking",
    /تتبع|اتابع|متابع|حاله|حالات|وين طلبي|اين طلبي|track|status|where.*request/,
  ],
  [
    "greeting",
    /^(مرحبا|اهلا|السلام عليكم|هلا|شكرا|شكراً|hello|hi|thanks|thank you)$/,
  ],
];
function classify(text: string): string {
  const normalized = normalizeSupportText(text);
  return patterns.find(([, re]) => re.test(normalized))?.[0] ?? "fallback";
}

export function buildSupportReply(
  language: SupportLanguage,
  turns: SupportTurn[],
  knowledge: { question: string; answer: string }[] = []
): SupportReply {
  const en = language === "en";
  const last = turns.at(-1)?.content ?? "";
  const clean = redactSupportText(last);
  const normalized = normalizeSupportText(clean);
  let intent = classify(clean);
  const prior = turns
    .slice(0, -1)
    .filter(t => t.role === "user")
    .reverse()
    .map(t => classify(t.content))
    .find(i => i !== "fallback" && i !== "greeting" && i !== "privacy");
  if (
    intent === "fallback" &&
    /^(نعم|لا|قبل|بعد|قبل الاعتماد|بعد الاعتماد|تم الاعتماد|لم اعتمد|كيف|اين|وين|ما الخطوه التاليه|yes|no|before|after|accepted|not yet|how|where|what next)$/.test(
      normalized
    ) &&
    prior
  )
    intent = prior;
  const action = (labelAr: string, labelEn: string, href: string) => ({
    label: en ? labelEn : labelAr,
    href,
  });
  const account = action("فتح طلباتي", "Open my requests", "/customer-account");
  const contact = action("قنوات الدعم", "Support channels", "/contact");
  const entries: Record<
    string,
    {
      ar: string;
      en: string;
      actions: SupportAction[];
      arSuggestions: string[];
      enSuggestions: string[];
    }
  > = {
    tracking: {
      ar: "بعد إرسال الطلب يراجعه فريق معاملاتي كير، ويتواصل معك على رقم الجوال الذي أدخلته عند وجود تحديث أو حاجة إلى معلومة. لا أستطيع الاطلاع على بيانات طلبك من هذه المحادثة.\nهل تريد معرفة معنى الحالة أم التواصل مع فريق الدعم؟",
      en: "After you submit, the Maalamati Care team reviews your request and contacts you on the mobile number you entered when there is an update or they need information. I cannot access your request details in this chat.\nWould you like help understanding a status or contacting support?",
      actions: [contact],
      arSuggestions: ["ما معنى حالات الطلب؟", "أين أجد مرفقات طلبي؟"],
      enSuggestions: [
        "What do request statuses mean?",
        "Where are my request files?",
      ],
    },
    quotes: {
      ar: "من «طلباتي» افتح الطلب وقارن عروض مقدمي الخدمة بحسب السعر ومدة الإنجاز، ثم اختر العرض المناسب. لا أستطيع تقديم سعر أو اعتماد عرض نيابةً عنك.\nهل سؤالك قبل اعتماد العرض أم بعده؟",
      en: "Open your request in My requests and compare providers by price and turnaround before choosing an offer. I cannot quote a price or accept an offer for you.\nIs your question before or after accepting an offer?",
      actions: [account],
      arSuggestions: ["قبل الاعتماد", "بعد الاعتماد"],
      enSuggestions: ["Before", "After"],
    },
    delay: {
      ar: "راجع آخر تحديث ومدة الإنجاز في العرض المعتمد من «طلباتي». إن تجاوز الطلب المدة الموضحة، تواصل مع مقدم الخدمة داخل محادثة الطلب أو اطلب مراجعة فريق الدعم. لا يمكنني ضمان موعد جديد.\nهل تم اعتماد عرض للطلب؟",
      en: "Review the latest update and the accepted quote's turnaround in My requests. If it has exceeded that time, message your provider in the request conversation or ask support to review it. I cannot guarantee a new date.\nHas an offer been accepted?",
      actions: [account],
      arSuggestions: ["تم الاعتماد", "لم أعتمد", "أريد التحدث مع موظف"],
      enSuggestions: ["Accepted", "Not yet", "Talk to a human"],
    },
    edit: {
      ar: "التعديل يعتمد على مرحلة الطلب. افتح «طلباتي» وراجع التفاصيل، وبعد اعتماد العرض اكتب التغيير المطلوب في محادثة الطلب ليؤكده مقدم الخدمة. لا أغيّر الطلب تلقائيًا.\nهل طلبك قبل الاعتماد أم بعده؟",
      en: "Changes depend on the request stage. Review it in My requests. After acceptance, describe the change in its private conversation so your provider can confirm it. I do not change requests automatically.\nIs it before or after acceptance?",
      actions: [account],
      arSuggestions: ["قبل الاعتماد", "بعد الاعتماد"],
      enSuggestions: ["Before", "After"],
    },
    cancel: {
      ar: "الإلغاء أو الاسترجاع يخضع لسياسة الإلغاء والاسترجاع ومرحلة تنفيذ الطلب. راجع السياسة ثم اطلب من الفريق مراجعة حالتك. هذه المحادثة لا تنفذ الإلغاء ولا تضمن استردادًا.\nهل تريد مراجعة السياسة أم التحدث مع فريق الدعم؟",
      en: "Cancellation or refund depends on the policy and request stage. Read the policy and ask the team to review your case. This chat does not cancel requests or guarantee a refund.\nWould you like to read the policy or speak to support?",
      actions: [
        action(
          "سياسة الإلغاء والاسترجاع",
          "Cancellation & refund policy",
          "/refund-and-cancellation"
        ),
        account,
      ],
      arSuggestions: ["أريد التحدث مع موظف"],
      enSuggestions: ["Talk to a human"],
    },
    files: {
      ar: "يحفظ فريق العمل المرفقات والتحديثات في سجل طلبك، ويتواصل معك على رقم الجوال الذي أدخلته بشأن أي مستند مطلوب أو تحديث. لإرسال مستند أو الاستفسار، استخدم قنوات الدعم.",
      en: "The team keeps attachments and updates in your request record and contacts you on the mobile number you entered about any required document or update. Use Support channels to send a document or ask a question.",
      actions: [contact],
      arSuggestions: ["لا أستطيع الدخول إلى حسابي", "أريد التحدث مع موظف"],
      enSuggestions: ["I cannot sign in", "Talk to a human"],
    },
    payment: {
      ar: "راجع تفاصيل العرض المعتمد والملاحظات داخل طلبك. إذا كان لديك استفسار عن دفع أو فاتورة، اطلب مراجعة فريق الدعم. لا ترسل بيانات البطاقة أو رقمها أو رمزها السري؛ ولا تنفذ هذه المحادثة أي عملية دفع.\nهل الاستفسار عن فاتورة أم مشكلة دفع؟",
      en: "Review your accepted offer and request notes. For a payment or invoice question, ask support to review it. Do not share card numbers or security codes; this chat does not process payments.\nIs this about an invoice or a payment issue?",
      actions: [account, contact],
      arSuggestions: ["أريد التحدث مع موظف"],
      enSuggestions: ["Talk to a human"],
    },
    account: {
      ar: "تسجيل الدخول بالجوال متوقف مؤقتًا إلى أن نربط خدمة تحقق حقيقية. لا ترسل أي رمز أو بيانات خاصة في هذه المحادثة. لإرسال طلب أو متابعة حالة طلب سابق، استخدم قنوات الدعم.",
      en: "Mobile sign-in is temporarily paused until a real verification service is connected. Never share a code or private information in this chat. Use Support channels to send a request or ask about an existing one.",
      actions: [contact],
      arSuggestions: ["أريد التحدث مع موظف", "كيف أعرف مستجدات طلبي؟"],
      enSuggestions: ["Talk to a human", "How do I get an update?"],
    },
    new_request: {
      ar: "اختر الخدمة من نموذج الطلب، واكتب اسمك ورقم جوالك والتفاصيل الأساسية ثم أرسل الطلب. يصل مباشرة إلى فريقنا، ويتواصل معك على الرقم الذي أدخلته عند وجود تحديث.\nهل تحتاج متابعة معاملة أم طلب خدمة؟",
      en: "Choose a service in the request form, enter your name, mobile number and essential details, then send it. It goes directly to our team, who contacts you on the number you entered when there is an update.\nDo you need transaction follow-up or a service request?",
      actions: [action("بدء طلب جديد", "Start a new request", "/#request")],
      arSuggestions: ["كيف تعمل عروض الأسعار؟", "كيف أعرف مستجدات طلبي؟"],
      enSuggestions: ["How do I compare quotes?", "How do I get an update?"],
    },
    human: {
      ar: "يمكنني تجهيز المحادثة لمراجعة فريق الدعم بعد موافقتك على حفظ سجلها. اضغط «طلب موظف» لتأكيد الإرسال؛ لم يتم التصعيد بعد. لا أستطيع تأكيد وجود موظف متصل أو تحديد موعد الرد.",
      en: "With your permission to save the conversation, I can send it to support for review. Select Request a human to confirm; it has not been escalated yet. I cannot promise an online agent or response time.",
      actions: [contact],
      arSuggestions: [],
      enSuggestions: [],
    },
    privacy: {
      ar: "لحماية خصوصيتك، لا تشارك رقم الجوال أو الهوية أو كلمة المرور أو رمز التحقق أو بيانات البطاقة. نحجب الأنماط الرقمية والبريد قبل المعالجة والحفظ، لكن تجنّب إرسال أي بيانات حساسة من الأساس. افتح «طلباتي» للمعلومات الخاصة بطلبك.",
      en: "Do not share mobile or ID numbers, passwords, verification codes, or card details. We redact number patterns and emails before processing and saving, but avoid sending sensitive information in the first place. Use My requests for private details.",
      actions: [account],
      arSuggestions: ["كيف أعرف مستجدات طلبي؟"],
      enSuggestions: ["How do I get an update?"],
    },
    greeting: {
      ar: "أهلًا بك! أنا مساعد دعم الطلبات في معاملاتي كير. أساعدك في متابعة الطلبات والعروض والمستندات، وأوصلك إلى الخطوة المناسبة دون طلب بياناتك الخاصة.\nبماذا أستطيع مساعدتك؟",
      en: "Welcome! I am Maalamati Care's request support assistant. I can help with request follow-up, quotes and documents, and guide you without asking for private data.\nHow can I help?",
      actions: [],
      arSuggestions: ["كيف أعرف مستجدات طلبي؟", "كيف أقارن عروض الأسعار؟"],
      enSuggestions: ["How do I get an update?", "How do I compare quotes?"],
    },
    fallback: {
      ar: "لم أفهم سؤالك بشكل كافٍ. أساعد في طلبات معاملاتي كير فقط، ولا أريد إعطاءك إجابة غير مؤكدة.\nهل تقصد حالة الطلب، عروض الأسعار، أم تعديل الطلب؟ يمكنك أيضًا طلب موظف.",
      en: "I did not understand enough to give a reliable answer. I help with Maalamati Care requests only.\nDo you mean request status, quotes, or changes? You can also request a human.",
      actions: [contact],
      arSuggestions: [
        "كيف أعرف مستجدات طلبي؟",
        "كيف أقارن عروض الأسعار؟",
        "أريد التحدث مع موظف",
      ],
      enSuggestions: [
        "How do I get an update?",
        "How do I compare quotes?",
        "Talk to a human",
      ],
    },
  };
  const entry = entries[intent] ?? entries.fallback;
  let text = en ? entry.en : entry.ar;
  if (intent === "tracking" && /معني|حالات|mean|statuses/.test(normalized))
    text = en
      ? "Received: submitted and awaiting review. In review: being assessed. In progress: being processed. Completed: processing is complete. Open My requests to see your actual status and latest update."
      : "«تم الاستلام»: أُرسل الطلب وهو بانتظار المراجعة. «قيد المراجعة»: تُراجع تفاصيله. «قيد التنفيذ»: بدأت إجراءات تنفيذه. «مكتمل»: اكتملت المعالجة. افتح «طلباتي» للاطلاع على حالتك الفعلية وآخر تحديث.";
  if (
    (intent === "quotes" || intent === "edit") &&
    /^(بعد|بعد الاعتماد|after)$/.test(normalized)
  )
    text = en
      ? "After accepting an offer, use the private request conversation to agree any changes with your provider. I cannot change the accepted offer or request. Would you like to open My requests or request human support?"
      : "بعد اعتماد العرض، استخدم المحادثة الخاصة بالطلب للاتفاق مع مقدم الخدمة على أي تغيير. لا أستطيع تعديل العرض المعتمد أو الطلب. هل تريد فتح «طلباتي» أم طلب مساعدة بشرية؟";
  if (
    (intent === "quotes" || intent === "edit") &&
    /^(قبل|قبل الاعتماد|before)$/.test(normalized)
  )
    text = en
      ? "Before acceptance, review your request and compare available offers by price and time. If details need correction, ask support to review them before choosing an offer."
      : "قبل الاعتماد، راجع تفاصيل طلبك وقارن العروض المتاحة بحسب السعر والمدة. إذا احتاجت التفاصيل إلى تصحيح، اطلب مراجعتها من الدعم قبل اختيار العرض.";
  if (intent === "delay" && /^(لم اعتمد|not yet|لا|no)$/.test(normalized))
    text = en
      ? "If no offer has been accepted yet, review the available quotes in My requests. The quoted turnaround relates to the selected service; do not assume processing has started. Ask support if no offer is available."
      : "إذا لم تعتمد عرضًا بعد، راجع العروض المتاحة في «طلباتي». مدة الإنجاز ترتبط بالخدمة المختارة؛ لا تفترض أن التنفيذ بدأ. اطلب مراجعة الدعم إذا لم تتوفر عروض.";
  if (intent === "fallback") {
    const words = normalized.split(" ").filter(w => w.length > 2);
    const matched = knowledge.slice(0, 40).find(k => {
      const question = normalizeSupportText(k.question);
      const overlaps = words.filter(w =>
        question.split(" ").includes(w)
      ).length;
      return (
        question === normalized ||
        (words.length >= 3 && overlaps >= 3 && overlaps / words.length >= 0.75)
      );
    });
    if (matched) {
      intent = "knowledge";
      text = redactSupportText(matched.answer);
    } else if (
      turns
        .slice(0, -1)
        .filter(t => t.role === "user")
        .slice(-2)
        .some(t => classify(t.content) === "fallback")
    )
      text = en
        ? "I still cannot identify the right answer. To avoid repeating unhelpful suggestions, I recommend human support. Select Request a human to review and confirm the handoff."
        : "ما زلت غير قادر على تحديد الإجابة المناسبة. بدل تكرار اقتراحات غير مفيدة، أنصحك بمساعدة بشرية. اضغط «طلب موظف» لمراجعة التصعيد وتأكيده.";
  }
  return {
    intent,
    text,
    actions: entry.actions,
    suggestions: en ? entry.enSuggestions : entry.arSuggestions,
    handoff: intent === "human" || intent === "fallback",
  };
}
