/**
 * Drizzle data access for the sales assistant. Every visitor turn is written
 * in ONE transaction (visitor message + bot replies + engine state + lead +
 * analytics events) so a failure never leaves a half-saved conversation.
 */
import { and, asc, count, desc, eq, gt, gte, inArray, isNull, like, lt, or, sql } from "drizzle-orm";
import { getDb, listAssistantFaqs } from "../db";
import {
  appSettings,
  leadBotConversations,
  leadBotEvents,
  leadBotLeads,
  leadBotMessages,
  leadBotSettings,
  type LeadBotConversationRow,
  type LeadBotLeadRow,
  type LeadBotMessageRow,
} from "../../drizzle/schema";
import type { Lang } from "../../shared/leadBot/catalog";
import { restoreState, type BotReply, type EngineEvent, type EngineState, type EscalationReason } from "../../shared/leadBot/engine";
import type { LeadScore } from "../../shared/leadBot/scoring";
import type { LeadSlots } from "../../shared/leadBot/understanding";
import type { KnowledgeEntry } from "./providers";
import { DEFAULT_LEAD_BOT_SETTINGS, settingsFromRow, type LeadBotSettings, type LeadBotSettingsInput } from "./settings";

export type HandoffStatus = "waiting" | "active" | "resolved";
export type Handoff = {
  status: HandoffStatus;
  reason: EscalationReason;
  agentName: string | null;
  requestedAt: number;
  resolvedAt?: number | null;
};
export type StoredReply = Omit<BotReply, "text" | "faqPlaceholder">;
export type MessageRole = "user" | "bot" | "agent" | "system";
export type ChatMessage = {
  id: number;
  role: MessageRole;
  text: string;
  reply: StoredReply | null;
  authorName: string | null;
  clientId: string | null;
  createdAt: number;
};
export type NewMessage = {
  role: MessageRole;
  text: string;
  reply?: StoredReply | null;
  clientId?: string | null;
  authorName?: string | null;
  createdAt: number;
};
export type ConversationRecord = {
  id: number;
  token: string;
  lang: Lang;
  state: EngineState;
  handoff: Handoff | null;
  createdAt: number;
  lastMessageAt: number;
};
export type LeadKind = "sales" | "partner";
export type LeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";
export type LeadUpsert = {
  kind: LeadKind;
  slots: LeadSlots;
  score: LeadScore;
  qualified: boolean;
  handoff: Handoff | null;
  incrementUnread: boolean;
};
export type LeadRecord = {
  id: number;
  conversationId: number;
  kind: LeadKind;
  status: LeadStatus;
  slots: LeadSlots;
  score: number;
  grade: "hot" | "warm" | "cold";
  breakdown: LeadScore["breakdown"];
  qualified: boolean;
  handoffStatus: "none" | HandoffStatus;
  handoff: Handoff | null;
  service: string | null;
  name: string | null;
  phone: string | null;
  assignedTo: string | null;
  notes: string | null;
  unreadForStaff: number;
  hotNotifiedAt: number | null;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number;
};

export class DuplicateClientMessageError extends Error {
  constructor() {
    super("duplicate_client_message");
  }
}

function isDuplicateEntry(error: unknown) {
  const value = error as { code?: string; cause?: { code?: string } } | null;
  return value?.code === "ER_DUP_ENTRY" || value?.cause?.code === "ER_DUP_ENTRY";
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseHandoff(raw: string | null | undefined): Handoff | null {
  const value = parseJson<Partial<Handoff> | null>(raw, null);
  if (!value || typeof value !== "object") return null;
  if (value.status !== "waiting" && value.status !== "active" && value.status !== "resolved") return null;
  return {
    status: value.status,
    reason: value.reason === "complaint" ? "complaint" : "requested",
    agentName: typeof value.agentName === "string" ? value.agentName : null,
    requestedAt: Number(value.requestedAt) || 0,
    resolvedAt: value.resolvedAt ? Number(value.resolvedAt) : null,
  };
}

export function toConversation(row: LeadBotConversationRow): ConversationRecord {
  const lang: Lang = row.lang === "en" ? "en" : "ar";
  return {
    id: row.id,
    token: row.token,
    lang,
    state: restoreState(parseJson<unknown>(row.stateJson, null), lang),
    handoff: parseHandoff(row.handoffJson),
    createdAt: Number(row.createdAt),
    lastMessageAt: Number(row.lastMessageAt),
  };
}

export function toMessage(row: LeadBotMessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    text: row.text,
    reply: parseJson<StoredReply | null>(row.replyJson, null),
    authorName: row.authorName ?? null,
    clientId: row.clientId ?? null,
    createdAt: Number(row.createdAt),
  };
}

