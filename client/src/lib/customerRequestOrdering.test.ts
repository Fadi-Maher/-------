import { describe, expect, it } from "vitest";
import { orderRequestsByLatestQuote } from "./customerRequestOrdering";

describe("ترتيب طلبات العميل", () => {
  it("يضع الطلب صاحب أحدث عرض سعر في الأعلى", () => {
    const requests = [
      { id: 1, updatedAt: "2026-08-30T12:00:00Z" },
      { id: 2, updatedAt: "2026-08-30T10:00:00Z" },
      { id: 3, updatedAt: "2026-08-30T11:00:00Z" },
    ];
    const groups = [
      { requestId: 1, quotes: [{ createdAt: "2026-08-30T12:30:00Z" }] },
      { requestId: 2, quotes: [{ createdAt: "2026-08-30T13:00:00Z" }] },
    ];
    expect(orderRequestsByLatestQuote(requests, groups).map((request) => request.id)).toEqual([2, 1, 3]);
  });

  it("يرتب الطلبات بلا عروض حسب أحدث تحديث", () => {
    const requests = [
      { id: 1, updatedAt: "2026-08-30T10:00:00Z" },
      { id: 2, updatedAt: "2026-08-30T12:00:00Z" },
    ];
    expect(orderRequestsByLatestQuote(requests).map((request) => request.id)).toEqual([2, 1]);
  });
});
