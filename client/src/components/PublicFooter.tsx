import { useLanguage } from "@/contexts/LanguageContext";
import { FileCheck2, HeartHandshake } from "lucide-react";

const footerGroups = {
  ar: [
    {
      title: "الخدمات",
      links: [
        { label: "تعقّب المعاملات", href: "/track" },
        { label: "طلب خدمة", href: "/#request" },
        { label: "خدمات الأعمال", href: "/#services" },
      ],
    },
    {
      title: "الدعم",
      links: [
        { label: "تواصل ودعم", href: "/contact" },
        { label: "طلباتي", href: "/customer-account" },
        { label: "تسجيل الدخول", href: "/login" },
      ],
    },
    {
      title: "معاملاتي كير",
      links: [
        { label: "من نحن", href: "/about" },
        { label: "الشروط والأحكام", href: "/terms-and-conditions" },
        { label: "الاسترداد والإلغاء", href: "/refund-and-cancellation" },
        { label: "الصفحة الرئيسية", href: "/" },
        { label: "بدء طلب جديد", href: "/#request" },
      ],
    },
  ],
  en: [
    {
      title: "Services",
      links: [
        { label: "Track requests", href: "/track" },
        { label: "Request a service", href: "/#request" },
        { label: "Business services", href: "/#services" },
      ],
    },
    {
      title: "Support",
      links: [
        { label: "Contact & support", href: "/contact" },
        { label: "My requests", href: "/customer-account" },
        { label: "Sign in", href: "/login" },
      ],
    },
    {
      title: "Maalamati Care",
      links: [
        { label: "About us", href: "/about" },
        { label: "Terms and Conditions", href: "/terms-and-conditions" },
        { label: "Refund and cancellation", href: "/refund-and-cancellation" },
        { label: "Home", href: "/" },
        { label: "Start a new request", href: "/#request" },
      ],
    },
  ],
};

export function PublicFooter() {
  const { isEnglish } = useLanguage();
  const groups = isEnglish ? footerGroups.en : footerGroups.ar;

  return (
    <footer className="border-t border-[#dce8f6] bg-white text-[#17334f]" dir={isEnglish ? "ltr" : "rtl"}>
      <div className="container py-12 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div className="max-w-xl">
            <a href="/" className="inline-flex items-center gap-3" aria-label={isEnglish ? "Maalamati Care home" : "معاملاتي كير، الصفحة الرئيسية"}>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0878f9] text-white shadow-[0_8px_18px_rgba(8,120,249,.20)]">
                <FileCheck2 className="h-5 w-5" />
              </span>
              <span>
                <span className="font-display block text-xl font-black tracking-[-.06em]">{isEnglish ? "Maalamati Care" : "معاملاتي كير"}</span>
                <span className="mt-0.5 block text-[11px] font-bold text-[#70859b]">{isEnglish ? "by Streak Express" : "من ستريك إكسبريس"}</span>
              </span>
            </a>
            <p className="mt-5 max-w-lg text-sm leading-7 text-[#60778f]">
              {isEnglish
                ? "A digital platform by Streak Express that brings service requests, price quotes, updates, and files into one clear follow-up journey."
                : "منصة رقمية من ستريك إكسبريس تجمع طلبات الخدمات وعروض الأسعار والتحديثات والمرفقات في رحلة متابعة واحدة وواضحة."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {groups.map(group => (
              <section key={group.title}>
                <h2 className="text-sm font-black text-[#17334f]">{group.title}</h2>
                <nav className="mt-4 grid gap-3">
                  {group.links.map(link => (
                    <a key={link.label} href={link.href} className="text-xs font-bold text-[#60778f] transition-colors hover:text-[#0878f9]">
                      {link.label}
                    </a>
                  ))}
                </nav>
              </section>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-[#e7eff8] pt-6 text-center text-xs leading-6 text-[#70859b] sm:flex-row sm:items-center sm:justify-between sm:text-start">
          <p>{isEnglish ? "© Maalamati Care 2026. All rights reserved by Streak Express." : "© معاملاتي كير 2026. جميع الحقوق محفوظة لشركة ستريك إكسبريس."}</p>
          <p>{isEnglish ? "Commercial Registration: 7051197981" : "السجل التجاري: 7051197981"}</p>
        </div>
        <div className="mt-6 flex justify-center sm:justify-start">
          <div className="saudi-built-badge inline-flex min-h-11 min-w-[240px] items-center justify-center gap-3 rounded-sm px-6 text-sm font-black text-white shadow-[0_7px_18px_rgba(18,119,75,.15)]">
            <HeartHandshake className="h-5 w-5" />
            <span>{isEnglish ? "Built with Saudi hands" : "بُني بأيدٍ سعودية"}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
