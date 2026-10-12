import { PublicHeader } from "@/components/PublicHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowRight, CheckCircle2, FileCheck2, Smartphone } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { CURRENT_TERMS_VERSION } from "@shared/legal";
import { normalizeSaudiPhone } from "@shared/phone";

const demoOtp = "123456";

type CustomerRecord = { id: number; fullName: string; phone: string | null; email: string | null };

export default function CustomerSignup() {
  const { isEnglish } = useLanguage();
  const [step, setStep] = useState<"phone" | "verify" | "details" | "registered">("phone");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [code, setCode] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [existingCustomer, setExistingCustomer] = useState<CustomerRecord | null>(null);
  const [error, setError] = useState("");
  const verifyPhone = trpc.requests.verifyPhoneDemo.useMutation();
  const findCustomer = trpc.customers.findByPhoneAccessToken.useMutation();
  const registerCustomer = trpc.customers.registerWithPhone.useMutation();

  const copy = isEnglish ? {
    phoneTitle: "Sign in with your mobile number.",
    phone: "Mobile number", phonePlaceholder: "05X XXX XXXX", send: "Continue", verifyTitle: "Verify your mobile number.", verifyIntro: "A demo WhatsApp verification message is shown below while the real Business API is not connected.", termsText: "I agree to the Terms and Conditions and the Refund and Cancellation Policy.", termsError: "You must agree to the Terms and Conditions before creating an account.", termsLink: "Terms and Conditions", refundLink: "Refund and Cancellation Policy",
    codeLabel: "Your demo verification code is", inputLabel: "Enter the six-digit code", verify: "Verify and continue", detailsTitle: "Complete your customer profile.", detailsIntro: "This step appears only for a new customer. Existing customers continue with their saved details.", name: "Full name", namePlaceholder: "Enter your full name", email: "Email address", emailPlaceholder: "you@example.com", create: "Create customer account", existing: "Welcome back", existingIntro: "Your saved customer profile was found. Returning you to the home page…", resend: "Resend demo code", back: "Change mobile number", error: "The code is incorrect. Enter all six digits shown in the demo message.", phoneError: "Enter a valid Saudi mobile number.", saved: "Your customer profile is ready.", demo: "Demo only — no real WhatsApp message was sent.", home: "Back to home",
  } : {
    phoneTitle: "سجّل الدخول برقم جوالك.",
    phone: "رقم الجوال", phonePlaceholder: "05X XXX XXXX", send: "المتابعة", verifyTitle: "تحقق من رقم جوالك.", verifyIntro: "تظهر رسالة واتساب تجريبية أدناه إلى حين ربط WhatsApp Business الحقيقي.", termsText: "أوافق على الشروط والأحكام وسياسة الاسترداد والإلغاء.", termsError: "يجب الموافقة على الشروط والأحكام قبل إنشاء الحساب.", termsLink: "الشروط والأحكام", refundLink: "سياسة الاسترداد والإلغاء",
    codeLabel: "رمز التحقق التجريبي هو", inputLabel: "أدخل الرمز المكون من ست خانات", verify: "تحقق وتابع", detailsTitle: "أكمل بيانات حسابك.", detailsIntro: "تظهر هذه الخطوة للعميل الجديد فقط. العميل المسجل ينتقل مباشرة إلى بياناته المحفوظة.", name: "الاسم الكامل", namePlaceholder: "اكتب اسمك الكامل", email: "البريد الإلكتروني", emailPlaceholder: "اكتب بريدك الإلكتروني", create: "إنشاء حساب العميل", existing: "مرحبًا بعودتك", existingIntro: "تم العثور على ملف العميل المحفوظ. جارٍ إعادتك إلى الصفحة الرئيسية…", resend: "إعادة إرسال الرمز التجريبي", back: "تغيير رقم الجوال", error: "الرمز غير صحيح. أدخل الخانات الست الظاهرة في الرسالة التجريبية.", phoneError: "أدخل رقم جوال سعودي صحيحًا.", saved: "تم تجهيز ملف العميل.", demo: "للاختبار فقط — لم تُرسل أي رسالة واتساب حقيقية.", home: "العودة للرئيسية",
  };

  const startVerification = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedPhone = normalizeSaudiPhone(phone);
    if (!normalizedPhone) { setError(copy.phoneError); return; }
    setPhone(normalizedPhone); setError(""); setCode(""); setStep("verify");
    toast.info(isEnglish ? "Your demo WhatsApp verification code is ready." : "تم تجهيز رمز تحقق واتساب التجريبي.");
  };

  const verifyAndContinue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code !== demoOtp) { setError(copy.error); return; }
    setError("");
    try {
      const verified = await verifyPhone.mutateAsync({ phone, code });
      setAccessToken(verified.accessToken);
      const existing = await findCustomer.mutateAsync({ accessToken: verified.accessToken });
      if (existing) {
        setExistingCustomer(existing);
        localStorage.setItem("maalamati_customer_name", existing.fullName);
        localStorage.setItem("maalamati_customer_phone", existing.phone || phone);
        localStorage.setItem("maalamati_customer_access_token", verified.accessToken);
        setStep("registered");
        window.setTimeout(() => window.location.assign("/"), 1500);
      } else {
        setStep("details");
      }
    } catch (mutationError) {
      setError(mutationError instanceof Error && mutationError.message ? mutationError.message : copy.error);
    }
  };

  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) { setError(copy.error); return; }
    if (!termsAccepted) { setError(copy.termsError); return; }
    setError("");
    try {
      const customer = await registerCustomer.mutateAsync({ fullName: fullName.trim(), phone, email: email.trim(), accessToken, termsAccepted: true, termsVersion: CURRENT_TERMS_VERSION });
      localStorage.setItem("maalamati_customer_name", customer.fullName);
      localStorage.setItem("maalamati_customer_phone", customer.phone || phone);
      localStorage.setItem("maalamati_customer_access_token", accessToken);
      setStep("registered");
      window.setTimeout(() => window.location.assign("/"), 1500);
    } catch (mutationError) {
      setError(mutationError instanceof Error && mutationError.message ? mutationError.message : (isEnglish ? "We could not create the account right now." : "تعذر إنشاء الحساب الآن."));
    }
  };

  const reset = () => { setStep("phone"); setCode(""); setError(""); setAccessToken(""); setExistingCustomer(null); setTermsAccepted(false); };
  const isBusy = verifyPhone.isPending || findCustomer.isPending || registerCustomer.isPending;

  return <div className="public-flat min-h-screen overflow-x-hidden bg-[#f5f9ff] text-[#102a43]" dir={isEnglish ? "ltr" : "rtl"}>
    <PublicHeader onChooseService={() => window.location.assign("/#request")} />
    <main className="container grid min-h-[calc(100vh-150px)] items-center gap-10 py-10 lg:grid-cols-[.8fr_1.2fr] lg:py-16">
      <section className="hidden lg:block"><div className="rounded-[2rem] bg-[linear-gradient(145deg,#eaf6ff,#ffffff)] p-9 shadow-[0_24px_60px_rgba(28,104,182,.12)]"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#0878f9] text-white shadow-[0_10px_24px_rgba(8,120,249,.22)]"><FileCheck2 className="h-7 w-7" /></span><h2 className="font-display mt-8 text-4xl font-extrabold leading-[1.25] tracking-[-0.07em]">{isEnglish ? "One phone. One clear customer record." : "جوال واحد، وسجل عميل واضح."}</h2><p className="mt-5 max-w-md text-base leading-8 text-[#60778f]">{isEnglish ? "Verify your mobile first, then keep every request connected to your own customer profile." : "تحقق من جوالك أولًا، ثم أبقِ كل طلباتك مرتبطة بملف العميل الخاص بك."}</p><div className="mt-8 space-y-3 text-sm font-bold text-[#405d78]"><div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[#0878f9]" />{isEnglish ? "Mobile number is the primary identifier" : "رقم الجوال هو المعرّف الأساسي"}</div><div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[#0878f9]" />{isEnglish ? "Existing customers keep their saved details" : "العميل السابق يعود إلى بياناته المحفوظة"}</div></div></div></section>
      <section className="mx-auto w-full max-w-xl rounded-[2rem] border border-[#dce8f6] bg-white p-6 shadow-[0_20px_50px_rgba(27,79,129,.10)] sm:p-9">
        {step === "registered" ? <div className="otp-success-pop py-12 text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#effff5] text-[#17824b]"><CheckCircle2 className="h-9 w-9" /></span><h1 className="font-display mt-6 text-3xl font-extrabold tracking-[-0.06em]">{existingCustomer ? copy.existing : copy.saved}</h1><p className="mt-4 text-base font-bold leading-8 text-[#17824b]">{existingCustomer ? copy.existingIntro : copy.saved}</p></div> : <><div className="flex items-start justify-between gap-4"><div><h1 className="font-display text-3xl font-extrabold leading-[1.25] tracking-[-0.07em] sm:text-4xl">{step === "phone" ? copy.phoneTitle : step === "verify" ? copy.verifyTitle : copy.detailsTitle}</h1>{step !== "phone" ? <p className="mt-3 text-sm leading-7 text-[#60778f]">{step === "verify" ? copy.verifyIntro : copy.detailsIntro}</p> : null}</div><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0878f9]"><Smartphone className="h-6 w-6" /></span></div>
          {step === "phone" && <form onSubmit={startVerification} className="mt-8 space-y-4"><label className="block text-sm font-bold text-[#17334f]">{copy.phone}<Input required type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={copy.phonePlaceholder} dir="ltr" className="mt-2 h-12 rounded-xl border-[#c8daec] bg-[#fbfdff] text-left" /></label>{error && <p role="alert" className="rounded-xl bg-[#fff1f3] px-3 py-2 text-xs font-bold text-[#a9323f]">{error}</p>}<Button type="submit" className="h-12 w-full rounded-xl bg-[#0878f9] text-sm font-extrabold text-white shadow-[0_6px_0_#0457ba] hover:bg-[#0668d9]">{copy.send}{isEnglish ? <ArrowRight className="ml-2 h-4 w-4" /> : <ArrowLeft className="mr-2 h-4 w-4" />}</Button></form>}
          {step === "verify" && <form onSubmit={verifyAndContinue} className="mt-8"><div className="rounded-2xl bg-[#effff5] p-4"><p className="text-xs font-bold text-[#405d78]">{copy.codeLabel}</p><p className="mt-2 text-3xl font-black tracking-[.38em] text-[#102a43]" dir="ltr">{demoOtp}</p></div><div className="mt-6"><InputOTP maxLength={6} value={code} onChange={(value) => { setCode(value.replace(/\D/g, "").slice(0, 6)); setError(""); }} aria-label={copy.inputLabel} containerClassName={`justify-center ${error ? "otp-shake" : ""}`} className="gap-2" dir="ltr"><InputOTPGroup>{[0, 1, 2, 3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} className="h-12 w-11 rounded-xl border-[#b7dbff] bg-white text-lg font-black text-[#102a43] first:border-l last:border-r data-[active=true]:border-[#0878f9] data-[active=true]:ring-[#0878f9]/20" />)}</InputOTPGroup></InputOTP></div>{error && <p role="alert" className="mt-4 rounded-xl bg-[#fff1f3] px-3 py-3 text-center text-xs font-bold leading-6 text-[#a9323f]">{error}</p>}<Button type="submit" disabled={isBusy || code.length !== 6} className="mt-5 h-12 w-full rounded-xl bg-[#0878f9] text-sm font-extrabold text-white shadow-[0_6px_0_#0457ba] hover:bg-[#0668d9]">{isBusy ? (isEnglish ? "Checking…" : "جارٍ التحقق…") : copy.verify}<CheckCircle2 className="ml-2 h-4 w-4" /></Button><div className="mt-3 flex flex-wrap justify-between gap-2"><Button type="button" variant="outline" onClick={reset} className="h-10 rounded-xl border-[#dce8f6] bg-white px-3 text-xs font-bold text-[#31516e]">{copy.back}</Button><Button type="button" variant="outline" onClick={() => setCode("")} className="h-10 rounded-xl border-[#dce8f6] bg-white px-3 text-xs font-bold text-[#0878f9]">{copy.resend}</Button></div><p className="mt-5 text-center text-xs font-bold leading-5 text-[#a35a00]">{copy.demo}</p></form>}
          {step === "details" && <form onSubmit={createAccount} className="mt-8 space-y-4"><label className="block text-sm font-bold text-[#17334f]">{copy.name}<Input required minLength={2} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder={copy.namePlaceholder} className="mt-2 h-12 rounded-xl border-[#c8daec] bg-[#fbfdff]" /></label><label className="block text-sm font-bold text-[#17334f]">{copy.email}<Input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={copy.emailPlaceholder} dir="ltr" className="mt-2 h-12 rounded-xl border-[#c8daec] bg-[#fbfdff] text-left" /></label><div className="rounded-2xl border border-[#dce8f6] bg-[#f8fbff] p-4"><label className="flex cursor-pointer items-start gap-3 text-sm font-bold leading-7 text-[#31516e]"><Checkbox checked={termsAccepted} onCheckedChange={(checked) => { setTermsAccepted(checked === true); setError(""); }} className="mt-1 border-[#9fbbd4] data-[state=checked]:border-[#0878f9] data-[state=checked]:bg-[#0878f9]" /><span>{copy.termsText}</span></label><p className="mt-2 ps-7 text-xs leading-6 text-[#60778f]"><a href="/terms-and-conditions" target="_blank" rel="noreferrer" className="font-black text-[#0878f9] hover:underline">{copy.termsLink}</a><span className="mx-2">•</span><a href="/refund-and-cancellation" target="_blank" rel="noreferrer" className="font-black text-[#0878f9] hover:underline">{copy.refundLink}</a></p></div>{error && <p role="alert" className="rounded-xl bg-[#fff1f3] px-3 py-2 text-xs font-bold text-[#a9323f]">{error}</p>}<Button type="submit" disabled={isBusy || !termsAccepted} className="h-12 w-full rounded-xl bg-[#0878f9] text-sm font-extrabold text-white shadow-[0_6px_0_#0457ba] hover:bg-[#0668d9]">{isBusy ? (isEnglish ? "Creating account…" : "جارٍ إنشاء الحساب…") : copy.create}<CheckCircle2 className="ml-2 h-4 w-4" /></Button><Button type="button" variant="outline" onClick={reset} className="h-10 w-full rounded-xl border-[#dce8f6] bg-white text-xs font-bold text-[#31516e]">{copy.back}</Button></form>}
          <p className="mt-8 border-t border-[#eef4fb] pt-5 text-center text-sm font-bold text-[#70859b]"><a href="/" className="text-[#0878f9] hover:underline">{copy.home}</a></p></>}</section>
    </main>
  </div>;
}

export { normalizeSaudiPhone };
export const DEMO_CUSTOMER_OTP = demoOtp;
export type { CustomerRecord };
