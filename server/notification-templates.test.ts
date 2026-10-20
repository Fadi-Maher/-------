import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NOTIFICATION_TEMPLATES,
  previewNotificationTemplate,
  renderNotificationTemplate,
  validateNotificationTemplate,
} from "../shared/notificationTemplates";
import {
  announcementVersion,
  getAnnouncementStatus,
  normalizeAnnouncementLink,
  pickLiveAnnouncement,
} from "../shared/announcements";
import { buildNotificationContent, invalidateNotificationTemplateCache, type NotificationExecutor } from "./notificationTemplateStore";

function executorReturning(rows: unknown[] | Error) {
  const from = vi.fn(async () => {
    if (rows instanceof Error) throw rows;
    return rows;
  });
  const select = vi.fn(() => ({ from }));
  return { executor: { select } as unknown as NotificationExecutor, select, from };
}

describe("notification template catalog", () => {
  it("keeps the original Arabic wording and notification types by default", () => {
    const quote = renderNotificationTemplate("customer.first_quote_received", { price: "350.00", days: 3 });
    expect(quote).toEqual({
      type: "first_quote_received",
      title: "وصل أول عرض سعر",
      message: "وصل أول عرض على طلبك بقيمة 350.00 ر.س ومدة 3 يوم. افتح طلباتي للمقارنة.",
      titleEn: "Your first price quote arrived",
      messageEn: "Your request received its first quote: 350.00 SAR in 3 days. Open My requests to compare.",
    });
    expect(renderNotificationTemplate("team.customer_attachment", { customer: "سارة", file: "عقد.pdf" }).message).toBe("سارة أرفق عقد.pdf");
    expect(renderNotificationTemplate("customer.request_status_update", { message: "x" }).type).toBe("request_update");
  });

  it("uses per-language variable values and caps stored lengths", () => {
    const assigned = renderNotificationTemplate("team.request_assigned", { ar: { service: "طلب" }, en: { service: "A request" } });
    expect(assigned.message).toContain("تم إسناد طلب");
    expect(assigned.messageEn.startsWith("A request was assigned")).toBe(true);
    const long = renderNotificationTemplate("team.customer_comment", { message: "أ".repeat(900) });
    expect(long.message.length).toBeLessThanOrEqual(500);
  });

  it("renders the join-request decision templates for the applicant", () => {
    const approved = renderNotificationTemplate("team.agent_application_approved", { name: "سارة", reference: "JOIN-12", note: "" });
    expect(approved.type).toBe("agent_application_approved");
    expect(approved.title).toBe("تمت الموافقة على طلب انضمامك");
    expect(approved.message).toContain("مرحبًا سارة");
    expect(approved.message).toContain("JOIN-12");
    expect(approved.messageEn).toContain("Application JOIN-12 was approved");
    const rejected = renderNotificationTemplate("team.agent_application_rejected", { name: "Sara", reference: "JOIN-13", note: "Missing license" });
    expect(rejected.type).toBe("agent_application_rejected");
    expect(rejected.titleEn).toBe("Your application was not approved");
    expect(rejected.messageEn).toContain("JOIN-13");
    // The owner may surface the reason directly in an edited template.
    const withReason = renderNotificationTemplate(
      "team.agent_application_rejected",
      { name: "Sara", reference: "JOIN-13", note: "Missing license" },
      { messageEn: "Sorry {name}, {reference} was declined: {note}" },
    );
    expect(withReason.messageEn).toBe("Sorry Sara, JOIN-13 was declined: Missing license");
    const decisionTemplates = NOTIFICATION_TEMPLATES.filter((template) => template.key.startsWith("team.agent_application_"));
    expect(decisionTemplates.map((template) => template.audience)).toEqual(["team", "team"]);
    for (const template of decisionTemplates) {
      expect(template.variables.map((variable) => variable.name)).toEqual(["name", "reference", "note"]);
    }
  });

  it("has defaults that pass their own validation for every template", () => {
    NOTIFICATION_TEMPLATES.forEach((template) => {
      expect(validateNotificationTemplate(template.key, template.defaults)).toEqual([]);
    });
  });

  it("rejects unknown variables, stray braces, empty and long fields", () => {
    const base = { titleAr: "عنوان", messageAr: "نص {provider}", titleEn: "Title", messageEn: "Text {provider}" };
    expect(validateNotificationTemplate("customer.quote_selected", base)).toEqual([]);
    const issues = validateNotificationTemplate("customer.quote_selected", { ...base, messageAr: "نص {phone}", titleEn: "  ", messageEn: "Broken {provider", titleAr: "ع".repeat(121) });
    expect(issues).toEqual(
      expect.arrayContaining([
        { field: "messageAr", code: "unknown_variable", variable: "phone" },
        { field: "titleEn", code: "required" },
        { field: "messageEn", code: "unbalanced_braces" },
        { field: "titleAr", code: "too_long" },
      ]),
    );
  });

  it("applies a valid override and ignores an invalid one", () => {
    const valid = renderNotificationTemplate("customer.quote_withdrawn", { provider: "أحمد" }, { titleAr: "سحب عرض", messageAr: "{provider} سحب عرضه", titleEn: "Withdrawn", messageEn: "{provider} withdrew" });
    expect(valid.title).toBe("سحب عرض");
    expect(valid.message).toBe("أحمد سحب عرضه");
    const invalid = renderNotificationTemplate("customer.quote_withdrawn", { provider: "أحمد" }, { titleAr: "سحب", messageAr: "{secret}", titleEn: "x", messageEn: "y" });
    expect(invalid.title).toBe("تم سحب عرض سعر");
  });

  it("falls back to the default text when an override renders empty and strips control characters", () => {
    const rendered = renderNotificationTemplate("team.customer_comment", { message: "" }, { titleAr: "رسالة", messageAr: "{message}", titleEn: "Message", messageEn: "{message}" });
    expect(rendered.message).toBe("");
    const cleaned = renderNotificationTemplate("customer.quote_selected", { provider: "علي\u0000\u0007 الجهني" });
    expect(cleaned.message).toContain("علي");
    expect(cleaned.message).toContain("الجهني");
    expect(cleaned.message).not.toMatch(/[\u0000-\u0008]/);
  });

  it("previews with the sample values", () => {
    const template = NOTIFICATION_TEMPLATES.find((item) => item.key === "team.customer_review")!;
    const preview = previewNotificationTemplate(template.key, template.defaults);
    expect(preview.messageAr).toBe("قيّم العميل الخدمة 5 من 5.");
    expect(preview.messageEn).toBe("The customer rated the service 5 out of 5.");
  });
});

