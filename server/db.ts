import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, gt, inArray, isNotNull, isNull, lte, ne, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  appSettings,
  assistantConversationMessages,
  assistantConversationSessions,
  assistantFaqs,
  auditLogs,
  customerNotifications,
  customers,
  customFormFields,
  InsertAuditLog,
  InsertTransactionRequest,
  InsertUser,
  InsertPwaSubscription,
  InsertRequestAttachment,
  InsertRequestUpdate,
  pwaSubscriptions,
  requestAttachments,
  requestPriorities,
  requestQuotes,
  requestReviews,
  requestUpdates,
  requestStatuses,
  staffAccounts,
  teamNotifications,
  transactionRequests,
  type User,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const normalizedEmail = user.email?.trim().toLowerCase() || null;
    // Agent application emails are contact details, not an OAuth identity proof.
    // Agents sign in through their approved phone-bound identity; only employees link by work email.
    const invitedStaff = normalizedEmail
      ? (await db.select().from(staffAccounts).where(and(eq(staffAccounts.email, normalizedEmail), eq(staffAccounts.role, "employee"))).limit(1))[0]
      : undefined;
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    } else if (invitedStaff) {
      values.role = invitedStaff.isActive ? invitedStaff.role : "user";
      updateSet.role = invitedStaff.isActive ? invitedStaff.role : "user";
    } else if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });

    if (invitedStaff) {
      const linkedUser = (await db.select({ id: users.id }).from(users).where(eq(users.openId, user.openId)).limit(1))[0];
      if (linkedUser) {
        await db.update(staffAccounts).set({ userId: linkedUser.id }).where(eq(staffAccounts.id, invitedStaff.id));
      }
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

type CustomerIdentity = Pick<User, "id" | "name" | "email">;

function customerName(user: CustomerIdentity, fallbackName?: string) {
  return user.name?.trim() || fallbackName?.trim() || "عميل معاملاتي كير";
}

export async function getOrCreateCustomerForUser(user: CustomerIdentity) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const byUser = await db.select().from(customers).where(eq(customers.userId, user.id)).limit(1);
  if (byUser[0]) {
    await db.update(customers).set({ fullName: customerName(user), email: user.email || null }).where(eq(customers.id, byUser[0].id));
    return { ...byUser[0], fullName: customerName(user), email: user.email || null };
  }

  if (user.email) {
    const byAvailableEmail = await db.select().from(customers).where(and(eq(customers.email, user.email), isNull(customers.userId))).limit(1);
    if (byAvailableEmail[0]) {
      await db.update(customers).set({ userId: user.id, fullName: customerName(user), email: user.email }).where(eq(customers.id, byAvailableEmail[0].id));
      return { ...byAvailableEmail[0], userId: user.id, fullName: customerName(user), email: user.email };
    }
  }

  const inserted = await db.insert(customers).values({ userId: user.id, fullName: customerName(user), email: user.email || null });
  const created = await db.select().from(customers).where(eq(customers.id, Number(inserted[0].insertId))).limit(1);
  return created[0]!;
}

export async function resolveCustomerForRequest(input: { user?: CustomerIdentity | null; requesterName: string; phone: string; email?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  if (input.user) {
    const customer = await getOrCreateCustomerForUser(input.user);
    await db.update(customers).set({ fullName: customerName(input.user, input.requesterName), phone: input.phone || customer.phone, email: input.user.email || input.email || customer.email }).where(eq(customers.id, customer.id));
    return customer.id;
  }

  const matched = input.email
    ? await db.select().from(customers).where(and(eq(customers.email, input.email), isNull(customers.userId))).limit(1)
    : await db.select().from(customers).where(and(eq(customers.phone, input.phone), isNull(customers.userId))).limit(1);
  if (matched[0]) {
    await db.update(customers).set({ fullName: input.requesterName, phone: input.phone, email: input.email || matched[0].email }).where(eq(customers.id, matched[0].id));
    return matched[0].id;
  }

  const inserted = await db.insert(customers).values({ fullName: input.requesterName, phone: input.phone, email: input.email || null });
  return Number(inserted[0].insertId);
}

export async function getCustomerByPhone(phone: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.select({ id: customers.id, fullName: customers.fullName, phone: customers.phone, email: customers.email }).from(customers).where(eq(customers.phone, phone)).limit(1);
  return result[0] ?? null;
}

export async function registerCustomerWithPhone(input: { fullName: string; phone: string; email?: string | null; termsAcceptedAt: Date; termsVersion: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const existing = await db.select().from(customers).where(eq(customers.phone, input.phone)).limit(1);
  if (existing[0]) {
    await db.update(customers).set({ fullName: input.fullName, email: input.email || existing[0].email }).where(eq(customers.id, existing[0].id));
    return { ...existing[0], fullName: input.fullName, email: input.email || existing[0].email };
  }

  const inserted = await db.insert(customers).values({
    fullName: input.fullName,
    phone: input.phone,
    email: input.email || null,
    termsAcceptedAt: input.termsAcceptedAt,
    termsVersion: input.termsVersion,
  });
  const created = await db.select().from(customers).where(eq(customers.id, Number(inserted[0].insertId))).limit(1);
  return created[0]!;
}

export async function getCustomerDashboard(user: CustomerIdentity) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const customer = await getOrCreateCustomerForUser(user);
  const requests = await db.select().from(transactionRequests).where(eq(transactionRequests.customerId, customer.id)).orderBy(desc(transactionRequests.updatedAt));
  const recentRequests = await Promise.all(requests.slice(0, 6).map(async (request) => ({ ...request, updates: await listRequestUpdates(request.id) })));
  return { customer, requests: recentRequests, totalRequests: requests.length };
}

export async function listCustomers() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const customerRows = await db.select().from(customers).orderBy(desc(customers.updatedAt));
  const requests = await db.select().from(transactionRequests).orderBy(desc(transactionRequests.updatedAt));
  return customerRows.map((customer) => {
    const customerRequests = requests.filter((request) => request.customerId === customer.id);
    return { ...customer, requestCount: customerRequests.length, latestRequest: customerRequests[0] || null };
  });
}

export async function getCustomerAdminDetail(customerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const customer = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer[0]) return null;
  const requests = await db.select().from(transactionRequests).where(eq(transactionRequests.customerId, customerId)).orderBy(desc(transactionRequests.updatedAt));
  const requestsWithUpdates = await Promise.all(requests.map(async (request) => ({ ...request, updates: await listRequestUpdates(request.id) })));
  return { customer: customer[0], requests: requestsWithUpdates };
}

