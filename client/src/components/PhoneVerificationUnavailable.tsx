import { useLanguage } from "@/contexts/LanguageContext";
import { ShieldCheck } from "lucide-react";

export function PhoneVerificationUnavailable() {
  const { isEnglish } = useLanguage();
  return (
    <section role="status" className="rounded-2xl border border-[#cde3fa] bg-[#f4f9ff] p-6 text-start" dir={isEnglish ? "ltr" : "rtl"}>
      <ShieldCheck aria-hidden="true" className="mb-3 h-7 w-7 text-[#075aa8]" />
      <h2 className="font-display text-xl font-black text-[#102a43]">
        {isEnglish ? "Mobile sign-in is being prepared" : "جارٍ تجهيز الدخول بالجوال"}
      </h2>
      <p className="mt-3 text-sm leading-7 text-[#315675]">
        {isEnglish
          ? "For your privacy, demo codes are disabled on the live website. Mobile sign-in and tracking will become available after a real verification service is connected."
          : "لحماية خصوصيتك، أُوقفت رموز التحقق التجريبية في الموقع المباشر. سيُتاح الدخول والتتبع بالجوال بعد ربط خدمة تحقق فعلية."}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a href="/contact" className="inline-flex min-h-11 items-center rounded-xl bg-[#0668d9] px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] focus-visible:ring-offset-2">
          {isEnglish ? "Contact support" : "تواصل مع الدعم"}
        </a>
        <a href="/" className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold text-[#075aa8] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9]">
          {isEnglish ? "Back to home" : "العودة للرئيسية"}
        </a>
      </div>
    </section>
  );
}
