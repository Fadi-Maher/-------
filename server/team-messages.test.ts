import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
const mocks = vi.hoisted(() => ({ inbox: vi.fn(), staff: vi.fn() }));
vi.mock("./teamMessages", () => ({ listTeamPrivateMessages: mocks.inbox }));
vi.mock("./db", async importOriginal => ({ ...await importOriginal<typeof import("./db")>(), getActiveStaffAccountForUser: mocks.staff }));
import { appRouter } from "./routers";
function context(role: "agent" | "user" | "admin" | null): TrpcContext {
  return { user: role ? { id: 77, role, openId: "test-inbox", name: "Test", email: null, loginMethod: "test", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } : null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}
beforeEach(() => { vi.clearAllMocks(); mocks.staff.mockResolvedValue({ permissions: { canViewAssigned: true } }); mocks.inbox.mockResolvedValue([]); });
describe("صلاحيات صندوق رسائل المعقب", () => {
  it.each([null, "user", "admin"] as const)("يرفض الدور %s ولا يستعلم الرسائل", async role => {
    await expect(appRouter.createCaller(context(role)).conversation.teamInbox()).rejects.toMatchObject({ code: role ? "FORBIDDEN" : "UNAUTHORIZED" });
    expect(mocks.inbox).not.toHaveBeenCalled();
  });
  it("يحصر الاستعلام بمعرف المعقب الحالي", async () => {
    await expect(appRouter.createCaller(context("agent")).conversation.teamInbox()).resolves.toEqual([]);
    expect(mocks.inbox).toHaveBeenCalledWith(77);
  });
  it("يرفض حساب معقب معطل أو دون صلاحية عرض", async () => {
    mocks.staff.mockResolvedValueOnce(null).mockResolvedValueOnce({ permissions: { canViewAssigned: false } });
    const caller = appRouter.createCaller(context("agent"));
    await expect(caller.conversation.teamInbox()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.conversation.teamInbox()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.inbox).not.toHaveBeenCalled();
  });
});
