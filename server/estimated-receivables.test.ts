import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import {
  quoteAmountInHalalas,
  summarizeEstimatedReceivables,
} from "../shared/estimatedReceivables";
const mocks = vi.hoisted(() => ({ list: vi.fn(), staff: vi.fn() }));
vi.mock("./estimatedReceivables", () => ({
  listEstimatedReceivables: mocks.list,
}));
vi.mock("./db", async importOriginal => ({
  ...(await importOriginal<typeof import("./db")>()),
  getActiveStaffAccountForUser: mocks.staff,
}));
import { appRouter } from "./routers";
function context(
  role: "agent" | "employee" | "user" | "admin" | null
): TrpcContext {
  return {
    user: role
      ? {
          id: 77,
          role,
          openId: "test-estimate",
          name: "Test",
          email: null,
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
beforeEach(() => {
  vi.clearAllMocks();
  mocks.staff.mockResolvedValue({ permissions: { canViewAssigned: true } });
  mocks.list.mockResolvedValue(summarizeEstimatedReceivables([]));
});
describe("المستحقات التقديرية فقط", () => {
  it("يجمع 0.10 و0.20 بدقة ولا يعد قيمة مفقودة مبلغًا صفرًا", () => {
    expect(
      summarizeEstimatedReceivables([
        { priceAmount: "0.10" },
        { priceAmount: "0.20" },
        { priceAmount: null },
      ])
    ).toEqual({
      totalAmount: "0.30",
      completedRequestCount: 3,
      pricedRequestCount: 2,
      unpricedRequestCount: 1,
      items: [
        { priceAmount: "0.10" },
        { priceAmount: "0.20" },
        { priceAmount: null },
      ],
    });
  });
  it("يجمع مبالغ كبيرة بدقة ويعالج القائمة الفارغة", () => {
    expect(
      summarizeEstimatedReceivables(
        Array.from({ length: 1000 }, () => ({ priceAmount: "99999999.99" }))
      ).totalAmount
    ).toBe("99999999990.00");
    expect(summarizeEstimatedReceivables([])).toMatchObject({
      totalAmount: "0.00",
      completedRequestCount: 0,
      unpricedRequestCount: 0,
    });
  });
  it.each([
    null,
    undefined,
    "",
    "0.00",
    "-1",
    "NaN",
    "Infinity",
    "2.345",
    "1e3",
  ])("يرفض القيمة غير القابلة للحساب %s", amount =>
    expect(quoteAmountInHalalas(amount)).toBeNull()
  );
  it.each([null, "user", "admin", "employee"] as const)(
    "يرفض الدور %s ولا يستعلم المستحقات",
    async role => {
      await expect(
        appRouter.createCaller(context(role)).estimatedReceivables.mine()
      ).rejects.toMatchObject({ code: role ? "FORBIDDEN" : "UNAUTHORIZED" });
      expect(mocks.list).not.toHaveBeenCalled();
    }
  );
  it("يحصر الاستعلام بالمعقب الحالي دون مدخل userId يختاره العميل", async () => {
    await expect(
      appRouter.createCaller(context("agent")).estimatedReceivables.mine()
    ).resolves.toMatchObject({ totalAmount: "0.00" });
    expect(mocks.list).toHaveBeenCalledWith(77);
  });
  it("يرفض المعطل ومن لا يملك صلاحية العرض", async () => {
    mocks.staff
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ permissions: { canViewAssigned: false } });
    const caller = appRouter.createCaller(context("agent"));
    await expect(caller.estimatedReceivables.mine()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller.estimatedReceivables.mine()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
