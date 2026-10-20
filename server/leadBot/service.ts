/**
 * Visitor-facing sales assistant service: start/resume, restart, send,
 * poll for staff replies and action tracking. Mirrors the approved reference
 * service, with the site's rules: consent before storing, IP and per-minute
 * limits, idempotent sends (clientId), masking before storage/AI, one DB
 * transaction per turn, and alerts through the site's owner/team channels.
 */
import { createHash, randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { Lang } from "../../shared/leadBot/catalog";
import {
  MAX_MODERATION_STRIKES,
  createInitialState,
  processMessage,
  startConversation,
  stepProgress,
  type AiHint,
  type BotReply,
  type EngineInput,
  type EngineState,
} from "../../shared/leadBot/engine";
import { scoreLead } from "../../shared/leadBot/scoring";
import { maskPhone, sanitizeText } from "../../shared/leadBot/text";
import { detectIntent } from "../../shared/leadBot/understanding";
import { ENV } from "../_core/env";
import { invokeLLM } from "../_core/llm";
import { notifyHandoffRequested, notifyHotLead } from "./notifications";
import { FAQ_TIMEOUT_MS, NLU_TIMEOUT_MS, answerFromKnowledge, understandWithAi, withTimeout, type InvokeFn } from "./providers";
import {
  DuplicateClientMessageError,
  commitTurn,
  countConversationsByIpSince,
  countUserMessagesSince,
  createConversation,
  findConversationByToken,
  findReplayByClientId,
  getConversationById,
  getLeadBotSettings,
  getLeadByConversation,
  getSiteWhatsappNumber,
  listActiveKnowledge,
  listMessages,
  markHotNotified,
  recordConversationEvents,
  updateConversationLang,
  type ChatMessage,
  type ConversationRecord,
  type Handoff,
  type NewMessage,
  type StoredReply,
} from "./repo";
import { normalizeWhatsappNumber, toEngineSettings, type LeadBotSettings } from "./settings";

/** Visitor messages allowed per conversation per minute. */
export const MAX_MESSAGES_PER_MINUTE = 12;
/** New conversations allowed per IP per hour. */
export const MAX_CONVERSATIONS_PER_IP_HOUR = 30;
const HOUR_MS = 60 * 60 * 1000;

export type PublicHandoff = { status: Handoff["status"]; agentName: string | null; requestedAt: number };
export type PublicMessage = ChatMessage & { reply: (StoredReply & { faqPlaceholder?: never }) | null };
export type ConversationView = {
  disabled: false;
  token: string;
  lang: Lang;
  stage: EngineState["stage"];
  step: { step: number; total: number } | null;
  locked: boolean;
  resumed: boolean;
  handoff: PublicHandoff | null;
  messages: PublicMessage[];
};
export type DisabledView = { disabled: true; whatsappNumber: string | null };
export type TurnView = {
  stage: EngineState["stage"];
  step: { step: number; total: number } | null;
  locked: boolean;
  handoff: PublicHandoff | null;
  messages: PublicMessage[];
  replayed: boolean;
};

export type ServiceDeps = {
  now?: () => number;
  invoke?: InvokeFn;
};

export function hashIp(ip: string | null | undefined): string | null {
  const value = (ip ?? "").trim();
  if (!value) return null;
  return createHash("sha256").update(`${ENV.cookieSecret}:lead-bot:${value}`).digest("hex");
}

export function newConversationToken() {
  return randomBytes(24).toString("base64url");
}

function publicHandoff(handoff: Handoff | null): PublicHandoff | null {
  if (!handoff) return null;
  return { status: handoff.status, agentName: handoff.agentName, requestedAt: handoff.requestedAt };
}

function isLocked(state: EngineState) {
  return state.strikes >= MAX_MODERATION_STRIKES || state.stage === "closed";
}

/** Stored bot reply: no text duplication, and the phone stays masked in summaries. */
export function toStoredReply(reply: BotReply): StoredReply | null {
  const { text: _text, faqPlaceholder: _faq, ...rest } = reply;
  const stored: StoredReply = { ...rest };
  if (stored.summary) {
    stored.summary = stored.summary.map((item) =>
      item.key === "phone" ? { ...item, value: maskPhone(item.value) } : item,
    );
  }
  return Object.keys(stored).length ? stored : null;
}

function botMessages(replies: BotReply[], startAt: number): NewMessage[] {
  return replies.map((reply, index) => ({
    role: "bot" as const,
    text: reply.text,
    reply: toStoredReply(reply),
    createdAt: startAt + index,
  }));
}

/** Return this turn's bot messages with the live (unmasked) summary for the visitor's own screen. */
function withLiveSummaries(saved: ChatMessage[], replies: BotReply[]): PublicMessage[] {
  let botIndex = 0;
  return saved.map((message) => {
    if (message.role !== "bot") return message as PublicMessage;
    const live = replies[botIndex++];
    if (!live?.summary || !message.reply) return message as PublicMessage;
    return { ...message, reply: { ...message.reply, summary: live.summary } } as PublicMessage;
  });
}

/**
 * Settings are read on every turn; a short in-memory cache avoids two extra
 * database round trips per message. Saving settings clears it immediately.
 */
const SETTINGS_CACHE_MS = 5_000;
let settingsCache: { at: number; value: Promise<[LeadBotSettings, string | null]> } | null = null;
export function invalidateLeadBotSettingsCache() {
  settingsCache = null;
}
function loadSettingsPair(): Promise<[LeadBotSettings, string | null]> {
  const at = Date.now();
  if (settingsCache && at - settingsCache.at < SETTINGS_CACHE_MS) return settingsCache.value;
  const value = Promise.all([getLeadBotSettings(), getSiteWhatsappNumber()]);
  settingsCache = { at, value };
  value.catch(() => {
    if (settingsCache?.value === value) settingsCache = null;
  });
  return value;
}

async function engineSettingsNow(now: number) {
  const [settings, siteWhatsapp] = await loadSettingsPair();
  return { settings, engine: toEngineSettings(settings, siteWhatsapp, now) };
}

/** Alerts run after the reply is returned; tests can await them. */
let notificationTask: Promise<unknown> = Promise.resolve();
export function waitForLeadNotifications() {
  return notificationTask;
}

function view(conversation: ConversationRecord, messages: ChatMessage[], resumed: boolean): ConversationView {
  return {
    disabled: false,
    token: conversation.token,
    lang: conversation.lang,
    stage: conversation.state.stage,
    step: stepProgress(conversation.state),
    locked: isLocked(conversation.state),
    resumed,
    handoff: publicHandoff(conversation.handoff),
    messages: messages as PublicMessage[],
  };
}

/** Public configuration the widget needs before any data is stored. */
export async function getPublicConfig() {
  const [settings, siteWhatsapp] = await loadSettingsPair();
  return {
    enabled: settings.enabled,
    whatsappNumber: normalizeWhatsappNumber(settings.whatsappNumber) || normalizeWhatsappNumber(siteWhatsapp) || null,
  };
}

async function createFresh(lang: Lang, pagePath: string | null, ip: string | null, now: number): Promise<ConversationView> {
  const ipHash = hashIp(ip);
  if (ipHash && (await countConversationsByIpSince(ipHash, now - HOUR_MS)) >= MAX_CONVERSATIONS_PER_IP_HOUR) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "rate_limited_ip" });
  }
  const { engine } = await engineSettingsNow(now);
  const result = startConversation(createInitialState(lang), engine);
  const created = await createConversation({
    token: newConversationToken(),
    lang,
    state: result.state,
    pagePath,
    ipHash,
    now,
    messages: botMessages(result.replies, now),
    events: result.events,
  });
  return view(created.conversation, created.messages, false);
}

