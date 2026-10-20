import { useAuth } from "@/_core/hooks/useAuth";
import { BrandMark } from "@/components/BrandMark";
import { LanguageToggle } from "@/components/LanguageToggle";
import { UnifiedAccessButton } from "@/components/UnifiedAccessButton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { CUSTOMER_SESSION_EVENT, readCustomerSession } from "@/lib/customerSession";
import { useSignedInWorkspace, workspaceLabel } from "@/lib/signedInWorkspace";
import { BriefcaseBusiness, Building2, Headphones, Home, LogOut, Menu, Route, UserRound } from "lucide-react";

const productNav = [
  { ar: "تعقّب المعاملات", en: "Track requests", icon: Route, action: "تعقّب المعاملات" },
  { ar: "طلب خدمة", en: "Request a service", icon: Building2, action: "طلب خدمة" },
  { ar: "خدمات الأعمال", en: "Business services", icon: BriefcaseBusiness, action: "طلب خدمة" },
  { ar: "تواصل ودعم", en: "Support", icon: Headphones, href: "/contact" },
];

const compactAccountClass = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#cde3fa] bg-[#f5faff] text-[#075aa8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] focus-visible:ring-offset-2";
const accountClass = "inline-flex min-h-11 max-w-44 items-center gap-2 rounded-xl border border-[#cde3fa] bg-[#f5faff] px-3 py-2 text-sm font-bold text-[#31516e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] focus-visible:ring-offset-2";

