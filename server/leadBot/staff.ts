/**
 * Staff side of the sales assistant (owner + sales employees). The role is
 * resolved on the server for every request: the owner (users.role="admin")
 * has full access; active team accounts with the "employee" role have
 * everything except settings. Agents, customers and visitors have no access.
 */
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { staffAccounts } from "../../drizzle/schema";
import type { Lang } from "../../shared/leadBot/catalog";
import { looksLikePhoneQuery, normalizePhoneQuery } from "../../shared/phoneSearch";
import { sanitizeText } from "../../shared/leadBot/text";
import { getDb } from "../db";
import {
  countOpenHandoffs,
  countNewHotLeads,
  getConversationById,
  getLeadById,
  listLeads,
  listMessages,
  loadAnalyticsRows,
  resetLeadUnread,
  saveHandoffResolution,
  saveStaffReply,
  updateLeadDetails,
  type AnalyticsRows,
  type LeadListFilters,
  type LeadRecord,
  type LeadStatus,
  type NewMessage,
} from "./repo";

export type StaffRole = "owner" | "staff";
type SessionUser = { id: number; role: string; name?: string | null } | null | undefined;

const DAY_MS = 24 * 60 * 60 * 1000;
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

export async function resolveStaffRole(user: SessionUser): Promise<{ role: StaffRole; name: string } | null> {
  if (!user) return null;
  if (user.role === "admin") return { role: "owner", name: user.name?.trim() || "المالك" };
  if (user.role !== "employee") return null;
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ fullName: staffAccounts.fullName })
    .from(staffAccounts)
    .where(and(eq(staffAccounts.userId, user.id), eq(staffAccounts.role, "employee"), eq(staffAccounts.isActive, true)))
    .limit(1);
  if (!rows[0]) return null;
  return { role: "staff", name: rows[0].fullName?.trim() || user.name?.trim() || "موظف المبيعات" };
}

export async function requireStaff(user: SessionUser, options: { ownerOnly?: boolean } = {}) {
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "login_required" });
  const resolved = await resolveStaffRole(user);
  if (!resolved) throw new TRPCError({ code: "FORBIDDEN", message: "sales_assistant_forbidden" });
  if (options.ownerOnly && resolved.role !== "owner") throw new TRPCError({ code: "FORBIDDEN", message: "owner_only" });
  return resolved;
}

export type LeadListInput = Omit<LeadListFilters, "phoneDigits" | "search"> & { query?: string };

/** Name or phone search: a phone-like query (Arabic digits, +966, spaces) searches the stored phone key. */
export function leadFiltersFromInput(input: LeadListInput): LeadListFilters {
  const { query, ...rest } = input;
  const filters: LeadListFilters = { ...rest };
  const value = (query ?? "").trim();
  if (!value) return filters;
  if (looksLikePhoneQuery(value)) {
    const digits = normalizePhoneQuery(value);
    if (digits.length >= 3) filters.phoneDigits = digits.slice(0, 15);
  } else if (value.length >= 2) {
    filters.search = value.slice(0, 80);
  }
  return filters;
}

export async function listLeadsForStaff(input: LeadListInput) {
  const leads = await listLeads(leadFiltersFromInput(input));
  return { leads, counts: await countOpenHandoffs() };
}

async function requireLead(leadId: number): Promise<LeadRecord> {
  const lead = await getLeadById(leadId);
  if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "lead_not_found" });
  return lead;
}

async function requireConversation(lead: LeadRecord) {
  const conversation = await getConversationById(lead.conversationId);
  if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "conversation_not_found" });
  return conversation;
}

export async function getLeadDetail(leadId: number) {
  const lead = await requireLead(leadId);
  const conversation = await requireConversation(lead);
  const messages = await listMessages(conversation.id, { limit: 500 });
  if (lead.unreadForStaff > 0) await resetLeadUnread(lead.id);
  return {
    lead: { ...lead, unreadForStaff: 0 },
    conversation: { id: conversation.id, lang: conversation.lang, stage: conversation.state.stage, handoff: conversation.handoff },
    messages,
  };
}

export async function replyAsStaff(input: { leadId: number; text: string; agentName: string }, now = Date.now()) {
  const text = sanitizeText(input.text, 1000);
  if (!text) throw new TRPCError({ code: "BAD_REQUEST", message: "empty_message" });
  const lead = await requireLead(input.leadId);
  const conversation = await requireConversation(lead);
  return saveStaffReply({ lead, conversation, text, agentName: input.agentName, now });
}

export function handoffEndedMessage(lang: Lang, now: number): NewMessage {
  return {
    role: "system",
    text:
      lang === "ar"
        ? "انتهت المحادثة مع الموظف. يمكنك متابعة المحادثة مع المساعد في أي وقت."
        : "The conversation with our team member has ended. You can keep chatting with the assistant anytime.",
    createdAt: now,
    reply: {
      quickReplies: [
        { value: "intent:start_request", label: lang === "ar" ? "طلب جديد" : "New request" },
        { value: "intent:talk_to_human", label: lang === "ar" ? "تحدث مع موظف" : "Talk to a person" },
      ],
    },
  };
}

