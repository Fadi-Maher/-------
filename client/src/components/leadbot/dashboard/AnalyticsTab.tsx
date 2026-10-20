import { useState, type ReactNode } from "react";
import { AlertTriangle, BarChart3, Headset, MessagesSquare, ShieldCheck, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { gradeLabel, intentLabel, leadServiceLabel, percent } from "./labels";
import { EmptyCard } from "./LeadsTab";
import { useSalesLang } from "./salesI18n";
import type { AnalyticsRange, LeadAnalytics } from "./types";

const RANGES: AnalyticsRange[] = [7, 14, 30];

export function AnalyticsTab() {
  const { t } = useSalesLang();
  const [range, setRange] = useState<AnalyticsRange>(14);
  const analytics = trpc.leadBot.staff.analytics.useQuery({ rangeDays: range }, { placeholderData: (previous) => previous });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#60778f]">{t("analyticsIntro")}</p>
        <div className="inline-flex rounded-xl border border-[#dce8f6] bg-white p-1" role="group" aria-label={t("rangeLabel")}>
          {RANGES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              aria-pressed={range === value}
              className={cn("lb-press rounded-lg px-3 py-1.5 text-xs font-bold", range === value ? "bg-[#0878f9] text-white" : "text-[#17334f] hover:bg-[#f1f7ff]")}
            >
              {t("lastDays", { days: value })}
            </button>
          ))}
        </div>
      </div>
      {analytics.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className={cn("h-28 rounded-2xl bg-[#e6eef8]", index > 3 && "h-52 lg:col-span-2")} />
          ))}
        </div>
      ) : analytics.isError || !analytics.data ? (
        <EmptyCard icon={<AlertTriangle className="h-6 w-6" />} title={t("analyticsError")} action={<Button type="button" onClick={() => void analytics.refetch()} className="rounded-xl bg-[#0878f9]">{t("retry")}</Button>} />
      ) : analytics.data.conversations === 0 ? (
        <EmptyCard icon={<BarChart3 className="h-6 w-6" />} title={t("noDataTitle")} body={t("noDataBody")} />
      ) : (
        <AnalyticsView data={analytics.data} />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, hint, warn }: { icon: ReactNode; label: string; value: ReactNode; hint?: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-[#dce8f6] bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-[#60778f]">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#eaf4ff] text-[#0878f9]" aria-hidden="true">{icon}</span>
        {label}
      </div>
      <div className={cn("mt-2 font-display text-3xl font-extrabold", warn ? "text-amber-600" : "text-[#17334f]")}>{value}</div>
      {hint ? <p className="mt-1 text-xs text-[#60778f]">{hint}</p> : null}
    </div>
  );
}

function Panel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-[#dce8f6] bg-white p-4", className)}>
      <h3 className="mb-3 font-display text-sm font-extrabold text-[#17334f]">{title}</h3>
      {children}
    </section>
  );
}