export async function startOrResume(
  input: { token?: string | null; lang: Lang; pagePath?: string | null; consentToStore?: boolean; ip?: string | null },
  deps: ServiceDeps = {},
): Promise<ConversationView | DisabledView> {
  const now = deps.now?.() ?? Date.now();
  if (input.token) {
    const existing = await findConversationByToken(input.token);
    if (existing) {
      let conversation = existing;
      if (existing.lang !== input.lang && !isLocked(existing.state)) {
        conversation = await updateConversationLang(existing, input.lang, now);
      }
      return view(conversation, await listMessages(conversation.id, { limit: 300 }), true);
    }
  }
  const config = await getPublicConfig();
  if (!config.enabled) return { disabled: true, whatsappNumber: config.whatsappNumber };
  if (input.consentToStore !== true) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "consent_required" });
  }
  return createFresh(input.lang, input.pagePath ?? null, input.ip ?? null, now);
}

export async function restartConversation(
  input: { token: string; lang: Lang; ip?: string | null },
  deps: ServiceDeps = {},
): Promise<ConversationView | DisabledView> {
  const now = deps.now?.() ?? Date.now();
  const existing = await findConversationByToken(input.token);
  if (existing && existing.state.strikes >= MAX_MODERATION_STRIKES) {
    throw new TRPCError({ code: "FORBIDDEN", message: "conversation_locked" });
  }
  const config = await getPublicConfig();
  if (!config.enabled) return { disabled: true, whatsappNumber: config.whatsappNumber };
  return createFresh(input.lang, null, input.ip ?? null, now);
}

