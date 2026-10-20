import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { MessageCircle } from "lucide-react";
import type { Lang } from "@shared/leadBot/catalog";
import { widgetText } from "@shared/leadBot/widgetStrings";
import { AssistantAvatar } from "@/components/AssistantAvatar";
import { useLanguage } from "@/contexts/LanguageContext";
import { isPublicAssistantPath } from "@/lib/publicAssistantPaths";
import { trpc } from "@/lib/trpc";
import { LeadBotPanel } from "./LeadBotPanel";
import { useLeadBotController, type LeadBotTransport } from "./useLeadBotController";

type TrpcClient = ReturnType<typeof trpc.useUtils>["client"];

/** The real transport: every call goes through the typed tRPC client. */
export function createTrpcLeadBotTransport(client: TrpcClient): LeadBotTransport {
  const visitor = client.leadBot.visitor;
  return {
    config: () => visitor.config.query(),
    start: (input) => visitor.start.mutate(input),
    restart: (input) => visitor.restart.mutate(input),
    send: (input) => visitor.send.mutate(input),
    poll: (input) => visitor.poll.query(input),
    track: (input) => visitor.track.mutate(input),
  };
}

export function LeadBotWidget({ transport, lang, pagePath }: { transport: LeadBotTransport; lang: Lang; pagePath: string | null }) {
  const controller = useLeadBotController({ transport, lang, pagePath });
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const { isOpen, unread } = controller;
  const openRef = useRef(controller.open);
  openRef.current = controller.open;

  // Same deep link as the previous assistant: /any-page#assistant opens the chat.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#assistant") openRef.current();
  }, [pagePath]);

  // Return focus to the launcher when the panel closes.
  useEffect(() => {
    if (wasOpen.current && !isOpen) launcherRef.current?.focus();
    wasOpen.current = isOpen;
  }, [isOpen]);

  // On phones the panel covers the screen: stop the page behind it from scrolling.
  useEffect(() => {
    if (!isOpen || typeof window === "undefined" || window.innerWidth >= 640) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const launcherLabel = unread > 0 ? `${widgetText(lang, "launcher")} — ${widgetText(lang, "unreadLabel", { n: unread })}` : widgetText(lang, "launcher");

  return (
    <>
      {isOpen ? <LeadBotPanel controller={controller} lang={lang} onClose={controller.close} onNavigate={controller.close} /> : null}
      {!isOpen ? (
        <button
          ref={launcherRef}
          type="button"
          onClick={controller.open}
          aria-label={launcherLabel}
          aria-haspopup="dialog"
          dir={lang === "ar" ? "rtl" : "ltr"}
          className="lb-press fixed bottom-4 left-4 z-[70] flex h-14 items-center gap-2 rounded-full bg-[linear-gradient(115deg,#0878f9,#6b35ff)] p-1.5 pe-4 text-white shadow-[0_16px_40px_rgba(8,120,249,.35)] transition-shadow hover:shadow-[0_18px_46px_rgba(8,120,249,.45)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0878f9]/35 sm:bottom-5 sm:left-5"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/40 bg-white">
            <AssistantAvatar />
          </span>
          <span className="hidden text-sm font-black sm:inline">{widgetText(lang, "launcher")}</span>
          <MessageCircle className="h-5 w-5 sm:hidden" aria-hidden="true" />
          {unread > 0 ? (
            <span className="absolute -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-[#d8ff4f] px-1.5 text-xs font-black text-[#17334f] shadow ltr:-right-1 rtl:-left-1" aria-hidden="true">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      ) : null}
    </>
  );
}

/** Mounted once in App: the sales assistant on public pages only. */
export function SiteLeadBot() {
  const [location] = useLocation();
  const { language } = useLanguage();
  const utils = trpc.useUtils();
  const transport = useMemo(() => createTrpcLeadBotTransport(utils.client), [utils.client]);
  if (!isPublicAssistantPath(location)) return null;
  return <LeadBotWidget transport={transport} lang={language} pagePath={location} />;
}