export function toLead(row: LeadBotLeadRow): LeadRecord {
  const score = parseJson<Partial<LeadScore>>(row.scoreJson, {});
  return {
    id: row.id,
    conversationId: row.conversationId,
    kind: row.kind,
    status: row.status,
    slots: parseJson<LeadSlots>(row.slotsJson, {}),
    score: row.score,
    grade: row.grade,
    breakdown: Array.isArray(score.breakdown) ? score.breakdown : [],
    qualified: Boolean(row.qualified),
    handoffStatus: row.handoffStatus,
    handoff: parseHandoff(row.handoffJson),
    service: row.service ?? null,
    name: row.name ?? null,
    phone: row.phoneKey ?? null,
    assignedTo: row.assignedTo ?? null,
    notes: row.notes ?? null,
    unreadForStaff: row.unreadForStaff,
    hotNotifiedAt: row.hotNotifiedAt ? Number(row.hotNotifiedAt) : null,
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
    lastMessageAt: Number(row.lastMessageAt),
  };
}

function messageValues(conversationId: number, messages: NewMessage[]) {
  return messages.map((message) => ({
    conversationId,
    role: message.role,
    text: message.text,
    replyJson: message.reply && Object.keys(message.reply).length ? JSON.stringify(message.reply) : null,
    clientId: message.clientId ?? null,
    authorName: message.authorName ?? null,
    createdAt: message.createdAt,
  }));
}

function eventValues(conversationId: number, events: EngineEvent[], now: number) {
  return events.map((event) => ({
    conversationId,
    type: event.type.slice(0, 40),
    intent: event.intent ? String(event.intent).slice(0, 40) : null,
    slot: event.slot ? String(event.slot).slice(0, 40) : null,
    detail: event.detail ? String(event.detail).slice(0, 120) : null,
    createdAt: now,
  }));
}

/* ------------------------------------------------------------------ */
/* Settings + knowledge                                                */
/* ------------------------------------------------------------------ */

export async function getLeadBotSettings(): Promise<LeadBotSettings> {
  const db = await requireDb();
  const rows = await db.select().from(leadBotSettings).where(eq(leadBotSettings.id, 1)).limit(1);
  return rows[0] ? settingsFromRow(rows[0]) : { ...DEFAULT_LEAD_BOT_SETTINGS };
}

export async function saveLeadBotSettings(input: LeadBotSettingsInput, actorName: string, now = Date.now()): Promise<LeadBotSettings> {
  const db = await requireDb();
  const values = {
    enabled: input.enabled,
    aiAssist: input.aiAssist,
    autoEscalateAfterFallbacks: input.autoEscalateAfterFallbacks,
    offerHumanToHotLeads: input.offerHumanToHotLeads,
    workingDaysJson: JSON.stringify(input.workingDays),
    workStartHour: input.workStartHour,
    workEndHour: input.workEndHour,
    responseSlaAr: input.responseSlaAr,
    responseSlaEn: input.responseSlaEn,
    whatsappNumber: input.whatsappNumber,
    servicesJson: JSON.stringify(input.services),
    updatedAt: now,
    updatedByName: actorName.slice(0, 160),
  };
  await db.insert(leadBotSettings).values({ id: 1, ...values }).onDuplicateKeyUpdate({ set: values });
  return getLeadBotSettings();
}

