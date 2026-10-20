/**
 * Static catalog for the Maalamati sales assistant, ported from the approved
 * reference engine. Keywords are stored already normalised (normalizeText).
 */
import { normalizeText } from "./text";

export type Lang = "ar" | "en";
export type Bilingual = { ar: string; en: string };

export type CatalogEntry = Bilingual & { id: string; keywords: string[] };

const withNormalizedKeywords = <T extends { keywords: string[] }>(entries: T[]): T[] =>
  entries.map((entry) => ({ ...entry, keywords: entry.keywords.map(normalizeText) }));

export const LEAD_SERVICE_IDS = [
  "commercial_registration",
  "company_formation",
  "municipal_license",
  "labor_qiwa",
  "residency_visas",
  "legal_najiz",
  "zakat_tax",
  "other",
] as const;
export type LeadServiceId = (typeof LEAD_SERVICE_IDS)[number];

export const LEAD_SERVICES: Array<CatalogEntry & { id: LeadServiceId }> = withNormalizedKeywords([
  {
    id: "commercial_registration" as const,
    ar: "السجل التجاري",
    en: "Commercial registration",
    keywords: ["سجل تجاري", "السجل التجاري", "وزاره التجاره", "اسم تجاري", "commercial registration", "cr"],
  },
  {
    id: "company_formation" as const,
    ar: "تأسيس شركة أو مؤسسة",
    en: "Company formation",
    keywords: ["تاسيس", "فتح شركه", "شركه جديده", "مؤسسه جديده", "عقد تاسيس", "formation", "new company"],
  },
  {
    id: "municipal_license" as const,
    ar: "رخص بلدي",
    en: "Balady licenses",
    keywords: ["بلدي", "رخصه بلديه", "رخصه محل", "شهاده صحيه", "رخصه تجاريه", "balady", "municipal"],
  },
  {
    id: "labor_qiwa" as const,
    ar: "قوى والعمالة",
    en: "Qiwa & labor",
    keywords: ["قوي", "عماله", "عقد عمل", "عقود العمل", "رخصه عمل", "نطاقات", "مكتب العمل", "qiwa", "labor"],
  },
  {
    id: "residency_visas" as const,
    ar: "الإقامات والتأشيرات",
    en: "Iqama & visas",
    keywords: [
      "اقامه",
      "الاقامه",
      "تاشيره",
      "تاشيرات",
      "مقيم",
      "ابشر",
      "نقل كفاله",
      "نقل خدمات",
      "خروج وعوده",
      "iqama",
      "visa",
      "absher",
    ],
  },
  {
    id: "legal_najiz" as const,
    ar: "ناجز والوكالات",
    en: "Najiz & power of attorney",
    keywords: ["ناجز", "وكاله", "وكالات", "قضيه", "صك", "توثيق", "najiz", "power of attorney"],
  },
  {
    id: "zakat_tax" as const,
    ar: "الزكاة والضريبة",
    en: "Zakat & VAT",
    keywords: ["زكاه", "الزكاه", "ضريبه", "الضريبه", "فاتوره الكترونيه", "zatca", "vat", "tax"],
  },
  {
    id: "other" as const,
    ar: "خدمة أخرى",
    en: "Other service",
    keywords: ["خدمه اخري", "شي ثاني", "other"],
  },
]);

export const LEAD_CITIES: CatalogEntry[] = withNormalizedKeywords([
  { id: "riyadh", ar: "الرياض", en: "Riyadh", keywords: ["الرياض", "رياض", "riyadh"] },
  { id: "jeddah", ar: "جدة", en: "Jeddah", keywords: ["جده", "جدة", "jeddah", "jedda"] },
  { id: "dammam", ar: "الدمام", en: "Dammam", keywords: ["الدمام", "دمام", "dammam"] },
  { id: "makkah", ar: "مكة المكرمة", en: "Makkah", keywords: ["مكه", "مكه المكرمه", "makkah", "mecca"] },
  { id: "madinah", ar: "المدينة المنورة", en: "Madinah", keywords: ["المدينه المنوره", "المدينه", "madinah", "medina"] },
  { id: "khobar", ar: "الخبر", en: "Khobar", keywords: ["الخبر", "khobar"] },
  { id: "taif", ar: "الطائف", en: "Taif", keywords: ["الطايف", "طايف", "taif"] },
  { id: "abha", ar: "أبها", en: "Abha", keywords: ["ابها", "abha"] },
  { id: "tabuk", ar: "تبوك", en: "Tabuk", keywords: ["تبوك", "tabuk"] },
  { id: "qassim", ar: "القصيم", en: "Qassim", keywords: ["القصيم", "بريده", "qassim", "buraidah"] },
  { id: "hail", ar: "حائل", en: "Hail", keywords: ["حايل", "hail"] },
  { id: "jazan", ar: "جازان", en: "Jazan", keywords: ["جازان", "جيزان", "jazan"] },
  { id: "ahsa", ar: "الأحساء", en: "Al-Ahsa", keywords: ["الاحساء", "الحسا", "ahsa", "hofuf"] },
  { id: "jubail", ar: "الجبيل", en: "Jubail", keywords: ["الجبيل", "jubail"] },
]);

