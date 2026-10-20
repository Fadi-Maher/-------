/**
 * Owner/team alerts for the sales assistant. Alerts go through the site's
 * existing channels: team notifications (bell + optional sound in the team
 * workspace), the owner's dashboard alert widget (polls lead counts) and the
 * built-in owner notification. The phone is always masked in alert text.
 * Alerts never throw: a failed notification must not break the chat.
 */
import { and, eq } from "drizzle-orm";
import { staffAccounts, teamNotifications, users } from "../../drizzle/schema";
import type { Lang } from "../../shared/leadBot/catalog";
import { slotValueLabel, type EscalationReason } from "../../shared/leadBot/engine";
import { GRADE_LABELS } from "../../shared/leadBot/scoring";
import { maskPhone } from "../../shared/leadBot/text";
import type { LeadSlots } from "../../shared/leadBot/understanding";
import { notifyOwner } from "../_core/notification";
import { getDb } from "../db";
import { buildNotificationContent } from "../notificationTemplateStore";
import type { LeadRecord } from "./repo";

export const LEAD_NOTIFICATION_TYPES = ["lead_handoff_requested", "lead_hot"] as const;

const SUMMARY_LABELS: Record<Lang, Record<"name" | "phone" | "service" | "customerType" | "urgency" | "city", string>> = {
  ar: { name: "الاسم", phone: "الجوال", service: "الخدمة", customerType: "النوع", urgency: "الموعد", city: "المدينة" },
  en: { name: "Name", phone: "Phone", service: "Service", customerType: "Type", urgency: "Timing", city: "City" },
};

export function leadReference(leadId: number) {
  return `LEAD-${leadId}`;
}

/** Short alert summary; the phone is masked, missing fields are skipped. */
export function leadAlertSummary(slots: LeadSlots, lang: Lang): string {
  const labels = SUMMARY_LABELS[lang];
  const parts: string[] = [];
  if (slots.name) parts.push(`${labels.name}: ${slots.name}`);
  if (slots.phone) parts.push(`${labels.phone}: ${maskPhone(slots.phone)}`);
  for (const field of ["service", "customerType", "urgency", "city"] as const) {
    if (slots[field]) parts.push(`${labels[field]}: ${slotValueLabel(field, slots, lang)}`);
  }
  if (!parts.length) return lang === "ar" ? "لم يترك بيانات بعد." : "No details yet.";
  return `${parts.join(lang === "ar" ? "، " : ", ")}.`.slice(0, 480);
}

function reasonText(reason: EscalationReason, lang: Lang) {
  if (reason === "complaint") return lang === "ar" ? "شكوى" : "Complaint";
  return lang === "ar" ? "طلب التحدث مع موظف" : "Asked to talk to a person";
}

async function activeEmployeeUserIds(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ userId: staffAccounts.userId })
    .from(staffAccounts)
    .innerJoin(users, eq(users.id, staffAccounts.userId))
    .where(and(eq(staffAccounts.role, "employee"), eq(staffAccounts.isActive, true), eq(users.role, "employee")));
  return Array.from(new Set(rows.map((row) => row.userId).filter((id): id is number => typeof id === "number")));
}

async function deliver(
  key: "team.lead_handoff_requested" | "team.lead_hot",
  variables: Record<string, unknown> & { ar: Record<string, unknown>; en: Record<string, unknown> },
  ownerFooter: string,
) {
  const db = await getDb();
  if (!db) return { team: 0, owner: false };
  const content = await buildNotificationContent(db, key, variables);
  let team = 0;
  try {
    const recipients = await activeEmployeeUserIds();
    if (recipients.length) {
      await db.insert(teamNotifications).values(
        recipients.map((recipientUserId) => ({
          recipientUserId,
          requestId: null,
          type: content.type,
          title: content.title,
          message: content.message,
          titleEn: content.titleEn,
          messageEn: content.messageEn,
        })),
      );
      team = recipients.length;
    }
  } catch (error) {
    console.warn("[LeadBot] Team alert failed:", error instanceof Error ? error.message : error);
  }
  let owner = false;
  try {
    owner = await notifyOwner({ title: content.title, content: `${content.message}\n${ownerFooter}` });
  } catch (error) {
    console.warn("[LeadBot] Owner alert failed:", error instanceof Error ? error.message : error);
  }
  return { team, owner };
}

export async function notifyHandoffRequested(lead: LeadRecord, reason: EscalationReason) {
  try {
    const ref = leadReference(lead.id);
    return await deliver(
      "team.lead_handoff_requested",
      {
        lead: ref,
        ar: { reason: reasonText(reason, "ar"), summary: leadAlertSummary(lead.slots, "ar") },
        en: { reason: reasonText(reason, "en"), summary: leadAlertSummary(lead.slots, "en") },
      },
      `رقم العميل المحتمل: ${ref} — افتح «مساعد المبيعات» في لوحة الإدارة.`,
    );
  } catch (error) {
    console.warn("[LeadBot] Handoff alert failed:", error instanceof Error ? error.message : error);
    return { team: 0, owner: false };
  }
}

export async function notifyHotLead(lead: LeadRecord) {
  try {
    const ref = leadReference(lead.id);
    return await deliver(
      "team.lead_hot",
      {
        lead: ref,
        score: String(lead.score),
        ar: { summary: leadAlertSummary(lead.slots, "ar") },
        en: { summary: leadAlertSummary(lead.slots, "en") },
      },
      `${GRADE_LABELS.hot.ar} — رقم العميل المحتمل: ${ref}`,
    );
  } catch (error) {
    console.warn("[LeadBot] Hot lead alert failed:", error instanceof Error ? error.message : error);
    return { team: 0, owner: false };
  }
}
