/**
 * Conversation engine for the Maalamati Care sales assistant. A faithful,
 * typed port of the approved reference engine: a pure state machine that
 * takes the previous state + one visitor input and returns the new state,
 * bot replies and analytics events. No I/O — the server persists results.
 */
import {
  BUDGET_OPTIONS,
  CONTACT_TIME_OPTIONS,
  CUSTOMER_TYPES,
  FIELD_LABELS,
  LEAD_CITIES,
  LEAD_SERVICES,
  URGENCY_OPTIONS,
  VOLUME_OPTIONS,
  isRequiredLeadField,
  serviceLabel,
  type Lang,
  type LeadField,
  type LeadIntent,
  type LeadServiceId,
} from "./catalog";
import { scoreLead, type LeadScore } from "./scoring";
import { botButton, botMessage, botQuestion } from "./strings";
import { maskPhonesInText, moderateMessage, parseSaudiMobile, toAsciiDigits } from "./text";
import { detectIntent, extractSlots, parseName, parseQuickReply, type LeadSlots } from "./understanding";

export type LeadFlow = "sales" | "partner";
export type LeadStage = "welcome" | "qualifying" | "review" | "completed" | "escalated" | "closed";
export type EscalationReason = "requested" | "complaint";

export const SALES_FIELDS: LeadField[] = [
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
];
export const PARTNER_FIELDS: LeadField[] = ["name", "phone", "city", "service", "consent"];
/** Abusive messages before the chat is closed. */
export const MAX_MODERATION_STRIKES = 3;
/** Invalid phone attempts before a human is offered. */
export const MAX_INVALID_PHONE_ATTEMPTS = 3;

export type EngineState = {
  version: 1;
  lang: Lang;
  stage: LeadStage;
  flow: LeadFlow | null;
  slots: LeadSlots;
  pending: LeadField | null;
  skipped: LeadField[];
  fallbackCount: number;
  invalidAttempts: number;
  strikes: number;
  turn: number;
  lastIntent: LeadIntent | "unknown" | null;
  escalation: { reason: EscalationReason; at: number } | null;
  editing: boolean;
};

export type QuickReplyOption = { value: string; label: string };
export type BotActionType = "open_request_form" | "open_track" | "open_agent_signup" | "open_contact" | "whatsapp";
export type BotAction = { type: BotActionType; label: string; href: string };
export type SummaryItem = { key: LeadField; label: string; value: string };
export type BotTone = "info" | "warning" | "success" | "handoff";
export type InputHint = "text" | "name" | "tel" | "none";

export type BotReply = {
  text: string;
  quickReplies?: QuickReplyOption[];
  actions?: BotAction[];
  summary?: SummaryItem[];
  tone?: BotTone;
  inputHint?: InputHint;
  /** Placeholder the server may replace with an approved knowledge answer. */
  faqPlaceholder?: boolean;
};

export type EngineEventType =
  | "conversation_started"
  | "intent_detected"
  | "slot_filled"
  | "fallback"
  | "escalated"
  | "lead_qualified"
  | "consent_declined"
  | "moderation_blocked"
  | "sensitive_masked"
  | "action_suggested"
  | "restarted";
export type EngineEvent = { type: EngineEventType; slot?: LeadField; intent?: LeadIntent; detail?: string };

export type EngineSettings = {
  enabled: boolean;
  /** Service ids offered as quick replies; empty = all. "other" is always kept. */
  services: LeadServiceId[];
  links: { requestForm: string; track: string; agentSignup: string; contact: string };
  whatsappNumber: string | null;
  autoEscalateAfterFallbacks: number;
  offerHumanToHotLeads: boolean;
  isWithinWorkingHours: boolean;
  workingHoursAr: string;
  workingHoursEn: string;
  responseSlaAr: string;
  responseSlaEn: string;
  now?: number;
};

export type EngineInput = { text?: string; quickReply?: string };

/** Optional AI understanding hint (only used for unclear messages). */
export type AiHint = {
  intent?: LeadIntent | "unknown";
  confidence?: number;
  slots?: Partial<Record<keyof LeadSlots, unknown>>;
};

export type EngineResult = {
  state: EngineState;
  replies: BotReply[];
  events: EngineEvent[];
  /** Redacted visitor text to store (null when nothing typed). */
  storedUserText: string | null;
  /** The lead has enough data to be stored/updated. */
  leadReady: boolean;
  escalate: { reason: EscalationReason; at: number } | null;
  needsFaqAnswer: boolean;
  /** Conversation is with a human: forward the message, no bot reply. */
  forwardToHuman: boolean;
  score: LeadScore;
};

type Ctx = {
  state: EngineState;
  settings: EngineSettings;
  replies: BotReply[];
  events: EngineEvent[];
  storedUserText: string | null;
  leadReady: boolean;
  escalate: EngineResult["escalate"];
  needsFaqAnswer: boolean;
  forwardToHuman: boolean;
  maskedInput?: boolean;
};

