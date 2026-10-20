/**
 * Text helpers for the Maalamati sales assistant (lead bot).
 * Ported from the approved reference engine: digit normalisation, Arabic
 * folding, Saudi mobile parsing, sanitising, sensitive-data redaction and
 * abuse detection. Pure functions — shared by server and client.
 */

const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
const PERSIAN_DIGITS = /[\u06F0-\u06F9]/g;
const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g;
// Built with the constructor so the unicode flag does not depend on the TS target.
const NON_WORD_CHARS = new RegExp("[^\\p{L}\\p{N}\\s+]", "gu");

/** Convert Arabic-Indic and Persian digits to ASCII digits. */
export function toAsciiDigits(value: string): string {
  return value
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 1632))
    .replace(PERSIAN_DIGITS, (d) => String(d.charCodeAt(0) - 1776));
}

/** Fold Arabic letter variants, strip diacritics/punctuation, lowercase. */
export function normalizeText(value: string): string {
  return toAsciiDigits(value)
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase()
    .replace(NON_WORD_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse a Saudi mobile number (05XXXXXXXX, 9665…, 009665…, Arabic digits). */
export function parseSaudiMobile(value: string): string | null {
  let digits = toAsciiDigits(value).replace(/\D/g, "");
  if (digits.startsWith("00966")) digits = digits.slice(5);
  else if (digits.startsWith("966")) digits = digits.slice(3);
  if (digits.length === 9 && digits.startsWith("5")) digits = `0${digits}`;
  return /^05\d{8}$/.test(digits) ? digits : null;
}

/** Normalise a phone search query: a valid mobile, else its raw digits. */
export function phoneSearchDigits(value: string): string {
  return parseSaudiMobile(value) ?? toAsciiDigits(value).replace(/\D/g, "");
}

/** Remove control characters and angle brackets, collapse spaces, cap length. */
export function sanitizeText(value: string, maxLength = 800): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** Mask a phone number for lists: 055****567. */
export function maskPhone(value: string): string {
  return value.length < 7 ? value : `${value.slice(0, 3)}****${value.slice(-3)}`;
}

/** Phone-like digit runs inside free text (Latin or Arabic digits, spaces/dashes). */
export const PHONE_LIKE_PATTERN = /[+\d\u0660-\u0669][\d\u0660-\u0669\s-]{7,}[\d\u0660-\u0669]/g;

/** Mask every phone-like number inside a sentence (keeps the rest of the text). */
export function maskPhonesInText(value: string): string {
  return value.replace(PHONE_LIKE_PATTERN, (match) => maskPhone(toAsciiDigits(match).replace(/\D/g, "")));
}

const ABUSIVE_WORDS = [
  "حمار",
  "غبي",
  "تافه",
  "حقير",
  "وسخ",
  "لعنه",
  "يلعن",
  "انقلع",
  "خرا",
  "stupid",
  "idiot",
  "fuck",
  "shit",
  "bitch",
  "bastard",
].map(normalizeText);

function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export type RedactionKind = "iban" | "card" | "national_id" | "secret";

const SECRET_PATTERN = new RegExp(
  "((?:كلمة\\s*(?:ال)?(?:مرور|سر)|(?:ال)?رقم\\s*(?:ال)?سري|(?:ال)?باسوورد|(?:ال)?باسورد|رمز\\s*(?:ال)?تحقق|كود\\s*(?:ال)?تحقق|(?<![a-z])(?:password|passcode|otp|pin|verification\\s*code)(?![a-z]))\\s*(?:هو|is)?\\s*[:：=\\-]?\\s*)([^\\s،,.]{3,64})",
  "gi",
);

/** Replace national/iqama IDs, IBANs, Luhn-valid cards and secrets. */
export function redactSensitive(value: string): { text: string; kinds: RedactionKind[] } {
  const kinds = new Set<RedactionKind>();
  let text = toAsciiDigits(value);
  text = text.replace(/\bSA\d{2}(?:\s?\d){20}\b/gi, () => {
    kinds.add("iban");
    return "[IBAN محجوب]";
  });
  text = text.replace(/\b(?:\d[ -]?){13,19}\b/g, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && passesLuhn(digits)) {
      kinds.add("card");
      return "[رقم بطاقة محجوب]";
    }
    return match;
  });
  text = text.replace(/(^|\D)([12]\d{9})(?!\d)/g, (_match, prefix: string) => {
    kinds.add("national_id");
    return `${prefix}[رقم هوية محجوب]`;
  });
  text = text.replace(SECRET_PATTERN, (match, label: string, secret: string) => {
    if (/^\[/.test(secret)) return match;
    kinds.add("secret");
    return `${label}[بيانات سرية محجوبة]`;
  });
  return { text, kinds: Array.from(kinds) };
}

export type ModerationResult = {
  blocked: boolean;
  reason: "empty" | "too_long" | "abusive" | null;
  maskedText: string;
  maskedKinds: RedactionKind[];
};

/** Check a visitor message: empty/too long/abusive, and redact sensitive data. */
export function moderateMessage(value: string, maxLength = 800): ModerationResult {
  const trimmed = value.trim();
  if (!trimmed) return { blocked: true, reason: "empty", maskedText: "", maskedKinds: [] };
  if (trimmed.length > maxLength) {
    return { blocked: true, reason: "too_long", maskedText: "", maskedKinds: [] };
  }
  const padded = ` ${normalizeText(trimmed)} `;
  const abusive = ABUSIVE_WORDS.some((word) => padded.includes(` ${word} `));
  const redacted = redactSensitive(trimmed);
  return {
    blocked: abusive,
    reason: abusive ? "abusive" : null,
    maskedText: redacted.text,
    maskedKinds: redacted.kinds,
  };
}
