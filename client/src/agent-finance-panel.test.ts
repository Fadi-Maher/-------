// @vitest-environment jsdom
import React, { createElement as h } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  query: {} as any,
  add: { isPending: false, mutateAsync: vi.fn() },
  void: { isPending: false, mutateAsync: vi.fn() },
  invalidate: vi.fn(),
  uuid: vi.fn(),
}));

vi.mock("./lib/trpc", () => ({
  trpc: {
    agentFinance: {
      mine: { useQuery: () => mocks.query },
      addEntry: { useMutation: () => mocks.add },
      voidEntry: { useMutation: () => mocks.void },
    },
    useUtils: () => ({ agentFinance: { mine: { invalidate: mocks.invalidate } } }),
  },
}));

import { AgentFinancePanel, entryFingerprint, validateLedgerAmount, validateOccurredAt } from "./components/AgentFinancePanel";

const financeData = {
  totalCollected: "999.00",
  totalCosts: "333.00",
  netProfit: "666.00",
  requests: [
    { requestId: 7, reference: "REQ-7", category: "خدمة", status: "completed", priceAmount: "900.00" },
    { requestId: 8, reference: "REQ-8", category: "خدمة أخرى", status: "in_progress", priceAmount: null },
  ],
  entries: [
    { id: 10, requestId: 7, reference: "REQ-7", category: "خدمة", kind: "collection" as const, amount: "120.25", note: "تحصيل سابق", occurredAt: Date.UTC(2026, 0, 4), createdAt: Date.UTC(2026, 0, 4), voidedAt: null, voidReason: null },
    { id: 11, requestId: 7, reference: "REQ-7", category: "خدمة", kind: "cost" as const, amount: "20.00", note: null, occurredAt: Date.UTC(2026, 0, 3), createdAt: Date.UTC(2026, 0, 3), voidedAt: null, voidReason: null },
    { id: 12, requestId: 8, reference: "REQ-8", category: "خدمة أخرى", kind: "collection" as const, amount: "878.75", note: null, occurredAt: Date.UTC(2026, 0, 2), createdAt: Date.UTC(2026, 0, 2), voidedAt: null, voidReason: null },
  ],
};

const firstPayloadKey = "00000000-0000-4000-8000-000000000001";
const changedPayloadKey = "00000000-0000-4000-8000-000000000002";

beforeAll(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("crypto", { randomUUID: mocks.uuid });
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.uuid.mockReset();
  mocks.add.mutateAsync.mockReset();
  mocks.void.mutateAsync.mockReset();
  mocks.uuid
    .mockReturnValueOnce(firstPayloadKey)
    .mockReturnValueOnce(changedPayloadKey)
    .mockReturnValue("00000000-0000-4000-8000-000000000003");
  mocks.query = { data: financeData, isLoading: false, isError: false, refetch: vi.fn() };
  mocks.add.isPending = false;
  mocks.void.isPending = false;
  mocks.add.mutateAsync.mockResolvedValue({ id: 77, duplicate: false });
  mocks.void.mutateAsync.mockResolvedValue({ success: true });
});
afterEach(cleanup);

async function openScopedLedger(user: ReturnType<typeof userEvent.setup>) {
  render(h(AgentFinancePanel, { isEnglish: true, requestId: 7 }));
  await user.click(screen.getByRole("button", { name: "Open ledger" }));
  const amount = screen.getByLabelText("Amount (SAR)") as HTMLInputElement;
  fireEvent.change(amount, { target: { value: "١٢٫٣٤" } });
  return amount;
}

