import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { TrpcContext } from "./_core/context";
import { amountToHalalas, normalizeMoneyInput, summarizeFinanceEntries } from "../shared/finance";
const mocks = vi.hoisted(() => ({ staff: vi.fn(), mine: vi.fn(), completed: vi.fn(), add: vi.fn(), voidEntry: vi.fn() }));
vi.mock("./agentFinanceDb", () => ({ getAgentFinance: mocks.mine, listCompletedAgentRequests: mocks.completed, addAgentFinanceEntry: mocks.add, voidAgentFinanceEntry: mocks.voidEntry }));
vi.mock("./db", async importOriginal => ({ ...await importOriginal<typeof import("./db")>(), getActiveStaffAccountForUser: mocks.staff }));
import { appRouter } from "./routers";
function context(role: "agent" | "employee" | "user" | "admin" | null): TrpcContext {
  return { user: role ? { id: 71, role, openId: "finance-unit", name: "معقب", email: null, loginMethod: "test", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } : null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}
const input = () => ({ requestId: 99, kind: "collection" as const, amount: "5.50", occurredAt: Date.now() - 1000, clientKey: randomUUID() });
beforeEach(() => { vi.clearAllMocks(); mocks.staff.mockResolvedValue({ role: "agent", permissions: { canViewAssigned: true } }); mocks.mine.mockResolvedValue({ entries: [], requests: [], totalCollected: "0.00", totalCosts: "0.00", netProfit: "0.00" }); mocks.completed.mockResolvedValue({ items: [], totalAmount: "0.00" }); mocks.add.mockResolvedValue({ id: 1, duplicate: false }); mocks.voidEntry.mockResolvedValue({ success: true }); });
describe("دفتر المعقب المالي", () => {
  it("يجمع الدفعات بدقة ويحسب الخسارة ويستبعد الملغى", () => {
    expect(summarizeFinanceEntries([{ kind: "collection", amount: "0.10", voidedAt: null }, { kind: "collection", amount: "0.20", voidedAt: null }, { kind: "cost", amount: "1.00", voidedAt: null }, { kind: "collection", amount: "500.00", voidedAt: 1 }])).toEqual({ totalCollected: "0.30", totalCosts: "1.00", netProfit: "-0.70" });
    expect(summarizeFinanceEntries([])).toEqual({ totalCollected: "0.00", totalCosts: "0.00", netProfit: "0.00" });
  });
  it("يدعم الأرقام العربية والفارسية والفواصل العربية", () => {
    expect(normalizeMoneyInput("١٬٢٣٤٫٥٠")).toBe("1234.50");
    expect(amountToHalalas(normalizeMoneyInput("۱۲٫۳"))).toBe(BigInt(1230));
  });
  it.each([null, "user", "employee", "admin"] as const)("يمنع الدور %s من القراءة والتسجيل والإلغاء", async role => {
    const caller = appRouter.createCaller(context(role)).agentFinance;
    for (const call of [() => caller.mine(), () => caller.completed(), () => caller.addEntry(input()), () => caller.voidEntry({ entryId: 1, reason: "خطأ" })]) await expect(call()).rejects.toMatchObject({ code: role ? "FORBIDDEN" : "UNAUTHORIZED" });
    expect(mocks.mine).not.toHaveBeenCalled(); expect(mocks.add).not.toHaveBeenCalled(); expect(mocks.voidEntry).not.toHaveBeenCalled();
  });
  it.each([null, { role: "agent", permissions: { canViewAssigned: false } }, { role: "employee", permissions: { canViewAssigned: true } }])("يمنع الحساب غير الفعال أو غير المخول", async account => {
    mocks.staff.mockResolvedValue(account);
    const caller = appRouter.createCaller(context("agent")).agentFinance;
    await expect(caller.mine()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.addEntry(input())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.voidEntry({ entryId: 1, reason: "خطأ" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("يرسل هوية المعقب من الجلسة ويطبع المبلغ قبل الحفظ", async () => {
    const caller = appRouter.createCaller(context("agent")).agentFinance;
    await caller.mine(); await caller.completed();
    const payload = { ...input(), amount: "٥٫٥" };
    await caller.addEntry(payload);
    expect(mocks.mine).toHaveBeenCalledWith(71); expect(mocks.completed).toHaveBeenCalledWith(71);
    expect(mocks.add).toHaveBeenCalledWith(71, "معقب", { ...payload, amount: "5.50" });
    await caller.voidEntry({ entryId: 1, reason: "خطأ تسجيل" });
    expect(mocks.voidEntry).toHaveBeenCalledWith(71, "معقب", 1, "خطأ تسجيل");
  });
  it.each(["0", "-1", "1.234", "NaN", "Infinity", "1e3", "100000000.00", "١٫٢٫٣"])("يرفض مبلغًا غير صالح %s", async amount => {
    await expect(appRouter.createCaller(context("agent")).agentFinance.addEntry({ ...input(), amount })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.add).not.toHaveBeenCalled();
  });
  it("يرفض التاريخ المستقبلي والمفتاح غير الصالح وسبب الإلغاء الناقص", async () => {
    const caller = appRouter.createCaller(context("agent")).agentFinance;
    await expect(caller.addEntry({ ...input(), occurredAt: Date.now() + 60_000 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.addEntry({ ...input(), clientKey: "bad" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.voidEntry({ entryId: 1, reason: " " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
