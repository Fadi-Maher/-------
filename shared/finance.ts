export function normalizeMoneyInput(value: string): string {
  return value
    .trim()
    .replace(/[٠-٩۰-۹]/g, char => {
      const code = char.charCodeAt(0);
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    })
    .replace(/٫/g, ".")
    .replace(/٬/g, "");
}

export function amountToHalalas(amount: string): bigint {
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(amount)) throw new Error("Invalid amount");
  const negative = amount.startsWith("-");
  const [whole, fraction = ""] = amount.replace(/^-/, "").split(".");
  const value = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  return negative ? -value : value;
}

export function halalasToAmount(value: bigint): string {
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  return `${negative ? "-" : ""}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, "0")}`;
}

export function summarizeFinanceEntries(
  entries: {
    kind: "collection" | "cost";
    amount: string;
    voidedAt: number | null;
  }[]
) {
  let collected = BigInt(0);
  let costs = BigInt(0);
  for (const entry of entries) {
    if (entry.voidedAt !== null) continue;
    if (entry.kind === "collection") collected += amountToHalalas(entry.amount);
    else costs += amountToHalalas(entry.amount);
  }
  return {
    totalCollected: halalasToAmount(collected),
    totalCosts: halalasToAmount(costs),
    netProfit: halalasToAmount(collected - costs),
  };
}
