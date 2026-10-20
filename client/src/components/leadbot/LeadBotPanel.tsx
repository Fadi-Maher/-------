import React, { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Headset,
  Loader2,
  MessageCircle,
  Pencil,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import type { Lang } from "@shared/leadBot/catalog";
import type { BotAction, BotActionType } from "@shared/leadBot/engine";
import { widgetText } from "@shared/leadBot/widgetStrings";
import { AssistantAvatar } from "@/components/AssistantAvatar";
import type { LeadBotController, UiMessage } from "./useLeadBotController";

export const LEAD_BOT_MAX_CHARS = 800;

/** Only internal paths and WhatsApp links produced by the engine are rendered as actions. */
export function isSafeLeadBotHref(href: string | undefined): href is string {
  if (!href) return false;
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  return /^https:\/\/wa\.me\/\d{8,15}(\?[^\s]*)?$/.test(href);
}

function whatsappHref(number: string | null) {
  const digits = (number ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

function formatTime(lang: Lang, value: number) {
  try {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" }).format(new Date(value));
  } catch {
    return "";
  }
}

function prefersCoarsePointer() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

function Banner({ tone, icon, children, action }: { tone: "error" | "warning" | "info"; icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  const styles = tone === "error" ? "border-[#ffd1d5] bg-[#fff4f5] text-[#8f2633]" : tone === "warning" ? "border-[#f7e2a8] bg-[#fff9e8] text-[#6d4a00]" : "border-[#cfe3fb] bg-[#f1f7ff] text-[#17334f]";
  return (
    <div className={`flex items-start gap-2 border-b px-4 py-2 text-xs font-bold leading-5 ${styles}`} role="status" aria-live="polite">
      <span className="mt-0.5 shrink-0" aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

function ActionIcon({ type }: { type: BotActionType }) {
  if (type === "whatsapp") return <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />;
  if (type === "open_contact") return <Headset className="h-3.5 w-3.5" aria-hidden="true" />;
  return <FileText className="h-3.5 w-3.5" aria-hidden="true" />;
}

function ActionLinks({ actions, onAction }: { actions: BotAction[]; onAction: (action: BotAction) => void }) {
  const safe = actions.filter((action) => isSafeLeadBotHref(action.href));
  if (!safe.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {safe.map((action) => (
        <a
          key={`${action.type}-${action.label}`}
          href={action.href}
          target={action.type === "whatsapp" ? "_blank" : undefined}
          rel={action.type === "whatsapp" ? "noopener noreferrer" : undefined}
          onClick={() => onAction(action)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#0878f9]/25 bg-white px-3 py-2 text-xs font-extrabold text-[#0878f9] shadow-sm transition-colors hover:border-[#0878f9] hover:bg-[#f1f7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9]/40"
        >
          <ActionIcon type={action.type} />
          {action.label}
        </a>
      ))}
    </div>
  );
}

function QuickReplies({ message, disabled, onPick }: { message: UiMessage; disabled: boolean; onPick: (value: string, label: string) => void }) {
  const options = message.reply?.quickReplies ?? [];
  if (!options.length) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-0.5" role="group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onPick(option.value, option.label)}
          className="lb-press min-h-9 rounded-full border border-[#0878f9]/30 bg-white px-3.5 py-1.5 text-[0.82rem] font-bold text-[#0878f9] shadow-sm transition-colors hover:border-[#0878f9] hover:bg-[#f1f7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9]/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function BotBubble({ message, lang, interactive, disabled, controller, onAction }: { message: UiMessage; lang: Lang; interactive: boolean; disabled: boolean; controller: LeadBotController; onAction: (action: BotAction) => void }) {
  const tone = message.reply?.tone;
  const isAgent = message.role === "agent";
  const bubble =
    tone === "warning"
      ? "border-[#f7e2a8] bg-[#fff9e8] text-[#4d3500]"
      : tone === "success"
        ? "border-[#bfe8d1] bg-[#effbf4] text-[#124b2f]"
        : tone === "handoff"
          ? "border-[#0878f9]/30 bg-[#eef6ff] text-[#17334f]"
          : tone === "info"
            ? "border-[#e2eaf3] bg-[#f4f7fb] text-[#4a6178] text-[0.82rem]"
            : "border-[#e2eaf3] bg-white text-[#17334f]";
  return (
    <div className="lb-msg-in flex items-end gap-2">
      <span className={`grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border ${isAgent ? "border-[#cfe95a] bg-[#f2ffd0] text-[#3d5200]" : "border-[#d8e8f8] bg-white"}`} aria-hidden="true">
        {isAgent ? <Headset className="h-4 w-4" /> : <AssistantAvatar />}
      </span>
      <div className="min-w-0 max-w-[86%] space-y-2">
        {isAgent ? (
          <div className="text-[0.7rem] font-bold text-[#60778f]">
            {message.authorName ?? widgetText(lang, "agent")} · {widgetText(lang, "agent")}
          </div>
        ) : null}
        <div className={`whitespace-pre-wrap break-words rounded-2xl rounded-ee-md border px-4 py-2.5 text-[0.92rem] leading-relaxed shadow-sm ${bubble}`}>
          {tone === "success" ? <CheckCircle2 className="mb-0.5 me-1 inline h-4 w-4 text-[#168653]" aria-hidden="true" /> : null}
          {tone === "warning" ? <AlertTriangle className="mb-0.5 me-1 inline h-4 w-4 text-[#b77b00]" aria-hidden="true" /> : null}
          {tone === "handoff" ? <Headset className="mb-0.5 me-1 inline h-4 w-4 text-[#0878f9]" aria-hidden="true" /> : null}
          {message.text}
        </div>
        {message.reply?.summary?.length ? (
          <div className="overflow-hidden rounded-2xl border border-[#e2eaf3] bg-white shadow-sm">
            <div className="border-b border-[#e2eaf3] bg-[#f1f7ff] px-4 py-2 text-xs font-black text-[#17334f]">{widgetText(lang, "summaryTitle")}</div>
            <dl className="divide-y divide-[#eef3f8]">
              {message.reply.summary.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <dt className="shrink-0 text-[#60778f]">{item.label}</dt>
                  <dd className="flex min-w-0 items-center gap-2 font-bold text-[#17334f]">
                    <span className="min-w-0 break-words text-start">{item.value}</span>
                    {interactive ? (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => void controller.send({ quickReply: `edit:${item.key}`, label: widgetText(lang, "editField", { field: item.label }) })}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#0878f9] hover:bg-[#f1f7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9]/40 disabled:opacity-40"
                        aria-label={widgetText(lang, "editField", { field: item.label })}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
        {message.reply?.actions?.length ? <ActionLinks actions={message.reply.actions} onAction={onAction} /> : null}
        {interactive ? <QuickReplies message={message} disabled={disabled} onPick={(value, label) => void controller.send({ quickReply: value, label })} /> : null}
        <div className="px-1 text-[0.65rem] font-semibold text-[#8aa0b5]">{formatTime(lang, message.createdAt)}</div>
      </div>
    </div>
  );
}

function UserBubble({ message, lang, controller }: { message: UiMessage; lang: Lang; controller: LeadBotController }) {
  const failed = message.localStatus === "failed";
  return (
    <div className="lb-msg-in flex justify-end">
      <div className="max-w-[82%] space-y-1">
        <div className={`whitespace-pre-wrap break-words rounded-2xl rounded-es-md px-4 py-2.5 text-[0.92rem] leading-relaxed text-white shadow-sm ${failed ? "bg-[#b33b47]" : "bg-[#0878f9]"}`}>{message.text}</div>
        <div className="flex flex-wrap items-center justify-end gap-2 px-1 text-[0.68rem] font-bold text-[#8aa0b5]">
          {message.localStatus === "sending" ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              {widgetText(lang, "sending")}
            </span>
          ) : null}
          {failed ? (
            <>
              <span className="text-[#b33b47]">{widgetText(lang, "failed")}</span>
              <button type="button" onClick={() => void controller.retry(message.id)} className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[#0878f9] hover:bg-[#f1f7ff]">
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                {widgetText(lang, "retry")}
              </button>
              <button type="button" onClick={() => controller.discard(message.id)} className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[#60778f] hover:bg-[#f4f7fb]">
                <Trash2 className="h-3 w-3" aria-hidden="true" />
                {widgetText(lang, "remove")}
              </button>
            </>
          ) : null}
          {!message.localStatus ? <span>{formatTime(lang, message.createdAt)}</span> : null}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, body, children }: { icon: ReactNode; title: string; body: ReactNode; children?: ReactNode }) {
  return (
    <div className="lb-msg-in mx-auto mt-2 max-w-sm rounded-2xl border border-[#d8e8f8] bg-white p-5 text-center shadow-sm">
      <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-[#f1f7ff] text-[#0878f9]" aria-hidden="true">{icon}</span>
      <h3 className="text-base font-black text-[#17334f]">{title}</h3>
      <div className="mt-1.5 text-sm leading-6 text-[#60778f]">{body}</div>
      {children ? <div className="mt-4 grid gap-2">{children}</div> : null}
    </div>
  );
}

const primaryButton = "lb-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0878f9] px-4 py-2.5 text-sm font-black text-white shadow-sm transition-colors hover:bg-[#0668d9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9]/40 disabled:opacity-60";
const secondaryButton = "lb-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#bfd7ef] bg-white px-4 py-2.5 text-sm font-black text-[#31516e] transition-colors hover:bg-[#f4f8fd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9]/40";

export function LeadBotPanel({ controller, lang, onClose, onNavigate }: { controller: LeadBotController; lang: Lang; onClose: () => void; onNavigate: () => void }) {
  const titleId = useId();
  const composerId = useId();
  const [text, setText] = useState("");
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [showResumed, setShowResumed] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const { status, messages, error, online, handoff, escalated, locked, awaitingReply, step, lastBotIndex, inputHint } = controller;
  const t = (key: Parameters<typeof widgetText>[1], vars?: Record<string, string | number>) => widgetText(lang, key, vars);
  const ready = status === "ready";
  const queueBlocked = controller.failedCount > 0;
  const inputDisabled = !ready || awaitingReply || locked || queueBlocked;
  const supportWhatsapp = whatsappHref(controller.whatsappNumber);

  useEffect(() => {
    if (!controller.resumed) return;
    setShowResumed(true);
    const timer = window.setTimeout(() => setShowResumed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [controller.resumed]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [messages.length, awaitingReply, status]);

  useEffect(() => {
    if (ready && !locked && !prefersCoarsePointer()) composerRef.current?.focus();
  }, [ready, locked]);

  // A tapped quick reply disappears with the next bot turn; keep focus inside the panel instead of dropping to <body>.
  useEffect(() => {
    if (awaitingReply) return;
    const active = typeof document === "undefined" ? null : document.activeElement;
    if (active && active !== document.body) return;
    if (!prefersCoarsePointer() && composerRef.current && !composerRef.current.disabled) composerRef.current.focus();
    else panelRef.current?.focus({ preventScroll: true });
  }, [awaitingReply]);

  // Escape also closes the panel when focus was lost to <body> (never when another dialog owns focus).
  useEffect(() => {
    const onDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const active = document.activeElement;
      if (active && active !== document.body) return;
      if (confirmRestart) setConfirmRestart(false);
      else onClose();
    };
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => document.removeEventListener("keydown", onDocumentKeyDown);
  }, [confirmRestart, onClose]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = "auto";
    composer.style.height = `${Math.min(composer.scrollHeight, 132)}px`;
  }, [text]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    if (confirmRestart) setConfirmRestart(false);
    else onClose();
  };

  const submit = async () => {
    const value = text.trim();
    if (!value || inputDisabled) return;
    setText("");
    const accepted = await controller.send({ text: value });
    if (!accepted) setText(value);
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  const onAction = (action: BotAction) => {
    controller.trackAction(action.type);
    if (action.type !== "whatsapp") onNavigate();
  };

  const statusLine = status === "disabled" ? t("unavailableStatus") : !online ? t("offline") : handoff?.agentName && handoff.status === "active" ? t("withAgent", { name: handoff.agentName }) : escalated ? t("waitingAgent") : t("online");
  const placeholder = escalated ? t("placeholderAgent") : inputHint === "tel" ? t("placeholderTel") : inputHint === "name" ? t("placeholderName") : t("placeholder");
  const progress = useMemo(() => (step && step.total > 0 ? Math.round(((step.step - 1) / step.total) * 100) : null), [step]);

  const banner = (() => {
    if (!online) return <Banner tone="warning" icon={<WifiOff className="h-4 w-4" />}>{t("offlineBanner")}</Banner>;
    if (error?.kind === "rate_limited") return <Banner tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>{t("rateBanner")}</Banner>;
    if (error?.kind === "not_found" && error.scope === "send") return <Banner tone="info" icon={<RefreshCw className="h-4 w-4" />}>{t("expiredBanner")}</Banner>;
    if (error?.kind === "forbidden") return <Banner tone="error" icon={<AlertTriangle className="h-4 w-4" />}>{t("forbiddenBanner")}</Banner>;
    if (error?.scope === "poll") return <Banner tone="info" icon={<Loader2 className="h-4 w-4 animate-spin" />}>{t("pollBanner")}</Banner>;
    if (error?.scope === "send") return <Banner tone="error" icon={<AlertTriangle className="h-4 w-4" />}>{t("sendErrorBanner")}</Banner>;
    if (queueBlocked && !awaitingReply) return <Banner tone="warning" icon={<RotateCcw className="h-4 w-4" />}>{t("queueBlocked")}</Banner>;
    if (showResumed && ready) return <Banner tone="info" icon={<CheckCircle2 className="h-4 w-4" />}>{t("resumed")}</Banner>;
    return null;
  })();

  const contactLinks = (
    <>
      {supportWhatsapp ? (
        <a href={supportWhatsapp} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
          <MessageCircle className="h-4 w-4 text-[#17a65a]" aria-hidden="true" />
          {t("whatsappUs")}
        </a>
      ) : null}
      <a href="/contact" onClick={onNavigate} className={secondaryButton}>
        <Headset className="h-4 w-4" aria-hidden="true" />
        {t("contactPage")}
      </a>
    </>
  );

  let body: ReactNode;
  if (status === "loading" || status === "idle") {
    body = (
      <div className="space-y-4 px-4 py-6" aria-busy="true">
        <span className="sr-only">{t("loading")}</span>
        {[72, 56, 64].map((width, index) => (
          <div key={index} className={`flex ${index === 1 ? "justify-end" : "items-end gap-2"}`} aria-hidden="true">
            {index !== 1 ? <span className="lb-skeleton h-8 w-8 rounded-full" /> : null}
            <span className="lb-skeleton block h-12 rounded-2xl" style={{ width: `${width}%` }} />
          </div>
        ))}
        <p className="text-center text-xs font-bold text-[#60778f]">{t("loading")}</p>
      </div>
    );
  } else if (status === "error") {
    body = (
      <InfoCard icon={<AlertTriangle className="h-5 w-5" />} title={t("startErrorTitle")} body={t("startErrorBody")}>
        <button type="button" onClick={() => void controller.start()} className={primaryButton}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t("retry")}
        </button>
      </InfoCard>
    );
  } else if (status === "consent") {
    body = (
      <InfoCard
        icon={<ShieldCheck className="h-5 w-5" />}
        title={t("consentTitle")}
        body={
          <>
            <p>{t("consentBody")}</p>
            <a href="/terms-and-conditions" onClick={onNavigate} className="mt-2 inline-flex items-center gap-1 text-xs font-black text-[#0878f9] underline-offset-4 hover:underline">
              {t("consentTerms")}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </>
        }
      >
        <button type="button" onClick={() => void controller.acceptConsent()} className={primaryButton}>
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {t("consentAccept")}
        </button>
        <button type="button" onClick={controller.declineConsent} className={secondaryButton}>
          {t("consentDecline")}
        </button>
      </InfoCard>
    );
  } else if (status === "declined") {
    body = (
      <InfoCard icon={<ShieldCheck className="h-5 w-5" />} title={t("declinedTitle")} body={t("declinedBody")}>
        <a href="/#request" onClick={onNavigate} className={primaryButton}>
          <FileText className="h-4 w-4" aria-hidden="true" />
          {t("requestForm")}
        </a>
        {contactLinks}
        <button type="button" onClick={() => void controller.acceptConsent()} className="min-h-10 text-xs font-black text-[#0878f9] underline-offset-4 hover:underline">
          {t("changedMind")}
        </button>
      </InfoCard>
    );
  } else if (status === "disabled") {
    body = (
      <InfoCard icon={<Headset className="h-5 w-5" />} title={t("disabledTitle")} body={t("disabledBody")}>
        {contactLinks}
      </InfoCard>
    );
  } else {
    body = (
      <div className="space-y-4 px-4 py-5">
        {messages.length === 0 ? (
          <InfoCard icon={<MessageCircle className="h-5 w-5" />} title={t("emptyTitle")} body={t("emptyBody")}>
            <button type="button" onClick={() => void controller.send({ quickReply: "intent:greeting", label: t("startChat") })} className={primaryButton}>
              {t("startChat")}
            </button>
          </InfoCard>
        ) : null}
        {messages.map((message, index) => {
          if (message.role === "user") return <UserBubble key={message.id} message={message} lang={lang} controller={controller} />;
          const interactive = index === lastBotIndex && !locked;
          if (message.role === "system") {
            return (
              <div key={message.id} className="lb-msg-in space-y-2 text-center">
                <p className="mx-auto inline-block max-w-[90%] rounded-full bg-[#eef3f8] px-3 py-1.5 text-xs font-bold leading-5 text-[#4a6178]">{message.text}</p>
                {interactive ? (
                  <div className="flex justify-center">
                    <QuickReplies message={message} disabled={inputDisabled} onPick={(value, label) => void controller.send({ quickReply: value, label })} />
                  </div>
                ) : null}
              </div>
            );
          }
          return <BotBubble key={message.id} message={message} lang={lang} interactive={interactive} disabled={inputDisabled} controller={controller} onAction={onAction} />;
        })}
        {awaitingReply ? (
          <div className="flex items-end gap-2" role="status">
            <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-[#d8e8f8] bg-white" aria-hidden="true">
              <AssistantAvatar />
            </span>
            <span className="inline-flex items-center gap-1 rounded-2xl rounded-ee-md border border-[#e2eaf3] bg-white px-4 py-3 shadow-sm" aria-hidden="true">
              <span className="lb-dot h-2 w-2 rounded-full bg-[#8aa0b5]" />
              <span className="lb-dot h-2 w-2 rounded-full bg-[#8aa0b5] [animation-delay:150ms]" />
              <span className="lb-dot h-2 w-2 rounded-full bg-[#8aa0b5] [animation-delay:300ms]" />
            </span>
            <span className="sr-only">{t("typing")}</span>
          </div>
        ) : null}
        {locked ? (
          <InfoCard icon={<CheckCircle2 className="h-5 w-5" />} title={t("closedTitle")} body={t("closedBody")}>
            <button type="button" onClick={() => void controller.restart()} className={primaryButton}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {t("restart")}
            </button>
          </InfoCard>
        ) : null}
      </div>
    );
  }

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      dir={lang === "ar" ? "rtl" : "ltr"}
      onKeyDown={handleKeyDown}
      className="lb-panel-in fixed outline-none inset-0 z-[70] flex h-[100dvh] w-full flex-col overflow-hidden bg-white text-[#17334f] shadow-[0_24px_70px_rgba(23,51,79,.28)] sm:inset-auto sm:bottom-5 sm:left-5 sm:h-[min(680px,calc(100dvh-2.5rem))] sm:w-[400px] sm:rounded-[1.6rem] sm:border sm:border-[#dce8f5]"
    >
      <header className="relative shrink-0 bg-[linear-gradient(115deg,#0878f9,#6b35ff)] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-center gap-3">
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-white/35 bg-white text-[#0878f9]">
            <span className="grid h-full w-full place-items-center overflow-hidden rounded-full">{escalated ? <Headset className="h-5 w-5" aria-hidden="true" /> : <AssistantAvatar />}</span>
            <span className={`absolute -bottom-0.5 h-3 w-3 rounded-full border-2 border-white ${online && status !== "disabled" ? "bg-[#d8ff4f]" : "bg-[#b8c4d0]"} ${lang === "ar" ? "-left-0.5" : "-right-0.5"}`} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-[0.98rem] font-black leading-6">{t("title")}</h2>
            <p className="truncate text-xs font-bold text-white/85" aria-live="polite">{statusLine}</p>
          </div>
          {ready ? (
            <button type="button" onClick={() => setConfirmRestart(true)} aria-label={t("restart")} title={t("restart")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/12 transition-colors hover:bg-white/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          <button type="button" onClick={onClose} aria-label={t("close")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/12 transition-colors hover:bg-white/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {ready && step && progress !== null && !locked ? (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[0.7rem] font-bold text-white/85">
              <span>{t("step", { n: step.step, total: step.total })}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuemin={0} aria-valuemax={step.total} aria-valuenow={step.step - 1} aria-label={t("step", { n: step.step, total: step.total })}>
              <div className="h-full rounded-full bg-[#d8ff4f] transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}
        {confirmRestart ? (
          <div role="alertdialog" aria-modal="false" aria-label={t("restart")} className="lb-msg-in absolute inset-x-3 top-full z-10 mt-2 rounded-2xl border border-[#dce8f5] bg-white p-4 text-[#17334f] shadow-xl">
            <p className="text-sm font-bold leading-6">{t("restartConfirm")}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setConfirmRestart(false);
                  void controller.restart();
                }}
                className={primaryButton}
              >
                {t("yes")}
              </button>
              <button type="button" onClick={() => setConfirmRestart(false)} className={secondaryButton}>
                {t("cancel")}
              </button>
            </div>
          </div>
        ) : null}
      </header>
      <p className="flex shrink-0 items-center gap-2 border-b border-[#e7eff8] bg-[#f8fbff] px-4 py-2 text-[11px] font-bold leading-5 text-[#60778f]">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[#0878f9]" aria-hidden="true" />
        {t("privacy")}
      </p>
      {banner}
      <div ref={listRef} role="log" aria-live="polite" aria-relevant="additions" aria-busy={status === "loading"} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[linear-gradient(180deg,#f7fbff,#f2f7fe)]">
        {body}
      </div>
      {ready && !locked ? (
        <form
          className="shrink-0 border-t border-[#e7eff8] bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="flex items-end gap-2">
            <label htmlFor={composerId} className="sr-only">{placeholder}</label>
            <textarea
              id={composerId}
              ref={composerRef}
              rows={1}
              value={text}
              maxLength={LEAD_BOT_MAX_CHARS}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder={placeholder}
              inputMode={inputHint === "tel" ? "tel" : "text"}
              autoComplete={inputHint === "tel" ? "tel" : inputHint === "name" ? "name" : "off"}
              dir="auto"
              className="max-h-[132px] min-h-11 flex-1 resize-none rounded-2xl border border-[#d8e4f0] bg-[#f8fbff] px-4 py-2.5 text-[0.95rem] leading-6 text-[#17334f] outline-none transition-colors placeholder:text-[#8aa0b5] focus:border-[#0878f9] focus:bg-white focus:ring-2 focus:ring-[#0878f9]/20"
            />
            <button type="submit" disabled={inputDisabled || !text.trim()} aria-label={t("send")} className="lb-press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#0878f9] text-white shadow-sm transition-colors hover:bg-[#0668d9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9]/40 disabled:opacity-45">
              {awaitingReply ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Send className={`h-5 w-5 ${lang === "ar" ? "-scale-x-100" : ""}`} aria-hidden="true" />}
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[0.68rem] font-semibold text-[#8aa0b5]">
            <span>{t("askHuman")}</span>
            {text.length > LEAD_BOT_MAX_CHARS * 0.75 ? (
              <span aria-live="polite">
                {text.length}/{LEAD_BOT_MAX_CHARS} {t("chars")}
              </span>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
