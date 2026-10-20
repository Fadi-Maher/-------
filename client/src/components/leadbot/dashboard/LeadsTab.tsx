import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Flame, Headset, Inbox, MessageSquareText, RefreshCw, Search, Sparkles, UserPlus, Users, X } from "lucide-react";
import type { LeadServiceId } from "@shared/leadBot/catalog";
import type { LeadGrade } from "@shared/leadBot/scoring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { GRADE_TONES, SERVICE_OPTIONS, STATUS_LABELS, STATUS_ORDER, STATUS_TONES, formatPhone, gradeLabel, leadServiceLabel, relativeTime, type LeadStatus } from "./labels";
import type { LeadListFiltersInput, StaffLead } from "./types";

type Segment = "all" | "new" | "hot" | "waiting";

const SEGMENTS: Array<{ id: Segment; label: string; icon: ReactNode }> = [
  { id: "all", label: "كل العملاء المحتملين", icon: <Users className="h-4 w-4" aria-hidden="true" /> },
  { id: "new", label: "جديد لم يُتواصل معه", icon: <Sparkles className="h-4 w-4" aria-hidden="true" /> },
  { id: "hot", label: "عملاء ساخنون", icon: <Flame className="h-4 w-4" aria-hidden="true" /> },
  { id: "waiting", label: "بانتظار موظف", icon: <Headset className="h-4 w-4" aria-hidden="true" /> },
];

export function GradeChip({ grade, score }: { grade: LeadGrade; score?: number }) {
  const tone = GRADE_TONES[grade];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1", tone.chip)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} aria-hidden="true" />
      {gradeLabel(grade)}
      {score !== undefined ? <span className="font-semibold opacity-80">· {score}</span> : null}
    </span>
  );
}

export function StatusChip({ status }: { status: LeadStatus }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold", STATUS_TONES[status])}>{STATUS_LABELS[status]}</span>;
}

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const selectClass =
  "h-10 rounded-xl border border-[#dce8f6] bg-white px-3 text-sm font-semibold text-[#17334f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9]/40";

