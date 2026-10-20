import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { staffAccounts, users } from "../drizzle/schema";
import { getDb, upsertUser } from "./db";

describe("عزل البريد الوصفي للمعقب عن هوية OAuth", () => {
  it("لا يغيّر دور أو ربط معقب عند دخول OAuth بنفس بريده ويبقي الموظف قابلًا للربط", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const suffix = randomUUID();
    const email = `qa-agent-oauth-${suffix}@example.invalid`;
    const employeeEmail = `qa-employee-oauth-${suffix}@example.invalid`;
    const insertedUsers: number[] = [];
    const insertedStaff: number[] = [];
    const oauthOpenId = `qa-oauth-${suffix}`;
    const employeeOpenId = `qa-employee-${suffix}`;
    try {
      const first = await db
        .insert(users)
        .values({
          openId: `qa-phone-${suffix}`,
          email,
          role: "agent",
          name: "QA Phone Agent",
          loginMethod: "phone_otp",
        });
      const agentId = Number(first[0].insertId);
      insertedUsers.push(agentId);
      const staff = await db
        .insert(staffAccounts)
        .values({
          userId: agentId,
          fullName: "QA Phone Agent",
          email,
          role: "agent",
          isActive: true,
        });
      insertedStaff.push(Number(staff[0].insertId));
      await upsertUser({
        openId: oauthOpenId,
        email,
        name: "QA OAuth Contact",
        loginMethod: "manus",
        role: "user",
      });
      const oauth = (
        await db
          .select()
          .from(users)
          .where(eq(users.openId, oauthOpenId))
          .limit(1)
      )[0];
      insertedUsers.push(oauth.id);
      expect(oauth.role).toBe("user");
      const remainingStaff = (
        await db
          .select()
          .from(staffAccounts)
          .where(eq(staffAccounts.id, insertedStaff[0]))
          .limit(1)
      )[0];
      expect(remainingStaff.userId).toBe(agentId);
      expect(
        (await db.select().from(users).where(eq(users.id, agentId)).limit(1))[0]
          .role
      ).toBe("agent");
      const employee = await db
        .insert(staffAccounts)
        .values({
          fullName: "QA Work Invite",
          email: employeeEmail,
          role: "employee",
          isActive: true,
        });
      const employeeStaffId = Number(employee[0].insertId);
      insertedStaff.push(employeeStaffId);
      await upsertUser({
        openId: employeeOpenId,
        email: employeeEmail,
        name: "QA Work Invite",
        loginMethod: "manus",
      });
      const employeeUser = (
        await db
          .select()
          .from(users)
          .where(eq(users.openId, employeeOpenId))
          .limit(1)
      )[0];
      insertedUsers.push(employeeUser.id);
      expect(employeeUser.role).toBe("employee");
      expect(
        (
          await db
            .select()
            .from(staffAccounts)
            .where(eq(staffAccounts.id, employeeStaffId))
            .limit(1)
        )[0].userId
      ).toBe(employeeUser.id);
    } finally {
      if (insertedStaff.length)
        await db
          .delete(staffAccounts)
          .where(inArray(staffAccounts.id, insertedStaff));
      // Unique test openIds are also included for cleanup if an assertion interrupted ID collection.
      await db
        .delete(users)
        .where(inArray(users.openId, [oauthOpenId, employeeOpenId]));
      if (insertedUsers.length)
        await db.delete(users).where(inArray(users.id, insertedUsers));
    }
  }, 60_000);
});
