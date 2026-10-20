/**
 * Rule-based understanding for the sales assistant (ported from the
 * reference engine): intent detection, slot extraction from free text and
 * quick-reply value parsing.
 */
import {
  INTENT_KEYWORDS,
  LEAD_CITIES,
  LEAD_INTENTS,
  LEAD_SERVICES,
  type Budget,
  type ContactTime,
  type CustomerType,
  type LeadField,
  type LeadIntent,
  type LeadServiceId,
  type Urgency,
  type Volume,
} from "./catalog";
import { normalizeText, parseSaudiMobile, toAsciiDigits } from "./text";

export type LeadSlots = {
  service?: LeadServiceId;
  customerType?: CustomerType;
  urgency?: Urgency;
  volume?: Volume;
  budget?: Budget;
  /** A catalog city id or a free-text city name. */
  city?: string;
  name?: string;
  phone?: string;
  contactTime?: ContactTime;
  consent?: boolean;
};

/** Normalised variants with common Arabic prefixes (و/ف/ب/ك/ل/ال) folded. */
export function tokenVariants(value: string): string[] {
  const base = normalizeText(value);
  const withoutConjunctions = base
    .split(" ")
    .map((word) => {
      if (word.length > 4 && /^(وال|فال|بال|كال)/.test(word)) return `ال${word.slice(3)}`;
      if (word.length > 3 && /^لل/.test(word)) return `ال${word.slice(2)}`;
      if (word.length > 3 && /^[وفبلك]/.test(word)) return word.slice(1);
      return word;
    })
    .join(" ");
  const withoutArticle = withoutConjunctions
    .split(" ")
    .map((word) => (word.length > 4 && word.startsWith("ال") ? word.slice(2) : word))
    .join(" ");
  return Array.from(new Set([base, withoutConjunctions, withoutArticle])).map((variant) => ` ${variant} `);
}

function variantsInclude(variants: string[], normalizedPhrase: string): boolean {
  const padded = ` ${normalizedPhrase} `;
  return variants.some((variant) => variant.includes(padded));
}

function variantsIncludeAny(variants: string[], phrases: string[]): boolean {
  return phrases.some((phrase) => variantsInclude(variants, normalizeText(phrase)));
}

const LOW_CONFIDENCE_INTENTS: LeadIntent[] = ["faq", "greeting", "confirm", "deny", "start_request"];

export type DetectedIntent = { intent: LeadIntent | "unknown"; confidence: number };

/** First matching intent in priority order (LEAD_INTENTS). */
export function detectIntent(value: string): DetectedIntent {
  const variants = tokenVariants(value);
  for (const intent of LEAD_INTENTS) {
    if (INTENT_KEYWORDS[intent].some((keyword) => variantsInclude(variants, keyword))) {
      return { intent, confidence: LOW_CONFIDENCE_INTENTS.includes(intent) ? 0.6 : 0.9 };
    }
  }
  return { intent: "unknown", confidence: 0 };
}

const CUSTOMER_TYPE_WORDS: Record<CustomerType, string[]> = {
  business: ["شركه", "شركتي", "شركتنا", "مؤسسه", "مؤسستي", "منشاه", "منشاتي", "منشاتنا", "للشركه", "company", "business", "corporate"],
  individual: ["شخصي", "شخصيا", "لي شخصيا", "فرد", "لنفسي", "لي انا", "عائلي", "individual", "personal", "myself", "for me"],
};

const URGENCY_WORDS: Record<Urgency, string[]> = {
  urgent: ["عاجل", "مستعجل", "ضروري", "اليوم", "بكره", "باسرع وقت", "بسرعه", "فوري", "خلال يومين", "48 ساعه", "urgent", "asap", "today", "tomorrow"],
  week: ["هالاسبوع", "خلال اسبوع", "اسبوع", "الاسبوع", "this week", "within a week", "week"],
  month: ["هالشهر", "خلال شهر", "شهر", "الشهر الجاي", "this month", "within a month", "month"],
  exploring: ["استفسار", "استفسر", "استكشاف", "مو مستعجل", "مب مستعجل", "اتعرف", "just exploring", "not sure", "exploring"],
};

const VOLUME_WORDS: Record<Volume, string[]> = {
  many: ["اكثر من 5", "كثير", "كثيره", "شهري", "شهريا", "بشكل دوري", "دوري", "مستمر", "عقد سنوي", "many", "monthly", "recurring", "more than 5"],
  few: ["معاملتين", "كم معامله", "عده معاملات", "2 الي 5", "few", "several", "2 5"],
  single: ["معامله وحده", "معامله واحده", "مره وحده", "وحده", "واحده", "one", "single", "only one"],
};