describe("AgentFinancePanel UI", () => {
  it("uses exact normalized money validation and rejects future dates", () => {
    expect(validateLedgerAmount("١٢٫٣٤")).toEqual({ amount: "12.34", error: null });
    expect(validateLedgerAmount("0").error).toBe("range");
    expect(validateLedgerAmount("99999999.999").error).toBe("format");
    expect(validateLedgerAmount("100000000").error).toBe("range");
    expect(validateOccurredAt("2099-01-01T10:00", Date.UTC(2026, 0, 1)).error).toBe("future");
    expect(entryFingerprint({ requestId: 7, kind: "collection", amount: "12.34", occurredAt: 10, note: " note " })).toBe(entryFingerprint({ requestId: 7, kind: "collection", amount: "12.34", occurredAt: 10, note: " note " }));
  });

  it("shows request-scoped cash totals and keeps the ledger form collapsed by default", async () => {
    const user = userEvent.setup();
    render(h(AgentFinancePanel, { isEnglish: false, requestId: 7 }));
    expect(screen.getByText("صافي الربح حسب القيود")).toBeTruthy();
    expect(screen.getByText("100.25 SAR")).toBeTruthy();
    expect(screen.getByText(/قيم العروض تقديرات وليست تحصيلًا تلقائيًا/)).toBeTruthy();
    expect(screen.queryByLabelText("المبلغ (ر.س)")).toBeNull();
    await user.click(screen.getByRole("button", { name: "فتح السجل" }));
    expect(screen.getByLabelText("المبلغ (ر.س)")).toBeTruthy();
    expect(screen.getByText(/قيمة العرض · تقدير فقط/)).toBeTruthy();
  });

  it("does not expose entry fields after a query error", () => {
    mocks.query = { data: undefined, isLoading: false, isError: true, refetch: vi.fn() };
    render(h(AgentFinancePanel, { isEnglish: true }));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Open ledger" })).toBeNull();
  });

  it("normalizes Arabic digits and retains the exact payload key when retrying unchanged values", async () => {
    const user = userEvent.setup();
    mocks.add.mutateAsync.mockRejectedValueOnce(new Error("temporary failure")).mockResolvedValueOnce({ id: 77, duplicate: false });
    const amount = await openScopedLedger(user);
    const addButton = screen.getByRole("button", { name: "Add entry" }) as HTMLButtonElement;
    await user.click(addButton);
    await waitFor(() => expect(mocks.add.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.add.mutateAsync.mock.calls[0][0]).toMatchObject({ requestId: 7, kind: "collection", amount: "12.34", clientKey: firstPayloadKey });
    expect(amount.value).toBe("١٢٫٣٤");
    await waitFor(() => expect(addButton.disabled).toBe(false));

    await user.click(addButton);
    await waitFor(() => expect(mocks.add.mutateAsync).toHaveBeenCalledTimes(2));
    expect(mocks.add.mutateAsync.mock.calls[1][0]).toEqual(mocks.add.mutateAsync.mock.calls[0][0]);
    expect(mocks.invalidate).toHaveBeenCalledOnce();
  });

  it("creates a new key when a payload changes after a failed save", async () => {
    const user = userEvent.setup();
    mocks.add.mutateAsync.mockRejectedValueOnce(new Error("temporary failure")).mockResolvedValueOnce({ id: 78, duplicate: false });
    const amount = await openScopedLedger(user);
    const addButton = screen.getByRole("button", { name: "Add entry" }) as HTMLButtonElement;
    await user.click(addButton);
    await waitFor(() => expect(mocks.add.mutateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(addButton.disabled).toBe(false));
    fireEvent.change(amount, { target: { value: "١٣٫٣٤" } });
    await user.click(addButton);
    await waitFor(() => expect(mocks.add.mutateAsync).toHaveBeenCalledTimes(2));
    expect(mocks.add.mutateAsync.mock.calls[0][0].clientKey).toBe(firstPayloadKey);
    expect(mocks.add.mutateAsync.mock.calls[1][0]).toMatchObject({ amount: "13.34", clientKey: changedPayloadKey });
  });

  it("synchronously blocks a second click and disables every mutable ledger field while saving", async () => {
    const user = userEvent.setup();
    let finish: (value: { id: number; duplicate: boolean }) => void = () => undefined;
    mocks.add.mutateAsync.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const amount = await openScopedLedger(user);
    const addButton = screen.getByRole("button", { name: "Add entry" }) as HTMLButtonElement;
    await user.click(addButton);
    await waitFor(() => expect(mocks.add.mutateAsync).toHaveBeenCalledOnce());
    expect(addButton.disabled).toBe(true);
    expect(amount.disabled).toBe(true);
    expect((screen.getByLabelText("Date and time") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Note (optional)") as HTMLTextAreaElement).disabled).toBe(true);
    await user.click(addButton);
    expect(mocks.add.mutateAsync).toHaveBeenCalledOnce();
    finish({ id: 79, duplicate: false });
    await waitFor(() => expect(mocks.invalidate).toHaveBeenCalledOnce());
  });

  it("requires at least three characters and voids through a confirmation dialog without deleting history", async () => {
    const user = userEvent.setup();
    render(h(AgentFinancePanel, { isEnglish: true, requestId: 7 }));
    await user.click(screen.getByRole("button", { name: "Open ledger" }));
    await user.click(screen.getAllByRole("button", { name: "Void entry" })[0]);
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText(/excludes it from totals/)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "Void entry" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await user.type(screen.getByLabelText("Void reason"), "ok");
    expect(confirm.disabled).toBe(true);
    await user.type(screen.getByLabelText("Void reason"), " entry");
    await user.click(confirm);
    await waitFor(() => expect(mocks.void.mutateAsync).toHaveBeenCalledWith({ entryId: 10, reason: "ok entry" }));
    expect(mocks.invalidate).toHaveBeenCalledOnce();
  });
});
