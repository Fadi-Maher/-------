import type { MouseEvent } from "react";
import { useId } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  ArrowUpLeft,
  ArrowUpRight,
  FileCheck2,
  Headset,
  House,
  LockKeyhole,
  Send,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

type Props = {
  /** `dialog` is compact for the sign-in modal; `card` is a standalone page card. */
  variant?: "dialog" | "card";
  context?: "signin" | "track";
  /** Closes a containing dialog before an in-page navigation such as /#request. */
  onNavigate?: () => void;
};

const copy = {
  ar: {
    status: "متوقف مؤقتًا",
    title: { signin: "الدخول بالجوال قيد التجهيز", track: "تتبع الطلبات بالجوال قيد التجهيز" },
    lead: "أوقفنا رموز التحقق التجريبية في الموقع المباشر لحماية حسابك وبيانات طلباتك. سيعود الدخول والتتبع بالجوال فور ربط خدمة تحقق فعلية.",
    points: [
      { title: "بياناتك محمية", text: "لا يُفتح أي حساب أو طلب برمز تجريبي بعد الآن." },
      { title: "طلباتك محفوظة", text: "طلباتك وبياناتك السابقة باقية كما هي دون أي تغيير." },
      { title: "الطلبات الجديدة متاحة", text: "أرسل طلبك الآن من الصفحة الرئيسية، وسنتواصل معك على جوالك." },
    ],
    newRequest: "إرسال طلب جديد",
    support: "تواصل مع الدعم",
    home: "العودة للرئيسية",
    safety: "تنبيه أمان: لا تشارك أي رمز تحقق مع أي شخص.",
  },
  en: {
    status: "Temporarily paused",
    title: { signin: "Mobile sign-in is being prepared", track: "Mobile request tracking is being prepared" },
    lead: "We paused demo verification codes on the live website to protect your account and request data. Mobile sign-in and tracking return as soon as a real verification service is connected.",
    points: [
      { title: "Your data is protected", text: "No account or request opens with a demo code anymore." },
      { title: "Your requests are kept", text: "Your previous requests and details remain exactly as they were." },
      { title: "New requests are open", text: "Send a request now from the home page and we will contact you on your mobile." },
    ],
    newRequest: "Send a new request",
    support: "Contact support",
    home: "Back to home",
    safety: "Security tip: never share a verification code with anyone.",
  },
} as const;

const pointStyles = [
  { icon: ShieldCheck, tone: "bg-[#eaf3ff] text-[#0878f9]" },
  { icon: FileCheck2, tone: "bg-[#f1efff] text-[#6250d8]" },
  { icon: Send, tone: "bg-[#f2ffe0] text-[#507900]" },
] as const;

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] focus-visible:ring-offset-2";

