import {
  bigint,
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const supportSessions = mysqlTable(
  "order_support_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
    language: mysqlEnum("language", ["ar", "en"]).notNull(),
    status: mysqlEnum("status", ["bot", "waiting", "human", "closed"])
      .default("bot")
      .notNull(),
    intent: varchar("intent", { length: 40 }).default("greeting").notNull(),
    rating: mysqlEnum("rating", ["helpful", "unhelpful"]),
    consentVersion: varchar("consentVersion", { length: 20 }).notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  t => ({
    statusUpdated: index("order_support_status_updated").on(
      t.status,
      t.updatedAt
    ),
  })
);

export const supportMessages = mysqlTable(
  "order_support_messages",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("sessionId", { length: 36 })
      .notNull()
      .references(() => supportSessions.id, { onDelete: "cascade" }),
    turnId: varchar("turnId", { length: 36 }).notNull(),
    sender: mysqlEnum("sender", ["user", "bot", "human", "system"]).notNull(),
    content: text("content").notNull(),
    metadata: text("metadata"),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  t => ({
    sessionCreated: index("order_support_msg_session_created").on(
      t.sessionId,
      t.createdAt
    ),
    uniqueTurn: uniqueIndex("order_support_msg_turn_unique").on(
      t.sessionId,
      t.turnId,
      t.sender
    ),
  })
);

// Anonymous counts: intentionally no message, customer, IP, or session identifier.
export const supportEvents = mysqlTable(
  "order_support_events",
  {
    id: int("id").autoincrement().primaryKey(),
    kind: mysqlEnum("kind", [
      "answer",
      "handoff",
      "helpful",
      "unhelpful",
    ]).notNull(),
    intent: varchar("intent", { length: 40 }).notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  t => ({ created: index("order_support_events_created").on(t.createdAt) })
);

export const supportConfig = mysqlTable("order_support_config", {
  id: int("id").primaryKey(),
  enabled: boolean("enabled").default(true).notNull(),
  handoffEnabled: boolean("handoffEnabled").default(true).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
});
export const supportRateLimits = mysqlTable("order_support_rate_limits", {
  keyHash: varchar("keyHash", { length: 64 }).primaryKey(),
  windowStartedAt: bigint("windowStartedAt", { mode: "number" }).notNull(),
  requestCount: int("requestCount").notNull(),
});

// Ratings are separate from transcript consent; visitors may rate without saving a chat.
export const supportFeedback = mysqlTable(
  "order_support_feedback",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("sessionId", { length: 36 }).references(
      () => supportSessions.id,
      { onDelete: "cascade" }
    ),
    stars: int("stars").notNull(),
    comment: text("comment"),
    language: mysqlEnum("language", ["ar", "en"]).notNull(),
    consentVersion: varchar("consentVersion", { length: 20 }).notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  t => ({
    onePerSession: uniqueIndex("order_support_feedback_one_session").on(
      t.sessionId
    ),
    created: index("order_support_feedback_created").on(t.createdAt),
  })
);
