/**
 * Phone-first search helpers for the owner's review screens.
 * Stored mobiles are canonical Saudi numbers ("05XXXXXXXX"); the owner may type
 * any common variant: Arabic/Persian digits, spaces or dashes, +966 / 00966 / 966,
 * or the 9-digit form without the leading zero.
 */
const DIGIT_MAP: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

/** Converts Arabic-Indic and Persian digits to ASCII and drops every non-digit. */
export function toAsciiDigits(value: string) {
  return value.replace(/[٠-٩۰-۹]/g, digit => DIGIT_MAP[digit] ?? digit).replace(/\D/g, "");
}

/** True when the query is made only of phone characters (digits, +, spaces, dashes, brackets). */
export function looksLikePhoneQuery(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 && /^[+\d٠-٩۰-۹()\s.-]+$/.test(trimmed) && toAsciiDigits(trimmed).length > 0;
}

/**
 * Normalizes a (possibly partial) phone query to the canonical local form so it can be
 * matched with `includes` against stored numbers.
 *  "+966 50 123 4567" → "0501234567", "00966501" → "0501", "501234567" → "0501234567".
 */
export function normalizePhoneQuery(value: string) {
  let digits = toAsciiDigits(value);
  if (digits.startsWith("00966")) digits = `0${digits.slice(5)}`;
  else if (digits.startsWith("966")) digits = `0${digits.slice(3)}`;
  else if (digits.length === 9 && digits.startsWith("5")) digits = `0${digits}`;
  return digits;
}

/** Canonical form of a stored number (defensive for legacy rows that kept +966). */
export function normalizeStoredPhone(value: string) {
  return normalizePhoneQuery(value);
}

export function isCompleteSaudiMobile(value: string) {
  return /^05\d{8}$/.test(value);
}

export type PhoneMatch = { start: number; end: number } | null;

/** Range of the matched digits inside a canonical stored phone, for highlighting. */
export function findPhoneMatch(storedPhone: string, query: string): PhoneMatch {
  const needle = normalizePhoneQuery(query);
  if (!needle) return null;
  const haystack = normalizeStoredPhone(storedPhone);
  const start = haystack.indexOf(needle);
  return start === -1 ? null : { start, end: start + needle.length };
}

export type SearchableApplication = { fullName: string; phone: string };

/**
 * Matches an application by phone (when the query looks like a number) or by name.
 * A phone-shaped query never falls back to name matching, so "05" does not match
 * names that happen to contain digits.
 */
export function matchesApplicationSearch(application: SearchableApplication, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return true;
  if (looksLikePhoneQuery(trimmed)) return findPhoneMatch(application.phone, trimmed) !== null;
  return application.fullName.toLocaleLowerCase().includes(trimmed.toLocaleLowerCase());
}

export type ApplicationStatusFilter = "all" | "pending" | "approved" | "rejected";

/** The exact list the owner sees: search (phone or name) first, then the status tab. */
export function filterApplications<T extends SearchableApplication & { status: string }>(
  applications: readonly T[],
  query: string,
  status: ApplicationStatusFilter
) {
  return applications.filter(
    application =>
      matchesApplicationSearch(application, query) &&
      (status === "all" || application.status === status)
  );
}
