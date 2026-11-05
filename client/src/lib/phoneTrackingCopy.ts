/**
 * Public copy that depends on mobile-number (OTP) tracking.
 *
 * Tracking by mobile number is paused on the live site until a real SMS/WhatsApp
 * verification provider is connected. While it is paused, public copy explains
 * that the team follows up instead.
 */
export const PHONE_TRACKING_PAUSED: boolean = import.meta.env.PROD;

export type FaqEntry = readonly [question: string, answer: string];

export type HomeTrackingCopy = {
  heroLead: string;
  whyItem: { title: string; text: string };
  followCard: { kicker: string; title: string; body: string; cta: string; href: string };
  faq: readonly [FaqEntry, FaqEntry];
  serviceLabel: string;
  footerTrackLink: { label: string; href: string };
};

export type ArabicServiceCopy = {
  individualTrack: string;
  individualRequest: string;
  businessTrack: string;
  featuredTrack: string;
  featuredIntro: string;
};

export type EnglishServiceCopy = {
  trackServiceName: string;
  individualTrack: string;
  individualRequest: string;
  businessTrack: string;
  trustStrip: string;
};

const liveCopy: Record<"ar" | "en", HomeTrackingCopy> = {
  ar: {
    heroLead: "اختر الخدمة، واكتب التفاصيل الأساسية، ثم قارن السعر ومدة الإنجاز وتابع جميع التحديثات باستخدام رقم جوالك.",
    whyItem: { title: "تتبّع برقم الجوال", text: "تحقق من جوالك ثم راجع جميع طلباتك في مكان واحد." },
    followCard: { kicker: "متابعة مستقلة", title: "تتبّع برقم جوالك", body: "أدخل رقم الجوال، ثم تحقق من الرمز لمراجعة الحالة والردود والمرفقات.", cta: "تتبع طلبك", href: "/track" },
    faq: [
      ["كيف أتابع طلبي؟", "افتح صفحة التتبع، وأدخل رقم جوالك، ثم تحقق من الرمز لعرض جميع طلباتك."],
      ["هل تظهر المرفقات في صفحة التتبع؟", "تظهر المرفقات التي يضيفها فريق العمل ضمن سجل التحديثات المرتبط بطلبك."],
    ],
    serviceLabel: "تعقّب المعاملات",
    footerTrackLink: { label: "تعقّب المعاملات", href: "/track" },
  },
  en: {
    heroLead: "Choose the service, submit the essential details, then compare price and completion time and follow every update through your mobile number.",
    whyItem: { title: "Mobile-number tracking", text: "Verify your mobile number to review all your requests in one place." },
    followCard: { kicker: "Independent tracking", title: "Track with your mobile number", body: "Enter your mobile number, verify the code, then review the status, replies, and attachments.", cta: "Track your request", href: "/track" },
    faq: [
      ["How do I track my request?", "Open the tracking page, enter your mobile number, and verify the code to view your requests."],
      ["Do attachments appear in tracking?", "Files added by the team appear in the update record linked to your request."],
    ],
    serviceLabel: "Track requests",
    footerTrackLink: { label: "Track requests", href: "/track" },
  },
};

const pausedCopy: Record<"ar" | "en", HomeTrackingCopy> = {
  ar: {
    heroLead: "اختر الخدمة واكتب التفاصيل الأساسية، ثم يراجع فريقنا طلبك ويعود إليك بالسعر ومدة الإنجاز.",
    whyItem: { title: "متابعة من فريقنا", text: "فريق معاملاتي كير يتابع طلبك ويطلعك على كل مستجد فيه." },
    followCard: { kicker: "بعد الإرسال", title: "فريقنا يتابع طلبك", body: "نراجع طلبك ونتواصل معك على رقم الجوال الذي أدخلته، وتبقى الردود والمرفقات محفوظة في سجل الطلب.", cta: "أرسل طلبك", href: "/#request" },
    faq: [
      ["كيف أعرف مستجدات طلبي؟", "بعد إرسال الطلب يراجعه فريقنا، ثم يتواصل معك على رقم الجوال الذي أدخلته كلما استجد شيء."],
      ["هل أحتاج إلى حساب لإرسال طلب؟", "لا. يكفي إدخال اسمك ورقم جوالك وتفاصيل الطلب في النموذج، ويصل طلبك مباشرة إلى فريقنا."],
    ],
    serviceLabel: "تعقّب المعاملات",
    footerTrackLink: { label: "تعقّب المعاملات", href: "/#request" },
  },
  en: {
    heroLead: "Choose the service and submit the essential details; our team reviews your request and gets back to you with the price and completion time.",
    whyItem: { title: "Team follow-up", text: "The Maalamati Care team follows your request and keeps you informed of every change." },
    followCard: { kicker: "After you submit", title: "Our team follows up", body: "We review your request and contact you on the mobile number you entered, and replies and attachments stay in the request record.", cta: "Send your request", href: "/#request" },
    faq: [
      ["How will I hear about my request?", "After you submit, our team reviews your request and contacts you on the mobile number you entered whenever there is an update."],
      ["Do I need an account to send a request?", "No. Enter your name, mobile number, and the request details in the form, and it goes straight to our team."],
    ],
    serviceLabel: "Transaction follow-up",
    footerTrackLink: { label: "Transaction follow-up", href: "/#request" },
  },
};

