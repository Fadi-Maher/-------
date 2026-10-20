export const ANNOUNCEMENT_TONES = ["info", "success", "warning"] as const;
export type AnnouncementTone = (typeof ANNOUNCEMENT_TONES)[number];
export const ANNOUNCEMENT_MESSAGE_MAX = 280;
export const ANNOUNCEMENT_LINK_LABEL_MAX = 40;

export type AnnouncementWindow = {
  id: number;
  isActive: boolean;
  startsAt: number;
  endsAt: number | null;
  updatedAt?: Date | number | string | null;
};

export type AnnouncementStatus = "live" | "scheduled" | "ended" | "paused";

/**
 * Accepts only same-site paths ("/contact", "/#services") or absolute https URLs.
 * Rejects protocol-relative URLs, javascript:, data:, and anything with whitespace.
 */
export function normalizeAnnouncementLink(value: string | null | undefined): string | null | "invalid" {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (/\s/.test(trimmed) || trimmed.length > 500) return "invalid";
  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return "invalid";
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || !url.hostname) return "invalid";
    return url.toString();
  } catch {
    return "invalid";
  }
}

export function isExternalAnnouncementLink(link: string) {
  return /^https:\/\//i.test(link);
}

export function getAnnouncementStatus(item: AnnouncementWindow, now = Date.now()): AnnouncementStatus {
  if (!item.isActive) return "paused";
  if (item.endsAt !== null && item.endsAt <= now) return "ended";
  if (item.startsAt > now) return "scheduled";
  return "live";
}

function updatedAtValue(value: AnnouncementWindow["updatedAt"]) {
  if (value === null || value === undefined) return 0;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

/** When several announcements overlap, the one that started most recently wins (then the newest edit). */
export function pickLiveAnnouncement<T extends AnnouncementWindow>(items: T[], now = Date.now()): T | null {
  const live = items.filter((item) => getAnnouncementStatus(item, now) === "live");
  live.sort((a, b) => b.startsAt - a.startsAt || updatedAtValue(b.updatedAt) - updatedAtValue(a.updatedAt) || b.id - a.id);
  return live[0] ?? null;
}

/** Version used for dismissals: editing an announcement shows it again to visitors who closed it. */
export function announcementVersion(item: Pick<AnnouncementWindow, "id" | "updatedAt">) {
  return `${item.id}:${updatedAtValue(item.updatedAt)}`;
}
