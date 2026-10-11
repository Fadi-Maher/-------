import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { auditLogs, customerNotifications, customers, requestQuotes, requestUpdates, staffAccounts, teamNotifications, transactionRequests, users } from "../drizzle/schema";
import { acceptQuoteForCustomer, acceptSelectedQuoteForProvider, getAppSettings, getDb, listOpenRequestsForTeam, listQuotesForCustomerPhone, listRequestsAssignedToUser, replaceAppSettings, upsertRequestQuote, withdrawRequestQuote } from "./db";
import type { TrpcContext } from "./_core/context";

const notifyOwner = vi.hoisted(() => vi.fn());
vi.mock("./_core/notification", () => ({ notifyOwner }));

import { appRouter } from "./routers";

const referencesToClean: string[] = [];
let originalSettings: Awaited<ReturnType<typeof getAppSettings>> | null = null;

function publicContext(): TrpcContext {
  return { user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

function adminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "integration-admin",
      name: "Integration Admin",
      email: "admin@example.com",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("التكامل الحقيقي لطلب معاملة", () => {
  beforeAll(async () => {
    originalSettings = await getAppSettings(true);
    await replaceAppSettings({ whatsappNumber: null, fields: [] });
  });

  afterAll(async () => {
    if (originalSettings) {
      await replaceAppSettings(originalSettings);
    }
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    for (const reference of referencesToClean) {
      await db.delete(transactionRequests).where(eq(transactionRequests.reference, reference));
    }
    await db.delete(customers).where(and(
      eq(customers.fullName, "اختبار تكامل مؤقت"),
      eq(customers.phone, "0500000000"),
      isNull(customers.userId),
    ));
  });

  it("يحفظ الطلب في قاعدة البيانات ويعلّم تنبيه المالك كمرسل", async () => {
    notifyOwner.mockResolvedValueOnce(true);
    const caller = appRouter.createCaller(publicContext());
    const created = await caller.requests.create({
      requesterName: "اختبار تكامل مؤقت",
      phone: "0500000000",
      category: "طلب خدمة",
      subcategory: "استشارة أو طلب مخصص",
      details: "سجل اختبار تكاملي مؤقت يتحقق من حفظ الطلب وتنبيه المالك ثم يحذف نفسه.",
    });
    referencesToClean.push(created.reference);

    const db = await getDb();
    expect(db).not.toBeNull();
    const persisted = await db!.select().from(transactionRequests).where(eq(transactionRequests.reference, created.reference)).limit(1);

    expect(persisted[0]).toMatchObject({
      reference: created.reference,
      category: "طلب خدمة",
      ownerNotified: true,
    });
    expect(notifyOwner).toHaveBeenCalledOnce();

    const admin = appRouter.createCaller(adminContext());
    const update = await admin.requests.addUpdate({
      requestId: created.id,
      message: "تمت مراجعة الطلب وسيبدأ التنفيذ قريبًا.",
      status: "in_review",
    });

    const attachment = await admin.requests.uploadAttachment({
      updateId: update.updateId,
      fileName: "integration-verification.pdf",
      mimeType: "application/pdf",
      dataBase64: Buffer.from("%PDF-1.4\nStreak Express attachment verification").toString("base64"),
    });
    expect(attachment.attachment.url).toContain("/manus-storage/");

    const tracking = await caller.requests.track({ reference: created.reference });
    expect(tracking).toMatchObject({ reference: created.reference, status: "in_review" });
    expect(tracking?.updates.map((update) => update.message)).toContain("تمت مراجعة الطلب وسيبدأ التنفيذ قريبًا.");
    expect(tracking?.updates.flatMap((entry) => entry.attachments).map((item) => item.fileName)).toContain("integration-verification.pdf");

    const missing = await caller.requests.track({ reference: "SE-NOT-FOUND" });
    expect(missing).toBeNull();
  }, 15_000);

  it("يحفظ إعدادات الحقول ورقم الدعم ويعرضها للواجهة العامة", async () => {
    const admin = appRouter.createCaller(adminContext());
    const publicCaller = appRouter.createCaller(publicContext());

    await admin.settings.save({
      whatsappNumber: "966500000000",
      fields: [{ fieldKey: "city", label: "المدينة", type: "select", placeholder: "اختر المدينة", options: ["الرياض", "جدة"], isRequired: true, isVisible: true }],
    });

    await expect(publicCaller.settings.publicConfig()).resolves.toMatchObject({
      whatsappNumber: "966500000000",
      fields: [{ fieldKey: "city", label: "المدينة", type: "select", options: ["الرياض", "جدة"], isRequired: true }],
    });

    await admin.settings.save({ whatsappNumber: null, fields: [] });
    await expect(publicCaller.settings.publicConfig()).resolves.toEqual({ whatsappNumber: null, fields: [] });
  });

  it("يختار عرضًا واحدًا ذريًا ثم يؤكد مقدم الخدمة استلامه", async () => {
    const db = await getDb();
    expect(db).not.toBeNull();
    const stamp = Date.now();
    const reference = `SE-QUOTE-${stamp}`;
    const providerIds: number[] = [];
    let requestId = 0;
    try {
      for (const [index, role] of (["employee", "agent"] as const).entries()) {
        const userResult = await db!.insert(users).values({ openId: `quote-test-${stamp}-${index}`, name: `مقدم عرض ${index + 1}`, email: `quote-${stamp}-${index}@example.com`, loginMethod: "test", role });
        const userId = Number(userResult[0].insertId);
        providerIds.push(userId);
        await db!.insert(staffAccounts).values({ userId, fullName: `مقدم عرض ${index + 1}`, email: `quote-${stamp}-${index}@example.com`, role, permissionsJson: JSON.stringify({ canViewAssigned: true, canUpdateStatus: true, canAddCustomerUpdate: role === "agent" }), isActive: true });
      }
      const requestResult = await db!.insert(transactionRequests).values({ reference, requesterName: "عميل عروض مؤقت", phone: "0500000001", category: "طلب خدمة", subcategory: "استشارة أو طلب مخصص", details: "طلب مؤقت لاختبار عرضين. التواصل 0500000001 أو privacy@example.com" });
      requestId = Number(requestResult[0].insertId);
      const openRequests = await listOpenRequestsForTeam(providerIds[0]);
      const marketRequest = openRequests.find((request) => request.id === requestId);
      expect(marketRequest).not.toHaveProperty("requesterName");
      expect(marketRequest).not.toHaveProperty("phone");
      expect(marketRequest?.details).not.toContain("0500000001");
      expect(marketRequest?.details).not.toContain("privacy@example.com");
      await upsertRequestQuote({ requestId, providerUserId: providerIds[0], priceAmount: "500.00", durationDays: 7 });
      const notificationsAfterFirstQuote = await db!.select().from(customerNotifications).where(and(eq(customerNotifications.requestId, requestId), eq(customerNotifications.type, "first_quote_received")));
      expect(notificationsAfterFirstQuote).toHaveLength(1);
      await upsertRequestQuote({ requestId, providerUserId: providerIds[1], priceAmount: "450.00", durationDays: 5, note: "يشمل المتابعة" });
      const notificationsAfterSecondQuote = await db!.select().from(customerNotifications).where(eq(customerNotifications.requestId, requestId));
      expect(notificationsAfterSecondQuote.filter((notification) => notification.type === "first_quote_received")).toHaveLength(1);
      expect(notificationsAfterSecondQuote.filter((notification) => notification.type === "quote_received")).toHaveLength(1);
      const quotes = await db!.select().from(requestQuotes).where(eq(requestQuotes.requestId, requestId));
      const selectedQuote = quotes.find((quote) => quote.providerUserId === providerIds[1])!;
      await expect(acceptQuoteForCustomer({ phone: "0500000001", quoteId: selectedQuote.id })).resolves.toMatchObject({ providerName: "مقدم عرض 2", durationDays: 5 });
      const persistedRequest = (await db!.select().from(transactionRequests).where(eq(transactionRequests.id, requestId)).limit(1))[0];
      const persistedQuotes = await db!.select().from(requestQuotes).where(eq(requestQuotes.requestId, requestId));
      expect(persistedRequest.assigneeId).toBe(providerIds[1]);
      expect(persistedRequest.quoteSelectedAt).not.toBeNull();
      expect(persistedRequest.providerAcceptedAt).toBeNull();
      expect(persistedQuotes.find((quote) => quote.providerUserId === providerIds[1])?.status).toBe("selected");
      expect(persistedQuotes.find((quote) => quote.providerUserId === providerIds[0])?.status).toBe("submitted");
      await expect(acceptSelectedQuoteForProvider({ requestId, providerUserId: providerIds[1] })).resolves.toMatchObject({ success: true });
      const assignedRequests = await listRequestsAssignedToUser(providerIds[1]);
      const assignedRequest = assignedRequests.find((request) => request.id === requestId);
      expect(assignedRequest?.requesterName).toBe("عميل عروض مؤقت");
      expect(assignedRequest).not.toHaveProperty("phone");
      expect(assignedRequest).not.toHaveProperty("customerId");
      expect(assignedRequest).not.toHaveProperty("customFields");
      expect(assignedRequest?.details).not.toContain("0500000001");
      expect(assignedRequest?.details).not.toContain("privacy@example.com");
      const acceptedRequest = (await db!.select().from(transactionRequests).where(eq(transactionRequests.id, requestId)).limit(1))[0];
      const finalizedQuotes = await db!.select().from(requestQuotes).where(eq(requestQuotes.requestId, requestId));
      expect(acceptedRequest.providerAcceptedAt).not.toBeNull();
      expect(finalizedQuotes.find((quote) => quote.providerUserId === providerIds[1])?.status).toBe("accepted");
      expect(finalizedQuotes.find((quote) => quote.providerUserId === providerIds[0])?.status).toBe("declined");
      await expect(acceptQuoteForCustomer({ phone: "0500000001", quoteId: selectedQuote.id })).rejects.toThrow();
    } finally {
      if (requestId) {
        await db!.delete(customerNotifications).where(eq(customerNotifications.requestId, requestId));
        await db!.delete(teamNotifications).where(eq(teamNotifications.requestId, requestId));
        await db!.delete(auditLogs).where(eq(auditLogs.requestId, requestId));
        await db!.delete(requestUpdates).where(eq(requestUpdates.requestId, requestId));
        await db!.delete(transactionRequests).where(eq(transactionRequests.id, requestId));
      }
      if (providerIds.length) {
        await db!.delete(staffAccounts).where(inArray(staffAccounts.userId, providerIds));
        await db!.delete(users).where(inArray(users.id, providerIds));
      }
    }
  }, 30_000);

  it("يغلق العروض بالوقت ويعيد فتح الاختيار عند انتهاء مهلة مقدم الخدمة", async () => {
    const db = await getDb();
    expect(db).not.toBeNull();
    const stamp = Date.now();
    const providerIds: number[] = [];
    const requestIds: number[] = [];
    try {
      const userResult = await db!.insert(users).values({ openId: `deadline-test-${stamp}`, name: "مقدم مهلة مؤقت", email: `deadline-${stamp}@example.com`, loginMethod: "test", role: "agent" });
      const providerUserId = Number(userResult[0].insertId);
      providerIds.push(providerUserId);
      await db!.insert(staffAccounts).values({ userId: providerUserId, fullName: "مقدم مهلة مؤقت", email: `deadline-${stamp}@example.com`, role: "agent", permissionsJson: JSON.stringify({ canViewAssigned: true, canUpdateStatus: true, canAddCustomerUpdate: true }), isActive: true });
      const expiredResult = await db!.insert(transactionRequests).values({ reference: `SE-EXPIRED-${stamp}`, requesterName: "عميل مهلة منتهية", phone: "0500000002", category: "طلب خدمة", details: "طلب انتهت مهلة استقبال عروضه.", quoteSubmissionDeadline: new Date(Date.now() - 60_000) });
      const expiredRequestId = Number(expiredResult[0].insertId);
      requestIds.push(expiredRequestId);
      await expect(listOpenRequestsForTeam(providerUserId)).resolves.not.toEqual(expect.arrayContaining([expect.objectContaining({ id: expiredRequestId })]));
      await expect(upsertRequestQuote({ requestId: expiredRequestId, providerUserId, priceAmount: "300.00", durationDays: 3 })).rejects.toThrow("انتهى استقبال العروض");

      const openResult = await db!.insert(transactionRequests).values({ reference: `SE-REOPEN-${stamp}`, requesterName: "عميل إعادة فتح", phone: "0500000003", category: "طلب خدمة", details: "طلب لاختبار السحب وإعادة فتح الاختيار.", quoteSubmissionDeadline: new Date(Date.now() + 3_600_000) });
      const openRequestId = Number(openResult[0].insertId);
      requestIds.push(openRequestId);
      await upsertRequestQuote({ requestId: openRequestId, providerUserId, priceAmount: "350.00", durationDays: 4 });
      await expect(withdrawRequestQuote({ requestId: openRequestId, providerUserId })).resolves.toEqual({ success: true });
      await upsertRequestQuote({ requestId: openRequestId, providerUserId, priceAmount: "325.00", durationDays: 3 });
      const quote = (await db!.select().from(requestQuotes).where(and(eq(requestQuotes.requestId, openRequestId), eq(requestQuotes.providerUserId, providerUserId))).limit(1))[0];
      await acceptQuoteForCustomer({ phone: "0500000003", quoteId: quote.id });
      await db!.update(transactionRequests).set({ providerAcceptanceDeadline: new Date(Date.now() - 60_000) }).where(eq(transactionRequests.id, openRequestId));
      await listQuotesForCustomerPhone("0500000003");
      const reopened = (await db!.select().from(transactionRequests).where(eq(transactionRequests.id, openRequestId)).limit(1))[0];
      const expiredSelection = (await db!.select().from(requestQuotes).where(eq(requestQuotes.id, quote.id)).limit(1))[0];
      expect(reopened.assigneeId).toBeNull();
      expect(reopened.quoteSelectedAt).toBeNull();
      expect(reopened.quoteSubmissionDeadline?.getTime()).toBeGreaterThan(Date.now());
      expect(expiredSelection.status).toBe("withdrawn");
    } finally {
      if (requestIds.length) {
        await db!.delete(customerNotifications).where(inArray(customerNotifications.requestId, requestIds));
        await db!.delete(teamNotifications).where(inArray(teamNotifications.requestId, requestIds));
        await db!.delete(auditLogs).where(inArray(auditLogs.requestId, requestIds));
        await db!.delete(requestUpdates).where(inArray(requestUpdates.requestId, requestIds));
        await db!.delete(transactionRequests).where(inArray(transactionRequests.id, requestIds));
      }
      if (providerIds.length) {
        await db!.delete(staffAccounts).where(inArray(staffAccounts.userId, providerIds));
        await db!.delete(users).where(inArray(users.id, providerIds));
      }
    }
  }, 30_000);
});