export function createInitialState(lang: Lang = "ar"): EngineState {
  return {
    version: 1,
    lang,
    stage: "welcome",
    flow: null,
    slots: {},
    pending: null,
    skipped: [],
    fallbackCount: 0,
    invalidAttempts: 0,
    strikes: 0,
    turn: 0,
    lastIntent: null,
    escalation: null,
    editing: false,
  };
}

/** Restore a persisted state defensively; unknown shapes start fresh. */
export function restoreState(raw: unknown, lang: Lang = "ar"): EngineState {
  const initial = createInitialState(lang);
  if (!raw || typeof raw !== "object") return initial;
  const value = raw as Partial<EngineState>;
  if (value.version !== 1) return initial;
  return {
    ...initial,
    ...value,
    version: 1,
    lang: value.lang === "en" ? "en" : "ar",
    slots: { ...(value.slots ?? {}) },
    skipped: Array.isArray(value.skipped) ? value.skipped : [],
  };
}

export function flowFields(flow: LeadFlow | null): LeadField[] {
  return flow === "partner" ? PARTNER_FIELDS : SALES_FIELDS;
}

export function cityLabel(city: string | undefined, lang: Lang): string {
  if (!city) return "";
  const entry = LEAD_CITIES.find((item) => item.id === city);
  return entry ? entry[lang] : city;
}

export function mainMenu(lang: Lang): QuickReplyOption[] {
  return [
    { value: "intent:start_request", label: botButton(lang, "startRequest") },
    { value: "intent:pricing", label: botButton(lang, "pricing") },
    { value: "intent:business_plan", label: botButton(lang, "business") },
    { value: "intent:track_request", label: botButton(lang, "track") },
    { value: "intent:become_agent", label: botButton(lang, "partner") },
    { value: "intent:talk_to_human", label: botButton(lang, "human") },
  ];
}

function offeredServices(settings: EngineSettings) {
  const allowed = settings.services.length ? new Set<string>(settings.services) : null;
  return LEAD_SERVICES.filter((entry) => !allowed || allowed.has(entry.id) || entry.id === "other");
}

export function requestFormHref(settings: EngineSettings, service: string | undefined): string {
  return settings.links.requestForm.replace("{service}", encodeURIComponent(service ?? ""));
}

