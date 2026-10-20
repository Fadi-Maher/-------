import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useLanguage } from "@/contexts/LanguageContext";
import { finishSignIn } from "@/lib/authFlow";
import { saveCustomerSession } from "@/lib/customerSession";
import { trpc } from "@/lib/trpc";
import { CURRENT_TERMS_VERSION } from "@shared/legal";
import { ArrowLeft, ArrowRight, CheckCircle2, Smartphone } from "lucide-react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export const DEMO_CUSTOMER_OTP = "123456";

export type CustomerRecord = {
  id: number;
  fullName: string;
  phone: string | null;
  email: string | null;
};

type CustomerAuthFormProps = {
  mode?: "signin" | "signup";
  variant?: "modal" | "page";
  onBusyChange?: (busy: boolean) => void;
};

/** Accepts Saudi numbers entered with Arabic or Western digits and normalizes them for the API. */
function normalizeAuthDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

export function normalizeSaudiPhone(value: string) {
  const compact = normalizeAuthDigits(value).replace(/[\s-]/g, "");
  if (/^05\d{8}$/.test(compact)) return compact;
  if (/^5\d{8}$/.test(compact)) return `0${compact}`;
  if (/^\+9665\d{8}$/.test(compact)) return `0${compact.slice(4)}`;
  if (/^009665\d{8}$/.test(compact)) return `0${compact.slice(5)}`;
  return null;
}

function mutationErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function CustomerAuthForm({
  mode = "signin",
  variant = "page",
  onBusyChange,
}: CustomerAuthFormProps) {
  const { isEnglish } = useLanguage();
  const [, navigate] = useLocation();
  const fieldId = useId();
  const [step, setStep] = useState<"phone" | "verify" | "details">("phone");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [code, setCode] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const verifyPhone = trpc.requests.verifyPhoneDemo.useMutation();
  const findCustomer = trpc.customers.findByPhoneAccessToken.useMutation();
  const registerCustomer = trpc.customers.registerWithPhone.useMutation();
  const isBusy = isSubmitting || verifyPhone.isPending || findCustomer.isPending || registerCustomer.isPending;

  useEffect(() => {
    onBusyChange?.(isBusy);
    return () => {
      onBusyChange?.(false);
    };
  }, [isBusy, onBusyChange]);

  const copy = isEnglish
    ? {
        phoneTitle: mode === "signup" ? "Create account with your mobile" : "Sign in with your mobile",
        phone: "Mobile number",
        phonePlaceholder: "05X XXX XXXX",
        send: "Continue",
        verifyTitle: "Verify your mobile number.",
        verifyIntro: "Use the demo code below. No real WhatsApp message is sent.",
        codeLabel: "Your demo verification code is",
        inputLabel: "Enter the six-digit demo code",
        verify: "Verify and continue",
        detailsTitle: "Complete your customer profile.",
        detailsIntro: "This step appears only for a new customer. Existing customers continue with their saved details.",
        name: "Full name",
        namePlaceholder: "Enter your full name",
        email: "Email address",
        emailPlaceholder: "you@example.com",
        create: "Create customer account",
        resend: "Reset demo code",
        back: "Change mobile number",
        error: "The code is incorrect. Enter the six digits shown in the demo code.",
        phoneError: "Enter a valid Saudi mobile number.",
        termsText: "I agree to the Terms and Conditions and the Refund and Cancellation Policy.",
        termsError: "You must agree to the Terms and Conditions before creating an account.",
        termsLink: "Terms and Conditions",
        refundLink: "Refund and Cancellation Policy",
        creatingError: "We could not create the account right now.",
        checking: "Checking…",
        creating: "Creating account…",
        demo: "Demo only — no real WhatsApp message was sent.",
        home: "Back to home",
      }
    : {
        phoneTitle: mode === "signup" ? "إنشاء حساب برقم جوالك" : "الدخول برقم جوالك",
        phone: "رقم الجوال",
        phonePlaceholder: "05X XXX XXXX",
        send: "المتابعة",
        verifyTitle: "تحقق من رقم جوالك.",
        verifyIntro: "استخدم الرمز التجريبي أدناه. لا تُرسل أي رسالة واتساب حقيقية.",
        codeLabel: "رمز التحقق التجريبي هو",
        inputLabel: "أدخل رمز التحقق التجريبي المكون من ست خانات",
        verify: "تحقق وتابع",
        detailsTitle: "أكمل بيانات حسابك.",
        detailsIntro: "تظهر هذه الخطوة للعميل الجديد فقط. العميل المسجل ينتقل مباشرة إلى بياناته المحفوظة.",
        name: "الاسم الكامل",
        namePlaceholder: "اكتب اسمك الكامل",
        email: "البريد الإلكتروني",
        emailPlaceholder: "اكتب بريدك الإلكتروني",
        create: "إنشاء حساب العميل",
        resend: "إعادة ضبط الرمز التجريبي",
        back: "تغيير رقم الجوال",
        error: "الرمز غير صحيح. أدخل الخانات الست الظاهرة في الرمز التجريبي.",
        phoneError: "أدخل رقم جوال سعودي صحيحًا.",
        termsText: "أوافق على الشروط والأحكام وسياسة الاسترداد والإلغاء.",
        termsError: "يجب الموافقة على الشروط والأحكام قبل إنشاء الحساب.",
        termsLink: "الشروط والأحكام",
        refundLink: "سياسة الاسترداد والإلغاء",
        creatingError: "تعذر إنشاء الحساب الآن.",
        checking: "جارٍ التحقق…",
        creating: "جارٍ إنشاء الحساب…",
        demo: "للاختبار فقط — لم تُرسل أي رسالة واتساب حقيقية.",
        home: "العودة للرئيسية",
      };

  const beginSubmission = () => {
    if (submittingRef.current) return false;
    submittingRef.current = true;
    setIsSubmitting(true);
    return true;
  };

  const endSubmission = () => {
    submittingRef.current = false;
    setIsSubmitting(false);
  };

  const startVerification = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;
    const normalizedPhone = normalizeSaudiPhone(phone);
    if (!normalizedPhone) {
      setError(copy.phoneError);
      return;
    }
    setPhone(normalizedPhone);
    setCode("");
    setError("");
    setStep("verify");
    toast.info(isEnglish ? "Your demo verification code is ready." : "تم تجهيز رمز التحقق التجريبي.");
  };

  const verifyAndContinue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy || submittingRef.current) return;
    if (code !== DEMO_CUSTOMER_OTP) {
      setError(copy.error);
      return;
    }
    if (!beginSubmission()) return;

    setError("");
    try {
      const verified = await verifyPhone.mutateAsync({ phone, code });
      const existing = await findCustomer.mutateAsync({ accessToken: verified.accessToken }) as CustomerRecord | null;
      if (existing) {
        saveCustomerSession({
          name: existing.fullName,
          phone: existing.phone || phone,
          accessToken: verified.accessToken,
        });
        finishSignIn({ role: "customer", name: existing.fullName, isNew: false }, isEnglish, navigate);
        return;
      }
      setAccessToken(verified.accessToken);
      setStep("details");
    } catch (mutationError) {
      setError(mutationErrorMessage(mutationError, copy.error));
    } finally {
      endSubmission();
    }
  };

  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy || submittingRef.current) return;
    if (!accessToken) {
      setError(copy.error);
      return;
    }
    if (!termsAccepted) {
      setError(copy.termsError);
      return;
    }
    if (!beginSubmission()) return;

    setError("");
    try {
      const customer = await registerCustomer.mutateAsync({
        fullName: fullName.trim(),
        phone,
        email: email.trim(),
        accessToken,
        termsAccepted: true,
        termsVersion: CURRENT_TERMS_VERSION,
      });
      saveCustomerSession({
        name: customer.fullName,
        phone: customer.phone || phone,
        accessToken,
      });
      finishSignIn({ role: "customer", name: customer.fullName, isNew: true }, isEnglish, navigate);
    } catch (mutationError) {
      setError(mutationErrorMessage(mutationError, copy.creatingError));
    } finally {
      endSubmission();
    }
  };

  const reset = () => {
    if (isBusy) return;
    setStep("phone");
    setCode("");
    setError("");
    setAccessToken("");
    setTermsAccepted(false);
  };

  const title = step === "phone" ? copy.phoneTitle : step === "verify" ? copy.verifyTitle : copy.detailsTitle;
  const Heading = variant === "modal" ? "h2" : "h1";
  const content = (
    <div className="min-w-0" dir={isEnglish ? "ltr" : "rtl"}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Heading className={`font-display font-extrabold leading-[1.25] tracking-[-0.07em] ${variant === "modal" ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"}`}>
            {title}
          </Heading>
          {step !== "phone" ? (
            <p className="mt-3 text-sm leading-7 text-[#60778f]">
              {step === "verify" ? copy.verifyIntro : copy.detailsIntro}
            </p>
          ) : null}
        </div>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0878f9]" aria-hidden="true">
          <Smartphone className="h-6 w-6" />
        </span>
      </div>

      {step === "phone" ? (
        <form onSubmit={startVerification} className="mt-8 space-y-4">
          <label htmlFor={`${fieldId}-phone`} className="block text-sm font-bold text-[#17334f]">
            {copy.phone}
            <Input
              id={`${fieldId}-phone`}
              required
              disabled={isBusy}
              value={phone}
              onChange={event => setPhone(event.target.value)}
              placeholder={copy.phonePlaceholder}
              autoComplete="tel"
              inputMode="tel"
              dir="ltr"
              className="mt-2 h-12 rounded-xl border-[#c8daec] bg-[#fbfdff] text-left"
            />
          </label>
          {error ? <p role="alert" className="rounded-xl bg-[#fff1f3] px-3 py-2 text-xs font-bold text-[#a9323f]">{error}</p> : null}
          <Button type="submit" disabled={isBusy} className="h-12 w-full rounded-xl bg-[#0878f9] text-sm font-extrabold text-white shadow-[0_6px_0_#0457ba] hover:bg-[#0668d9]">
            {copy.send}
            {isEnglish ? <ArrowRight className="ml-2 h-4 w-4" /> : <ArrowLeft className="mr-2 h-4 w-4" />}
          </Button>
        </form>
      ) : null}

      {step === "verify" ? (
        <form onSubmit={verifyAndContinue} className="mt-8">
          <div className="rounded-2xl bg-[#effff5] p-4">
            <p className="text-xs font-bold text-[#405d78]">{copy.codeLabel}</p>
            <p className="mt-2 text-2xl font-black tracking-[.28em] text-[#102a43] sm:text-3xl" dir="ltr">{DEMO_CUSTOMER_OTP}</p>
          </div>
          <div className="mt-6">
            <label htmlFor={`${fieldId}-code`} className="sr-only">{copy.inputLabel}</label>
            <InputOTP
              id={`${fieldId}-code`}
              maxLength={6}
              value={code}
              disabled={isBusy}
              autoComplete="one-time-code"
              inputMode="numeric"
              pushPasswordManagerStrategy="none"
              pattern="^[0-9٠-٩۰-۹]*$"
              pasteTransformer={normalizeAuthDigits}
              onChange={value => {
                setCode(normalizeAuthDigits(value).replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              aria-label={copy.inputLabel}
              containerClassName={`justify-center [direction:ltr] ${error ? "otp-shake" : ""}`}
              className="gap-1 sm:gap-2"
              dir="ltr"
            >
              <InputOTPGroup dir="ltr">
                {[0, 1, 2, 3, 4, 5].map(index => (
                  <InputOTPSlot key={index} index={index} className="h-12 w-9 rounded-xl border-[#b7dbff] bg-white text-base font-black text-[#102a43] first:border-l last:border-r data-[active=true]:border-[#0878f9] data-[active=true]:ring-[#0878f9]/20 sm:w-11 sm:text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          {error ? <p role="alert" className="mt-4 rounded-xl bg-[#fff1f3] px-3 py-3 text-center text-xs font-bold leading-6 text-[#a9323f]">{error}</p> : null}
          <Button type="submit" disabled={isBusy || code.length !== 6} className="mt-5 h-12 w-full rounded-xl bg-[#0878f9] text-sm font-extrabold text-white shadow-[0_6px_0_#0457ba] hover:bg-[#0668d9]">
            {isBusy ? copy.checking : copy.verify}
            <CheckCircle2 className="ml-2 h-4 w-4" />
          </Button>
          <div className="mt-3 flex flex-wrap justify-between gap-2">
            <Button type="button" variant="outline" disabled={isBusy} onClick={reset} className="h-10 rounded-xl border-[#dce8f6] bg-white px-3 text-xs font-bold text-[#31516e]">{copy.back}</Button>
            <Button type="button" variant="outline" disabled={isBusy} onClick={() => setCode("")} className="h-10 rounded-xl border-[#dce8f6] bg-white px-3 text-xs font-bold text-[#0878f9]">{copy.resend}</Button>
          </div>
          <p className="mt-5 text-center text-xs font-bold leading-5 text-[#a35a00]">{copy.demo}</p>
        </form>
      ) : null}

      {step === "details" ? (
        <form onSubmit={createAccount} className="mt-8 space-y-4">
          <label htmlFor={`${fieldId}-name`} className="block text-sm font-bold text-[#17334f]">
            {copy.name}
            <Input
              id={`${fieldId}-name`}
              required
              minLength={2}
              disabled={isBusy}
              value={fullName}
              onChange={event => setFullName(event.target.value)}
              placeholder={copy.namePlaceholder}
              autoComplete="name"
              className="mt-2 h-12 rounded-xl border-[#c8daec] bg-[#fbfdff]"
            />
          </label>
          <label htmlFor={`${fieldId}-email`} className="block text-sm font-bold text-[#17334f]">
            {copy.email}
            <Input
              id={`${fieldId}-email`}
              required
              type="email"
              disabled={isBusy}
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder={copy.emailPlaceholder}
              autoComplete="email"
              dir="ltr"
              className="mt-2 h-12 rounded-xl border-[#c8daec] bg-[#fbfdff] text-left"
            />
          </label>
          <div className="rounded-2xl border border-[#dce8f6] bg-[#f8fbff] p-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm font-bold leading-7 text-[#31516e]">
              <Checkbox
                checked={termsAccepted}
                disabled={isBusy}
                onCheckedChange={checked => {
                  setTermsAccepted(checked === true);
                  setError("");
                }}
                className="mt-1 border-[#9fbbd4] data-[state=checked]:border-[#0878f9] data-[state=checked]:bg-[#0878f9]"
              />
              <span>{copy.termsText}</span>
            </label>
            <p className="mt-2 ps-7 text-xs leading-6 text-[#60778f]">
              <a href="/terms-and-conditions" target="_blank" rel="noreferrer" className="font-black text-[#0878f9] hover:underline">{copy.termsLink}</a>
              <span className="mx-2">•</span>
              <a href="/refund-and-cancellation" target="_blank" rel="noreferrer" className="font-black text-[#0878f9] hover:underline">{copy.refundLink}</a>
            </p>
          </div>
          {error ? <p role="alert" className="rounded-xl bg-[#fff1f3] px-3 py-2 text-xs font-bold text-[#a9323f]">{error}</p> : null}
          <Button type="submit" disabled={isBusy || !termsAccepted} className="h-12 w-full rounded-xl bg-[#0878f9] text-sm font-extrabold text-white shadow-[0_6px_0_#0457ba] hover:bg-[#0668d9]">
            {isBusy ? copy.creating : copy.create}
            <CheckCircle2 className="ml-2 h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" disabled={isBusy} onClick={reset} className="h-10 w-full rounded-xl border-[#dce8f6] bg-white text-xs font-bold text-[#31516e]">{copy.back}</Button>
        </form>
      ) : null}

      {variant === "page" ? (
        <p className="mt-8 border-t border-[#eef4fb] pt-5 text-center text-sm font-bold text-[#70859b]">
          <a href="/" className="text-[#0878f9] hover:underline">{copy.home}</a>
        </p>
      ) : null}
    </div>
  );

  if (variant === "modal") return content;

  return (
    <section className="mx-auto w-full max-w-xl rounded-[2rem] border border-[#dce8f6] bg-white p-6 shadow-[0_20px_50px_rgba(27,79,129,.10)] sm:p-9">
      {content}
    </section>
  );
}
