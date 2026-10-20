/**
 * Settings + business hours for the Maalamati Care sales assistant.
 * Pure helpers (no I/O) so they are easy to unit test; persistence lives in
 * repo.ts. Business hours are evaluated in Riyadh time (UTC+3, no DST).
 */
import { LEAD_SERVICE_IDS, type LeadServiceId } from "../../shared/leadBot/catalog";
import type { EngineSettings } from "../../shared/leadBot/engine";

export type LeadBotSettings = {
  enabled: boolean;
  aiAssist: boolean;
  autoEscalateAfterFallbacks: number;
  offerHumanToHotLeads: boolean;
  workingDays: number[];
  workStartHour: number;
  workEndHour: number;
  responseSlaAr: string;
  responseSlaEn: string;
  /** Sales WhatsApp number (digits, optional leading +). Empty = use the site number. */
  whatsappNumber: string;
  /** Offered services; empty = all. "other" is always offered by the engine. */
  services: LeadServiceId[];
  updatedAt: number;
  updatedByName: string | null;
};

export const DEFAULT_LEAD_BOT_SETTINGS: LeadBotSettings = {
  enabled: true,
  aiAssist: false,
  autoEscalateAfterFallbacks: 2,
  offerHumanToHotLeads: true,
  workingDays: [0, 1, 2, 3, 4],
  workStartHour: 9,
  workEndHour: 18,
  responseSlaAr: "خلال 30 دقيقة في أوقات الدوام",
  responseSlaEn: "within 30 minutes during working hours",
  whatsappNumber: "",
  services: [],
  updatedAt: 0,
  updatedByName: null,
};

export const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

export const LEAD_BOT_LINKS = {
  requestForm: "/?service={service}#request",
  track: "/track",
  agentSignup: "/join-as-agent",
  contact: "/contact",
} as const;

const DAY_NAMES = {
  ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
} as const;

export function isWithinWorkingHours(settings: Pick<LeadBotSettings, "workingDays" | "workStartHour" | "workEndHour">, now = Date.now()): boolean {
  const riyadh = new Date(now + RIYADH_OFFSET_MS);
  const day = riyadh.getUTCDay();
  const hour = riyadh.getUTCHours();
  return settings.workingDays.includes(day) && hour >= settings.workStartHour && hour < settings.workEndHour;
}

/** Riyadh calendar date (YYYY-MM-DD) for a UTC timestamp. */
export function riyadhDateKey(timestamp: number): string {
  return new Date(timestamp + RIYADH_OFFSET_MS).toISOString().slice(0, 10);
}

function formatHour(hour: number, lang: "ar" | "en"): string {
  const normalized = hour % 24;
  const twelve = normalized % 12 === 0 ? 12 : normalized % 12;
  if (lang === "ar") return `${twelve} ${normalized < 12 ? "ص" : "م"}`;
  return `${twelve}${normalized < 12 ? "am" : "pm"}`;
}

/** Group consecutive weekdays: [0,1,2,3,4] → "الأحد–الخميس". */
function formatDays(days: number[], lang: "ar" | "en"): string {
  const sorted = Array.from(new Set(days)).filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);
  if (!sorted.length) return lang === "ar" ? "لا توجد أيام عمل" : "No working days";
  const groups: number[][] = [];
  for (const day of sorted) {
    const last = groups[groups.length - 1];
    if (last && last[last.length - 1] === day - 1) last.push(day);
    else groups.push([day]);
  }
  const separator = lang === "ar" ? "، " : ", ";
  return groups
    .map((group) => (group.length >= 3
      ? `${DAY_NAMES[lang][group[0]]}–${DAY_NAMES[lang][group[group.length - 1]]}`
      : group.map((day) => DAY_NAMES[lang][day]).join(separator)))
    .join(separator);
}

export function formatWorkingHours(settings: Pick<LeadBotSettings, "workingDays" | "workStartHour" | "workEndHour">, lang: "ar" | "en"): string {
  return `${formatDays(settings.workingDays, lang)}${lang === "ar" ? "، " : ", "}${formatHour(settings.workStartHour, lang)} – ${formatHour(settings.workEndHour, lang)}`;
}

function parseJsonArray(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function sanitizeWorkingDays(values: unknown[]): number[] {
  return Array.from(new Set(values.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))).sort((a, b) => a - b);
}

export function sanitizeServices(values: unknown[]): LeadServiceId[] {
  const allowed = new Set<string>(LEAD_SERVICE_IDS);
  return Array.from(new Set(values.filter((value): value is LeadServiceId => typeof value === "string" && allowed.has(value))));
}

export type LeadBotSettingsRowLike = {
  enabled: boolean;
  aiAssist: boolean;
  autoEscalateAfterFallbacks: number;
  offerHumanToHotLeads: boolean;
  workingDaysJson: string;
  workStartHour: number;
  workEndHour: number;
  responseSlaAr: string;
  responseSlaEn: string;
  whatsappNumber: string;
  servicesJson: string;
  updatedAt: number;
  updatedByName: string | null;
};

