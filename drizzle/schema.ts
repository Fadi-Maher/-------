import { bigint, boolean, decimal, foreignKey, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "employee", "agent"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const staffRoleValues = ["employee", "agent"] as const;

export const staffAccounts = mysqlTable("staff_accounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id, { onDelete: "set null" }).unique(),
  fullName: varchar("fullName", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  role: mysqlEnum("role", staffRoleValues).notNull(),
  permissionsJson: text("permissionsJson"),
  isActive: boolean("isActive").default(true).notNull(),
  createdByUserId: int("createdByUserId").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  emailUnique: uniqueIndex("staff_accounts_email_unique").on(table.email),
  phoneUnique: uniqueIndex("staff_accounts_phone_unique").on(table.phone),
}));

export type StaffAccount = typeof staffAccounts.$inferSelect;
export type InsertStaffAccount = typeof staffAccounts.$inferInsert;

export const phoneOtpChallenges = mysqlTable("phone_otp_challenges", {
  id: int("id").autoincrement().primaryKey(),
  challengeId: varchar("challengeId", { length: 36 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  codeHash: varchar("codeHash", { length: 64 }).notNull(),
  expiresAt: bigint("expiresAt", { mode: "number" }).notNull(),
  resendAvailableAt: bigint("resendAvailableAt", { mode: "number" }).notNull(),
  attemptCount: int("attemptCount").default(0).notNull(),
  sendCount: int("sendCount").default(1).notNull(),
  windowStartedAt: bigint("windowStartedAt", { mode: "number" }).notNull(),
  verifiedAt: bigint("verifiedAt", { mode: "number" }),
  verifiedClientKey: varchar("verifiedClientKey", { length: 36 }),
}, table => ({
  phoneUnique: uniqueIndex("phone_otp_phone_unique").on(table.phone),
  challengeUnique: uniqueIndex("phone_otp_challenge_unique").on(table.challengeId),
}));

export const agentApplications = mysqlTable("agent_applications", {
  id: int("id").autoincrement().primaryKey(),
  phone: varchar("phone", { length: 40 }).notNull(),
  fullName: varchar("fullName", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  city: varchar("city", { length: 120 }).notNull(),
  specialty: varchar("specialty", { length: 160 }).notNull(),
  experienceYears: int("experienceYears").notNull(),
  notes: varchar("notes", { length: 1000 }),
  consentedAt: bigint("consentedAt", { mode: "number" }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  reviewedAt: bigint("reviewedAt", { mode: "number" }),
  reviewedByUserId: int("reviewedByUserId").references(() => users.id, { onDelete: "set null" }),
  reviewNote: varchar("reviewNote", { length: 500 }),
  activatedStaffAccountId: int("activatedStaffAccountId").references(() => staffAccounts.id, { onDelete: "set null" }),
}, table => ({
  phoneUnique: uniqueIndex("agent_applications_phone_unique").on(table.phone),
  statusCreatedIndex: index("agent_applications_status_created_idx").on(table.status, table.createdAt),
}));

export const adminApplicationNotifications = mysqlTable("admin_application_notifications", {
  id: int("id").autoincrement().primaryKey(),
  recipientUserId: int("recipientUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  applicationId: int("applicationId").notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  readAt: bigint("readAt", { mode: "number" }),
}, table => ({
  applicationForeignKey: foreignKey({ name: "admin_app_notice_application_fk", columns: [table.applicationId], foreignColumns: [agentApplications.id] }).onDelete("cascade"),
  recipientApplicationUnique: uniqueIndex("admin_app_notice_recipient_app_unique").on(table.recipientUserId, table.applicationId),
  recipientCreatedIndex: index("admin_app_notice_recipient_created_idx").on(table.recipientUserId, table.createdAt),
}));

export const agentApplicationDocuments = mysqlTable("agent_application_documents", {
  id: varchar("id", { length: 36 }).primaryKey(),
  phone: varchar("phone", { length: 40 }).notNull(),
  applicationId: int("applicationId"),
  kind: mysqlEnum("kind", ["national_id", "work_license"]).notNull(),
  fileName: varchar("fileName", { length: 160 }).notNull(),
  mimeType: varchar("mimeType", { length: 80 }).notNull(),
  size: int("size").notNull(),
  storageKey: varchar("storageKey", { length: 600 }).notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
}, table => ({
  applicationForeignKey: foreignKey({ name: "agent_app_document_application_fk", columns: [table.applicationId], foreignColumns: [agentApplications.id] }).onDelete("cascade"),
  phoneCreatedIndex: index("agent_app_doc_phone_created_idx").on(table.phone, table.createdAt),
  applicationIndex: index("agent_app_doc_application_idx").on(table.applicationId),
}));

export const phoneProfiles = mysqlTable("phone_profiles", {
  id: int("id").autoincrement().primaryKey(),
  phone: varchar("phone", { length: 40 }).notNull(),
  role: mysqlEnum("role", ["customer", "agent"]).notNull(),
  fullName: varchar("fullName", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
}, table => ({ phoneRoleUnique: uniqueIndex("phone_profile_phone_role_unique").on(table.phone, table.role) }));

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id, { onDelete: "set null" }).unique(),
  fullName: varchar("fullName", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 40 }),
  termsAcceptedAt: timestamp("termsAcceptedAt"),
  termsVersion: varchar("termsVersion", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  phoneUnique: uniqueIndex("customers_phone_unique").on(table.phone),
}));

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

/**
 * A customer's previous mobile, recorded when they move to a verified new number.
 * Customer access tokens for this phone issued at or before releasedAt are rejected,
 * so another device signed in with the old number cannot see data that later lands on it.
 */
export const customerPhoneReleases = mysqlTable("customer_phone_releases", {
  phone: varchar("phone", { length: 40 }).primaryKey(),
  customerId: int("customerId").references(() => customers.id, { onDelete: "set null" }),
  releasedAt: bigint("releasedAt", { mode: "number" }).notNull(),
});

export const requestStatuses = ["received", "in_review", "in_progress", "completed"] as const;
export const requestPriorities = ["low", "normal", "high", "urgent"] as const;

export const transactionRequests = mysqlTable("transaction_requests", {
  id: int("id").autoincrement().primaryKey(),
  reference: varchar("reference", { length: 40 }).notNull().unique(),
  customerId: int("customerId").references(() => customers.id, { onDelete: "set null" }),
  assigneeId: int("assigneeId").references(() => users.id, { onDelete: "set null" }),
  requesterName: varchar("requesterName", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  subcategory: varchar("subcategory", { length: 120 }),
  details: text("details").notNull(),
  customFields: text("customFields"),
  status: mysqlEnum("status", requestStatuses).default("received").notNull(),
  priority: mysqlEnum("priority", requestPriorities).default("normal").notNull(),
  tags: text("tags"),
  ownerNotified: boolean("ownerNotified").default(false).notNull(),
  quoteSubmissionDeadline: timestamp("quoteSubmissionDeadline"),
  quoteSelectedAt: timestamp("quoteSelectedAt"),
  providerAcceptanceDeadline: timestamp("providerAcceptanceDeadline"),
  providerAcceptedAt: timestamp("providerAcceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TransactionRequest = typeof transactionRequests.$inferSelect;
export type InsertTransactionRequest = typeof transactionRequests.$inferInsert;

export const quoteStatusValues = ["submitted", "selected", "accepted", "declined", "withdrawn"] as const;

export const requestQuotes = mysqlTable("request_quotes", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull().references(() => transactionRequests.id, { onDelete: "cascade" }),
  providerUserId: int("providerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerRole: mysqlEnum("providerRole", staffRoleValues).notNull(),
  providerName: varchar("providerName", { length: 160 }).notNull(),
  priceAmount: decimal("priceAmount", { precision: 10, scale: 2 }).notNull(),
  durationDays: int("durationDays").notNull(),
  note: varchar("note", { length: 600 }),
  status: mysqlEnum("status", quoteStatusValues).default("submitted").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  requestProviderUnique: uniqueIndex("request_quotes_request_provider_unique").on(table.requestId, table.providerUserId),
  requestStatusIndex: index("request_quotes_request_status_idx").on(table.requestId, table.status),
  providerIndex: index("request_quotes_provider_idx").on(table.providerUserId),
}));

export type RequestQuote = typeof requestQuotes.$inferSelect;
export type InsertRequestQuote = typeof requestQuotes.$inferInsert;

export const agentFinanceEntries = mysqlTable("agent_finance_entries", {
  id: int("id").autoincrement().primaryKey(),
  agentUserId: int("agentUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
  requestId: int("requestId").notNull().references(() => transactionRequests.id, { onDelete: "restrict" }),
  kind: mysqlEnum("kind", ["collection", "cost"]).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  occurredAt: bigint("occurredAt", { mode: "number" }).notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  clientKey: varchar("clientKey", { length: 36 }).notNull(),
  note: varchar("note", { length: 500 }),
  voidedAt: bigint("voidedAt", { mode: "number" }),
  voidReason: varchar("voidReason", { length: 500 }),
}, table => ({
  agentClientUnique: uniqueIndex("agent_finance_client_unique").on(table.agentUserId, table.clientKey),
  agentCreatedIndex: index("agent_finance_created_idx").on(table.agentUserId, table.createdAt),
  agentRequestIndex: index("agent_finance_request_idx").on(table.agentUserId, table.requestId),
}));

export type AgentFinanceEntry = typeof agentFinanceEntries.$inferSelect;

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
  actorRole: varchar("actorRole", { length: 32 }).notNull(),
  actorName: varchar("actorName", { length: 160 }),
  requestId: int("requestId").references(() => transactionRequests.id, { onDelete: "set null" }),
  action: varchar("action", { length: 80 }).notNull(),
  summary: varchar("summary", { length: 500 }).notNull(),
  beforeJson: text("beforeJson"),
  afterJson: text("afterJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

export const teamNotifications = mysqlTable("team_notifications", {
  id: int("id").autoincrement().primaryKey(),
  recipientUserId: int("recipientUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  requestId: int("requestId").references(() => transactionRequests.id, { onDelete: "set null" }),
  type: varchar("type", { length: 64 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  message: varchar("message", { length: 500 }).notNull(),
  titleEn: varchar("titleEn", { length: 180 }),
  messageEn: varchar("messageEn", { length: 500 }),
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  recipientCreatedIndex: index("team_notifications_recipient_created_idx").on(table.recipientUserId, table.createdAt),
  recipientUnreadIndex: index("team_notifications_recipient_unread_idx").on(table.recipientUserId, table.isRead),
}));

export type TeamNotification = typeof teamNotifications.$inferSelect;
export type InsertTeamNotification = typeof teamNotifications.$inferInsert;

export const customerNotifications = mysqlTable("customer_notifications", {
  id: int("id").autoincrement().primaryKey(),
  phone: varchar("phone", { length: 40 }).notNull(),
  requestId: int("requestId").notNull().references(() => transactionRequests.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 64 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  message: varchar("message", { length: 500 }).notNull(),
  titleEn: varchar("titleEn", { length: 180 }),
  messageEn: varchar("messageEn", { length: 500 }),
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  phoneCreatedIndex: index("customer_notifications_phone_created_idx").on(table.phone, table.createdAt),
  phoneUnreadIndex: index("customer_notifications_phone_unread_idx").on(table.phone, table.isRead),
}));

export type CustomerNotification = typeof customerNotifications.$inferSelect;
export type InsertCustomerNotification = typeof customerNotifications.$inferInsert;

/** Owner edits to automatic notification texts. A missing row means the built-in default is used. */
export const notificationTemplates = mysqlTable("notification_templates", {
  templateKey: varchar("templateKey", { length: 80 }).primaryKey(),
  titleAr: varchar("titleAr", { length: 180 }).notNull(),
  messageAr: varchar("messageAr", { length: 500 }).notNull(),
  titleEn: varchar("titleEn", { length: 180 }).notNull(),
  messageEn: varchar("messageEn", { length: 500 }).notNull(),
  updatedByUserId: int("updatedByUserId").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type NotificationTemplateRow = typeof notificationTemplates.$inferSelect;

/** Public announcement bar shown at the top of the public website. Times are UTC milliseconds. */
export const siteAnnouncements = mysqlTable("site_announcements", {
  id: int("id").autoincrement().primaryKey(),
  messageAr: varchar("messageAr", { length: 280 }).notNull(),
  messageEn: varchar("messageEn", { length: 280 }).notNull(),
  linkUrl: varchar("linkUrl", { length: 500 }),
  linkLabelAr: varchar("linkLabelAr", { length: 40 }),
  linkLabelEn: varchar("linkLabelEn", { length: 40 }),
  tone: mysqlEnum("tone", ["info", "success", "warning"]).default("info").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  dismissible: boolean("dismissible").default(true).notNull(),
  startsAt: bigint("startsAt", { mode: "number" }).notNull(),
  endsAt: bigint("endsAt", { mode: "number" }),
  createdByUserId: int("createdByUserId").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  activeWindowIndex: index("site_announcements_active_idx").on(table.isActive, table.startsAt),
}));
export type SiteAnnouncement = typeof siteAnnouncements.$inferSelect;

export const appSettings = mysqlTable("app_settings", {
  id: int("id").primaryKey(),
  whatsappNumber: varchar("whatsappNumber", { length: 32 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSettings = typeof appSettings.$inferSelect;

export const customFormFields = mysqlTable("custom_form_fields", {
  id: int("id").autoincrement().primaryKey(),
  fieldKey: varchar("fieldKey", { length: 64 }).notNull().unique(),
  label: varchar("label", { length: 120 }).notNull(),
  type: mysqlEnum("type", ["text", "textarea", "tel", "email", "select"]).default("text").notNull(),
  placeholder: varchar("placeholder", { length: 255 }),
  optionsJson: text("optionsJson"),
  isRequired: boolean("isRequired").default(false).notNull(),
  isVisible: boolean("isVisible").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomFormField = typeof customFormFields.$inferSelect;
export type InsertCustomFormField = typeof customFormFields.$inferInsert;

export const assistantFaqs = mysqlTable("assistant_faqs", {
  id: int("id").autoincrement().primaryKey(),
  questionAr: varchar("questionAr", { length: 500 }).notNull(),
  answerAr: text("answerAr").notNull(),
  questionEn: varchar("questionEn", { length: 500 }),
  answerEn: text("answerEn"),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdByUserId: int("createdByUserId").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  activeSortIndex: index("assistant_faqs_active_sort_idx").on(table.isActive, table.sortOrder),
}));

export type AssistantFaq = typeof assistantFaqs.$inferSelect;
export type InsertAssistantFaq = typeof assistantFaqs.$inferInsert;

export const assistantConversationSessions = mysqlTable("assistant_conversation_sessions", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 64 }).notNull().unique(),
  language: mysqlEnum("language", ["ar", "en"]).notNull(),
  consentVersion: varchar("consentVersion", { length: 32 }).notNull(),
  consentedAt: timestamp("consentedAt").defaultNow().notNull(),
  consentRevokedAt: timestamp("consentRevokedAt"),
  lastMessageAt: timestamp("lastMessageAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  consentIndex: index("assistant_sessions_consent_idx").on(table.consentRevokedAt, table.updatedAt),
}));

export type AssistantConversationSession = typeof assistantConversationSessions.$inferSelect;
export type InsertAssistantConversationSession = typeof assistantConversationSessions.$inferInsert;

export const assistantConversationMessages = mysqlTable("assistant_conversation_messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  sessionForeignKey: foreignKey({
    name: "assistant_messages_session_fk",
    columns: [table.sessionId],
    foreignColumns: [assistantConversationSessions.id],
  }).onDelete("cascade"),
  sessionCreatedIndex: index("assistant_messages_session_created_idx").on(table.sessionId, table.createdAt),
}));

export type AssistantConversationMessage = typeof assistantConversationMessages.$inferSelect;
export type InsertAssistantConversationMessage = typeof assistantConversationMessages.$inferInsert;

export const requestUpdateSenderValues = ["owner", "customer", "employee", "agent", "system"] as const;

export const requestUpdates = mysqlTable("request_updates", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull().references(() => transactionRequests.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  status: mysqlEnum("status", requestStatuses),
  senderType: mysqlEnum("senderType", requestUpdateSenderValues).default("system").notNull(),
  senderUserId: int("senderUserId").references(() => users.id, { onDelete: "set null" }),
  senderName: varchar("senderName", { length: 160 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InsertRequestUpdate = typeof requestUpdates.$inferInsert;

export const requestAttachments = mysqlTable("request_attachments", {
  id: int("id").autoincrement().primaryKey(),
  updateId: int("updateId").notNull().references(() => requestUpdates.id, { onDelete: "cascade" }),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 160 }).notNull(),
  size: int("size").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InsertRequestAttachment = typeof requestAttachments.$inferInsert;

export const requestReviews = mysqlTable("request_reviews", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull().references(() => transactionRequests.id, { onDelete: "cascade" }),
  customerId: int("customerId").references(() => customers.id, { onDelete: "set null" }),
  providerUserId: int("providerUserId").references(() => users.id, { onDelete: "set null" }),
  providerName: varchar("providerName", { length: 160 }).notNull(),
  providerRole: mysqlEnum("providerRole", staffRoleValues).notNull(),
  rating: int("rating").notNull(),
  reviewText: text("reviewText"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  requestUnique: uniqueIndex("request_reviews_request_unique").on(table.requestId),
  providerCreatedIndex: index("request_reviews_provider_created_idx").on(table.providerUserId, table.createdAt),
}));

export type RequestReview = typeof requestReviews.$inferSelect;
export type InsertRequestReview = typeof requestReviews.$inferInsert;

export const pwaSubscriptions = mysqlTable("pwa_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  endpointHash: varchar("endpointHash", { length: 64 }).notNull().unique(),
  endpoint: text("endpoint").notNull(),
  p256dh: varchar("p256dh", { length: 255 }).notNull(),
  auth: varchar("auth", { length: 255 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InsertPwaSubscription = typeof pwaSubscriptions.$inferInsert;

export * from "./leadBotSchema";