const CONTACT_TIME_WORDS: Record<ContactTime, string[]> = {
  whatsapp: ["واتس", "واتساب", "الواتس", "whatsapp"],
  now: ["الحين", "الان", "حالا", "فورا", "now", "right now"],
  morning: ["صباح", "الصبح", "صباحا", "الصباح", "morning"],
  evening: ["مساء", "المساء", "مساءا", "بالليل", "العصر", "evening", "night"],
};

function firstMatchingKey<K extends string>(variants: string[], table: Record<K, string[]>): K | undefined {
  for (const key of Object.keys(table) as K[]) {
    if (variantsIncludeAny(variants, table[key])) return key;
  }
  return undefined;
}

function parseAmount(value: string): number | null {
  const match = toAsciiDigits(value)
    .replace(/[,٬]/g, "")
    .match(/(\d+(?:\.\d+)?)\s*(الف|ألف|آلاف|k)?/i);
  if (!match) return null;
  let amount = Number(match[1]);
  if (match[2]) amount *= 1000;
  return Number.isFinite(amount) ? amount : null;
}

function extractBudget(raw: string, variants: string[]): Budget | undefined {
  if (variantsIncludeAny(variants, ["غير محدده", "ما ادري", "مدري", "مو محدد", "not decided", "no idea"])) return "unknown";
  const amount = /ريال|sar|ر\.س|الف|ألف|budget|ميزاني/i.test(raw) ? parseAmount(raw) : null;
  if (amount === null) return undefined;
  if (amount < 500) return "lt500";
  if (amount <= 2000) return "500_2000";
  return "gt2000";
}

function extractVolume(raw: string, variants: string[]): Volume | undefined {
  const match = toAsciiDigits(raw).match(/(\d+)\s*(معامل|transaction)/i);
  if (match) {
    const count = Number(match[1]);
    return count <= 1 ? "single" : count <= 5 ? "few" : "many";
  }
  return firstMatchingKey(variants, VOLUME_WORDS);
}

function extractPhone(raw: string): { phone?: string; attempted: boolean } {
  const compact = toAsciiDigits(raw).replace(/[\s\-()]/g, "");
  const match = compact.match(/(?:\+?966|00966|0)?5\d{8}/);
  if (match) {
    const phone = parseSaudiMobile(match[0]);
    if (phone) return { phone, attempted: true };
  }
  return { attempted: compact.replace(/\D/g, "").length >= 3 };
}

