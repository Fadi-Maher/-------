import { toAsciiDigits } from "@shared/phoneSearch";

/**
 * Converts the owner's saved support number to the international digits wa.me
 * expects. Accepts "+966…", "00966…", "966…" and local Saudi "05…" / "5…".
 * Returns null when the value cannot be a valid WhatsApp number.
 */
export function toWhatsAppNumber(raw?: string | null) {
  if (!raw) return null;
  let digits = toAsciiDigits(raw);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^05\d{8}$/.test(digits)) digits = `966${digits.slice(1)}`;
  else if (/^5\d{8}$/.test(digits)) digits = `966${digits}`;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function whatsAppChatHref(raw: string | null | undefined, message: string) {
  const number = toWhatsAppNumber(raw);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