export async function createTransactionRequest(input: InsertTransactionRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db.insert(transactionRequests).values({
    ...input,
    quoteSubmissionDeadline: input.quoteSubmissionDeadline ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  const created = await db
    .select()
    .from(transactionRequests)
    .where(eq(transactionRequests.reference, input.reference))
    .limit(1);

  const request = created[0];
  if (request) {
    try {
      await notifyActiveTeamOfNewRequest({
        requestId: request.id,
        category: request.category,
        subcategory: request.subcategory,
        details: request.details,
      });
    } catch (error) {
      console.warn("[Notifications] Failed to notify team about new request:", error);
    }
  }
  return request;
}

export type SavedCustomField = {
  fieldKey: string;
  label: string;
  type: "text" | "textarea" | "tel" | "email" | "select";
  placeholder?: string | null;
  options: string[];
  isRequired: boolean;
  isVisible: boolean;
  sortOrder: number;
};

function decodeField(field: typeof customFormFields.$inferSelect): SavedCustomField {
  let options: string[] = [];
  try {
    const parsed = field.optionsJson ? JSON.parse(field.optionsJson) : [];
    options = Array.isArray(parsed) ? parsed.filter((option): option is string => typeof option === "string") : [];
  } catch {
    options = [];
  }
  return { ...field, options };
}

export async function getAppSettings(includeHiddenFields = false) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const settings = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  const fields = await db.select().from(customFormFields).orderBy(asc(customFormFields.sortOrder), asc(customFormFields.id));
  return {
    whatsappNumber: settings[0]?.whatsappNumber ?? null,
    fields: fields.filter((field) => includeHiddenFields || field.isVisible).map(decodeField),
  };
}

export async function replaceAppSettings(input: { whatsappNumber: string | null; fields: SavedCustomField[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(appSettings).values({ id: 1, whatsappNumber: input.whatsappNumber }).onDuplicateKeyUpdate({ set: { whatsappNumber: input.whatsappNumber } });
  await db.delete(customFormFields);
  if (input.fields.length > 0) {
    await db.insert(customFormFields).values(input.fields.map((field, index) => ({
      fieldKey: field.fieldKey,
      label: field.label,
      type: field.type,
      placeholder: field.placeholder || null,
      optionsJson: field.options.length ? JSON.stringify(field.options) : null,
      isRequired: field.isRequired,
      isVisible: field.isVisible,
      sortOrder: index,
    })));
  }
}

export type AssistantFaqInput = {
  questionAr: string;
  answerAr: string;
  questionEn?: string | null;
  answerEn?: string | null;
  isActive: boolean;
  sortOrder: number;
};

export async function listAssistantFaqs(includeInactive = false) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const query = db.select().from(assistantFaqs);
  return includeInactive
    ? query.orderBy(asc(assistantFaqs.sortOrder), asc(assistantFaqs.id))
    : query.where(eq(assistantFaqs.isActive, true)).orderBy(asc(assistantFaqs.sortOrder), asc(assistantFaqs.id));
}

export async function createAssistantFaq(input: AssistantFaqInput, createdByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const inserted = await db.insert(assistantFaqs).values({ ...input, createdByUserId });
  const rows = await db.select().from(assistantFaqs).where(eq(assistantFaqs.id, Number(inserted[0].insertId))).limit(1);
  return rows[0]!;
}

export async function updateAssistantFaq(id: number, input: AssistantFaqInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(assistantFaqs).set(input).where(eq(assistantFaqs.id, id));
  const rows = await db.select().from(assistantFaqs).where(eq(assistantFaqs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function deleteAssistantFaq(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(assistantFaqs).where(eq(assistantFaqs.id, id));
}

export async function createAssistantConversationSession(input: { publicId: string; language: "ar" | "en"; consentVersion: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select().from(assistantConversationSessions).where(eq(assistantConversationSessions.publicId, input.publicId)).limit(1);
  if (existing[0]) return existing[0];
  const inserted = await db.insert(assistantConversationSessions).values(input);
  const rows = await db.select().from(assistantConversationSessions).where(eq(assistantConversationSessions.id, Number(inserted[0].insertId))).limit(1);
  return rows[0]!;
}

export async function getAssistantConversationHistory(publicId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const session = await db.select().from(assistantConversationSessions).where(eq(assistantConversationSessions.publicId, publicId)).limit(1);
  if (!session[0] || session[0].consentRevokedAt) return null;
  const messages = await db.select({ role: assistantConversationMessages.role, content: assistantConversationMessages.content, createdAt: assistantConversationMessages.createdAt })
    .from(assistantConversationMessages)
    .where(eq(assistantConversationMessages.sessionId, session[0].id))
    .orderBy(asc(assistantConversationMessages.createdAt), asc(assistantConversationMessages.id))
    .limit(100);
  return { session: session[0], messages };
}

export async function appendAssistantConversationExchange(publicId: string, userContent: string, assistantContent: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const session = await db.select({ id: assistantConversationSessions.id }).from(assistantConversationSessions)
    .where(and(eq(assistantConversationSessions.publicId, publicId), isNull(assistantConversationSessions.consentRevokedAt)))
    .limit(1);
  if (!session[0]) return false;
  await db.insert(assistantConversationMessages).values([
    { sessionId: session[0].id, role: "user", content: userContent },
    { sessionId: session[0].id, role: "assistant", content: assistantContent },
  ]);
  await db.update(assistantConversationSessions).set({ lastMessageAt: new Date() }).where(eq(assistantConversationSessions.id, session[0].id));
  return true;
}

export async function revokeAssistantConversationConsent(publicId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(assistantConversationSessions).set({ consentRevokedAt: new Date() }).where(eq(assistantConversationSessions.publicId, publicId));
}

export async function listTransactionRequests() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const requests = await db.select().from(transactionRequests).orderBy(desc(transactionRequests.createdAt));
  if (!requests.length) return [];
  const reviews = await db.select().from(requestReviews).where(inArray(requestReviews.requestId, requests.map((request) => request.id)));
  return requests.map((request) => ({ ...request, review: reviews.find((review) => review.requestId === request.id) ?? null }));
}

export async function listAssignableStaff() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(inArray(users.role, ["admin", "employee", "agent"]));
}

export async function listEmployeesWithAssignments() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const employees = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.role, "employee"));
  if (employees.length === 0) return [];
  const employeeIds = employees.map((employee) => employee.id);
  const assignedRequests = await db
    .select()
    .from(transactionRequests)
    .where(inArray(transactionRequests.assigneeId, employeeIds))
    .orderBy(desc(transactionRequests.updatedAt));
  return employees.map((employee) => ({
    ...employee,
    requests: assignedRequests.filter((request) => request.assigneeId === employee.id),
  }));
}

export async function expirePendingProviderSelections() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const now = new Date();
  const expired = await db.select({ id: transactionRequests.id }).from(transactionRequests).where(and(isNotNull(transactionRequests.quoteSelectedAt), isNull(transactionRequests.providerAcceptedAt), isNotNull(transactionRequests.providerAcceptanceDeadline), lte(transactionRequests.providerAcceptanceDeadline, now)));
  for (const item of expired) {
    await db.transaction(async (tx) => {
      const request = (await tx.select().from(transactionRequests).where(and(eq(transactionRequests.id, item.id), isNull(transactionRequests.providerAcceptedAt), isNotNull(transactionRequests.providerAcceptanceDeadline), lte(transactionRequests.providerAcceptanceDeadline, now))).limit(1))[0];
      if (!request || !request.assigneeId) return;
      const selectedQuote = (await tx.select().from(requestQuotes).where(and(eq(requestQuotes.requestId, request.id), eq(requestQuotes.providerUserId, request.assigneeId), eq(requestQuotes.status, "selected"))).limit(1))[0];
      if (!selectedQuote) return;
      const updated = await tx.update(transactionRequests).set({ assigneeId: null, quoteSelectedAt: null, providerAcceptanceDeadline: null, providerAcceptedAt: null, quoteSubmissionDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000), status: "received" }).where(and(eq(transactionRequests.id, request.id), eq(transactionRequests.assigneeId, request.assigneeId), isNull(transactionRequests.providerAcceptedAt)));
      if (Number(updated[0].affectedRows) !== 1) return;
      await tx.update(requestQuotes).set({ status: "withdrawn" }).where(eq(requestQuotes.id, selectedQuote.id));
      await tx.insert(teamNotifications).values({ recipientUserId: request.assigneeId, requestId: request.id, type: "assignment_expired", title: "انتهت مهلة قبول الطلب", message: "لم يُقبل الطلب خلال المهلة، وأُعيد فتح الاختيار للعميل." });
      await tx.insert(customerNotifications).values({ phone: request.phone, requestId: request.id, type: "provider_acceptance_expired", title: "انتهت مهلة مقدم الخدمة", message: "لم يؤكد مقدم الخدمة استلام الطلب خلال المهلة. يمكنك اختيار عرض آخر." });
      await tx.insert(requestUpdates).values({ requestId: request.id, status: "received", message: "انتهت مهلة قبول مقدم الخدمة، وأُعيد فتح الطلب لاختيار عرض آخر." });
      await tx.insert(auditLogs).values({ actorUserId: null, actorRole: "system", actorName: "النظام", requestId: request.id, action: "provider_acceptance_expired", summary: "انتهت مهلة مقدم الخدمة وأعيد فتح الطلب للاختيار.", beforeJson: JSON.stringify({ assigneeId: request.assigneeId, quoteId: selectedQuote.id }), afterJson: JSON.stringify({ assigneeId: null, quoteSubmissionDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000) }) });
    });
  }
  return expired.map((item) => item.id);
}

