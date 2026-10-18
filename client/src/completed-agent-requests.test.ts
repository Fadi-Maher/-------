// @vitest-environment jsdom
import React, { createElement as h } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  query: {} as any,
  refetch: vi.fn(),
  openRequest: vi.fn(),
}));

vi.mock("./lib/trpc", () => ({
  trpc: {
    agentFinance: {
      completed: { useQuery: () => mocks.query },
    },
  },
}));

import { CompletedAgentRequests } from "./components/CompletedAgentRequests";

beforeAll(() => vi.stubGlobal("React", React));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.query = {
    data: {
      totalAmount: "1234.50",
      completedRequestCount: 2,
      pricedRequestCount: 1,
      unpricedRequestCount: 1,
      items: [
        { requestId: 51, reference: "REQ-51", category: "خدمة", subcategory: "فرعية", priceAmount: "1234.50", updatedAt: Date.UTC(2026, 0, 4) },
        { requestId: 52, reference: "REQ-52", category: "خدمة", subcategory: null, priceAmount: null, updatedAt: Date.UTC(2026, 0, 3) },
      ],
    },
    isLoading: false,
    isError: false,
    refetch: mocks.refetch,
  };
});
afterEach(cleanup);

describe("CompletedAgentRequests UI", () => {
  it("keeps completed details collapsed and makes the quote value explicitly estimated", () => {
    render(h(CompletedAgentRequests, { isEnglish: false, onOpenRequest: mocks.openRequest }));
    expect(screen.getByTestId("estimated-total").textContent).toContain("1234.50 SAR");
    expect(screen.getByText("قيمة العرض تقدير وليست تحصيلًا تلقائيًا.")).toBeTruthy();
    expect(screen.getByText("لا تنفذ هذه الواجهة دفعًا ولا تصدر إيصالات رسمية.")).toBeTruthy();
    expect(screen.queryByText(/REQ-51/)).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("opens the compact completed list, preserves an unpriced request, and navigates by request id", async () => {
    const user = userEvent.setup();
    render(h(CompletedAgentRequests, { isEnglish: true, onOpenRequest: mocks.openRequest }));
    expect(screen.getByRole("region", { name: "Completed requests" }).getAttribute("dir")).toBe("ltr");
    await user.click(screen.getByRole("button", { name: "Completed request details" }));
    expect(screen.getByText("Not priced")).toBeTruthy();
    expect(screen.getAllByText("1234.50 SAR")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Open request: REQ-51" }));
    expect(mocks.openRequest).toHaveBeenCalledWith(51);
  });

  it("does not show a misleading total while loading and supports retry on an error", async () => {
    const user = userEvent.setup();
    mocks.query = { data: undefined, isLoading: true, isError: false, refetch: mocks.refetch };
    const { rerender } = render(h(CompletedAgentRequests, { isEnglish: false, onOpenRequest: mocks.openRequest }));
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByTestId("estimated-total")).toBeNull();

    mocks.query = { data: undefined, isLoading: false, isError: true, refetch: mocks.refetch };
    rerender(h(CompletedAgentRequests, { isEnglish: false, onOpenRequest: mocks.openRequest }));
    expect(screen.getByRole("alert")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
});
