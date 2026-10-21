import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";

/** A demo code is never proof of phone ownership on a public production site. */
export function isDemoPhoneVerificationAllowed() {
  return !ENV.isProduction && process.env.NODE_ENV !== "production";
}

export function getPhoneVerificationConfig() {
  return {
    mode: isDemoPhoneVerificationAllowed() ? "demo" as const : "disabled" as const,
    realMessagesSent: false as const,
  };
}

export function assertDemoPhoneVerificationAllowed(language: "ar" | "en" = "ar") {
  if (!isDemoPhoneVerificationAllowed()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: language === "en"
        ? "Mobile sign-in is temporarily unavailable until a real verification service is connected. Contact support."
        : "الدخول بالجوال متوقف مؤقتًا إلى حين ربط خدمة تحقق فعلية. تواصل مع الدعم.",
    });
  }
}