function whatsappAction(settings: EngineSettings, lang: Lang): BotAction | null {
  const digits = (settings.whatsappNumber ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const international = digits.startsWith("05") ? `966${digits.slice(1)}` : digits;
  return { type: "whatsapp", label: botButton(lang, "whatsapp"), href: `https://wa.me/${international}` };
}

/** Human readable value of a slot for summaries and acknowledgements. */
export function slotValueLabel(field: LeadField, slots: LeadSlots, lang: Lang): string {
  switch (field) {
    case "service":
      return serviceLabel(slots.service, lang);
    case "customerType":
      return slots.customerType ? CUSTOMER_TYPES[slots.customerType][lang] : "";
    case "urgency":
      return slots.urgency ? URGENCY_OPTIONS[slots.urgency][lang] : "";
    case "volume":
      return slots.volume ? VOLUME_OPTIONS[slots.volume][lang] : "";
    case "budget":
      return slots.budget ? BUDGET_OPTIONS[slots.budget][lang] : "";
    case "city":
      return cityLabel(slots.city, lang);
    case "name":
      return slots.name ?? "";
    case "phone":
      return slots.phone ?? "";
    case "contactTime":
      return slots.contactTime ? CONTACT_TIME_OPTIONS[slots.contactTime][lang] : "";
    case "consent":
      return slots.consent ? (lang === "ar" ? "موافق" : "Agreed") : "";
    default:
      return "";
  }
}

export function buildSummary(state: EngineState): SummaryItem[] {
  return flowFields(state.flow)
    .filter((field) => field !== "consent" && state.slots[field] !== undefined)
    .map((field) => ({ key: field, label: FIELD_LABELS[field][state.lang], value: slotValueLabel(field, state.slots, state.lang) }));
}

/** Fields that apply to the current flow (volume only for businesses). */
export function applicableFields(state: EngineState): LeadField[] {
  return flowFields(state.flow).filter((field) => !(field === "volume" && state.slots.customerType !== "business"));
}

/** "Step X of Y" while qualifying: answered or skipped fields + 1. */
export function stepProgress(state: EngineState | null | undefined): { step: number; total: number } | null {
  if (!state || state.stage !== "qualifying" || !state.flow) return null;
  const fields = applicableFields(state);
  const done = fields.filter((field) =>
    state.skipped.includes(field) || (field === "consent" ? state.slots.consent === true : state.slots[field] !== undefined),
  ).length;
  return { step: Math.min(fields.length, done + 1), total: fields.length };
}

export function questionFor(field: LeadField, state: EngineState, settings: EngineSettings): BotReply {
  const { lang, slots } = state;
  const skip: QuickReplyOption = { value: "skip", label: botButton(lang, "skip") };
  const partner = state.flow === "partner";
  switch (field) {
    case "service":
      return {
        text: botQuestion(lang, partner ? "partnerService" : slots.customerType === "business" ? "serviceBusiness" : "service"),
        quickReplies: offeredServices(settings).map((entry) => ({ value: `svc:${entry.id}`, label: entry[lang] })),
        inputHint: "text",
      };
    case "customerType":
      return {
        text: botQuestion(lang, "customerType"),
        quickReplies: [
          { value: "type:individual", label: CUSTOMER_TYPES.individual[lang] },
          { value: "type:business", label: CUSTOMER_TYPES.business[lang] },
        ],
      };
    case "urgency":
      return {
        text: botQuestion(lang, "urgency", {
          service: serviceLabel(slots.service, lang) || (lang === "ar" ? "طلبك" : "your request"),
        }),
        quickReplies: (["urgent", "week", "month", "exploring"] as const).map((key) => ({
          value: `urg:${key}`,
          label: URGENCY_OPTIONS[key][lang],
        })),
      };
    case "volume":
      return {
        text: botQuestion(lang, "volume"),
        quickReplies: (["single", "few", "many"] as const).map((key) => ({ value: `vol:${key}`, label: VOLUME_OPTIONS[key][lang] })),
      };
    case "budget":
      return {
        text: botQuestion(lang, "budget"),
        quickReplies: (["lt500", "500_2000", "gt2000", "unknown"] as const).map((key) => ({
          value: `bud:${key}`,
          label: BUDGET_OPTIONS[key][lang],
        })),
      };
    case "city":
      return {
        text: botQuestion(lang, partner ? "partnerCity" : "city"),
        quickReplies: [
          ...LEAD_CITIES.slice(0, 4).map((entry) => ({ value: `city:${entry.id}`, label: entry[lang] })),
          ...(partner ? [] : [skip]),
        ],
        inputHint: "text",
      };
    case "name":
      return { text: botQuestion(lang, "name"), inputHint: "name" };
    case "phone":
      return {
        text: slots.name ? botQuestion(lang, "phone", { name: slots.name.split(" ")[0] }) : botQuestion(lang, "phoneNoName"),
        inputHint: "tel",
      };
    case "contactTime":
      return {
        text: botQuestion(lang, slots.urgency === "urgent" ? "contactTimeUrgent" : "contactTime"),
        quickReplies: (["now", "morning", "evening", "whatsapp"] as const).map((key) => ({
          value: `time:${key}`,
          label: CONTACT_TIME_OPTIONS[key][lang],
        })),
      };
    case "consent":
      return {
        text: botQuestion(lang, "consent"),
        quickReplies: [
          { value: "consent:yes", label: botButton(lang, "agree") },
          { value: "consent:no", label: botButton(lang, "disagree") },
        ],
        inputHint: "none",
      };
    default:
      return { text: botMessage(lang, "fallback") };
  }
}

export function nextField(state: EngineState): LeadField | null {
  for (const field of flowFields(state.flow)) {
    if (field === "volume" && state.slots.customerType !== "business") continue;
    if (state.skipped.includes(field)) continue;
    if (field === "consent") {
      if (state.slots.consent !== true) return field;
      continue;
    }
    const value = state.slots[field];
    if (value === undefined || value === "") return field;
  }
  return null;
}

function finish(ctx: Ctx): EngineResult {
  return {
    state: ctx.state,
    replies: ctx.replies,
    events: ctx.events,
    storedUserText: ctx.storedUserText,
    leadReady: ctx.leadReady,
    escalate: ctx.escalate,
    needsFaqAnswer: ctx.needsFaqAnswer,
    forwardToHuman: ctx.forwardToHuman,
    score: scoreLead(ctx.state.slots, ctx.state.lang),
  };
}

function newCtx(state: EngineState, settings: EngineSettings): Ctx {
  return {
    state,
    settings,
    replies: [],
    events: [],
    storedUserText: null,
    leadReady: false,
    escalate: null,
    needsFaqAnswer: false,
    forwardToHuman: false,
  };
}

function contactAction(ctx: Ctx): BotAction {
  return { type: "open_contact", label: botButton(ctx.state.lang, "contact"), href: ctx.settings.links.contact };
}

function pushWelcome(ctx: Ctx) {
  const { lang } = ctx.state;
  ctx.replies.push({ text: botMessage(lang, "welcome") });
  ctx.replies.push({ text: botMessage(lang, "menuPrompt"), quickReplies: mainMenu(lang) });
}

/** Opening replies for a new or resumed conversation. */
export function startConversation(state: EngineState, settings: EngineSettings, options: { resumed?: boolean } = {}): EngineResult {
  const ctx = newCtx({ ...state }, settings);
  const { lang } = ctx.state;
  if (!settings.enabled) {
    ctx.replies.push({ text: botMessage(lang, "disabled"), tone: "warning", actions: [contactAction(ctx)] });
    return finish(ctx);
  }
  if (options.resumed && ctx.state.stage === "qualifying" && ctx.state.pending) {
    ctx.replies.push({ text: botMessage(lang, "welcomeBack") });
    ctx.replies.push(questionFor(ctx.state.pending, ctx.state, settings));
    return finish(ctx);
  }
  ctx.events.push({ type: "conversation_started" });
  pushWelcome(ctx);
  return finish(ctx);
}

function askNext(ctx: Ctx) {
  const { state, settings } = ctx;
  const field = nextField(state);
  if (field) {
    state.pending = field;
    state.stage = "qualifying";
    ctx.replies.push(questionFor(field, state, settings));
    return;
  }
  state.pending = null;
  state.stage = "review";
  state.editing = false;
  pushReview(ctx);
}

function pushReview(ctx: Ctx) {
  const { lang } = ctx.state;
  ctx.replies.push({
    text: botMessage(lang, "reviewIntro"),
    summary: buildSummary(ctx.state),
    quickReplies: [
      { value: "confirm", label: botButton(lang, "confirmSend") },
      { value: "intent:edit", label: botButton(lang, "edit") },
    ],
  });
}

function pushEditMenu(ctx: Ctx) {
  const { lang } = ctx.state;
  ctx.replies.push({
    text: botMessage(lang, "editWhich"),
    quickReplies: buildSummary(ctx.state).map((item) => ({ value: `edit:${item.key}`, label: item.label })),
  });
}

/** Apply recognised slots respecting flow rules; returns the changed fields. */
function applySlots(ctx: Ctx, incoming: LeadSlots): LeadField[] {
  const { state } = ctx;
  const allowed = new Set(flowFields(state.flow));
  const changed: LeadField[] = [];
  for (const [key, value] of Object.entries(incoming) as Array<[LeadField, LeadSlots[LeadField]]>) {
    if (value === undefined || value === null || value === "") continue;
    if (!allowed.has(key)) continue;
    if (key === "consent" && state.pending !== "consent") continue;
    if (key === "name" && state.pending !== "name" && state.slots.name) continue;
    if (key === "volume" && state.slots.customerType === "individual" && incoming.customerType !== "business") continue;
    if (state.slots[key] === value) continue;
    (state.slots as Record<string, unknown>)[key] = value;
    state.skipped = state.skipped.filter((field) => field !== key);
    changed.push(key);
    ctx.events.push({ type: "slot_filled", slot: key });
  }
  return changed;
}

function acknowledge(ctx: Ctx, changed: LeadField[]) {
  const visible = changed.filter((field) => field !== "consent" && field !== "name" && field !== "phone");
  if (visible.length < 2) return;
  const labels = visible.map((field) => slotValueLabel(field, ctx.state.slots, ctx.state.lang)).filter(Boolean);
  if (!labels.length) return;
  const { lang } = ctx.state;
  ctx.replies.push({ text: `${botMessage(lang, "acknowledged")} ${labels.join(lang === "ar" ? "، " : ", ")}.` });
}

function fallback(ctx: Ctx) {
  const { state, settings } = ctx;
  const { lang } = state;
  if (ctx.maskedInput) {
    if (state.pending) ctx.replies.push(questionFor(state.pending, state, settings));
    else ctx.replies.push({ text: botMessage(lang, "menuPrompt"), quickReplies: mainMenu(lang) });
    return;
  }
  state.fallbackCount += 1;
  ctx.events.push({ type: "fallback" });
  if (state.fallbackCount >= Math.max(1, settings.autoEscalateAfterFallbacks)) {
    ctx.replies.push({
      text: botMessage(lang, "fallbackOfferHuman"),
      tone: "warning",
      quickReplies: [
        { value: "intent:talk_to_human", label: botButton(lang, "yesHuman") },
        ...(state.pending ? [] : [{ value: "intent:start_request", label: botButton(lang, "continueBot") }]),
      ],
    });
    if (state.pending) ctx.replies.push(questionFor(state.pending, state, settings));
    return;
  }
  ctx.replies.push({ text: botMessage(lang, "fallback") });
  if (state.pending) ctx.replies.push(questionFor(state.pending, state, settings));
  else ctx.replies.push({ text: botMessage(lang, "menuPrompt"), quickReplies: mainMenu(lang) });
}

function escalate(ctx: Ctx, reason: EscalationReason) {
  const { state, settings } = ctx;
  const { lang } = state;
  const escalation = { reason, at: settings.now ?? Date.now() };
  state.stage = "escalated";
  state.escalation = escalation;
  state.editing = false;
  ctx.escalate = escalation;
  ctx.leadReady = true;
  ctx.events.push({ type: "escalated", detail: reason });
  if (reason === "complaint") ctx.replies.push({ text: botMessage(lang, "complaintAck") });
  ctx.replies.push({
    text: settings.isWithinWorkingHours
      ? botMessage(lang, "escalatedOnline")
      : botMessage(lang, "escalatedOffline", { hours: lang === "ar" ? settings.workingHoursAr : settings.workingHoursEn }),
    tone: "handoff",
  });
  if (state.slots.phone) state.pending = null;
  else {
    state.pending = "phone";
    ctx.replies.push({ text: botMessage(lang, "escalatedNeedPhone"), inputHint: "tel" });
  }
}

function startFlow(ctx: Ctx, flow: LeadFlow, intent: LeadIntent | "unknown", incoming: LeadSlots) {
  const { state, settings } = ctx;
  const { lang } = state;
  let slots = incoming;
  state.flow = flow;
  state.stage = "qualifying";
  state.fallbackCount = 0;
  if (flow === "partner") {
    ctx.replies.push({
      text: botMessage(lang, "partnerInfo"),
      actions: [{ type: "open_agent_signup", label: botButton(lang, "openAgentSignup"), href: settings.links.agentSignup }],
    });
    ctx.events.push({ type: "action_suggested", detail: "open_agent_signup" });
  } else if (intent === "pricing") {
    ctx.replies.push({ text: botMessage(lang, "pricingInfo") });
  } else if (intent === "business_plan") {
    ctx.replies.push({ text: botMessage(lang, "businessInfo") });
    if (!state.slots.customerType) slots = { ...slots, customerType: "business" };
  } else {
    ctx.replies.push({ text: botMessage(lang, "startSales") });
  }
  const changed = applySlots(ctx, slots);
  acknowledge(ctx, changed);
  askNext(ctx);
}

function complete(ctx: Ctx) {
  const { state, settings } = ctx;
  const { lang } = state;
  state.stage = "completed";
  state.pending = null;
  state.editing = false;
  ctx.leadReady = true;
  ctx.events.push({ type: "lead_qualified", detail: state.flow ?? "sales" });
  const sla = lang === "ar" ? settings.responseSlaAr : settings.responseSlaEn;
  if (state.flow === "partner") {
    ctx.replies.push({
      text: botMessage(lang, "partnerDone", { sla }),
      tone: "success",
      actions: [{ type: "open_agent_signup", label: botButton(lang, "openAgentSignup"), href: settings.links.agentSignup }],
    });
    return;
  }
  const actions: BotAction[] = [
    { type: "open_request_form", label: botButton(lang, "openRequestForm"), href: requestFormHref(settings, state.slots.service) },
    { type: "open_track", label: botButton(lang, "openTrack"), href: settings.links.track },
  ];
  const whatsapp = whatsappAction(settings, lang);
  if (whatsapp) actions.push(whatsapp);
  const completedText = botMessage(lang, "completed", { sla });
  ctx.replies.push({
    text: settings.isWithinWorkingHours
      ? completedText
      : `${completedText} ${botMessage(lang, "completedAfterHours", {
          hours: lang === "ar" ? settings.workingHoursAr : settings.workingHoursEn,
        })}`,
    tone: "success",
    actions,
    quickReplies: [{ value: "intent:start_request", label: botButton(lang, "newRequest") }],
  });
  const score = scoreLead(state.slots, lang);
  if (settings.offerHumanToHotLeads && settings.isWithinWorkingHours && score.grade === "hot" && state.slots.urgency === "urgent") {
    ctx.replies.push({
      text: botMessage(lang, "hotLeadOffer"),
      quickReplies: [{ value: "intent:talk_to_human", label: botButton(lang, "callNow") }],
    });
  }
}

const URGENCY_KEYS = ["urgent", "week", "month", "exploring"];
const VOLUME_KEYS = ["single", "few", "many"];
const BUDGET_KEYS = ["lt500", "500_2000", "gt2000", "unknown"];

/** Keep only valid catalog values from AI-suggested slots. */
export function sanitizeAiSlots(raw: AiHint["slots"]): LeadSlots {
  if (!raw) return {};
  const slots: LeadSlots = {};
  if (typeof raw.service === "string" && LEAD_SERVICES.some((entry) => entry.id === raw.service)) {
    slots.service = raw.service as LeadServiceId;
  }
  if (raw.customerType === "business" || raw.customerType === "individual") slots.customerType = raw.customerType;
  if (typeof raw.urgency === "string" && URGENCY_KEYS.includes(raw.urgency)) slots.urgency = raw.urgency as LeadSlots["urgency"];
  if (typeof raw.volume === "string" && VOLUME_KEYS.includes(raw.volume)) slots.volume = raw.volume as LeadSlots["volume"];
  if (typeof raw.budget === "string" && BUDGET_KEYS.includes(raw.budget)) slots.budget = raw.budget as LeadSlots["budget"];
  if (typeof raw.city === "string") {
    const city = LEAD_CITIES.find((entry) => entry.id === raw.city);
    if (city) slots.city = city.id;
  }
  if (typeof raw.phone === "string") {
    const phone = parseSaudiMobile(raw.phone);
    if (phone) slots.phone = phone;
  }
  if (typeof raw.name === "string") {
    const name = parseName(raw.name);
    if (name) slots.name = name;
  }
  return slots;
}

const PUNCTUATION_OR_SPACE = new RegExp("[\\s\\p{P}]", "gu");

function restart(ctx: Ctx): EngineResult {
  const { lang } = ctx.state;
  const fresh = createInitialState(lang);
  fresh.turn = ctx.state.turn;
  ctx.state = fresh;
  ctx.events.push({ type: "restarted" });
  ctx.replies.push({ text: botMessage(lang, "restarted") });
  ctx.replies.push({ text: botMessage(lang, "menuPrompt"), quickReplies: mainMenu(lang) });
  return finish(ctx);
}

function hasQualifyingSlots(slots: LeadSlots): boolean {
  return Boolean(slots.service || slots.urgency || slots.volume || slots.budget);
}

/** Process one visitor input (typed text or a quick-reply value). */
export function processMessage(previous: EngineState, input: EngineInput, settings: EngineSettings, ai?: AiHint | null): EngineResult {
  const state: EngineState = { ...previous, slots: { ...previous.slots }, skipped: [...previous.skipped] };
  state.turn += 1;
  const ctx = newCtx(state, settings);
  const { lang } = state;

  if (!settings.enabled) {
    ctx.replies.push({ text: botMessage(lang, "disabled"), tone: "warning", actions: [contactAction(ctx)] });
    return finish(ctx);
  }

  let text = "";
  const quick = input.quickReply ? parseQuickReply(input.quickReply) : null;
  if (!quick) {
    const moderation = moderateMessage(input.text ?? "");
    if (moderation.reason === "empty") {
      fallback(ctx);
      return finish(ctx);
    }
    if (moderation.reason === "too_long") {
      ctx.replies.push({ text: botMessage(lang, "tooLong"), tone: "warning" });
      return finish(ctx);
    }
    ctx.storedUserText = moderation.maskedText;
    if (moderation.blocked) {
      state.strikes += 1;
      ctx.events.push({ type: "moderation_blocked", detail: moderation.reason ?? undefined });
      if (state.strikes >= MAX_MODERATION_STRIKES) {
        state.stage = "closed";
        state.pending = null;
        ctx.replies.push({ text: botMessage(lang, "moderationClosed"), tone: "warning", actions: [contactAction(ctx)] });
      } else {
        ctx.replies.push({ text: botMessage(lang, "moderationWarning"), tone: "warning" });
        if (state.pending && state.stage === "qualifying") ctx.replies.push(questionFor(state.pending, state, settings));
      }
      return finish(ctx);
    }
    if (moderation.maskedKinds.length) {
      ctx.events.push({ type: "sensitive_masked", detail: moderation.maskedKinds.join(",") });
      ctx.replies.push({ text: botMessage(lang, "sensitiveMasked"), tone: "warning" });
      ctx.maskedInput = moderation.maskedText.replace(/\[[^\]]*\]/g, "").replace(PUNCTUATION_OR_SPACE, "").length < 2;
    }
    text = moderation.maskedText;
  }

  if (state.stage === "closed") {
    const wantsRestart = quick?.kind === "intent" ? quick.intent === "restart" : detectIntent(text).intent === "restart";
    if (wantsRestart && state.strikes < MAX_MODERATION_STRIKES) return restart(ctx);
    ctx.replies.push({
      text: botMessage(lang, "closed"),
      quickReplies:
        state.strikes < MAX_MODERATION_STRIKES ? [{ value: "intent:restart", label: botButton(lang, "restart") }] : undefined,
      actions: [contactAction(ctx)],
    });
    return finish(ctx);
  }

  let intent: LeadIntent | "unknown" = "unknown";
  let slots: LeadSlots = {};
  let invalidPhone = false;
  let editField: LeadField | null = null;

  if (quick) {
    if (quick.kind === "slot") slots = quick.slots;
    else if (quick.kind === "intent") intent = quick.intent;
    else if (quick.kind === "edit") {
      intent = "edit";
      editField = quick.slot;
    } else if (quick.kind === "end") {
      state.stage = "closed";
      state.pending = null;
      ctx.replies.push({ text: botMessage(lang, "goodbye"), quickReplies: [{ value: "intent:restart", label: botButton(lang, "restart") }] });
      return finish(ctx);
    }
  } else {
    const detected = detectIntent(text);
    intent = detected.intent;
    if (
      ai?.intent &&
      ai.intent !== "unknown" &&
      (detected.intent === "unknown" || (detected.confidence < 0.7 && (ai.confidence ?? 0) >= 0.8))
    ) {
      intent = ai.intent;
    }
    const extraction = extractSlots(text, state.pending);
    slots = { ...sanitizeAiSlots(ai?.slots), ...extraction.slots };
    invalidPhone = extraction.invalidPhone && !slots.phone;
    if (extraction.slots.phone && ctx.storedUserText) {
      ctx.storedUserText = maskPhonesInText(ctx.storedUserText);
    }
  }

  if (intent !== "unknown") ctx.events.push({ type: "intent_detected", intent });
  state.lastIntent = intent;
  if (intent === "restart") return restart(ctx);

  if ((intent === "talk_to_human" || intent === "complaint") && state.stage !== "escalated") {
    applySlots(ctx, { phone: slots.phone });
    escalate(ctx, intent === "complaint" ? "complaint" : "requested");
    return finish(ctx);
  }

  if (state.stage === "escalated") {
    ctx.forwardToHuman = true;
    if (state.pending === "phone") {
      if (slots.phone) {
        state.slots.phone = slots.phone;
        state.pending = null;
        ctx.leadReady = true;
        ctx.events.push({ type: "slot_filled", slot: "phone" });
        ctx.replies.push({ text: botMessage(lang, "phoneSavedForHandoff"), tone: "success" });
      } else if (invalidPhone) {
        ctx.replies.push({ text: botMessage(lang, "invalidPhone"), tone: "warning", inputHint: "tel" });
      }
    }
    return finish(ctx);
  }

  if (intent === "track_request") {
    ctx.events.push({ type: "action_suggested", detail: "open_track" });
    ctx.replies.push({
      text: botMessage(lang, "trackInfo"),
      actions: [{ type: "open_track", label: botButton(lang, "openTrack"), href: settings.links.track }],
      quickReplies: state.stage === "qualifying" ? undefined : mainMenu(lang).filter((item) => item.value !== "intent:track_request"),
    });
    if (state.stage === "qualifying" && state.pending) {
      ctx.replies.push({ text: botMessage(lang, "resumeQuestion") });
      ctx.replies.push(questionFor(state.pending, state, settings));
    }
    return finish(ctx);
  }

  switch (state.stage) {
    case "welcome":
      handleWelcome(ctx, intent, slots);
      break;
    case "qualifying":
      handleQualifying(ctx, intent, slots, invalidPhone, editField);
      break;
    case "review":
      handleReview(ctx, intent, slots, editField);
      break;
    case "completed":
      handleCompleted(ctx, intent, slots);
      break;
    default:
      fallback(ctx);
  }
  return finish(ctx);
}

