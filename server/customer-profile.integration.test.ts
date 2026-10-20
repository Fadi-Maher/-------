import { and, eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditLogs, customers, phoneProfiles } from "../drizzle/schema";
import { getCustomerProfileByPhone, updateCustomerProfileByPhone } from "./customerProfileDb";
import { getDb } from "./db";

// Uses an isolated, randomly generated number and removes every row it creates.
const PHONE = `0590${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
let customerId = 0;
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("customer self-service profile (database)", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database is not available");
    const existing = await db.select({ id: customers.id }).from(customers).where(eq(customers.phone, PHONE)).limit(1);
    if (existing.length) throw new Error("Random test phone collided with a real customer; rerun the test.");
    const created = await db.insert(customers).values({ phone: PHONE, fullName: "عميل اختبار مؤقت", email: "old@example.com" });
    customerId = Number((created as any)[0].insertId);
    await db.insert(phoneProfiles).values({ phone: PHONE, role: "customer", fullName: "عميل اختبار مؤقت", email: "old@example.com", updatedAt: Date.now() });
  }, 20_000);

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    if (customerId) {
      await db.delete(auditLogs).where(and(eq(auditLogs.action, "customer.profile_updated"), like(auditLogs.beforeJson, `{"customerId":${customerId},%`)));
      await db.delete(customers).where(eq(customers.id, customerId));
    }
    await db.delete(phoneProfiles).where(eq(phoneProfiles.phone, PHONE));
  }, 20_000);

  it("reads the profile for the verified phone", async () => {
    await expect(getCustomerProfileByPhone(PHONE)).resolves.toMatchObject({ fullName: "عميل اختبار مؤقت", email: "old@example.com", phone: PHONE });
  }, 20_000);

  it("updates the customer, keeps the staged profile in step and audits only the changed field names", async () => {
    const result = await updateCustomerProfileByPhone(PHONE, { fullName: "عميل اختبار معدل", email: "" });
    expect(result).toMatchObject({ changed: true, changedFields: ["fullName", "email"], profile: { fullName: "عميل اختبار معدل", email: null } });
    const db = (await getDb())!;
    const [row] = await db.select().from(customers).where(eq(customers.id, customerId));
    expect(row).toMatchObject({ fullName: "عميل اختبار معدل", email: null, phone: PHONE });
    const [staged] = await db.select().from(phoneProfiles).where(and(eq(phoneProfiles.phone, PHONE), eq(phoneProfiles.role, "customer")));
    expect(staged).toMatchObject({ fullName: "عميل اختبار معدل", email: "" });
    // A cleared email must not come back from the staged profile.
    await expect(getCustomerProfileByPhone(PHONE)).resolves.toMatchObject({ email: null });
    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.action, "customer.profile_updated"), like(auditLogs.beforeJson, `{"customerId":${customerId},%`)));
    expect(logs).toHaveLength(1);
    expect(logs[0]?.actorRole).toBe("customer");
    expect(`${logs[0]?.beforeJson}${logs[0]?.afterJson}`).not.toContain("old@example.com");
  }, 20_000);

  it("does nothing when the values are unchanged", async () => {
    const result = await updateCustomerProfileByPhone(PHONE, { fullName: "  عميل   اختبار معدل ", email: null });
    expect(result.changed).toBe(false);
    const db = (await getDb())!;
    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.action, "customer.profile_updated"), like(auditLogs.beforeJson, `{"customerId":${customerId},%`)));
    expect(logs).toHaveLength(1);
  }, 20_000);

  it("refuses a phone that has no customer account", async () => {
    const db = (await getDb())!;
    let missing = "";
    for (let attempt = 0; attempt < 5 && !missing; attempt += 1) {
      const candidate = `0591${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
      const found = await db.select({ id: customers.id }).from(customers).where(eq(customers.phone, candidate)).limit(1);
      if (!found.length) missing = candidate;
    }
    expect(missing).not.toBe("");
    await expect(updateCustomerProfileByPhone(missing, { fullName: "غير موجود", email: null })).rejects.toMatchObject({ code: "NOT_FOUND" });
  }, 20_000);
});