describe("notification template store", () => {
  beforeEach(() => invalidateNotificationTemplateCache());

  it("uses saved wording and caches it until invalidated", async () => {
    const { executor, select } = executorReturning([
      { templateKey: "team.quote_selected", titleAr: "عرضك مختار", messageAr: "أكد خلال ساعتين", titleEn: "Selected", messageEn: "Confirm within two hours" },
      { templateKey: "unknown.key", titleAr: "x", messageAr: "x", titleEn: "x", messageEn: "x" },
    ]);
    const first = await buildNotificationContent(executor, "team.quote_selected");
    expect(first).toMatchObject({ type: "quote_selected", title: "عرضك مختار", titleEn: "Selected" });
    await buildNotificationContent(executor, "team.quote_declined");
    expect(select).toHaveBeenCalledTimes(1);
    invalidateNotificationTemplateCache();
    await buildNotificationContent(executor, "team.quote_selected");
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("never blocks a notification when templates cannot be read", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { executor } = executorReturning(new Error("db down"));
    const content = await buildNotificationContent(executor, "customer.request_received", { provider: "خالد" });
    expect(content.message).toBe("خالد أكد استلام طلبك وبدأت مرحلة التنفيذ.");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("announcement rules", () => {
  it("accepts only internal paths and https links", () => {
    expect(normalizeAnnouncementLink("")).toBeNull();
    expect(normalizeAnnouncementLink(" /contact ")).toBe("/contact");
    expect(normalizeAnnouncementLink("/#services")).toBe("/#services");
    expect(normalizeAnnouncementLink("https://example.com/offer")).toBe("https://example.com/offer");
    ["//evil.com", "/\\evil.com", "javascript:alert(1)", "http://example.com", "data:text/html,hi", "ftp://x", "/a b", "contact"].forEach((value) => {
      expect(normalizeAnnouncementLink(value)).toBe("invalid");
    });
  });

  it("derives status from activity and time window", () => {
    const now = 1_800_000_000_000;
    expect(getAnnouncementStatus({ id: 1, isActive: false, startsAt: now - 1, endsAt: null }, now)).toBe("paused");
    expect(getAnnouncementStatus({ id: 1, isActive: true, startsAt: now + 1, endsAt: null }, now)).toBe("scheduled");
    expect(getAnnouncementStatus({ id: 1, isActive: true, startsAt: now - 10, endsAt: now }, now)).toBe("ended");
    expect(getAnnouncementStatus({ id: 1, isActive: true, startsAt: now, endsAt: now + 1 }, now)).toBe("live");
  });

  it("shows the most recently started live announcement and versions edits", () => {
    const now = 1_800_000_000_000;
    const items = [
      { id: 1, isActive: true, startsAt: now - 5000, endsAt: null, updatedAt: new Date(now - 100) },
      { id: 2, isActive: true, startsAt: now - 1000, endsAt: null, updatedAt: new Date(now - 900) },
      { id: 3, isActive: true, startsAt: now + 1000, endsAt: null, updatedAt: new Date(now) },
      { id: 4, isActive: false, startsAt: now - 10, endsAt: null, updatedAt: new Date(now) },
    ];
    expect(pickLiveAnnouncement(items, now)?.id).toBe(2);
    expect(pickLiveAnnouncement([], now)).toBeNull();
    expect(announcementVersion({ id: 2, updatedAt: new Date(5000) })).toBe("2:5000");
    expect(announcementVersion({ id: 2, updatedAt: new Date(6000) })).not.toBe(announcementVersion({ id: 2, updatedAt: new Date(5000) }));
  });
});
