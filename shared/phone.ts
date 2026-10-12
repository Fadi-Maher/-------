/** Normalize Arabic-Indic and Persian digits without changing their order. */
export function normalizeDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

export function normalizeOtp(value: string): string {
  return normalizeDigits(value).replace(/\D/g, "").slice(0, 6);
}

/** Return the canonical local Saudi mobile number or null. */
export function normalizeSaudiPhone(value: string): string | null {
  const digits = normalizeDigits(value).replace(/[\s()+\-\u200e\u200f\u061c]/g, "");
  if (/^05\d{8}$/.test(digits)) return digits;
  if (/^5\d{8}$/.test(digits)) return `0${digits}`;
  if (/^9665\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^009665\d{8}$/.test(digits)) return `0${digits.slice(5)}`;
  return null;
}
