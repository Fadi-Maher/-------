import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import {
  getAgentApplicationStatus,
  listAgentApplications,
  reviewAgentApplication,
  submitAgentApplication,
  toPublicAgentApplication,
} from "./agentApplicationsDb";
import { verifyPhoneLoginTicket } from "./phoneLoginTicket";
import { publishApplicationNotification } from "./adminApplicationNotifications";

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

  review: adminProcedure
    .input(agentApplicationReviewInput)
    .mutation(({ ctx, input }) =>
      reviewAgentApplication({
        ...input,
        actorUserId: ctx.user.id,
      }).then(toPublicAgentApplication)
    ),
});
