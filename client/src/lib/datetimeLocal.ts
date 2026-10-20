const pad = (value: number) => String(value).padStart(2, "0");

/** Formats a UTC millisecond timestamp for an `<input type="datetime-local">` in the viewer's timezone. */
export function toDateTimeLocalValue(timestamp: number | null | undefined) {
  if (timestamp === null || timestamp === undefined || !Number.isFinite(timestamp)) return "";
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parses a `datetime-local` value (viewer's timezone) into UTC milliseconds, or null when empty/invalid. */
export function fromDateTimeLocalValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.getTime();
}

export function formatLocalDateTime(timestamp: number, isEnglish = false) {
  return new Intl.DateTimeFormat(isEnglish ? "en-GB" : "ar-SA-u-nu-latn-ca-gregory", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}
