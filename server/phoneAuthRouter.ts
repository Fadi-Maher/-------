import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { publicProcedure, router } from "./_core/trpc";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { getActiveAgentAccountByPhone } from "./db";
import {
  requestPhoneCode,
  resendPhoneCode,
  verifyPhoneCode,
} from "./phoneOtpDb";
import { verifyPhoneLoginTicket } from "./phoneLoginTicket";

const language = z.enum(["ar", "en"]).default("ar");
export const phoneAuthRouter = router({
  config: publicProcedure.query(() => ({
    mode: "demo" as const,
    realMessagesSent: false,
  })),
  requestCode: publicProcedure
    .input(z.object({ phone: z.string().regex(/^05\d{8}$/), language }))
    .mutation(({ input }) => requestPhoneCode(input.phone, input.language)),
  resendCode: publicProcedure
    .input(z.object({ challengeId: z.string().uuid(), language }))
    .mutation(({ input }) =>
      resendPhoneCode(input.challengeId, input.language)
    ),
  verifyCode: publicProcedure
    .input(
      z.object({
        challengeId: z.string().uuid(),
        code: z.string().regex(/^\d{6}$/),
        clientKey: z.string().uuid(),
        language,
      })
    )
    .mutation(({ input }) => verifyPhoneCode(input)),
  agentSignIn: publicProcedure
    .input(z.object({ verificationToken: z.string().min(20).max(500) }))
    .mutation(async ({ input, ctx }) => {
      const phone = verifyPhoneLoginTicket(input.verificationToken);
      const account = await getActiveAgentAccountByPhone(phone);
      if (!account)
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "حساب المعقب غير مفعّل. أرسل طلب انضمام وانتظر موافقة الإدارة.",
        });
      const maxAge = 30 * 24 * 60 * 60 * 1000;
      const token = await sdk.createSessionToken(account.user.openId, {
        expiresInMs: maxAge,
        name: account.fullName,
      });
      ctx.res.cookie(COOKIE_NAME, token, {
        ...getSessionCookieOptions(ctx.req),
        maxAge,
      });
      return {
        success: true as const,
        name: account.fullName,
        role: "agent" as const,
        phone,
      };
    }),
});
