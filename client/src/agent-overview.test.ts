// @vitest-environment jsdom
import React, { createElement as h } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  query: {} as any,
  enabled: undefined as boolean | undefined,
}));

vi.mock("./lib/trpc", () => ({
  trpc: {
    agentFinance: {
      mine: {
        useQuery: (_input: undefined, options?: { enabled?: boolean }) => {
          mocks.enabled = options?.enabled;
          return mocks.query;
        },
      },
    },
  },
}));

import { AgentOverview, type AgentOverviewProps } from "./components/AgentOverview";

const exactFinanceData = {
  entries: [
    { kind: "collection" as const, amount: "100.10", voidedAt: null },
    { kind: "cost" as const, amount: "20.20", voidedAt: null },
    { kind: "collection" as const, amount: "999.00", voidedAt: Date.UTC(2026, 0, 3) },
  ],
  // The overview deliberately calculates from entries rather than trusting an unrelated server aggregate.
  netProfit: "1078.90",
};

const defaultProps: AgentOverviewProps = {
  isEnglish: true,
  completedCount: 2,
  totalAssignedCount: 3,
  requestsLoading: false,
  requestsError: false,
  canViewAssigned: true,
};

function renderOverview(overrides: Partial<AgentOverviewProps> = {}) {
  return render(h(AgentOverview, { ...defaultProps, ...overrides }));
}

beforeAll(() => vi.stubGlobal("React", React));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  mocks.enabled = undefined;
  mocks.query = { data: exactFinanceData, isLoading: false, isError: false, refetch: vi.fn() };
});
afterEach(cleanup);

describe("AgentOverview UI", () => {
  it("shows completed work and exact own-entry cash totals, excluding voided entries", async () => {
    const user = userEvent.setup();
    const onViewCompleted = vi.fn();
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const ledgerAnchor = document.createElement("div");
    ledgerAnchor.id = "agent-cash-ledger";
    ledgerAnchor.tabIndex = -1;
    document.body.append(ledgerAnchor);

    renderOverview({ onViewCompleted });

    expect(mocks.enabled).toBe(true);
    expect(screen.getByTestId("completed-count").textContent).toContain("2");
    expect(screen.getAllByText("67%")).toHaveLength(2);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("67");
    expect(screen.getByTestId("net-profit").textContent).toContain("79.90 SAR");
    expect(screen.getByText("100.10 SAR")).toBeTruthy();
    expect(screen.getByText("20.20 SAR")).toBeTruthy();
    expect(screen.queryByText("1078.90 SAR")).toBeNull();

    await user.click(screen.getByRole("button", { name: "View completed requests" }));
    expect(onViewCompleted).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Open cash ledger" }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(document.activeElement).toBe(ledgerAnchor);
    ledgerAnchor.remove();
  });

  it("respects reduced motion when opening the cash ledger", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const scrollIntoView = vi.fn(); HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const ledgerAnchor = document.createElement("div"); ledgerAnchor.id = "agent-cash-ledger"; ledgerAnchor.tabIndex = -1; document.body.append(ledgerAnchor);
    renderOverview();
    await user.click(screen.getByRole("button", { name: "Open cash ledger" }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    expect(document.activeElement).toBe(ledgerAnchor); ledgerAnchor.remove();
  });

  it("uses a dash during loading and displays an honest zero count and zero cash total", () => {
    mocks.query = { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
    renderOverview({ completedCount: null, totalAssignedCount: null, requestsLoading: true });
    expect(screen.getByTestId("completed-count").textContent).toContain("—");
    expect(screen.getByTestId("net-profit").textContent).toContain("—");

    cleanup();
    mocks.query = { data: { entries: [] }, isLoading: false, isError: false, refetch: vi.fn() };
    renderOverview({ completedCount: 0, totalAssignedCount: 0 });
    expect(screen.getByTestId("completed-count").textContent).toContain("0");
    expect(screen.getByTestId("net-profit").textContent).toContain("0.00 SAR");
    expect(screen.getAllByText("0%")).toHaveLength(2);
    expect(screen.getByText("Break-even")).toBeTruthy();
  });

  it("labels a negative net result as a loss and retries request and finance failures independently", async () => {
    const user = userEvent.setup();
    mocks.query = { data: { entries: [{ kind: "collection", amount: "1.00", voidedAt: null }, { kind: "cost", amount: "5.00", voidedAt: null }] }, isLoading: false, isError: false, refetch: vi.fn() };
    renderOverview();
    expect(screen.getByTestId("net-profit").textContent).toContain("-4.00 SAR");
    expect(screen.getByText("Loss")).toBeTruthy();

    cleanup();
    const onRetryRequests = vi.fn();
    mocks.query = { data: exactFinanceData, isLoading: false, isError: true, refetch: vi.fn() };
    renderOverview({ requestsError: true, onRetryRequests });
    expect(screen.getByText("Completed work is unavailable right now.")).toBeTruthy();
    expect(screen.getByText("Net cash profit is unavailable right now.")).toBeTruthy();
    expect(screen.queryByTestId("net-profit")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Retry completed work" }));
    await user.click(screen.getByRole("button", { name: "Retry cash summary" }));
    expect(onRetryRequests).toHaveBeenCalledOnce();
    expect(mocks.query.refetch).toHaveBeenCalledOnce();
  });

  it("does not request or display cached numbers when assignment permission is denied", () => {
    renderOverview({ canViewAssigned: false, completedCount: 2, totalAssignedCount: 3 });
    expect(mocks.enabled).toBe(false);
    expect(screen.getByTestId("completed-count").textContent).toContain("—");
    expect(screen.queryByTestId("net-profit")).toBeNull();
    expect(screen.getAllByText("This summary is unavailable for your account.")).toHaveLength(1);
  });

  it("keeps the overview mounted only in the agent branch of TeamWorkspace", () => {
    const workspaceSource = readFileSync(`${process.cwd()}/client/src/pages/TeamWorkspace.tsx`, "utf8");
    expect(workspaceSource).toMatch(/\{isAgent \? <AgentOverview/);
  });
});
