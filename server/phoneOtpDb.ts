import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { phoneOtpChallenges } from "../drizzle/schema";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import {
  issueCustomerPhoneAccess,
  issuePhoneLoginTicket,
} from "./phoneLoginTicket";

export const OTP_DEMO_CODE = "123456";
export const OTP_TTL_MS = 5 * 60_000;
export const OTP_RESEND_MS = 60_000;
export const OTP_ATTEMPTS = 5;
const SEND_WINDOW_MS = 60 * 60_000;
const SEND_LIMIT = 5;
type Language = "ar" | "en";
const message = (language: Language, ar: string, en: string) =>
  language === "en" ? en : ar;
function hashCode(id: string, code: string) {
  if (!ENV.cookieSecret)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "إعداد التحقق غير متاح.",
    });
  return createHmac("sha256", ENV.cookieSecret)
    .update(`phone-otp-v1:${id}:${code}`)
    .digest("hex");
}
function descriptor(row: typeof phoneOtpChallenges.$inferSelect, now: number) {
  return {
    challengeId: row.challengeId,
    expiresAt: row.expiresAt,
    resendAvailableAt: row.resendAvailableAt,
    serverNow: now,
    mode: "demo" as const,
    demoCode: OTP_DEMO_CODE,
  };
}
function isDuplicate(error: unknown) {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "ER_DUP_ENTRY" || e?.cause?.code === "ER_DUP_ENTRY";
}

/** Demo transport is explicit: no SMS call is made and no delivery is claimed. */
export async function requestPhoneCode(
  phone: string,
  language: Language = "ar",
  now = Date.now(),
  resendChallengeId?: string
) {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: message(
        language,
        "تعذر تجهيز الرمز الآن.",
        "The code could not be prepared right now."
      ),
    });
  try {
    return await db
      .transaction(async tx => {
        const current = (
          await tx
            .select()
            .from(phoneOtpChallenges)
            .where(eq(phoneOtpChallenges.phone, phone))
            .limit(1)
            .for("update")
        )[0];
        if (
          resendChallengeId &&
          (!current || current.challengeId !== resendChallengeId)
        )
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: message(
              language,
              "طلب التحقق غير صالح. أعد إدخال الجوال.",
              "This verification request is no longer valid. Enter your mobile again."
            ),
          });
        if (current && current.resendAvailableAt > now) {
          if (
            !resendChallengeId &&
            current.verifiedAt === null &&
            current.expiresAt > now &&
            current.attemptCount < OTP_ATTEMPTS
          )
            return descriptor(current, now);
          const seconds = Math.ceil((current.resendAvailableAt - now) / 1000);
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: message(
              language,
              `انتظر ${seconds} ثانية قبل طلب رمز جديد.`,
              `Wait ${seconds} seconds before requesting another code.`
            ),
          });
        }
        const windowStartedAt =
          current && now - current.windowStartedAt < SEND_WINDOW_MS
            ? current.windowStartedAt
            : now;
        const sendCount =
          current && windowStartedAt === current.windowStartedAt
            ? current.sendCount + 1
            : 1;
        if (sendCount > SEND_LIMIT)
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: message(
              language,
              "بلغت الحد الأقصى لطلب الرموز. حاول بعد انتهاء الساعة الحالية للتحقق.",
              "The code request limit has been reached. Try after the current verification hour ends."
            ),
          });
        const challengeId = randomUUID();
        const values = {
          phone,
          challengeId,
          codeHash: hashCode(challengeId, OTP_DEMO_CODE),
          expiresAt: now + OTP_TTL_MS,
          resendAvailableAt: now + OTP_RESEND_MS,
          attemptCount: 0,
          sendCount,
          windowStartedAt,
          verifiedAt: null,
          verifiedClientKey: null,
        };
        if (current)
          await tx
            .update(phoneOtpChallenges)
            .set(values)
            .where(eq(phoneOtpChallenges.id, current.id));
        else await tx.insert(phoneOtpChallenges).values(values);
        return {
          ...values,
          serverNow: now,
          mode: "demo" as const,
          demoCode: OTP_DEMO_CODE,
        };
      })
      .then(result => ({
        challengeId: result.challengeId,
        expiresAt: result.expiresAt,
        resendAvailableAt: result.resendAvailableAt,
        serverNow: result.serverNow,
        mode: result.mode,
        demoCode: result.demoCode,
      }));
  } catch (error) {
    if (isDuplicate(error))
      throw new TRPCError({
        code: "CONFLICT",
        message: message(
          language,
          "يوجد طلب رمز متزامن. حاول مرة أخرى.",
          "Another code request is in progress. Please try again."
        ),
      });
    throw error;
  }
}

