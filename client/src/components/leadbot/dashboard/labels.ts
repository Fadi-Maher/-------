import { LEAD_SERVICES, serviceLabel, type LeadServiceId } from "@shared/leadBot/catalog";
import { GRADE_LABELS, type LeadGrade } from "@shared/leadBot/scoring";

export type LeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  qualified: "مؤهل",
  won: "تحوّل لعميل",
  lost: "غير مهتم",
};

export const STATUS_ORDER: LeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];

export const STATUS_TONES: Record<LeadStatus, string> = {
  new: "bg-[#eaf4ff] text-[#0866d6]",
  contacted: "bg-indigo-50 text-indigo-700",
  qualified: "bg-emerald-50 text-emerald-700",
  won: "bg-[#efffc2] text-[#3f5a00]",
  lost: "bg-slate-100 text-slate-600",
};

export const GRADE_TONES: Record<LeadGrade, { chip: string; dot: string }> = {
  hot: { chip: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
  warm: { chip: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
  cold: { chip: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
};

export const gradeLabel = (grade: LeadGrade) => GRADE_LABELS[grade].ar;

export const INTENT_LABELS: Record<string, string> = {
  start_request: "طلب خدمة",
  pricing: "الأسعار",
  business_plan: "حلول المنشآت",
  track_request: "تتبع طلب",
  become_agent: "الانضمام كمعقّب",
  talk_to_human: "طلب موظف",
  complaint: "شكوى",
  faq: "سؤال عام",
  greeting: "تحية",
  thanks: "شكر",
  goodbye: "وداع",
  restart: "بدء من جديد",
  edit: "تعديل",
};

export const SERVICE_OPTIONS = LEAD_SERVICES.map((service) => ({ id: service.id as LeadServiceId, label: service.ar }));

export const leadServiceLabel = (service: string | null | undefined) => (service ? serviceLabel(service, "ar") : "—");

export function relativeTime(time: number, now = Date.now()) {
  const minutes = Math.round(Math.max(0, now - time) / 60_000);
  if (minutes < 1) return "الآن";
  const format = new Intl.RelativeTimeFormat("ar-SA-u-nu-latn", { numeric: "auto" });
  if (minutes < 60) return format.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return format.format(-hours, "hour");
  return format.format(-Math.round(hours / 24), "day");
}

export function formatDateTime(time: number) {
  return new Date(time).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });
}

/** Saudi mobile for display: 05x xxx xxxx. Other values are shown as stored. */
export function formatPhone(phone: string | null | undefined) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("966") ? `0${digits.slice(3)}` : digits;
  if (/^05\d{8}$/.test(local)) return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  return phone;
}

export const percent = (value: number) => `${Math.round(value * 100)}%`;

export function errorText(error: unknown, fallback: string) {
  const code = (error as { data?: { code?: string } } | null)?.data?.code;
  if (code === "FORBIDDEN") return "لا تملك صلاحية تنفيذ هذا الإجراء.";
  if (code === "UNAUTHORIZED") return "انتهت الجلسة. سجّل الدخول مرة أخرى.";
  return fallback;
}
