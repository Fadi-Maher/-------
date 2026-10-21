import { createHmac, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { assertDemoPhoneVerificationAllowed } from "./phoneVerificationPolicy";

export const PHONE_LOGIN_TTL_MS = 15 * 60_000;
const scope = "phone-login-v1";
function signature(payload: string) {
  if (!ENV.cookieSecret)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "إعداد التحقق غير متاح.",
    });
  return createHmac("sha256", ENV.cookieSecret)
    .update(payload)
    .digest("base64url");
}
export function issuePhoneLoginTicket(phone: string, now = Date.now()) {
  if (!/^05\d{8}$/.test(phone))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "رقم الجوال غير صحيح.",
    });
  const payload = Buffer.from(
    JSON.stringify({ phone, expiresAt: now + PHONE_LOGIN_TTL_MS, scope })
  ).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export function verifyPhoneLoginTicket(
  token: string,
  now = Date.now()
): string {
  assertDemoPhoneVerificationAllowed();
  const failure = () =>
    new TRPCError({
      code: "UNAUTHORIZED",
      message: "انتهت جلسة التحقق. أعد التحقق من رقم الجوال.",
    });
  if (token.length > 500) throw failure();
  const parts = token.split(".");
  if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part)))
    throw failure();
  const [payload, signed] = parts;
  const expected = signature(payload);
  if (
    signed.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signed), Buffer.from(expected))
  )
    throw failure();
  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw failure();
  }
  if (!data || typeof data !== "object") throw failure();
  const value = data as Record<string, unknown>;
  if (
    value.scope !== scope ||
    typeof value.phone !== "string" ||
    !/^05\d{8}$/.test(value.phone) ||
    typeof value.expiresAt !== "number" ||
    !Number.isSafeInteger(value.expiresAt) ||
    value.expiresAt <= now ||
    value.expiresAt > now + PHONE_LOGIN_TTL_MS
  )
    throw failure();
  return value.phone;
}

/** Same format as the existing customer session; no legacy verifier or route is altered. */
export function issueCustomerPhoneAccess(phone: string, now = Date.now()) {
  if (!/^05\d{8}$/.test(phone))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "رقم الجوال غير صحيح.",
    });
  if (!ENV.cookieSecret)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "إعداد التحقق غير متاح.",
    });
  const payload = `${phone}.${Math.floor(now / 1000) + 7 * 24 * 60 * 60}`;
  const signed = createHmac("sha256", ENV.cookieSecret)
    .update(payload)
    .digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${signed}`;
}