function handleWelcome(ctx: Ctx, intent: LeadIntent | "unknown", slots: LeadSlots) {
  const { state } = ctx;
  const { lang } = state;
  switch (intent) {
    case "start_request":
    case "pricing":
    case "business_plan":
      startFlow(ctx, "sales", intent, slots);
      return;
    case "become_agent":
      startFlow(ctx, "partner", intent, slots);
      return;
    case "thanks":
      ctx.replies.push({ text: botMessage(lang, "thanks"), quickReplies: mainMenu(lang) });
      return;
    case "goodbye":
      ctx.replies.push({ text: botMessage(lang, "goodbye") });
      return;
    default:
      break;
  }
  if (hasQualifyingSlots(slots)) {
    startFlow(ctx, "sales", "start_request", slots);
    return;
  }
  if (intent === "faq") {
    ctx.needsFaqAnswer = true;
    state.fallbackCount = 0;
    ctx.replies.push({ text: botMessage(lang, "faqFallback"), quickReplies: mainMenu(lang), faqPlaceholder: true });
    return;
  }
  if (intent === "greeting") {
    state.fallbackCount = 0;
    ctx.replies.push({ text: botMessage(lang, "menuPrompt"), quickReplies: mainMenu(lang) });
    return;
  }
  fallback(ctx);
}

