export type FinancePeriodDraft = {
  mode: "all" | "month" | "range";
  month: string;
  from: string;
  to: string;
};

export type FinancePeriod = {
  mode: "all" | "month" | "range";
  startMs: number | null;
  endExclusiveMs: number | null;
  month: string;
  from: string;
  to: string;
};

type FinancePeriodError = "month" | "date" | "order" | null;

type LocalDate = {
  startMs: number;
  endExclusiveMs: number;
};

function parseMonth(value: string): { year: number; month: number } | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  if (year < 2000 || year > 9998 || month < 1 || month > 12) return null;

  return { year, month };
}

function parseLocalDate(value: string): LocalDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 2000 || year > 9998 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const start = new Date(year, month - 1, day);
  if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) return null;

  return {
    startMs: start.getTime(),
    endExclusiveMs: new Date(year, month - 1, day + 1).getTime(),
  };
}

export function buildFinancePeriod(draft: FinancePeriodDraft): {
  period: FinancePeriod | null;
  error: FinancePeriodError;
} {
  if (draft.mode === "all") {
    return {
      period: { ...draft, startMs: null, endExclusiveMs: null },
      error: null,
    };
  }

  if (draft.mode === "month") {
    const month = parseMonth(draft.month);
    if (!month) return { period: null, error: "month" };

    return {
      period: {
        ...draft,
        startMs: new Date(month.year, month.month - 1, 1).getTime(),
        endExclusiveMs: new Date(month.year, month.month, 1).getTime(),
      },
      error: null,
    };
  }

  const from = parseLocalDate(draft.from);
  const to = parseLocalDate(draft.to);
  if (!from || !to) return { period: null, error: "date" };
  if (from.startMs > to.startMs) return { period: null, error: "order" };

  return {
    period: {
      ...draft,
      startMs: from.startMs,
      endExclusiveMs: to.endExclusiveMs,
    },
    error: null,
  };
}

export function filterFinanceEntries<T extends { occurredAt: number }>(entries: T[], period: FinancePeriod): T[] {
  if (period.startMs === null && period.endExclusiveMs === null) return entries.slice();

  return entries.filter(entry =>
    (period.startMs === null || entry.occurredAt >= period.startMs) &&
    (period.endExclusiveMs === null || entry.occurredAt < period.endExclusiveMs)
  );
}
