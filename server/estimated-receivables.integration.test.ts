import { inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { requestQuotes, transactionRequests, users } from "../drizzle/schema";
import { getDb } from "./db";
import { listEstimatedReceivables } from "./estimatedReceivables";

describe("المستحقات التقديرية", () => {
  it("يجمع فقط عروض المعاملات المكتملة المقبولة من المعقب المسند بعد تأكيده", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database is not available");

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const userIds: number[] = [];
    const requestIds: number[] = [];
    let requestSequence = 0;

    const createRequest = async (input: {
      assigneeId: number;
      status: "completed" | "in_progress";
      providerAcceptedAt?: Date | null;
    }) => {
      const sequence = ++requestSequence;
      const reference = `ER-${suffix}-${sequence}`;
      const result = await db.insert(transactionRequests).values({
        reference,
        assigneeId: input.assigneeId,
        requesterName: `عميل مستحقات اختبار ${suffix}-${sequence}`,
        phone: `059${String(Date.now()).slice(-7)}`,
        category: "طلب خدمة",
        subcategory: "استشارة",
        details: `سجل اختبار تكامل المستحقات ${suffix}-${sequence}.`,
        status: input.status,
        providerAcceptedAt: input.providerAcceptedAt,
      });
      const id = Number(result[0].insertId);
      requestIds.push(id);
      return { id, reference };
    };

    try {
      const targetUserResult = await db.insert(users).values({
        openId: `estimated-receivables-target-${suffix}`,
        name: `معقب المستحقات المستهدف ${suffix}`,
        email: `estimated-receivables-target-${suffix}@example.invalid`,
        loginMethod: "integration-test",
        role: "agent",
      });
      const targetUserId = Number(targetUserResult[0].insertId);
      userIds.push(targetUserId);

      const otherUserResult = await db.insert(users).values({
        openId: `estimated-receivables-other-${suffix}`,
        name: `معقب المستحقات الآخر ${suffix}`,
        email: `estimated-receivables-other-${suffix}@example.invalid`,
        loginMethod: "integration-test",
        role: "agent",
      });
      const otherUserId = Number(otherUserResult[0].insertId);
      userIds.push(otherUserId);

      const providerAcceptedAt = new Date();
      const acceptedTenHalalas = await createRequest({
        assigneeId: targetUserId,
        status: "completed",
        providerAcceptedAt,
      });
      await db.insert(requestQuotes).values({
        requestId: acceptedTenHalalas.id,
        providerUserId: targetUserId,
        providerRole: "agent",
        providerName: `معقب المستحقات المستهدف ${suffix}`,
        priceAmount: "0.10",
        durationDays: 1,
        status: "accepted",
      });

      const acceptedTwentyHalalas = await createRequest({
        assigneeId: targetUserId,
        status: "completed",
        providerAcceptedAt,
      });
      await db.insert(requestQuotes).values({
        requestId: acceptedTwentyHalalas.id,
        providerUserId: targetUserId,
        providerRole: "agent",
        providerName: `معقب المستحقات المستهدف ${suffix}`,
        priceAmount: "0.20",
        durationDays: 1,
        status: "accepted",
      });

      const activeRequest = await createRequest({
        assigneeId: targetUserId,
        status: "in_progress",
        providerAcceptedAt,
      });
      await db.insert(requestQuotes).values({
        requestId: activeRequest.id,
        providerUserId: targetUserId,
        providerRole: "agent",
        providerName: `معقب المستحقات المستهدف ${suffix}`,
        priceAmount: "9.99",
        durationDays: 1,
        status: "accepted",
      });

      const otherAssigneeCompleted = await createRequest({
        assigneeId: otherUserId,
        status: "completed",
        providerAcceptedAt,
      });
      await db.insert(requestQuotes).values({
        requestId: otherAssigneeCompleted.id,
        providerUserId: otherUserId,
        providerRole: "agent",
        providerName: `معقب المستحقات الآخر ${suffix}`,
        priceAmount: "8.88",
        durationDays: 1,
        status: "accepted",
      });

      const completedWithoutQuote = await createRequest({
        assigneeId: targetUserId,
        status: "completed",
      });

      const completedWithSubmittedQuote = await createRequest({
        assigneeId: targetUserId,
        status: "completed",
        providerAcceptedAt,
      });
      await db.insert(requestQuotes).values({
        requestId: completedWithSubmittedQuote.id,
        providerUserId: targetUserId,
        providerRole: "agent",
        providerName: `معقب المستحقات المستهدف ${suffix}`,
        priceAmount: "7.77",
        durationDays: 1,
        status: "submitted",
      });

      const completedWithOtherProvidersQuote = await createRequest({
        assigneeId: targetUserId,
        status: "completed",
        providerAcceptedAt,
      });
      await db.insert(requestQuotes).values({
        requestId: completedWithOtherProvidersQuote.id,
        providerUserId: otherUserId,
        providerRole: "agent",
        providerName: `معقب المستحقات الآخر ${suffix}`,
        priceAmount: "6.66",
        durationDays: 1,
        status: "accepted",
      });

      const completedBeforeProviderConfirmation = await createRequest({
        assigneeId: targetUserId,
        status: "completed",
        providerAcceptedAt: null,
      });
      await db.insert(requestQuotes).values({
        requestId: completedBeforeProviderConfirmation.id,
        providerUserId: targetUserId,
        providerRole: "agent",
        providerName: `معقب المستحقات المستهدف ${suffix}`,
        priceAmount: "5.55",
        durationDays: 1,
        status: "accepted",
      });

      const receivables = await listEstimatedReceivables(targetUserId);

      expect(receivables).toMatchObject({
        totalAmount: "0.30",
        completedRequestCount: 6,
        pricedRequestCount: 2,
        unpricedRequestCount: 4,
      });
      expect(receivables.items.map(item => item.reference).sort()).toEqual(
        [
          acceptedTenHalalas.reference,
          acceptedTwentyHalalas.reference,
          completedWithoutQuote.reference,
          completedWithSubmittedQuote.reference,
          completedWithOtherProvidersQuote.reference,
          completedBeforeProviderConfirmation.reference,
        ].sort()
      );

      const amountByReference = new Map(
        receivables.items.map(item => [item.reference, item.priceAmount])
      );
      expect(amountByReference).toEqual(
        new Map([
          [acceptedTenHalalas.reference, "0.10"],
          [acceptedTwentyHalalas.reference, "0.20"],
          [completedWithoutQuote.reference, null],
          [completedWithSubmittedQuote.reference, null],
          [completedWithOtherProvidersQuote.reference, null],
          [completedBeforeProviderConfirmation.reference, null],
        ])
      );
      expect(amountByReference.has(activeRequest.reference)).toBe(false);
      expect(amountByReference.has(otherAssigneeCompleted.reference)).toBe(
        false
      );
    } finally {
      if (requestIds.length) {
        await db
          .delete(transactionRequests)
          .where(inArray(transactionRequests.id, requestIds));
      }
      if (userIds.length) {
        await db.delete(users).where(inArray(users.id, userIds));
      }
    }
  }, 30_000);
});
