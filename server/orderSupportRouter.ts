import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./orderSupportDb";
import { supportFeedbackInput } from "../shared/supportFeedback";
import {
  supportFollowupInput,
  supportImageInput,
} from "../shared/supportSharing";

const token = z.string().regex(/^[a-f0-9]{64}$/);
const sessionInput = z.object({ token });
const turn = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1200),
});
const limited = publicProcedure.use(async ({ ctx, next }) => {
  const address = String(
    ctx.req.headers["x-forwarded-for"] || ctx.req.ip || "unknown"
  )
    .split(",")[0]
    .trim();
  await db.limitSupport(`support:${address}`);
  return next();
});
export const orderSupportRouter = router({
  config: publicProcedure.query(() => db.getSupportConfig()),
  start: limited
    .input(
      z.object({
        language: z.enum(["ar", "en"]),
        consent: z.literal(true),
        turns: z.array(turn).max(280).default([]),
      })
    )
    .mutation(({ input }) => db.startSupport(input.language, input.turns)),
  history: limited
    .input(sessionInput)
    .query(({ input }) => db.readSupport(input.token)),
  send: limited
    .input(
      z.object({
        language: z.enum(["ar", "en"]),
        turns: z.array(turn).min(1).max(20),
        token: token.optional(),
        turnId: z.string().uuid(),
      })
    )
    .mutation(({ input }) => {
      if (input.turns.at(-1)?.role !== "user")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "يجب أن تنتهي المحادثة برسالة العميل.",
        });
      return db.sendSupport(input);
    }),
  handoff: limited
    .input(
      sessionInput.extend({
        consent: z.literal(true),
        attachment: supportImageInput.optional(),
      })
    )
    .mutation(({ input }) => db.handoffSupport(input.token, input.attachment)),
  forget: limited
    .input(sessionInput)
    .mutation(({ input }) => db.deleteSupport(input.token)),
  rate: limited
    .input(sessionInput.extend({ rating: z.enum(["helpful", "unhelpful"]) }))
    .mutation(({ input }) => db.rateSupport(input.token, input.rating)),
  finish: limited
    .input(sessionInput)
    .mutation(({ input }) => db.finishSupport(input.token)),
  feedback: limited
    .input(supportFeedbackInput)
    .mutation(({ input }) => db.submitSupportFeedback(input)),
  followup: limited
    .input(supportFollowupInput)
    .mutation(({ input }) => db.followupSupportFeedback(input)),
  image: limited
    .input(sessionInput.extend({ id: z.string().uuid() }))
    .query(({ input }) => db.getSupportImage(input.id, input.token)),
  admin: router({
    image: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(({ input }) => db.getSupportImage(input.id, undefined, true)),
    list: adminProcedure
      .input(
        z.object({ status: z.enum(["waiting", "human", "closed"]).optional() })
      )
      .query(({ input }) => db.listSupport(input.status)),
    detail: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(({ input }) => db.supportDetail(input.id)),
    reply: adminProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          content: z.string().trim().min(1).max(1200),
          turnId: z.string().uuid(),
        })
      )
      .mutation(({ input }) =>
        db.replySupport(input.id, input.content, input.turnId)
      ),
    close: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ input }) => db.closeSupport(input.id)),
    analytics: adminProcedure.query(() => db.supportAnalytics()),
    configure: adminProcedure
      .input(z.object({ enabled: z.boolean(), handoffEnabled: z.boolean() }))
      .mutation(({ input }) => db.updateSupportConfig(input)),
  }),
});
