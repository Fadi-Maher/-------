import { useLanguage } from "@/contexts/LanguageContext";
import { openAuthModal } from "@/lib/authFlow";
import { useSignedInWorkspace, workspaceLabel } from "@/lib/signedInWorkspace";
import { BadgeCheck, LayoutDashboard, UserRound } from "lucide-react";
import { useLocation } from "wouter";

const baseClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] focus-visible:ring-offset-2";

export function UnifiedAccessButton({ compact = false }: { compact?: boolean }) {
  const { isEnglish } = useLanguage();
  const [, navigate] = useLocation();
  const { workspace } = useSignedInWorkspace();
  const sizeClass = compact ? "w-full px-3" : "shrink-0 px-3.5";

  if (workspace) {
    // Already signed in: open that account directly. Another sign-in needs a sign-out first.
    const label = workspaceLabel(workspace, isEnglish);
    return (
      <a
        href={workspace.href}
        data-auth-trigger="workspace"
        onClick={event => {
          if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
          event.preventDefault();
          navigate(workspace.href);
        }}
        className={`${baseClass} ${sizeClass} border border-[#b7dbff] bg-[#eaf4ff] text-[#075aa8] hover:bg-[#dcecff]`}
      >
        <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
        <span>{label}</span>
      </a>
    );
  }

  const trigger = isEnglish ? "Sign in" : "الدخول";
  return (
    <button type="button" data-auth-trigger="signin" onClick={event => openAuthModal({ intent: "signin", trigger: event.currentTarget })} className={`${baseClass} ${sizeClass} bg-[#0668d9] text-white shadow-[0_4px_12px_rgba(8,120,249,.15)] hover:bg-[#0457ba]`} aria-label={trigger}>
      <UserRound className="h-4 w-4" aria-hidden="true" />
      <span>{trigger}</span>
    </button>
  );
}

/**
 * Visible agent entry. The global AuthModal link handler turns /agent-login
 * into the agent sign-in modal; without it the link opens the agent page.
 * Hidden while signed in: switching accounts requires signing out first.
 */
export function AgentAccessLink({ compact = false }: { compact?: boolean }) {
  const { isEnglish } = useLanguage();
  const { workspace } = useSignedInWorkspace();
  if (workspace) return null;
  const label = isEnglish ? "Agent sign-in" : "دخول المعقبين";
  const sizeClass = compact ? "w-full px-2" : "shrink-0 px-3.5";
  return (
    <a
      href="/agent-login"
      data-auth-trigger="agent"
      className={`${baseClass} ${sizeClass} border border-[#cfe3fa] bg-white text-[#075aa8] hover:border-[#0878f9] hover:bg-[#f1f7ff]`}
    >
      <BadgeCheck className={compact ? "hidden h-4 w-4 shrink-0 min-[360px]:block" : "h-4 w-4 shrink-0"} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </a>
  );
}
