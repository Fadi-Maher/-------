import { normalizeSaudiPhone } from "@/components/CustomerAuthForm";
import { PhoneOtpStep, type PhoneOtpChallenge } from "@/components/PhoneOtpStep";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { phoneFormatError } from "@/lib/phoneAuthValidation";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, Info, Loader2, Smartphone, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

export type PhoneChangeSuccess = {
  accessToken: string;
  profile: { fullName: string; email: string | null; phone: string; memberSince: number | null };
  movedRequests: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string;
  currentPhone: string;
  isEnglish: boolean;
  /** Called once the server moved the account; the caller stores the new session. */
  onChanged: (result: PhoneChangeSuccess) => void;
  onSessionExpired: () => void;
};

type Step = "enter" | "otp" | "done";
type Failure = Error & { data?: { code?: string } | null };

const ARABIC_TEXT = /[\u0600-\u06ff]/;

export function CustomerPhoneChangeDialog({
  open,
  onOpenChange,
  accessToken,
  currentPhone,
  isEnglish,
  onChanged,
  onSessionExpired,
}: Props) {
  const copy = isEnglish
    ? {
        title: "Change mobile number",
        description: "We verify the new number with a code before moving your account to it.",
        current: "Current number",
        newPhone: "New mobile number",
        newPhoneHint: "Saudi mobile, e.g. 05XXXXXXXX or +9665XXXXXXXX.",
        whatHappens:
          "After you confirm, your requests and notifications move to the new number, it becomes your sign-in number, and other devices are signed out.",
        demo: "Verification is in demo mode for now: no SMS is sent, and the code is shown on the next step.",
        send: "Send verification code",
        sending: "Preparing code…",
        cancel: "Cancel",
        close: "Close mobile number change",
        otpTitle: "Verify the new number",
        confirm: "Confirm new number",
        sendFailed: "We couldn't prepare the code. Please try again.",
        verifyFailed: "We couldn't verify the code. Please try again.",
        resendFailed: "We couldn't renew the code. Try again.",
        resent: "A new demo code is ready. The previous code no longer works. No SMS was sent.",
        expired: "Your session has ended. Sign in again, then change your number.",
        signInAgain: "Sign in again",
        doneTitle: "Your mobile number was changed",
        doneBody: "Your sign-in number is now",
        moved: (count: number) => (count === 1 ? "1 request moved to the new number." : `${count} requests moved to the new number.`),
        otherDevices: "Other devices were signed out. Use the new number next time you sign in.",
        done: "Done",
        steps: ["New number", "Code", "Done"],
        stepLabel: (index: number, total: number) => `Step ${index} of ${total}`,
      }
    : {
        title: "تغيير رقم الجوال",
        description: "نتحقق من الرقم الجديد برمز قبل نقل حسابك إليه.",
        current: "الرقم الحالي",
        newPhone: "رقم الجوال الجديد",
        newPhoneHint: "جوال سعودي، مثل 05XXXXXXXX أو ‎+9665XXXXXXXX.",
        whatHappens:
          "بعد التأكيد تنتقل طلباتك وإشعاراتك إلى الرقم الجديد، ويصبح هو رقم الدخول، ويُسجَّل خروجك من الأجهزة الأخرى.",
        demo: "التحقق حاليًا تجريبي: لا تُرسل رسالة SMS، ويظهر الرمز في الخطوة التالية.",
        send: "إرسال رمز التحقق",
        sending: "جارٍ تجهيز الرمز…",
        cancel: "إلغاء",
        close: "إغلاق نافذة تغيير الرقم",
        otpTitle: "تحقّق من الرقم الجديد",
        confirm: "تأكيد الرقم الجديد",
        sendFailed: "تعذّر تجهيز الرمز. حاول مرة أخرى.",
        verifyFailed: "تعذّر التحقق من الرمز. حاول مرة أخرى.",
        resendFailed: "تعذّر تجديد الرمز. حاول مرة أخرى.",
        resent: "تم تجديد الرمز التجريبي وإلغاء الرمز السابق. لم تُرسل رسالة SMS.",
        expired: "انتهت جلستك. سجّل الدخول من جديد ثم غيّر رقمك.",
        signInAgain: "تسجيل الدخول من جديد",
        doneTitle: "تم تغيير رقم جوالك",
        doneBody: "رقم الدخول الآن",
        moved: (count: number) =>
          count === 1 ? "نُقل طلب واحد إلى الرقم الجديد." : count === 2 ? "نُقل طلبان إلى الرقم الجديد." : `نُقلت ${count} طلبات إلى الرقم الجديد.`,
        otherDevices: "سُجّل خروجك من الأجهزة الأخرى. استخدم الرقم الجديد عند الدخول القادم.",
        done: "تم",
        steps: ["الرقم الجديد", "الرمز", "تم"],
        stepLabel: (index: number, total: number) => `الخطوة ${index} من ${total}`,
      };

  const language = isEnglish ? "en" : "ar";
  const requestChange = trpc.customers.requestPhoneChange.useMutation();
  const resendCode = trpc.phoneAuth.resendCode.useMutation();
  const confirmChange = trpc.customers.confirmPhoneChange.useMutation();

  const [step, setStep] = useState<Step>("enter");
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [challenge, setChallenge] = useState<PhoneOtpChallenge | null>(null);
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [notice, setNotice] = useState("");
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [result, setResult] = useState<PhoneChangeSuccess | null>(null);
  const busyRef = useRef(false);
  const verifyKeyRef = useRef("");
  const phoneRef = useRef<HTMLInputElement>(null);

  // Every opening starts clean, so a half-finished attempt never leaks into the next one.
  useEffect(() => {
    if (!open) return;
    setStep("enter");
    setPhoneInput("");
    setPhoneError("");
    setNewPhone("");
    setChallenge(null);
    setCode("");
    setOtpError("");
    setNotice("");
    setExpired(false);
    setResult(null);
    busyRef.current = false;
    setBusy(false);
    verifyKeyRef.current = "";
  }, [open]);

  useEffect(() => {
    if (!open || step !== "otp") return;
    const tick = () => setNow(Date.now() + clockOffset);
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [open, step, clockOffset]);

  const begin = () => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    return true;
  };
  const finish = () => {
    busyRef.current = false;
    setBusy(false);
  };

  /** Server text is used when it is already in the visitor's language; otherwise a local fallback. */
  const explain = (failure: unknown, fallback: string) => {
    const error = failure as Failure;
    if (!(error instanceof Error) || !error.message) return fallback;
    if (isEnglish && ARABIC_TEXT.test(error.message)) return fallback;
    return error.message;
  };
  const isSessionProblem = (failure: unknown) => {
    const code = (failure as Failure)?.data?.code;
    return code === "FORBIDDEN" || code === "NOT_FOUND";
  };

  const acceptChallenge = (value: PhoneOtpChallenge) => {
    setChallenge(value);
    setClockOffset(value.serverNow - Date.now());
    setNow(value.serverNow);
    setCode("");
    setOtpError("");
    verifyKeyRef.current = crypto.randomUUID();
  };

  const sendCode = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const invalid = phoneFormatError(phoneInput, isEnglish);
    const normalized = normalizeSaudiPhone(phoneInput);
    if (invalid || !normalized) {
      setPhoneError(invalid ?? (isEnglish ? "Enter a valid Saudi mobile number." : "أدخل رقم جوال سعودي صحيحًا."));
      phoneRef.current?.focus();
      return;
    }
    if (normalized === currentPhone) {
      setPhoneError(isEnglish ? "That is your current number. Enter a new one." : "هذا هو رقمك الحالي. أدخل رقمًا جديدًا.");
      phoneRef.current?.focus();
      return;
    }
    if (!begin()) return;
    setPhoneError("");
    try {
      const value = await requestChange.mutateAsync({ accessToken, newPhone: normalized, language });
      setNewPhone(normalized);
      setPhoneInput(normalized);
      acceptChallenge(value);
      setNotice("");
      setStep("otp");
    } catch (failure) {
      if (isSessionProblem(failure)) setExpired(true);
      else setPhoneError(explain(failure, copy.sendFailed));
    } finally {
      finish();
    }
  };

  const resend = async () => {
    if (!challenge || Date.now() + clockOffset < challenge.resendAvailableAt || !begin()) return;
    try {
      const value = await resendCode.mutateAsync({ challengeId: challenge.challengeId, language });
      acceptChallenge(value);
      setNotice(copy.resent);
    } catch (failure) {
      setOtpError(explain(failure, copy.resendFailed));
    } finally {
      finish();
    }
  };

  const verify = async () => {
    if (!challenge || code.length !== 6 || !begin()) return;
    setOtpError("");
    try {
      const value = await confirmChange.mutateAsync({
        accessToken,
        challengeId: challenge.challengeId,
        code,
        clientKey: verifyKeyRef.current,
        language,
      });
      const success: PhoneChangeSuccess = {
        accessToken: value.accessToken,
        profile: value.profile,
        movedRequests: value.movedRequests,
      };
      setResult(success);
      setStep("done");
      onChanged(success);
    } catch (failure) {
      const errorCode = (failure as Failure)?.data?.code;
      if (isSessionProblem(failure)) {
        setExpired(true);
      } else if (errorCode === "CONFLICT" || errorCode === "BAD_REQUEST") {
        // The code is spent and the number cannot be used; go back so another number can be entered.
        setStep("enter");
        setChallenge(null);
        setCode("");
        setPhoneError(explain(failure, copy.verifyFailed));
        window.requestAnimationFrame(() => phoneRef.current?.focus());
      } else {
        setCode("");
        setOtpError(explain(failure, copy.verifyFailed));
      }
    } finally {
      finish();
    }
  };

  const backToNumber = () => {
    if (busyRef.current) return;
    setStep("enter");
    setChallenge(null);
    setCode("");
    setOtpError("");
    setNotice("");
    verifyKeyRef.current = "";
    window.requestAnimationFrame(() => phoneRef.current?.focus());
  };

  const stepIndex = step === "enter" ? 0 : step === "otp" ? 1 : 2;
  const guardClose = (next: boolean) => {
    if (!next && busyRef.current) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={guardClose}>
      <DialogContent
        dir={isEnglish ? "ltr" : "rtl"}
        showCloseButton={false}
        overlayClassName="z-[105] bg-[#102a43]/45 backdrop-blur-[3px] motion-reduce:animate-none"
        onEscapeKeyDown={event => {
          if (busyRef.current) event.preventDefault();
        }}
        onInteractOutside={event => {
          if (busyRef.current) event.preventDefault();
        }}
        className="z-[110] max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] overflow-y-auto rounded-2xl border-[#dce8f6] bg-white p-5 text-[#17334f] shadow-[0_28px_90px_rgba(16,42,67,.22)] motion-reduce:animate-none sm:max-w-md sm:p-6"
      >
        <DialogHeader className="text-start sm:text-start">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="font-display text-lg font-black leading-7 text-[#17334f]">{copy.title}</DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-6 text-[#60778f]">{copy.description}</DialogDescription>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => guardClose(false)}
              aria-label={copy.close}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#e1ebf6] text-[#60778f] transition-colors hover:bg-[#f1f7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] disabled:opacity-50"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </DialogHeader>

        <ol className="grid grid-cols-3 gap-1.5 sm:gap-2" aria-label={copy.stepLabel(stepIndex + 1, 3)}>
          {copy.steps.map((label, index) => {
            const state = index < stepIndex ? "complete" : index === stepIndex ? "current" : "upcoming";
            return (
              <li
                key={label}
                aria-current={state === "current" ? "step" : undefined}
                className={`flex min-w-0 items-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] font-extrabold leading-tight transition-colors duration-200 sm:gap-1.5 sm:px-2 sm:text-xs ${
                  state === "current"
                    ? "bg-[#eaf3ff] text-[#0668d9]"
                    : state === "complete"
                      ? "bg-[#eaf8f0] text-[#238457]"
                      : "bg-[#f4f7fb] text-[#8aa0b5]"
                }`}
              >
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] ${
                    state === "complete" ? "bg-[#238457] text-white" : state === "current" ? "bg-[#0668d9] text-white" : "bg-white text-[#8aa0b5]"
                  }`}
                  aria-hidden="true"
                >
                  {state === "complete" ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className="min-w-0 break-words">{label}</span>
              </li>
            );
          })}
        </ol>

        {expired ? (
          <div className="rounded-2xl border border-[#ffd8dc] bg-[#fff8f8] p-4" role="alert">
            <p className="flex items-start gap-2 text-sm font-extrabold leading-6 text-[#8f2833]">
              <AlertCircle className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
              {copy.expired}
            </p>
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onSessionExpired();
              }}
              className="mt-3 h-10 rounded-xl bg-[#0668d9] font-extrabold text-white hover:bg-[#0457ba]"
            >
              {copy.signInAgain}
            </Button>
          </div>
        ) : step === "enter" ? (
          <form noValidate onSubmit={event => void sendCode(event)} className="space-y-4" aria-busy={busy}>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#f3f7fb] px-3 py-2.5 text-sm">
              <span className="font-bold text-[#60778f]">{copy.current}</span>
              <bdi dir="ltr" className="font-extrabold text-[#17334f]">{currentPhone}</bdi>
            </div>
            <div>
              <Label htmlFor="customer-new-phone" className="text-sm font-extrabold text-[#17334f]">{copy.newPhone}</Label>
              <div className="relative mt-2">
                <Smartphone className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8aa0b5]" aria-hidden="true" />
                <Input
                  ref={phoneRef}
                  id="customer-new-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  maxLength={20}
                  autoFocus
                  value={phoneInput}
                  disabled={busy}
                  placeholder="05XXXXXXXX"
                  onChange={event => {
                    setPhoneInput(event.target.value);
                    if (phoneError) setPhoneError("");
                  }}
                  aria-invalid={Boolean(phoneError)}
                  aria-describedby={phoneError ? "customer-new-phone-hint customer-new-phone-error" : "customer-new-phone-hint"}
                  className="h-12 rounded-xl border-[#d8e6f5] bg-white ps-10 text-start text-base shadow-none aria-[invalid=true]:border-[#e5848e] sm:text-sm"
                />
              </div>
              <p id="customer-new-phone-hint" className="mt-2 text-xs leading-6 text-[#70859b]">{copy.newPhoneHint}</p>
              {phoneError ? (
                <p id="customer-new-phone-error" role="alert" className="mt-1 flex items-start gap-1.5 text-xs font-bold leading-6 text-[#b42d3b]">
                  <AlertCircle className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {phoneError}
                </p>
              ) : null}
            </div>
            <div className="space-y-2 rounded-xl border border-[#d8e8fa] bg-[#f6faff] p-3 text-xs leading-6 text-[#405d78]">
              <p className="flex items-start gap-2">
                <Info className="mt-1 h-3.5 w-3.5 shrink-0 text-[#0878f9]" aria-hidden="true" />
                {copy.whatHappens}
              </p>
              <p className="font-bold text-[#315675]">{copy.demo}</p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => guardClose(false)}
                className="h-11 rounded-xl border-[#d8e6f5] bg-white font-extrabold text-[#405d78] transition-transform active:scale-[.97]"
              >
                {copy.cancel}
              </Button>
              <Button
                type="submit"
                disabled={busy}
                aria-busy={busy}
                className="h-11 min-w-44 rounded-xl bg-[#0668d9] font-extrabold text-white shadow-[0_8px_20px_rgba(8,120,249,.18)] transition-transform hover:bg-[#0457ba] active:scale-[.97]"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {busy ? copy.sending : copy.send}
              </Button>
            </div>
          </form>
        ) : step === "otp" && challenge ? (
          <PhoneOtpStep
            phone={newPhone}
            challenge={challenge}
            now={now}
            code={code}
            error={otpError}
            busy={busy}
            notice={notice}
            onCodeChange={value => {
              setCode(value);
              if (otpError) setOtpError("");
            }}
            onVerify={() => void verify()}
            onResend={() => void resend()}
            onChangePhone={backToNumber}
            title={copy.otpTitle}
            submitLabel={copy.confirm}
          />
        ) : result ? (
          <div className="profile-success-pop text-center" role="status" aria-live="polite">
            <span className="profile-check-pop mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e6f7ee] text-[#238457]">
              <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
            </span>
            <p className="mt-4 font-display text-lg font-black text-[#17334f]">{copy.doneTitle}</p>
            <p className="mt-1 text-sm text-[#60778f]">
              {copy.doneBody}{" "}
              <bdi dir="ltr" className="font-extrabold text-[#17334f]">{result.profile.phone}</bdi>
            </p>
            {result.movedRequests > 0 ? <p className="mt-2 text-xs font-bold text-[#238457]">{copy.moved(result.movedRequests)}</p> : null}
            <p className="mt-3 rounded-xl bg-[#f6faff] px-3 py-2 text-xs leading-6 text-[#405d78]">{copy.otherDevices}</p>
            <Button
              type="button"
              autoFocus
              onClick={() => onOpenChange(false)}
              className="mt-5 h-11 w-full rounded-xl bg-[#0668d9] font-extrabold text-white transition-transform hover:bg-[#0457ba] active:scale-[.97]"
            >
              {copy.done}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
