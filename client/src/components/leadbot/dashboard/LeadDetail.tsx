import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Copy, Headset, Loader2, Phone, Send, ShieldCheck, UserCheck, X } from "lucide-react";
import { toast } from "sonner";
import { FIELD_LABELS, LEAD_FIELDS, type LeadField } from "@shared/leadBot/catalog";
import { slotValueLabel } from "@shared/leadBot/engine";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { STATUS_ORDER, errorText, formatClock, formatDateTime, formatPhone, leadServiceLabel, relativeTime, scoreFactorLabel, statusLabel, type LeadStatus } from "./labels";
import { GradeChip, StatusChip } from "./LeadsTab";
import { useSalesLang } from "./salesI18n";
import type { DetailMessage, LeadDetailResult } from "./types";

const SUMMARY_FIELDS = LEAD_FIELDS.filter((field) => field !== "consent") as LeadField[];

export function LeadDetailSheet({ leadId, onClose, staffName }: { leadId: number | null; onClose: () => void; staffName: string | null }) {
  const { lang, dir } = useSalesLang();
  return (
    <Sheet open={leadId !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      {/* Opens from the inline-end edge: left in Arabic, right in English. */}
      <SheetContent side={dir === "rtl" ? "left" : "right"} dir={dir} lang={lang} className="w-full gap-0 overflow-hidden p-0 sm:max-w-xl [&>button:last-child]:hidden">
        {leadId !== null ? <LeadDetailBody leadId={leadId} onClose={onClose} staffName={staffName} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function LeadDetailBody({ leadId, onClose, staffName }: { leadId: number; onClose: () => void; staffName: string | null }) {
  const { lang, t } = useSalesLang();
  const utils = trpc.useUtils();
  const detail = trpc.leadBot.staff.get.useQuery({ leadId }, { refetchInterval: 5_000 });
  const refresh = async () => {
    await Promise.all([utils.leadBot.staff.get.invalidate({ leadId }), utils.leadBot.staff.list.invalidate(), utils.leadBot.staff.alerts.invalidate()]);
  };

  useEffect(() => {
    // Opening a lead resets its unread counter on the server; refresh the list badges.
    if (detail.isSuccess) void utils.leadBot.staff.list.invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.isSuccess]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f8fbff]">
      <header className="flex items-start justify-between gap-3 border-b border-[#dce8f6] bg-white px-5 py-4">
        <div className="min-w-0">
          <SheetTitle className="truncate font-display text-xl font-extrabold text-[#17334f]">
            {detail.data?.lead.name || (detail.data ? t("unnamed") : t("detailTitle"))}
          </SheetTitle>
          <SheetDescription className="mt-1 text-xs text-[#60778f]">
            {detail.data
              ? `${detail.data.lead.kind === "partner" ? t("kindPartner") : t("kindSales")} · LEAD-${detail.data.lead.id} · ${t("createdOn", { date: formatDateTime(detail.data.lead.createdAt, lang) })}`
              : t("detailTitle")}
          </SheetDescription>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} className="shrink-0 rounded-full text-[#60778f]" aria-label={t("closeDetail")}>
          <X className="h-5 w-5" />
        </Button>
      </header>
      {detail.isLoading ? (
        <div className="space-y-3 p-5" aria-hidden="true">
          <Skeleton className="bg-[#e6eef8] h-24 rounded-2xl" />
          <Skeleton className="bg-[#e6eef8] h-40 rounded-2xl" />
          <Skeleton className="bg-[#e6eef8] h-56 rounded-2xl" />
        </div>
      ) : detail.isError || !detail.data ? (
        <div className="p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
          <p className="mt-3 font-bold text-[#17334f]">{t("detailError")}</p>
          <Button type="button" onClick={() => void detail.refetch()} className="mt-4 rounded-xl bg-[#0878f9]">{t("retry")}</Button>
        </div>
      ) : (
        <DetailContent data={detail.data} staffName={staffName} onChanged={refresh} />
      )}
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#dce8f6] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-extrabold text-[#17334f]">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function DetailContent({ data, staffName, onChanged }: { data: LeadDetailResult; staffName: string | null; onChanged: () => Promise<void> }) {
  const { lang, t, dir } = useSalesLang();
  const { lead, messages } = data;
  const handoff = data.conversation.handoff;
  const open = lead.handoffStatus === "waiting" || lead.handoffStatus === "active";
  const update = trpc.leadBot.staff.update.useMutation();
  const resolve = trpc.leadBot.staff.resolve.useMutation();
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);

  useEffect(() => {
    if (!editingNotes) setNotes(lead.notes ?? "");
  }, [lead.notes, editingNotes]);

  const copyPhone = async () => {
    if (!lead.phone) return;
    try {
      await navigator.clipboard.writeText(formatPhone(lead.phone).replace(/\s/g, ""));
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  const changeStatus = async (status: LeadStatus) => {
    try {
      await update.mutateAsync({ leadId: lead.id, status });
      await onChanged();
    } catch (error) {
      toast.error(errorText(error, t("statusFailed"), lang));
    }
  };

  const assign = async (assignedTo: string | null) => {
    try {
      await update.mutateAsync({ leadId: lead.id, assignedTo });
      await onChanged();
    } catch (error) {
      toast.error(errorText(error, t("assignFailed"), lang));
    }
  };

  const saveNotes = async () => {
    try {
      await update.mutateAsync({ leadId: lead.id, notes: notes.trim() || null });
      setEditingNotes(false);
      await onChanged();
      toast.success(t("noteSaved"));
    } catch (error) {
      toast.error(errorText(error, t("noteFailed"), lang));
    }
  };

  const endHandoff = async () => {
    try {
      await resolve.mutateAsync({ leadId: lead.id });
      await onChanged();
      toast.success(t("handoffEnded"));
    } catch (error) {
      toast.error(errorText(error, t("handoffEndFailed"), lang));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          {lead.kind !== "partner" ? <GradeChip grade={lead.grade} score={lead.score} /> : null}
          <StatusChip status={lead.status} />
          {!lead.qualified ? <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">{lead.kind === "partner" ? t("partnerPending") : t("qualificationIncomplete")}</span> : null}
        </div>

        <div className="rounded-2xl border border-[#dce8f6] bg-white p-4">
          {lead.phone ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <a href={`tel:${formatPhone(lead.phone).replace(/\s/g, "")}`} className="inline-flex items-center gap-2 font-display text-lg font-extrabold text-[#0878f9] hover:underline" dir="ltr">
                <Phone className="h-4 w-4" aria-hidden="true" />
                {formatPhone(lead.phone)}
              </a>
              <Button type="button" variant="outline" size="sm" onClick={() => void copyPhone()} className="rounded-xl border-[#dce8f6] bg-white">
                <Copy className="me-1 h-4 w-4" aria-hidden="true" />
                {t("copy")}
              </Button>
            </div>
          ) : (
            <p className="text-sm font-semibold text-[#60778f]">{t("noPhone")}</p>
          )}
          <p className={cn("mt-2 inline-flex items-center gap-1 text-xs font-bold", lead.slots.consent ? "text-emerald-700" : "text-[#8a9bad]")}>
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {lead.slots.consent ? t("consented") : t("notConsented")}
          </p>
        </div>

        {open && handoff ? (
          <div className={cn("rounded-2xl border p-4", lead.handoffStatus === "waiting" ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50")} role="status">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Headset className={cn("mt-0.5 h-5 w-5 shrink-0", lead.handoffStatus === "waiting" ? "text-amber-700" : "text-emerald-700")} aria-hidden="true" />
                <div>
                  <p className="font-bold text-[#17334f]">{lead.handoffStatus === "active" ? t("handoffActive", { name: handoff.agentName ?? t("aTeamMember") }) : t("handoffWaiting")}</p>
                  <p className="mt-1 text-xs text-[#60778f]">
                    {t("reasonLabel")} {handoff.reason === "complaint" ? t("reasonComplaint") : t("reasonRequested")} · {relativeTime(handoff.requestedAt, lang)}
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void endHandoff()} disabled={resolve.isPending} className="rounded-xl border-[#dce8f6] bg-white">
                {resolve.isPending ? <Loader2 className="me-1 h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> : <CheckCircle2 className="me-1 h-4 w-4" aria-hidden="true" />}
                {t("endHandoff")}
              </Button>
            </div>
          </div>
        ) : null}

        <Section title={t("summaryTitle")}>
          {SUMMARY_FIELDS.some((field) => lead.slots[field] !== undefined) ? (
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
              {SUMMARY_FIELDS.filter((field) => lead.slots[field] !== undefined).map((field) => (
                <div key={field} className="min-w-0">
                  <dt className="text-xs font-semibold text-[#60778f]">{FIELD_LABELS[field][lang]}</dt>
                  <dd className="truncate text-sm font-bold text-[#17334f]" dir={field === "phone" ? "ltr" : undefined} style={field === "phone" ? { textAlign: dir === "rtl" ? "right" : "left" } : undefined}>
                    <bdi>{field === "phone" ? formatPhone(lead.slots.phone) : field === "service" ? leadServiceLabel(lead.slots.service, lang) : slotValueLabel(field, lead.slots, lang)}</bdi>
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-[#60778f]">{t("noSummary")}</p>
          )}
        </Section>

        {lead.kind !== "partner" ? (
          <Section title={t("scoreTitle", { score: lead.score })}>
            {lead.breakdown.length ? (
              <ul className="space-y-1.5">
                {lead.breakdown.map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[#31516e]">{scoreFactorLabel(item.key, item.label, lang)}</span>
                    <span className="font-black text-[#0878f9]">+{item.points}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#60778f]">{t("noSignals")}</p>
            )}
          </Section>
        ) : null}

        <Section title={t("followUpTitle")}>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("followUpTitle")}>
            {STATUS_ORDER.map((status) => (
              <button
                key={status}
                type="button"
                disabled={update.isPending}
                onClick={() => (status !== lead.status ? void changeStatus(status) : undefined)}
                aria-pressed={lead.status === status}
                className={cn(
                  "lb-press rounded-full border px-3 py-1.5 text-xs font-bold disabled:opacity-60",
                  lead.status === status ? "border-[#0878f9] bg-[#0878f9] text-white" : "border-[#dce8f6] bg-white text-[#17334f] hover:bg-[#f1f7ff]",
                )}
              >
                {statusLabel(status, lang)}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#eef3f9] pt-3">
            <p className="text-sm">
              <span className="text-[#60778f]">{t("assignedLabel")} </span>
              <span className="font-bold text-[#17334f]"><bdi>{lead.assignedTo || t("unassigned")}</bdi></span>
            </p>
            {staffName && lead.assignedTo !== staffName ? (
              <Button type="button" variant="outline" size="sm" disabled={update.isPending} onClick={() => void assign(staffName)} className="rounded-xl border-[#dce8f6] bg-white">
                <UserCheck className="me-1 h-4 w-4" aria-hidden="true" />
                {t("assignMe")}
              </Button>
            ) : null}
          </div>
        </Section>

        <Section title={t("notesTitle")}>
          <label className="sr-only" htmlFor={`lead-notes-${lead.id}`}>{t("notesLabel")}</label>
          <Textarea
            id={`lead-notes-${lead.id}`}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setEditingNotes(true);
            }}
            placeholder={t("notesPlaceholder")}
            dir="auto"
            maxLength={2000}
            className="min-h-20 rounded-xl border-[#dce8f6]"
          />
          {editingNotes ? (
            <div className="mt-2 flex gap-2">
              <Button type="button" size="sm" onClick={() => void saveNotes()} disabled={update.isPending} className="rounded-xl bg-[#0878f9]">{t("saveNote")}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setNotes(lead.notes ?? ""); setEditingNotes(false); }}>{t("cancel")}</Button>
            </div>
          ) : null}
        </Section>

        <Section title={t("transcriptTitle", { count: messages.length })}>
          <Transcript messages={messages} />
        </Section>
      </div>
      <ReplyComposer leadId={lead.id} handoffOpen={open} onSent={onChanged} />
    </div>
  );
}

function Transcript({ messages }: { messages: DetailMessage[] }) {
  const { lang, t } = useSalesLang();
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);
  if (!messages.length) return <p className="text-sm text-[#60778f]">{t("noMessages")}</p>;
  return (
    <ol className="max-h-[420px] space-y-2 overflow-y-auto pe-1" aria-label={t("transcriptLabel")}>
      {messages.map((message) => {
        if (message.role === "system") {
          return (
            <li key={message.id} dir="auto" className="mx-auto max-w-[90%] rounded-xl bg-slate-100 px-3 py-1.5 text-center text-xs text-slate-600">
              {message.text}
            </li>
          );
        }
        const visitor = message.role === "user";
        const agent = message.role === "agent";
        return (
          <li key={message.id} className={cn("flex", visitor ? "justify-start" : "justify-end")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-6",
                visitor ? "bg-[#0878f9] text-white" : agent ? "border border-emerald-200 bg-emerald-50 text-[#17334f]" : "border border-[#dce8f6] bg-[#f8fbff] text-[#17334f]",
              )}
            >
              <span className={cn("mb-0.5 block text-[11px] font-bold", visitor ? "text-white/80" : "text-[#60778f]")}>
                {visitor ? t("roleVisitor") : agent ? message.authorName || t("roleAgent") : t("roleBot")} · {formatClock(message.createdAt, lang)}
              </span>
              <span dir="auto" className="block">{message.text}</span>
            </div>
          </li>
        );
      })}
      <div ref={endRef} />
    </ol>
  );
}

function ReplyComposer({ leadId, handoffOpen, onSent }: { leadId: number; handoffOpen: boolean; onSent: () => Promise<void> }) {
  const { lang, t, dir } = useSalesLang();
  const [text, setText] = useState("");
  const reply = trpc.leadBot.staff.reply.useMutation();
  const send = async () => {
    const value = text.trim();
    if (!value || reply.isPending) return;
    try {
      await reply.mutateAsync({ leadId, text: value.slice(0, 1000) });
      setText("");
      await onSent();
    } catch (error) {
      toast.error(errorText(error, t("replyFailed"), lang));
    }
  };
  return (
    <form
      className="border-t border-[#dce8f6] bg-white p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <label htmlFor={`lead-reply-${leadId}`} className="mb-1.5 block text-xs font-bold text-[#31516e]">{t("replyLabel")}</label>
      <div className="flex items-end gap-2">
        <Textarea
          id={`lead-reply-${leadId}`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder={handoffOpen ? t("replyPlaceholderOpen") : t("replyPlaceholderStart")}
          dir="auto"
          maxLength={1000}
          rows={2}
          className="min-h-11 flex-1 resize-none rounded-xl border-[#dce8f6]"
        />
        <Button type="submit" disabled={!text.trim() || reply.isPending} className="h-11 rounded-xl bg-[#0878f9] px-4" aria-label={t("sendReply")}>
          {reply.isPending ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> : <Send className={cn("h-4 w-4", dir === "rtl" && "-scale-x-100")} aria-hidden="true" />}
          <span className="ms-1 hidden sm:inline">{t("send")}</span>
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-[#8a9bad]">{t("replyHint")}</p>
    </form>
  );
}