export async function getSiteWhatsappNumber(): Promise<string | null> {
  const db = await requireDb();
  const rows = await db.select({ whatsappNumber: appSettings.whatsappNumber }).from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  return rows[0]?.whatsappNumber ?? null;
}

export async function listActiveKnowledge(): Promise<KnowledgeEntry[]> {
  const rows = await listAssistantFaqs(false);
  return rows.map((row) => ({
    id: row.id,
    questionAr: row.questionAr,
    answerAr: row.answerAr,
    questionEn: row.questionEn ?? null,
    answerEn: row.answerEn ?? null,
  }));
}

/* ------------------------------------------------------------------ */
/* Visitor conversations                                               */
/* ------------------------------------------------------------------ */

export async function findConversationByToken(token: string): Promise<ConversationRecord | null> {
  const db = await requireDb();
  const rows = await db.select().from(leadBotConversations).where(eq(leadBotConversations.token, token)).limit(1);
  return rows[0] ? toConversation(rows[0]) : null;
}

export async function countConversationsByIpSince(ipHash: string, since: number): Promise<number> {
  const db = await requireDb();
  const rows = await db
    .select({ value: count() })
    .from(leadBotConversations)
    .where(and(eq(leadBotConversations.ipHash, ipHash), gte(leadBotConversations.createdAt, since)));
  return Number(rows[0]?.value ?? 0);
}

export async function createConversation(input: {
  token: string;
  lang: Lang;
  state: EngineState;
  pagePath: string | null;
  ipHash: string | null;
  now: number;
  messages: NewMessage[];
  events: EngineEvent[];
}): Promise<{ conversation: ConversationRecord; messages: ChatMessage[] }> {
  const db = await requireDb();
  const id = await db.transaction(async (tx) => {
    const inserted = await tx.insert(leadBotConversations).values({
      token: input.token,
      lang: input.lang,
      stateJson: JSON.stringify(input.state),
      handoffJson: null,
      pagePath: input.pagePath,
      ipHash: input.ipHash,
      storageConsentAt: input.now,
      createdAt: input.now,
      updatedAt: input.now,
      lastMessageAt: input.now,
    });
    const conversationId = Number(inserted[0].insertId);
    if (input.messages.length) await tx.insert(leadBotMessages).values(messageValues(conversationId, input.messages));
    if (input.events.length) await tx.insert(leadBotEvents).values(eventValues(conversationId, input.events, input.now));
    return conversationId;
  });
  const conversation = (await db.select().from(leadBotConversations).where(eq(leadBotConversations.id, id)).limit(1))[0];
  return { conversation: toConversation(conversation), messages: await listMessages(id) };
}

export async function listMessages(conversationId: number, options: { afterId?: number; roles?: MessageRole[]; limit?: number } = {}): Promise<ChatMessage[]> {
  const db = await requireDb();
  const conditions = [eq(leadBotMessages.conversationId, conversationId)];
  if (options.afterId) conditions.push(gt(leadBotMessages.id, options.afterId));
  if (options.roles?.length) conditions.push(inArray(leadBotMessages.role, options.roles));
  const rows = await db
    .select()
    .from(leadBotMessages)
    .where(and(...conditions))
    .orderBy(desc(leadBotMessages.id))
    .limit(options.limit ?? 200);
  return rows.reverse().map(toMessage);
}

/** Visitor message with this client id plus the replies stored right after it. */
export async function findReplayByClientId(conversationId: number, clientId: string): Promise<ChatMessage[] | null> {
  const db = await requireDb();
  const userRow = (
    await db
      .select()
      .from(leadBotMessages)
      .where(and(eq(leadBotMessages.conversationId, conversationId), eq(leadBotMessages.clientId, clientId)))
      .limit(1)
  )[0];
  if (!userRow) return null;
  const nextUser = (
    await db
      .select({ id: leadBotMessages.id })
      .from(leadBotMessages)
      .where(and(eq(leadBotMessages.conversationId, conversationId), eq(leadBotMessages.role, "user"), gt(leadBotMessages.id, userRow.id)))
      .orderBy(asc(leadBotMessages.id))
      .limit(1)
  )[0];
  const conditions = [eq(leadBotMessages.conversationId, conversationId), gte(leadBotMessages.id, userRow.id)];
  if (nextUser) conditions.push(lt(leadBotMessages.id, nextUser.id));
  const rows = await db.select().from(leadBotMessages).where(and(...conditions)).orderBy(asc(leadBotMessages.id)).limit(20);
  return rows.map(toMessage);
}

