import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { CheckCircle2, UserRound } from "lucide-react";
import React, { type FormEvent, useEffect, useId, useState } from "react";

export type PhoneProfileValues = {
  fullName: string;
  email: string;
};

export type CompletePhoneProfileProps = {
  role: "customer" | "agent";
  phone: string;
  initialProfile?: PhoneProfileValues | null;
  /** Only a first customer record needs legal acceptance. */
  isNewCustomer: boolean;
  busy?: boolean;
  onSave: (
    values: PhoneProfileValues & { acceptedTerms: boolean }
  ) => void | Promise<void>;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The single post-OTP details step. It deliberately receives no ticket and has no
 * mobile/OTP controls, so the signed verification stays owned by its parent flow.
 */
export function CompletePhoneProfile({
  role,
  phone,
  initialProfile,
  isNewCustomer,
  busy = false,
  onSave,
}: CompletePhoneProfileProps) {
  const { isEnglish } = useLanguage();
  const fieldId = useId();
  const [fullName, setFullName] = useState(initialProfile?.fullName ?? "");
  const [email, setEmail] = useState(initialProfile?.email ?? "");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setFullName(initialProfile?.fullName ?? "");
    setEmail(initialProfile?.email ?? "");
    setAcceptedTerms(false);
    setError("");
  }, [initialProfile?.email, initialProfile?.fullName, role]);

  const copy = isEnglish
    ? {
        verified: "Verified mobile",
        intro:
          role === "customer"
            ? "Confirm or update the details for your customer account."
            : "Confirm your contact details before continuing as an agent.",
        fullName: "Full name",
        fullNamePlaceholder: "Enter your full name",
        email: "Email address",
        emailPlaceholder: "you@example.com",
        legal:
          "I agree to the Terms and Conditions and the Refund and Cancellation Policy.",
        terms: "Terms and Conditions",
        refund: "Refund and Cancellation Policy",
        detailsError: "Enter your full name and a valid email address.",
        termsError:
          "You must agree to the Terms and Conditions before creating an account.",
        save:
          role === "customer"
            ? "Continue to my account"
            : "Save and continue",
        saving: "Saving your details…",
      }
    : {
        verified: "رقم الجوال المتحقق منه",
        intro:
          role === "customer"
            ? "أكد أو حدّث بيانات حساب العميل قبل المتابعة."
            : "أكد بيانات التواصل قبل المتابعة كمعقب.",
        fullName: "الاسم الكامل",
        fullNamePlaceholder: "اكتب اسمك الكامل",
        email: "البريد الإلكتروني",
        emailPlaceholder: "اكتب بريدك الإلكتروني",
        legal: "أوافق على الشروط والأحكام وسياسة الاسترداد والإلغاء.",
        terms: "الشروط والأحكام",
        refund: "سياسة الاسترداد والإلغاء",
        detailsError: "أدخل اسمك الكامل وبريدك الإلكتروني الصحيح.",
        termsError: "يجب الموافقة على الشروط والأحكام قبل إنشاء الحساب.",
        save:
          role === "customer" ? "المتابعة إلى حسابي" : "حفظ ومتابعة",
        saving: "جارٍ حفظ البيانات…",
      };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (
      normalizedName.length < 2 ||
      normalizedName.length > 160 ||
      normalizedEmail.length > 320 ||
      !emailPattern.test(normalizedEmail)
    ) {
      setError(copy.detailsError);
      return;
    }
    if (role === "customer" && isNewCustomer && !acceptedTerms) {
      setError(copy.termsError);
      return;
    }

    setError("");
    void onSave({
      fullName: normalizedName,
      email: normalizedEmail,
      acceptedTerms: role === "customer" && isNewCustomer && acceptedTerms,
    });
  };

  return (
    <form className="min-w-0 space-y-4" noValidate onSubmit={submit}>
      <div className="flex items-start gap-3 rounded-2xl border border-[#b7dbff] bg-[#f3f9ff] p-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#0668d9]"
          aria-hidden="true"
        >
          <UserRound className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-[#31516e]">
            {copy.verified}
          </p>
          <p className="mt-0.5 font-bold text-[#102a43]" dir="ltr">
            {phone}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#60778f]">{copy.intro}</p>
        </div>
      </div>

      <div>
        <label
          htmlFor={`${fieldId}-name`}
          className="block text-sm font-bold text-[#17334f]"
        >
          {copy.fullName}
        </label>
        <Input
          id={`${fieldId}-name`}
          required
          minLength={2}
          maxLength={160}
          disabled={busy}
          autoComplete="name"
          value={fullName}
          onChange={event => {
            setFullName(event.target.value);
            setError("");
          }}
          placeholder={copy.fullNamePlaceholder}
          aria-invalid={Boolean(error)}
          className="mt-2 h-12 rounded-xl border-[#c8daec] bg-[#fbfdff]"
        />
      </div>

      <div>
        <label
          htmlFor={`${fieldId}-email`}
          className="block text-sm font-bold text-[#17334f]"
        >
          {copy.email}
        </label>
        <Input
          id={`${fieldId}-email`}
          required
          type="email"
          maxLength={320}
          disabled={busy}
          autoComplete="email"
          dir="ltr"
          value={email}
          onChange={event => {
            setEmail(event.target.value);
            setError("");
          }}
          placeholder={copy.emailPlaceholder}
          aria-invalid={Boolean(error)}
          className="mt-2 h-12 rounded-xl border-[#c8daec] bg-[#fbfdff] text-left"
        />
      </div>

      {role === "customer" && isNewCustomer ? (
        <div className="rounded-2xl border border-[#dce8f6] bg-[#f8fbff] p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm font-bold leading-7 text-[#31516e]">
            <Checkbox
              checked={acceptedTerms}
              disabled={busy}
              onCheckedChange={checked => {
                setAcceptedTerms(checked === true);
                setError("");
              }}
              className="mt-1 border-[#9fbbd4] data-[state=checked]:border-[#0878f9] data-[state=checked]:bg-[#0878f9]"
            />
            <span>{copy.legal}</span>
          </label>
          <p className="mt-2 ps-7 text-xs leading-6 text-[#60778f]">
            <a
              href="/terms-and-conditions"
              target="_blank"
              rel="noreferrer"
              className="font-black text-[#0878f9] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9]"
            >
              {copy.terms}
            </a>
            <span className="mx-2">•</span>
            <a
              href="/refund-and-cancellation"
              target="_blank"
              rel="noreferrer"
              className="font-black text-[#0878f9] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9]"
            >
              {copy.refund}
            </a>
          </p>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-[#fff1f3] px-3 py-2 text-xs font-bold leading-6 text-[#a9323f]"
        >
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={busy}
        className="h-12 w-full rounded-xl bg-[#0668d9] font-extrabold text-white hover:bg-[#0457ba]"
      >
        <CheckCircle2 className="me-2 h-4 w-4" aria-hidden="true" />
        {busy ? copy.saving : copy.save}
      </Button>
    </form>
  );
}
