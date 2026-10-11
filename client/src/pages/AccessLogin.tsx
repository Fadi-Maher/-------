import { useLanguage } from "@/contexts/LanguageContext";
import { BadgeCheck, ChevronLeft, UserRound } from "lucide-react";

export default function AccessLogin() {
  const { isEnglish } = useLanguage();
  const options = isEnglish
    ? [
        { href: "/customer-signup", title: "Service requester", icon: UserRound, accent: false },
        { href: "/agent-login", title: "Transaction specialist", icon: BadgeCheck, accent: true },
      ]
    : [
        { href: "/customer-signup", title: "طالب خدمة", icon: UserRound, accent: false },
        { href: "/agent-login", title: "معقب", icon: BadgeCheck, accent: true },
      ];
  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#eaf4ff_0,#f8fbff_42%,#fff_100%)] p-4" dir={isEnglish ? "ltr" : "rtl"}><section className="w-full max-w-3xl rounded-[2.25rem] border border-[#dce8f6] bg-white p-7 shadow-[0_28px_80px_rgba(27,79,129,.13)] sm:p-10"><div className="mx-auto flex w-fit items-center gap-3 rounded-2xl bg-[#102a43] px-4 py-3 text-white"><BadgeCheck className="h-6 w-6 text-[#72bbff]" /><span className="font-display text-xl font-black">{isEnglish ? "Maalamati" : "معاملاتي"}</span></div><h1 className="font-display mt-7 text-center text-3xl font-black text-[#102a43]">{isEnglish ? "Choose your account type" : "اختر نوع حسابك"}</h1><p className="mx-auto mt-3 max-w-xl text-center text-sm leading-7 text-[#60778f]">{isEnglish ? "Customers and transaction specialists sign in with mobile numbers. Employee accounts remain private and are created by the owner." : "العملاء والمعقبون يدخلون برقم الجوال. حسابات الموظفين خاصة وينشئها المالك فقط."}</p><div className="mt-8 grid gap-4 sm:grid-cols-2">{options.map((option) => { const Icon = option.icon; return <a key={option.href} href={option.href} className={`group rounded-3xl border p-6 transition-all hover:-translate-y-1 hover:shadow-[0_18px_35px_rgba(27,79,129,.12)] ${option.accent ? "border-[#8bc4fa] bg-[#edf7ff]" : "border-[#dce8f6] bg-white"}`}><span className={`grid h-14 w-14 place-items-center rounded-2xl ${option.accent ? "bg-[#0878f9] text-white" : "bg-[#eaf3ff] text-[#0878f9]"}`}><Icon className="h-7 w-7" /></span><h2 className="font-display mt-5 text-2xl font-black text-[#102a43] sm:text-3xl">{option.title}</h2><span className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#0878f9]">{isEnglish ? "Continue" : "متابعة"}<ChevronLeft className={`h-4 w-4 transition-transform group-hover:-translate-x-1 ${isEnglish ? "rotate-180" : ""}`} /></span></a>; })}</div><a href="/" className="mt-7 block text-center text-sm font-extrabold text-[#60778f] hover:text-[#0878f9]">{isEnglish ? "Back to website" : "العودة إلى الموقع"}</a></section></main>;
}
