// @vitest-environment jsdom
import React, { createElement as h } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const mocks = vi.hoisted(() => ({ query: {} as any, add: vi.fn(), voidEntry: vi.fn() }));
vi.mock("./lib/trpc", () => ({ trpc: { agentFinance: { mine: { useQuery: () => mocks.query }, addEntry: { useMutation: () => ({ isPending: false, mutateAsync: mocks.add }) }, voidEntry: { useMutation: () => ({ isPending: false, mutateAsync: mocks.voidEntry }) } }, useUtils: () => ({ agentFinance: { mine: { invalidate: vi.fn() } } }) } }));
import { AgentFinancePanel } from "./components/AgentFinancePanel";
const entry = (id: number, date: number, kind: "collection" | "cost", amount: string, note: string, requestId = 7, voidedAt: number | null = null) => ({ id, requestId, reference: `REQ-${requestId}`, category: "خدمة", kind, amount, note, occurredAt: date, createdAt: new Date(2026, 8, 1).getTime(), voidedAt, voidReason: voidedAt === null ? null : "اختبار إلغاء" });
beforeAll(() => vi.stubGlobal("React", React));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.query = { isLoading: false, isError: false, refetch: vi.fn(), data: { totalCollected: "ignore-server-summary", totalCosts: "ignore-server-summary", netProfit: "ignore-server-summary", requests: [{ requestId: 7, reference: "REQ-7", category: "خدمة", status: "completed", priceAmount: "900.00" }, { requestId: 8, reference: "REQ-8", category: "أخرى", status: "in_progress", priceAmount: null }], entries: [entry(1, new Date(2026, 0, 1).getTime(), "collection", "100.10", "January collection"), entry(2, new Date(2026, 0, 31, 23, 59, 59, 999).getTime(), "cost", "20.20", "January last millisecond"), entry(3, new Date(2026, 1, 1, 23, 59, 59, 999).getTime(), "collection", "50.00", "February last millisecond"), entry(4, new Date(2025, 11, 31).getTime(), "collection", "9.90", "Previous year"), entry(5, new Date(2026, 0, 15).getTime(), "collection", "999.00", "Voided January", 7, Date.now()), entry(6, new Date(2026, 0, 5).getTime(), "collection", "300.00", "Other request January", 8)] } };
});
afterEach(cleanup);
async function applyJanuary(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "By month", exact: true }));
  fireEvent.change(screen.getByLabelText("Select month"), { target: { value: "2026-01" } });
  await user.click(screen.getByRole("button", { name: "Apply filter" }));
}
describe("الفترة المالية في سجل المعقب", () => {
  it("filters request entries and exact totals together, leaves voided history visible and resets without mutating", async () => {
    const user = userEvent.setup();
    render(h(AgentFinancePanel, { isEnglish: true, requestId: 7 }));
    expect(screen.getByText("139.80 SAR")).toBeTruthy();
    await applyJanuary(user);
    expect(screen.getByText("Net profit in period")).toBeTruthy();
    expect(screen.getByText("79.90 SAR")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("January 2026");
    await user.click(screen.getByRole("button", { name: "Open ledger" }));
    expect(screen.getByText("January collection")).toBeTruthy();
    expect(screen.getByText("January last millisecond")).toBeTruthy();
    expect(screen.getByText("Voided January")).toBeTruthy();
    expect(screen.queryByText("February last millisecond")).toBeNull();
    expect(screen.queryByText("Previous year")).toBeNull();
    expect(screen.queryByText("Other request January")).toBeNull();
    fireEvent.change(screen.getByLabelText("Amount (SAR)"), { target: { value: "12.34" } });
    await user.click(screen.getByRole("button", { name: "Reset filter" }));
    expect(screen.getByText("139.80 SAR")).toBeTruthy();
    expect(screen.getByText("Previous year")).toBeTruthy();
    expect((screen.getByLabelText("Amount (SAR)") as HTMLInputElement).value).toBe("12.34");
    expect(mocks.add).not.toHaveBeenCalled(); expect(mocks.voidEntry).not.toHaveBeenCalled();
  });
  it("calculates monthly totals across all of this agent's requests, not the selected entry request", async () => {
    const user = userEvent.setup();
    render(h(AgentFinancePanel, { isEnglish: true }));
    await applyJanuary(user);
    expect(screen.getByText("379.90 SAR")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Open ledger" }));
    expect(screen.getByText("Other request January")).toBeTruthy();
  });
  it("includes the last millisecond of both range dates, based on occurredAt rather than createdAt", async () => {
    const user = userEvent.setup();
    render(h(AgentFinancePanel, { isEnglish: true, requestId: 7 }));
    await user.click(screen.getByRole("button", { name: "Date range" }));
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-01-31" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-02-01" } });
    expect(screen.getByText("139.80 SAR")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Apply filter" }));
    expect(screen.getByText("29.80 SAR")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Open ledger" }));
    expect(screen.getByText("January last millisecond")).toBeTruthy();
    expect(screen.getByText("February last millisecond")).toBeTruthy();
    expect(screen.queryByText("January collection")).toBeNull();
  });
  it("keeps the applied period after an invalid or incomplete range and shows zero/empty for a valid empty period", async () => {
    const user = userEvent.setup();
    render(h(AgentFinancePanel, { isEnglish: true, requestId: 7 }));
    await applyJanuary(user);
    await user.click(screen.getByRole("button", { name: "Date range" }));
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-02-02" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-01-01" } });
    await user.click(screen.getByRole("button", { name: "Apply filter" }));
    expect(screen.getByRole("alert").textContent).toContain("start date must not be after");
    expect(screen.getByText("79.90 SAR")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: "Apply filter" }));
    expect(screen.getByRole("alert").textContent).toContain("valid start and end dates");
    expect(screen.getByText("79.90 SAR")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "By month" }));
    fireEvent.change(screen.getByLabelText("Select month"), { target: { value: "2026-04" } });
    await user.click(screen.getByRole("button", { name: "Apply filter" }));
    expect(screen.getAllByText("0.00 SAR")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Open ledger" }));
    expect(screen.getByText("No entries in this period.")).toBeTruthy();
  });
  it("keeps Arabic RTL labels and Gregorian period captions with filtering available while the ledger is collapsed", async () => {
    const user = userEvent.setup();
    const { container } = render(h(AgentFinancePanel, { isEnglish: false, requestId: 7 }));
    expect(container.querySelector("section")?.getAttribute("dir")).toBe("rtl");
    await user.click(screen.getByRole("button", { name: "حسب الشهر" }));
    fireEvent.change(screen.getByLabelText("اختر الشهر"), { target: { value: "2026-01" } });
    await user.click(screen.getByRole("button", { name: "تطبيق التصفية" }));
    expect(screen.getByText("صافي الربح في الفترة")).toBeTruthy();
    expect(screen.getByText("79.90 SAR")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("٢٠٢٦");
    expect(screen.queryByLabelText("المبلغ (ر.س)")).toBeNull();
  });
});
