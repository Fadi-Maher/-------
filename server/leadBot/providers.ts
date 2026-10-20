/**
 * Providers for the sales assistant:
 *  - knowledge answers come ONLY from the active entries in the existing
 *    "assistant knowledge" table (/settings/assistant). English answers are
 *    used when present, otherwise Arabic.
 *  - optional AI understanding (owner toggle, off by default) for unclear
 *    messages. Only redacted text is sent; any failure falls back to rules.
 */
import { invokeLLM, type InvokeParams, type InvokeResult } from "../_core/llm";
import { LEAD_CITIES, LEAD_INTENTS, LEAD_SERVICE_IDS, type Lang } from "../../shared/leadBot/catalog";
import type { AiHint, EngineState } from "../../shared/leadBot/engine";
import { maskPhonesInText, normalizeText, redactSensitive } from "../../shared/leadBot/text";

export type KnowledgeEntry = {
  id: number;
  questionAr: string;
  answerAr: string;
  questionEn: string | null;
  answerEn: string | null;
};

export type InvokeFn = (params: InvokeParams) => Promise<InvokeResult>;

export const NLU_TIMEOUT_MS = 4000;
export const FAQ_TIMEOUT_MS = 8000;
const AI_MODEL = "gpt-5-mini";

/** Resolve to null on timeout or error so the chat never blocks on a provider. */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Text that is safe to send to an external model: sensitive data removed, phones masked. */
export function redactForAi(value: string): string {
  return maskPhonesInText(redactSensitive(value).text).slice(0, 600);
}

const STOP_WORDS = new Set([
  // Arabic question/filler words (normalised forms)
  "كيف", "وش", "ايش", "شو", "ما", "ماهو", "ماهي", "هو", "هي", "هل", "متي", "وين", "اين", "في", "من", "علي", "عن", "الي",
  "او", "ان", "انا", "ابي", "ابغي", "ودي", "ممكن", "لو", "هذا", "هذه", "عندكم", "لديكم", "عندك", "لكم", "لي", "مع", "كم", "اذا",
  "يعني", "طيب", "بس", "الخدمه", "خدمه", "معاملاتي", "كير",
  // English
  "what", "how", "is", "are", "the", "a", "an", "do", "does", "you", "i", "to", "of", "for", "in", "on", "can", "my", "your",
  "me", "we", "it", "with", "and", "or", "please", "about", "there", "any", "have", "has", "maalamati", "care",
]);

/** Meaningful normalised tokens with common Arabic prefixes folded. */
export function keyTokens(value: string): string[] {
  const words = normalizeText(value).split(" ").filter(Boolean);
  const tokens = new Set<string>();
  for (const raw of words) {
    let word = raw;
    if (word.length > 4 && /^(وال|فال|بال|كال)/.test(word)) word = word.slice(3);
    else if (word.length > 3 && /^لل/.test(word)) word = word.slice(2);
    else if (word.length > 3 && /^ال/.test(word)) word = word.slice(2);
    else if (word.length > 3 && /^[وفب]/.test(word)) word = word.slice(1);
    if (word.length < 2 || STOP_WORDS.has(word) || STOP_WORDS.has(raw)) continue;
    tokens.add(word);
  }
  return Array.from(tokens);
}

function entryText(entry: KnowledgeEntry): string {
  return `${entry.questionAr} ${entry.questionEn ?? ""}`;
}

export function answerText(entry: KnowledgeEntry, lang: Lang): string {
  if (lang === "en" && entry.answerEn?.trim()) return entry.answerEn.trim();
  return entry.answerAr.trim();
}

/**
 * Deterministic best match between the visitor question and the stored
 * questions. Requires enough shared meaningful words to avoid wrong answers.
 */
export function matchKnowledge(question: string, entries: KnowledgeEntry[]): { entry: KnowledgeEntry; score: number } | null {
  const queryTokens = keyTokens(question);
  if (!queryTokens.length || !entries.length) return null;
  let best: { entry: KnowledgeEntry; score: number; shared: number } | null = null;
  for (const entry of entries) {
    const entryTokens = keyTokens(entryText(entry));
    if (!entryTokens.length) continue;
    const entrySet = new Set(entryTokens);
    const shared = queryTokens.filter((token) => entrySet.has(token)).length;
    if (!shared) continue;
    const score = shared / Math.min(queryTokens.length, Math.max(1, Math.ceil(entryTokens.length / 2)));
    if (!best || score > best.score || (score === best.score && shared > best.shared)) best = { entry, score, shared };
  }
  if (!best) return null;
  const strongSingle = best.shared === 1 && queryTokens.length === 1 && best.score >= 1;
  if (best.shared >= 2 ? best.score >= 0.5 : strongSingle) return { entry: best.entry, score: best.score };
  return null;
}

