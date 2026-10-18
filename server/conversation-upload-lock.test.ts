import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
const mocks = vi.hoisted(() => ({ storage: vi.fn(), request: vi.fn(), staff: vi.fn(), conversation: vi.fn(), assigned: vi.fn() }));
vi.mock("./storage", () => ({ storagePut: mocks.storage }));
vi.mock("./db", async importOriginal => ({ ...await importOriginal<typeof import("./db")>(), getTransactionRequestById: mocks.request, getActiveStaffAccountForUser: mocks.staff, listCustomerRequestConversation: mocks.conversation, isRequestAssignedToUser: mocks.assigned }));
import { ENV } from "./_core/env";
import { appRouter } from "./routers";
const ctx: TrpcContext = { user: { id: 1, openId: "upload-lock-unit", role: "agent", name: "Test", email: null, loginMethod: "test", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
const attachment = { requestId: 99, fileName: "test.pdf", mimeType: "application/pdf", dataBase64: Buffer.from("test only").toString("base64") };
beforeEach(() => { vi.clearAllMocks(); mocks.request.mockResolvedValue({ id: 99, assigneeId: 1, providerAcceptedAt: new Date(), status: "completed" }); mocks.staff.mockResolvedValue({ permissions: { canViewAssigned: true, canAddCustomerUpdate: true } }); mocks.conversation.mockResolvedValue([]); mocks.assigned.mockResolvedValue(true); });
describe("إغلاق مرفقات الطلب المكتمل", () => {
  it("يرفض رفع المعقب قبل استدعاء التخزين", async () => {
    await expect(appRouter.createCaller(ctx).conversation.teamUpload(attachment)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.storage).not.toHaveBeenCalled();
  });
  it("يرفض رفع العميل قبل استدعاء التخزين", async () => {
    const payload = `0500000000.${Math.floor(Date.now() / 1000) + 1000}`;
    const token = `${Buffer.from(payload).toString("base64url")}.${createHmac("sha256", ENV.cookieSecret).update(payload).digest("base64url")}`;
    await expect(appRouter.createCaller({ ...ctx, user: null }).conversation.customerUpload({ ...attachment, accessToken: token })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.storage).not.toHaveBeenCalled();
  });
  it("يرفض قراءة سجل الفريق المعطل أو بلا صلاحية", async () => {
    mocks.staff.mockResolvedValueOnce(null).mockResolvedValueOnce({ permissions: { canViewAssigned: false } });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.conversation.teamList({ requestId: 99 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.conversation.teamList({ requestId: 99 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
