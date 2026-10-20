import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  adminApplicationNotifications,
  agentApplicationDocuments,
  agentApplications,
  auditLogs,
  customers,
  phoneProfiles,
  staffAccounts,
  users,
} from "../drizzle/schema";
import { AGENT_DOCUMENT_DRAFT_TTL_MS } from "../shared/agentDocuments";
import { CURRENT_TERMS_VERSION } from "../shared/legal";
import {
  listAdminApplicationNotifications,
  markAdminApplicationNotificationRead,
} from "./adminApplicationNotifications";
import {
  reviewAgentApplication,
  submitAgentApplication,
} from "./agentApplicationsDb";
import { getDb } from "./db";
import { getPhoneProfile, savePhoneProfile } from "./phoneProfileDb";

const permissions = {
  canViewAssigned: true,
  canUpdateStatus: false,
  canAddCustomerUpdate: true,
};

const fixture = {
  applicationIds: new Set<number>(),
  documentIds: new Set<string>(),
  notificationIds: new Set<number>(),
  userIds: new Set<number>(),
  staffIds: new Set<number>(),
  phones: new Set<string>(),
};

function qaRun() {
  return randomUUID().replaceAll("-", "");
}

function qaPhone() {
  let phone = "";
  do {
    const digits = (parseInt(qaRun().slice(0, 8), 16) % 100_000_000)
      .toString()
      .padStart(8, "0");
    phone = `05${digits}`;
  } while (fixture.phones.has(phone));
  fixture.phones.add(phone);
  return phone;
}

function qaOpenId(run: string, label: string) {
  return `qa-join-stage-${run}-${label}`.slice(0, 64);
}

function applicationInput(run: string, label: string) {
  return {
    fullName: `معقب اختبار ${label}`,
    email: `${label}-${run}@example.invalid`,
    city: "الرياض",
    specialty: "الخدمات الحكومية",
    experienceYears: 4,
    notes: "fixture تكامل وصفي فقط",
  };
}

function mobileOpenId(phone: string) {
  return `agent_mobile_${createHash("sha256").update(phone).digest("hex").slice(0, 48)}`;
}

async function createUser(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  run: string,
  label: string,
  role: "admin" | "agent",
) {
  const inserted = await db.insert(users).values({
    openId: qaOpenId(run, label),
    name: `مستخدم اختبار ${label}`,
    email: `${label}-${run}@example.invalid`,
    loginMethod: "integration-test",
    role,
  });
  const id = Number(inserted[0].insertId);
  fixture.userIds.add(id);
  return id;
}

/**
 * This is metadata-only setup: storageKey is deliberately a sentinel rather than
 * an object upload. No byte column exists in this schema and this suite never
 * calls upload/download/storage APIs.
 */
async function createDraft(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  phone: string,
  options: Partial<{
    id: string;
    kind: "national_id" | "work_license";
    storageKey: string;
    createdAt: number;
  }> = {},
) {
  const id = options.id ?? randomUUID();
  fixture.documentIds.add(id);
  await db.insert(agentApplicationDocuments).values({
    id,
    phone,
    applicationId: null,
    kind: options.kind ?? "national_id",
    fileName: "qa-identity.pdf",
    mimeType: "application/pdf",
    size: 321,
    storageKey: options.storageKey ?? "test-ciphertext-never-uploaded",
    createdAt: options.createdAt ?? Date.now() - 60_000,
  });
  return id;
}

async function notificationRowsFor(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  applicationId: number,
) {
  const rows = await db
    .select({
      id: adminApplicationNotifications.id,
      recipientUserId: adminApplicationNotifications.recipientUserId,
      applicationId: adminApplicationNotifications.applicationId,
      readAt: adminApplicationNotifications.readAt,
      role: users.role,
    })
    .from(adminApplicationNotifications)
    .innerJoin(users, eq(adminApplicationNotifications.recipientUserId, users.id))
    .where(eq(adminApplicationNotifications.applicationId, applicationId));
  rows.forEach(row => fixture.notificationIds.add(row.id));
  return rows;
}

async function expectNoApplicationOrNotification(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  phone: string,
) {
  const apps = await db.select().from(agentApplications).where(eq(agentApplications.phone, phone));
  expect(apps).toEqual([]);
  const notices = await db
    .select({ id: adminApplicationNotifications.id })
    .from(adminApplicationNotifications)
    .innerJoin(agentApplications, eq(adminApplicationNotifications.applicationId, agentApplications.id))
    .where(eq(agentApplications.phone, phone));
  expect(notices).toEqual([]);
}

