import { afterEach, describe, expect, it, vi } from "vitest";
import { summarizeFinanceEntries } from "../shared/finance";
import { buildFinancePeriod, filterFinanceEntries } from "../shared/financePeriod";

function validPeriod(draft: Parameters<typeof buildFinancePeriod>[0]) {
  const result = buildFinancePeriod(draft);
  expect(result.error).toBeNull();
  expect(result.period).not.toBeNull();
  return result.period!;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("finance period helper", () => {
  it("accepts all without bounds and returns a shallow copy when filtering", () => {
    const period = validPeriod({ mode: "all", month: "", from: "", to: "" });
    const entries = [{ occurredAt: 1 }, { occurredAt: 2 }];

    expect(period).toMatchObject({ mode: "all", startMs: null, endExclusiveMs: null });
    const filtered = filterFinanceEntries(entries, period);
    expect(filtered).toEqual(entries);
    expect(filtered).not.toBe(entries);
  });

  it("builds exact inclusive/exclusive monthly boundaries and rejects invalid months", () => {
    const period = validPeriod({ mode: "month", month: "2026-02", from: "", to: "" });
    expect(period.startMs).toBe(new Date(2026, 1, 1).getTime());
    expect(period.endExclusiveMs).toBe(new Date(2026, 2, 1).getTime());

    for (const month of ["2026-2", "2026-02x", "1999-12", "9999-01", "2026-00", "2026-13"]) {
      expect(buildFinancePeriod({ mode: "month", month, from: "", to: "" })).toEqual({ period: null, error: "month" });
    }
  });

  it("validates strict Gregorian range dates, including leap years, required dates, and order", () => {
    const leapDay = validPeriod({ mode: "range", month: "", from: "2024-02-29", to: "2024-02-29" });
    expect(leapDay.startMs).toBe(new Date(2024, 1, 29).getTime());
    expect(leapDay.endExclusiveMs).toBe(new Date(2024, 2, 1).getTime());

    for (const draft of [
      { from: "", to: "2026-01-01" },
      { from: "2026-01-01", to: "" },
      { from: "2023-02-29", to: "2023-02-29" },
      { from: "2024-02-30", to: "2024-02-30" },
      { from: "2024-04-31", to: "2024-04-31" },
      { from: "2026-1-01", to: "2026-01-01" },
    ]) {
      expect(buildFinancePeriod({ mode: "range", month: "", ...draft })).toEqual({ period: null, error: "date" });
    }

    expect(buildFinancePeriod({ mode: "range", month: "", from: "2026-04-02", to: "2026-04-01" })).toEqual({ period: null, error: "order" });
  });

  it("includes the start and final millisecond of a local day, but excludes both outer edges", () => {
    const period = validPeriod({ mode: "range", month: "", from: "2026-06-15", to: "2026-06-15" });
    const start = period.startMs!;
    const end = period.endExclusiveMs!;
    const entries = [
      { id: "before", occurredAt: start - 1 },
      { id: "start", occurredAt: start },
      { id: "last-ms", occurredAt: end - 1 },
      { id: "after", occurredAt: end },
    ];

    expect(filterFinanceEntries(entries, period).map(entry => entry.id)).toEqual(["start", "last-ms"]);
  });

  it("filters only by occurredAt and can feed exact, non-voided period totals", () => {
    const period = validPeriod({ mode: "range", month: "", from: "2026-06-15", to: "2026-06-15" });
    const start = period.startMs!;
    const end = period.endExclusiveMs!;
    const entries = [
      { id: "occurred-outside", occurredAt: end, createdAt: start, kind: "collection" as const, amount: "9.99", voidedAt: null },
      { id: "occurred-inside", occurredAt: start, createdAt: end, kind: "collection" as const, amount: "0.10", voidedAt: null },
      { id: "last-ms", occurredAt: end - 1, createdAt: end, kind: "collection" as const, amount: "0.20", voidedAt: null },
      { id: "voided", occurredAt: start, createdAt: start, kind: "collection" as const, amount: "100.00", voidedAt: start },
    ];

    const filtered = filterFinanceEntries(entries, period);
    expect(filtered.map(entry => entry.id)).toEqual(["occurred-inside", "last-ms", "voided"]);
    expect(summarizeFinanceEntries(filtered)).toEqual({
      totalCollected: "0.30",
      totalCosts: "0.00",
      netProfit: "0.30",
    });
  });

  it("uses Asia/Riyadh local midnight rather than UTC parsing", () => {
    vi.stubEnv("TZ", "Asia/Riyadh");
    const period = validPeriod({ mode: "range", month: "", from: "2026-02-14", to: "2026-02-14" });
    const localMidnight = Date.UTC(2026, 1, 13, 21, 0, 0, 0);

    expect(period.startMs).toBe(localMidnight);
    expect(period.endExclusiveMs).toBe(Date.UTC(2026, 1, 14, 21, 0, 0, 0));
    expect(filterFinanceEntries([
      { id: "previous-local-day", occurredAt: localMidnight - 1 },
      { id: "local-start", occurredAt: localMidnight },
      { id: "local-last-ms", occurredAt: period.endExclusiveMs! - 1 },
      { id: "next-local-day", occurredAt: period.endExclusiveMs! },
    ], period).map(entry => entry.id)).toEqual(["local-start", "local-last-ms"]);
  });

  it("uses local next-day construction across the America/New_York spring DST transition", () => {
    vi.stubEnv("TZ", "America/New_York");
    const period = validPeriod({ mode: "range", month: "", from: "2026-03-08", to: "2026-03-08" });

    expect(period.startMs).toBe(Date.UTC(2026, 2, 8, 5, 0, 0, 0));
    expect(period.endExclusiveMs).toBe(Date.UTC(2026, 2, 9, 4, 0, 0, 0));
    expect(period.endExclusiveMs! - period.startMs).toBe(23 * 60 * 60 * 1000);
    expect(filterFinanceEntries([
      { id: "start", occurredAt: period.startMs! },
      { id: "last-ms", occurredAt: period.endExclusiveMs! - 1 },
      { id: "next-day", occurredAt: period.endExclusiveMs! },
    ], period).map(entry => entry.id)).toEqual(["start", "last-ms"]);
  });
});