export async function listRequestsAssignedToUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await expirePendingProviderSelections();
  const requests = await db
    .select({
      id: transactionRequests.id,
      reference: transactionRequests.reference,
      assigneeId: transactionRequests.assigneeId,
      requesterName: transactionRequests.requesterName,
      category: transactionRequests.category,
      subcategory: transactionRequests.subcategory,
      details: transactionRequests.details,
      status: transactionRequests.status,
      priority: transactionRequests.priority,
      tags: transactionRequests.tags,
      quoteSubmissionDeadline: transactionRequests.quoteSubmissionDeadline,
      quoteSelectedAt: transactionRequests.quoteSelectedAt,
      providerAcceptanceDeadline: transactionRequests.providerAcceptanceDeadline,
      providerAcceptedAt: transactionRequests.providerAcceptedAt,
      createdAt: transactionRequests.createdAt,
      updatedAt: transactionRequests.updatedAt,
    })
    .from(transactionRequests)
    .where(eq(transactionRequests.assigneeId, userId))
    .orderBy(desc(transactionRequests.updatedAt));
  if (!requests.length) return [];
  const reviews = await db.select().from(requestReviews).where(inArray(requestReviews.requestId, requests.map((request) => request.id)));
  return requests.map((request) => ({
    ...request,
    details: request.details.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[بريد محجوب]").replace(/(?:\+?966|00966|0)?5\d{8}/g, "[جوال محجوب]"),
    review: reviews.find((review) => review.requestId === request.id) ?? null,
  }));
}

export async function listOpenRequestsForTeam(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const account = await getActiveStaffAccountForUser(userId);
  if (!account) return [];
  await expirePendingProviderSelections();
  const now = new Date();
  const requests = await db.select({
    id: transactionRequests.id,
    category: transactionRequests.category,
    subcategory: transactionRequests.subcategory,
    details: transactionRequests.details,
    priority: transactionRequests.priority,
    status: transactionRequests.status,
    quoteSubmissionDeadline: transactionRequests.quoteSubmissionDeadline,
    createdAt: transactionRequests.createdAt,
  }).from(transactionRequests).where(and(isNull(transactionRequests.assigneeId), isNull(transactionRequests.quoteSelectedAt), ne(transactionRequests.status, "completed"), or(isNull(transactionRequests.quoteSubmissionDeadline), gt(transactionRequests.quoteSubmissionDeadline, now)))).orderBy(desc(transactionRequests.createdAt)).limit(100);
  if (!requests.length) return [];
  const requestIds = requests.map((request) => request.id);
  const quotes = await db.select().from(requestQuotes).where(and(inArray(requestQuotes.requestId, requestIds), eq(requestQuotes.status, "submitted")));
  return requests.map((request) => ({
    ...request,
    details: request.details.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[بريد محجوب]").replace(/(?:\+?966|00966|0)?5\d{8}/g, "[جوال محجوب]"),
    quoteCount: quotes.filter((quote) => quote.requestId === request.id).length,
    myQuote: quotes.find((quote) => quote.requestId === request.id && quote.providerUserId === userId) ?? null,
  }));
}

export async function upsertRequestQuote(input: { requestId: number; providerUserId: number; priceAmount: string; durationDays: number; note?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async (tx) => {
    const account = (await tx.select().from(staffAccounts).where(and(eq(staffAccounts.userId, input.providerUserId), eq(staffAccounts.isActive, true))).limit(1))[0];
    if (!account) throw new Error("حساب الفريق غير مفعل.");
    const request = (await tx.select({ id: transactionRequests.id, phone: transactionRequests.phone, assigneeId: transactionRequests.assigneeId, quoteSubmissionDeadline: transactionRequests.quoteSubmissionDeadline, quoteSelectedAt: transactionRequests.quoteSelectedAt, status: transactionRequests.status }).from(transactionRequests).where(eq(transactionRequests.id, input.requestId)).limit(1))[0];
    if (!request || request.assigneeId || request.quoteSelectedAt || request.status === "completed" || (request.quoteSubmissionDeadline && request.quoteSubmissionDeadline.getTime() <= Date.now())) throw new Error("انتهى استقبال العروض لهذا الطلب.");
    const previous = (await tx.select().from(requestQuotes).where(and(eq(requestQuotes.requestId, input.requestId), eq(requestQuotes.providerUserId, input.providerUserId))).limit(1))[0];
    const firstQuoteNotification = (await tx.select({ id: customerNotifications.id }).from(customerNotifications).where(and(eq(customerNotifications.requestId, input.requestId), eq(customerNotifications.type, "first_quote_received"))).limit(1))[0];
    await tx.insert(requestQuotes).values({
      requestId: input.requestId,
      providerUserId: input.providerUserId,
      providerRole: account.role,
      providerName: account.fullName,
      priceAmount: input.priceAmount,
      durationDays: input.durationDays,
      note: input.note?.trim() || null,
      status: "submitted",
    }).onDuplicateKeyUpdate({ set: { providerRole: account.role, providerName: account.fullName, priceAmount: input.priceAmount, durationDays: input.durationDays, note: input.note?.trim() || null, status: "submitted" } });
    await tx.insert(auditLogs).values({
      actorUserId: input.providerUserId,
      actorRole: account.role,
      actorName: account.fullName,
      requestId: input.requestId,
      action: previous ? "quote_updated" : "quote_submitted",
      summary: previous ? "عدّل عضو الفريق عرض السعر." : "قدّم عضو الفريق عرض سعر جديدًا.",
      beforeJson: previous ? JSON.stringify({ priceAmount: previous.priceAmount, durationDays: previous.durationDays, note: previous.note }) : null,
      afterJson: JSON.stringify({ priceAmount: input.priceAmount, durationDays: input.durationDays, note: input.note?.trim() || null }),
    });
    if (!previous || previous.status === "withdrawn") {
      await tx.insert(customerNotifications).values(firstQuoteNotification
        ? { phone: request.phone, requestId: request.id, type: "quote_received", title: "وصل عرض سعر جديد", message: `وصل عرض بقيمة ${input.priceAmount} ر.س ومدة ${input.durationDays} يوم. افتح طلبك للمقارنة.` }
        : { phone: request.phone, requestId: request.id, type: "first_quote_received", title: "وصل أول عرض سعر", message: `وصل أول عرض على طلبك بقيمة ${input.priceAmount} ر.س ومدة ${input.durationDays} يوم. افتح طلباتي للمقارنة.` });
    }
    return { updated: Boolean(previous) };
  });
}

