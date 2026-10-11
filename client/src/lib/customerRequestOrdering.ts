type DateLike = Date | string | number;

export type RequestForOrdering = { id: number; updatedAt: DateLike };
export type QuoteGroupForOrdering = { requestId: number; quotes: Array<{ createdAt: DateLike }> };

function timestamp(value: DateLike) {
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : 0;
}

export function orderRequestsByLatestQuote<T extends RequestForOrdering>(requests: T[], quoteGroups: QuoteGroupForOrdering[] = []) {
  const latestQuoteByRequest = new Map(quoteGroups.map((group) => [group.requestId, group.quotes.reduce((latest, quote) => Math.max(latest, timestamp(quote.createdAt)), 0)]));
  return [...requests].sort((a, b) => (latestQuoteByRequest.get(b.id) ?? 0) - (latestQuoteByRequest.get(a.id) ?? 0) || timestamp(b.updatedAt) - timestamp(a.updatedAt));
}