async function cleanupTracked(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
) {
  const applicationIds = [...fixture.applicationIds];
  const documentIds = [...fixture.documentIds];
  const userIds = [...fixture.userIds];
  const staffIds = [...fixture.staffIds];
  const phones = [...fixture.phones];

  // Remove only audit rows explicitly attributable to our application IDs.
  if (userIds.length) {
    const rows = await db
      .select({ id: auditLogs.id, beforeJson: auditLogs.beforeJson, afterJson: auditLogs.afterJson })
      .from(auditLogs)
      .where(inArray(auditLogs.actorUserId, userIds));
    const auditIds = rows
      .filter(row => {
        try {
          const before = JSON.parse(row.beforeJson || "{}");
          const after = JSON.parse(row.afterJson || "{}");
          return applicationIds.includes(before.applicationId) || applicationIds.includes(after.applicationId);
        } catch {
          return false;
        }
      })
      .map(row => row.id);
    if (auditIds.length) await db.delete(auditLogs).where(inArray(auditLogs.id, auditIds));
  }

  // Notifications and unlinked documents are explicitly removed before their
  // parents; this keeps cleanup independent of cascade behavior.
  if (applicationIds.length) {
    await db
      .delete(adminApplicationNotifications)
      .where(inArray(adminApplicationNotifications.applicationId, applicationIds));
  }
  if (fixture.notificationIds.size) {
    await db
      .delete(adminApplicationNotifications)
      .where(inArray(adminApplicationNotifications.id, [...fixture.notificationIds]));
  }
  if (documentIds.length) {
    await db.delete(agentApplicationDocuments).where(inArray(agentApplicationDocuments.id, documentIds));
  }
  if (applicationIds.length) {
    await db.delete(agentApplications).where(inArray(agentApplications.id, applicationIds));
  }

  // Neither customer nor staged-phone data has a phone FK, so clean both exact
  // fixture phone values on every finally and once more in afterAll.
  if (phones.length) {
    await db.delete(customers).where(inArray(customers.phone, phones));
    await db.delete(phoneProfiles).where(inArray(phoneProfiles.phone, phones));
  }
  if (staffIds.length) await db.delete(staffAccounts).where(inArray(staffAccounts.id, staffIds));
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
}

