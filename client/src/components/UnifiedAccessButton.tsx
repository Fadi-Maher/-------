import { useLanguage } from "@/contexts/LanguageContext";
import { openAuthModal } from "@/lib/authFlow";
import { UserRound } from "lucide-react";

export function UnifiedAccessButton({ compact = false }: { compact?: boolean }) {
  const { isEnglish } = useLanguage();
  const trigger = isEnglish ? "Sign in" : "الدخول";
  return (
    <button type="button" data-auth-trigger="signin" onClick={event => openAuthModal({ intent: "signin", trigger: event.currentTarget })} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0668d9] text-sm font-extrabold text-white shadow-[0_4px_12px_rgba(8,120,249,.15)] transition-colors hover:bg-[#0457ba] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] focus-visible:ring-offset-2 ${compact ? "w-full px-3" : "shrink-0 px-3.5"}`} aria-label={trigger}>
      <UserRound className="h-4 w-4" aria-hidden="true" />
      <span>{trigger}</span>
    </button>
  );
}