export function PhoneVerificationUnavailable({ variant = "dialog", context = "signin", onNavigate }: Props) {
  const { isEnglish } = useLanguage();
  const headingId = useId();
  const text = isEnglish ? copy.en : copy.ar;
  const isCard = variant === "card";
  const Heading = isCard ? "h1" : "h3";
  const ArrowIcon = isEnglish ? ArrowUpRight : ArrowUpLeft;

  const navigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!onNavigate) return;
    const target = new URL(href, window.location.href);
    if (target.pathname !== window.location.pathname || !target.hash) return;
    // Same-page anchor inside a modal: close first, then scroll once the scroll lock is released.
    event.preventDefault();
    onNavigate();
    window.setTimeout(() => {
      window.history.replaceState(null, "", target.hash);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(target.hash.slice(1))?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }, 260);
  };

  return (
    <section
      aria-labelledby={headingId}
      dir={isEnglish ? "ltr" : "rtl"}
      className={cn(
        "relative min-w-0 overflow-hidden text-start text-[#102a43]",
        isCard
          ? "mx-auto w-full max-w-3xl rounded-[1.75rem] border border-[#dce8f6] bg-white p-6 shadow-[0_24px_60px_rgba(28,104,182,.12)] sm:p-10"
          : "rounded-2xl border border-[#dce8f6] bg-[linear-gradient(180deg,#f5faff_0%,#ffffff_70%)] p-5"
      )}
    >
      <span aria-hidden="true" className="pointer-events-none absolute -top-24 end-[-5rem] h-56 w-56 rounded-full bg-[#0878f9]/[0.06]" />
      <div className={cn("relative flex gap-4", isCard ? "flex-col sm:flex-row sm:items-start sm:gap-6" : "items-start")}>
        <span aria-hidden="true" className={cn("relative grid shrink-0 place-items-center rounded-2xl bg-[linear-gradient(145deg,#2b8cff,#0668d9)] text-white shadow-[0_10px_24px_rgba(8,120,249,.24)]", isCard ? "h-16 w-16 sm:h-20 sm:w-20" : "h-14 w-14")}>
          <Smartphone className={isCard ? "h-8 w-8 sm:h-9 sm:w-9" : "h-7 w-7"} strokeWidth={1.8} />
          <span className="absolute -bottom-1.5 -end-1.5 grid h-7 w-7 place-items-center rounded-full border-[3px] border-white bg-[#fff4df] text-[#a15c07]">
            <LockKeyhole className="h-3.5 w-3.5" strokeWidth={2.4} />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#f3d7a6] bg-[#fff8eb] px-3 py-1 text-[11px] font-extrabold text-[#8a4b06]">
            <span aria-hidden="true" className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#f0a33a] opacity-70 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#e08a12]" />
            </span>
            {text.status}
          </span>
          <Heading id={headingId} className={cn("font-display mt-3 text-balance font-extrabold leading-[1.35] tracking-[-0.04em] text-[#102a43]", isCard ? "text-2xl sm:text-[2.15rem]" : "text-lg sm:text-xl")}>
            {text.title[context]}
          </Heading>
          <p className={cn("mt-3 text-[#536e88]", isCard ? "max-w-2xl text-base leading-8" : "text-sm leading-7")}>{text.lead}</p>
        </div>
      </div>

      <ul className={cn("relative mt-6 grid gap-3", isCard && "sm:grid-cols-3")}>
        {text.points.map((point, index) => {
          const { icon: Icon, tone } = pointStyles[index];
          return (
            <li key={point.title} className={cn("flex gap-3 rounded-2xl border border-[#e3eef9] bg-[#fbfdff] p-3.5", isCard && "sm:flex-col sm:p-4")}>
              <span aria-hidden="true" className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", tone)}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-extrabold text-[#17334f]">{point.title}</span>
                <span className="mt-1 block text-xs leading-6 text-[#60778f]">{point.text}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className={cn("relative mt-6 flex flex-col gap-3", isCard ? "sm:flex-row sm:flex-wrap sm:items-center" : "sm:flex-row")}>
        <a
          href="/#request"
          onClick={(event) => navigate(event, "/#request")}
          className={cn("inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0878f9] px-5 text-sm font-extrabold text-white shadow-[0_6px_0_#0457ba] transition-[transform,background-color,box-shadow] duration-150 hover:bg-[#0668d9] active:translate-y-[3px] active:shadow-[0_3px_0_#0457ba] motion-reduce:transition-none", focusRing)}
        >
          <Send aria-hidden="true" className="h-4 w-4" />
          {text.newRequest}
          <ArrowIcon aria-hidden="true" className="h-4 w-4" />
        </a>
        <a
          href="/contact"
          className={cn("inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#c8daec] bg-white px-5 text-sm font-extrabold text-[#075aa8] transition-colors duration-150 hover:border-[#9fc4ea] hover:bg-[#f1f7ff] motion-reduce:transition-none", focusRing)}
        >
          <Headset aria-hidden="true" className="h-4 w-4" />
          {text.support}
        </a>
        {isCard ? (
          <a href="/" className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-[#536e88] hover:text-[#075aa8] sm:ms-auto", focusRing)}>
            <House aria-hidden="true" className="h-4 w-4" />
            {text.home}
          </a>
        ) : null}
      </div>

      <p className="relative mt-5 flex items-center gap-2 border-t border-[#e7eff8] pt-4 text-xs font-bold leading-6 text-[#60778f]">
        <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#0878f9]" />
        {text.safety}
      </p>
    </section>
  );
}
