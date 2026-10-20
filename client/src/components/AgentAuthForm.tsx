import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useLanguage } from "@/contexts/LanguageContext";
import { finishSignIn } from "@/lib/authFlow";
import { trpc } from "@/lib/trpc";
import { BadgeCheck, Loader2, Phone, ShieldCheck } from "lucide-react";
import React, { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { useLocation } from "wouter";

export type AgentAuthFormProps = {
  variant?: "modal" | "page";
  onBusyChange?: (busy: boolean) => void;
};

const arabicDigitMap: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

function normalizeArabicDigits(value: string) {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => arabicDigitMap[digit] ?? digit);
}

export function normalizeSaudiAgentPhone(value: string) {
  const digits = normalizeArabicDigits(value).replace(/\D/g, "");
  if (/^05\d{8}$/.test(digits)) return digits;
  if (/^5\d{8}$/.test(digits)) return `0${digits}`;
  if (/^9665\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^009665\d{8}$/.test(digits)) return `0${digits.slice(5)}`;
  return null;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AgentAuthForm({ variant = "page", onBusyChange }: AgentAuthFormProps) {
  const { isEnglish } = useLanguage();
  const [, navigate] = useLocation();
  const phoneId = useId();
  const utils = trpc.useUtils();
  const login = trpc.auth.agentPhoneDemo.useMutation();
  const submittingRef = useRef(false);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // A dialog parent can freeze close/backdrop controls while the server both
  // writes and verifies the signed session. Cleanup always releases that lock.
  useEffect(() => {
    if (!busy) return;
    onBusyChange?.(true);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  const copy = isEnglish
    ? {
        title: "Transaction specialist sign in",
        subtitle: "Use the mobile number registered by the owner",
        phone: "Mobile number",
        phonePlaceholder: "05XXXXXXXX",
        continue: "Continue",
        phoneError: "Enter a valid Saudi mobile number.",
        demo: "Demo verification code: 123456. No real WhatsApp message was sent.",
        codeFor: "Enter the code for",
        codeLabel: "Verification code",
        signIn: "Sign in",
        checking: "Checking…",
        changePhone: "Change mobile number",
        ownerOnly: "Agent accounts are created by the owner. Unregistered numbers cannot sign in.",
        sessionError: "We could not verify an active agent session. Please try again.",
      }
    : {
        title: "دخول المعقب",
        subtitle: "استخدم رقم الجوال المسجل من المالك",
        phone: "رقم الجوال",
        phonePlaceholder: "05XXXXXXXX",
        continue: "متابعة",
        phoneError: "أدخل رقم جوال سعودي صحيحًا.",
        demo: "رمز التحقق التجريبي: 123456. للاختبار فقط — لم تُرسل أي رسالة واتساب حقيقية.",
        codeFor: "أدخل الرمز المخصص للرقم",
        codeLabel: "رمز التحقق",
        signIn: "دخول",
        checking: "جارٍ التحقق…",
        changePhone: "تغيير رقم الجوال",
        ownerOnly: "حسابات المعقبين ينشئها المالك، ولا يمكن لرقم غير مسجل الدخول.",
        sessionError: "تعذر التحقق من جلسة معقب مفعلة. حاول مرة أخرى.",
      };

  const continuePhone = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const normalized = normalizeSaudiAgentPhone(phoneInput);
    if (!normalized) {
      setError(copy.phoneError);
      return;
    }
    setPhone(normalized);
    setCode("");
    setError("");
    setStep("code");
  };

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || busy || code.length !== 6) return;

    submittingRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await login.mutateAsync({ phone, code });

      // Preview environments may mirror an old session in sessionStorage. This
      // clears only that legacy token mirror so the new server cookie can be verified.
      try {
        sessionStorage.removeItem("manus-cookie");
      } catch {
        // Storage may be unavailable in a restricted browser context.
      }

      await utils.auth.me.invalidate();
      const verifiedUser = await utils.auth.me.fetch();
      const resultRole: string = result.role;
      if (resultRole !== "agent" || verifiedUser?.role !== "agent") {
        setError(copy.sessionError);
        return;
      }

      finishSignIn({ role: verifiedUser.role, name: result.name }, isEnglish, navigate);
    } catch (mutationError) {
      setError(errorMessage(mutationError, copy.sessionError));
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  const Heading = variant === "modal" ? "h2" : "h1";
  const formCard = (
    <section
      className={variant === "modal" ? "w-full min-w-0" : "w-full min-w-0 max-w-md overflow-hidden rounded-[2rem] border border-[#dce8f6] bg-white p-5 shadow-[0_24px_70px_rgba(27,79,129,.14)] sm:p-8"}
      dir={isEnglish ? "ltr" : "rtl"}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0878f9]">
          <BadgeCheck className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <Heading className="font-display text-xl font-black text-[#102a43]">{copy.title}</Heading>
          <p className="mt-1 text-xs leading-5 text-[#60778f]">{copy.subtitle}</p>
        </div>
      </div>

      {step === "phone" ? (
        <form className="mt-7" onSubmit={continuePhone} noValidate>
          <label htmlFor={phoneId} className="text-sm font-extrabold text-[#17334f]">
            {copy.phone}
          </label>
          <div className="relative mt-2">
            <Phone className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#87a1b8] ltr:left-4 rtl:right-4" aria-hidden="true" />
            <Input
              id={phoneId}
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              disabled={busy}
              value={phoneInput}
              onChange={(event) => {
                setPhoneInput(event.target.value);
                setError("");
              }}
              placeholder={copy.phonePlaceholder}
              className="h-12 rounded-xl px-11 text-left"
            />
          </div>
          {error ? <p role="alert" className="mt-3 rounded-xl bg-[#fff1f3] px-3 py-2 text-xs font-bold leading-5 text-[#a9323f]">{error}</p> : null}
          <Button disabled={busy} className="mt-4 h-12 w-full rounded-xl bg-[#0878f9] font-extrabold text-white">
            {copy.continue}
          </Button>
        </form>
      ) : (
        <form className="mt-7" onSubmit={verify}>
          <div className="rounded-xl border border-[#b7dbff] bg-[#f0f8ff] p-3 text-xs leading-6 text-[#31516e]">
            <ShieldCheck className="mb-1 inline h-4 w-4 text-[#0878f9]" aria-hidden="true" /> {copy.demo}
          </div>
          <p className="mt-4 text-sm font-bold text-[#60778f]">
            {copy.codeFor} <span dir="ltr">{phone}</span>
          </p>
          <InputOTP
            maxLength={6}
            value={code}
            disabled={busy}
            autoComplete="one-time-code"
            pushPasswordManagerStrategy="none"
            pattern="^[0-9٠-٩۰-۹]*$"
            pasteTransformer={normalizeArabicDigits}
            aria-label={copy.codeLabel}
            onChange={(value) => {
              setCode(normalizeArabicDigits(value).replace(/\D/g, "").slice(0, 6));
              setError("");
            }}
            containerClassName="mt-4 w-full [direction:ltr]"
            className="w-full"
            dir="ltr"
          >
            <InputOTPGroup dir="ltr" className="w-full max-w-full justify-between overflow-hidden">
              {Array.from({ length: 6 }, (_, index) => (
                <InputOTPSlot key={index} index={index} className="h-11 w-9 shrink-0 rounded-lg border sm:h-12 sm:w-10 md:w-11" />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {error ? <p role="alert" className="mt-4 rounded-xl bg-[#fff1f3] px-3 py-3 text-center text-xs font-bold leading-6 text-[#a9323f]">{error}</p> : null}
          <Button disabled={busy || code.length !== 6} className="mt-5 h-12 w-full rounded-xl bg-[#0878f9] font-extrabold text-white">
            {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {busy ? copy.checking : copy.signIn}
          </Button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (busy) return;
              setStep("phone");
              setCode("");
              setError("");
            }}
            className="mt-4 w-full text-sm font-bold text-[#0878f9] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copy.changePhone}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-xs leading-6 text-[#8798aa]">{copy.ownerOnly}</p>
    </section>
  );

  if (variant === "modal") return formCard;

  return (
    <main className="flex min-h-screen items-center justify-center overflow-x-hidden bg-[#f4f9ff] p-4">
      {formCard}
    </main>
  );
}
