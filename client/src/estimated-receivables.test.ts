// @vitest-environment jsdom
import React, { createElement as h } from "react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const mocks = vi.hoisted(() => ({
  query: {} as any,
  refetch: vi.fn(),
  open: vi.fn(),
}));
vi.mock("./lib/trpc", () => ({
  trpc: { estimatedReceivables: { mine: { useQuery: () => mocks.query } } },
}));
import { EstimatedReceivables } from "./components/EstimatedReceivables";
beforeAll(() => vi.stubGlobal("React", React));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.query = {
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: mocks.refetch,
    data: {
      totalAmount: "1234.50",
      completedRequestCount: 2,
      pricedRequestCount: 1,
      unpricedRequestCount: 1,
      items: [
        {
          requestId: 1,
          reference: "REF-1",
          category: "خدمة",
          subcategory: null,
          priceAmount: "1234.50",
        },
        {
          requestId: 2,
          reference: "REF-2",
          category: "خدمة",
          subcategory: null,
          priceAmount: null,
        },
      ],
    },
  };
});
afterEach(cleanup);
describe("عرض المستحقات التقديرية", () => {
  it("يوضح أن القيم ليست تحصيلًا أو صافي أرباح ويُبقي التفاصيل مطوية", () => {
    render(
      h(EstimatedReceivables, { isEnglish: false, onOpenRequest: mocks.open })
    );
    expect(screen.getByText(/وليست مبالغ مستلمة أو صافي أرباح/)).toBeTruthy();
    expect(screen.getByTestId("estimated-total").textContent).toContain("ر.س");
    expect(screen.queryByText(/REF-1/)).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(/غير محسوبة/)).toBeTruthy();
  });
  it("يفتح التفاصيل وينتقل للطلب ولا يحول غير المسعر إلى صفر", async () => {
    render(
      h(EstimatedReceivables, { isEnglish: true, onOpenRequest: mocks.open })
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Receivable details" })
    );
    expect(screen.getByText("Not priced")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /REF-1/ }));
    expect(mocks.open).toHaveBeenCalledWith(1);
    await userEvent.click(
      screen.getByRole("button", { name: "Refresh receivables" })
    );
    expect(mocks.refetch).toHaveBeenCalled();
  });
  it("يعرض التحميل دون صفر مضلل", () => {
    mocks.query = { ...mocks.query, isLoading: true, data: undefined };
    render(
      h(EstimatedReceivables, { isEnglish: false, onOpenRequest: mocks.open })
    );
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByTestId("estimated-total")).toBeNull();
  });
  it("يخفي القيم عند فشل التحميل مع إعادة المحاولة", async () => {
    mocks.query.isError = true;
    render(
      h(EstimatedReceivables, { isEnglish: false, onOpenRequest: mocks.open })
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByTestId("estimated-total")).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "تحديث المستحقات" })
    );
    expect(mocks.refetch).toHaveBeenCalled();
  });
  it("يوضح عدم وجود طلبات مكتملة", () => {
    mocks.query.data = {
      totalAmount: "0.00",
      completedRequestCount: 0,
      pricedRequestCount: 0,
      unpricedRequestCount: 0,
      items: [],
    };
    render(
      h(EstimatedReceivables, { isEnglish: false, onOpenRequest: mocks.open })
    );
    expect(screen.getByText("لا توجد طلبات مكتملة حتى الآن.")).toBeTruthy();
  });
});
