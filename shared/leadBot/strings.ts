/**
 * Bilingual copy for the Maalamati Care sales assistant, ported from the
 * approved reference engine (brand name aligned with the live site).
 */
import type { Bilingual, Lang } from "./catalog";

export const BOT_MESSAGES = {
  welcome: {
    ar: "أهلًا بك في معاملاتي كير. أنا مساعد المبيعات، أساعدك تحدد خدمتك وتوصلك لعرض مناسب من فريقنا خلال دقائق.",
    en: "Welcome to Maalamati Care. I'm the sales assistant — I'll help you scope your service and get a suitable offer from our team in minutes.",
  },
  welcomeBack: { ar: "أهلًا من جديد. نكمل من حيث توقفنا؟", en: "Welcome back. Shall we continue where we left off?" },
  menuPrompt: { ar: "وش تحب نبدأ فيه؟", en: "What would you like to start with?" },
  privacyNote: {
    ar: "لا تشارك رقم الهوية أو كلمات المرور أو بيانات بطاقتك في المحادثة.",
    en: "Please don't share ID numbers, passwords or card details in the chat.",
  },
  startSales: {
    ar: "ممتاز، بسألك أسئلة قصيرة عشان نجهز لك أفضل عرض.",
    en: "Great — a few short questions so we can prepare the best offer.",
  },
  pricingInfo: {
    ar: "تختلف الأسعار حسب الجهة ونوع المعاملة. بعد إرسال طلبك تصلك عروض من المعقّبين وتقارن السعر ومدة الإنجاز قبل الاختيار، ويقدر فريق المبيعات يعطيك تقديرًا مبدئيًا.",
    en: "Prices depend on the authority and transaction type. After you submit, you receive offers from agents and compare price and turnaround before choosing; our sales team can also give you an initial estimate.",
  },
  pricingInterject: {
    ar: "بخصوص السعر: يختلف حسب الجهة ونوع المعاملة، وراح يوصلك تقدير دقيق بعد ما نكمل البيانات.",
    en: "About price: it depends on the authority and transaction type — you'll get an accurate estimate once we finish.",
  },
  businessInfo: {
    ar: "لدينا حلول للمنشآت: متابعة دورية لمعاملاتكم، مسؤول حساب مخصص، وتقارير منظمة لكل طلب.",
    en: "We offer business plans: recurring handling of your transactions, a dedicated account manager and organised reporting per request.",
  },
  trackInfo: {
    ar: "بعد إرسال طلبك يراجعه فريق معاملاتي كير، ويتواصل معك على رقم الجوال الذي أدخلته عند وجود تحديث أو حاجة إلى معلومة. إذا احتجت مساعدة، افتح قنوات الدعم.",
    en: "After you submit, the Maalamati Care team reviews your request and contacts you on the mobile number you entered when there is an update or they need information. For help, open Support channels.",
  },
  partnerInfo: {
    ar: "يسعدنا انضمامك كمعقّب أو مقدم خدمة. تقدر تسجل مباشرة، أو تترك بياناتك ويتواصل معك فريق الشراكات.",
    en: "We'd love to have you as an agent or service provider. Register directly, or leave your details and our partnerships team will reach out.",
  },
  faqFallback: {
    ar: "سؤال جميل. تجد أغلب الإجابات في قسم الأسئلة الشائعة وصفحة الشروط، ويقدر فريقنا يوضح لك أي تفصيل.",
    en: "Good question. Most answers are in our FAQ and terms pages, and our team can clarify any detail.",
  },
  thanks: { ar: "العفو، في خدمتك دائمًا.", en: "You're welcome — always happy to help." },
  goodbye: { ar: "في أمان الله، ونسعد بخدمتك في أي وقت.", en: "Take care — we're here whenever you need us." },
  resumeQuestion: { ar: "نرجع لسؤالنا:", en: "Back to our question:" },
  acknowledged: { ar: "تمام، سجّلت:", en: "Got it, noted:" },
  fallback: {
    ar: "اعذرني، ما فهمت قصدك بالضبط. تقدر تختار من الخيارات أو تكتبها بطريقة ثانية.",
    en: "Sorry, I didn't quite get that. Pick an option or rephrase it.",
  },
  fallbackOfferHuman: {
    ar: "يبدو إني ما قدرت أساعدك بالشكل المطلوب. تحب أحوّلك لموظف من فريقنا؟",
    en: "Looks like I couldn't help the way you need. Would you like me to connect you with a team member?",
  },
  requiredSlot: {
    ar: "هذي المعلومة ضرورية عشان نقدر نخدمك، وتاخذ ثواني فقط.",
    en: "This detail is required so we can serve you — it only takes a second.",
  },
  skipped: { ar: "ولا يهمك، تخطيناها.", en: "No problem, skipped." },
  invalidPhone: {
    ar: "رقم الجوال غير صحيح. اكتبه بهذا الشكل: 05XXXXXXXX",
    en: "That mobile number doesn't look right. Use this format: 05XXXXXXXX",
  },
  invalidPhoneOfferHuman: {
    ar: "يبدو أن هناك صعوبة في رقم الجوال. تقدر تتواصل مع موظف مباشرة.",
    en: "Having trouble with the number? You can talk to a team member directly.",
  },
  invalidName: {
    ar: "اكتب اسمك بالحروف فقط، مثل: محمد العتيبي",
    en: "Please type your name in letters only, e.g. Sara Ahmed",
  },
  consentDeclined: {
    ar: "مفهوم. بدون موافقتك ما نقدر نحفظ بيانات التواصل. تقدر تكمل طلبك بنفسك من نموذج طلب الخدمة، أو توافق الآن لنتواصل معك.",
    en: "Understood. Without your consent we can't store your contact details. You can submit the service form yourself, or agree now so we can contact you.",
  },
  reviewIntro: { ar: "راجع ملخص طلبك قبل الإرسال:", en: "Review your request summary before sending:" },
  editWhich: { ar: "وش تحب تعدّل؟", en: "What would you like to change?" },
  completed: {
    ar: "تم استلام طلبك بنجاح. سيتواصل معك فريق المبيعات {sla}.",
    en: "Your request was received. Our sales team will contact you {sla}.",
  },
  completedAfterHours: {
    ar: "نحن الآن خارج أوقات الدوام ({hours})، وسيكون طلبك أول ما نبدأ به.",
    en: "We're outside working hours right now ({hours}); your request will be first in line.",
  },
  hotLeadOffer: {
    ar: "طلبك عاجل ومهم لنا. تحب يكلمك موظف الآن مباشرة؟",
    en: "Your request is urgent and important to us. Would you like a team member to talk to you right now?",
  },
  completedFollowUp: {
    ar: "طلبك وصل لفريقنا. تقدر تبدأ نموذج الطلب الآن أو تتابع طلباتك السابقة.",
    en: "Your request reached our team. You can start the service form now or track previous requests.",
  },
  newRequestKeepContact: {
    ar: "أكيد، نبدأ طلبًا جديدًا وبنستخدم نفس بيانات التواصل.",
    en: "Sure — starting a new request with the same contact details.",
  },
  escalatedOnline: {
    ar: "تم تحويل محادثتك لموظف من فريقنا، وسيرد عليك هنا خلال دقائق.",
    en: "You've been connected to our team. A team member will reply here within minutes.",
  },
  escalatedOffline: {
    ar: "فريقنا خارج أوقات الدوام الآن ({hours}). سجّلنا طلبك وبيتواصل معك موظف أول ساعات الدوام.",
    en: "Our team is outside working hours now ({hours}). Your request is logged and a team member will reach you first thing.",
  },
  escalatedNeedPhone: {
    ar: "لتسريع التواصل، اكتب رقم جوالك (اختياري).",
    en: "To speed things up, type your mobile number (optional).",
  },
  complaintAck: {
    ar: "نعتذر عن أي إزعاج، ونأخذ ملاحظتك بجدية.",
    en: "We're sorry for the trouble, and we take your feedback seriously.",
  },
  escalatedWaiting: { ar: "رسالتك وصلت للموظف المختص.", en: "Your message reached the assigned team member." },
  phoneSavedForHandoff: { ar: "تم حفظ رقمك، شكرًا لك.", en: "Your number is saved, thank you." },
  moderationWarning: {
    ar: "خلّنا نحافظ على حوار محترم حتى نقدر نخدمك بأفضل شكل.",
    en: "Let's keep the conversation respectful so we can help you best.",
  },
  moderationClosed: {
    ar: "تم إيقاف المحادثة بسبب تكرار ألفاظ غير لائقة. تقدر تتواصل معنا من صفحة «تواصل ودعم».",
    en: "This chat was stopped due to repeated inappropriate language. You can reach us via the Contact page.",
  },
  tooLong: { ar: "الرسالة طويلة جدًا، اختصرها لو سمحت.", en: "That message is too long — please shorten it." },
  sensitiveMasked: {
    ar: "حجبنا بيانات حساسة من رسالتك لحمايتك. لا حاجة لمشاركتها هنا.",
    en: "We hid sensitive data from your message for your protection. There's no need to share it here.",
  },
  closed: {
    ar: "انتهت هذه المحادثة. تقدر تبدأ محادثة جديدة في أي وقت.",
    en: "This conversation has ended. You can start a new one anytime.",
  },
  disabled: {
    ar: "مساعد المبيعات غير متاح الآن. تقدر تتواصل معنا من صفحة «تواصل ودعم».",
    en: "The sales assistant is unavailable right now. Please use the Contact page.",
  },
  restarted: { ar: "بدأنا من جديد.", en: "Starting fresh." },
  partnerDone: {
    ar: "شكرًا لك، وصلت بياناتك لفريق الشراكات وسيتواصل معك {sla}.",
    en: "Thank you — your details reached our partnerships team, who will contact you {sla}.",
  },
} as const satisfies Record<string, Bilingual>;
export type BotMessageKey = keyof typeof BOT_MESSAGES;