function readText(result: InvokeResult | null): string {
  const content = result?.choices[0]?.message.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
  }
  return "";
}

function parseJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Ask the model to pick ONE stored entry id (or none). The answer text is always the stored text. */
async function pickKnowledgeWithAi(question: string, entries: KnowledgeEntry[], invoke: InvokeFn): Promise<KnowledgeEntry | null> {
  const catalog = entries.slice(0, 60).map((entry) => ({ id: entry.id, q: entry.questionAr, qEn: entry.questionEn ?? undefined }));
  const result = await invoke({
    model: AI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You match a visitor question to an approved FAQ list for Maalamati Care (a Saudi government-transaction follow-up service). " +
          "Return the id of the single FAQ that directly answers the question, or null if none does. Never invent answers.",
      },
      { role: "user", content: JSON.stringify({ question: redactForAi(question), faqs: catalog }) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "faq_match",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { id: { type: ["integer", "null"] } },
          required: ["id"],
        },
      },
    },
  });
  const parsed = parseJson(readText(result));
  const id = typeof parsed?.id === "number" ? parsed.id : null;
  return id === null ? null : entries.find((entry) => entry.id === id) ?? null;
}

export type FaqDeps = {
  listKnowledge: () => Promise<KnowledgeEntry[]>;
  aiAssist: boolean;
  invoke?: InvokeFn;
};

/** Approved answer for a side question, or null (engine keeps its fallback text). */
export async function answerFromKnowledge(question: string, lang: Lang, deps: FaqDeps): Promise<string | null> {
  const entries = await deps.listKnowledge();
  if (!entries.length) return null;
  const direct = matchKnowledge(question, entries);
  if (direct) return answerText(direct.entry, lang);
  if (!deps.aiAssist) return null;
  const picked = await withTimeout(pickKnowledgeWithAi(question, entries, deps.invoke ?? invokeLLM), FAQ_TIMEOUT_MS);
  return picked ? answerText(picked, lang) : null;
}

const SLOT_ENUMS = {
  service: [...LEAD_SERVICE_IDS],
  customerType: ["individual", "business"],
  urgency: ["urgent", "week", "month", "exploring"],
  volume: ["single", "few", "many"],
  budget: ["lt500", "500_2000", "gt2000", "unknown"],
  city: LEAD_CITIES.map((city) => city.id),
  contactTime: ["now", "morning", "evening", "whatsapp"],
} as const;

/** AI intent + slot hint for an unclear message. Returns null on any failure. */
export async function understandWithAi(text: string, state: EngineState, invoke: InvokeFn = invokeLLM): Promise<AiHint | null> {
  const nullableEnum = (values: readonly string[]) => ({ type: ["string", "null"], enum: [...values, null] });
  const result = await invoke({
    model: AI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "Classify a website visitor message for Maalamati Care's sales assistant (Saudi government transactions). " +
          "Pick the intent and extract only values that are explicitly stated. Use null when unsure. Do not guess.",
      },
      { role: "user", content: JSON.stringify({ message: redactForAi(text), pendingQuestion: state.pending, lang: state.lang }) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "lead_understanding",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            intent: { type: "string", enum: [...LEAD_INTENTS, "unknown"] },
            confidence: { type: "number" },
            slots: {
              type: "object",
              additionalProperties: false,
              properties: {
                service: nullableEnum(SLOT_ENUMS.service),
                customerType: nullableEnum(SLOT_ENUMS.customerType),
                urgency: nullableEnum(SLOT_ENUMS.urgency),
                volume: nullableEnum(SLOT_ENUMS.volume),
                budget: nullableEnum(SLOT_ENUMS.budget),
                city: nullableEnum(SLOT_ENUMS.city),
                contactTime: nullableEnum(SLOT_ENUMS.contactTime),
              },
              required: ["service", "customerType", "urgency", "volume", "budget", "city", "contactTime"],
            },
          },
          required: ["intent", "confidence", "slots"],
        },
      },
    },
  });
  const parsed = parseJson(readText(result));
  if (!parsed) return null;
  const intent = typeof parsed.intent === "string" && (LEAD_INTENTS as readonly string[]).includes(parsed.intent)
    ? (parsed.intent as AiHint["intent"])
    : "unknown";
  const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0;
  const rawSlots = parsed.slots && typeof parsed.slots === "object" ? (parsed.slots as Record<string, unknown>) : {};
  const slots: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawSlots)) if (value !== null && value !== undefined) slots[key] = value;
  return { intent, confidence, slots };
}
