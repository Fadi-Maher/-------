import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  agentApplications,
  auditLogs,
  staffAccounts,
  teamNotifications,
  users,
} from "../drizzle/schema";
import {
  getAgentApplicationStatus,
  reviewAgentApplication,
  submitAgentApplication,
} from "./agentApplicationsDb";
import { getActiveAgentAccountByPhone, getDb } from "./db";
import { buildNotificationContent } from "./notificationTemplateStore";

const permissions = {
  canViewAssigned: true,
  canUpdateStatus: false,
  canAddCustomerUpdate: true,
};

function testPhone(seed: string, offset: number) {
  const digits = (parseInt(seed.slice(offset, offset + 8), 16) % 100_000_000).toString().padStart(8, "0");
  return `05${digits}`;
}

function applicationInput(email: string) {
  return {
    fullName: "معقب تكامل مؤقت",
    email,
    city: "الرياض",
    specialty: "خدمات حكومية",
    experienceYears: 5,
    notes: "طلب اختبار معزول",
  };
}

describe("تكامل طلبات انضمام المعقبين", () => {
  it("يعزل الطلبات، يمنع التكرار، ويربط موافقة المدير بحساب معقب صالح", async () => {
    const db = await getDb();
    expect(db).not.toBeNull();
    if (!db) return;

    const run = randomUUID().replaceAll("-", "");
    const applicationIds: number[] = [];
    const staffIds: number[] = [];
    const userIds: number[] = [];
    let reviewerId = 0;

    try {
      const reviewer = await db.insert(users).values({
        openId: `application-reviewer-${run}`.slice(0, 64),
        name: "مدير اختبار طلبات",
        email: `reviewer-${run}@example.test`,
        loginMethod: "integration-test",
        role: "admin",
      });
      reviewerId = Number(reviewer[0].insertId);
      userIds.push(reviewerId);

      const rejectedPhone = testPhone(run, 0);
      const rejected = await submitAgentApplication(rejectedPhone, applicationInput(`rejected-${run}@example.test`));
      applicationIds.push(rejected.id);
      expect(await getAgentApplicationStatus(rejectedPhone)).toMatchObject({
        hasActiveAgent: false,
        application: { id: rejected.id, reference: `JOIN-${rejected.id}`, status: "pending" },
        decisionNotice: null,
      });
      const rejectedReview = await reviewAgentApplication({
        id: rejected.id,
        decision: "rejected",
        reviewNote: "لا تتوفر الخبرة المطلوبة حاليًا",
        permissions,
        actorUserId: reviewerId,
      });
      expect(rejectedReview).toMatchObject({ status: "rejected", activatedStaffAccountId: null });
      const rejectedStatus = await getAgentApplicationStatus(rejectedPhone);
      expect(rejectedStatus).toMatchObject({
        hasActiveAgent: false,
        application: { status: "rejected", reviewNote: "لا تتوفر الخبرة المطلوبة حاليًا" },
      });
      // The applicant sees the owner's editable rejection template on sign-in.
      const expectedRejection = await buildNotificationContent(db, "team.agent_application_rejected", {
        name: "معقب تكامل مؤقت",
        reference: `JOIN-${rejected.id}`,
        note: "لا تتوفر الخبرة المطلوبة حاليًا",
      });
      expect(rejectedStatus.decisionNotice).toEqual({ status: "rejected", ...expectedRejection });
      expect(rejectedStatus.decisionNotice?.type).toBe("agent_application_rejected");
      expect(await getActiveAgentAccountByPhone(rejectedPhone)).toBeNull();

      const approvedPhone = testPhone(run, 8);
      const sharedEmail = `shared-oauth-${run}@example.test`;
      // This simulates an unrelated OAuth administrator with the applicant's email.
      // Provisioning must never match it or mutate its role.
      const oauthAdmin = await db.insert(users).values({
        openId: `oauth-existing-${run}`.slice(0, 64),
        name: "مدير OAuth مستقل",
        email: sharedEmail,
        loginMethod: "manus",
        role: "admin",
      });
      const oauthAdminId = Number(oauthAdmin[0].insertId);
      userIds.push(oauthAdminId);

      const concurrentSubmissions = await Promise.all(Array.from({ length: 4 }, () =>
        submitAgentApplication(approvedPhone, applicationInput(sharedEmail))
      ));
      expect(new Set(concurrentSubmissions.map(row => row.id)).size).toBe(1);
      const pendingId = concurrentSubmissions[0].id;
      applicationIds.push(pendingId);
      const pendingRows = await db.select().from(agentApplications).where(eq(agentApplications.phone, approvedPhone));
      expect(pendingRows).toHaveLength(1);
      expect(pendingRows[0]).toMatchObject({ status: "pending", email: sharedEmail });

      const concurrentReviews = await Promise.all(Array.from({ length: 3 }, () =>
        reviewAgentApplication({
          id: pendingId,
          decision: "approved",
          reviewNote: "تمت المراجعة",
          permissions,
          actorUserId: reviewerId,
        })
      ));
      expect(concurrentReviews.every(row => row.status === "approved")).toBe(true);
      const approved = concurrentReviews[0];
      expect(approved.activatedStaffAccountId).not.toBeNull();
      if (approved.activatedStaffAccountId !== null) staffIds.push(approved.activatedStaffAccountId);

      const accounts = await db.select().from(staffAccounts).where(eq(staffAccounts.phone, approvedPhone));
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toMatchObject({
        id: approved.activatedStaffAccountId,
        role: "agent",
        isActive: true,
        permissionsJson: JSON.stringify(permissions),
      });
      expect(JSON.parse(accounts[0].permissionsJson || "{}")).toEqual(permissions);
      expect(accounts[0].userId).not.toBeNull();
      if (accounts[0].userId !== null) userIds.push(accounts[0].userId);

      const activeAgent = await getActiveAgentAccountByPhone(approvedPhone);
      expect(activeAgent).toMatchObject({
        id: accounts[0].id,
        role: "agent",
        isActive: true,
        permissions,
        user: { role: "agent" },
      });
      const expectedOpenId = `agent_mobile_${createHash("sha256").update(approvedPhone).digest("hex").slice(0, 48)}`;
      expect(activeAgent?.user.openId).toBe(expectedOpenId);

      const unchangedOauthAdmin = (await db.select().from(users).where(eq(users.id, oauthAdminId)).limit(1))[0];
      expect(unchangedOauthAdmin).toMatchObject({
        openId: `oauth-existing-${run}`.slice(0, 64),
        role: "admin",
        loginMethod: "manus",
      });
      expect(await getAgentApplicationStatus(approvedPhone)).toMatchObject({
        hasActiveAgent: true,
        application: { id: pendingId, status: "approved" },
        decisionNotice: { status: "approved", type: "agent_application_approved" },
      });

      // Exactly one workspace notice for the new agent, even with concurrent approvals.
      const agentUserId = accounts[0].userId ?? 0;
      const approvalNotices = await db.select().from(teamNotifications).where(and(
        eq(teamNotifications.recipientUserId, agentUserId),
        eq(teamNotifications.type, "agent_application_approved"),
      ));
      expect(approvalNotices).toHaveLength(1);
      const expectedApproval = await buildNotificationContent(db, "team.agent_application_approved", {
        name: "معقب تكامل مؤقت",
        reference: `JOIN-${pendingId}`,
        note: "تمت المراجعة",
      });
      expect(approvalNotices[0]).toMatchObject({
        requestId: null,
        isRead: false,
        title: expectedApproval.title,
        message: expectedApproval.message,
        titleEn: expectedApproval.titleEn,
        messageEn: expectedApproval.messageEn,
      });
      // The notice never exposes the applicant's mobile number.
      expect(`${approvalNotices[0].message} ${approvalNotices[0].messageEn}`).not.toContain(approvedPhone);

      const auditRows = await db.select().from(auditLogs).where(and(
        eq(auditLogs.actorUserId, reviewerId),
        inArray(auditLogs.action, ["agent_application_approved", "agent_application_rejected"]),
      ));
      const ownAudits = auditRows.filter(row => {
        try {
          const after = JSON.parse(row.afterJson || "{}");
          return applicationIds.includes(after.applicationId);
        } catch {
          return false;
        }
      });
      expect(ownAudits.map(row => row.action).sort()).toEqual([
        "agent_application_approved",
        "agent_application_rejected",
      ]);
      expect(ownAudits.every(row => !row.afterJson?.includes(sharedEmail) && !row.beforeJson?.includes(approvedPhone))).toBe(true);
    } finally {
      // Select audit rows by this run's reviewer and application IDs, then remove
      // only those exact IDs. No broad email/phone/action cleanup is used.
      if (reviewerId && applicationIds.length) {
        const auditRows = await db.select({ id: auditLogs.id, afterJson: auditLogs.afterJson })
          .from(auditLogs)
          .where(and(
            eq(auditLogs.actorUserId, reviewerId),
            inArray(auditLogs.action, ["agent_application_approved", "agent_application_rejected"]),
          ));
        const auditIds = auditRows.filter(row => {
          try { return applicationIds.includes(JSON.parse(row.afterJson || "{}").applicationId); } catch { return false; }
        }).map(row => row.id);
        if (applicationIds.length) await db.delete(agentApplications).where(inArray(agentApplications.id, applicationIds));
        if (auditIds.length) await db.delete(auditLogs).where(inArray(auditLogs.id, auditIds));
      }
      if (staffIds.length) await db.delete(staffAccounts).where(inArray(staffAccounts.id, staffIds));
      if (userIds.length) await db.delete(users).where(inArray(users.id, [...new Set(userIds)]));
    }
  }, 90_000);
});