export const BOT_QUESTIONS = {
  service: { ar: "أي خدمة تحتاجها؟", en: "Which service do you need?" },
  serviceBusiness: { ar: "أي خدمة تحتاجها منشأتكم أكثر؟", en: "Which service does your business need most?" },
  partnerService: { ar: "وش الخدمات اللي تقدمها أو تتخصص فيها؟", en: "Which services do you provide or specialise in?" },
  customerType: { ar: "الطلب لك شخصيًا أو لمنشأة؟", en: "Is this for you personally or for a business?" },
  urgency: { ar: "متى تحتاج إنجاز {service}؟", en: "When do you need {service} done?" },
  volume: { ar: "كم معاملة تتوقع تحتاجها منشأتكم شهريًا؟", en: "How many transactions does your business expect monthly?" },
  budget: { ar: "عندك ميزانية تقريبية؟ (اختياري)", en: "Do you have a rough budget? (optional)" },
  city: { ar: "في أي مدينة تكون المعاملة؟ (اختياري)", en: "Which city is it in? (optional)" },
  partnerCity: { ar: "في أي مدينة تعمل؟", en: "Which city do you work in?" },
  name: { ar: "ما اسمك الكريم؟", en: "May I have your name?" },
  phone: {
    ar: "تشرفنا يا {name}. وش رقم جوالك للتواصل؟ (مثال: 05XXXXXXXX)",
    en: "Nice to meet you, {name}. What's your mobile number? (e.g. 05XXXXXXXX)",
  },
  phoneNoName: { ar: "وش رقم جوالك للتواصل؟ (مثال: 05XXXXXXXX)", en: "What's your mobile number? (e.g. 05XXXXXXXX)" },
  contactTime: { ar: "متى يناسبك نتواصل معك؟", en: "When should we contact you?" },
  contactTimeUrgent: { ar: "بما إن طلبك عاجل، متى يناسبك نتواصل؟", en: "Since your request is urgent, when should we contact you?" },
  consent: {
    ar: "هل توافق على تواصل فريق معاملاتي كير معك بخصوص هذا الطلب وحفظ بياناتك وفق سياسة الخصوصية؟",
    en: "Do you agree that the Maalamati Care team may contact you about this request and store your details per our privacy policy?",
  },
} as const satisfies Record<string, Bilingual>;
export type BotQuestionKey = keyof typeof BOT_QUESTIONS;

