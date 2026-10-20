import { Button } from "@/components/ui/button";
import { BadgeCheck, HandCoins, Loader2, X, XCircle } from "lucide-react";
import React from "react";

export type AgentDecisionNoticeContent = {
  status: "approved" | "rejected";
  title: string;
  message: string;
  titleEn?: string | null;
  messageEn?: string | null;
};

type AgentDecisionNoticeProps = {
  notice: AgentDecisionNoticeContent;
  isEnglish: boolean;
  reference?: string | null;
  reviewNote?: string | null;
  decidedAt?: number | string | Date | null;
  /** Called by the dismiss button; omit to render a non-dismissible notice. */
  onDismiss?: () => void;
  dismissing?: boolean;
  /** Optional primary action, e.g. "browse new requests". */
  primaryAction?: { label: string; onClick: () => void };
  children?: React.ReactNode;
  className?: string;
};

/** Localized decision text: stored English is preferred, Arabic is the fallback. */
export function decisionText(notice: AgentDecisionNoticeContent, isEnglish: boolean) {
  return {
    title: isEnglish ? notice.titleEn || notice.title : notice.title,
    message: isEnglish ? notice.messageEn || notice.message : notice.message,
  };
}

/**
 * Join-request decision shown to the applicant on sign-in (approved in the agent
 * workspace, rejected in the agent path). Uses role="status" so assistive tech
 * announces it without stealing focus.
 */
export function AgentDecisionNotice({
  notice,
  isEnglish,
  reference,
  reviewNote,
  decidedAt,
  onDismiss,
  dismissing = false,
  primaryAction,
  children,
  className = "",
}: AgentDecisionNoticeProps) {
  const approved = notice.status === "approved";
  const text = decisionText(notice, isEnglish);
  const date = decidedAt ? new Date(decidedAt) : null;
  const tone = approved
    ? "border-[#bfe5c4] bg-[linear-gradient(135deg,#f2fbef_0%,#ffffff_70%)]"
    : "border-[#f3c8cd] bg-[linear-gradient(135deg,#fff5f6_0%,#ffffff_70%)]";
  return (
    <section
      role="status"
      aria-live="polite"
      data-decision={notice.status}
      dir={isEnglish ? "ltr" : "rtl"}
      className={`decision-notice relative overflow-hidden rounded-3xl border p-5 shadow-[0_14px_40px_rgba(25,93,164,.08)] sm:p-6 ${tone} ${className}`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <span
          aria-hidden="true"
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${approved ? "bg-[#e3f6e2] text-[#287333]" : "bg-[#ffe9ec] text-[#b13b47]"}`}
        >
          {approved ? <BadgeCheck className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-black ${approved ? "text-[#287333]" : "text-[#b13b47]"}`}>
            {isEnglish ? "Membership application decision" : "قرار طلب الانضمام"}
          </p>
          <h2 className="mt-1 font-display text-xl font-black leading-8 text-[#102a43]">{text.title}</h2>
          <p className="mt-2 text-sm leading-7 text-[#31516e]">{text.message}</p>
          {reference || date ? (
            <dl className="mt-3 flex flex-wrap gap-2 text-xs">
              {reference ? (
                <div className="rounded-full bg-white/85 px-3 py-1 font-bold text-[#31516e] ring-1 ring-[#dce8f6]">
                  <dt className="inline text-[#60778f]">{isEnglish ? "Reference" : "رقم الطلب"}: </dt>
                  <dd className="inline" dir="ltr">{reference}</dd>
                </div>
              ) : null}
              {date && !Number.isNaN(date.getTime()) ? (
                <div className="rounded-full bg-white/85 px-3 py-1 font-bold text-[#31516e] ring-1 ring-[#dce8f6]">
                  <dt className="inline text-[#60778f]">{isEnglish ? "Decided" : "تاريخ القرار"}: </dt>
                  <dd className="inline">
                    {new Intl.DateTimeFormat(isEnglish ? "en" : "ar-SA", { dateStyle: "medium" }).format(date)}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {reviewNote ? (
            <div className={`mt-3 rounded-2xl border bg-white/90 p-3 ${approved ? "border-[#d6eed5]" : "border-[#f0d7da]"}`}>
              <p className={`text-xs font-black ${approved ? "text-[#287333]" : "text-[#7d2632]"}`}>
                {approved ? (isEnglish ? "Administration note" : "ملاحظة الإدارة") : isEnglish ? "Reason for the decision" : "سبب القرار"}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[#3c4e60]">{reviewNote}</p>
            </div>
          ) : null}
          {children}
          {primaryAction || onDismiss ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {primaryAction ? (
                <Button
                  type="button"
                  onClick={primaryAction.onClick}
                  className="h-10 rounded-xl bg-[#0668d9] font-extrabold text-white hover:bg-[#055bbd] active:scale-[0.97] motion-safe:transition-transform"
                >
                  <HandCoins className="me-2 h-4 w-4" aria-hidden="true" />
                  {primaryAction.label}
                </Button>
              ) : null}
              {onDismiss ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onDismiss}
                  disabled={dismissing}
                  className="h-10 rounded-xl border-[#cfe0f0] bg-white text-[#31516e] hover:bg-[#f3f9ff]"
                >
                  {dismissing ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  {isEnglish ? "Got it, hide notice" : "تم، إخفاء الإشعار"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            disabled={dismissing}
            aria-label={isEnglish ? "Hide decision notice" : "إخفاء إشعار القرار"}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#60778f] transition-colors hover:bg-white hover:text-[#102a43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0668d9] disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>
  );
}