export async function countUserMessagesSince(conversationId: number, since: number): Promise<number> {
  const db = await requireDb();
  const rows = await db
    .select({ value: count() })
    .from(leadBotMessages)
    .where(and(eq(leadBotMessages.conversationId, conversationId), eq(leadBotMessages.role, "user"), gte(leadBotMessages.createdAt, since)));
  return Number(rows[0]?.value ?? 0);
}

export async function getLeadByConversation(conversationId: number): Promise<LeadRecord | null> {
  const db = await requireDb();
  const rows = await db.select().from(leadBotLeads).where(eq(leadBotLeads.conversationId, conversationId)).limit(1);
  return rows[0] ? toLead(rows[0]) : null;
}

function leadColumns(lead: LeadUpsert) {
  return {
    kind: lead.kind,
    slotsJson: JSON.stringify(lead.slots),
    score: lead.score.score,
    grade: lead.score.grade,
    scoreJson: JSON.stringify({ score: lead.score.score, grade: lead.score.grade, breakdown: lead.score.breakdown }),
    qualified: lead.qualified,
    handoffStatus: (lead.handoff?.status ?? "none") as LeadRecord["handoffStatus"],
    handoffJson: lead.handoff ? JSON.stringify(lead.handoff) : null,
    service: lead.slots.service ?? null,
    name: lead.slots.name ? lead.slots.name.slice(0, 160) : null,
    phoneKey: lead.slots.phone ?? null,
  };
}

/**
 * Persist one visitor turn atomically. Throws DuplicateClientMessageError
 * when another request already stored the same client message id.
 */
export async function commitTurn(input: {
  conversationId: number;
  state: EngineState;
  handoff: Handoff | null;
  lang: Lang;
  now: number;
  messages: NewMessage[];
  events: EngineEvent[];
  lead: LeadUpsert | null;
}): Promise<{ messages: ChatMessage[]; lead: LeadRecord | null; leadCreated: boolean }> {
  const db = await requireDb();
  let firstMessageId = 0;
  let leadCreated = false;
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(leadBotConversations)
        .set({
          stateJson: JSON.stringify(input.state),
          handoffJson: input.handoff ? JSON.stringify(input.handoff) : null,
          lang: input.lang,
          updatedAt: input.now,
          lastMessageAt: input.now,
        })
        .where(eq(leadBotConversations.id, input.conversationId));
      if (input.messages.length) {
        const inserted = await tx.insert(leadBotMessages).values(messageValues(input.conversationId, input.messages));
        firstMessageId = Number(inserted[0].insertId);
      }
      if (input.events.length) await tx.insert(leadBotEvents).values(eventValues(input.conversationId, input.events, input.now));
      if (input.lead) {
        const existing = (await tx.select().from(leadBotLeads).where(eq(leadBotLeads.conversationId, input.conversationId)).limit(1))[0];
        const columns = leadColumns(input.lead);
        if (existing) {
          await tx
            .update(leadBotLeads)
            .set({
              ...columns,
              qualified: columns.qualified || Boolean(existing.qualified),
              unreadForStaff: input.lead.incrementUnread ? sql`${leadBotLeads.unreadForStaff} + 1` : existing.unreadForStaff,
              updatedAt: input.now,
              lastMessageAt: input.now,
            })
            .where(eq(leadBotLeads.id, existing.id));
        } else {
          leadCreated = true;
          await tx.insert(leadBotLeads).values({
            conversationId: input.conversationId,
            status: "new",
            ...columns,
            unreadForStaff: input.lead.incrementUnread ? 1 : 0,
            createdAt: input.now,
            updatedAt: input.now,
            lastMessageAt: input.now,
          });
        }
      }
    });
  } catch (error) {
    if (isDuplicateEntry(error)) throw new DuplicateClientMessageError();
    throw error;
  }
  const messages = firstMessageId
    ? (
        await db
          .select()
          .from(leadBotMessages)
          .where(and(eq(leadBotMessages.conversationId, input.conversationId), gte(leadBotMessages.id, firstMessageId)))
          .orderBy(asc(leadBotMessages.id))
          .limit(input.messages.length + 5)
      ).map(toMessage)
    : [];
  return { messages, lead: input.lead ? await getLeadByConversation(input.conversationId) : null, leadCreated };
}