export async function listQuotesForCustomerPhone(phone: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await expirePendingProviderSelections();
  const requests = await db.select({ id: transactionRequests.id, quoteSubmissionDeadline: transactionRequests.quoteSubmissionDeadline, quoteSelectedAt: transactionRequests.quoteSelectedAt, providerAcceptanceDeadline: transactionRequests.providerAcceptanceDeadline, providerAcceptedAt: transactionRequests.providerAcceptedAt }).from(transactionRequests).where(eq(transactionRequests.phone, phone));
  if (!requests.length) return [];
  const rows = await db.select().from(requestQuotes).where(and(inArray(requestQuotes.requestId, requests.map((request) => request.id)), inArray(requestQuotes.status, ["submitted", "selected", "accepted"])));
  return requests.map((request) => ({ requestId: request.id, quoteSubmissionDeadline: request.quoteSubmissionDeadline, quoteSelectedAt: request.quoteSelectedAt, providerAcceptanceDeadline: request.providerAcceptanceDeadline, providerAcceptedAt: request.providerAcceptedAt, quotes: rows.filter((quote) => quote.requestId === request.id).map((quote) => ({ id: quote.id, providerName: quote.providerName, providerRole: quote.providerRole, priceAmount: quote.priceAmount, durationDays: quote.durationDays, note: quote.note, status: quote.status, createdAt: quote.createdAt })) }));
}