export async function resolveLeadHandoff(leadId: number, now = Date.now()) {
  const lead = await requireLead(leadId);
  const conversation = await requireConversation(lead);
  if (lead.handoffStatus !== "waiting" && lead.handoffStatus !== "active") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "no_open_handoff" });
  }
  const handoff = await saveHandoffResolution({ lead, conversation, systemMessage: handoffEndedMessage(conversation.lang, now), now });
  return { handoff };
}

export async function updateLeadForStaff(input: { leadId: number; status?: LeadStatus; notes?: string | null; assignedTo?: string | null }, now = Date.now()) {
  await requireLead(input.leadId);
  const notes = input.notes === undefined ? undefined : input.notes === null ? null : sanitizeText(input.notes, 2000) || null;
  const assignedTo = input.assignedTo === undefined ? undefined : input.assignedTo === null ? null : sanitizeText(input.assignedTo, 160) || null;
  return updateLeadDetails(input.leadId, { status: input.status, notes, assignedTo }, now);
}

export async function staffAlerts() {
  const [handoffs, hotNew] = await Promise.all([countOpenHandoffs(), countNewHotLeads()]);
  return { ...handoffs, hotNew };
}

const riyadhDay = (time: number) => new Date(time + RIYADH_OFFSET_MS).toISOString().slice(0, 10);

/** Analytics for the dashboard, the same definitions as the approved reference. */
export function computeAnalytics(rows: AnalyticsRows, rangeDays: number, now: number) {
  const since = now - rangeDays * DAY_MS;
  const inRange = (time: number) => time >= since;
  const conversations = new Set(rows.conversations.filter((row) => inRange(row.createdAt)).map((row) => row.id));
  const events = rows.events.filter((row) => inRange(row.createdAt));
  const leads = rows.leads.filter((row) => inRange(row.createdAt));
  const engaged = new Set(events.filter((event) => event.type === "slot_filled" || event.type === "intent_detected").map((event) => event.conversationId));
  const qualified = leads.filter((lead) => lead.qualified);
  const escalations = events.filter((event) => event.type === "escalated").length;
  const fallbacks = events.filter((event) => event.type === "fallback").length;
  const understood = events.filter((event) => event.type === "intent_detected" || event.type === "slot_filled").length;

  const intents = new Map<string, number>();
  for (const event of events) {
    if (event.type === "intent_detected" && event.intent && !["confirm", "deny", "skip"].includes(event.intent)) {
      intents.set(event.intent, (intents.get(event.intent) ?? 0) + 1);
    }
  }
  const services = new Map<string, number>();
  for (const lead of leads) if (lead.service) services.set(lead.service, (services.get(lead.service) ?? 0) + 1);

  const days = Math.min(rangeDays, 31);
  const daily: Array<{ date: string; conversations: number; qualified: number; escalations: number }> = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    daily.push({ date: riyadhDay(now - offset * DAY_MS), conversations: 0, qualified: 0, escalations: 0 });
  }
  const index = new Map(daily.map((day, position) => [day.date, position]));
  for (const row of rows.conversations) {
    const position = index.get(riyadhDay(row.createdAt));
    if (position !== undefined && inRange(row.createdAt)) daily[position].conversations += 1;
  }
  for (const lead of qualified) {
    const position = index.get(riyadhDay(lead.createdAt));
    if (position !== undefined) daily[position].qualified += 1;
  }
  for (const event of events) {
    if (event.type !== "escalated") continue;
    const position = index.get(riyadhDay(event.createdAt));
    if (position !== undefined) daily[position].escalations += 1;
  }

  const grades = { hot: 0, warm: 0, cold: 0 };
  const salesQualified = qualified.filter((lead) => lead.kind !== "partner");
  for (const lead of salesQualified) grades[lead.grade] += 1;
  const total = conversations.size;
  const sortedEntries = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([key, value]) => ({ key, count: value }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

  return {
    rangeDays,
    conversations: total,
    engaged: engaged.size,
    qualified: qualified.length,
    partnerApplications: qualified.filter((lead) => lead.kind === "partner").length,
    escalations,
    fallbackRate: understood + fallbacks ? fallbacks / (understood + fallbacks) : 0,
    qualificationRate: total ? qualified.length / total : 0,
    avgScore: salesQualified.length ? Math.round(salesQualified.reduce((sum, lead) => sum + lead.score, 0) / salesQualified.length) : 0,
    grades,
    topIntents: sortedEntries(intents).map((entry) => ({ intent: entry.key, count: entry.count })),
    topServices: sortedEntries(services).map((entry) => ({ service: entry.key, count: entry.count })),
    daily,
    moderationBlocks: events.filter((event) => event.type === "moderation_blocked").length,
    sensitiveMasked: events.filter((event) => event.type === "sensitive_masked").length,
  };
}

export async function analyticsForStaff(rangeDays: number, now = Date.now()) {
  const rows = await loadAnalyticsRows(now - rangeDays * DAY_MS);
  return computeAnalytics(rows, rangeDays, now);
}
