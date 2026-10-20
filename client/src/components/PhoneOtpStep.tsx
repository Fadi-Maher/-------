import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useLanguage } from "@/contexts/LanguageContext";
import { normalizeLoginDigits } from "@/lib/phoneAuthValidation";
import { AlertCircle, Clock3, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useId } from "react";

export type PhoneOtpChallenge = {
  challengeId: string;
  expiresAt: number;
  resendAvailableAt: number;
  serverNow: number;
  mode: "demo";
  demoCode: string;
};
type Props = {
  phone: string;
  challenge: PhoneOtpChallenge;
  now: number;
  code: string;
  error: string;
  busy: boolean;
  notice: string;
  onCodeChange: (value: string) => void;
  onVerify: () => void;
  onResend: () => void;
  onChangePhone: () => void;
  /** Optional wording for flows other than sign-in, such as changing the account number. */
  title?: string;
  submitLabel?: string;
};
export function PhoneOtpStep({
  phone,
  challenge,
  now,
  code,
  error,
  busy,
  notice,
  onCodeChange,
  onVerify,
  onResend,
  onChangePhone,
  title,
  submitLabel,
}: Props) {
  const { isEnglish } = useLanguage();
  const fieldId = useId();
  const cooldown = Math.max(
    0,
    Math.ceil((challenge.resendAvailableAt - now) / 1000)
  );
  const expires = Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000));
  const time = `${Math.floor(expires / 60)}:${String(expires % 60).padStart(2, "0")}`;
  return (
    <form
      noValidate
      onSubmit={event => {
        event.preventDefault();
        if (!busy && code.length === 6 && expires > 0) onVerify();
      }}
      className="space-y-4"
      data-testid="phone-otp-step"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eaf4ff] text-[#0769ce]">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-xl font-black text-[#102a43]">
            {title ?? (isEnglish ? "Verify your mobile" : "تحقّق من رقم جوالك")}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#536e88]">
            {isEnglish
              ? "Enter the six-digit code for"
              : "أدخل الرمز المكوّن من 6 أرقام للجوال"}{" "}
            <bdi dir="ltr" className="font-extrabold text-[#17334f]">
              {phone}
            </bdi>
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-[#cde3fa] bg-[#f4f9ff] px-4 py-3">
        <p className="text-xs font-extrabold text-[#315675]">
          {isEnglish
            ? "Demo verification — no SMS is sent"
            : "تحقق تجريبي — لا تُرسل رسالة SMS"}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-bold text-[#315675]">
            {isEnglish ? "Use this demo code" : "استخدم هذا الرمز التجريبي"}
          </span>
          <bdi
            dir="ltr"
            className="rounded-lg bg-white px-3 py-1 text-lg font-black tracking-[.16em] text-[#075aa8]"
          >
            {challenge.demoCode}
          </bdi>
        </div>
      </div>
      <div>
        <label
          htmlFor={`${fieldId}-code`}
          className="mb-3 block text-sm font-bold text-[#17334f]"
        >
          {isEnglish ? "Verification code" : "رمز التحقق"}
        </label>
        <InputOTP
          id={`${fieldId}-code`}
          maxLength={6}
          value={code}
          onChange={value =>
            onCodeChange(
              normalizeLoginDigits(value).replace(/\D/g, "").slice(0, 6)
            )
          }
          pasteTransformer={value =>
            normalizeLoginDigits(value).replace(/\D/g, "").slice(0, 6)
          }
          pattern="[0-9٠-٩۰-۹]*"
          disabled={busy || expires === 0}
          autoComplete="one-time-code"
          inputMode="numeric"
          dir="ltr"
          aria-label={isEnglish ? "Verification code" : "رمز التحقق"}
          aria-invalid={Boolean(error)}
          pushPasswordManagerStrategy="none"
          containerClassName="w-full justify-center"
          aria-describedby={error ? `${fieldId}-error` : undefined}
        >
          <InputOTPGroup dir="ltr" className="gap-1.5 sm:gap-2">
            {[0, 1, 2, 3, 4, 5].map(index => (
              <InputOTPSlot
                key={index}
                index={index}
                className="h-11 w-9 rounded-xl border border-[#bfd5ec] bg-white text-xl font-extrabold text-[#17334f] first:rounded-xl last:rounded-xl sm:h-12 sm:w-12"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#536e88]">
        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
        {expires > 0 ? (
          <span>
            {isEnglish ? "Code expires in" : "تنتهي صلاحية الرمز خلال"}{" "}
            <bdi dir="ltr">{time}</bdi>
          </span>
        ) : (
          <span className="text-[#a9323e]">
            {isEnglish
              ? "Code expired. Request another code."
              : "انتهت صلاحية الرمز. أعد إرسال رمز جديد."}
          </span>
        )}
      </div>
      {error && (
        <p
          id={`${fieldId}-error`}
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-[#f2c8ce] bg-[#fff2f4] px-3 py-2 text-xs font-bold leading-6 text-[#a9323e]"
        >
          <AlertCircle className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {notice && !error && (
        <p
          role="status"
          className="text-center text-xs font-bold leading-6 text-[#315675]"
        >
          {notice}
        </p>
      )}
      <Button
        type="submit"
        disabled={busy || code.length !== 6 || expires === 0}
        aria-busy={busy}
        className="h-12 w-full rounded-xl bg-[#0668d9] font-extrabold text-white transition-transform hover:bg-[#0457ba] active:scale-[.97]"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {busy
          ? isEnglish
            ? "Checking…"
            : "جارٍ التحقق…"
          : submitLabel ?? (isEnglish ? "Verify and continue" : "تحقق وتابع")}
      </Button>
      <div className="grid gap-1 sm:grid-cols-2">
        <Button
          type="button"
          variant="ghost"
          disabled={busy || cooldown > 0}
          onClick={onResend}
          className="min-h-11 rounded-xl text-xs font-extrabold text-[#075aa8] hover:bg-[#eef6ff]"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {cooldown > 0
            ? isEnglish
              ? `Resend in ${cooldown}s`
              : `إعادة الإرسال خلال ${cooldown} ثانية`
            : isEnglish
              ? "Resend code"
              : "إعادة إرسال الرمز"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={onChangePhone}
          className="min-h-11 rounded-xl text-xs font-extrabold text-[#536e88] hover:bg-[#eef6ff]"
        >
          {isEnglish ? "Change mobile number" : "تغيير رقم الجوال"}
        </Button>
      </div>
    </form>
  );
}
