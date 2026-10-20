import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { auditLogs, notificationTemplates, siteAnnouncements } from "../drizzle/schema";
import { announcementVersion, normalizeAnnouncementLink, pickLiveAnnouncement, type AnnouncementTone } from "../shared/announcements";
import {
  validateNotificationTemplate,
  type NotificationTemplateKey,
  type NotificationTemplateText,
} from "../shared/notificationTemplates";
import { getDb } from "./db";
import { invalidateNotificationTemplateCache } from "./notificationTemplateStore";

export type SiteContentActor = { userId: number; name: string | null };

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

function trimText(text: NotificationTemplateText): NotificationTemplateText {
  return { titleAr: text.titleAr.trim(), messageAr: text.messageAr.trim(), titleEn: text.titleEn.trim(), messageEn: text.messageEn.trim() };
}

export async function listNotificationTemplateOverrides() {
  const db = await requireDb();
  return db.select().from(notificationTemplates);
}

export async function saveNotificationTemplate(key: NotificationTemplateKey, input: NotificationTemplateText, actor: SiteContentActor) {
  const text = trimText(input);
  const issues = validateNotificationTemplate(key, text);
  if (issues.length) throw new TRPCError({ code: "BAD_REQUEST", message: "نص الإشعار غير صالح. راجع الحقول والمتغيرات المسموحة.", cause: issues });
  const db = await requireDb();
  await db.transaction(async (tx) => {
    const before = (await tx.select().from(notificationTemplates).where(eq(notificationTemplates.templateKey, key)).limit(1).for("update"))[0];
    await tx
      .insert(notificationTemplates)
      .values({ templateKey: key, ...text, updatedByUserId: actor.userId })
      .onDuplicateKeyUpdate({ set: { ...text, updatedByUserId: actor.userId } });
    await tx.insert(auditLogs).values({
      actorUserId: actor.userId,
      actorRole: "admin",
      actorName: actor.name,
      requestId: null,
      action: "notification_template_updated",
      summary: `عدّل المالك نص الإشعار التلقائي (${key}).`,
      beforeJson: before ? JSON.stringify({ titleAr: before.titleAr, messageAr: before.messageAr, titleEn: before.titleEn, messageEn: before.messageEn }) : JSON.stringify({ default: true }),
      afterJson: JSON.stringify(text),
    });
  });
  invalidateNotificationTemplateCache();
  return (await db.select().from(notificationTemplates).where(eq(notificationTemplates.templateKey, key)).limit(1))[0];
}

export async function resetNotificationTemplate(key: NotificationTemplateKey, actor: SiteContentActor) {
  const db = await requireDb();
  const removed = await db.transaction(async (tx) => {
    const before = (await tx.select().from(notificationTemplates).where(eq(notificationTemplates.templateKey, key)).limit(1).for("update"))[0];
    if (!before) return false;
    await tx.delete(notificationTemplates).where(eq(notificationTemplates.templateKey, key));
    await tx.insert(auditLogs).values({
      actorUserId: actor.userId,
      actorRole: "admin",
      actorName: actor.name,
      requestId: null,
      action: "notification_template_reset",
      summary: `أعاد المالك نص الإشعار التلقائي (${key}) إلى النص الافتراضي.`,
      beforeJson: JSON.stringify({ titleAr: before.titleAr, messageAr: before.messageAr, titleEn: before.titleEn, messageEn: before.messageEn }),
      afterJson: JSON.stringify({ default: true }),
    });
    return true;
  });
  invalidateNotificationTemplateCache();
  return { reset: removed };
}

export type AnnouncementInput = {
  messageAr: string;
  messageEn: string;
  linkUrl?: string | null;
  linkLabelAr?: string | null;
  linkLabelEn?: string | null;
  tone: AnnouncementTone;
  isActive: boolean;
  dismissible: boolean;
  startsAt: number;
  endsAt?: number | null;
};

function cleanAnnouncement(input: AnnouncementInput) {
  const link = normalizeAnnouncementLink(input.linkUrl);
  if (link === "invalid") throw new TRPCError({ code: "BAD_REQUEST", message: "الرابط يجب أن يبدأ بـ / لصفحة في الموقع أو https:// لموقع خارجي." });
  const endsAt = input.endsAt ?? null;
  if (endsAt !== null && endsAt <= input.startsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "وقت انتهاء الإعلان يجب أن يكون بعد وقت بدايته." });
  return {
    messageAr: input.messageAr.trim(),
    messageEn: input.messageEn.trim(),
    linkUrl: link,
    linkLabelAr: link ? input.linkLabelAr?.trim() || null : null,
    linkLabelEn: link ? input.linkLabelEn?.trim() || null : null,
    tone: input.tone,
    isActive: input.isActive,
    dismissible: input.dismissible,
    startsAt: input.startsAt,
    endsAt,
  };
}

const LIVE_CACHE_MS = 15_000;
let liveCache: { value: PublicAnnouncement | null; expiresAt: number } | null = null;

export function invalidateAnnouncementCache() {
  liveCache = null;
}

export type PublicAnnouncement = {
  id: number;
  version: string;
  messageAr: string;
  messageEn: string;
  linkUrl: string | null;
  linkLabelAr: string | null;
  linkLabelEn: string | null;
  tone: AnnouncementTone;
  dismissible: boolean;
};