export async function resendPhoneCode(
  challengeId: string,
  language: Language = "ar",
  now = Date.now()
) {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "تعذر تجهيز الرمز الآن.",
    });
  const row = (
    await db
      .select({ phone: phoneOtpChallenges.phone })
      .from(phoneOtpChallenges)
      .where(eq(phoneOtpChallenges.challengeId, challengeId))
      .limit(1)
  )[0];
  if (!row)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: message(
        language,
        "طلب التحقق غير صالح. أعد إدخال الجوال.",
        "This verification request is no longer valid. Enter your mobile again."
      ),
    });
  return requestPhoneCode(row.phone, language, now, challengeId);
}

export async function verifyPhoneCode(
  input: {
    challengeId: string;
    code: string;
    clientKey: string;
    language?: Language;
  },
  now = Date.now()
) {
  const language = input.language ?? "ar";
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "تعذر التحقق الآن.",
    });
  // Incorrect-attempt updates must commit, so errors are returned from the transaction and thrown afterward.
  const result = await db.transaction(async tx => {
    const row = (
      await tx
        .select()
        .from(phoneOtpChallenges)
        .where(eq(phoneOtpChallenges.challengeId, input.challengeId))
        .limit(1)
        .for("update")
    )[0];
    const fail = (ar: string, en: string) =>
      ({ error: message(language, ar, en) }) as const;
    if (!row)
      return fail(
        "طلب التحقق غير صالح. اطلب رمزًا جديدًا.",
        "This verification request is invalid. Request a new code."
      );
    if (row.expiresAt <= now)
      return fail(
        "انتهت صلاحية الرمز. أعد إرسال رمز جديد.",
        "The code has expired. Request another code."
      );
    if (row.attemptCount >= OTP_ATTEMPTS)
      return fail(
        "استنفدت محاولات التحقق. أعد إرسال رمز جديد بعد انتهاء المهلة.",
        "Verification attempts have been exhausted. Request a new code after the cooldown."
      );
    const expected = hashCode(row.challengeId, input.code);
    const matched =
      expected.length === row.codeHash.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(row.codeHash));
    if (row.verifiedAt !== null) {
      if (matched && row.verifiedClientKey === input.clientKey)
        return { phone: row.phone, verifiedAt: row.verifiedAt } as const;
      return fail(
        "استُخدم هذا الرمز من قبل. اطلب رمزًا جديدًا.",
        "This code has already been used. Request a new code."
      );
    }
    if (!matched) {
      const count = row.attemptCount + 1;
      await tx
        .update(phoneOtpChallenges)
        .set({ attemptCount: count })
        .where(eq(phoneOtpChallenges.id, row.id));
      return count >= OTP_ATTEMPTS
        ? fail(
            "استنفدت محاولات التحقق. أعد إرسال رمز جديد بعد انتهاء المهلة.",
            "Verification attempts have been exhausted. Request a new code after the cooldown."
          )
        : fail(
            `الرمز غير صحيح. تبقى ${OTP_ATTEMPTS - count} محاولات.`,
            `The code is incorrect. ${OTP_ATTEMPTS - count} attempts remain.`
          );
    }
    await tx
      .update(phoneOtpChallenges)
      .set({ verifiedAt: now, verifiedClientKey: input.clientKey })
      .where(eq(phoneOtpChallenges.id, row.id));
    return { phone: row.phone, verifiedAt: now } as const;
  });
  if ("error" in result)
    throw new TRPCError({ code: "UNAUTHORIZED", message: result.error });
  return {
    phone: result.phone,
    verificationToken: issuePhoneLoginTicket(result.phone, result.verifiedAt),
    accessToken: issueCustomerPhoneAccess(result.phone, result.verifiedAt),
    verifiedAt: result.verifiedAt,
    expiresAt: result.verifiedAt + 15 * 60_000,
  };
}