/** Mark the hot-lead notification once. Returns false if it was already sent. */
export async function markHotNotified(leadId: number, now = Date.now()): Promise<boolean> {
  const db = await requireDb();
  const result = await db
    .update(leadBotLeads)
    .set({ hotNotifiedAt: now })
    .where(and(eq(leadBotLeads.id, leadId), isNull(leadBotLeads.hotNotifiedAt)));
  return Number((result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) > 0;
}

/* ------------------------------------------------------------------ */
/* Staff                                                               */
/* ------------------------------------------------------------------ */

export type LeadListFilters = {
  search?: string;
  phoneDigits?: string;
  grade?: "hot" | "warm" | "cold";
  status?: LeadStatus;
  service?: string;
  kind?: LeadKind;
  handoffOnly?: boolean;
  unreadOnly?: boolean;
  limit?: number;
};

export async function listLeads(filters: LeadListFilters): Promise<LeadRecord[]> {
  const db = await requireDb();
  const conditions = [];
  if (filters.phoneDigits) conditions.push(like(leadBotLeads.phoneKey, `%${filters.phoneDigits}%`));
  else if (filters.search) conditions.push(like(leadBotLeads.name, `%${filters.search.replace(/[%_\\]/g, "\\$&")}%`));
  if (filters.grade) conditions.push(eq(leadBotLeads.grade, filters.grade));
  if (filters.status) conditions.push(eq(leadBotLeads.status, filters.status));
  if (filters.service) conditions.push(eq(leadBotLeads.service, filters.service));
  if (filters.kind) conditions.push(eq(leadBotLeads.kind, filters.kind));
  if (filters.handoffOnly) conditions.push(or(eq(leadBotLeads.handoffStatus, "waiting"), eq(leadBotLeads.handoffStatus, "active")));
  if (filters.unreadOnly) conditions.push(gt(leadBotLeads.unreadForStaff, 0));
  const rows = await db
    .select()
    .from(leadBotLeads)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      sql`CASE WHEN ${leadBotLeads.handoffStatus} IN ('waiting','active') THEN 0 ELSE 1 END`,
      desc(leadBotLeads.lastMessageAt),
    )
    .limit(filters.limit ?? 200);
  return rows.map(toLead);
}

export async function getLeadById(leadId: number): Promise<LeadRecord | null> {
  const db = await requireDb();
  const rows = await db.select().from(leadBotLeads).where(eq(leadBotLeads.id, leadId)).limit(1);
  return rows[0] ? toLead(rows[0]) : null;
}

export async function getConversationById(conversationId: number): Promise<ConversationRecord | null> {
  const db = await requireDb();
  const rows = await db.select().from(leadBotConversations).where(eq(leadBotConversations.id, conversationId)).limit(1);
  return rows[0] ? toConversation(rows[0]) : null;
}

/** Analytics-only events outside a visitor turn (e.g. a clicked action button). */
export async function recordConversationEvents(conversationId: number, events: EngineEvent[], now = Date.now()) {
  if (!events.length) return;
  const db = await requireDb();
  await db.insert(leadBotEvents).values(eventValues(conversationId, events, now));
}