export async function getLiveAnnouncement(now = Date.now()): Promise<PublicAnnouncement | null> {
  if (liveCache && liveCache.expiresAt > now) return liveCache.value;
  const db = await requireDb();
  const rows = await db
    .select()
    .from(siteAnnouncements)
    .where(and(eq(siteAnnouncements.isActive, true), lte(siteAnnouncements.startsAt, now), or(isNull(siteAnnouncements.endsAt), gt(siteAnnouncements.endsAt, now))))
    .orderBy(desc(siteAnnouncements.startsAt), desc(siteAnnouncements.updatedAt), desc(siteAnnouncements.id))
    .limit(5);
  const live = pickLiveAnnouncement(rows, now);
  const value: PublicAnnouncement | null = live
    ? {
        id: live.id,
        version: announcementVersion(live),
        messageAr: live.messageAr,
        messageEn: live.messageEn,
        linkUrl: live.linkUrl,
        linkLabelAr: live.linkLabelAr,
        linkLabelEn: live.linkLabelEn,
        tone: live.tone,
        dismissible: live.dismissible,
      }
    : null;
  const expiresAt = Math.min(now + LIVE_CACHE_MS, live?.endsAt ?? Number.POSITIVE_INFINITY);
  liveCache = { value, expiresAt };
  return value;
}

export async function listAnnouncementsForAdmin() {
  const db = await requireDb();
  return db.select().from(siteAnnouncements).orderBy(desc(siteAnnouncements.createdAt), desc(siteAnnouncements.id)).limit(50);
}

async function writeAnnouncementAudit(
  executor: Parameters<Parameters<Awaited<ReturnType<typeof requireDb>>["transaction"]>[0]>[0],
  actor: SiteContentActor,
  action: string,
  summary: string,
  before: unknown,
  after: unknown,
) {
  await executor.insert(auditLogs).values({
    actorUserId: actor.userId,
    actorRole: "admin",
    actorName: actor.name,
    requestId: null,
    action,
    summary,
    beforeJson: before === null ? null : JSON.stringify(before),
    afterJson: after === null ? null : JSON.stringify(after),
  });
}

export async function createAnnouncement(input: AnnouncementInput, actor: SiteContentActor) {
  const values = cleanAnnouncement(input);
  const db = await requireDb();
  const id = await db.transaction(async (tx) => {
    const result = await tx.insert(siteAnnouncements).values({ ...values, createdByUserId: actor.userId });
    const insertedId = Number(result[0].insertId);
    await writeAnnouncementAudit(tx, actor, "announcement_created", "أنشأ المالك إعلانًا عامًا في أعلى الموقع.", null, { id: insertedId, ...values });
    return insertedId;
  });
  invalidateAnnouncementCache();
  return (await db.select().from(siteAnnouncements).where(eq(siteAnnouncements.id, id)).limit(1))[0];
}

export async function updateAnnouncement(id: number, input: AnnouncementInput, actor: SiteContentActor) {
  const values = cleanAnnouncement(input);
  const db = await requireDb();
  await db.transaction(async (tx) => {
    const before = (await tx.select().from(siteAnnouncements).where(eq(siteAnnouncements.id, id)).limit(1).for("update"))[0];
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "الإعلان غير موجود." });
    await tx.update(siteAnnouncements).set(values).where(eq(siteAnnouncements.id, id));
    await writeAnnouncementAudit(tx, actor, "announcement_updated", "عدّل المالك إعلانًا عامًا.", before, { id, ...values });
  });
  invalidateAnnouncementCache();
  return (await db.select().from(siteAnnouncements).where(eq(siteAnnouncements.id, id)).limit(1))[0];
}

export async function setAnnouncementActive(id: number, isActive: boolean, actor: SiteContentActor) {
  const db = await requireDb();
  await db.transaction(async (tx) => {
    const before = (await tx.select().from(siteAnnouncements).where(eq(siteAnnouncements.id, id)).limit(1).for("update"))[0];
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "الإعلان غير موجود." });
    if (before.isActive === isActive) return;
    await tx.update(siteAnnouncements).set({ isActive }).where(eq(siteAnnouncements.id, id));
    await writeAnnouncementAudit(tx, actor, isActive ? "announcement_enabled" : "announcement_paused", isActive ? "فعّل المالك إعلانًا عامًا." : "أوقف المالك إعلانًا عامًا.", { isActive: before.isActive }, { isActive });
  });
  invalidateAnnouncementCache();
  return { success: true } as const;
}

export async function deleteAnnouncement(id: number, actor: SiteContentActor) {
  const db = await requireDb();
  await db.transaction(async (tx) => {
    const before = (await tx.select().from(siteAnnouncements).where(eq(siteAnnouncements.id, id)).limit(1).for("update"))[0];
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "الإعلان غير موجود." });
    await tx.delete(siteAnnouncements).where(eq(siteAnnouncements.id, id));
    await writeAnnouncementAudit(tx, actor, "announcement_deleted", "حذف المالك إعلانًا عامًا.", before, null);
  });
  invalidateAnnouncementCache();
  return { success: true } as const;
}
