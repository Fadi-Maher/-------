import { z } from "zod";
import { ANNOUNCEMENT_LINK_LABEL_MAX, ANNOUNCEMENT_MESSAGE_MAX, ANNOUNCEMENT_TONES } from "../shared/announcements";
import { NOTIFICATION_MESSAGE_MAX, NOTIFICATION_TEMPLATE_KEYS, NOTIFICATION_TITLE_MAX } from "../shared/notificationTemplates";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createAnnouncement,
  deleteAnnouncement,
  getLiveAnnouncement,
  listAnnouncementsForAdmin,
  listNotificationTemplateOverrides,
  resetNotificationTemplate,
  saveNotificationTemplate,
  setAnnouncementActive,
  updateAnnouncement,
  type SiteContentActor,
} from "./siteContentDb";

/** Reasonable bounds for UTC millisecond timestamps (2020-01-01 → 2100-01-01). */
const timestamp = z.number().int().min(1_577_836_800_000).max(4_102_444_800_000);
const templateKey = z.enum(NOTIFICATION_TEMPLATE_KEYS);
const titleText = z.string().max(NOTIFICATION_TITLE_MAX + 20);
const messageText = z.string().max(NOTIFICATION_MESSAGE_MAX + 20);
const optionalLabel = z.string().trim().max(ANNOUNCEMENT_LINK_LABEL_MAX).nullish();

export const notificationTemplateSaveInput = z.object({
  key: templateKey,
  titleAr: titleText,
  messageAr: messageText,
  titleEn: titleText,
  messageEn: messageText,
});

export const announcementInput = z.object({
  messageAr: z.string().trim().min(3).max(ANNOUNCEMENT_MESSAGE_MAX),
  messageEn: z.string().trim().min(3).max(ANNOUNCEMENT_MESSAGE_MAX),
  linkUrl: z.string().trim().max(500).nullish(),
  linkLabelAr: optionalLabel,
  linkLabelEn: optionalLabel,
  tone: z.enum(ANNOUNCEMENT_TONES),
  isActive: z.boolean(),
  dismissible: z.boolean(),
  startsAt: timestamp,
  endsAt: timestamp.nullish(),
});

const announcementId = z.object({ id: z.number().int().positive() });

function actorFrom(user: { id: number; name: string | null }): SiteContentActor {
  return { userId: user.id, name: user.name };
}

export const notificationTemplatesRouter = router({
  list: adminProcedure.query(async () => {
    const rows = await listNotificationTemplateOverrides();
    return rows.map((row) => ({
      key: row.templateKey,
      titleAr: row.titleAr,
      messageAr: row.messageAr,
      titleEn: row.titleEn,
      messageEn: row.messageEn,
      updatedAt: row.updatedAt,
    }));
  }),
  save: adminProcedure.input(notificationTemplateSaveInput).mutation(async ({ ctx, input }) => {
    const { key, ...text } = input;
    const saved = await saveNotificationTemplate(key, text, actorFrom(ctx.user));
    return { key, updatedAt: saved?.updatedAt ?? new Date() };
  }),
  reset: adminProcedure.input(z.object({ key: templateKey })).mutation(({ ctx, input }) => resetNotificationTemplate(input.key, actorFrom(ctx.user))),
});

export const siteAnnouncementsRouter = router({
  /** Public: the single announcement currently visible on the public site (or null). */
  live: publicProcedure.query(() => getLiveAnnouncement()),
  list: adminProcedure.query(() => listAnnouncementsForAdmin()),
  create: adminProcedure.input(announcementInput).mutation(({ ctx, input }) => createAnnouncement(input, actorFrom(ctx.user))),
  update: adminProcedure
    .input(announcementInput.extend({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => {
      const { id, ...values } = input;
      return updateAnnouncement(id, values, actorFrom(ctx.user));
    }),
  setActive: adminProcedure
    .input(announcementId.extend({ isActive: z.boolean() }))
    .mutation(({ ctx, input }) => setAnnouncementActive(input.id, input.isActive, actorFrom(ctx.user))),
  delete: adminProcedure.input(announcementId).mutation(({ ctx, input }) => deleteAnnouncement(input.id, actorFrom(ctx.user))),
});
