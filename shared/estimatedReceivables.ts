export function quoteAmountInHalalas(
  amount: string | null | undefined
): bigint | null {
  if (!amount || !/^\d+(?:\.\d{1,2})?$/.test(amount)) return null;
  const [riyals, fraction = ""] = amount.split(".");
  const halalas =
    BigInt(riyals) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  return halalas > BigInt(0) ? halalas : null;
}

export function halalasToAmount(value: bigint): string {
  return `${value / BigInt(100)}.${String(value % BigInt(100)).padStart(2, "0")}`;
}

export function summarizeEstimatedReceivables<
  T extends { priceAmount: string | null },
>(rows: T[]) {
  let total = BigInt(0);
  let pricedRequestCount = 0;
  const items = rows.map(row => {
    const halalas = quoteAmountInHalalas(row.priceAmount);
    if (halalas !== null) {
      total += halalas;
      pricedRequestCount += 1;
    }
    return {
      ...row,
      priceAmount: halalas === null ? null : halalasToAmount(halalas),
    };
  });
  return {
    totalAmount: halalasToAmount(total),
    completedRequestCount: rows.length,
    pricedRequestCount,
    unpricedRequestCount: rows.length - pricedRequestCount,
    items,
  };
}
