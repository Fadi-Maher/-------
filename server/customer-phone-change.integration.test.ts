import { and, eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  agentApplications,
  auditLogs,
  customerNotifications,
  customerPhoneReleases,
  customers,
  phoneProfiles,
  staffAccounts,
  transactionRequests,
} from "../drizzle/schema";
import { assertPhoneAccessCurrent, changeCustomerPhone, clearPhoneReleaseCache, getPhoneReleasedAt } from "./customerPhoneChangeDb";
import { getDb } from "./db";

// Isolated, randomly generated numbers; every row the test creates is removed afterwards.
const randomPhone = () => `0591${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
const OLD = randomPhone();
let NEW = randomPhone();
let TAKEN = randomPhone();
while (NEW === OLD) NEW = randomPhone();
while (TAKEN === OLD || TAKEN === NEW) TAKEN = randomPhone();
const PHONES = [OLD, NEW, TAKEN];
const REFERENCE = `QA-PC-${Date.now().toString(36).toUpperCase()}`;
let customerId = 0;
let requestId = 0;
const hasDb = Boolean(process.env.DATABASE_URL);

async function phoneInUse(phone: string) {
  const db = (await getDb())!;
  const checks = await Promise.all([
    db.select({ id: customers.id }).from(customers).where(eq(customers.phone, phone)).limit(1),
    db.select({ id: phoneProfiles.id }).from(phoneProfiles).where(eq(phoneProfiles.phone, phone)).limit(1),
    db.select({ id: staffAccounts.id }).from(staffAccounts).where(eq(staffAccounts.phone, phone)).limit(1),
    db.select({ id: agentApplications.id }).from(agentApplications).where(eq(agentApplications.phone, phone)).limit(1),
    db.select({ id: transactionRequests.id }).from(transactionRequests).where(eq(transactionRequests.phone, phone)).limit(1),
    db.select({ id: customerNotifications.id }).from(customerNotifications).where(eq(customerNotifications.phone, phone)).limit(1),
    db.select({ phone: customerPhoneReleases.phone }).from(customerPhoneReleases).where(eq(customerPhoneReleases.phone, phone)).limit(1),
  ]);
  return checks.some(rows => rows.length > 0);
}

describe.skipIf(!hasDb)("customer phone change (database)", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database is not available");
    for (const phone of PHONES) {
      if (await phoneInUse(phone)) throw new Error("Random test phone collided with real data; rerun the test.");
    }
    const created = await db.insert(customers).values({ phone: OLD, fullName: "عميل اختبار تغيير الرقم", email: null });
    customerId = Number((created as any)[0].insertId);
    await db.insert(phoneProfiles).values({ phone: OLD, role: "customer", fullName: "عميل اختبار تغيير الرقم", email: "", updatedAt: Date.now() });
    const request = await db.insert(transactionRequests).values({
      reference: REFERENCE,
      customerId,
      requesterName: "عميل اختبار تغيير الرقم",
      phone: OLD,
      category: "طلب خدمة",
      details: "طلب اختبار مؤقت لتغيير رقم الجوال.",
    });
    requestId = Number((request as any)[0].insertId);
    await db.insert(customerNotifications).values({ phone: OLD, requestId, type: "request_update", title: "اختبار", message: "إشعار اختبار مؤقت" });
    // Someone else's staged profile on TAKEN: the customer must never be merged into it.
    await db.insert(phoneProfiles).values({ phone: TAKEN, role: "customer", fullName: "مستخدم آخر مؤقت", email: "", updatedAt: Date.now() });
    clearPhoneReleaseCache();
  }, 30_000);

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    if (customerId) {
      await db.delete(auditLogs).where(and(eq(auditLogs.action, "customer.phone_changed"), like(auditLogs.beforeJson, `{"customerId":${customerId},%`)));
    }
    await db.delete(customerNotifications).where(inArray(customerNotifications.phone, PHONES));
    await db.delete(transactionRequests).where(eq(transactionRequests.reference, REFERENCE));
    await db.delete(customerPhoneReleases).where(inArray(customerPhoneReleases.phone, PHONES));
    await db.delete(phoneProfiles).where(inArray(phoneProfiles.phone, PHONES));
    if (customerId) await db.delete(customers).where(eq(customers.id, customerId));
    clearPhoneReleaseCache();
  }, 30_000);

  it("refuses a number that is already linked to someone and changes nothing", async () => {
    await expect(changeCustomerPhone(OLD, TAKEN, "en")).rejects.toMatchObject({ code: "CONFLICT" });
    const db = (await getDb())!;
    const [row] = await db.select({ phone: customers.phone }).from(customers).where(eq(customers.id, customerId));
    expect(row?.phone).toBe(OLD);
    const [request] = await db.select({ phone: transactionRequests.phone }).from(transactionRequests).where(eq(transactionRequests.id, requestId));
    expect(request?.phone).toBe(OLD);
    await expect(getPhoneReleasedAt(OLD)).resolves.toBeNull();
  }, 30_000);

  it("moves the account, its requests and notifications, then cuts off sessions for the old number", async () => {
    const issuedBefore = Date.now() - 60_000;
    const result = await changeCustomerPhone(OLD, NEW, "ar");
    expect(result).toMatchObject({ previousPhone: OLD, movedRequests: 1, movedNotifications: 1, profile: { phone: NEW, fullName: "عميل اختبار تغيير الرقم" } });

    const db = (await getDb())!;
    const [row] = await db.select({ phone: customers.phone }).from(customers).where(eq(customers.id, customerId));
    expect(row?.phone).toBe(NEW);
    const [request] = await db.select({ phone: transactionRequests.phone }).from(transactionRequests).where(eq(transactionRequests.id, requestId));
    expect(request?.phone).toBe(NEW);
    const notifications = await db.select({ phone: customerNotifications.phone }).from(customerNotifications).where(eq(customerNotifications.requestId, requestId));
    expect(notifications.map(item => item.phone)).toEqual([NEW]);
    const staged = await db.select({ phone: phoneProfiles.phone }).from(phoneProfiles).where(inArray(phoneProfiles.phone, [OLD, NEW]));
    expect(staged.map(item => item.phone)).toEqual([NEW]);

    // Old-number sessions from before the change stop working; the new number and later sign-ins are unaffected.
    clearPhoneReleaseCache();
    const releasedAt = await getPhoneReleasedAt(OLD);
    expect(releasedAt).toBeGreaterThanOrEqual(issuedBefore);
    await expect(assertPhoneAccessCurrent(OLD, issuedBefore)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(assertPhoneAccessCurrent(OLD, Number(releasedAt) + 1_000)).resolves.toBeUndefined();
    await expect(assertPhoneAccessCurrent(NEW, issuedBefore)).resolves.toBeUndefined();

    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, "customer.phone_changed"), like(auditLogs.beforeJson, `{"customerId":${customerId},%`)));
    expect(logs).toHaveLength(1);
    expect(logs[0]?.actorRole).toBe("customer");
    const logged = `${logs[0]?.summary}${logs[0]?.beforeJson}${logs[0]?.afterJson}`;
    expect(logged).not.toContain(OLD);
    expect(logged).not.toContain(NEW);
    expect(logged).toContain(OLD.slice(-4));
  }, 30_000);

  it("refuses to move an account that no longer has the old number", async () => {
    await expect(changeCustomerPhone(OLD, randomPhone(), "en")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(changeCustomerPhone(NEW, NEW, "en")).rejects.toMatchObject({ code: "BAD_REQUEST" });
  }, 30_000);
});
