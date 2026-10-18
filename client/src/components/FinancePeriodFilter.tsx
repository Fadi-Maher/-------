import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildFinancePeriod, type FinancePeriod, type FinancePeriodDraft } from "@shared/financePeriod";
import { CalendarDays, RotateCcw } from "lucide-react";
import { useState } from "react";

function initialDraft(): FinancePeriodDraft {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return { mode: "all", month: today.slice(0, 7), from: `${today.slice(0, 7)}-01`, to: today };
}

export function FinancePeriodFilter({ period, isEnglish, onApply }: { period: FinancePeriod; isEnglish: boolean; onApply: (period: FinancePeriod) => void }) {
  const [draft, setDraft] = useState<FinancePeriodDraft>(initialDraft);
  const [error, setError] = useState<"month" | "date" | "order" | null>(null);
  const text = isEnglish ? {
    title: "Financial period", all: "All periods", month: "By month", range: "Date range", monthInput: "Select month", from: "From date", to: "To date", apply: "Apply filter", reset: "Reset filter", selected: "Showing", help: "Based on entry date in your device's timezone. Gregorian dates; the end date is included. Choose a period, then apply.", monthError: "Choose a valid month.", dateError: "Choose valid start and end dates.", orderError: "The start date must not be after the end date.",
  } : {
    title: "الفترة المالية", all: "كل الفترات", month: "حسب الشهر", range: "نطاق زمني", monthInput: "اختر الشهر", from: "من تاريخ", to: "إلى تاريخ", apply: "تطبيق التصفية", reset: "إعادة ضبط التصفية", selected: "المعروض", help: "بحسب تاريخ القيد وبتوقيت جهازك. التواريخ ميلادية ويوم النهاية مشمول. اختر الفترة ثم اضغط تطبيق.", monthError: "اختر شهرًا صحيحًا.", dateError: "اختر تاريخ بداية ونهاية صحيحين.", orderError: "تاريخ البداية يجب ألا يكون بعد تاريخ النهاية.",
  };
  const locale = isEnglish ? "en-GB" : "ar-SA-u-ca-gregory";
  const dateFormat: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
  const caption = period.mode === "all" ? text.all : period.mode === "month"
    ? new Date(period.startMs!).toLocaleDateString(locale, { month: "long", year: "numeric" })
    : `${new Date(period.startMs!).toLocaleDateString(locale, dateFormat)} — ${new Date(period.endExclusiveMs! - 1).toLocaleDateString(locale, dateFormat)}`;
  const update = (next: Partial<FinancePeriodDraft>) => { setDraft(current => ({ ...current, ...next })); setError(null); };
  const apply = () => {
    const result = buildFinancePeriod(draft);
    if (result.error || !result.period) { setError(result.error ?? "date"); return; }
    setError(null);
    onApply(result.period);
  };
  const reset = () => {
    const next = initialDraft();
    setDraft(next); setError(null);
    onApply(buildFinancePeriod(next).period!);
  };
  return <div className="mt-4 rounded-xl border border-[#dce8f6] bg-[#f8fbff] p-3" dir={isEnglish ? "ltr" : "rtl"}>
    <div className="flex flex-wrap items-center gap-2"><CalendarDays className="h-4 w-4 text-[#0878f9]" /><h3 className="text-xs font-black text-[#405d78]">{text.title}</h3><div role="group" aria-label={text.title} className="flex flex-wrap gap-1 sm:ms-auto">{([['all', text.all], ['month', text.month], ['range', text.range]] as const).map(([mode, label]) => <Button type="button" key={mode} size="sm" variant={draft.mode === mode ? "default" : "outline"} aria-pressed={draft.mode === mode} onClick={() => update({ mode })} className={`min-h-9 rounded-lg text-xs ${draft.mode === mode ? "bg-[#0878f9] text-white" : "border-[#cde3fa] bg-white text-[#405d78]"}`}>{label}</Button>)}</div></div>
    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
      {draft.mode === "month" ? <div className="w-full sm:max-w-xs"><label htmlFor="finance-period-month" className="mb-1 block text-xs font-bold text-[#405d78]">{text.monthInput}</label><Input id="finance-period-month" type="month" value={draft.month} min="2000-01" max="9998-12" onChange={event => update({ month: event.target.value })} aria-invalid={error === "month"} aria-describedby={error ? "finance-period-error" : undefined} className="h-10 w-full min-w-0 bg-white" dir="ltr" /></div> : null}
      {draft.mode === "range" ? <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2 sm:max-w-xl"><div><label htmlFor="finance-period-from" className="mb-1 block text-xs font-bold text-[#405d78]">{text.from}</label><Input id="finance-period-from" type="date" value={draft.from} min="2000-01-01" max="9998-12-31" onChange={event => update({ from: event.target.value })} aria-invalid={Boolean(error)} aria-describedby={error ? "finance-period-error" : undefined} className="h-10 min-w-0 bg-white" dir="ltr" /></div><div><label htmlFor="finance-period-to" className="mb-1 block text-xs font-bold text-[#405d78]">{text.to}</label><Input id="finance-period-to" type="date" value={draft.to} min="2000-01-01" max="9998-12-31" onChange={event => update({ to: event.target.value })} aria-invalid={Boolean(error)} aria-describedby={error ? "finance-period-error" : undefined} className="h-10 min-w-0 bg-white" dir="ltr" /></div></div> : null}
      <div className="flex flex-wrap gap-2"><Button type="button" size="sm" onClick={apply} className="min-h-10 rounded-lg bg-[#0878f9] font-bold text-white">{text.apply}</Button><Button type="button" size="sm" variant="ghost" onClick={reset} className="min-h-10 rounded-lg text-[#60778f]"><RotateCcw className="me-1 h-3.5 w-3.5" />{text.reset}</Button></div>
    </div>
    {error ? <p id="finance-period-error" role="alert" className="mt-2 text-xs font-bold text-[#a23b3b]">{error === "month" ? text.monthError : error === "order" ? text.orderError : text.dateError}</p> : null}
    <p className="mt-3 break-words text-xs font-bold text-[#31516e]" role="status" aria-live="polite">{text.selected}: {caption}</p>
    <p className="mt-1 text-[11px] leading-5 text-[#70859b]">{text.help}</p>
  </div>;
}
