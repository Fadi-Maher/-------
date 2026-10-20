/**
 * tRPC contracts for the sales assistant.
 * - visitor: public procedures keyed by an unguessable conversation token.
 * - staff: owner + active sales employees (role checked on the server per call).
 * - settings: owner only.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { LEAD_SERVICE_IDS } from "../../shared/leadBot/catalog";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getLeadBotSettings, saveLeadBotSettings } from "./repo";
import {
  getPublicConfig,
  invalidateLeadBotSettingsCache,
  pollConversation,
  restartConversation,
  sendVisitorMessage,
  startOrResume,
  trackVisitorAction,
} from "./service";
import { validateSettingsInput } from "./settings";
import {
  analyticsForStaff,
  getLeadDetail,
  listLeadsForStaff,
  replyAsStaff,
  requireStaff,
  resolveLeadHandoff,
  resolveStaffRole,
  staffAlerts,
  updateLeadForStaff,
} from "./staff";

const langSchema = z.enum(["ar", "en"]);
const tokenSchema = z.string().trim().min(16).max(80).regex(/^[A-Za-z0-9_-]+$/);
const clientIdSchema = z.string().trim().min(6).max(64).regex(/^[A-Za-z0-9_.:-]+$/);
const quickReplySchema = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_:.-]+$/);
const leadIdSchema = z.number().int().positive();
const leadStatusSchema = z.enum(["new", "contacted", "qualified", "won", "lost"]);

export function requestIp(req: { headers: Record<string, unknown>; ip?: string } | undefined): string | null {
  if (!req) return null;
  const forwarded = req.headers?.["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : typeof forwarded === "string" ? forwarded : req.ip;
  const first = String(raw ?? "").split(",")[0]?.trim();
  return first ? first.slice(0, 64) : null;
}

const visitorRouter = router({
  config: publicProcedure.query(() => getPublicConfig()),
  start: publicProcedure
    .input(
      z.object({
        token: tokenSchema.optional().nullable(),
        lang: langSchema,
        pagePath: z.string().trim().max(200).optional().nullable(),
        consentToStore: z.boolean().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      startOrResume({
        token: input.token ?? null,
        lang: input.lang,
        pagePath: input.pagePath?.startsWith("/") ? input.pagePath : null,
        consentToStore: input.consentToStore,
        ip: requestIp(ctx.req as never),
      }),
    ),
  restart: publicProcedure
    .input(z.object({ token: tokenSchema, lang: langSchema }))
    .mutation(({ ctx, input }) => restartConversation({ token: input.token, lang: input.lang, ip: requestIp(ctx.req as never) })),
  send: publicProcedure
    .input(
      z
        .object({
          token: tokenSchema,
          clientId: clientIdSchema,
          text: z.string().max(2000).optional(),
          quickReply: quickReplySchema.optional(),
          label: z.string().max(120).optional(),
        })
        .refine((value) => !!value.quickReply || !!value.text?.trim(), { message: "empty_message" }),
    )
    .mutation(({ input }) => sendVisitorMessage(input)),
  poll: publicProcedure
    .input(z.object({ token: tokenSchema, afterId: z.number().int().min(0) }))
    .query(({ input }) => pollConversation(input)),
  track: publicProcedure
    .input(z.object({ token: tokenSchema, action: z.enum(["open_request_form", "open_track", "open_agent_signup", "open_contact", "whatsapp"]) }))
    .mutation(({ input }) => trackVisitorAction(input)),
});

const settingsSchema = z.object({
  enabled: z.boolean(),
  aiAssist: z.boolean(),
  autoEscalateAfterFallbacks: z.number().int().min(1).max(5),
  offerHumanToHotLeads: z.boolean(),
  workingDays: z.array(z.number().int().min(0).max(6)).max(7),
  workStartHour: z.number().int().min(0).max(23),
  workEndHour: z.number().int().min(1).max(24),
  responseSlaAr: z.string().max(80),
  responseSlaEn: z.string().max(80),
  whatsappNumber: z.string().max(24),
  services: z.array(z.enum(LEAD_SERVICE_IDS)).max(LEAD_SERVICE_IDS.length),
});

const staffRouter = router({
  /** Never throws for signed-in users: lets the UI decide whether to show the sales section. */
  access: protectedProcedure.query(async ({ ctx }) => {
    const resolved = await resolveStaffRole(ctx.user);
    return { role: resolved?.role ?? null, name: resolved?.name ?? null };
  }),
  alerts: protectedProcedure.query(async ({ ctx }) => {
    await requireStaff(ctx.user);
    return staffAlerts();
  }),
  list: protectedProcedure
    .input(
      z.object({
        query: z.string().max(80).optional(),
        grade: z.enum(["hot", "warm", "cold"]).optional(),
        status: leadStatusSchema.optional(),
        service: z.enum(LEAD_SERVICE_IDS).optional(),
        kind: z.enum(["sales", "partner"]).optional(),
        handoffOnly: z.boolean().optional(),
        unreadOnly: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireStaff(ctx.user);
      return listLeadsForStaff({ ...input, limit: 200 });
    }),
  get: protectedProcedure.input(z.object({ leadId: leadIdSchema })).query(async ({ ctx, input }) => {
    await requireStaff(ctx.user);
    return getLeadDetail(input.leadId);
  }),
  reply: protectedProcedure
    .input(z.object({ leadId: leadIdSchema, text: z.string().trim().min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const staff = await requireStaff(ctx.user);
      return replyAsStaff({ leadId: input.leadId, text: input.text, agentName: staff.name });
    }),
  resolve: protectedProcedure.input(z.object({ leadId: leadIdSchema })).mutation(async ({ ctx, input }) => {
    await requireStaff(ctx.user);
    return resolveLeadHandoff(input.leadId);
  }),
  update: protectedProcedure
    .input(
      z.object({
        leadId: leadIdSchema,
        status: leadStatusSchema.optional(),
        notes: z.string().max(2000).nullable().optional(),
        assignedTo: z.string().max(160).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireStaff(ctx.user);
      return updateLeadForStaff(input);
    }),
  analytics: protectedProcedure
    .input(z.object({ rangeDays: z.union([z.literal(7), z.literal(14), z.literal(30)]) }))
    .query(async ({ ctx, input }) => {
      await requireStaff(ctx.user);
      return analyticsForStaff(input.rangeDays);
    }),
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    await requireStaff(ctx.user, { ownerOnly: true });
    return getLeadBotSettings();
  }),
  saveSettings: protectedProcedure.input(settingsSchema).mutation(async ({ ctx, input }) => {
    const staff = await requireStaff(ctx.user, { ownerOnly: true });
    const checked = validateSettingsInput(input);
    if (!checked.ok) throw new TRPCError({ code: "BAD_REQUEST", message: checked.error });
    const saved = await saveLeadBotSettings(checked.value, staff.name);
    invalidateLeadBotSettingsCache();
    return saved;
  }),
});

export const leadBotRouter = router({
  visitor: visitorRouter,
  staff: staffRouter,
});
