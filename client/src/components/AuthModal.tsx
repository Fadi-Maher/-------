import {
  type ComponentProps,
  type ComponentType,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Check,
  Smartphone,
  UserRound,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { normalizeSaudiPhone } from "@/components/CustomerAuthForm";
import { AgentJoinForm } from "@/components/AgentJoinForm";
import {
  CompletePhoneProfile,
  type PhoneProfileValues,
} from "@/components/CompletePhoneProfile";
import {
  PhoneOtpStep,
  type PhoneOtpChallenge,
} from "@/components/PhoneOtpStep";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  clearCustomerSession,
  saveCustomerSession,
} from "@/lib/customerSession";
import { phoneFormatError } from "@/lib/phoneAuthValidation";
import {
  AUTH_COMPLETED_EVENT,
  AUTH_MODAL_OPEN_EVENT,
  finishSignIn,
  openAuthModal,
  type AuthModalRequest,
} from "@/lib/authFlow";
import { useLocation } from "wouter";

type Phase = "phone" | "otp" | "role" | "profile" | "complete";
type Verified = {
  phone: string;
  verificationToken: string;
  accessToken: string;
  expiresAt: number;
};
// The parent agent adds this optional handoff prop to AgentJoinForm. Keeping the
// narrow compatibility type makes this modal safe while that component lands.
const AgentJoinFormWithProfile = AgentJoinForm as ComponentType<
  ComponentProps<typeof AgentJoinForm> & { initialProfile?: PhoneProfileValues }
>;
function actionError(error: unknown, fallback: string, isEnglish: boolean) {
  if (!(error instanceof Error) || !error.message) return fallback;
  if (isEnglish && /[\u0600-\u06ff]/.test(error.message)) {
    const code = (error as Error & { data?: { code?: string } }).data?.code;
    if (code === "UNAUTHORIZED")
      return "Your verification session has expired. Verify your mobile again.";
    if (code === "FORBIDDEN")
      return "Your agent account is not active. Submit a join request and wait for approval.";
    return fallback;
  }
  return error.message;
}

