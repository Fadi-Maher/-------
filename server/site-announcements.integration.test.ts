import { and, eq, inArray, like } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { auditLogs, siteAnnouncements, users } from "../drizzle/schema";
import { getDb } from "./db";
import {
  createAnnouncement,
  deleteAnnouncement,
  getLiveAnnouncement,
  invalidateAnnouncementCache,
  listAnnouncementsForAdmin,
  setAnnouncementActive,
  updateAnnouncement,
  type SiteContentActor,
} from "./siteContentDb";

/**
 * Uses a far-future window (year 2099) so the test announcement can never be shown on the
 * real public site while the test runs. Every row and audit entry it creates is removed.
 */
const FUTURE_START = 4_070_908_800_000; // 2099-01-01T00:00:00Z
const MARKER = `[site-content-test-${Date.now()}]`;
const createdIds: number[] = [];

const base = {
  messageAr: `إعلان اختبار آلي ${MARKER}`,
  messageEn: `Automated test announcement ${MARKER}`,
  linkUrl: "/contact",
  linkLabelAr: "تواصل",
  linkLabelEn: "Contact",
  tone: "info" as const,
  isActive: false,
  dismissible: true,
  startsAt: FUTURE_START,
  endsAt: FUTURE_START + 60_000,
};

async function actor(): Promise<SiteContentActor> {
  const db = await getDb();
  const user = (await db!.select({ id: users.id }).from(users).limit(1))[0];
  if (!user) throw new Error("No user available for the audit actor");
  return { userId: user.id, name: "اختبار آلي" };
}

afterAll(async () => {
  const db = await getDb();
  if (!db || !createdIds.length) return;
  await db.delete(siteAnnouncements).where(inArray(siteAnnouncements.id, createdIds));
  await db.delete(auditLogs).where(and(like(auditLogs.action, "announcement_%"), eq(auditLogs.actorName, "اختبار آلي")));
  invalidateAnnouncementCache();
});

describe("site announcements database flow", () => {
  it("rejects unsafe links and inverted windows before writing", async () => {
    const who = await actor();
    await expect(createAnnouncement({ ...base, linkUrl: "javascript:alert(1)" }, who)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(createAnnouncement({ ...base, linkUrl: "//evil.example" }, who)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(createAnnouncement({ ...base, endsAt: FUTURE_START }, who)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const db = await getDb();
    const leaked = await db!.select({ id: siteAnnouncements.id }).from(siteAnnouncements).where(like(siteAnnouncements.messageEn, `%${MARKER}%`));
    expect(leaked).toHaveLength(0);
  }, 20_000);

  it("creates, edits, pauses and deletes with an audit trail while never going live early", async () => {
    const who = await actor();
    const created = await createAnnouncement(base, who);
    expect(created).toBeTruthy();
    createdIds.push(created!.id);
    expect(created).toMatchObject({ linkUrl: "/contact", isActive: false, startsAt: FUTURE_START });

    const admin = await listAnnouncementsForAdmin();
    expect(admin.some((item) => item.id === created!.id)).toBe(true);

    const updated = await updateAnnouncement(created!.id, { ...base, isActive: true, linkUrl: "", linkLabelAr: "تجاهل", tone: "warning" }, who);
    expect(updated).toMatchObject({ isActive: true, tone: "warning", linkUrl: null, linkLabelAr: null, linkLabelEn: null });

    invalidateAnnouncementCache();
    const live = await getLiveAnnouncement();
    expect(live?.id).not.toBe(created!.id);

    await setAnnouncementActive(created!.id, false, who);
    const db = await getDb();
    const paused = (await db!.select().from(siteAnnouncements).where(eq(siteAnnouncements.id, created!.id)))[0];
    expect(paused.isActive).toBe(false);

    await deleteAnnouncement(created!.id, who);
    const remaining = await db!.select().from(siteAnnouncements).where(eq(siteAnnouncements.id, created!.id));
    expect(remaining).toHaveLength(0);
    await expect(deleteAnnouncement(created!.id, who)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const audit = await db!.select({ action: auditLogs.action }).from(auditLogs).where(and(like(auditLogs.action, "announcement_%"), eq(auditLogs.actorName, "اختبار آلي")));
    expect(audit.map((row) => row.action)).toEqual(expect.arrayContaining(["announcement_created", "announcement_updated", "announcement_paused", "announcement_deleted"]));
  }, 30_000);
});