/** Follow the site language switch for future bot replies; stored history is not rewritten. */
export async function updateConversationLang(conversation: ConversationRecord, lang: Lang, now = Date.now()): Promise<ConversationRecord> {
  const db = await requireDb();
  const state: EngineState = { ...conversation.state, lang };
  await db
    .update(leadBotConversations)
    .set({ lang, stateJson: JSON.stringify(state), updatedAt: now })
    .where(eq(leadBotConversations.id, conversation.id));
  return { ...conversation, lang, state };
}

export async function resetLeadUnread(leadId: number) {
  const db = await requireDb();
  await db.update(leadBotLeads).set({ unreadForStaff: 0 }).where(eq(leadBotLeads.id, leadId));
}

/** Staff reply: one transaction for the message, the handoff and the lead. */
export async function saveStaffReply(input: {
  lead: LeadRecord;
  conversation: ConversationRecord;
  text: string;
  agentName: string;
  now: number;
}): Promise<ChatMessage> {
  const db = await requireDb();
  const handoff: Handoff = {
    status: "active",
    reason: input.conversation.handoff?.reason ?? input.lead.handoff?.reason ?? "requested",
    agentName: input.agentName,
    requestedAt: input.conversation.handoff?.requestedAt ?? input.now,
    resolvedAt: null,
  };
  const state: EngineState = {
    ...input.conversation.state,
    stage: "escalated",
    escalation: input.conversation.state.escalation ?? { reason: handoff.reason, at: handoff.requestedAt },
  };
  let messageId = 0;
  await db.transaction(async (tx) => {
    const inserted = await tx.insert(leadBotMessages).values({
      conversationId: input.conversation.id,
      role: "agent",
      text: input.text,
      replyJson: null,
      clientId: null,
      authorName: input.agentName.slice(0, 160),
      createdAt: input.now,
    });
    messageId = Number(inserted[0].insertId);
    await tx
      .update(leadBotConversations)
      .set({ stateJson: JSON.stringify(state), handoffJson: JSON.stringify(handoff), updatedAt: input.now, lastMessageAt: input.now })
      .where(eq(leadBotConversations.id, input.conversation.id));
    await tx
      .update(leadBotLeads)
      .set({
        handoffStatus: "active",
        handoffJson: JSON.stringify(handoff),
        status: input.lead.status === "new" ? "contacted" : input.lead.status,
        assignedTo: input.lead.assignedTo || input.agentName.slice(0, 160),
        unreadForStaff: 0,
        updatedAt: input.now,
        lastMessageAt: input.now,
      })
      .where(eq(leadBotLeads.id, input.lead.id));
  });
  const row = (await db.select().from(leadBotMessages).where(eq(leadBotMessages.id, messageId)).limit(1))[0];
  return toMessage(row);
}

export async function saveHandoffResolution(input: {
  lead: LeadRecord;
  conversation: ConversationRecord;
  systemMessage: NewMessage;
  now: number;
}) {
  const db = await requireDb();
  const handoff: Handoff = {
    status: "resolved",
    reason: input.conversation.handoff?.reason ?? input.lead.handoff?.reason ?? "requested",
    agentName: input.conversation.handoff?.agentName ?? input.lead.handoff?.agentName ?? null,
    requestedAt: input.conversation.handoff?.requestedAt ?? input.lead.handoff?.requestedAt ?? input.now,
    resolvedAt: input.now,
  };
  const state: EngineState = {
    ...input.conversation.state,
    stage: input.lead.qualified ? "completed" : "welcome",
    pending: null,
    escalation: null,
    fallbackCount: 0,
  };
  await db.transaction(async (tx) => {
    await tx.insert(leadBotMessages).values(messageValues(input.conversation.id, [input.systemMessage]));
    await tx
      .update(leadBotConversations)
      .set({ stateJson: JSON.stringify(state), handoffJson: JSON.stringify(handoff), updatedAt: input.now, lastMessageAt: input.now })
      .where(eq(leadBotConversations.id, input.conversation.id));
    await tx
      .update(leadBotLeads)
      .set({ handoffStatus: "resolved", handoffJson: JSON.stringify(handoff), unreadForStaff: 0, updatedAt: input.now })
      .where(eq(leadBotLeads.id, input.lead.id));
  });
  return handoff;
}