export function LeadsTab({ onOpenLead, selectedLeadId }: { onOpenLead: (leadId: number) => void; selectedLeadId: number | null }) {
  const [segment, setSegment] = useState<Segment>("all");
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState<LeadGrade | "">("");
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [service, setService] = useState<LeadServiceId | "">("");
  const debouncedQuery = useDebounced(query.trim(), 300);

  const filters = useMemo<LeadListFiltersInput>(() => {
    const value: LeadListFiltersInput = {};
    if (debouncedQuery) value.query = debouncedQuery.slice(0, 80);
    if (segment === "new") value.status = "new";
    if (segment === "hot") value.grade = "hot";
    if (segment === "waiting") value.handoffOnly = true;
    if (grade && segment !== "hot") value.grade = grade;
    if (status && segment !== "new") value.status = status;
    if (service) value.service = service;
    return value;
  }, [debouncedQuery, segment, grade, status, service]);

  const list = trpc.leadBot.staff.list.useQuery(filters, { refetchInterval: 15_000, placeholderData: (previous) => previous });
  const leads = list.data?.leads ?? [];
  const counts = list.data?.counts;
  const hasFilters = Boolean(debouncedQuery || grade || status || service || segment !== "all");

  const clearFilters = () => {
    setQuery("");
    setGrade("");
    setStatus("");
    setService("");
    setSegment("all");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="تصفية العملاء المحتملين">
        {SEGMENTS.map((item) => {
          const badge = item.id === "waiting" ? (counts?.waiting ?? 0) + (counts?.active ?? 0) : 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSegment(item.id)}
              aria-pressed={segment === item.id}
              className={cn(
                "lb-press inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold",
                segment === item.id ? "border-[#0878f9] bg-[#0878f9] text-white" : "border-[#dce8f6] bg-white text-[#17334f] hover:bg-[#f1f7ff]",
              )}
            >
              {item.icon}
              {item.label}
              {badge > 0 ? (
                <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-black", segment === item.id ? "bg-white text-[#0878f9]" : "bg-[#d83c4f] text-white")}>{badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 rounded-2xl border border-[#dce8f6] bg-white p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative block">
          <span className="sr-only">ابحث بالاسم أو رقم الجوال</span>
          <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#60778f] ltr:left-3 rtl:right-3" aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.preventDefault();
                setQuery("");
              }
            }}
            placeholder="ابحث برقم الجوال أو الاسم (05… أو 9665… أو أرقام عربية)"
            className="h-10 rounded-xl border-[#dce8f6] ps-9 pe-9"
            inputMode="search"
            maxLength={80}
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} className="absolute top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[#60778f] hover:bg-[#f1f7ff] ltr:right-2 rtl:left-2" aria-label="مسح البحث">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </label>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="lead-grade">التقييم</label>
          <select id="lead-grade" className={selectClass} value={segment === "hot" ? "hot" : grade} disabled={segment === "hot"} onChange={(event) => setGrade(event.target.value as LeadGrade | "")}>
            <option value="">كل التقييمات</option>
            {(["hot", "warm", "cold"] as const).map((value) => (
              <option key={value} value={value}>{gradeLabel(value)}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="lead-status">الحالة</label>
          <select id="lead-status" className={selectClass} value={segment === "new" ? "new" : status} disabled={segment === "new"} onChange={(event) => setStatus(event.target.value as LeadStatus | "")}>
            <option value="">كل الحالات</option>
            {STATUS_ORDER.map((value) => (
              <option key={value} value={value}>{STATUS_LABELS[value]}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="lead-service">الخدمة</label>
          <select id="lead-service" className={selectClass} value={service} onChange={(event) => setService(event.target.value as LeadServiceId | "")}>
            <option value="">كل الخدمات</option>
            {SERVICE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-xl border-[#dce8f6] bg-white" onClick={() => void list.refetch()} aria-label="تحديث القائمة" disabled={list.isFetching}>
            <RefreshCw className={cn("h-4 w-4", list.isFetching && "motion-safe:animate-spin")} />
          </Button>
        </div>
      </div>

      <div aria-live="polite" className="sr-only">{list.isSuccess ? `${leads.length} عميل محتمل` : ""}</div>

      {list.isLoading ? (
        <div className="space-y-2" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="bg-[#e6eef8] h-20 rounded-2xl" />
          ))}
        </div>
      ) : list.isError ? (
        <EmptyCard icon={<AlertTriangle className="h-6 w-6" />} title="تعذّر تحميل العملاء المحتملين" body="تحقق من الاتصال ثم أعد المحاولة." action={<Button type="button" onClick={() => void list.refetch()} className="rounded-xl bg-[#0878f9]">إعادة المحاولة</Button>} />
      ) : leads.length === 0 ? (
        hasFilters ? (
          <EmptyCard icon={<Search className="h-6 w-6" />} title="لا توجد نتائج مطابقة" body="جرّب رقمًا آخر أو أزل بعض عوامل التصفية." action={<Button type="button" variant="outline" onClick={clearFilters} className="rounded-xl bg-white">مسح عوامل التصفية</Button>} />
        ) : (
          <EmptyCard icon={<Inbox className="h-6 w-6" />} title="لا يوجد عملاء محتملون بعد" body="سيظهر هنا كل زائر يكمل التأهيل أو يطلب التحدث مع موظف عبر مساعد المبيعات في الموقع." />
        )
      ) : (
        <ul className="space-y-2" aria-label="قائمة العملاء المحتملين">
          {leads.map((lead) => (
            <li key={lead.id}>
              <LeadRow lead={lead} selected={selectedLeadId === lead.id} onOpen={() => onOpenLead(lead.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LeadRow({ lead, selected, onOpen }: { lead: StaffLead; selected: boolean; onOpen: () => void }) {
  const waiting = lead.handoffStatus === "waiting";
  const active = lead.handoffStatus === "active";
  const partner = lead.kind === "partner";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "lb-press grid w-full gap-3 rounded-2xl border bg-white p-4 text-start shadow-[0_8px_22px_rgba(16,42,67,.04)] hover:border-[#9fcbff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9]/40 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center",
        waiting ? "border-amber-300" : "border-[#dce8f6]",
        selected && "border-[#0878f9] ring-2 ring-[#0878f9]/20",
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black", partner ? "bg-[#f3ecff] text-[#6b35ff]" : "bg-[#eaf4ff] text-[#0878f9]")} aria-hidden="true">
          {partner ? <UserPlus className="h-5 w-5" /> : (lead.name?.trim()?.[0] ?? "؟")}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-display text-base font-extrabold text-[#17334f]">{lead.name || "زائر بدون اسم"}</span>
            {lead.unreadForStaff > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#d83c4f] px-2 py-0.5 text-[11px] font-black text-white">
                <MessageSquareText className="h-3 w-3" aria-hidden="true" />
                {lead.unreadForStaff}
                <span className="sr-only">رسائل غير مقروءة</span>
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-sm text-[#60778f]" dir="ltr" style={{ textAlign: "end" }}>
            {lead.phone ? formatPhone(lead.phone) : "—"}
          </span>
        </span>
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-[#31516e]">
        <span className="truncate font-semibold">{partner ? "شريك/معقّب" : leadServiceLabel(lead.service)}</span>
        {!lead.qualified ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{partner ? "طلب انضمام" : "غير مكتمل"}</span> : null}
        {waiting ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800">بانتظار موظف</span> : null}
        {active ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">محادثة جارية</span> : null}
      </span>
      <span className="flex flex-wrap items-center gap-2 sm:justify-end">
        {!partner ? <GradeChip grade={lead.grade} score={lead.score} /> : null}
        <StatusChip status={lead.status} />
        <span className="text-xs font-semibold text-[#8a9bad]">
          <span className="sr-only">آخر نشاط: </span>
          {relativeTime(lead.lastMessageAt)}
        </span>
      </span>
    </button>
  );
}

export function EmptyCard({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#cfe3f8] bg-white px-6 py-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#eaf4ff] text-[#0878f9]" aria-hidden="true">{icon}</span>
      <h3 className="mt-4 font-display text-lg font-extrabold text-[#17334f]">{title}</h3>
      {body ? <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[#60778f]">{body}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