export const LEAD_INTENTS = [
  "talk_to_human",
  "complaint",
  "restart",
  "track_request",
  "become_agent",
  "business_plan",
  "pricing",
  "start_request",
  "edit",
  "skip",
  "faq",
  "thanks",
  "goodbye",
  "greeting",
  "confirm",
  "deny",
] as const;
export type LeadIntent = (typeof LEAD_INTENTS)[number];

const RAW_INTENT_KEYWORDS: Record<LeadIntent, string[]> = {
  talk_to_human: [
    "موظف",
    "بشري",
    "شخص حقيقي",
    "انسان",
    "خدمه العملاء",
    "اكلم احد",
    "ابي اكلم",
    "ابغي اكلم",
    "مندوب",
    "تحويل لموظف",
    "human",
    "real person",
    "representative",
    "customer service",
    "talk to someone",
  ],
  complaint: [
    "شكوي",
    "اشتكي",
    "ابي اشتكي",
    "سيء",
    "سييء",
    "تاخرتوا",
    "تاخرتو",
    "تاخير في طلبي",
    "ما احد رد",
    "محد رد",
    "نصب",
    "احتيال",
    "زعلان",
    "غير راضي",
    "complaint",
    "complain",
    "terrible",
    "scam",
    "not happy",
  ],
  restart: ["ابدا من جديد", "من جديد", "ابدا من البدايه", "اعاده المحادثه", "restart", "start over"],
  track_request: [
    "تتبع",
    "اتتبع",
    "تعقب",
    "وين وصل",
    "وين وصلت",
    "حاله الطلب",
    "حاله طلبي",
    "متابعه طلبي",
    "متابعه الطلب",
    "اتابع طلبي",
    "رقم الطلب",
    "طلبي السابق",
    "track",
    "status of my request",
    "order status",
  ],
  become_agent: [
    "اصير معقب",
    "اكون معقب",
    "اصبح معقب",
    "انضم",
    "كمعقب",
    "تسجيل معقب",
    "سجلوني معقب",
    "اشتغل معكم",
    "اعمل معكم",
    "شراكه",
    "شريك",
    "become an agent",
    "become agent",
    "join as",
    "partner with",
    "work with you",
  ],
  business_plan: [
    "للشركات",
    "خدمات الاعمال",
    "حلول الاعمال",
    "باقه",
    "باقات",
    "عقد شهري",
    "اشتراك",
    "اشتراك شهري",
    "معاملات كثيره",
    "منشاتنا",
    "شركتنا",
    "corporate",
    "business plan",
    "monthly plan",
    "bulk",
  ],
  pricing: [
    "سعر",
    "السعر",
    "اسعار",
    "الاسعار",
    "كم السعر",
    "كم يكلف",
    "كم تكلف",
    "تكلفه",
    "التكلفه",
    "رسوم",
    "بكم",
    "عرض سعر",
    "عروض اسعار",
    "price",
    "pricing",
    "cost",
    "how much",
    "quote",
    "fees",
  ],
  start_request: [
    "ابغي",
    "ابي",
    "اريد",
    "احتاج",
    "محتاج",
    "طلب خدمه",
    "ابدا طلب",
    "اطلب",
    "عندي معامله",
    "ابغي معقب",
    "ابي معقب",
    "تخلصون",
    "i need",
    "i want",
    "request a service",
    "new request",
  ],
  faq: [
    "كيف",
    "وش",
    "ايش",
    "ما هو",
    "ماهو",
    "هل",
    "متي",
    "وين",
    "شروط",
    "ضمان",
    "استرداد",
    "الدفع",
    "طريقه الدفع",
    "مده",
    "how",
    "what",
    "when",
    "where",
    "refund",
    "payment",
  ],
  greeting: ["مرحبا", "السلام عليكم", "سلام", "اهلا", "هلا", "صباح الخير", "مساء الخير", "hi", "hello", "hey", "good morning"],
  thanks: ["شكرا", "يعطيك العافيه", "مشكور", "تسلم", "جزاك الله خير", "thanks", "thank you"],
  goodbye: ["مع السلامه", "باي", "الي اللقاء", "bye", "goodbye"],
  skip: ["تخطي", "تجاوز", "لاحقا", "بعدين", "مو مهم", "ما ابي اقول", "skip", "later"],
  edit: ["تعديل", "عدل", "ابي اعدل", "غير", "تغيير", "edit", "change"],
  confirm: ["نعم", "اي", "ايوه", "ايه", "تمام", "موافق", "اوافق", "اكيد", "صح", "اوكي", "yes", "ok", "okay", "sure", "confirm", "agree"],
  deny: ["لا", "لا شكرا", "مو الحين", "لا اوافق", "no", "not now", "disagree"],
};