export async function updateLeadDetails(leadId: number, input: { status?: LeadStatus; notes?: string | null; assignedTo?: string | null }, now = Date.now()) {
  const db = await requireDb();
  const set: Partial<typeof leadBotLeads.$inferInsert> = { updatedAt: now };
  if (input.status) set.status = input.status;
  if (input.notes !== undefined) set.notes = input.notes;
  if (input.assignedTo !== undefined) set.assignedTo = input.assignedTo;
  await db.update(leadBotLeads).set(set).where(eq(leadBotLeads.id, leadId));
  return getLeadById(leadId);
}

export async function countOpenHandoffs(): Promise<{ waiting: number; active: number; unread: number }> {
  const db = await requireDb();
  const rows = await db
    .select({ status: leadBotLeads.handoffStatus, value: count(), unread: sql<number>`COALESCE(SUM(${leadBotLeads.unreadForStaff}), 0)` })
    .from(leadBotLeads)
    .where(or(eq(leadBotLeads.handoffStatus, "waiting"), eq(leadBotLeads.handoffStatus, "active")))
    .groupBy(leadBotLeads.handoffStatus);
  const waiting = Number(rows.find((row) => row.status === "waiting")?.value ?? 0);
  const active = Number(rows.find((row) => row.status === "active")?.value ?? 0);
  const unread = rows.reduce((sum, row) => sum + Number(row.unread ?? 0), 0);
  return { waiting, active, unread };
}

/** Qualified hot sales leads nobody has contacted yet (dashboard alert badge). */
export async function countNewHotLeads(): Promise<number> {
  const db = await requireDb();
  const rows = await db
    .select({ value: count() })
    .from(leadBotLeads)
    .where(and(eq(leadBotLeads.grade, "hot"), eq(leadBotLeads.status, "new"), eq(leadBotLeads.qualified, true), eq(leadBotLeads.kind, "sales")));
  return Number(rows[0]?.value ?? 0);
}

export type AnalyticsRows = {
  conversations: Array<{ id: number; createdAt: number }>;
  events: Array<{ conversationId: number; type: string; intent: string | null; slot: string | null; detail: string | null; createdAt: number }>;
  leads: Array<{ conversationId: number; kind: LeadKind; qualified: boolean; score: number; grade: "hot" | "warm" | "cold"; service: string | null; createdAt: number }>;
};

export async function loadAnalyticsRows(since: number): Promise<AnalyticsRows> {
  const db = await requireDb();
  const [conversations, events, leads] = await Promise.all([
    db.select({ id: leadBotConversations.id, createdAt: leadBotConversations.createdAt }).from(leadBotConversations).where(gte(leadBotConversations.createdAt, since)).limit(20000),
    db
      .select({
        conversationId: leadBotEvents.conversationId,
        type: leadBotEvents.type,
        intent: leadBotEvents.intent,
        slot: leadBotEvents.slot,
        detail: leadBotEvents.detail,
        createdAt: leadBotEvents.createdAt,
      })
      .from(leadBotEvents)
      .where(gte(leadBotEvents.createdAt, since))
      .limit(100000),
    db
      .select({
        conversationId: leadBotLeads.conversationId,
        kind: leadBotLeads.kind,
        qualified: leadBotLeads.qualified,
        score: leadBotLeads.score,
        grade: leadBotLeads.grade,
        service: leadBotLeads.service,
        createdAt: leadBotLeads.createdAt,
      })
      .from(leadBotLeads)
      .where(gte(leadBotLeads.createdAt, since))
      .limit(20000),
  ]);
  return {
    conversations: conversations.map((row) => ({ id: row.id, createdAt: Number(row.createdAt) })),
    events: events.map((row) => ({ ...row, createdAt: Number(row.createdAt) })),
    leads: leads.map((row) => ({ ...row, qualified: Boolean(row.qualified), createdAt: Number(row.createdAt) })),
  };
}
