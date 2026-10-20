import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import React, {
  type FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

export type AgentJoinFormProps = {
  verificationToken: string;
  phone: string;
  onBusyChange?: (busy: boolean) => void;
  onSignIn?: () => void;
};

type AgentApplication = {
  id: number;
  reference: string;
  phone: string;
  fullName: string;
  email: string;
  city: string;
  specialty: string;
  experienceYears: number;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  createdAt: number;
  reviewedAt: number | null;
};

type JoinFormValues = {
  fullName: string;
  email: string;
  city: string;
  specialty: string;
  experienceYears: string;
  notes: string;
  consent: boolean;
};

const emptyValues: JoinFormValues = {
  fullName: "",
  email: "",
  city: "",
  specialty: "",
  experienceYears: "0",
  notes: "",
  consent: false,
};

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isExpiredToken(error: unknown) {
  const message = messageFrom(error, "").toLowerCase();
  return /expired|expire|token|verification|انتهت|صلاحية|تحقق/.test(message);
}

export function AgentJoinForm({
  verificationToken,
  phone,
  onBusyChange,
  onSignIn,
}: AgentJoinFormProps) {
  const { isEnglish } = useLanguage();
  const fullNameId = useId();
  const emailId = useId();
  const cityId = useId();
  const specialtyId = useId();
  const experienceId = useId();
  const notesId = useId();
  const consentId = useId();
  const status = trpc.agentApplications.status.useQuery({ verificationToken });
  const submit = trpc.agentApplications.submit.useMutation();
  const submittingRef = useRef(false);
  const [values, setValues] = useState<JoinFormValues>(emptyValues);
  const [formError, setFormError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [receipt, setReceipt] = useState<AgentApplication | null>(null);

  const copy = isEnglish
    ? {
        title: "Apply to join as an agent",
        subtitle:
          "Your application is reviewed by the owner before any account is activated.",
        verifiedPhone: "Verified mobile number",
        ownershipNotice:
          "The current demo OTP does not prove real ownership and does not send an SMS or WhatsApp message.",
        fullName: "Full name",
        email: "Email address",
        city: "City",
        specialty: "Specialty",
        experience: "Years of experience",
        notes: "Additional notes (optional)",
        notesHint:
          "Maximum 1,000 characters. Do not include ID documents or attachments.",
        consent:
          "I agree to send these details to the administration for review.",
        send: "Send application for review",
        sending: "Sending application…",
        loading: "Checking your application status…",
        retry: "Try again",
        checkError: "We could not check your application status. Try again.",
        expired:
          "This verification session has expired or is invalid. Start verification again to submit an application.",
        required: "Complete the required fields with valid information.",
        experienceError: "Enter a whole number of years from 0 to 60.",
        consentError:
          "You must agree before sending your details to the administration.",
        submitError: "We could not send your application. Try again.",
        submittedTitle: "Application received",
        submittedText:
          "Your application was recorded and is waiting for the administration's review.",
        reference: "Application reference",
        pendingTitle: "Your application is pending review",
        pendingText:
          "You cannot sign in as a specialist until the administration approves and activates your account.",
        rejectedTitle: "Your application was not approved",
        rejectedText:
          "You cannot submit another application from this verified session.",
        reviewReason: "Administration note",
        approvedTitle: "Application approved",
        approvedText:
          "Your approval is recorded. We are checking whether the administration has activated your account.",
        activeTitle: "Your specialist account is active",
        activeText:
          "The administration approved your application and activated your account.",
        signIn: "Sign in after approval",
        reload: "Refresh status",
      }
    : {
        title: "طلب انضمام كمعقب",
        subtitle: "يراجع المالك طلبك قبل تفعيل أي حساب.",
        verifiedPhone: "رقم الجوال المتحقق منه",
        ownershipNotice:
          "رمز التحقق التجريبي الحالي لا يثبت ملكية حقيقية ولا يرسل رسالة SMS أو واتساب.",
        fullName: "الاسم الكامل",
        email: "البريد الإلكتروني",
        city: "المدينة",
        specialty: "التخصص",
        experience: "سنوات الخبرة",
        notes: "ملاحظات إضافية (اختياري)",
        notesHint: "الحد الأقصى 1000 حرف. لا تضع هوية أو مرفقات إضافية.",
        consent: "أوافق على إرسال هذه البيانات إلى الإدارة للمراجعة.",
        send: "إرسال طلب الانضمام للمراجعة",
        sending: "جارٍ إرسال الطلب…",
        loading: "جارٍ التحقق من حالة طلبك…",
        retry: "إعادة المحاولة",
        checkError: "تعذر التحقق من حالة طلبك. أعد المحاولة.",
        expired:
          "انتهت صلاحية جلسة التحقق أو أنها غير صالحة. ابدأ التحقق مجددًا لإرسال طلب.",
        required: "أكمل الحقول المطلوبة بمعلومات صحيحة.",
        experienceError: "أدخل عدد سنوات صحيحًا من 0 إلى 60.",
        consentError: "يجب الموافقة قبل إرسال بياناتك إلى الإدارة.",
        submitError: "تعذر إرسال طلبك. أعد المحاولة.",
        submittedTitle: "تم استلام الطلب",
        submittedText: "سُجل طلبك وهو بانتظار مراجعة الإدارة.",
        reference: "رقم الطلب",
        pendingTitle: "طلبك بانتظار المراجعة",
        pendingText:
          "لا يمكنك الدخول كمعقب حتى توافق الإدارة على طلبك وتفعل حسابك.",
        rejectedTitle: "لم تتم الموافقة على طلبك",
        rejectedText: "لا يمكنك إرسال طلب آخر من جلسة التحقق هذه.",
        reviewReason: "ملاحظة الإدارة",
        approvedTitle: "تمت الموافقة على الطلب",
        approvedText: "سُجلت الموافقة. نتحقق من أن الإدارة فعّلت حسابك.",
        activeTitle: "حساب المعقب لديك مفعل",
        activeText: "وافقت الإدارة على طلبك وفعّلت حسابك.",
        signIn: "دخول بعد الموافقة",
        reload: "تحديث الحالة",
      };

  useEffect(() => {
    onBusyChange?.(submit.isPending);
    return () => onBusyChange?.(false);
  }, [onBusyChange, submit.isPending]);

  const application = (status.data?.application ?? receipt) as
    | AgentApplication
    | null
    | undefined;

  const update = <Key extends keyof JoinFormValues>(
    key: Key,
    value: JoinFormValues[Key]
  ) => {
    setValues(current => ({ ...current, [key]: value }));
    setFormError("");
    setRequestError("");
  };

  const submitApplication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || submit.isPending) return;

    const fullName = values.fullName.trim();
    const email = values.email.trim();
    const city = values.city.trim();
    const specialty = values.specialty.trim();
    const experienceYears = Number(values.experienceYears);
    const notes = values.notes.trim();

    if (
      fullName.length < 2 ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      city.length < 2 ||
      specialty.length < 2
    ) {
      setFormError(copy.required);
      return;
    }
    if (
      !Number.isInteger(experienceYears) ||
      experienceYears < 0 ||
      experienceYears > 60
    ) {
      setFormError(copy.experienceError);
      return;
    }
    if (!values.consent) {
      setFormError(copy.consentError);
      return;
    }

    submittingRef.current = true;
    setFormError("");
    setRequestError("");
    try {
      const created = await submit.mutateAsync({
        verificationToken,
        fullName,
        email,
        city,
        specialty,
        experienceYears,
        ...(notes ? { notes } : {}),
        consent: true,
      });
      setReceipt(created as AgentApplication);
      setValues(emptyValues);
      void status.refetch();
    } catch (error) {
      setRequestError(
        isExpiredToken(error)
          ? copy.expired
          : messageFrom(error, copy.submitError)
      );
    } finally {
      submittingRef.current = false;
    }
  };

  const StatusCard = ({
    icon,
    title,
    children,
    tone = "blue",
  }: {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
    tone?: "blue" | "green" | "red";
  }) => {
    const tones = {
      blue: "border-[#b7dbff] bg-[#f6fbff] text-[#0668d9]",
      green: "border-[#cce9c9] bg-[#f4fcf2] text-[#297334]",
      red: "border-[#f3c8cd] bg-[#fff7f7] text-[#b13b47]",
    };
    return (
      <section
        className={`min-w-0 w-full max-w-xl rounded-3xl border p-6 shadow-[0_18px_55px_rgba(27,79,129,.10)] motion-safe:transition-transform motion-safe:duration-200 ${tones[tone]}`}
        dir={isEnglish ? "ltr" : "rtl"}
      >
        <div className="flex items-start gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white shadow-sm"
            aria-hidden="true"
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-black text-[#102a43]">
              {title}
            </h2>
            {children}
          </div>
        </div>
      </section>
    );
  };

  if (status.isLoading) {
    return (
      <StatusCard
        icon={<Loader2 className="h-5 w-5 animate-spin" />}
        title={copy.loading}
      >
        <p className="mt-2 text-sm leading-6 text-[#60778f]" aria-live="polite">
          {copy.loading}
        </p>
      </StatusCard>
    );
  }

  if (status.isError) {
    const errorCopy = isExpiredToken(status.error)
      ? copy.expired
      : copy.checkError;
    return (
      <StatusCard
        icon={<AlertCircle className="h-5 w-5" />}
        title={isEnglish ? "Unable to check status" : "تعذر التحقق من الحالة"}
        tone="red"
      >
        <p role="alert" className="mt-2 text-sm leading-6 text-[#7d2632]">
          {errorCopy}
        </p>
        <Button
          type="button"
          onClick={() => void status.refetch()}
          className="mt-5 h-10 rounded-xl bg-[#0668d9] text-white hover:bg-[#055bbd]"
        >
          <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
          {copy.retry}
        </Button>
      </StatusCard>
    );
  }

  if (status.data?.hasActiveAgent) {
    return (
      <StatusCard
        icon={<CheckCircle2 className="h-5 w-5" />}
        title={copy.activeTitle}
        tone="green"
      >
        <p className="mt-2 text-sm leading-6 text-[#315b35]">
          {copy.activeText}
        </p>
        <Button
          type="button"
          onClick={onSignIn}
          disabled={!onSignIn}
          className="mt-5 h-11 rounded-xl bg-[#0668d9] font-extrabold text-white hover:bg-[#055bbd]"
        >
          <LockKeyhole className="me-2 h-4 w-4" aria-hidden="true" />
          {copy.signIn}
        </Button>
      </StatusCard>
    );
  }

  if (application) {
    if (application.status === "rejected") {
      return (
        <StatusCard
          icon={<XCircle className="h-5 w-5" />}
          title={copy.rejectedTitle}
          tone="red"
        >
          <p className="mt-2 text-sm leading-6 text-[#7d2632]">
            {copy.rejectedText}
          </p>
          <p className="mt-4 rounded-xl bg-white/75 p-3 text-sm font-bold text-[#102a43]">
            <span className="text-[#60778f]">{copy.reference}: </span>
            <span dir="ltr">{application.reference}</span>
          </p>
          {application.reviewNote ? (
            <div className="mt-3 rounded-xl border border-[#f0d7da] bg-white/80 p-3">
              <p className="text-xs font-black text-[#7d2632]">
                {copy.reviewReason}
              </p>
              <p className="mt-1 text-sm leading-6 text-[#3c4e60]">
                {application.reviewNote}
              </p>
            </div>
          ) : null}
        </StatusCard>
      );
    }
    if (application.status === "approved") {
      return (
        <StatusCard
          icon={<BadgeCheck className="h-5 w-5" />}
          title={copy.approvedTitle}
        >
          <p className="mt-2 text-sm leading-6 text-[#31516e]">
            {copy.approvedText}
          </p>
          <p className="mt-4 rounded-xl bg-white/75 p-3 text-sm font-bold text-[#102a43]">
            <span className="text-[#60778f]">{copy.reference}: </span>
            <span dir="ltr">{application.reference}</span>
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void status.refetch()}
            className="mt-5 h-10 rounded-xl border-[#9ac8f6] bg-white text-[#0668d9]"
          >
            <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
            {copy.reload}
          </Button>
        </StatusCard>
      );
    }
    return (
      <StatusCard
        icon={<ClipboardCheck className="h-5 w-5" />}
        title={receipt ? copy.submittedTitle : copy.pendingTitle}
      >
        <p className="mt-2 text-sm leading-6 text-[#31516e]">
          {receipt ? copy.submittedText : copy.pendingText}
        </p>
        <p className="mt-4 rounded-xl bg-white/75 p-3 text-sm font-bold text-[#102a43]">
          <span className="text-[#60778f]">{copy.reference}: </span>
          <span dir="ltr">{application.reference}</span>
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void status.refetch()}
          className="mt-5 h-10 rounded-xl border-[#9ac8f6] bg-white text-[#0668d9]"
        >
          <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
          {copy.reload}
        </Button>
      </StatusCard>
    );
  }

  return (
    <section
      className="min-w-0 w-full max-w-xl rounded-3xl border border-[#dce8f6] bg-white p-5 shadow-[0_18px_55px_rgba(27,79,129,.10)] sm:p-7"
      dir={isEnglish ? "ltr" : "rtl"}
    >
      <div className="flex items-start gap-3">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0668d9]"
          aria-hidden="true"
        >
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div>
          <h2 className="font-display text-xl font-black text-[#102a43]">
            {copy.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#60778f]">
            {copy.subtitle}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-[#b7dbff] bg-[#f3f9ff] p-3 text-sm text-[#31516e]">
        <p className="font-bold text-[#102a43]">
          {copy.verifiedPhone}: <span dir="ltr">{phone}</span>
        </p>
        <p className="mt-1 text-xs leading-5">{copy.ownershipNotice}</p>
      </div>

      <form className="mt-6 space-y-4" onSubmit={submitApplication} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={fullNameId}>{copy.fullName}</Label>
            <Input
              id={fullNameId}
              autoComplete="name"
              disabled={submit.isPending}
              value={values.fullName}
              onChange={event => update("fullName", event.target.value)}
              aria-invalid={Boolean(formError)}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={emailId}>{copy.email}</Label>
            <Input
              id={emailId}
              type="email"
              dir="ltr"
              autoComplete="email"
              disabled={submit.isPending}
              value={values.email}
              onChange={event => update("email", event.target.value)}
              aria-invalid={Boolean(formError)}
              className="h-11 rounded-xl text-left"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={cityId}>{copy.city}</Label>
            <Input
              id={cityId}
              autoComplete="address-level2"
              disabled={submit.isPending}
              value={values.city}
              onChange={event => update("city", event.target.value)}
              aria-invalid={Boolean(formError)}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={specialtyId}>{copy.specialty}</Label>
            <Input
              id={specialtyId}
              disabled={submit.isPending}
              value={values.specialty}
              onChange={event => update("specialty", event.target.value)}
              aria-invalid={Boolean(formError)}
              className="h-11 rounded-xl"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={experienceId}>{copy.experience}</Label>
          <Input
            id={experienceId}
            type="number"
            min={0}
            max={60}
            step={1}
            inputMode="numeric"
            disabled={submit.isPending}
            value={values.experienceYears}
            onChange={event => update("experienceYears", event.target.value)}
            aria-invalid={Boolean(formError)}
            className="h-11 rounded-xl"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={notesId}>{copy.notes}</Label>
          <Textarea
            id={notesId}
            maxLength={1000}
            disabled={submit.isPending}
            value={values.notes}
            onChange={event => update("notes", event.target.value)}
            aria-describedby={`${notesId}-hint`}
            className="min-h-24 rounded-xl"
          />
          <p
            id={`${notesId}-hint`}
            className="text-xs leading-5 text-[#60778f]"
          >
            {copy.notesHint} ({values.notes.length}/1000)
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-[#dce8f6] bg-[#f8fbff] p-3">
          <Checkbox
            id={consentId}
            checked={values.consent}
            disabled={submit.isPending}
            onCheckedChange={checked => update("consent", checked === true)}
            aria-invalid={Boolean(formError && !values.consent)}
            className="mt-0.5 h-5 w-5 border-[#6388ad]"
          />
          <Label
            htmlFor={consentId}
            className="cursor-pointer text-sm font-bold leading-6 text-[#17334f]"
          >
            {copy.consent}
          </Label>
        </div>
        {formError || requestError ? (
          <p
            role="alert"
            className="rounded-xl bg-[#fff1f3] px-3 py-3 text-sm font-bold leading-6 text-[#a9323f]"
          >
            {formError || requestError}
          </p>
        ) : null}
        <Button
          disabled={submit.isPending}
          className="h-auto min-h-12 w-full whitespace-normal rounded-xl bg-[#0668d9] font-extrabold text-white shadow-[0_4px_0_#0457ba] motion-safe:transition-transform motion-safe:duration-150 active:scale-[.98] hover:bg-[#055bbd]"
        >
          {submit.isPending ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="me-2 h-4 w-4" aria-hidden="true" />
          )}
          {submit.isPending ? copy.sending : copy.send}
        </Button>
      </form>
    </section>
  );
}