function sideAnswer(ctx: Ctx, intent: LeadIntent | "unknown"): BotReply | null {
  const { lang } = ctx.state;
  switch (intent) {
    case "pricing":
      return { text: botMessage(lang, "pricingInterject") };
    case "faq":
      ctx.needsFaqAnswer = true;
      return { text: botMessage(lang, "faqFallback"), faqPlaceholder: true };
    case "business_plan":
      return { text: botMessage(lang, "businessInfo") };
    case "thanks":
      return { text: botMessage(lang, "thanks") };
    case "greeting":
      return { text: lang === "ar" ? "أهلًا وسهلًا." : "Hello again." };
    case "become_agent":
      return {
        text: botMessage(lang, "partnerInfo"),
        actions: [{ type: "open_agent_signup", label: botButton(lang, "openAgentSignup"), href: ctx.settings.links.agentSignup }],
      };
    default:
      return null;
  }
}

function handleQualifying(
  ctx: Ctx,
  intent: LeadIntent | "unknown",
  incoming: LeadSlots,
  invalidPhone: boolean,
  editField: LeadField | null,
) {
  const { state, settings } = ctx;
  const { lang } = state;
  if (editField) {
    state.pending = editField;
    state.editing = true;
    ctx.replies.push(questionFor(editField, state, settings));
    return;
  }
  let slots = incoming;
  if (intent === "business_plan" && !state.slots.customerType) slots = { ...slots, customerType: "business" };
  const pending = state.pending;
  const changed = applySlots(ctx, slots);
  const answeredPending = pending !== null && changed.includes(pending);
  if (changed.length) state.fallbackCount = 0;
  if (answeredPending) state.invalidAttempts = 0;

  if (pending === "consent" && answeredPending && state.slots.consent === false) {
    delete state.slots.phone;
    delete state.slots.name;
    ctx.events.push({ type: "consent_declined" });
    ctx.replies.push({
      text: botMessage(lang, "consentDeclined"),
      tone: "warning",
      actions: [{ type: "open_request_form", label: botButton(lang, "openRequestForm"), href: requestFormHref(settings, state.slots.service) }],
      quickReplies: [
        { value: "consent:yes", label: botButton(lang, "agree") },
        { value: "end", label: botButton(lang, "endChat") },
      ],
    });
    return;
  }

  if (!answeredPending && pending) {
    if (intent === "skip") {
      if (isRequiredLeadField(pending)) {
        ctx.replies.push({ text: botMessage(lang, "requiredSlot"), tone: "info" });
        ctx.replies.push(questionFor(pending, state, settings));
        return;
      }
      state.skipped = [...state.skipped, pending];
      ctx.replies.push({ text: botMessage(lang, "skipped") });
      if (state.editing) {
        state.editing = false;
        state.stage = "review";
        state.pending = null;
        pushReview(ctx);
        return;
      }
      askNext(ctx);
      return;
    }
    if (pending === "phone" && invalidPhone) {
      state.invalidAttempts += 1;
      if (state.invalidAttempts >= MAX_INVALID_PHONE_ATTEMPTS) {
        ctx.replies.push({
          text: botMessage(lang, "invalidPhoneOfferHuman"),
          tone: "warning",
          quickReplies: [{ value: "intent:talk_to_human", label: botButton(lang, "yesHuman") }],
          inputHint: "tel",
        });
        return;
      }
      ctx.replies.push({ text: botMessage(lang, "invalidPhone"), tone: "warning", inputHint: "tel" });
      return;
    }
    const side = sideAnswer(ctx, intent);
    if (side) {
      ctx.replies.push(side);
      if (changed.length) acknowledge(ctx, changed);
      ctx.replies.push({ text: botMessage(lang, "resumeQuestion") });
      ctx.replies.push(questionFor(pending, state, settings));
      return;
    }
    if (!changed.length) {
      if (pending === "name") {
        state.fallbackCount += 1;
        ctx.events.push({ type: "fallback" });
        ctx.replies.push({ text: botMessage(lang, "invalidName"), tone: "warning", inputHint: "name" });
        return;
      }
      fallback(ctx);
      return;
    }
  }

  acknowledge(ctx, changed);
  if (state.editing && (answeredPending || changed.length)) {
    state.editing = false;
    const field = nextField(state);
    if (field) {
      state.pending = field;
      ctx.replies.push(questionFor(field, state, settings));
      return;
    }
    state.stage = "review";
    state.pending = null;
    pushReview(ctx);
    return;
  }
  askNext(ctx);
}

