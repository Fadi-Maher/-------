import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCustomerSession } from "@/lib/customerSession";
import {
  isCustomerProfileDirty,
  normalizeCustomerProfileForm,
  validateCustomerProfileForm,
  type CustomerProfileFormErrors,
  type CustomerProfileFormValues,
} from "@/lib/customerProfileForm";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CalendarDays, CheckCircle2, Loader2, Lock, Mail, Phone, RotateCcw, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

type Props = {
  accessToken: string;
  isEnglish: boolean;
  /** Called when the signed phone token is no longer accepted. */
  onSessionExpired: () => void;
};

const emptyValues: CustomerProfileFormValues = { fullName: "", email: "" };

type ProfileStatus =
  | { kind: "saved" | "noChanges" | "expired" | "fixErrors" }
  | { kind: "error"; message: string }
  | null;

export function CustomerProfilePanel({ accessToken, isEnglish, onSessionExpired }: Props) {
  const copy = isEnglish
    ? {
        heading: "Personal details",
        hint: "These details appear to your service provider and on your requests.",
        fullName: "Full name",
        email: "Email",
        optional: "Optional",
        emailHint: "Used to contact you about your requests. Leave empty if you prefer.",
        phone: "Mobile number",
        phoneHint: "Your mobile number is your sign-in. To change it, contact support.",
        memberSince: "Member since",
        account: "Account",
        save: "Save changes",
        saving: "Saving…",
        reset: "Undo changes",
        saved: "Your profile was updated.",
        noChanges: "No changes to save.",
        loading: "Loading your profile…",
        loadError: "We couldn't load your profile.",
        retry: "Try again",
        expired: "Your session has ended. Sign in again to edit your profile.",
        signInAgain: "Sign in again",
        fixErrors: "Please fix the highlighted fields.",
      }
    : {
        heading: "البيانات الشخصية",
        hint: "تظهر هذه البيانات لمقدم الخدمة وفي طلباتك.",
        fullName: "الاسم الكامل",
        email: "البريد الإلكتروني",
        optional: "اختياري",
        emailHint: "نستخدمه للتواصل بخصوص طلباتك، ويمكنك تركه فارغًا.",
        phone: "رقم الجوال",
        phoneHint: "رقم الجوال هو وسيلة دخولك. لتغييره تواصل مع الدعم.",
        memberSince: "عضو منذ",
        account: "الحساب",
        save: "حفظ التغييرات",
        saving: "جارٍ الحفظ…",
        reset: "تراجع عن التغييرات",
        saved: "تم تحديث ملفك الشخصي.",
        noChanges: "لا توجد تغييرات للحفظ.",
        loading: "جارٍ تحميل ملفك الشخصي…",
        loadError: "تعذّر تحميل ملفك الشخصي.",
        retry: "إعادة المحاولة",
        expired: "انتهت جلستك. سجّل الدخول من جديد لتعديل ملفك.",
        signInAgain: "تسجيل الدخول من جديد",
        fixErrors: "يرجى تصحيح الحقول المحددة.",
      };

  const utils = trpc.useUtils();
  const input = useMemo(() => ({ accessToken }), [accessToken]);
  const profile = trpc.customers.myProfile.useQuery(input, { enabled: accessToken.length > 20, retry: false });
  const [values, setValues] = useState<CustomerProfileFormValues>(emptyValues);
  const [errors, setErrors] = useState<CustomerProfileFormErrors>({});
  // Store what happened, not the sentence, so the message follows a later language switch.
  const [status, setStatus] = useState<ProfileStatus>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const saved = useMemo<CustomerProfileFormValues>(
    () => (profile.data ? { fullName: profile.data.fullName, email: profile.data.email ?? "" } : emptyValues),
    [profile.data],
  );
  // Fill the form once per loaded profile; later refetches must not wipe what the customer is typing.
  const loadedKey = profile.data ? `${profile.data.phone}|${profile.data.fullName}|${profile.data.email ?? ""}` : "";
  useEffect(() => {
    if (!loadedKey) return;
    setValues(saved);
    setErrors({});
  }, [loadedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = trpc.customers.updateMyProfile.useMutation({
    onSuccess: result => {
      utils.customers.myProfile.setData(input, result.profile);
      setValues({ fullName: result.profile.fullName, email: result.profile.email ?? "" });
      setErrors({});
      // Keep the header greeting and the rest of the account page in step with the new name.
      saveCustomerSession({ name: result.profile.fullName, phone: result.profile.phone, accessToken });
      setStatus({ kind: result.changed ? "saved" : "noChanges" });
      if (result.changed) toast.success(copy.saved);
    },
    onError: error => {
      if (error.data?.code === "UNAUTHORIZED" || error.data?.code === "NOT_FOUND") {
        setStatus({ kind: "expired" });
        toast.error(copy.expired);
        return;
      }
      setStatus({ kind: "error", message: error.message });
      toast.error(error.message);
    },
  });

  // Re-word visible field errors when the visitor switches language.
  useEffect(() => {
    setErrors(current => {
      if (!current.fullName && !current.email) return current;
      const next = validateCustomerProfileForm(values, isEnglish);
      return { fullName: current.fullName ? next.fullName : undefined, email: current.email ? next.email : undefined };
    });
  }, [isEnglish]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = isCustomerProfileDirty(values, saved);
  const busy = update.isPending;

  const change = (field: keyof CustomerProfileFormValues, value: string) => {
    setValues(current => ({ ...current, [field]: value }));
    setStatus(null);
    if (errors[field]) setErrors(current => ({ ...current, [field]: undefined }));
  };

  const validateField = (field: keyof CustomerProfileFormValues) => {
    const next = validateCustomerProfileForm(values, isEnglish);
    setErrors(current => ({ ...current, [field]: next[field] }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const nextErrors = validateCustomerProfileForm(values, isEnglish);
    setErrors(nextErrors);
    if (nextErrors.fullName || nextErrors.email) {
      setStatus({ kind: "fixErrors" });
      (nextErrors.fullName ? nameRef : emailRef).current?.focus();
      return;
    }
    if (!dirty) {
      setStatus({ kind: "noChanges" });
      return;
    }
    const normalized = normalizeCustomerProfileForm(values);
    update.mutate({ accessToken, fullName: normalized.fullName, email: normalized.email || null });
  };

  const sessionProblem =
    profile.error?.data?.code === "UNAUTHORIZED" ||
    profile.error?.data?.code === "NOT_FOUND" ||
    update.error?.data?.code === "UNAUTHORIZED" ||
    update.error?.data?.code === "NOT_FOUND";

  if (profile.isLoading) {
    return (
      <div className="mt-7 flex min-h-48 items-center justify-center gap-3 rounded-2xl border border-[#e2ecf7] bg-[#fbfdff] p-6 text-sm font-bold text-[#60778f]" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-[#0878f9]" aria-hidden="true" />
        {copy.loading}
      </div>
    );
  }

  if (sessionProblem || profile.error) {
    return (
      <div className="mt-7 rounded-2xl border border-[#ffd8dc] bg-[#fff8f8] p-5 sm:p-6" role="alert">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#c83d4b]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-extrabold text-[#8f2833]">{sessionProblem ? copy.expired : copy.loadError}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {sessionProblem ? (
                <Button type="button" onClick={onSessionExpired} className="h-10 rounded-xl bg-[#0668d9] font-extrabold text-white hover:bg-[#0457ba]">
                  {copy.signInAgain}
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={() => void profile.refetch()} className="h-10 rounded-xl border-[#d8e6f5] bg-white font-extrabold text-[#17334f]">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  {copy.retry}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const memberSince = profile.data?.memberSince
    ? new Date(profile.data.memberSince).toLocaleDateString(isEnglish ? "en-GB" : "ar-SA-u-ca-gregory", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const describe = (...ids: Array<string | false | undefined>) => ids.filter(Boolean).join(" ") || undefined;

  return (
    <div className="mt-7 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
      <form
        noValidate
        onSubmit={submit}
        aria-labelledby="customer-profile-heading"
        className="min-w-0 rounded-2xl border border-[#e2ecf7] bg-[#fbfdff] p-4 sm:p-6"
      >
        <h2 id="customer-profile-heading" className="font-display text-xl font-black text-[#17334f]">{copy.heading}</h2>
        <p className="mt-1 text-sm leading-7 text-[#60778f]">{copy.hint}</p>

        <div className="mt-5 grid gap-5">
          <div>
            <Label htmlFor="customer-profile-name" className="text-sm font-extrabold text-[#17334f]">
              {copy.fullName}
              <span className="text-[#c83d4b]" aria-hidden="true">*</span>
            </Label>
            <div className="relative mt-2">
              <UserRound className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8aa0b5]" aria-hidden="true" />
              <Input
                ref={nameRef}
                id="customer-profile-name"
                name="fullName"
                autoComplete="name"
                required
                maxLength={160}
                value={values.fullName}
                disabled={busy}
                onChange={event => change("fullName", event.target.value)}
                onBlur={() => validateField("fullName")}
                aria-invalid={Boolean(errors.fullName)}
                aria-describedby={describe(errors.fullName && "customer-profile-name-error")}
                className="h-12 rounded-xl border-[#d8e6f5] bg-white ps-10 text-base shadow-none aria-[invalid=true]:border-[#e5848e] sm:text-sm"
              />
            </div>
            {errors.fullName ? (
              <p id="customer-profile-name-error" className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#b42d3b]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {errors.fullName}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="customer-profile-email" className="text-sm font-extrabold text-[#17334f]">
              {copy.email}
              <span className="ms-1 text-xs font-bold text-[#70859b]">({copy.optional})</span>
            </Label>
            <div className="relative mt-2">
              <Mail className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8aa0b5]" aria-hidden="true" />
              <Input
                ref={emailRef}
                id="customer-profile-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                dir="ltr"
                maxLength={320}
                value={values.email}
                disabled={busy}
                placeholder="name@example.com"
                onChange={event => change("email", event.target.value)}
                onBlur={() => validateField("email")}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={describe("customer-profile-email-hint", errors.email && "customer-profile-email-error")}
                className="h-12 rounded-xl border-[#d8e6f5] bg-white ps-10 text-start text-base shadow-none aria-[invalid=true]:border-[#e5848e] sm:text-sm"
              />
            </div>
            <p id="customer-profile-email-hint" className="mt-2 text-xs leading-6 text-[#70859b]">{copy.emailHint}</p>
            {errors.email ? (
              <p id="customer-profile-email-error" className="mt-1 flex items-center gap-1.5 text-xs font-bold text-[#b42d3b]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {errors.email}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="customer-profile-phone" className="text-sm font-extrabold text-[#17334f]">{copy.phone}</Label>
            <div className="relative mt-2">
              <Phone className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8aa0b5]" aria-hidden="true" />
              <Input
                id="customer-profile-phone"
                readOnly
                dir="ltr"
                value={profile.data?.phone ?? ""}
                aria-describedby="customer-profile-phone-hint"
                className="h-12 cursor-default rounded-xl border-[#e2ecf7] bg-[#f3f7fb] ps-10 pe-10 text-start text-base text-[#405d78] shadow-none sm:text-sm"
              />
              <Lock className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8aa0b5]" aria-hidden="true" />
            </div>
            <p id="customer-profile-phone-hint" className="mt-2 text-xs leading-6 text-[#70859b]">{copy.phoneHint}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#e7eff8] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p role="status" aria-live="polite" className="min-h-5 text-xs font-bold text-[#238457]">
            {status ? (
              <span className={`inline-flex items-center gap-1.5 ${status.kind === "saved" || status.kind === "noChanges" ? "text-[#238457]" : "text-[#b42d3b]"}`}>
                {status.kind === "saved" ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : null}
                {status.kind === "error" ? status.message : copy[status.kind]}
              </span>
            ) : null}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {dirty ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setValues(saved);
                  setErrors({});
                  setStatus(null);
                }}
                className="h-11 rounded-xl border-[#d8e6f5] bg-white font-extrabold text-[#405d78] transition-transform active:scale-[.97]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {copy.reset}
              </Button>
            ) : null}
            <Button
              type="submit"
              disabled={busy || !dirty}
              className="h-11 min-w-36 rounded-xl bg-[#0668d9] font-extrabold text-white shadow-[0_8px_20px_rgba(8,120,249,.18)] transition-transform hover:bg-[#0457ba] active:scale-[.97]"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              {busy ? copy.saving : copy.save}
            </Button>
          </div>
        </div>
      </form>

      <aside className="rounded-2xl border border-[#e2ecf7] bg-white p-4 sm:p-5" aria-label={copy.account}>
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#eaf3ff] text-lg font-black text-[#0878f9]" aria-hidden="true">
            {(saved.fullName.trim()[0] ?? "?").toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-black text-[#17334f]">{saved.fullName}</p>
            <p className="mt-0.5 truncate text-xs text-[#70859b]" dir="ltr">{profile.data?.phone}</p>
          </div>
        </div>
        <dl className="mt-4 space-y-3 border-t border-[#eef4fa] pt-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-2 font-bold text-[#60778f]"><Mail className="h-4 w-4" aria-hidden="true" />{copy.email}</dt>
            <dd className="min-w-0 truncate font-bold text-[#17334f]" dir="ltr">{saved.email || "—"}</dd>
          </div>
          {memberSince ? (
            <div className="flex items-start justify-between gap-3">
              <dt className="flex items-center gap-2 font-bold text-[#60778f]"><CalendarDays className="h-4 w-4" aria-hidden="true" />{copy.memberSince}</dt>
              <dd className="font-bold text-[#17334f]">{memberSince}</dd>
            </div>
          ) : null}
        </dl>
      </aside>
    </div>
  );
}
