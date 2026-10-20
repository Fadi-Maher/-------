import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  agentApplications,
  users,
} from "../drizzle/schema";
import {
  createApplicationNotifications,
  listAdminApplicationNotifications,
  markAdminApplicationNotificationRead,
  markAllAdminApplicationNotificationsRead,
} from "./adminApplicationNotifications";
import { getDb } from "./db";

describe("تكامل إشعارات طلبات الانضمام للإدارة", () => {
  it("يحسب الصفوف الدائمة ويعزل القراءة لكل مدير", async () => {
    const db = await getDb();
    expect(db).not.toBeNull();
    if (!db) return;

    const run = randomUUID().slice(0, 12);
    const digits = run.replace(/\D/g, "").padEnd(6, "7").slice(0, 6);
    const userIds: number[] = [];
    const applicationIds: number[] = [];

    try {
      const firstAdmin = await db.insert(users).values({
        openId: `admin-app-notice-a-${run}`,
        name: "مدير إشعارات أول",
        email: `notice-a-${run}@example.test`,
        loginMethod: "integration-test",
        role: "admin",
      });
      const firstAdminId = Number(firstAdmin[0].insertId);
      userIds.push(firstAdminId);

      const secondAdmin = await db.insert(users).values({
        openId: `admin-app-notice-b-${run}`,
        name: "مدير إشعارات ثان",
        email: `notice-b-${run}@example.test`,
        loginMethod: "integration-test",
        role: "admin",
      });
      const secondAdminId = Number(secondAdmin[0].insertId);
      userIds.push(secondAdminId);

      const createdAt = Date.now();
      const firstApplication = await db.insert(agentApplications).values({
        phone: `059${digits}1`,
        fullName: "متقدم اختبار الإشعارات الأول",
        email: `app-one-${run}@example.test`,
        city: "الرياض",
        specialty: "التعقيب",
        experienceYears: 3,
        consentedAt: createdAt,
        createdAt,
      });
      const firstApplicationId = Number(firstApplication[0].insertId);
      applicationIds.push(firstApplicationId);

      const secondApplication = await db.insert(agentApplications).values({
        phone: `059${digits}2`,
        fullName: "متقدم اختبار الإشعارات الثاني",
        email: `app-two-${run}@example.test`,
        city: "جدة",
        specialty: "الخدمات الحكومية",
        experienceYears: 4,
        consentedAt: createdAt + 1,
        createdAt: createdAt + 1,
      });
      const secondApplicationId = Number(secondApplication[0].insertId);
      applicationIds.push(secondApplicationId);

      await db.transaction(async tx => {
        await createApplicationNotifications(tx, firstApplicationId, createdAt);
        // Retrying after a successful insert must not inflate the unread count.
        await createApplicationNotifications(tx, firstApplicationId, createdAt + 10);
        await createApplicationNotifications(
          tx,
          secondApplicationId,
          createdAt + 1,
        );
      });

      const firstList = await listAdminApplicationNotifications(firstAdminId);
      const ownedUnread = (list: Awaited<ReturnType<typeof listAdminApplicationNotifications>>) => list.items.filter(item => applicationIds.includes(item.applicationId) && item.readAt === null).length;
      // Other parallel fixture applications legitimately notify these same
      // current admins. Assert this test's rows exactly without denying them.
      expect(ownedUnread(firstList)).toBe(2);
      expect(firstList.unreadCount).toBeGreaterThanOrEqual(2);
      expect(firstList.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            applicationId: firstApplicationId,
            reference: `JOIN-${firstApplicationId}`,
            readAt: null,
          }),
          expect.objectContaining({
            applicationId: secondApplicationId,
            reference: `JOIN-${secondApplicationId}`,
            readAt: null,
          }),
        ]),
      );

      const firstAdminFirstNotice = firstList.items.find(
        item => item.applicationId === firstApplicationId,
      );
      expect(firstAdminFirstNotice).toBeDefined();
      if (!firstAdminFirstNotice) return;

      // A different admin cannot change this recipient-scoped notification.
      await markAdminApplicationNotificationRead(
        firstAdminFirstNotice.id,
        secondAdminId,
        createdAt + 100,
      );
      expect(
        ownedUnread(await listAdminApplicationNotifications(firstAdminId)),
      ).toBe(2);

      await markAdminApplicationNotificationRead(
        firstAdminFirstNotice.id,
        firstAdminId,
        createdAt + 101,
      );
      const afterOneRead = await listAdminApplicationNotifications(firstAdminId);
      expect(ownedUnread(afterOneRead)).toBe(1);
      expect(
        afterOneRead.items.find(item => item.id === firstAdminFirstNotice.id)
          ?.readAt,
      ).toBe(createdAt + 101);

      await markAllAdminApplicationNotificationsRead(firstAdminId, createdAt + 102);
      expect(
        ownedUnread(await listAdminApplicationNotifications(firstAdminId)),
      ).toBe(0);
      expect(
        ownedUnread(await listAdminApplicationNotifications(secondAdminId)),
      ).toBe(2);
    } finally {
      if (applicationIds.length > 0) {
        await db
          .delete(agentApplications)
          .where(inArray(agentApplications.id, applicationIds));
      }
      if (userIds.length > 0) {
        await db.delete(users).where(inArray(users.id, userIds));
      }
    }
  }, 15_000);
});