function CustomerAccountMenu({ name, compact, isEnglish }: { name: string; compact: boolean; isEnglish: boolean }) {
  const copy = isEnglish ? { greeting: "Hello", account: "My requests", profile: "My profile", logout: "Sign out" } : { greeting: "مرحبًا", account: "طلباتي", profile: "ملفي الشخصي", logout: "تسجيل الخروج" };
  return (
    <DropdownMenu dir={isEnglish ? "ltr" : "rtl"}>
      <DropdownMenuTrigger asChild>
        <button type="button" className={compact ? compactAccountClass : accountClass} aria-label={`${copy.account} ${name}`}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#0878f9] text-white"><UserRound className="h-4 w-4" aria-hidden="true" /></span>
          <span className={compact ? "sr-only" : "truncate"}>{copy.greeting}, <strong>{name}</strong></span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={12} className="w-60 rounded-2xl border-[#dce8f6] bg-white p-2 shadow-[0_18px_40px_rgba(27,79,129,.16)]">
        <div className="rounded-xl bg-[#f5faff] p-3"><p className="truncate text-sm font-extrabold text-[#17334f]">{name}</p><p className="mt-1 text-xs text-[#70859b]">{copy.account}</p></div>
        <DropdownMenuItem asChild className="mt-2 cursor-pointer rounded-xl px-3 py-3 text-sm font-bold text-[#31516e] focus:bg-[#eef7ff] focus:text-[#0878f9]"><a href="/customer-account"><Route className="h-4 w-4 text-[#0878f9]" />{copy.account}</a></DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-3 text-sm font-bold text-[#31516e] focus:bg-[#eef7ff] focus:text-[#0878f9]"><a href="/customer-account?tab=profile"><UserRound className="h-4 w-4 text-[#0878f9]" />{copy.profile}</a></DropdownMenuItem>
        <DropdownMenuSeparator className="my-2 bg-[#e7eff8]" />
        <DropdownMenuItem onSelect={() => { localStorage.removeItem("maalamati_customer_name"); localStorage.removeItem("maalamati_customer_phone"); localStorage.removeItem("maalamati_customer_access_token"); window.location.reload(); }} variant="destructive" className="cursor-pointer rounded-xl px-3 py-3 text-sm font-bold"><LogOut className="h-4 w-4" />{copy.logout}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { user, loading, logout } = useAuth();
  const { isEnglish } = useLanguage();
  const [customerName, setCustomerName] = useState<string | null>(null);
  useEffect(() => {
    const refresh = () => setCustomerName(readCustomerSession(localStorage)?.name ?? null);
    refresh();
    window.addEventListener(CUSTOMER_SESSION_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CUSTOMER_SESSION_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const copy = isEnglish ? { greeting: "Hello", account: "My account", logout: "Sign out", accountLabel: "Maalamati Care account" } : { greeting: "مرحبًا", account: "حسابي", logout: "تسجيل الخروج", accountLabel: "حساب معاملاتي كير" };
  const accountHref = user?.role === "agent" ? "/agent-dashboard" : user?.role === "employee" ? "/employee-dashboard" : "/account";
  const accountLabel = user?.role === "agent" ? (isEnglish ? "Agent workspace" : "بوابة المعقب") : user?.role === "employee" ? (isEnglish ? "Employee workspace" : "بوابة الموظف") : copy.account;

  if (!loading && !user && customerName) return <CustomerAccountMenu name={customerName} compact={compact} isEnglish={isEnglish} />;
  // Account identity is optional; public sign-in and registration are rendered separately.
  if (loading || !user) return null;

  const firstName = user.name?.trim().split(/\s+/)[0] || (isEnglish ? "there" : "بك");
  return (
    <DropdownMenu dir={isEnglish ? "ltr" : "rtl"}>
      <DropdownMenuTrigger asChild>
        <button type="button" className={compact ? compactAccountClass : accountClass} aria-label={`${copy.account} ${firstName}`}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#0878f9] text-white"><UserRound className="h-4 w-4" aria-hidden="true" /></span>
          <span className={compact ? "sr-only" : "truncate"}>{copy.greeting}, <strong>{firstName}</strong></span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={12} className="w-72 rounded-2xl border-[#dce8f6] bg-white p-2 shadow-[0_18px_40px_rgba(27,79,129,.16)]">
        <div className="flex items-center gap-3 rounded-xl bg-[#f5faff] p-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0878f9] text-white"><UserRound className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate text-sm font-extrabold text-[#17334f]">{user.name || copy.account}</p><p className="mt-1 truncate text-xs text-[#70859b]">{user.email || copy.accountLabel}</p></div></div>
        <DropdownMenuItem asChild className="mt-2 cursor-pointer rounded-xl px-3 py-3 text-sm font-bold text-[#31516e] focus:bg-[#eef7ff] focus:text-[#0878f9]"><a href={accountHref}><UserRound className="h-4 w-4 text-[#0878f9]" />{accountLabel}</a></DropdownMenuItem>
        <DropdownMenuSeparator className="my-2 bg-[#e7eff8]" />
        <DropdownMenuItem onSelect={event => { event.preventDefault(); void logout(); }} variant="destructive" className="cursor-pointer rounded-xl px-3 py-3 text-sm font-bold"><LogOut className="h-4 w-4" />{copy.logout}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PublicAuthActions({ compact = false }: { compact?: boolean }) {
  return (
    <div data-testid={compact ? "public-auth-mobile" : "public-auth-desktop"} className={compact ? "grid w-full grid-cols-1" : "flex shrink-0 items-center"}>
      <UnifiedAccessButton compact={compact} />
    </div>
  );
}

function SideNavigation({ onChooseService }: { onChooseService: (service: string) => void }) {
  const { isEnglish } = useLanguage();
  const { workspace } = useSignedInWorkspace();
  const items = [
    { ar: "الرئيسية", en: "Home", icon: Home, href: "/" },
    // Signed in: open the current account; otherwise start sign-in.
    workspace
      ? { ar: workspaceLabel(workspace, false), en: workspaceLabel(workspace, true), icon: UserRound, href: workspace.href }
      : { ar: "الدخول", en: "Sign in", icon: UserRound, href: "/login" },
    { ar: "تعقّب المعاملات", en: "Track requests", icon: Route, action: "تعقّب المعاملات" },
    { ar: "طلب خدمة", en: "Request a service", icon: Building2, action: "طلب خدمة" },
    { ar: "خدمات الأعمال", en: "Business services", icon: BriefcaseBusiness, action: "طلب خدمة" },
    { ar: "تواصل ودعم", en: "Support", icon: Headphones, href: "/contact" },
  ];
  const copy = isEnglish ? { tagline: "Your requests and services, all in one place.", help: "Need help?", open: "Open menu" } : { tagline: "مسارات معاملاتك وخدماتك في مكان واحد.", help: "تحتاج إلى مساعدة؟", open: "فتح القائمة" };
  return <Sheet><SheetTrigger asChild><button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#dce8f6] bg-white text-[#31516e] transition-colors hover:border-[#0878f9] hover:text-[#0878f9]" aria-label={copy.open}><Menu className="h-5 w-5" /></button></SheetTrigger><SheetContent side={isEnglish ? "left" : "right"} className="w-[86vw] max-w-sm border-l-0 bg-white p-0" dir={isEnglish ? "ltr" : "rtl"}><SheetTitle className="sr-only">{isEnglish ? "Navigation menu" : "قائمة التنقل"}</SheetTitle><div className="border-b border-[#e7eff8] p-6"><a href="/" className="flex items-center gap-2.5"><BrandMark isEnglish={isEnglish} className="h-11 w-11 rounded-2xl" /><span className="font-display text-2xl font-extrabold tracking-[-0.075em]">{isEnglish ? "Maalamati Care" : "معاملاتي كير"}</span></a><p className="mt-5 text-sm leading-7 text-[#60778f]">{copy.tagline}</p></div><nav className="flex-1 space-y-1 p-4">{items.map(item => { const Icon = item.icon; const label = isEnglish ? item.en : item.ar; return item.href ? <a href={item.href} key={item.ar} className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-bold text-[#31516e] transition-colors hover:bg-[#eef7ff] hover:text-[#0878f9]"><span>{label}</span><Icon className="h-5 w-5 text-[#0878f9]" /></a> : <button type="button" key={item.ar} onClick={() => onChooseService(item.action!)} className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-start text-sm font-bold text-[#31516e] transition-colors hover:bg-[#eef7ff] hover:text-[#0878f9]"><span>{label}</span><Icon className="h-5 w-5 text-[#0878f9]" /></button>; })}</nav><div className="border-t border-[#e7eff8] p-4"><a href="/#request" className="flex items-center justify-between rounded-xl bg-[#0878f9] px-4 py-3 text-sm font-extrabold text-white"><span>{copy.help}</span><Headphones className="h-5 w-5" /></a></div></SheetContent></Sheet>;
}

export function PublicHeader({ onChooseService }: { onChooseService: (service: string) => void }) {
  const { isEnglish } = useLanguage();
  return (
    <header className="sticky top-0 z-40 border-b border-[#dce8f6] bg-white/95 backdrop-blur">
      <div className="container">
        <div className="flex min-h-[78px] items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <SideNavigation onChooseService={onChooseService} />
            <a href="#top" className="flex min-w-0 items-center gap-2" aria-label={isEnglish ? "Maalamati Care home" : "معاملاتي كير، الصفحة الرئيسية"}>
              <BrandMark isEnglish={isEnglish} className="h-9 w-9 shrink-0 rounded-xl shadow-[0_7px_16px_rgba(8,120,249,.2)] sm:h-10 sm:w-10" />
              <span className="font-display truncate text-base font-extrabold tracking-[-0.075em] text-[#102a43] sm:text-xl 2xl:text-2xl">{isEnglish ? "Maalamati Care" : "معاملاتي كير"}</span>
            </a>
          </div>
          <nav className="hidden items-center gap-1 2xl:flex">{productNav.map(product => { const Icon = product.icon; const label = isEnglish ? product.en : product.ar; return product.href ? <a href={product.href} key={product.ar} className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-[#45617b] transition-colors hover:bg-[#eef7ff] hover:text-[#0878f9]"><Icon className="h-4 w-4" />{label}</a> : <button type="button" key={product.ar} onClick={() => onChooseService(product.action!)} className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-[#45617b] transition-colors hover:bg-[#eef7ff] hover:text-[#0878f9]"><Icon className="h-4 w-4" />{label}</button>; })}</nav>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden xl:block"><PublicAuthActions /></div>
            <div className="hidden sm:block"><LanguageToggle /></div>
            <div className="sm:hidden"><LanguageToggle compact /></div>
            <div className="hidden 2xl:block"><AccountMenu /></div>
            <div className="2xl:hidden"><AccountMenu compact /></div>
          </div>
        </div>
        <div className="border-t border-[#edf3fb] pb-3 pt-2 xl:hidden"><PublicAuthActions compact /></div>
      </div>
    </header>
  );
}