export const INTENT_KEYWORDS: Record<LeadIntent, string[]> = Object.fromEntries(
  Object.entries(RAW_INTENT_KEYWORDS).map(([intent, words]) => [intent, words.map(normalizeText)]),
) as Record<LeadIntent, string[]>;

export const LEAD_FIELDS = [
  "service",
  "customerType",
  "urgency",
  "volume",
  "budget",
  "city",
  "name",
  "phone",
  "contactTime",
  "consent",
] as const;
export type LeadField = (typeof LEAD_FIELDS)[number];

/** Fields that cannot be skipped. */
export const REQUIRED_LEAD_FIELDS: LeadField[] = ["service", "customerType", "urgency", "name", "phone", "consent"];
export const isRequiredLeadField = (field: LeadField) => REQUIRED_LEAD_FIELDS.includes(field);

export const CUSTOMER_TYPES = {
  individual: { ar: "لي شخصيًا", en: "For myself" },
  business: { ar: "لمنشأة أو شركة", en: "For a business" },
} as const satisfies Record<string, Bilingual>;
export type CustomerType = keyof typeof CUSTOMER_TYPES;

export const URGENCY_OPTIONS = {
  urgent: { ar: "عاجل خلال 48 ساعة", en: "Urgent, within 48h" },
  week: { ar: "خلال أسبوع", en: "Within a week" },
  month: { ar: "خلال شهر", en: "Within a month" },
  exploring: { ar: "أستفسر فقط حاليًا", en: "Just exploring" },
} as const satisfies Record<string, Bilingual>;
export type Urgency = keyof typeof URGENCY_OPTIONS;

export const VOLUME_OPTIONS = {
  single: { ar: "معاملة واحدة", en: "One transaction" },
  few: { ar: "2 إلى 5 معاملات", en: "2–5 transactions" },
  many: { ar: "أكثر من 5 شهريًا", en: "More than 5 monthly" },
} as const satisfies Record<string, Bilingual>;
export type Volume = keyof typeof VOLUME_OPTIONS;

export const BUDGET_OPTIONS = {
  lt500: { ar: "أقل من 500 ريال", en: "Under SAR 500" },
  "500_2000": { ar: "500 – 2,000 ريال", en: "SAR 500–2,000" },
  gt2000: { ar: "أكثر من 2,000 ريال", en: "Over SAR 2,000" },
  unknown: { ar: "غير محددة", en: "Not decided" },
} as const satisfies Record<string, Bilingual>;
export type Budget = keyof typeof BUDGET_OPTIONS;

export const CONTACT_TIME_OPTIONS = {
  now: { ar: "الآن", en: "Right now" },
  morning: { ar: "صباحًا", en: "Morning" },
  evening: { ar: "مساءً", en: "Evening" },
  whatsapp: { ar: "واتساب فقط", en: "WhatsApp only" },
} as const satisfies Record<string, Bilingual>;
export type ContactTime = keyof typeof CONTACT_TIME_OPTIONS;

export const FIELD_LABELS: Record<LeadField, Bilingual> = {
  service: { ar: "الخدمة", en: "Service" },
  customerType: { ar: "نوع الطلب", en: "Request for" },
  urgency: { ar: "موعد الإنجاز", en: "Timeline" },
  volume: { ar: "حجم المعاملات", en: "Volume" },
  budget: { ar: "الميزانية", en: "Budget" },
  city: { ar: "المدينة", en: "City" },
  name: { ar: "الاسم", en: "Name" },
  phone: { ar: "الجوال", en: "Mobile" },
  contactTime: { ar: "وقت التواصل", en: "Contact time" },
  consent: { ar: "الموافقة على التواصل", en: "Contact consent" },
};

export function serviceLabel(serviceId: string | null | undefined, lang: Lang): string {
  if (!serviceId) return "";
  const service = LEAD_SERVICES.find((entry) => entry.id === serviceId);
  return service ? service[lang] : serviceId;
}