function BarList({ items }: { items: Array<{ label: string; count: number }> }) {
  const { t } = useSalesLang();
  if (!items.length) return <p className="text-sm text-[#60778f]">{t("noBarData")}</p>;
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#31516e]">
            <span className="truncate">{item.label}</span>
            <span className="font-black text-[#17334f]">{item.count}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-[#eef3f9]" aria-hidden="true">
            <div className="h-2 rounded-full bg-[#0878f9]" style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function AnalyticsView({ data }: { data: LeadAnalytics }) {
  const { lang, t } = useSalesLang();
  const maxDaily = Math.max(1, ...data.daily.map((day) => day.conversations));
  const funnel = [
    { label: t("funnelStarted"), value: data.conversations },
    { label: t("funnelEngaged"), value: data.engaged },
    { label: t("funnelQualified"), value: data.qualified },
  ];
  const gradeTotal = Math.max(1, data.grades.hot + data.grades.warm + data.grades.cold);
  const highFallback = data.fallbackRate > 0.25;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<MessagesSquare className="h-4 w-4" />} label={t("statConversations")} value={data.conversations} hint={t("statEngagedHint", { count: data.engaged })} />
        <StatCard icon={<Target className="h-4 w-4" />} label={t("statQualRate")} value={percent(data.qualificationRate)} hint={t("statQualHint", { count: data.qualified })} />
        <StatCard icon={<Headset className="h-4 w-4" />} label={t("statEscalations")} value={data.escalations} hint={t("statEscalationsHint")} />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label={t("statFallback")} value={percent(data.fallbackRate)} hint={highFallback ? t("fallbackHigh") : t("fallbackOk")} warn={highFallback} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("dailyTrend")} className="lg:col-span-2">
          <div className="flex h-44 items-end gap-1" role="img" aria-label={t("dailyChartLabel")}>
            {data.daily.map((day) => (
              <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={t("dayTitle", { date: day.date, conversations: day.conversations, qualified: day.qualified })}>
                <div className="relative w-full max-w-7 rounded-t-md bg-[#cfe3f8]" style={{ height: `${(day.conversations / maxDaily) * 100}%`, minHeight: day.conversations ? 4 : 0 }}>
                  <div className="absolute inset-x-0 bottom-0 rounded-t-md bg-[#0878f9]" style={{ height: day.conversations ? `${(day.qualified / day.conversations) * 100}%` : 0 }} />
                </div>
                <span className="text-[10px] text-[#8a9bad]" dir="ltr">{day.date.slice(8)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-[#60778f]">
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#cfe3f8]" aria-hidden="true" /> {t("legendConversations")}</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#0878f9]" aria-hidden="true" /> {t("legendQualified")}</span>
          </div>
        </Panel>

        <Panel title={t("funnelTitle")}>
          <ul className="space-y-2">
            {funnel.map((step) => (
              <li key={step.label}>
                <div className="flex items-center justify-between text-xs font-semibold text-[#31516e]">
                  <span>{step.label}</span>
                  <span className="font-black text-[#17334f]">{step.value}</span>
                </div>
                <div className="mt-1 h-3 rounded-full bg-[#eef3f9]" aria-hidden="true">
                  <div className="h-3 rounded-full bg-[linear-gradient(115deg,#0878f9,#6b35ff)]" style={{ width: `${Math.max(3, (step.value / Math.max(1, data.conversations)) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
          {data.partnerApplications ? <p className="mt-3 text-xs text-[#60778f]">{t("partnerApps", { count: data.partnerApplications })}</p> : null}
        </Panel>

        <Panel title={t("gradeDistribution", { avg: data.avgScore })}>
          <div className="flex h-4 overflow-hidden rounded-full bg-[#eef3f9]" aria-hidden="true">
            <div className="bg-red-500" style={{ width: `${(data.grades.hot / gradeTotal) * 100}%` }} />
            <div className="bg-amber-400" style={{ width: `${(data.grades.warm / gradeTotal) * 100}%` }} />
            <div className="bg-slate-300" style={{ width: `${(data.grades.cold / gradeTotal) * 100}%` }} />
          </div>
          <ul className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            {(["hot", "warm", "cold"] as const).map((grade) => (
              <li key={grade} className="rounded-xl bg-[#f8fbff] p-2">
                <span className="block font-display text-xl font-extrabold text-[#17334f]">{data.grades[grade]}</span>
                <span className="text-[#60778f]">{gradeLabel(grade, lang)}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={t("topIntents")}>
          <BarList items={data.topIntents.map((item) => ({ label: intentLabel(item.intent, lang), count: item.count }))} />
        </Panel>

        <Panel title={t("topServices")}>
          <BarList items={data.topServices.map((item) => ({ label: leadServiceLabel(item.service, lang), count: item.count }))} />
        </Panel>

        <Panel title={t("moderationTitle")} className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl bg-[#f8fbff] p-3">
              <Users className="h-5 w-5 text-[#d83c4f]" aria-hidden="true" />
              <div>
                <p className="font-display text-xl font-extrabold text-[#17334f]">{data.moderationBlocks}</p>
                <p className="text-xs text-[#60778f]">{t("moderationBlocks")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-[#f8fbff] p-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              <div>
                <p className="font-display text-xl font-extrabold text-[#17334f]">{data.sensitiveMasked}</p>
                <p className="text-xs text-[#60778f]">{t("sensitiveMasked")}</p>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-6 text-[#60778f]">{t("privacyNote")}</p>
        </Panel>
      </div>
    </div>
  );
}
