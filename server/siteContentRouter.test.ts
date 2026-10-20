import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  listNotificationTemplateOverrides: vi.fn(),
  saveNotificationTemplate: vi.fn(),
  resetNotificationTemplate: vi.fn(),
  getLiveAnnouncement: vi.fn(),
  listAnnouncementsForAdmin: vi.fn(),
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  setAnnouncementActive: vi.fn(),
  deleteAnnouncement: vi.fn(),
}));
vi.mock("./siteContentDb", () => mocks);

import { notificationTemplatesRouter, siteAnnouncementsRouter } from "./siteContentRouter";

function context(role: "admin" | "agent" | "employee" | "user" | null): TrpcContext {
  return {
    user: role
      ? { id: 91, role, openId: `site-content-${role}`, name: "مالك الاختبار", email: "owner@example.test", loginMethod: "test", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }
      : null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

const announcement = {
  messageAr: "خصم خاص على خدمات التعقيب هذا الأسبوع",
  messageEn: "Special discount on follow-up services this week",
  linkUrl: "/contact",
  linkLabelAr: "تواصل معنا",
  linkLabelEn: "Contact us",
  tone: "success" as const,
  isActive: true,
  dismissible: true,
  startsAt: 1_800_000_000_000,
  endsAt: 1_800_086_400_000,
};

const templateInput = { key: "customer.quote_selected" as const, titleAr: "تم اختيار العرض", messageAr: "أُبلغ {provider}", titleEn: "Selected", messageEn: "{provider} notified" };

async function expectCode(promise: Promise<unknown>, code: TRPCError["code"]) {
  await expect(promise).rejects.toMatchObject({ code });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getLiveAnnouncement.mockResolvedValue(null);
  mocks.listNotificationTemplateOverrides.mockResolvedValue([]);
  mocks.listAnnouncementsForAdmin.mockResolvedValue([]);
  mocks.saveNotificationTemplate.mockResolvedValue({ updatedAt: new Date(0) });
  mocks.resetNotificationTemplate.mockResolvedValue({ reset: true });
  mocks.createAnnouncement.mockResolvedValue({ id: 5 });
  mocks.updateAnnouncement.mockResolvedValue({ id: 5 });
  mocks.setAnnouncementActive.mockResolvedValue({ success: true });
  mocks.deleteAnnouncement.mockResolvedValue({ success: true });
});

describe("site content router permissions", () => {
  it("lets any visitor read the live announcement only", async () => {
    mocks.getLiveAnnouncement.mockResolvedValue({ id: 3, version: "3:1", ...announcement });
    await expect(siteAnnouncementsRouter.createCaller(context(null)).live()).resolves.toMatchObject({ id: 3 });
    expect(mocks.getLiveAnnouncement).toHaveBeenCalledTimes(1);
  });

  it.each([
    [null, "UNAUTHORIZED"],
    ["user", "FORBIDDEN"],
    ["agent", "FORBIDDEN"],
    ["employee", "FORBIDDEN"],
  ] as const)("blocks %s from every management procedure", async (role, code) => {
    const templates = notificationTemplatesRouter.createCaller(context(role));
    const announcements = siteAnnouncementsRouter.createCaller(context(role));
    await expectCode(templates.list(), code);
    await expectCode(templates.save(templateInput), code);
    await expectCode(templates.reset({ key: "customer.quote_selected" }), code);
    await expectCode(announcements.list(), code);
    await expectCode(announcements.create(announcement), code);
    await expectCode(announcements.update({ id: 5, ...announcement }), code);
    await expectCode(announcements.setActive({ id: 5, isActive: false }), code);
    await expectCode(announcements.delete({ id: 5 }), code);
    Object.entries(mocks).forEach(([name, fn]) => {
      if (name !== "getLiveAnnouncement") expect(fn).not.toHaveBeenCalled();
    });
  });

  it("passes the signed-in owner as the actor, never data from the request", async () => {
    const templates = notificationTemplatesRouter.createCaller(context("admin"));
    await templates.save({ ...templateInput, actorUserId: 1 } as typeof templateInput);
    expect(mocks.saveNotificationTemplate).toHaveBeenCalledWith(
      "customer.quote_selected",
      { titleAr: templateInput.titleAr, messageAr: templateInput.messageAr, titleEn: templateInput.titleEn, messageEn: templateInput.messageEn },
      { userId: 91, name: "مالك الاختبار" },
    );
    await templates.reset({ key: "team.customer_review" });
    expect(mocks.resetNotificationTemplate).toHaveBeenCalledWith("team.customer_review", { userId: 91, name: "مالك الاختبار" });

    const announcements = siteAnnouncementsRouter.createCaller(context("admin"));
    await announcements.create(announcement);
    expect(mocks.createAnnouncement).toHaveBeenCalledWith(announcement, { userId: 91, name: "مالك الاختبار" });
    await announcements.update({ id: 5, ...announcement });
    expect(mocks.updateAnnouncement).toHaveBeenCalledWith(5, announcement, { userId: 91, name: "مالك الاختبار" });
    await announcements.setActive({ id: 5, isActive: false });
    expect(mocks.setAnnouncementActive).toHaveBeenCalledWith(5, false, { userId: 91, name: "مالك الاختبار" });
    await announcements.delete({ id: 5 });
    expect(mocks.deleteAnnouncement).toHaveBeenCalledWith(5, { userId: 91, name: "مالك الاختبار" });
  });

  it("validates template keys, tones, lengths and timestamps before reaching the database", async () => {
    const templates = notificationTemplatesRouter.createCaller(context("admin"));
    await expectCode(templates.save({ ...templateInput, key: "customer.unknown" as typeof templateInput.key }), "BAD_REQUEST");
    await expectCode(templates.save({ ...templateInput, messageAr: "x".repeat(600) }), "BAD_REQUEST");
    const announcements = siteAnnouncementsRouter.createCaller(context("admin"));
    await expectCode(announcements.create({ ...announcement, tone: "danger" as "info" }), "BAD_REQUEST");
    await expectCode(announcements.create({ ...announcement, messageAr: "  " }), "BAD_REQUEST");
    await expectCode(announcements.create({ ...announcement, startsAt: 12 }), "BAD_REQUEST");
    await expectCode(announcements.create({ ...announcement, endsAt: 9_999_999_999_999 }), "BAD_REQUEST");
    await expectCode(announcements.setActive({ id: -1, isActive: true }), "BAD_REQUEST");
    expect(mocks.saveNotificationTemplate).not.toHaveBeenCalled();
    expect(mocks.createAnnouncement).not.toHaveBeenCalled();
  });
});
