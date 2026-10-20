import { CustomerAuthForm } from "@/components/CustomerAuthForm";
import { PublicHeader } from "@/components/PublicHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { CheckCircle2, FileCheck2 } from "lucide-react";

/**
 * Legacy /customer-signup route. The reusable form also powers modal entry points,
 * while this wrapper intentionally preserves the original public page and side panel.
 */
export default function CustomerSignup() {
  const { isEnglish } = useLanguage();

  return (
    <div className="public-flat min-h-screen overflow-x-hidden bg-[#f5f9ff] text-[#102a43]" dir={isEnglish ? "ltr" : "rtl"}>
      <PublicHeader onChooseService={() => window.location.assign("/#request")} />
      <main className="container grid min-h-[calc(100vh-150px)] items-center gap-10 py-10 lg:grid-cols-[.8fr_1.2fr] lg:py-16">
        <section className="hidden lg:block">
          <div className="rounded-[2rem] bg-[linear-gradient(145deg,#eaf6ff,#ffffff)] p-9 shadow-[0_24px_60px_rgba(28,104,182,.12)]">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#0878f9] text-white shadow-[0_10px_24px_rgba(8,120,249,.22)]">
              <FileCheck2 className="h-7 w-7" />
            </span>
            <h2 className="font-display mt-8 text-4xl font-extrabold leading-[1.25] tracking-[-0.07em]">
              {isEnglish ? "One phone. One clear customer record." : "جوال واحد، وسجل عميل واضح."}
            </h2>
            <p className="mt-5 max-w-md text-base leading-8 text-[#60778f]">
              {isEnglish
                ? "Verify your mobile first, then keep every request connected to your own customer profile."
                : "تحقق من جوالك أولًا، ثم أبقِ كل طلباتك مرتبطة بملف العميل الخاص بك."}
            </p>
            <div className="mt-8 space-y-3 text-sm font-bold text-[#405d78]">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-[#0878f9]" />
                {isEnglish ? "Mobile number is the primary identifier" : "رقم الجوال هو المعرّف الأساسي"}
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-[#0878f9]" />
                {isEnglish ? "Existing customers keep their saved details" : "العميل السابق يعود إلى بياناته المحفوظة"}
              </div>
            </div>
          </div>
        </section>
        <CustomerAuthForm mode="signup" variant="page" />
      </main>
    </div>
  );
}

// Preserve the former named exports for code importing the legacy page module.
export { DEMO_CUSTOMER_OTP, normalizeSaudiPhone } from "@/components/CustomerAuthForm";
export type { CustomerRecord } from "@/components/CustomerAuthForm";
