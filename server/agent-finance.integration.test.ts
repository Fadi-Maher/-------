import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  agentFinanceEntries,
  auditLogs,
  customerNotifications,
  requestQuotes,
  teamNotifications,
  transactionRequests,
  users,
} from "../drizzle/schema";
import {
  addAgentFinanceEntry,
  getAgentFinance,
  listCompletedAgentRequests,
  voidAgentFinanceEntry,
} from "./agentFinanceDb";
import { getDb } from "./db";

describe("تكامل دفتر ماليات المعقب", () => {
  it("يعزل المعرّفات والطلبات، ويحسب القيود ويؤمن التكرار والإلغاء", async () => {
    const db = await getDb();
    expect(db).not.toBeNull();
    if (!db) return;

    const run = randomUUID().slice(0, 8);
    const userIds: number[] = [];
    const requestIds: number[] = [];
    const entryIds: number[] = [];
    let referenceSequence = 0;

    const createAgent = async (label: string, name: string) => {
      const inserted = await db.insert(users).values({
        openId: `finance-${label}-${run}`,
        name,
        email: `finance-${label}-${run}@example.test`,
        loginMethod: "integration-test",
        role: "agent",
      });
      const id = Number(inserted[0].insertId);
      userIds.push(id);
      return id;
    };

    const createRequest = async ({
      assigneeId,
      status,
      accepted = false,
      priceAmount = "1.00",
      providerName,
    }: {
      assigneeId: number;
      status: "completed" | "in_progress";
      accepted?: boolean;
      priceAmount?: string;
      providerName: string;
    }) => {
      const reference = `AF-${run}-${++referenceSequence}`;
      const acceptedAt = accepted ? new Date(Date.now() - 5_000) : null;
      const inserted = await db.insert(transactionRequests).values({
        reference,
        assigneeId,
        requesterName: "عميل اختبار دفتر الماليات",
        phone: `059${String(referenceSequence).padStart(7, "0")}`,
        category: "اختبار مالي",
        details: "طلب معزول لاختبار دفتر ماليات المعقب مباشرة عبر Drizzle.",
        status,
        quoteSelectedAt: acceptedAt,
        providerAcceptedAt: acceptedAt,
      });
      const id = Number(inserted[0].insertId);
      requestIds.push(id);
      if (accepted) {
        await db.insert(requestQuotes).values({
          requestId: id,
          providerUserId: assigneeId,
          providerRole: "agent",
          providerName,
          priceAmount,
          durationDays: 1,
          status: "accepted",
        });
      }
      return id;
    };

    const inputFor = (
      requestId: number,
      kind: "collection" | "cost",
      amount: string,
      note: string,
      clientKey = randomUUID(),
      occurredAt = Date.now() - 1_000
    ) => ({ requestId, kind, amount, occurredAt, clientKey, note });

    const addForFirstAgent = async (
      requestId: number,
      kind: "collection" | "cost",
      amount: string,
      note: string
    ) => {
      const result = await addAgentFinanceEntry(
        firstAgentId,
        "المعقب الأول",
        inputFor(requestId, kind, amount, note)
      );
      if (!result.duplicate) entryIds.push(result.id);
      return result;
    };

    let firstAgentId = 0;
    try {
      firstAgentId = await createAgent("u1", "المعقب الأول");
      const secondAgentId = await createAgent("u2", "المعقب الثاني");

      const completedTenth = await createRequest({
        assigneeId: firstAgentId,
        status: "completed",
        accepted: true,
        priceAmount: "0.10",
        providerName: "المعقب الأول",
      });
      const completedTwentieth = await createRequest({
        assigneeId: firstAgentId,
        status: "completed",
        accepted: true,
        priceAmount: "0.20",
        providerName: "المعقب الأول",
      });
      const manualCompleted = await createRequest({
        assigneeId: firstAgentId,
        status: "completed",
        providerName: "المعقب الأول",
      });
      const activeOwned = await createRequest({
        assigneeId: firstAgentId,
        status: "in_progress",
        accepted: true,
        priceAmount: "99.99",
        providerName: "المعقب الأول",
      });
      const completedOther = await createRequest({
        assigneeId: secondAgentId,
        status: "completed",
        accepted: true,
        priceAmount: "88.88",
        providerName: "المعقب الثاني",
      });
      const activeOther = await createRequest({
        assigneeId: secondAgentId,
        status: "in_progress",
        accepted: true,
        providerName: "المعقب الثاني",
      });
      const reassignedLater = await createRequest({
        assigneeId: firstAgentId,
        status: "in_progress",
        accepted: true,
        providerName: "المعقب الأول",
      });

      const completed = await listCompletedAgentRequests(firstAgentId);
      expect(completed).toMatchObject({
        totalAmount: "0.30",
        completedRequestCount: 3,
        pricedRequestCount: 2,
        unpricedRequestCount: 1,
      });
      expect(completed.items.map(item => item.requestId)).toEqual(
        expect.arrayContaining([completedTenth, completedTwentieth, manualCompleted])
      );
      expect(completed.items.map(item => item.requestId)).not.toEqual(
        expect.arrayContaining([activeOwned, completedOther])
      );
      expect(
        completed.items.find(item => item.requestId === manualCompleted)?.priceAmount
      ).toBeNull();

      const firstCollection = await addForFirstAgent(
        completedTenth,
        "collection",
        "10.10",
        "الدفعة الأولى"
      );
      const voidableCollection = await addForFirstAgent(
        completedTenth,
        "collection",
        "0.20",
        "دفعة ستلغى"
      );
      await addForFirstAgent(completedTenth, "cost", "3.00", "تكلفة أولى");
      expect(await getAgentFinance(firstAgentId)).toMatchObject({
        totalCollected: "10.30",
        totalCosts: "3.00",
        netProfit: "7.30",
      });

      await addForFirstAgent(completedTenth, "cost", "10.00", "تكلفة تجعل الصافي خسارة");
      expect(await getAgentFinance(firstAgentId)).toMatchObject({
        totalCollected: "10.30",
        totalCosts: "13.00",
        netProfit: "-2.70",
      });

      const idempotentInput = inputFor(
        completedTwentieth,
        "collection",
        "1.00",
        "قيد مكرر آمن"
      );
      const firstSave = await addAgentFinanceEntry(
        firstAgentId,
        "المعقب الأول",
        idempotentInput
      );
      entryIds.push(firstSave.id);
      const repeatedSave = await addAgentFinanceEntry(
        firstAgentId,
        "المعقب الأول",
        idempotentInput
      );
      const concurrentSaves = await Promise.all(
        Array.from({ length: 3 }, () =>
          addAgentFinanceEntry(firstAgentId, "المعقب الأول", idempotentInput)
        )
      );
      expect(firstSave).toEqual({ id: firstSave.id, duplicate: false });
      expect(repeatedSave).toEqual({ id: firstSave.id, duplicate: true });
      expect(concurrentSaves).toEqual(
        Array.from({ length: 3 }, () => ({ id: firstSave.id, duplicate: true }))
      );
      const idempotentRows = await db
        .select()
        .from(agentFinanceEntries)
        .where(
          and(
            eq(agentFinanceEntries.agentUserId, firstAgentId),
            eq(agentFinanceEntries.clientKey, idempotentInput.clientKey)
          )
        );
      expect(idempotentRows).toHaveLength(1);
      const idempotentAuditRows = (
        await db
          .select()
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.requestId, completedTwentieth),
              eq(auditLogs.action, "agent_finance_entry_created")
            )
          )
      ).filter(row => JSON.parse(row.afterJson || "{}").id === firstSave.id);
      expect(idempotentAuditRows).toHaveLength(1);

      await expect(
        addAgentFinanceEntry(firstAgentId, "المعقب الأول", {
          ...idempotentInput,
          amount: "1.01",
        })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        addAgentFinanceEntry(
          firstAgentId,
          "المعقب الأول",
          inputFor(activeOther, "collection", "1.00", "طلب وكيل آخر")
        )
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        addAgentFinanceEntry(
          firstAgentId,
          "المعقب الأول",
          inputFor(
            completedTenth,
            "collection",
            "1.00",
            "تاريخ مستقبلي",
            randomUUID(),
            Date.now() + 60_000
          )
        )
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        addAgentFinanceEntry(
          firstAgentId,
          "المعقب الأول",
          inputFor(completedTenth, "cost", "-1.00", "مبلغ سالب")
        )
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      expect(
        await voidAgentFinanceEntry(
          firstAgentId,
          "المعقب الأول",
          voidableCollection.id,
          "دفعة أضيفت بالخطأ"
        )
      ).toEqual({ success: true, alreadyVoided: false });
      const afterVoid = await getAgentFinance(firstAgentId);
      expect(afterVoid).toMatchObject({
        totalCollected: "11.10",
        totalCosts: "13.00",
        netProfit: "-1.90",
      });
      expect(afterVoid.entries.find(entry => entry.id === voidableCollection.id)).toMatchObject({
        id: voidableCollection.id,
        kind: "collection",
        amount: "0.20",
        voidReason: "دفعة أضيفت بالخطأ",
      });
      expect(
        afterVoid.entries.find(entry => entry.id === voidableCollection.id)?.voidedAt
      ).not.toBeNull();
      expect(
        await voidAgentFinanceEntry(
          firstAgentId,
          "المعقب الأول",
          voidableCollection.id,
          "إعادة الإلغاء بأمان"
        )
      ).toEqual({ success: true, alreadyVoided: true });
      await expect(
        voidAgentFinanceEntry(
          secondAgentId,
          "المعقب الثاني",
          voidableCollection.id,
          "محاولة وكيل آخر"
        )
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const voidAuditRows = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.requestId, completedTenth),
            eq(auditLogs.action, "agent_finance_entry_voided")
          )
        );
      expect(voidAuditRows).toHaveLength(1);

      const historicalEntry = await addForFirstAgent(
        reassignedLater,
        "collection",
        "2.00",
        "قيد يبقى في السجل بعد إعادة الإسناد"
      );
      await db
        .update(transactionRequests)
        .set({ assigneeId: secondAgentId })
        .where(eq(transactionRequests.id, reassignedLater));
      const historyAfterReassignment = await getAgentFinance(firstAgentId);
      expect(historyAfterReassignment.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: historicalEntry.id, requestId: reassignedLater }),
        ])
      );
      await expect(
        addAgentFinanceEntry(
          firstAgentId,
          "المعقب الأول",
          inputFor(reassignedLater, "collection", "1.00", "قيد بعد إعادة الإسناد")
        )
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      const concurrentNewInput = inputFor(activeOwned, "collection", "1.25", "تسجيل جديد متزامن");
      const concurrentNew = await Promise.all(Array.from({ length: 3 }, () =>
        addAgentFinanceEntry(firstAgentId, "المعقب الأول", concurrentNewInput)
      ));
      entryIds.push(concurrentNew[0].id);
      expect(new Set(concurrentNew.map(result => result.id)).size).toBe(1);
      expect(concurrentNew.filter(result => !result.duplicate)).toHaveLength(1);

      const [teamRows, customerRows] = await Promise.all([
        db
          .select({ id: teamNotifications.id })
          .from(teamNotifications)
          .where(inArray(teamNotifications.requestId, requestIds)),
        db
          .select({ id: customerNotifications.id })
          .from(customerNotifications)
          .where(inArray(customerNotifications.requestId, requestIds)),
      ]);
      expect(teamRows).toHaveLength(0);
      expect(customerRows).toHaveLength(0);
      expect(firstCollection.id).toBeGreaterThan(0);
    } finally {
      if (userIds.length) {
        await db
          .delete(agentFinanceEntries)
          .where(inArray(agentFinanceEntries.agentUserId, userIds));
      }
      if (requestIds.length) {
        await db
          .delete(auditLogs)
          .where(inArray(auditLogs.requestId, requestIds));
        await db
          .delete(transactionRequests)
          .where(inArray(transactionRequests.id, requestIds));
      }
      if (userIds.length) {
        await db.delete(users).where(inArray(users.id, userIds));
      }
    }
  }, 90_000);
});