async function replayView(conversationId: number, messages: ChatMessage[]): Promise<TurnView> {
  const latest = await getConversationById(conversationId);
  return {
    stage: latest?.state.stage ?? "qualifying",
    step: latest ? stepProgress(latest.state) : null,
    locked: latest ? isLocked(latest.state) : false,
    handoff: publicHandoff(latest?.handoff ?? null),
    messages: messages as PublicMessage[],
    replayed: true,
  };
}

export async function sendVisitorMessage(
  input: { token: string; clientId: string; text?: string; quickReply?: string; label?: string },
  deps: ServiceDeps = {},
): Promise<TurnView> {
  const conversation = await findConversationByToken(input.token);
  if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "conversation_not_found" });
  const typed = (input.text ?? "").trim();
  if (!typed && !input.quickReply) throw new TRPCError({ code: "BAD_REQUEST", message: "empty_message" });

  const now = deps.now?.() ?? Date.now();
  // Independent reads run together: one round trip instead of four.
  const [replay, recentCount, { settings, engine }, existingLead] = await Promise.all([
    findReplayByClientId(conversation.id, input.clientId),
    countUserMessagesSince(conversation.id, now - 60_000),
    engineSettingsNow(now),
    getLeadByConversation(conversation.id),
  ]);
  if (replay) return replayView(conversation.id, replay);
  if (recentCount >= MAX_MESSAGES_PER_MINUTE) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "rate_limited_messages" });
  }
  if (isLocked(conversation.state)) throw new TRPCError({ code: "FORBIDDEN", message: "conversation_locked" });

  const state = conversation.state;
  const engineInput: EngineInput = input.quickReply ? { quickReply: input.quickReply } : { text: typed };
  const invoke = deps.invoke ?? invokeLLM;

  let aiHint: AiHint | null = null;
  if (settings.aiAssist && engineInput.text && state.stage !== "escalated") {
    const detected = detectIntent(engineInput.text);
    if ((detected.intent === "unknown" || detected.confidence < 0.7) && engineInput.text.length >= 4) {
      aiHint = await withTimeout(understandWithAi(engineInput.text, state, invoke), NLU_TIMEOUT_MS).catch(() => null);
    }
  }

  const result = processMessage(state, engineInput, engine, aiHint);
  const userText = input.quickReply
    ? sanitizeText(input.label || input.quickReply, 120)
    : sanitizeText(result.storedUserText ?? "");
  const replies = [...result.replies];

  if (result.needsFaqAnswer && engineInput.text) {
    const answer = await withTimeout(
      answerFromKnowledge(result.storedUserText ?? engineInput.text, state.lang, {
        listKnowledge: listActiveKnowledge,
        aiAssist: settings.aiAssist,
        invoke,
      }),
      FAQ_TIMEOUT_MS,
    ).catch(() => null);
    if (answer) {
      const index = replies.findIndex((reply) => reply.faqPlaceholder);
      const merged: BotReply = { ...(index >= 0 ? replies[index] : {}), text: answer, faqPlaceholder: undefined };
      if (index >= 0) replies[index] = merged;
      else replies.unshift(merged);
    }
  }

  let handoff = conversation.handoff;
  if (result.escalate) {
    handoff = { status: "waiting", reason: result.escalate.reason, agentName: null, requestedAt: result.escalate.at, resolvedAt: null };
  }

  const shouldStoreLead = result.leadReady || !!result.escalate || !!existingLead;
  const messages: NewMessage[] = [
    { role: "user", text: userText || "…", clientId: input.clientId, createdAt: now },
    ...botMessages(replies, now + 1),
  ];

  let saved: Awaited<ReturnType<typeof commitTurn>>;
  try {
    saved = await commitTurn({
      conversationId: conversation.id,
      state: result.state,
      handoff,
      lang: result.state.lang,
      now,
      messages,
      events: result.events,
      lead: shouldStoreLead
        ? {
            kind: result.state.flow === "partner" ? "partner" : "sales",
            slots: result.state.slots,
            score: scoreLead(result.state.slots, "ar"),
            qualified: result.state.stage === "completed" || !!existingLead?.qualified,
            handoff,
            incrementUnread: result.forwardToHuman || !!result.escalate,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof DuplicateClientMessageError) {
      const again = await findReplayByClientId(conversation.id, input.clientId);
      if (again) return replayView(conversation.id, again);
    }
    throw error;
  }

  const lead = saved.lead;
  if (lead) {
    const escalation = result.escalate;
    const hotCandidate = !escalation && result.leadReady && result.state.stage === "completed" && lead.grade === "hot" && !existingLead?.qualified;
    if (escalation || hotCandidate) {
      const task = (async () => {
        if (escalation) await notifyHandoffRequested(lead, escalation.reason);
        else if (await markHotNotified(lead.id, now)) await notifyHotLead(lead);
      })().catch((error) => console.warn("[LeadBot] Alert task failed:", error instanceof Error ? error.message : error));
      notificationTask = notificationTask.then(() => task);
    }
  }

  return {
    stage: result.state.stage,
    step: stepProgress(result.state),
    locked: isLocked(result.state),
    handoff: publicHandoff(handoff),
    messages: withLiveSummaries(saved.messages, replies),
    replayed: false,
  };
}

export async function pollConversation(input: { token: string; afterId: number }) {
  const conversation = await findConversationByToken(input.token);
  if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "conversation_not_found" });
  const messages = await listMessages(conversation.id, { afterId: input.afterId, roles: ["agent", "system"], limit: 100 });
  return {
    stage: conversation.state.stage,
    locked: isLocked(conversation.state),
    handoff: publicHandoff(conversation.handoff),
    messages: messages as PublicMessage[],
  };
}

export async function trackVisitorAction(input: { token: string; action: string }, deps: ServiceDeps = {}) {
  const conversation = await findConversationByToken(input.token);
  if (!conversation) return { ok: false as const };
  const now = deps.now?.() ?? Date.now();
  await recordConversationEvents(conversation.id, [{ type: "action_suggested", detail: `clicked:${input.action}` }], now);
  return { ok: true as const };
}
