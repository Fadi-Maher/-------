/**
 * Lead scoring (max 100) — identical weights to the approved reference:
 * hot >= 70, warm 45–69, cold < 45. Individuals count as a single transaction.
 */
import type { Bilingual, Lang } from "./catalog";
import type { LeadSlots } from "./understanding";

export type LeadGrade = "hot" | "warm" | "cold";

export const SCORE_LABELS = {
  business: { ar: "منشأة أو شركة", en: "Business customer" },
  individual: { ar: "عميل فرد", en: "Individual customer" },
  urgent: { ar: "يحتاجها خلال 48 ساعة", en: "Needs it within 48h" },
  week: { ar: "خلال أسبوع", en: "Within a week" },
  month: { ar: "خلال شهر", en: "Within a month" },
  exploring: { ar: "يستكشف فقط", en: "Just exploring" },
  many: { ar: "أكثر من 5 معاملات شهريًا", en: "5+ transactions monthly" },
  few: { ar: "2 إلى 5 معاملات", en: "2–5 transactions" },
  single: { ar: "معاملة واحدة", en: "Single transaction" },
  gt2000: { ar: "ميزانية أعلى من 2,000 ريال", en: "Budget over SAR 2,000" },
  "500_2000": { ar: "ميزانية 500 – 2,000 ريال", en: "Budget SAR 500–2,000" },
  lt500: { ar: "ميزانية أقل من 500 ريال", en: "Budget under SAR 500" },
  budgetUnknown: { ar: "ميزانية غير محددة", en: "Budget not decided" },
  service: { ar: "حدد الخدمة بوضوح", en: "Clear service need" },
  phone: { ar: "رقم جوال صالح للتواصل", en: "Valid mobile number" },
  now: { ar: "يرغب بالتواصل الآن", en: "Wants a call now" },
} as const satisfies Record<string, Bilingual>;

export type ScoreFactor = keyof typeof SCORE_LABELS;

export const SCORE_POINTS: Record<ScoreFactor, number> = {
  business: 20,
  individual: 6,
  urgent: 25,
  week: 18,
  month: 10,
  exploring: 2,
  many: 25,
  few: 14,
  single: 5,
  gt2000: 15,
  "500_2000": 10,
  lt500: 4,
  budgetUnknown: 2,
  service: 5,
  phone: 8,
  now: 2,
};

export function gradeForScore(score: number): LeadGrade {
  if (score >= 70) return "hot";
  if (score >= 45) return "warm";
  return "cold";
}

export type ScoreBreakdownItem = { key: ScoreFactor; label: string; points: number };
export type LeadScore = { score: number; grade: LeadGrade; breakdown: ScoreBreakdownItem[] };

export function scoreLead(slots: LeadSlots, lang: Lang = "ar"): LeadScore {
  const breakdown: ScoreBreakdownItem[] = [];
  const add = (key: ScoreFactor) => breakdown.push({ key, label: SCORE_LABELS[key][lang], points: SCORE_POINTS[key] });
  if (slots.customerType) add(slots.customerType);
  if (slots.urgency) add(slots.urgency);
  if (slots.volume) add(slots.volume);
  else if (slots.customerType === "individual") add("single");
  if (slots.budget) add(slots.budget === "unknown" ? "budgetUnknown" : slots.budget);
  if (slots.service && slots.service !== "other") add("service");
  if (slots.phone) add("phone");
  if (slots.contactTime === "now") add("now");
  const score = Math.min(100, breakdown.reduce((sum, item) => sum + item.points, 0));
  return { score, grade: gradeForScore(score), breakdown };
}

export const GRADE_LABELS: Record<LeadGrade, Bilingual> = {
  hot: { ar: "ساخن", en: "Hot" },
  warm: { ar: "دافئ", en: "Warm" },
  cold: { ar: "بارد", en: "Cold" },
};
