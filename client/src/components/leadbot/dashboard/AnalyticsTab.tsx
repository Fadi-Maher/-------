import { useState, type ReactNode } from "react";
import { AlertTriangle, BarChart3, Headset, MessagesSquare, ShieldCheck, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { INTENT_LABELS, gradeLabel, leadServiceLabel, percent } from "./labels";
import { EmptyCard } from "./LeadsTab";
import type { AnalyticsRange, LeadAnalytics } from "./types";

const RANGES: AnalyticsRange[] = [7, 14, 30];

export function AnalyticsTab() {
  const [range, setRange] = useState<AnalyticsRange>(14);
  const analytics = trpc.leadBot.staff.analytics.useQuery({ rangeDays: range }, { placeholderData: (previous) => previous });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#60778f]">مؤشرات استخدام مساعد المبيعات وجودة التأهيل.</p>
        <div className="inline-flex rounded-xl border border-[#dce8f6] bg-white p-1" role="group" aria-label="الفترة">
          {RANGES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              aria-pressed={range === value}
              className={cn("lb-press rounded-lg px-3 py-1.5 text-xs font-bold", range === value ? "bg-[#0878f9] text-white" : "text-[#17334f] hover:bg-[#f1f7ff]")}
            >
              آخر {value} يومًا
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
        <EmptyCard icon={<AlertTriangle className="h-6 w-6" />} title="تعذّر تحميل التحليلات" action={<Button type="button" onClick={() => void analytics.refetch()} className="rounded-xl bg-[#0878f9]">إعادة المحاولة</Button>} />
      ) : analytics.data.conversations === 0 ? (
        <EmptyCard icon={<BarChart3 className="h-6 w-6" />} title="لا توجد بيانات في هذه الفترة" body="ستظهر المؤشرات بعد أن يبدأ الزوار محادثاتهم مع مساعد المبيعات." />
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
  if (!items.length) return <p className="text-sm text-[#60778f]">لا توجد بيانات بعد.</p>;
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
  const maxDaily = Math.max(1, ...data.daily.map((day) => day.conversations));
  const funnel = [
    { label: "بدأوا محادثة", value: data.conversations },
    { label: "تفاعلوا مع المساعد", value: data.engaged },
    { label: "أكملوا التأهيل", value: data.qualified },
  ];
  const gradeTotal = Math.max(1, data.grades.hot + data.grades.warm + data.grades.cold);
  const highFallback = data.fallbackRate > 0.25;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<MessagesSquare className="h-4 w-4" />} label="المحادثات" value={data.conversations} hint={`${data.engaged} تفاعلوا فعليًا`} />
        <StatCard icon={<Target className="h-4 w-4" />} label="نسبة التأهيل" value={percent(data.qualificationRate)} hint={`${data.qualified} عميل محتمل مؤهل`} />
        <StatCard icon={<Headset className="h-4 w-4" />} label="التحويل لموظف" value={data.escalations} hint="طلبات تحدث مع موظف أو شكاوى" />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="معدل عدم الفهم" value={percent(data.fallbackRate)} hint={highFallback ? "مرتفع: راجع الأسئلة الشائعة" : "ضمن المعدل الجيد"} warn={highFallback} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="الاتجاه اليومي" className="lg:col-span-2">
          <div className="flex h-44 items-end gap-1" role="img" aria-label="رسم بياني للمحادثات اليومية والعملاء المؤهلين">
            {data.daily.map((day) => (
              <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${day.date}: ${day.conversations} محادثة · ${day.qualified} مؤهل`}>
                <div className="relative w-full max-w-7 rounded-t-md bg-[#cfe3f8]" style={{ height: `${(day.conversations / maxDaily) * 100}%`, minHeight: day.conversations ? 4 : 0 }}>
                  <div className="absolute inset-x-0 bottom-0 rounded-t-md bg-[#0878f9]" style={{ height: day.conversations ? `${(day.qualified / day.conversations) * 100}%` : 0 }} />
                </div>
                <span className="text-[10px] text-[#8a9bad]" dir="ltr">{day.date.slice(8)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-[#60778f]">
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#cfe3f8]" aria-hidden="true" /> محادثات</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#0878f9]" aria-hidden="true" /> مؤهلون</span>
          </div>
        </Panel>

        <Panel title="قمع التأهيل">
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
          {data.partnerApplications ? <p className="mt-3 text-xs text-[#60778f]">منها {data.partnerApplications} طلب انضمام كمعقّب.</p> : null}
        </Panel>

        <Panel title={`توزيع التقييم (متوسط ${data.avgScore})`}>
          <div className="flex h-4 overflow-hidden rounded-full bg-[#eef3f9]" aria-hidden="true">
            <div className="bg-red-500" style={{ width: `${(data.grades.hot / gradeTotal) * 100}%` }} />
            <div className="bg-amber-400" style={{ width: `${(data.grades.warm / gradeTotal) * 100}%` }} />
            <div className="bg-slate-300" style={{ width: `${(data.grades.cold / gradeTotal) * 100}%` }} />
          </div>
          <ul className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            {(["hot", "warm", "cold"] as const).map((grade) => (
              <li key={grade} className="rounded-xl bg-[#f8fbff] p-2">
                <span className="block font-display text-xl font-extrabold text-[#17334f]">{data.grades[grade]}</span>
                <span className="text-[#60778f]">{gradeLabel(grade)}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="أكثر النوايا شيوعًا">
          <BarList items={data.topIntents.map((item) => ({ label: INTENT_LABELS[item.intent] ?? item.intent, count: item.count }))} />
        </Panel>

        <Panel title="الخدمات الأكثر طلبًا">
          <BarList items={data.topServices.map((item) => ({ label: leadServiceLabel(item.service), count: item.count }))} />
        </Panel>

        <Panel title="الإشراف وحماية البيانات" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl bg-[#f8fbff] p-3">
              <Users className="h-5 w-5 text-[#d83c4f]" aria-hidden="true" />
              <div>
                <p className="font-display text-xl font-extrabold text-[#17334f]">{data.moderationBlocks}</p>
                <p className="text-xs text-[#60778f]">رسائل محظورة لألفاظ مسيئة</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-[#f8fbff] p-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              <div>
                <p className="font-display text-xl font-extrabold text-[#17334f]">{data.sensitiveMasked}</p>
                <p className="text-xs text-[#60778f]">بيانات حساسة حُجبت تلقائيًا</p>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-6 text-[#60778f]">تُحجب أرقام الهوية والآيبان والبطاقات قبل الحفظ، ولا تُحفظ بيانات التواصل إلا بعد موافقة صريحة من الزائر.</p>
        </Panel>
      </div>
    </div>
  );
}