describe("تكامل وثائق وإشعارات طلب انضمام المعقب", () => {
  it("يربط مسودة metadata حديثة، وينشئ إشعارًا دائمًا للمديرين فقط بلا تكرار", async () => {
    const db = await getDb();
    expect(db).not.toBeNull();
    if (!db) return;

    const run = qaRun();
    const phone = qaPhone();
    try {
      const ownerOneId = await createUser(db, run, "owner-one", "admin");
      const ownerTwoId = await createUser(db, run, "owner-two", "admin");
      const agentId = await createUser(db, run, "excluded-agent", "agent");
      const documentId = await createDraft(db, phone);

      const application = await submitAgentApplication(phone, applicationInput(run, "new"), [documentId]);
      fixture.applicationIds.add(application.id);
      expect(application).toMatchObject({ phone, status: "pending", email: `new-${run}@example.invalid` });

      const linked = (await db
        .select()
        .from(agentApplicationDocuments)
        .where(eq(agentApplicationDocuments.id, documentId)))[0];
      expect(linked).toMatchObject({
        id: documentId,
        phone,
        applicationId: application.id,
        storageKey: "test-ciphertext-never-uploaded",
      });
      expect(Date.now() - Number(linked.createdAt)).toBeLessThanOrEqual(AGENT_DOCUMENT_DRAFT_TTL_MS);

      const createdNotices = await notificationRowsFor(db, application.id);
      expect(createdNotices.every(row => row.role === "admin")).toBe(true);
      expect(createdNotices.filter(row => row.recipientUserId === ownerOneId)).toHaveLength(1);
      expect(createdNotices.filter(row => row.recipientUserId === ownerTwoId)).toHaveLength(1);
      expect(createdNotices.some(row => row.recipientUserId === agentId)).toBe(false);

      const ownerOneList = await listAdminApplicationNotifications(ownerOneId);
      const ownerTwoList = await listAdminApplicationNotifications(ownerTwoId);
      const ownerOneNotice = ownerOneList.items.find(item => item.applicationId === application.id);
      const ownerTwoNotice = ownerTwoList.items.find(item => item.applicationId === application.id);
      expect(ownerOneNotice).toBeDefined();
      expect(ownerTwoNotice).toBeDefined();
      if (!ownerOneNotice || !ownerTwoNotice) return;
      expect(ownerTwoList.items.some(item => item.id === ownerOneNotice.id)).toBe(false);

      await markAdminApplicationNotificationRead(ownerOneNotice.id, ownerTwoId, 1_700_000_000_001);
      expect((await notificationRowsFor(db, application.id)).find(row => row.id === ownerOneNotice.id)?.readAt).toBeNull();
      await markAdminApplicationNotificationRead(ownerOneNotice.id, ownerOneId, 1_700_000_000_002);
      expect((await notificationRowsFor(db, application.id)).find(row => row.id === ownerOneNotice.id)?.readAt).toBe(1_700_000_000_002);

      const retry = await submitAgentApplication(phone, applicationInput(run, "changed-retry"), [documentId]);
      expect(retry.id).toBe(application.id);
      const afterRetry = await notificationRowsFor(db, application.id);
      expect(afterRetry).toHaveLength(createdNotices.length);
      expect(afterRetry.find(row => row.id === ownerOneNotice.id)?.readAt).toBe(1_700_000_000_002);
    } finally {
      await cleanupTracked(db);
    }
  }, 30_000);

  it("يرفض metadata الأجنبية والمنتهية والمحذوفة ومكررة النوع ويرجع المعاملة كاملة", async () => {
    const db = await getDb();
    expect(db).not.toBeNull();
    if (!db) return;

    const run = qaRun();
    const phone = qaPhone();
    const foreignPhone = qaPhone();
    try {
      const mutableDocumentId = await createDraft(db, foreignPhone);
      await expect(submitAgentApplication(phone, applicationInput(run, "foreign"), [mutableDocumentId]))
        .rejects.toMatchObject({ code: "NOT_FOUND" });
      await expectNoApplicationOrNotification(db, phone);

      await db.update(agentApplicationDocuments).set({
        phone,
        createdAt: Date.now() - AGENT_DOCUMENT_DRAFT_TTL_MS - 1,
      }).where(eq(agentApplicationDocuments.id, mutableDocumentId));
      await expect(submitAgentApplication(phone, applicationInput(run, "expired"), [mutableDocumentId]))
        .rejects.toMatchObject({ code: "CONFLICT" });
      await expectNoApplicationOrNotification(db, phone);

      await db.update(agentApplicationDocuments).set({ storageKey: "" })
        .where(eq(agentApplicationDocuments.id, mutableDocumentId));
      await expect(submitAgentApplication(phone, applicationInput(run, "removed"), [mutableDocumentId]))
        .rejects.toMatchObject({ code: "NOT_FOUND" });
      await expectNoApplicationOrNotification(db, phone);

      await db.update(agentApplicationDocuments).set({
        storageKey: "test-ciphertext-never-uploaded",
        createdAt: Date.now() - 60_000,
      }).where(eq(agentApplicationDocuments.id, mutableDocumentId));
      const sameKindId = await createDraft(db, phone, { kind: "national_id" });
      await expect(submitAgentApplication(phone, applicationInput(run, "duplicate-kind"), [mutableDocumentId, sameKindId]))
        .rejects.toMatchObject({ code: "CONFLICT" });
      await expectNoApplicationOrNotification(db, phone);
      const drafts = await db.select().from(agentApplicationDocuments)
        .where(inArray(agentApplicationDocuments.id, [mutableDocumentId, sameKindId]));
      expect(drafts.every(document => document.applicationId === null)).toBe(true);
    } finally {
      await cleanupTracked(db);
    }
  }, 30_000);

  it("لا يرفق مسودات جديدة بعد الرفض أو الموافقة ولا يوفر مستخدمًا قبل الموافقة", async () => {
    const db = await getDb();
    expect(db).not.toBeNull();
    if (!db) return;

    const run = qaRun();
    const rejectedPhone = qaPhone();
    const approvedPhone = qaPhone();
    try {
      const reviewerId = await createUser(db, run, "reviewer", "admin");
      const rejected = await submitAgentApplication(rejectedPhone, applicationInput(run, "rejected"));
      fixture.applicationIds.add(rejected.id);
      expect(await db.select().from(users).where(eq(users.openId, mobileOpenId(rejectedPhone)))).toEqual([]);
      await reviewAgentApplication({
        id: rejected.id,
        decision: "rejected",
        reviewNote: "سبب اختبار الرفض",
        permissions,
        actorUserId: reviewerId,
      });
      const rejectedDraft = await createDraft(db, rejectedPhone);
      await expect(submitAgentApplication(rejectedPhone, applicationInput(run, "rejected-retry"), [rejectedDraft]))
        .rejects.toMatchObject({ code: "CONFLICT" });
      expect((await db.select().from(agentApplicationDocuments).where(eq(agentApplicationDocuments.id, rejectedDraft)))[0]?.applicationId).toBeNull();
      expect(await db.select().from(users).where(eq(users.openId, mobileOpenId(rejectedPhone)))).toEqual([]);

      const approved = await submitAgentApplication(approvedPhone, applicationInput(run, "approved"));
      fixture.applicationIds.add(approved.id);
      expect(await db.select().from(users).where(eq(users.openId, mobileOpenId(approvedPhone)))).toEqual([]);
      const reviewed = await reviewAgentApplication({
        id: approved.id,
        decision: "approved",
        reviewNote: "موافقة اختبار",
        permissions,
        actorUserId: reviewerId,
      });
      expect(reviewed.activatedStaffAccountId).not.toBeNull();
      if (reviewed.activatedStaffAccountId !== null) fixture.staffIds.add(reviewed.activatedStaffAccountId);
      const provisionedUser = (await db.select().from(users).where(eq(users.openId, mobileOpenId(approvedPhone))))[0];
      expect(provisionedUser?.role).toBe("agent");
      if (provisionedUser) fixture.userIds.add(provisionedUser.id);

      const approvedDraft = await createDraft(db, approvedPhone, { kind: "work_license" });
      const noticesBeforeRetry = await notificationRowsFor(db, approved.id);
      await expect(submitAgentApplication(approvedPhone, applicationInput(run, "approved-retry"), [approvedDraft]))
        .rejects.toMatchObject({ code: "CONFLICT" });
      expect((await db.select().from(agentApplicationDocuments).where(eq(agentApplicationDocuments.id, approvedDraft)))[0]?.applicationId).toBeNull();
      expect(await notificationRowsFor(db, approved.id)).toHaveLength(noticesBeforeRetry.length);
    } finally {
      await cleanupTracked(db);
    }
  }, 30_000);

  it("يخزن ملف agent غير النشط كـ staging فقط قبل الإرسال بلا staff أو user", async () => {
    const db = await getDb();
    expect(db).not.toBeNull();
    if (!db) return;

    const run = qaRun();
    const phone = qaPhone();
    const profile = { fullName: "معقب مسودة غير نشط", email: `staged-agent-${run}@example.invalid` };
    try {
      await expect(savePhoneProfile(phone, { role: "agent", ...profile })).resolves.toMatchObject({
        profile,
        customer: null,
        hasActiveAgent: false,
      });
      expect(await db.select().from(staffAccounts).where(eq(staffAccounts.phone, phone))).toEqual([]);
      expect(await db.select().from(users).where(eq(users.openId, mobileOpenId(phone)))).toEqual([]);
      expect(await getPhoneProfile(phone, "agent")).toMatchObject({ profile, hasActiveAgent: false });

      const application = await submitAgentApplication(phone, {
        ...applicationInput(run, "staged-agent"),
        ...profile,
      });
      fixture.applicationIds.add(application.id);
      expect(await db.select().from(staffAccounts).where(eq(staffAccounts.phone, phone))).toEqual([]);
      expect(await db.select().from(users).where(eq(users.openId, mobileOpenId(phone)))).toEqual([]);
    } finally {
      await cleanupTracked(db);
    }
  }, 30_000);

  it("يفرض الشروط للعميل الجديد ويحافظ على prefill وتحديث العميل القائم بأمان", async () => {
    const db = await getDb();
    expect(db).not.toBeNull();
    if (!db) return;

    const run = qaRun();
    const phone = qaPhone();
    try {
      await expect(savePhoneProfile(phone, {
        role: "customer",
        fullName: "عميل بلا شروط",
        email: `customer-no-terms-${run}@example.invalid`,
      })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(await getPhoneProfile(phone, "customer")).toEqual({
        profile: null,
        isNewCustomer: true,
        hasActiveAgent: false,
      });

      const initial = { fullName: "عميل شروط جديد", email: `customer-${run}@example.invalid` };
      const saved = await savePhoneProfile(phone, { role: "customer", ...initial, acceptedTerms: true });
      expect(saved).toMatchObject({ profile: initial, hasActiveAgent: false });
      const customer = (await db.select().from(customers).where(eq(customers.phone, phone)))[0];
      expect(customer).toMatchObject({ ...initial, phone, termsVersion: CURRENT_TERMS_VERSION });
      expect(customer?.termsAcceptedAt).not.toBeNull();

      const updated = { fullName: "عميل محدث بأمان", email: `customer-updated-${run}@example.invalid` };
      await expect(savePhoneProfile(phone, { role: "customer", ...updated, acceptedTerms: false }))
        .resolves.toMatchObject({ profile: updated, customer: expect.objectContaining(updated) });
      expect(await getPhoneProfile(phone, "customer")).toEqual({
        profile: updated,
        isNewCustomer: false,
        hasActiveAgent: false,
      });
    } finally {
      await cleanupTracked(db);
    }
  }, 30_000);
});

afterAll(async () => {
  const db = await getDb();
  if (db) await cleanupTracked(db);
});
