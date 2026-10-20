import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock("./adminApplicationNotifications", () => ({
  listAdminApplicationNotifications: mocks.list,
  markAdminApplicationNotificationRead: mocks.markRead,
  markAllAdminApplicationNotificationsRead: mocks.markAllRead,
  subscribeToApplicationNotificationSignals: mocks.subscribe,
}));

import { adminApplicationNotificationsRouter } from "./adminApplicationNotificationsRouter";

function context(role: "admin" | "agent" | "employee" | "user" | null): TrpcContext {
  return {
    user: role
      ? {
          id: 77,
          role,
          openId: `admin-application-notice-${role}`,
          name: "مستخدم اختبار",
          email: "unit@example.test",
          loginMethod: "test",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const items = [
  {
    id: 302,
    applicationId: 41,
    reference: "JOIN-41",
    createdAt: 1_710_000_000_000,
    readAt: null as number | null,
  },
  {
    id: 301,
    applicationId: 40,
    reference: "JOIN-40",
    createdAt: 1_709_000_000_000,
    readAt: null as number | null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  items.forEach(item => {
    item.readAt = null;
  });
  mocks.list.mockImplementation(async () => ({
    items: items.map(item => ({ ...item })),
    unreadCount: items.filter(item => item.readAt === null).length,
  }));
  mocks.markRead.mockImplementation(async (notificationId: number, userId: number) => {
    if (userId !== 77) return;
    const item = items.find(candidate => candidate.id === notificationId);
    if (item && item.readAt === null) item.readAt = 1_711_000_000_000;
  });
  mocks.markAllRead.mockImplementation(async (userId: number) => {
    if (userId !== 77) return;
    items.forEach(item => {
      if (item.readAt === null) item.readAt = 1_711_000_000_000;
    });
  });
  mocks.subscribe.mockImplementation(async function* () {
    yield { type: "application_created" as const };
  });
});

describe("adminApplicationNotifications router", () => {
  it.each([null, "user", "agent", "employee"] as const)(
    "يرفض %s القائمة والقراءة والبث قبل لمس طبقة البيانات",
    async role => {
      const caller = adminApplicationNotificationsRouter.createCaller(context(role));
      const expectedCode = role ? "FORBIDDEN" : "UNAUTHORIZED";

      await expect(caller.list()).rejects.toMatchObject({ code: expectedCode });
      await expect(
        caller.markRead({ notificationId: 302 }),
      ).rejects.toMatchObject({ code: expectedCode });
      await expect(caller.markAllRead()).rejects.toMatchObject({
        code: expectedCode,
      });
      expect(mocks.list).not.toHaveBeenCalled();
      expect(mocks.markRead).not.toHaveBeenCalled();
      expect(mocks.markAllRead).not.toHaveBeenCalled();
    },
  );

  it("يعيد عداد قاعدة البيانات ويعلّم إشعارات المدير نفسه فقط ثم يقرأ الكل", async () => {
    const caller = adminApplicationNotificationsRouter.createCaller(context("admin"));

    await expect(caller.list()).resolves.toEqual({ items, unreadCount: 2 });

    await expect(caller.markRead({ notificationId: 302 })).resolves.toEqual({
      success: true,
    });
    expect(mocks.markRead).toHaveBeenCalledWith(302, 77);
    const afterSingleRead = await caller.list();
    expect(afterSingleRead.unreadCount).toBe(1);
    expect(afterSingleRead.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 302, readAt: 1_711_000_000_000 }),
      ]),
    );

    await expect(caller.markAllRead()).resolves.toEqual({ success: true });
    expect(mocks.markAllRead).toHaveBeenCalledWith(77);
    await expect(caller.list()).resolves.toMatchObject({ unreadCount: 0 });
  });

  it("يبث إشارة إبطال فقط بلا بيانات طلب أو مقدم طلب", async () => {
    const caller = adminApplicationNotificationsRouter.createCaller(context("admin"));
    const stream = await caller.onNew();
    const first = await stream.next();

    expect(first).toEqual({ done: false, value: { type: "application_created" } });
    expect(first.value).not.toHaveProperty("applicationId");
    expect(first.value).not.toHaveProperty("fullName");
  });
});