function handleReview(ctx: Ctx, intent: LeadIntent | "unknown", incoming: LeadSlots, editField: LeadField | null) {
  const { state, settings } = ctx;
  if (editField) {
    state.stage = "qualifying";
    state.pending = editField;
    state.editing = true;
    ctx.replies.push(questionFor(editField, state, settings));
    return;
  }
  if (intent === "confirm") {
    complete(ctx);
    return;
  }
  if (intent === "edit" || intent === "deny") {
    pushEditMenu(ctx);
    return;
  }
  const changed = applySlots(ctx, incoming);
  if (changed.length) {
    acknowledge(ctx, changed);
    pushReview(ctx);
    return;
  }
  state.fallbackCount += 1;
  ctx.events.push({ type: "fallback" });
  pushReview(ctx);
}

function handleCompleted(ctx: Ctx, intent: LeadIntent | "unknown", incoming: LeadSlots) {
  const { state, settings } = ctx;
  const { lang } = state;
  if (intent === "start_request" || intent === "pricing" || intent === "business_plan" || hasQualifyingSlots(incoming)) {
    state.slots = {
      name: state.slots.name,
      phone: state.slots.phone,
      city: state.slots.city,
      customerType: state.slots.customerType,
      consent: state.slots.consent,
    };
    state.skipped = [];
    state.escalation = null;
    ctx.replies.push({ text: botMessage(lang, "newRequestKeepContact") });
    startFlow(ctx, "sales", intent === "unknown" ? "start_request" : intent, incoming);
    return;
  }
  if (intent === "become_agent") {
    state.slots = { name: state.slots.name, phone: state.slots.phone, city: state.slots.city };
    state.skipped = [];
    startFlow(ctx, "partner", intent, incoming);
    return;
  }
  if (intent === "thanks") {
    ctx.replies.push({ text: botMessage(lang, "thanks") });
    return;
  }
  if (intent === "goodbye") {
    ctx.replies.push({ text: botMessage(lang, "goodbye") });
    return;
  }
  if (intent === "faq") ctx.needsFaqAnswer = true;
  ctx.replies.push({
    text: intent === "faq" ? botMessage(lang, "faqFallback") : botMessage(lang, "completedFollowUp"),
    faqPlaceholder: intent === "faq" ? true : undefined,
    actions: [
      { type: "open_request_form", label: botButton(lang, "openRequestForm"), href: requestFormHref(settings, state.slots.service) },
      { type: "open_track", label: botButton(lang, "openTrack"), href: settings.links.track },
    ],
    quickReplies: [
      { value: "intent:start_request", label: botButton(lang, "newRequest") },
      { value: "intent:talk_to_human", label: botButton(lang, "human") },
    ],
  });
}