export function settingsFromRow(row: LeadBotSettingsRowLike | null | undefined): LeadBotSettings {
  if (!row) return { ...DEFAULT_LEAD_BOT_SETTINGS };
  const workingDays = sanitizeWorkingDays(parseJsonArray(row.workingDaysJson));
  return {
    enabled: Boolean(row.enabled),
    aiAssist: Boolean(row.aiAssist),
    autoEscalateAfterFallbacks: Math.min(5, Math.max(1, Number(row.autoEscalateAfterFallbacks) || 2)),
    offerHumanToHotLeads: Boolean(row.offerHumanToHotLeads),
    workingDays,
    workStartHour: row.workStartHour,
    workEndHour: row.workEndHour,
    responseSlaAr: row.responseSlaAr || DEFAULT_LEAD_BOT_SETTINGS.responseSlaAr,
    responseSlaEn: row.responseSlaEn || DEFAULT_LEAD_BOT_SETTINGS.responseSlaEn,
    whatsappNumber: row.whatsappNumber ?? "",
    services: sanitizeServices(parseJsonArray(row.servicesJson)),
    updatedAt: Number(row.updatedAt) || 0,
    updatedByName: row.updatedByName ?? null,
  };
}

export type LeadBotSettingsInput = Omit<LeadBotSettings, "updatedAt" | "updatedByName">;

export type SettingsValidationError = "invalid_hours" | "invalid_days" | "invalid_whatsapp" | "invalid_sla" | "invalid_escalation";

/** Validate + normalise owner input. Returns an error code instead of throwing. */
export function validateSettingsInput(input: LeadBotSettingsInput): { ok: true; value: LeadBotSettingsInput } | { ok: false; error: SettingsValidationError } {
  const start = Math.trunc(input.workStartHour);
  const end = Math.trunc(input.workEndHour);
  if (!(start >= 0 && start <= 23 && end >= 1 && end <= 24 && end > start)) return { ok: false, error: "invalid_hours" };
  const days = sanitizeWorkingDays(input.workingDays);
  if (!days.length || days.length !== new Set(input.workingDays).size || days.length !== input.workingDays.length) return { ok: false, error: "invalid_days" };
  const escalate = Math.trunc(input.autoEscalateAfterFallbacks);
  if (!(escalate >= 1 && escalate <= 5)) return { ok: false, error: "invalid_escalation" };
  const slaAr = input.responseSlaAr.trim();
  const slaEn = input.responseSlaEn.trim();
  if (!slaAr || !slaEn || slaAr.length > 80 || slaEn.length > 80) return { ok: false, error: "invalid_sla" };
  const whatsapp = normalizeWhatsappNumber(input.whatsappNumber);
  if (whatsapp === null) return { ok: false, error: "invalid_whatsapp" };
  return {
    ok: true,
    value: {
      ...input,
      workStartHour: start,
      workEndHour: end,
      workingDays: days,
      autoEscalateAfterFallbacks: escalate,
      responseSlaAr: slaAr,
      responseSlaEn: slaEn,
      whatsappNumber: whatsapp,
      services: sanitizeServices(input.services),
    },
  };
}

/**
 * Accepts empty, local Saudi (05XXXXXXXX) or international digits with an
 * optional "+". Returns digits in international form, "" for empty, or null
 * when invalid.
 */
export function normalizeWhatsappNumber(raw: string | null | undefined): string | null {
  const value = String(raw ?? "")
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\s\-()]/g, "");
  if (!value) return "";
  if (!/^\+?\d+$/.test(value) || value.length > 16) return null;
  let digits = value.replace(/^\+/, "");
  if (/^05\d{8}$/.test(digits)) digits = `966${digits.slice(1)}`;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/** Convert stored settings into the engine contract for one request. */
export function toEngineSettings(settings: LeadBotSettings, siteWhatsapp: string | null, now = Date.now()): EngineSettings {
  const whatsapp = normalizeWhatsappNumber(settings.whatsappNumber) || normalizeWhatsappNumber(siteWhatsapp) || null;
  return {
    enabled: settings.enabled,
    services: settings.services,
    links: { ...LEAD_BOT_LINKS },
    whatsappNumber: whatsapp || null,
    autoEscalateAfterFallbacks: settings.autoEscalateAfterFallbacks,
    offerHumanToHotLeads: settings.offerHumanToHotLeads,
    isWithinWorkingHours: isWithinWorkingHours(settings, now),
    workingHoursAr: formatWorkingHours(settings, "ar"),
    workingHoursEn: formatWorkingHours(settings, "en"),
    responseSlaAr: settings.responseSlaAr,
    responseSlaEn: settings.responseSlaEn,
    now,
  };
}
