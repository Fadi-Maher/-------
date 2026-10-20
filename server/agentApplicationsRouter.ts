import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import {
  getAgentApplicationStatus,
  listAgentApplications,
  recordAgentApplicationsExport,
  reviewAgentApplication,
  submitAgentApplication,
  toPublicAgentApplication,
} from "./agentApplicationsDb";
import { verifyPhoneLoginTicket } from "./phoneLoginTicket";
import { publishApplicationNotification } from "./adminApplicationNotifications";
import {
  buildAgentApplicationsExport,
  XLSX_MIME_TYPE,
} from "./agentApplicationsExport";

const verificationToken = z.string().min(1).max(500);
const permissions = z.object({
  canViewAssigned: z.boolean(),
  canUpdateStatus: z.boolean(),
  canAddCustomerUpdate: z.boolean(),
});

export const agentApplicationSubmitInput = z.object({
  verificationToken,
  fullName: z.string().trim().min(2).max(160),
  email: z
    .string()
    .trim()
    .min(3)
    .max(320)
    .email("البريد الإلكتروني غير صالح.")
    .transform(value => value.toLowerCase()),
  city: z.string().trim().min(2).max(120),
  specialty: z.string().trim().min(2).max(160),
  experienceYears: z.number().int().min(0).max(60),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform(value => value || undefined),
  consent: z.literal(true),
  documentIds: z.array(z.string().uuid()).max(2).default([]),
});

export const agentApplicationReviewInput = z
  .object({
    id: z.number().int().positive(),
    decision: z.enum(["approved", "rejected"]),
    reviewNote: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform(value => value || undefined),
    permissions,
  })
  .superRefine((input, ctx) => {
    if (
      input.decision === "rejected" &&
      (!input.reviewNote || input.reviewNote.length < 3)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["reviewNote"],
        message: "سبب الرفض يجب أن يتكون من 3 أحرف على الأقل.",
      });
    }
  });

export const agentApplicationsExportInput = z.object({
  // The same free text the owner typed; the server re-applies the list's filter.
  query: z.string().max(80).default(""),
  status: z.enum(["all", "pending", "approved", "rejected"]),
  language: z.enum(["ar", "en"]),
  timeZone: z.string().trim().max(64).optional(),
});

export const agentApplicationsRouter = router({
  status: publicProcedure
    .input(z.object({ verificationToken }))
    .query(({ input }) => {
      // The ticket establishes the only acceptable phone identity for public reads.
      const phone = verifyPhoneLoginTicket(input.verificationToken);
      return getAgentApplicationStatus(phone);
    }),

  submit: publicProcedure
    .input(agentApplicationSubmitInput)
    .mutation(({ input }) => {
      // Do not accept a phone in this payload. The signed, short-lived login ticket
      // is verified before any database access and is its sole source of identity.
      const phone = verifyPhoneLoginTicket(input.verificationToken);
      return submitAgentApplication(
        phone,
        {
          fullName: input.fullName,
          email: input.email,
          city: input.city,
          specialty: input.specialty,
          experienceYears: input.experienceYears,
          notes: input.notes,
        },
        input.documentIds
      ).then(application => {
        publishApplicationNotification();
        return toPublicAgentApplication(application);
      });
    }),

  list: adminProcedure.query(async () =>
    (await listAgentApplications()).map(application => ({
      ...application,
      ...toPublicAgentApplication(application),
    }))
  ),

  exportXlsx: adminProcedure
    .input(agentApplicationsExportInput)
    .mutation(async ({ ctx, input }) => {
      const applications = (await listAgentApplications()).map(
        toPublicAgentApplication
      );
      const result = await buildAgentApplicationsExport({
        applications,
        query: input.query,
        status: input.status,
        language: input.language,
        timeZone: input.timeZone,
        generatedAt: Date.now(),
      });
      await recordAgentApplicationsExport({
        actorUserId: ctx.user.id,
        actorName: ctx.user.name ?? null,
        count: result.count,
        status: input.status,
        searchKind: result.searchKind,
        language: input.language,
      });
      return {
        fileName: result.fileName,
        mimeType: XLSX_MIME_TYPE,
        base64: result.buffer.toString("base64"),
        count: result.count,
        truncated: result.truncated,
      };
    }),
  review: adminProcedure
    .input(agentApplicationReviewInput)
    .mutation(({ ctx, input }) =>
      reviewAgentApplication({
        ...input,
        actorUserId: ctx.user.id,
      }).then(toPublicAgentApplication)
    ),
});