export async function acceptQuoteForCustomer(input: { phone: string; quoteId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await expirePendingProviderSelections();
  return db.transaction(async (tx) => {
    const quote = (await tx.select().from(requestQuotes).where(eq(requestQuotes.id, input.quoteId)).limit(1))[0];
    if (!quote || quote.status !== "submitted") throw new Error("هذا العرض غير متاح للاعتماد.");
    const request = (await tx.select().from(transactionRequests).where(and(eq(transactionRequests.id, quote.requestId), eq(transactionRequests.phone, input.phone))).limit(1))[0];
    if (!request) throw new Error("تعذر التحقق من ملكية الطلب.");
    const selectedAt = new Date();
    const providerAcceptanceDeadline = new Date(selectedAt.getTime() + 2 * 60 * 60 * 1000);
    const updated = await tx.update(transactionRequests).set({ assigneeId: quote.providerUserId, quoteSelectedAt: selectedAt, providerAcceptanceDeadline, providerAcceptedAt: null, status: "in_review" }).where(and(eq(transactionRequests.id, request.id), eq(transactionRequests.phone, input.phone), isNull(transactionRequests.assigneeId), isNull(transactionRequests.quoteSelectedAt), ne(transactionRequests.status, "completed")));
    if (Number(updated[0].affectedRows) !== 1) throw new Error("تم اعتماد عرض لهذا الطلب مسبقًا.");
    await tx.update(requestQuotes).set({ status: "selected" }).where(eq(requestQuotes.id, quote.id));
    await tx.insert(teamNotifications).values({ recipientUserId: quote.providerUserId, requestId: request.id, type: "quote_selected", title: "اختار العميل عرضك", message: "لديك ساعتان لتأكيد استلام الطلب قبل إعادة فتح الاختيار للعميل." });
    await tx.insert(customerNotifications).values({ phone: request.phone, requestId: request.id, type: "quote_selected", title: "تم اختيار العرض", message: `أُرسل الاختيار إلى ${quote.providerName}. ينتظر النظام تأكيد الاستلام خلال ساعتين.` });
    await tx.insert(requestUpdates).values({ requestId: request.id, status: "in_review", message: `اختار العميل عرض ${quote.providerName} بقيمة ${quote.priceAmount} ر.س ومدة ${quote.durationDays} يوم، وينتظر تأكيد مقدم الخدمة.` });
    await tx.insert(auditLogs).values({ actorUserId: null, actorRole: "customer", actorName: request.requesterName, requestId: request.id, action: "quote_selected", summary: "اختار العميل عرض سعر وينتظر قبول مقدم الخدمة.", beforeJson: JSON.stringify({ assigneeId: request.assigneeId, quoteSelectedAt: request.quoteSelectedAt }), afterJson: JSON.stringify({ assigneeId: quote.providerUserId, quoteId: quote.id, priceAmount: quote.priceAmount, durationDays: quote.durationDays, providerAcceptanceDeadline }) });
    return { requestId: request.id, providerName: quote.providerName, priceAmount: quote.priceAmount, durationDays: quote.durationDays, providerAcceptanceDeadline };
  });
}

export async function withdrawRequestQuote(input: { requestId: number; providerUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async (tx) => {
    const request = (await tx.select().from(transactionRequests).where(eq(transactionRequests.id, input.requestId)).limit(1))[0];
    const quote = (await tx.select().from(requestQuotes).where(and(eq(requestQuotes.requestId, input.requestId), eq(requestQuotes.providerUserId, input.providerUserId), eq(requestQuotes.status, "submitted"))).limit(1))[0];
    if (!request || !quote || request.quoteSelectedAt || request.assigneeId) throw new Error("لا يمكن سحب هذا العرض بعد اختياره.");
    await tx.update(requestQuotes).set({ status: "withdrawn" }).where(eq(requestQuotes.id, quote.id));
    await tx.insert(customerNotifications).values({ phone: request.phone, requestId: request.id, type: "quote_withdrawn", title: "تم سحب عرض سعر", message: `سحب ${quote.providerName} عرضه قبل الاعتماد. يمكنك متابعة بقية العروض.` });
    await tx.insert(auditLogs).values({ actorUserId: input.providerUserId, actorRole: quote.providerRole, actorName: quote.providerName, requestId: request.id, action: "quote_withdrawn", summary: "سحب عضو الفريق عرضه قبل اعتماد العميل.", beforeJson: JSON.stringify({ status: quote.status, priceAmount: quote.priceAmount, durationDays: quote.durationDays }), afterJson: JSON.stringify({ status: "withdrawn" }) });
    return { success: true } as const;
  });
}

export async function acceptSelectedQuoteForProvider(input: { requestId: number; providerUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await expirePendingProviderSelections();
  return db.transaction(async (tx) => {
    const request = (await tx.select().from(transactionRequests).where(and(eq(transactionRequests.id, input.requestId), eq(transactionRequests.assigneeId, input.providerUserId), isNotNull(transactionRequests.quoteSelectedAt), isNull(transactionRequests.providerAcceptedAt))).limit(1))[0];
    if (!request || !request.providerAcceptanceDeadline || request.providerAcceptanceDeadline.getTime() <= Date.now()) throw new Error("انتهت مهلة قبول هذا الطلب.");
    const quote = (await tx.select().from(requestQuotes).where(and(eq(requestQuotes.requestId, request.id), eq(requestQuotes.providerUserId, input.providerUserId), eq(requestQuotes.status, "selected"))).limit(1))[0];
    if (!quote) throw new Error("لا يوجد عرض مختار بانتظار القبول.");
    const acceptedAt = new Date();
    const updated = await tx.update(transactionRequests).set({ providerAcceptedAt: acceptedAt, status: "in_progress" }).where(and(eq(transactionRequests.id, request.id), eq(transactionRequests.assigneeId, input.providerUserId), isNull(transactionRequests.providerAcceptedAt)));
    if (Number(updated[0].affectedRows) !== 1) throw new Error("تم قبول الطلب أو تحديثه مسبقًا.");
    await tx.update(requestQuotes).set({ status: "accepted" }).where(eq(requestQuotes.id, quote.id));
    const competing = await tx.select({ providerUserId: requestQuotes.providerUserId }).from(requestQuotes).where(and(eq(requestQuotes.requestId, request.id), ne(requestQuotes.providerUserId, input.providerUserId), eq(requestQuotes.status, "submitted")));
    await tx.update(requestQuotes).set({ status: "declined" }).where(and(eq(requestQuotes.requestId, request.id), ne(requestQuotes.id, quote.id), eq(requestQuotes.status, "submitted")));
    const declinedUserIds = Array.from(new Set(competing.map((item) => item.providerUserId)));
    if (declinedUserIds.length) await tx.insert(teamNotifications).values(declinedUserIds.map((recipientUserId) => ({ recipientUserId, requestId: request.id, type: "quote_declined", title: "تم قبول عرض آخر", message: "أكد مقدم العرض المختار استلام الطلب، وأُغلقت بقية العروض." })));
    await tx.insert(customerNotifications).values({ phone: request.phone, requestId: request.id, type: "request_received", title: "تم استلام طلبك", message: `${quote.providerName} أكد استلام طلبك وبدأت مرحلة التنفيذ.` });
    await tx.insert(requestUpdates).values({ requestId: request.id, status: "in_progress", message: `${quote.providerName} أكد استلام الطلب وبدأ العمل عليه.` });
    await tx.insert(auditLogs).values({ actorUserId: input.providerUserId, actorRole: quote.providerRole, actorName: quote.providerName, requestId: request.id, action: "provider_accepted_request", summary: "أكد مقدم الخدمة استلام الطلب ضمن المهلة.", beforeJson: JSON.stringify({ status: request.status, providerAcceptedAt: request.providerAcceptedAt }), afterJson: JSON.stringify({ status: "in_progress", providerAcceptedAt: acceptedAt }) });
    return { success: true, acceptedAt } as const;
  });
}

export async function updateQuoteSubmissionDeadline(input: { requestId: number; deadline: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const updated = await db.update(transactionRequests).set({ quoteSubmissionDeadline: input.deadline }).where(and(eq(transactionRequests.id, input.requestId), isNull(transactionRequests.quoteSelectedAt), isNull(transactionRequests.assigneeId), ne(transactionRequests.status, "completed")));
  if (Number(updated[0].affectedRows) !== 1) throw new Error("لا يمكن تعديل مهلة هذا الطلب بعد اختيار مقدم الخدمة.");
  return { success: true } as const;
}

export async function isRequestAssignedToUser(requestId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db
    .select({ id: transactionRequests.id })
    .from(transactionRequests)
    .where(and(eq(transactionRequests.id, requestId), eq(transactionRequests.assigneeId, userId)))
    .limit(1);
  return Boolean(rows[0]);
}

export type StaffPermissions = {
  canViewAssigned: boolean;
  canUpdateStatus: boolean;
  canAddCustomerUpdate: boolean;
};

const defaultPermissions: Record<"employee" | "agent", StaffPermissions> = {
  employee: { canViewAssigned: true, canUpdateStatus: true, canAddCustomerUpdate: true },
  agent: { canViewAssigned: true, canUpdateStatus: true, canAddCustomerUpdate: true },
};

function parseStaffPermissions(role: "employee" | "agent", value: string | null): StaffPermissions {
  if (!value) return defaultPermissions[role];
  try {
    return { ...defaultPermissions[role], ...JSON.parse(value) };
  } catch {
    return defaultPermissions[role];
  }
}

export async function listStaffAccounts() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(staffAccounts).orderBy(desc(staffAccounts.createdAt));
  const linkedUserIds = rows.flatMap((row) => row.userId ? [row.userId] : []);
  const assignedRequests = linkedUserIds.length
    ? await db.select().from(transactionRequests).where(inArray(transactionRequests.assigneeId, linkedUserIds)).orderBy(desc(transactionRequests.updatedAt))
    : [];
  return rows.map((row) => ({
    ...row,
    permissions: parseStaffPermissions(row.role, row.permissionsJson),
    requests: row.userId ? assignedRequests.filter((request) => request.assigneeId === row.userId) : [],
  }));
}

export async function createStaffAccount(input: {
  fullName: string;
  email: string;
  phone?: string | null;
  role: "employee" | "agent";
  permissions: StaffPermissions;
  createdByUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const phone = input.role === "agent" ? input.phone?.replace(/\D/g, "") || null : null;
  if (input.role === "agent" && !phone) throw new Error("رقم جوال المعقب مطلوب.");
  const mobileHash = phone ? createHash("sha256").update(phone).digest("hex") : "";
  const email = input.email.trim().toLowerCase() || (phone ? `agent-${mobileHash.slice(0, 20)}@mobile.maalamati.local` : "");
  if (!email) throw new Error("البريد الوظيفي مطلوب للموظف.");
  const mobileOpenId = phone ? `agent_mobile_${mobileHash.slice(0, 48)}` : null;
  let existingUser = mobileOpenId
    ? (await db.select().from(users).where(eq(users.openId, mobileOpenId)).limit(1))[0]
    : undefined;
  if (!existingUser) existingUser = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  if (existingUser?.openId === ENV.ownerOpenId) throw new Error("لا يمكن إضافة حساب المالك ضمن حسابات الفريق.");
  if (!existingUser && mobileOpenId) {
    const userResult = await db.insert(users).values({ openId: mobileOpenId, name: input.fullName.trim(), email, loginMethod: "whatsapp_otp", role: "agent" });
    existingUser = (await db.select().from(users).where(eq(users.id, Number(userResult[0].insertId))).limit(1))[0];
  }
  const result = await db.insert(staffAccounts).values({
    userId: existingUser?.id ?? null,
    fullName: input.fullName.trim(),
    email,
    phone,
    role: input.role,
    permissionsJson: JSON.stringify(input.permissions),
    isActive: true,
    createdByUserId: input.createdByUserId,
  });
  if (existingUser && existingUser.openId !== ENV.ownerOpenId) {
    await db.update(users).set({ name: input.fullName.trim(), role: input.role }).where(eq(users.id, existingUser.id));
  }
  return Number(result[0].insertId);
}

export async function updateStaffAccount(input: {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  role: "employee" | "agent";
  permissions: StaffPermissions;
  isActive: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const current = (await db.select().from(staffAccounts).where(eq(staffAccounts.id, input.id)).limit(1))[0];
  if (!current) throw new Error("تعذر العثور على حساب الفريق.");
  const phone = input.role === "agent" ? input.phone?.replace(/\D/g, "") || null : null;
  if (input.role === "agent" && !phone) throw new Error("رقم جوال المعقب مطلوب.");
  const mobileHash = phone ? createHash("sha256").update(phone).digest("hex") : "";
  const email = input.email.trim().toLowerCase() || (phone ? `agent-${mobileHash.slice(0, 20)}@mobile.maalamati.local` : "");
  if (!email) throw new Error("البريد الوظيفي مطلوب للموظف.");
  let linkedUserId = current.userId;
  if (input.role === "agent" && phone) {
    const mobileOpenId = `agent_mobile_${mobileHash.slice(0, 48)}`;
    let mobileUser = (await db.select().from(users).where(eq(users.openId, mobileOpenId)).limit(1))[0];
    if (!mobileUser) {
      const userResult = await db.insert(users).values({ openId: mobileOpenId, name: input.fullName.trim(), email, loginMethod: "whatsapp_otp", role: input.isActive ? "agent" : "user" });
      mobileUser = (await db.select().from(users).where(eq(users.id, Number(userResult[0].insertId))).limit(1))[0];
    }
    if (current.userId && current.userId !== mobileUser?.id) await db.update(users).set({ role: "user" }).where(eq(users.id, current.userId));
    linkedUserId = mobileUser?.id ?? null;
  }
  if (input.role === "employee" && current.userId) {
    const currentUser = (await db.select().from(users).where(eq(users.id, current.userId)).limit(1))[0];
    if (currentUser?.loginMethod === "whatsapp_otp") {
      await db.update(users).set({ role: "user" }).where(eq(users.id, current.userId));
      linkedUserId = null;
    }
  }
  await db.update(staffAccounts).set({
    userId: linkedUserId,
    fullName: input.fullName.trim(),
    email,
    phone,
    role: input.role,
    permissionsJson: JSON.stringify(input.permissions),
    isActive: input.isActive,
  }).where(eq(staffAccounts.id, input.id));
  if (linkedUserId) {
    await db.update(users).set({ name: input.fullName.trim(), email, role: input.isActive ? input.role : "user" }).where(eq(users.id, linkedUserId));
  }
  return current;
}

export async function getActiveAgentAccountByPhone(phone: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const row = (await db.select({ account: staffAccounts, user: users }).from(staffAccounts).innerJoin(users, eq(staffAccounts.userId, users.id)).where(and(eq(staffAccounts.phone, phone), eq(staffAccounts.role, "agent"), eq(staffAccounts.isActive, true), eq(users.role, "agent"))).limit(1))[0];
  return row ? { ...row.account, user: row.user, permissions: parseStaffPermissions("agent", row.account.permissionsJson) } : null;
}

export async function getActiveStaffAccountForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const row = (await db.select().from(staffAccounts).where(and(eq(staffAccounts.userId, userId), eq(staffAccounts.isActive, true))).limit(1))[0];
  return row ? { ...row, permissions: parseStaffPermissions(row.role, row.permissionsJson) } : null;
}

export async function getTransactionRequestById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return (await db.select().from(transactionRequests).where(eq(transactionRequests.id, id)).limit(1))[0] ?? null;
}

export async function createAuditLog(input: InsertAuditLog) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(auditLogs).values(input);
}

export async function createAssignedRequestUpdateWithAudit(input: {
  requestId: number;
  actorUserId: number;
  actorRole: "employee" | "agent";
  actorName: string | null;
  message: string;
  status?: (typeof requestStatuses)[number];
  action: string;
  summary: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async (tx) => {
    const before = (await tx.select().from(transactionRequests).where(and(eq(transactionRequests.id, input.requestId), eq(transactionRequests.assigneeId, input.actorUserId), or(isNull(transactionRequests.quoteSelectedAt), isNotNull(transactionRequests.providerAcceptedAt)))).limit(1).for("update"))[0];
    if (!before) return null;
    if (before.status === "completed") throw new TRPCError({ code: "CONFLICT", message: "أُغلقت المراسلة والتحديثات بعد اكتمال الطلب. السجل للقراءة فقط." });
    if (input.status) await tx.update(transactionRequests).set({ status: input.status }).where(eq(transactionRequests.id, input.requestId));
    const result = await tx.insert(requestUpdates).values({ requestId: input.requestId, message: input.message, status: input.status ?? null, senderType: input.actorRole, senderUserId: input.actorUserId, senderName: input.actorName });
    const updateId = Number(result[0].insertId);
    await tx.insert(auditLogs).values({
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      actorName: input.actorName,
      requestId: input.requestId,
      action: input.action,
      summary: input.summary,
      beforeJson: JSON.stringify({ status: before.status }),
      afterJson: JSON.stringify({ status: input.status ?? before.status, updateId, message: input.message }),
    });
    await tx.insert(customerNotifications).values({ phone: before.phone, requestId: input.requestId, type: "request_update", title: input.status ? "تحديث حالة طلبك" : "تحديث جديد على طلبك", message: input.message.slice(0, 500) });
    return { updateId };
  });
}

export async function listAuditLogs(input: { requestId?: number; actorUserId?: number; action?: string; limit?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const conditions = [
    input.requestId ? eq(auditLogs.requestId, input.requestId) : undefined,
    input.actorUserId ? eq(auditLogs.actorUserId, input.actorUserId) : undefined,
    input.action ? eq(auditLogs.action, input.action) : undefined,
  ].filter(Boolean) as ReturnType<typeof eq>[];
  return db.select().from(auditLogs).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(auditLogs.createdAt)).limit(Math.min(input.limit ?? 100, 200));
}

export async function createCustomerRequestComment(input: { phone: string; requestId: number; message: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async (tx) => {
    const request = (await tx.select().from(transactionRequests).where(and(eq(transactionRequests.id, input.requestId), eq(transactionRequests.phone, input.phone), isNotNull(transactionRequests.assigneeId), isNotNull(transactionRequests.providerAcceptedAt))).limit(1).for("update"))[0];
    if (!request?.assigneeId) return null;
    if (request.status === "completed") throw new TRPCError({ code: "CONFLICT", message: "أُغلقت المراسلة والتحديثات بعد اكتمال الطلب. السجل للقراءة فقط." });
    const result = await tx.insert(requestUpdates).values({ requestId: input.requestId, message: input.message, status: null, senderType: "customer", senderUserId: null, senderName: request.requesterName });
    const updateId = Number(result[0].insertId);
    await tx.insert(teamNotifications).values({ recipientUserId: request.assigneeId, requestId: request.id, type: "customer_comment", title: "رسالة جديدة من العميل", message: input.message.slice(0, 500) });
    await tx.insert(auditLogs).values({ actorUserId: null, actorRole: "customer", actorName: request.requesterName, requestId: request.id, action: "customer_comment", summary: "أرسل العميل تعليقًا إلى مقدم الخدمة.", beforeJson: null, afterJson: JSON.stringify({ updateId, message: input.message }) });
    return { updateId };
  });
}

type StoredConversationAttachment = Pick<InsertRequestAttachment, "fileName" | "fileKey" | "fileUrl" | "mimeType" | "size">;

export async function createCustomerConversationAttachment(input: { phone: string; requestId: number; message?: string; attachment: StoredConversationAttachment }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async (tx) => {
    const request = (await tx.select().from(transactionRequests).where(and(eq(transactionRequests.id, input.requestId), eq(transactionRequests.phone, input.phone), isNotNull(transactionRequests.assigneeId), isNotNull(transactionRequests.providerAcceptedAt))).limit(1).for("update"))[0];
    if (!request?.assigneeId) return null;
    if (request.status === "completed") throw new TRPCError({ code: "CONFLICT", message: "أُغلقت المراسلة والتحديثات بعد اكتمال الطلب. السجل للقراءة فقط." });
    const message = input.message?.trim() || `أرفق العميل ملفًا: ${input.attachment.fileName}`;
    const result = await tx.insert(requestUpdates).values({ requestId: input.requestId, message, status: null, senderType: "customer", senderUserId: null, senderName: request.requesterName });
    const updateId = Number(result[0].insertId);
    await tx.insert(requestAttachments).values({ updateId, ...input.attachment });
    await tx.insert(teamNotifications).values({ recipientUserId: request.assigneeId, requestId: request.id, type: "customer_comment", title: "مرفق جديد من العميل", message: `${request.requesterName} أرفق ${input.attachment.fileName}`.slice(0, 500) });
    await tx.insert(auditLogs).values({ actorUserId: null, actorRole: "customer", actorName: request.requesterName, requestId: request.id, action: "customer_attachment", summary: "أرسل العميل مرفقًا داخل محادثة الطلب.", beforeJson: null, afterJson: JSON.stringify({ updateId, fileName: input.attachment.fileName, mimeType: input.attachment.mimeType, size: input.attachment.size }) });
    return { updateId };
  });
}