export function AuthModal() {
  const { isEnglish } = useLanguage();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const requestCode = trpc.phoneAuth.requestCode.useMutation();
  const resendCode = trpc.phoneAuth.resendCode.useMutation();
  const verifyCode = trpc.phoneAuth.verifyCode.useMutation();
  const agentSignIn = trpc.phoneAuth.agentSignIn.useMutation();
  const savePhoneProfileMutation = trpc.phoneProfile.save.useMutation();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("phone");
  const [audience, setAudience] = useState<"customer" | "agent" | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [challenge, setChallenge] = useState<PhoneOtpChallenge | null>(null);
  const [verified, setVerified] = useState<Verified | null>(null);
  const [savedProfile, setSavedProfile] = useState<PhoneProfileValues | null>(
    null
  );
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [code, setCode] = useState("");
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [generation, setGeneration] = useState(0);
  const busyRef = useRef(false);
  const verifyKeyRef = useRef("");
  const completedRef = useRef(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const updateBusy = useCallback((value: boolean) => {
    busyRef.current = value;
    setBusy(value);
  }, []);
  const beginAction = () => {
    if (busyRef.current) return false;
    updateBusy(true);
    setError("");
    return true;
  };
  const language = isEnglish ? ("en" as const) : ("ar" as const);

  useEffect(() => {
    const onOpen = (event: Event) => {
      if (busyRef.current) return;
      const request = (event as CustomEvent<AuthModalRequest>).detail;
      if (!request || !["signin", "signup"].includes(request.intent)) return;
      if (
        request.audience &&
        !["choose", "customer", "agent"].includes(request.audience)
      )
        return;
      openerRef.current =
        request.trigger ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null);
      completedRef.current = false;
      setPhase("phone");
      setAudience(null);
      setPhoneInput("");
      setPhone("");
      setPhoneError("");
      setError("");
      setNotice("");
      setCode("");
      setChallenge(null);
      setVerified(null);
      setSavedProfile(null);
      setIsNewCustomer(false);
      setClockOffset(0);
      verifyKeyRef.current = "";
      setGeneration(value => value + 1);
      setOpen(true);
    };
    const onComplete = () => {
      completedRef.current = true;
      setOpen(false);
      updateBusy(false);
    };
    const onAuthLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self")
      )
        return;
      const target = new URL(anchor.href, window.location.origin);
      if (
        target.origin !== window.location.origin ||
        !["/login", "/customer-signup", "/agent-login"].includes(
          target.pathname
        )
      )
        return;
      event.preventDefault();
      openAuthModal({ intent: "signin", trigger: anchor });
    };
    window.addEventListener(AUTH_MODAL_OPEN_EVENT, onOpen);
    window.addEventListener(AUTH_COMPLETED_EVENT, onComplete);
    document.addEventListener("click", onAuthLink, true);
    return () => {
      window.removeEventListener(AUTH_MODAL_OPEN_EVENT, onOpen);
      window.removeEventListener(AUTH_COMPLETED_EVENT, onComplete);
      document.removeEventListener("click", onAuthLink, true);
    };
  }, [updateBusy]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      contentRef.current
        ?.querySelector<HTMLElement>(
          phase === "role"
            ? "[data-account-choice='customer']"
            : "input:not([disabled])"
        )
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, phase, audience, generation]);
  useEffect(() => {
    if (!open || phase !== "otp") return;
    const tick = () => setNow(Date.now() + clockOffset);
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [open, phase, clockOffset]);

  const changePhone = useCallback(() => {
    if (busyRef.current) return;
    setPhase("phone");
    setAudience(null);
    setPhoneError("");
    setError("");
    setNotice("");
    setCode("");
    setChallenge(null);
    setVerified(null);
    setSavedProfile(null);
    setIsNewCustomer(false);
    verifyKeyRef.current = "";
    setGeneration(value => value + 1);
  }, []);
  const acceptChallenge = (value: PhoneOtpChallenge) => {
    setChallenge(value);
    setClockOffset(value.serverNow - Date.now());
    setNow(value.serverNow);
    setCode("");
    setVerified(null);
    setSavedProfile(null);
    setIsNewCustomer(false);
    verifyKeyRef.current = crypto.randomUUID();
  };
  const startCode = async () => {
    const invalid = phoneFormatError(phoneInput, isEnglish);
    const normalized = normalizeSaudiPhone(phoneInput);
    if (invalid || !normalized) {
      setPhoneError(
        invalid ??
          (isEnglish
            ? "Enter a valid Saudi mobile number."
            : "أدخل رقم جوال سعودي صحيحًا.")
      );
      contentRef.current
        ?.querySelector<HTMLInputElement>("input[type='tel']")
        ?.focus();
      return;
    }
    if (!beginAction()) return;
    setPhoneError("");
    try {
      const value = await requestCode.mutateAsync({
        phone: normalized,
        language,
      });
      setPhone(normalized);
      setPhoneInput(normalized);
      acceptChallenge(value);
      setNotice("");
      setPhase("otp");
    } catch (failure) {
      setPhoneError(
        actionError(
          failure,
          isEnglish
            ? "We could not prepare the code. Please try again."
            : "تعذر تجهيز الرمز. حاول مرة أخرى.",
          isEnglish
        )
      );
    } finally {
      updateBusy(false);
    }
  };
  const resend = async () => {
    if (
      !challenge ||
      Date.now() + clockOffset < challenge.resendAvailableAt ||
      !beginAction()
    )
      return;
    try {
      const value = await resendCode.mutateAsync({
        challengeId: challenge.challengeId,
        language,
      });
      acceptChallenge(value);
      setNotice(
        isEnglish
          ? "A new demo code is ready. The previous request is invalid. No SMS was sent."
          : "تم تجديد الرمز التجريبي وإلغاء الطلب السابق. لم تُرسل رسالة SMS."
      );
    } catch (failure) {
      setError(
        actionError(
          failure,
          isEnglish
            ? "We could not renew the code. Try again."
            : "تعذر إعادة تجهيز الرمز. حاول مرة أخرى.",
          isEnglish
        )
      );
    } finally {
      updateBusy(false);
    }
  };
  const verify = async () => {
    if (!challenge || code.length !== 6 || !beginAction()) return;
    try {
      const value = await verifyCode.mutateAsync({
        challengeId: challenge.challengeId,
        code,
        clientKey: verifyKeyRef.current,
        language,
      });
      if (value.phone !== phone)
        throw new Error(
          isEnglish
            ? "Verification did not match your mobile. Start again."
            : "لم يتطابق التحقق مع رقم الجوال. أعد المحاولة."
        );
      setVerified(value);
      setCode("");
      setNotice("");
      setPhase("role");
    } catch (failure) {
      setError(
        actionError(
          failure,
          isEnglish
            ? "The code could not be verified. Check it and try again."
            : "تعذر التحقق من الرمز. راجعه وحاول مرة أخرى.",
          isEnglish
        )
      );
    } finally {
      updateBusy(false);
    }
  };
  const ensureVerified = () => {
    if (
      !verified ||
      verified.phone !== phone ||
      verified.expiresAt <= Date.now() + clockOffset
    )
      throw new Error(
        isEnglish
          ? "Your verification session has expired. Change mobile to verify again."
          : "انتهت جلسة التحقق. اختر تغيير الجوال للتحقق مجددًا."
      );
    return verified;
  };
  const finishAgent = async () => {
    const proof = ensureVerified();
    const result = await agentSignIn.mutateAsync({
      verificationToken: proof.verificationToken,
    });
    try {
      sessionStorage.removeItem("manus-cookie");
    } catch {
      /* A restricted browser may have no legacy mirror. */
    }
    await utils.auth.me.invalidate();
    const current = await utils.auth.me.fetch();
    if (result.role !== "agent" || current?.role !== "agent")
      throw new Error(
        isEnglish
          ? "Agent access could not be confirmed. Try again."
          : "تعذر تأكيد صلاحية المعقب. حاول مرة أخرى."
      );
    clearCustomerSession();
    finishSignIn(
      { role: current.role, name: result.name },
      isEnglish,
      navigate
    );
  };
  const chooseRole = async (role: "customer" | "agent") => {
    if (!beginAction()) return;
    try {
      const proof = ensureVerified();
      // Every signed-in phone, including an existing customer or active agent,
      // sees this one profile step before any redirect or join form.
      const profile = await utils.phoneProfile.get.fetch({
        verificationToken: proof.verificationToken,
        role,
      });
      setAudience(role);
      setSavedProfile(profile.profile);
      setIsNewCustomer(profile.isNewCustomer);
      setPhase("profile");
    } catch (failure) {
      setError(
        actionError(
          failure,
          isEnglish
            ? "We could not continue. Try again."
            : "تعذر المتابعة. حاول مرة أخرى.",
          isEnglish
        )
      );
    } finally {
      updateBusy(false);
    }
  };
  const saveProfile = async (
    values: PhoneProfileValues & { acceptedTerms: boolean }
  ) => {
    if (!audience || !beginAction()) return;
    try {
      const proof = ensureVerified();
      const saved = await savePhoneProfileMutation.mutateAsync({
        verificationToken: proof.verificationToken,
        role: audience,
        fullName: values.fullName,
        email: values.email,
        acceptedTerms: values.acceptedTerms,
      });
      setSavedProfile(saved.profile);

      if (audience === "customer") {
        if (!saved.customer) {
          throw new Error(
            isEnglish
              ? "Your customer account could not be saved. Please try again."
              : "تعذر حفظ حساب العميل. حاول مرة أخرى."
          );
        }
        // The established customer session uses the OTP-issued access token. The
        // verification ticket is never persisted in browser storage.
        saveCustomerSession({
          name: saved.customer.fullName,
          phone: saved.customer.phone || proof.phone,
          accessToken: proof.accessToken,
        });
        finishSignIn(
          {
            role: "customer",
            name: saved.customer.fullName,
            isNew: isNewCustomer,
          },
          isEnglish,
          navigate
        );
        return;
      }

      if (saved.hasActiveAgent) {
        await finishAgent();
        return;
      }
      // A pending/rejected/unprovisioned agent is only staged. AgentJoinForm
      // continues the request; it never receives a session or activated role.
      setPhase("complete");
    } catch (failure) {
      setError(
        actionError(
          failure,
          isEnglish
            ? "We could not save your profile. Try again."
            : "تعذر حفظ بياناتك. حاول مرة أخرى.",
          isEnglish
        )
      );
    } finally {
      updateBusy(false);
    }
  };
  const approvedSignIn = async () => {
    if (!beginAction()) return;
    try {
      await finishAgent();
    } catch (failure) {
      setError(
        actionError(
          failure,
          isEnglish
            ? "We could not sign you in. Try again."
            : "تعذر الدخول. حاول مرة أخرى.",
          isEnglish
        )
      );
    } finally {
      updateBusy(false);
    }
  };
  const changeRole = () => {
    if (busyRef.current) return;
    setPhase("role");
    setAudience(null);
    setSavedProfile(null);
    setIsNewCustomer(false);
    setError("");
    setGeneration(value => value + 1);
  };
  const title =
    phase === "phone"
      ? isEnglish
        ? "Continue with your mobile"
        : "الدخول برقم الجوال"
      : phase === "otp"
        ? isEnglish
          ? "Verify your mobile"
          : "رمز التحقق"
      : phase === "role"
          ? isEnglish
            ? "Choose your account type"
            : "اختر نوع حسابك"
          : phase === "profile"
            ? isEnglish
              ? "Complete your profile"
              : "أكمل بياناتك"
            : audience === "agent"
            ? isEnglish
              ? "Agent join request"
              : "طلب انضمام معقب"
            : isEnglish
              ? "Complete your profile"
              : "أكمل بياناتك";
  const stepIndex =
    phase === "phone" ? 0 : phase === "otp" ? 1 : phase === "role" ? 2 : 3;

  return (
    <Dialog
      open={open}
      onOpenChange={value => {
        if (value || !busyRef.current) setOpen(value);
      }}
    >
      <DialogContent
        ref={contentRef}
        overlayClassName="z-[105] bg-[#102a43]/45 backdrop-blur-[3px] motion-reduce:animate-none"
        showCloseButton={false}
        className="z-[110] max-h-[92dvh] w-[calc(100vw-1.5rem)] overflow-y-auto rounded-[1.75rem] border-[#d5e6f7] bg-white p-5 text-[#102a43] shadow-[0_28px_90px_rgba(16,42,67,.22)] motion-reduce:animate-none sm:max-w-[530px] sm:p-7"
        dir={isEnglish ? "ltr" : "rtl"}
        onInteractOutside={event => event.preventDefault()}
        onEscapeKeyDown={event => {
          if (busyRef.current) event.preventDefault();
        }}
        onOpenAutoFocus={event => {
          event.preventDefault();
          contentRef.current
            ?.querySelector<HTMLInputElement>("input:not([disabled])")
            ?.focus();
        }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          if (completedRef.current) return;
          if (openerRef.current?.isConnected) {
            openerRef.current.focus();
            return;
          }
          Array.from(
            document.querySelectorAll<HTMLElement>(
              "[data-auth-trigger='signin']"
            )
          )
            .find(element => element.getClientRects().length > 0)
            ?.focus();
        }}
      >
        <DialogHeader className="text-start sm:text-start">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark
                isEnglish={isEnglish}
                className="h-11 w-11 shrink-0 rounded-2xl"
              />
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#60778f]">
                  {isEnglish ? "Maalamati Care" : "معاملاتي كير"}
                </p>
                <DialogTitle className="mt-1 font-display text-lg font-black leading-7 text-[#102a43] sm:text-xl">
                  {title}
                </DialogTitle>
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!busyRef.current) setOpen(false);
              }}
              aria-label={isEnglish ? "Close sign in" : "إغلاق نافذة الدخول"}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#e1ebf6] text-[#60778f] hover:bg-[#f1f7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] disabled:opacity-40"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <DialogDescription className="sr-only">
            {isEnglish
              ? "Enter your mobile, verify the code, then choose Customer or Agent. New agents submit a request for admin approval."
              : "أدخل رقم الجوال، وتحقق من الرمز، ثم اختر عميلًا أو معقبًا. يرسل المعقب الجديد طلبًا لموافقة الإدارة."}
          </DialogDescription>
        </DialogHeader>
        <ol
          aria-label={isEnglish ? "Account access steps" : "خطوات الدخول"}
          className="grid grid-cols-4 gap-1 rounded-2xl border border-[#e3eef9] bg-[#f5f9fd] p-1.5 sm:gap-1.5 sm:p-2"
        >
          {(isEnglish
            ? ["Mobile", "Code", "Type", "Profile"]
            : ["الجوال", "الرمز", "النوع", "البيانات"]
          ).map((label, index) => (
            <li
              key={label}
              aria-current={index === stepIndex ? "step" : undefined}
              className={`flex min-w-0 items-center justify-center gap-0.5 rounded-xl px-0.5 py-2 text-center text-[9px] font-extrabold sm:gap-1.5 sm:px-1 sm:text-[11px] ${index === stepIndex ? "bg-white text-[#075aa8] shadow-sm" : index < stepIndex ? "text-[#216547]" : "text-[#60778f]"}`}
            >
              <span
                aria-hidden="true"
                className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-current sm:h-5 sm:w-5"
              >
                {index < stepIndex ? <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> : index + 1}
              </span>
              <span className="truncate">{label}</span>
            </li>
          ))}
        </ol>
        {phase === "phone" ? (
          <form
            noValidate
            onSubmit={event => {
              event.preventDefault();
              void startCode();
            }}
            className="min-w-0 space-y-5"
          >
            <div>
              <h2 className="flex items-center gap-2 font-display text-xl font-black">
                <Smartphone
                  className="h-5 w-5 text-[#0878f9]"
                  aria-hidden="true"
                />
                {isEnglish ? "Enter your mobile number" : "أدخل رقم جوالك"}
              </h2>
              <p className="mt-2 text-sm leading-7 text-[#536e88]">
                {isEnglish
                  ? "One entry for new and existing accounts. Verify your mobile once, then choose Customer or Agent."
                  : "مدخل واحد للحساب الجديد أو الموجود. تحقّق من جوالك مرة واحدة، ثم اختر عميلًا أو معقبًا."}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor={`${fieldId}-phone`}
                  className="block text-sm font-bold text-[#17334f]"
                >
                  {isEnglish ? "Mobile number" : "رقم الجوال"}
                </label>
                <span className="rounded-full bg-[#eaf3ff] px-2 py-1 text-[10px] font-extrabold text-[#075aa8]">
                  {isEnglish ? "Saudi mobile" : "جوال سعودي"}
                </span>
              </div>
              <Input
                id={`${fieldId}-phone`}
                type="tel"
                required
                disabled={busy}
                maxLength={24}
                autoComplete="tel"
                inputMode="tel"
                dir="ltr"
                value={phoneInput}
                aria-invalid={Boolean(phoneError)}
                aria-describedby={`${fieldId}-phone-hint${phoneError ? ` ${fieldId}-error` : ""}`}
                onChange={event => {
                  setPhoneInput(event.target.value);
                  setPhoneError("");
                }}
                placeholder="05X XXX XXXX"
                className={`mt-2 h-13 rounded-xl text-left text-base ${phoneError ? "border-[#d68b97] bg-[#fff7f8]" : "border-[#bfd5ec] bg-[#fbfdff]"}`}
              />
              <p
                id={`${fieldId}-phone-hint`}
                className="mt-2 text-xs leading-6 text-[#536e88]"
              >
                {isEnglish ? "Example:" : "مثال:"}{" "}
                <bdi dir="ltr">0501234567</bdi> {isEnglish ? "or" : "أو"}{" "}
                <bdi dir="ltr">+966501234567</bdi>
                {isEnglish
                  ? ". Arabic digits are supported."
                  : ". تُقبل الأرقام العربية."}
              </p>
            </div>
            {phoneError && (
              <p
                id={`${fieldId}-error`}
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-[#f2c8ce] bg-[#fff2f4] px-3 py-2 text-xs font-bold leading-6 text-[#a9323e]"
              >
                <AlertCircle
                  className="mt-1 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                {phoneError}
              </p>
            )}
            <Button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-xl bg-[#0668d9] font-extrabold text-white hover:bg-[#0457ba]"
            >
              {busy
                ? isEnglish
                  ? "Preparing code…"
                  : "جارٍ تجهيز الرمز…"
                : isEnglish
                  ? "Continue"
                  : "متابعة"}
              {isEnglish ? (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
            <p className="rounded-xl bg-[#f4f9ff] px-3 py-2 text-xs leading-6 text-[#536e88]">
              {isEnglish
                ? "Demo mode: the code is displayed in the window; no SMS is sent."
                : "وضع تجريبي: يظهر الرمز داخل النافذة، ولا تُرسل رسالة SMS."}
            </p>
          </form>
        ) : phase === "otp" && challenge ? (
          <PhoneOtpStep
            phone={phone}
            challenge={challenge}
            now={now}
            code={code}
            error={error}
            notice={notice}
            busy={busy}
            onCodeChange={value => {
              setCode(value);
              setError("");
            }}
            onVerify={() => void verify()}
            onResend={() => void resend()}
            onChangePhone={changePhone}
          />
        ) : phase === "role" ? (
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#cce7d9] bg-[#f4faf6] px-3 py-2">
              <p className="flex items-center gap-1.5 text-sm font-bold text-[#216547]">
                <Check className="h-4 w-4" aria-hidden="true" />
                {isEnglish ? "Verified (demo)" : "تم التحقق (تجريبي)"}:{" "}
                <bdi dir="ltr">{phone}</bdi>
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={changePhone}
                className="min-h-11 rounded-lg px-2 text-xs font-extrabold text-[#075aa8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] disabled:opacity-40"
              >
                {isEnglish ? "Change mobile number" : "تغيير رقم الجوال"}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={busy}
                data-account-choice="customer"
                onClick={() => void chooseRole("customer")}
                className="flex min-h-28 items-center gap-3 rounded-2xl bg-[#0668d9] p-4 text-start text-white transition-colors hover:bg-[#0457ba] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] focus-visible:ring-offset-2 disabled:opacity-50"
              >
                <UserRound className="h-7 w-7 shrink-0" aria-hidden="true" />
                <span>
                  <strong className="block text-lg">
                    {isEnglish ? "Customer" : "عميل"}
                  </strong>
                  <span className="mt-1 block text-xs leading-5">
                    {isEnglish
                      ? "Request services and follow your requests"
                      : "طلب الخدمات ومتابعة طلباتك"}
                  </span>
                </span>
              </button>
              <button
                type="button"
                disabled={busy}
                data-account-choice="agent"
                onClick={() => void chooseRole("agent")}
                className="flex min-h-28 items-center gap-3 rounded-2xl border border-[#b7dbff] bg-[#f5faff] p-4 text-start text-[#17334f] transition-colors hover:bg-[#eaf3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] focus-visible:ring-offset-2 disabled:opacity-50"
              >
                <BadgeCheck
                  className="h-7 w-7 shrink-0 text-[#0878f9]"
                  aria-hidden="true"
                />
                <span>
                  <strong className="block text-lg">
                    {isEnglish ? "Agent" : "معقب"}
                  </strong>
                  <span className="mt-1 block text-xs leading-5">
                    {isEnglish
                      ? "Sign in, or request to join the team"
                      : "الدخول، أو تقديم طلب انضمام للفريق"}
                  </span>
                </span>
              </button>
            </div>
            <p className="text-xs leading-6 text-[#536e88]">
              {isEnglish
                ? "New agents submit their details for admin approval. Access is activated only after approval."
                : "يرسل المعقب الجديد بياناته لمراجعة الإدارة؛ لا يُفعّل الحساب إلا بعد الموافقة."}
            </p>
            {busy && (
              <p
                role="status"
                className="text-center text-xs font-bold text-[#075aa8]"
              >
                {isEnglish ? "Checking your account…" : "جارٍ التحقق من حسابك…"}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-[#fff2f4] px-3 py-2 text-xs font-bold leading-6 text-[#a9323e]"
              >
                {error}
              </p>
            )}
          </div>
        ) : phase === "profile" && verified && audience ? (
          <div className="min-w-0 space-y-4">
            <button
              type="button"
              disabled={busy}
              onClick={changeRole}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-bold text-[#075aa8] hover:bg-[#f1f7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] disabled:opacity-40"
            >
              {isEnglish ? (
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              )}
              {isEnglish ? "Change account type" : "تغيير نوع الحساب"}
            </button>
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-[#fff2f4] px-3 py-2 text-xs font-bold leading-6 text-[#a9323e]"
              >
                {error}
              </p>
            )}
            <CompletePhoneProfile
              key={`profile-${audience}-${generation}`}
              role={audience}
              phone={phone}
              initialProfile={savedProfile}
              isNewCustomer={audience === "customer" && isNewCustomer}
              busy={busy}
              onSave={saveProfile}
            />
          </div>
        ) : phase === "complete" && verified && audience === "agent" ? (
          <div className="min-w-0 space-y-4">
            <button
              type="button"
              disabled={busy}
              onClick={changeRole}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-bold text-[#075aa8] hover:bg-[#f1f7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] disabled:opacity-40"
            >
              {isEnglish ? (
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              )}
              {isEnglish ? "Change account type" : "تغيير نوع الحساب"}
            </button>
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-[#fff2f4] px-3 py-2 text-xs font-bold leading-6 text-[#a9323e]"
              >
                {error}
              </p>
            )}
            <AgentJoinFormWithProfile
              key={`agent-${generation}`}
              phone={phone}
              verificationToken={verified.verificationToken}
              initialProfile={savedProfile ?? undefined}
              onBusyChange={updateBusy}
              onSignIn={() => void approvedSignIn()}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