const liveServiceCopy: ArabicServiceCopy = {
  individualTrack: "راجع حالة طلبك ورسائل فريق العمل باستخدام رقم جوالك.",
  individualRequest: "أرسل احتياجك في خطوات قصيرة، ثم تابع ما يتم عليه.",
  businessTrack: "تابع مراحل المعاملة برقم جوالك دون رسائل متفرقة.",
  featuredTrack: "افتح مسار المتابعة وراجع آخر ما تم على طلبك.",
  featuredIntro: "اختر خدمة واضحة، أرسل التفاصيل، ثم عد إلى سجل واحد لمتابعة ما يتم.",
};

const pausedServiceCopy: ArabicServiceCopy = {
  individualTrack: "أرسل بيانات معاملتك ليتابعها فريقنا ويطلعك على مستجداتها.",
  individualRequest: "أرسل احتياجك في خطوات قصيرة، ويتولى فريقنا مراجعته.",
  businessTrack: "سلّم متابعة المعاملة لفريقنا، وتصلك المستجدات دون رسائل متفرقة.",
  featuredTrack: "أرسل تفاصيل المعاملة، ويتابع فريقنا آخر ما تم عليها.",
  featuredIntro: "اختر خدمة واضحة وأرسل التفاصيل، ويتولى فريقنا متابعة ما يتم.",
};

const liveEnglishServiceCopy: EnglishServiceCopy = {
  trackServiceName: "Track a transaction",
  individualTrack: "Review your request status and team messages through one clear record.",
  individualRequest: "Share what you need in a few steps, then follow the work in one place.",
  businessTrack: "Follow each stage through one record rather than scattered messages.",
  trustStrip: "Orderly tracking",
};

const pausedEnglishServiceCopy: EnglishServiceCopy = {
  trackServiceName: "Transaction follow-up",
  individualTrack: "Send your transaction details; our team follows it up and keeps you informed.",
  individualRequest: "Share what you need in a few steps, and our team takes it from there.",
  businessTrack: "Hand the follow-up to our team and get updates without scattered messages.",
  trustStrip: "Orderly follow-up",
};

export function homeTrackingCopy(isEnglish: boolean, paused: boolean = PHONE_TRACKING_PAUSED): HomeTrackingCopy {
  return (paused ? pausedCopy : liveCopy)[isEnglish ? "en" : "ar"];
}

export function arabicServiceCopy(paused: boolean = PHONE_TRACKING_PAUSED): ArabicServiceCopy {
  return paused ? pausedServiceCopy : liveServiceCopy;
}

export function englishServiceCopy(paused: boolean = PHONE_TRACKING_PAUSED): EnglishServiceCopy {
  return paused ? pausedEnglishServiceCopy : liveEnglishServiceCopy;
}

export type WelcomeCopy = {
  intro: string;
  footnote: string;
  features: readonly [
    { title: string; body: string },
    { title: string; body: string },
    { title: string; body: string },
  ];
};

const liveWelcomeCopy: Record<"ar" | "en", WelcomeCopy> = {
  ar: {
    intro: "من طلب الخدمة إلى آخر تحديث، اجعل رحلة معاملتك واضحة ومترابطة في مكان واحد.",
    footnote: "ترحيب مختصر، وطلباتك دائمًا على بُعد خطوة.",
    features: [
      { title: "اطلب خدمتك", body: "ابدأ بما تحتاجه من خدمات." },
      { title: "تابع كل خطوة", body: "طلباتك وتحديثاتها في مكان واحد." },
      { title: "ابقَ على تواصل", body: "راسل مقدم الخدمة داخل طلبك." },
    ],
  },
  en: {
    intro: "From your first service request to the next update, keep your journey clear and connected.",
    footnote: "A short introduction. Your requests are always one step away.",
    features: [
      { title: "Request a service", body: "Start with what you need." },
      { title: "Follow every step", body: "Keep requests and updates together." },
      { title: "Stay connected", body: "Message your service provider in your request." },
    ],
  },
};

const pausedWelcomeCopy: Record<"ar" | "en", WelcomeCopy> = {
  ar: {
    intro: "من إرسال طلب الخدمة إلى تواصل فريقنا معك، اجعل رحلة معاملتك واضحة ومترابطة في مكان واحد.",
    footnote: "ترحيب مختصر. أرسل طلبك، وسيتواصل معك فريقنا عند وجود تحديث.",
    features: [
      { title: "اطلب خدمتك", body: "ابدأ بما تحتاجه من خدمات." },
      { title: "فريقنا يتابع", body: "يراجع فريقنا طلبك ويطلعك على مستجداته." },
      { title: "ابقَ على تواصل", body: "تواصل مع فريق الدعم عند الحاجة." },
    ],
  },
  en: {
    intro: "From sending your service request to hearing from our team, keep your journey clear and connected.",
    footnote: "A short introduction. Send your request and our team will contact you when there is an update.",
    features: [
      { title: "Request a service", body: "Start with what you need." },
      { title: "Our team follows up", body: "We review your request and keep you informed." },
      { title: "Stay connected", body: "Contact support whenever you need help." },
    ],
  },
};

export function welcomeCopy(isEnglish: boolean, paused: boolean = PHONE_TRACKING_PAUSED): WelcomeCopy {
  return (paused ? pausedWelcomeCopy : liveWelcomeCopy)[isEnglish ? "en" : "ar"];
}