export async function createTeamConversationAttachment(input: { requestId: number; actorUserId: number; actorRole: "employee" | "agent"; actorName: string | null; message?: string; attachment: StoredConversationAttachment }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async (tx) => {
    const request = (await tx.select().from(transactionRequests).where(and(eq(transactionRequests.id, input.requestId), eq(transactionRequests.assigneeId, input.actorUserId), isNotNull(transactionRequests.providerAcceptedAt))).limit(1).for("update"))[0];
    if (!request) return null;
    if (request.status === "completed") throw new TRPCError({ code: "CONFLICT", message: "أُغلقت المراسلة والتحديثات بعد اكتمال الطلب. السجل للقراءة فقط." });
    const message = input.message?.trim() || `أرفق مقدم الخدمة ملفًا: ${input.attachment.fileName}`;
    const result = await tx.insert(requestUpdates).values({ requestId: input.requestId, message, status: null, senderType: input.actorRole, senderUserId: input.actorUserId, senderName: input.actorName });
    const updateId = Number(result[0].insertId);
    await tx.insert(requestAttachments).values({ updateId, ...input.attachment });
    await tx.insert(customerNotifications).values({ phone: request.phone, requestId: request.id, type: "request_update", title: "مرفق جديد من مقدم الخدمة", message: `${input.actorName || "مقدم الخدمة"} أرفق ${input.attachment.fileName}`.slice(0, 500) });
    await tx.insert(auditLogs).values({ actorUserId: input.actorUserId, actorRole: input.actorRole, actorName: input.actorName, requestId: request.id, action: `${input.actorRole}_attachment`, summary: "أرسل مقدم الخدمة مرفقًا داخل محادثة الطلب.", beforeJson: null, afterJson: JSON.stringify({ updateId, fileName: input.attachment.fileName, mimeType: input.attachment.mimeType, size: input.attachment.size }) });
    return { updateId };
  });
}