const NAME_PREFIX = /^(اسمي|انا اسمي|انا|معك|my name is|i am|i'm|this is)\s+/i;
const LETTERS_ONLY_NAME = new RegExp("^[\\p{L}\\s'-]+$", "u");
const LETTERS_ONLY_CITY = new RegExp("^[\\p{L}\\s-]+$", "u");
const INLINE_NAME = new RegExp("(?:اسمي|my name is)\\s+([\\p{L}]+(?:\\s[\\p{L}]+){0,2})", "iu");

/** A plausible personal name (letters only, 1–4 words, 2–40 chars). */
export function parseName(raw: string): string | undefined {
  const name = raw
    .replace(NAME_PREFIX, "")
    .replace(/[.,!؟?،]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!name || /\d/.test(name) || name.split(" ").length > 4 || name.length < 2 || name.length > 40) return undefined;
  return LETTERS_ONLY_NAME.test(name) ? name : undefined;
}

function parseFreeCity(raw: string): string | undefined {
  const city = raw.replace(/^(في|من|مدينه|مدينة|in|city)\s+/i, "").trim();
  if (!city || /\d/.test(city) || city.length > 30 || city.split(/\s+/).length > 3) return undefined;
  return LETTERS_ONLY_CITY.test(city) ? city : undefined;
}

const NOT_A_NAME_INTENTS: Array<LeadIntent | "unknown"> = [
  "skip",
  "restart",
  "talk_to_human",
  "complaint",
  "edit",
  "thanks",
  "goodbye",
  "deny",
  "confirm",
  "pricing",
  "track_request",
  "become_agent",
  "business_plan",
];

export type ExtractionResult = { slots: LeadSlots; invalidPhone: boolean };

/**
 * Extract every slot we can recognise from a free-text message. `pending`
 * is the field currently being asked, which unlocks field-specific parsing.
 */
export function extractSlots(raw: string, pending: LeadField | null): ExtractionResult {
  const variants = tokenVariants(raw);
  const slots: LeadSlots = {};

  const service = LEAD_SERVICES.find(
    (entry) => entry.id !== "other" && entry.keywords.some((keyword) => variantsInclude(variants, keyword)),
  );
  if (service) slots.service = service.id;
  else if (pending === "service") {
    const other = LEAD_SERVICES.find((entry) => entry.id === "other");
    if (other && variantsIncludeAny(variants, other.keywords)) slots.service = "other";
  }

  const customerType = firstMatchingKey(variants, CUSTOMER_TYPE_WORDS);
  if (customerType) slots.customerType = customerType;

  const urgency = firstMatchingKey(variants, URGENCY_WORDS);
  // "monthly" talks about volume, not a deadline, unless we are asking the deadline.
  if (urgency && !(urgency === "month" && pending !== "urgency" && variantsIncludeAny(variants, ["شهري", "شهريا", "monthly"]))) {
    slots.urgency = urgency;
  }

  const volume = extractVolume(raw, variants);
  if (volume && (pending === "volume" || volume !== "single")) slots.volume = volume;

  const budget = extractBudget(raw, variants);
  if (budget && (budget !== "unknown" || pending === "budget")) slots.budget = budget;

  const city = LEAD_CITIES.find((entry) => entry.keywords.some((keyword) => variantsInclude(variants, keyword)));
  if (city) slots.city = city.id;
  else if (pending === "city") {
    const freeCity = parseFreeCity(raw);
    if (freeCity) slots.city = freeCity;
  }

  const contactTime = firstMatchingKey(variants, CONTACT_TIME_WORDS);
  if (contactTime && (pending === "contactTime" || contactTime === "whatsapp")) slots.contactTime = contactTime;

  const phone = extractPhone(raw);
  if (phone.phone) slots.phone = phone.phone;
  if (pending === "name" && !phone.phone) {
    // "تخطي" / "موظف" / "شكرًا"… are commands, not names (greetings like «هلا» stay valid names).
    const name = NOT_A_NAME_INTENTS.includes(detectIntent(raw).intent) ? undefined : parseName(raw);
    if (name) slots.name = name;
  } else {
    const inline = raw.match(INLINE_NAME);
    if (inline) slots.name = inline[1];
  }

  if (pending === "consent") {
    const { intent } = detectIntent(raw);
    if (intent === "confirm") slots.consent = true;
    else if (intent === "deny") slots.consent = false;
  }

  return { slots, invalidPhone: pending === "phone" && !phone.phone && phone.attempted };
}

export const EDITABLE_FIELDS: LeadField[] = [
  "service",
  "customerType",
  "urgency",
  "volume",
  "budget",
  "city",
  "name",
  "phone",
  "contactTime",
];

export type QuickReply =
  | { kind: "slot"; slots: LeadSlots }
  | { kind: "intent"; intent: LeadIntent }
  | { kind: "edit"; slot: LeadField }
  | { kind: "end" };

/** Parse a quick-reply button value such as `svc:zakat_tax` or `intent:pricing`. */
export function parseQuickReply(value: string): QuickReply | null {
  const separator = value.indexOf(":");
  const kind = separator === -1 ? value : value.slice(0, separator);
  const arg = separator === -1 ? "" : value.slice(separator + 1).trim();
  switch (kind) {
    case "svc":
      return LEAD_SERVICES.some((entry) => entry.id === arg) ? { kind: "slot", slots: { service: arg as LeadServiceId } } : null;
    case "type":
      return arg === "business" || arg === "individual" ? { kind: "slot", slots: { customerType: arg } } : null;
    case "urg":
      return ["urgent", "week", "month", "exploring"].includes(arg) ? { kind: "slot", slots: { urgency: arg as Urgency } } : null;
    case "vol":
      return ["single", "few", "many"].includes(arg) ? { kind: "slot", slots: { volume: arg as Volume } } : null;
    case "bud":
      return ["lt500", "500_2000", "gt2000", "unknown"].includes(arg) ? { kind: "slot", slots: { budget: arg as Budget } } : null;
    case "city":
      return LEAD_CITIES.some((entry) => entry.id === arg) ? { kind: "slot", slots: { city: arg } } : null;
    case "time":
      return ["now", "morning", "evening", "whatsapp"].includes(arg) ? { kind: "slot", slots: { contactTime: arg as ContactTime } } : null;
    case "consent":
      return arg === "yes" || arg === "no" ? { kind: "slot", slots: { consent: arg === "yes" } } : null;
    case "intent":
      return (LEAD_INTENTS as readonly string[]).includes(arg) ? { kind: "intent", intent: arg as LeadIntent } : null;
    case "edit":
      return (EDITABLE_FIELDS as string[]).includes(arg) ? { kind: "edit", slot: arg as LeadField } : null;
    case "skip":
      return { kind: "intent", intent: "skip" };
    case "confirm":
      return { kind: "intent", intent: "confirm" };
    case "end":
      return { kind: "end" };
    default:
      return null;
  }
}
