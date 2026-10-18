import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  auditLogs,
  customerNotifications,
  requestAttachments,
  requestUpdates,
  staffAccounts,
  teamNotifications,
  transactionRequests,
  users,
} from "../drizzle/schema";
import {
  createAssignedRequestUpdateWithAudit,
  createCustomerConversationAttachment,
  createCustomerRequestComment,
  createTeamConversationAttachment,
  getDb,
  listCustomerRequestConversation,
  listRequestUpdates,
} from "./db";
import { listTeamPrivateMessages } from "./teamMessages";

const completedConversationMessage = "أُغلقت المراسلة والتحديثات بعد اكتمال الطلب. السجل للقراءة فقط.";

async function expectCompletedConversationConflict(attempt: () => Promise<unknown>) {
  let error: unknown;
  try {
    await attempt();
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeInstanceOf(TRPCError);
  expect(error).toMatchObject({
    code: "CONFLICT",
    message: completedConversationMessage,
  });
}

describe("قفل محادثة الطلب بعد اكتماله", () => {
  it("يبقي المحادثة قابلة للقراءة ويمنع رسائل ومرفقات وتغييرات الحالة الجديدة", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database is not available");

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const phone = `059${String(Date.now()).slice(-7)}`;
    const reference = `CC-${suffix}`;
    let agentUserId: number | undefined;
    let requestId: number | undefined;

    const attachment = {
      fileName: `completion-${suffix}.pdf`,
      fileKey: `test/conversation-completion/${suffix}.pdf`,
      fileUrl: `https://example.invalid/conversation-completion/${suffix}.pdf`,
      mimeType: "application/pdf",
      size: 12,
    };

    try {
      const agentResult = await db.insert(users).values({
        openId: `conversation-completion-agent-${suffix}`,
        name: "معقب اختبار الإكمال",
        email: `conversation-completion-${suffix}@example.invalid`,
        loginMethod: "integration-test",
        role: "agent",
      });
      agentUserId = Number(agentResult[0].insertId);

      await db.insert(staffAccounts).values({
        userId: agentUserId,
        fullName: "معقب اختبار الإكمال",
        email: `conversation-completion-${suffix}@example.invalid`,
        role: "agent",
        permissionsJson: JSON.stringify({
          canViewAssigned: true,
          canUpdateStatus: true,
          canAddCustomerUpdate: true,
        }),
        isActive: true,
      });

      const requestResult = await db.insert(transactionRequests).values({
        reference,
        assigneeId: agentUserId,
        requesterName: "عميل اختبار الإكمال",
        phone,
        category: "طلب خدمة",
        subcategory: "استشارة أو طلب مخصص",
        details: "طلب مؤقت لاختبار قفل محادثة الطلب بعد اكتماله.",
        status: "in_progress",
        quoteSelectedAt: new Date(),
        providerAcceptedAt: new Date(),
      });
      requestId = Number(requestResult[0].insertId);

      const customerMessage = "هذه رسالة العميل قبل اكتمال الطلب.";
      const agentMessage = "هذه رسالة المعقب قبل اكتمال الطلب.";
      const completedMessage = "اكتمل تنفيذ الطلب وأصبح السجل للقراءة فقط.";

      await expect(createCustomerRequestComment({
        phone,
        requestId,
        message: customerMessage,
      })).resolves.toMatchObject({ updateId: expect.any(Number) });

      await expect(createAssignedRequestUpdateWithAudit({
        requestId,
        actorUserId: agentUserId,
        actorRole: "agent",
        actorName: "معقب اختبار الإكمال",
        message: agentMessage,
        action: "agent_customer_message",
        summary: "أرسل المعقب رسالة للعميل قبل الإكمال.",
      })).resolves.toMatchObject({ updateId: expect.any(Number) });

      await expect(createAssignedRequestUpdateWithAudit({
        requestId,
        actorUserId: agentUserId,
        actorRole: "agent",
        actorName: "معقب اختبار الإكمال",
        message: completedMessage,
        status: "completed",
        action: "agent_status_update",
        summary: "أكمل المعقب الطلب.",
      })).resolves.toMatchObject({ updateId: expect.any(Number) });

      const completedRequest = (await db.select({ status: transactionRequests.status })
        .from(transactionRequests)
        .where(eq(transactionRequests.id, requestId))
        .limit(1))[0];
      expect(completedRequest?.status).toBe("completed");

      await expectCompletedConversationConflict(() => createCustomerRequestComment({
        phone,
        requestId,
        message: "رسالة عميل مرفوضة بعد الإكمال.",
      }));
      await expectCompletedConversationConflict(() => createAssignedRequestUpdateWithAudit({
        requestId,
        actorUserId: agentUserId,
        actorRole: "agent",
        actorName: "معقب اختبار الإكمال",
        message: "رسالة معقب مرفوضة بعد الإكمال.",
        action: "agent_customer_message",
        summary: "محاولة رسالة بعد الإكمال.",
      }));
      await expectCompletedConversationConflict(() => createCustomerConversationAttachment({
        phone,
        requestId,
        attachment,
      }));
      await expectCompletedConversationConflict(() => createTeamConversationAttachment({
        requestId,
        actorUserId: agentUserId,
        actorRole: "agent",
        actorName: "معقب اختبار الإكمال",
        attachment,
      }));
      await expectCompletedConversationConflict(() => createAssignedRequestUpdateWithAudit({
        requestId,
        actorUserId: agentUserId,
        actorRole: "agent",
        actorName: "معقب اختبار الإكمال",
        message: "محاولة إعادة الطلب إلى قيد التنفيذ.",
        status: "in_progress",
        action: "agent_status_update",
        summary: "محاولة تغيير الحالة بعد الإكمال.",
      }));

      const customerConversation = await listCustomerRequestConversation(phone, requestId);
      const teamConversation = await listRequestUpdates(requestId);
      expect(customerConversation).not.toBeNull();
      expect(customerConversation).toHaveLength(3);
      expect(customerConversation?.map((update) => update.message)).toEqual(expect.arrayContaining([
        customerMessage,
        agentMessage,
        completedMessage,
      ]));
      expect(teamConversation.map((update) => update.message)).toEqual(expect.arrayContaining([
        customerMessage,
        agentMessage,
        completedMessage,
      ]));
      expect(teamConversation.flatMap((update) => update.attachments)).toHaveLength(0);
      const inbox = await listTeamPrivateMessages(agentUserId);
      expect(inbox.filter(item => item.requestId === requestId)).toHaveLength(3);
      expect(inbox.every(item => item.requestStatus === "completed")).toBe(true);
      expect(inbox[0]).not.toHaveProperty("phone");
      expect(inbox[0]).not.toHaveProperty("email");
      expect(await listTeamPrivateMessages(-1)).toHaveLength(0);
    } finally {
      if (requestId) {
        const updateRows = await db.select({ id: requestUpdates.id })
          .from(requestUpdates)
          .where(eq(requestUpdates.requestId, requestId));
        const updateIds = updateRows.map((update) => update.id);

        if (updateIds.length) {
          await db.delete(requestAttachments).where(inArray(requestAttachments.updateId, updateIds));
        }
        await db.delete(customerNotifications).where(eq(customerNotifications.requestId, requestId));
        await db.delete(teamNotifications).where(eq(teamNotifications.requestId, requestId));
        await db.delete(auditLogs).where(eq(auditLogs.requestId, requestId));
        await db.delete(requestUpdates).where(eq(requestUpdates.requestId, requestId));
        await db.delete(transactionRequests).where(eq(transactionRequests.id, requestId));
      }
      if (agentUserId) {
        await db.delete(staffAccounts).where(eq(staffAccounts.userId, agentUserId));
        await db.delete(users).where(eq(users.id, agentUserId));
      }
    }
  }, 30_000);
});