export async function createRequestReviewForCustomer(input: { phone: string; requestId: number; rating: number; reviewText?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async (tx) => {
    const request = (await tx.select().from(transactionRequests).where(and(eq(transactionRequests.id, input.requestId), eq(transactionRequests.phone, input.phone), eq(transactionRequests.status, "completed"), isNotNull(transactionRequests.assigneeId), isNotNull(transactionRequests.providerAcceptedAt))).limit(1))[0];
    if (!request?.assigneeId) throw new Error("لا يمكن التقييم إلا بعد اكتمال الطلب بنجاح.");
    const existing = (await tx.select().from(requestReviews).where(eq(requestReviews.requestId, request.id)).limit(1))[0];
    if (existing) throw new Error("تم تقييم هذا الطلب مسبقًا.");
    const provider = (await tx.select().from(staffAccounts).where(and(eq(staffAccounts.userId, request.assigneeId), eq(staffAccounts.isActive, true))).limit(1))[0];
    if (!provider) throw new Error("حساب مقدم الخدمة غير متاح للتقييم.");
    const result = await tx.insert(requestReviews).values({ requestId: request.id, customerId: request.customerId, providerUserId: request.assigneeId, providerName: provider.fullName, providerRole: provider.role, rating: input.rating, reviewText: input.reviewText?.trim() || null });
    const reviewId = Number(result[0].insertId);
    await tx.insert(teamNotifications).values({ recipientUserId: request.assigneeId, requestId: request.id, type: "customer_review", title: "وصل تقييم جديد", message: `قيّم العميل الخدمة ${input.rating} من 5.` });
    await tx.insert(auditLogs).values({ actorUserId: null, actorRole: "customer", actorName: request.requesterName, requestId: request.id, action: "customer_review", summary: "أرسل العميل تقييمًا بعد اكتمال الطلب.", beforeJson: null, afterJson: JSON.stringify({ reviewId, rating: input.rating, hasText: Boolean(input.reviewText?.trim()) }) });
    return (await tx.select().from(requestReviews).where(eq(requestReviews.id, reviewId)).limit(1))[0];
  });
}

export async function listCustomerRequestConversation(phone: string, requestId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const request = (await db.select({ id: transactionRequests.id, providerAcceptedAt: transactionRequests.providerAcceptedAt }).from(transactionRequests).where(and(eq(transactionRequests.id, requestId), eq(transactionRequests.phone, phone))).limit(1))[0];
  if (!request?.providerAcceptedAt) return null;
  return listRequestUpdates(requestId);
}

