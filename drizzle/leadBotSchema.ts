import { bigint, boolean, index, int, mysqlEnum, mysqlTable, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Tables for the Maalamati Care sales assistant (lead qualification bot).
 * Additive only: no existing table is changed. All timestamps are UTC
 * milliseconds. JSON payloads are stored as text and validated on read.
 */

/** Single-row settings (id = 1) managed by the owner. */
export const leadBotSettings = mysqlTable("lead_bot_settings", {
  id: int("id").primaryKey(),
  enabled: boolean("enabled").default(true).notNull(),
  aiAssist: boolean("aiAssist").default(false).notNull(),
  autoEscalateAfterFallbacks: int("autoEscalateAfterFallbacks").default(2).notNull(),
  offerHumanToHotLeads: boolean("offerHumanToHotLeads").default(true).notNull(),
  /** JSON array of weekdays 0 (Sun) – 6 (Sat). */
  workingDaysJson: varchar("workingDaysJson", { length: 40 }).default("[0,1,2,3,4]").notNull(),
  workStartHour: int("workStartHour").default(9).notNull(),
  workEndHour: int("workEndHour").default(18).notNull(),
  responseSlaAr: varchar("responseSlaAr", { length: 80 }).notNull(),
  responseSlaEn: varchar("responseSlaEn", { length: 80 }).notNull(),
  whatsappNumber: varchar("whatsappNumber", { length: 16 }).default("").notNull(),
  /** JSON array of offered service ids; empty array = all services. */
  servicesJson: varchar("servicesJson", { length: 400 }).default("[]").notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  updatedByName: varchar("updatedByName", { length: 160 }),
});
export type LeadBotSettingsRow = typeof leadBotSettings.$inferSelect;

/** One visitor chat session, resumed through an opaque browser token. */
export const leadBotConversations = mysqlTable("lead_bot_conversations", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull(),
  lang: mysqlEnum("lang", ["ar", "en"]).default("ar").notNull(),
  /** Serialized engine state (slots, stage, pending question...). */
  stateJson: text("stateJson").notNull(),
  /** Serialized handoff `{status, reason, agentName, requestedAt}` or null. */
  handoffJson: text("handoffJson"),
  pagePath: varchar("pagePath", { length: 200 }),
  /** Salted hash of the client IP, used only for rate limiting. */
  ipHash: varchar("ipHash", { length: 64 }),
  storageConsentAt: bigint("storageConsentAt", { mode: "number" }).notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  lastMessageAt: bigint("lastMessageAt", { mode: "number" }).notNull(),
}, (table) => ({
  tokenUnique: uniqueIndex("lead_bot_conversations_token_unique").on(table.token),
  createdIdx: index("lead_bot_conversations_created_idx").on(table.createdAt),
  ipIdx: index("lead_bot_conversations_ip_idx").on(table.ipHash, table.createdAt),
}));
export type LeadBotConversationRow = typeof leadBotConversations.$inferSelect;

/** Redacted chat messages. Mobile numbers are masked in `text`. */
export const leadBotMessages = mysqlTable("lead_bot_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull().references(() => leadBotConversations.id, { onDelete: "cascade" }),
  role: mysqlEnum("role", ["user", "bot", "agent", "system"]).notNull(),
  text: text("text").notNull(),
  /** Serialized bot reply extras (quick replies, actions, summary, tone). */
  replyJson: text("replyJson"),
  /** Idempotency key sent by the widget for visitor messages. */
  clientId: varchar("clientId", { length: 64 }),
  authorName: varchar("authorName", { length: 160 }),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
}, (table) => ({
  conversationIdx: index("lead_bot_messages_conversation_idx").on(table.conversationId, table.createdAt),
  clientUnique: uniqueIndex("lead_bot_messages_client_unique").on(table.conversationId, table.clientId),
}));
export type LeadBotMessageRow = typeof leadBotMessages.$inferSelect;

export const leadBotLeadStatusValues = ["new", "contacted", "qualified", "won", "lost"] as const;
export const leadBotHandoffStatusValues = ["none", "waiting", "active", "resolved"] as const;

/** Qualified (or escalated) lead derived from a conversation. */
export const leadBotLeads = mysqlTable("lead_bot_leads", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull().references(() => leadBotConversations.id, { onDelete: "cascade" }),
  kind: mysqlEnum("kind", ["sales", "partner"]).default("sales").notNull(),
  status: mysqlEnum("status", leadBotLeadStatusValues).default("new").notNull(),
  /** Serialized slots; the full mobile number lives only here and in phoneKey. */
  slotsJson: text("slotsJson").notNull(),
  score: int("score").default(0).notNull(),
  grade: mysqlEnum("grade", ["hot", "warm", "cold"]).default("cold").notNull(),
  scoreJson: text("scoreJson").notNull(),
  qualified: boolean("qualified").default(false).notNull(),
  handoffStatus: mysqlEnum("handoffStatus", leadBotHandoffStatusValues).default("none").notNull(),
  handoffJson: text("handoffJson"),
  service: varchar("service", { length: 40 }),
  name: varchar("name", { length: 160 }),
  phoneKey: varchar("phoneKey", { length: 20 }),
  assignedTo: varchar("assignedTo", { length: 160 }),
  notes: text("notes"),
  unreadForStaff: int("unreadForStaff").default(0).notNull(),
  hotNotifiedAt: bigint("hotNotifiedAt", { mode: "number" }),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  lastMessageAt: bigint("lastMessageAt", { mode: "number" }).notNull(),
}, (table) => ({
  conversationUnique: uniqueIndex("lead_bot_leads_conversation_unique").on(table.conversationId),
  phoneIdx: index("lead_bot_leads_phone_idx").on(table.phoneKey),
  activityIdx: index("lead_bot_leads_activity_idx").on(table.lastMessageAt),
}));
export type LeadBotLeadRow = typeof leadBotLeads.$inferSelect;

/** Analytics events emitted by the engine (no message text). */
export const leadBotEvents = mysqlTable("lead_bot_events", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull().references(() => leadBotConversations.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 40 }).notNull(),
  intent: varchar("intent", { length: 40 }),
  slot: varchar("slot", { length: 40 }),
  detail: varchar("detail", { length: 120 }),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
}, (table) => ({
  createdIdx: index("lead_bot_events_created_idx").on(table.createdAt),
  conversationIdx: index("lead_bot_events_conversation_idx").on(table.conversationId),
}));
export type LeadBotEventRow = typeof leadBotEvents.$inferSelect;