export const BOT_BUTTONS = {
  startRequest: { ar: "أبغى أطلب خدمة", en: "Request a service" },
  pricing: { ar: "الأسعار والعروض", en: "Prices & offers" },
  business: { ar: "حلول المنشآت", en: "Business plans" },
  track: { ar: "متابعة طلب", en: "Request follow-up" },
  partner: { ar: "أصبح معقّبًا", en: "Become an agent" },
  human: { ar: "تحدث مع موظف", en: "Talk to a person" },
  continueBot: { ar: "أكمل مع المساعد", en: "Continue with assistant" },
  yesHuman: { ar: "نعم، حوّلني لموظف", en: "Yes, connect me" },
  skip: { ar: "تخطي", en: "Skip" },
  confirmSend: { ar: "تأكيد وإرسال", en: "Confirm & send" },
  edit: { ar: "تعديل", en: "Edit" },
  agree: { ar: "أوافق", en: "I agree" },
  disagree: { ar: "لا أوافق", en: "I don't agree" },
  endChat: { ar: "إنهاء المحادثة", en: "End chat" },
  restart: { ar: "محادثة جديدة", en: "New conversation" },
  openRequestForm: { ar: "ابدأ نموذج الطلب", en: "Open service form" },
  openTrack: { ar: "قنوات الدعم والمتابعة", en: "Support & follow-up" },
  openAgentSignup: { ar: "التسجيل كمعقّب", en: "Register as agent" },
  leaveDetails: { ar: "أترك بياناتي", en: "Leave my details" },
  whatsapp: { ar: "راسلنا واتساب", en: "WhatsApp us" },
  contact: { ar: "تواصل ودعم", en: "Contact & support" },
  newRequest: { ar: "طلب جديد", en: "New request" },
  callNow: { ar: "كلمني موظف الآن", en: "Have someone call me now" },
} as const satisfies Record<string, Bilingual>;
export type BotButtonKey = keyof typeof BOT_BUTTONS;

const fill = (template: string, vars: Record<string, string | undefined>) =>
  template.replace(/\{(\w+)\}/g, (_match, key: string) => vars[key] ?? "");

export function botMessage(lang: Lang, key: BotMessageKey, vars: Record<string, string | undefined> = {}): string {
  return fill(BOT_MESSAGES[key][lang], vars);
}

export function botQuestion(lang: Lang, key: BotQuestionKey, vars: Record<string, string | undefined> = {}): string {
  return fill(BOT_QUESTIONS[key][lang], vars);
}

export function botButton(lang: Lang, key: BotButtonKey): string {
  return BOT_BUTTONS[key][lang];
}