export async function updateRequestWorkflow(input: {
  id: number;
  assigneeId: number | null;
  priority: (typeof requestPriorities)[number];
  tags: string[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const before = (await db.select({ assigneeId: transactionRequests.assigneeId, category: transactionRequests.category }).from(transactionRequests).where(eq(transactionRequests.id, input.id)).limit(1))[0];
  await db.update(transactionRequests).set({
    assigneeId: input.assigneeId,
    priority: input.priority,
    tags: input.tags.length ? JSON.stringify(input.tags) : null,
  }).where(eq(transactionRequests.id, input.id));
  if (input.assigneeId && input.assigneeId !== before?.assigneeId) {
    try {
      const activeStaff = (await db.select({ id: staffAccounts.id }).from(staffAccounts).where(and(eq(staffAccounts.userId, input.assigneeId), eq(staffAccounts.isActive, true))).limit(1))[0];
      if (activeStaff) await createTeamNotification({ recipientUserId: input.assigneeId, requestId: input.id, type: "request_assigned", title: "طلب جديد مسند إليك", message: `تم إسناد ${before?.category || "طلب"} إلى حسابك. افتح بوابة الفريق لمراجعته.` });
    } catch (error) {
      console.warn("[Notifications] Failed to notify assignee:", error);
    }
  }
}

export async function notifyActiveTeamOfNewRequest(input: { requestId: number; category: string; subcategory?: string | null; details: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const recipients = await db.select({ userId: staffAccounts.userId }).from(staffAccounts).where(and(eq(staffAccounts.isActive, true), isNotNull(staffAccounts.userId)));
  const userIds = Array.from(new Set(recipients.flatMap((row) => row.userId ? [row.userId] : [])));
  if (!userIds.length) return 0;
  const service = input.subcategory ? `${input.category} — ${input.subcategory}` : input.category;
  const safeSummary = input.details
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[بريد محجوب]")
    .replace(/(?:\+?966|00966|0)?5\d{8}/g, "[جوال محجوب]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  const message = safeSummary ? `الخدمة: ${service}. ${safeSummary}` : `الخدمة: ${service}. افتح الطلب للاطلاع على التفاصيل.`;
  await db.insert(teamNotifications).values(userIds.map((recipientUserId) => ({ recipientUserId, requestId: input.requestId, type: "new_customer_request", title: "وصل طلب جديد من عميل", message })));
  return userIds.length;
}

export async function createTeamNotification(input: typeof teamNotifications.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(teamNotifications).values(input);
}

export async function listTeamNotificationsForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [items, unread] = await Promise.all([
    db.select().from(teamNotifications).where(eq(teamNotifications.recipientUserId, userId)).orderBy(desc(teamNotifications.createdAt)).limit(60),
    db.select({ value: count() }).from(teamNotifications).where(and(eq(teamNotifications.recipientUserId, userId), eq(teamNotifications.isRead, false))),
  ]);
  return { items, unreadCount: Number(unread[0]?.value ?? 0) };
}

export async function markTeamNotificationRead(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(teamNotifications).set({ isRead: true, readAt: new Date() }).where(and(eq(teamNotifications.id, notificationId), eq(teamNotifications.recipientUserId, userId)));
}

export async function markAllTeamNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(teamNotifications).set({ isRead: true, readAt: new Date() }).where(and(eq(teamNotifications.recipientUserId, userId), eq(teamNotifications.isRead, false)));
}

export async function deleteTeamNotification(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(teamNotifications).where(and(eq(teamNotifications.id, notificationId), eq(teamNotifications.recipientUserId, userId)));
}

export async function clearReadTeamNotifications(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(teamNotifications).where(and(eq(teamNotifications.recipientUserId, userId), eq(teamNotifications.isRead, true)));
}

export async function listCustomerNotificationsForPhone(phone: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await expirePendingProviderSelections();
  const [items, unread] = await Promise.all([
    db.select().from(customerNotifications).where(eq(customerNotifications.phone, phone)).orderBy(desc(customerNotifications.createdAt)).limit(60),
    db.select({ value: count() }).from(customerNotifications).where(and(eq(customerNotifications.phone, phone), eq(customerNotifications.isRead, false))),
  ]);
  return { items, unreadCount: Number(unread[0]?.value ?? 0) };
}

export async function markCustomerNotificationRead(notificationId: number, phone: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(customerNotifications).set({ isRead: true, readAt: new Date() }).where(and(eq(customerNotifications.id, notificationId), eq(customerNotifications.phone, phone)));
}

export async function markAllCustomerNotificationsRead(phone: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(customerNotifications).set({ isRead: true, readAt: new Date() }).where(and(eq(customerNotifications.phone, phone), eq(customerNotifications.isRead, false)));
}

export async function markCustomerQuoteNotificationsReadForRequest(requestId: number, phone: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(customerNotifications).set({ isRead: true, readAt: new Date() }).where(and(
    eq(customerNotifications.phone, phone),
    eq(customerNotifications.requestId, requestId),
    eq(customerNotifications.isRead, false),
    inArray(customerNotifications.type, ["first_quote_received", "quote_received"]),
  ));
}

export async function updateTransactionRequestStatus(
  id: number,
  status: (typeof requestStatuses)[number],
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(transactionRequests).set({ status }).where(eq(transactionRequests.id, id));
}

export async function createRequestUpdate(input: InsertRequestUpdate) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(requestUpdates).values(input);
  return Number(result[0].insertId);
}

export async function createRequestAttachment(input: InsertRequestAttachment) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(requestAttachments).values(input);
}

export async function listRequestUpdates(requestId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const updates = await db
    .select()
    .from(requestUpdates)
    .where(eq(requestUpdates.requestId, requestId))
    .orderBy(asc(requestUpdates.createdAt));
  if (updates.length === 0) return [];
  const attachments = await db
    .select()
    .from(requestAttachments)
    .where(inArray(requestAttachments.updateId, updates.map((update) => update.id)));
  return updates.map((update) => ({
    ...update,
    attachments: attachments.filter((attachment) => attachment.updateId === update.id),
  }));
}

export async function getRequestTracking(reference: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const requests = await db
    .select({
      id: transactionRequests.id,
      reference: transactionRequests.reference,
      category: transactionRequests.category,
      subcategory: transactionRequests.subcategory,
      status: transactionRequests.status,
      createdAt: transactionRequests.createdAt,
      updatedAt: transactionRequests.updatedAt,
    })
    .from(transactionRequests)
    .where(eq(transactionRequests.reference, reference))
    .limit(1);
  const request = requests[0];
  if (!request) return null;
  const updates = await listRequestUpdates(request.id);
  return { ...request, updates };
}

export async function getRequestTrackingByPhone(phone: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const requests = await db.select({ id: transactionRequests.id, reference: transactionRequests.reference, category: transactionRequests.category, subcategory: transactionRequests.subcategory, status: transactionRequests.status, createdAt: transactionRequests.createdAt, updatedAt: transactionRequests.updatedAt }).from(transactionRequests).where(eq(transactionRequests.phone, phone)).orderBy(desc(transactionRequests.updatedAt)).limit(20);
  if (!requests.length) return [];
  const reviews = await db.select().from(requestReviews).where(inArray(requestReviews.requestId, requests.map((request) => request.id)));
  return Promise.all(requests.map(async (request) => ({ ...request, review: reviews.find((review) => review.requestId === request.id) ?? null, updates: await listRequestUpdates(request.id) })));
}

export async function markOwnerNotified(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .update(transactionRequests)
    .set({ ownerNotified: true })
    .where(eq(transactionRequests.id, id));
}

export async function upsertPwaSubscription(input: InsertPwaSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(pwaSubscriptions).values(input).onDuplicateKeyUpdate({
    set: {
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      enabled: true,
    },
  });
}

export async function disablePwaSubscription(endpointHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .update(pwaSubscriptions)
    .set({ enabled: false })
    .where(eq(pwaSubscriptions.endpointHash, endpointHash));
}
import { createHash } from "node:crypto";
