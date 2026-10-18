import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { amountToHalalas, halalasToAmount } from "@shared/finance";
import { CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

type CompletedAgentRequestsProps = {
  isEnglish: boolean;
  onOpenRequest: (requestId: number) => void;
};

function displayAmount(amount: string) {
  try {
    return halalasToAmount(amountToHalalas(amount));
  } catch {
    return amount;
  }
}

export function CompletedAgentRequests({ isEnglish, onOpenRequest }: CompletedAgentRequestsProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const query = trpc.agentFinance.completed.useQuery();
  const data = query.data;
  const text = isEnglish
    ? {
        title: "Completed requests",
        description: "Completed work and its quoted value only.",
        total: "Estimated receivables",
        totalHelp: "Quoted values are estimates only; they are not collected automatically.",
        priced: "priced",
        unpriced: "unpriced",
        details: "Completed request details",
        hide: "Hide details",
        refresh: "Refresh completed requests",
        loading: "Loading completed requests…",
        error: "Could not load completed requests.",
        retry: "Retry",
        empty: "No completed requests yet.",
        notPriced: "Not priced",
        quoteValue: "Quoted value · estimate",
        updated: "Updated",
        open: "Open request",
        noCollection: "This view does not collect payment or issue official receipts.",
      }
    : {
        title: "الطلبات المكتملة",
        description: "العمل المكتمل وقيمة العرض المرتبطة به فقط.",
        total: "المستحقات التقديرية",
        totalHelp: "قيمة العرض تقدير وليست تحصيلًا تلقائيًا.",
        priced: "مسعّرة",
        unpriced: "غير مسعّرة",
        details: "تفاصيل الطلبات المكتملة",
        hide: "إخفاء التفاصيل",
        refresh: "تحديث الطلبات المكتملة",
        loading: "جارٍ تحميل الطلبات المكتملة…",
        error: "تعذر تحميل الطلبات المكتملة.",
        retry: "إعادة المحاولة",
        empty: "لا توجد طلبات مكتملة حتى الآن.",
        notPriced: "غير مسعّر",
        quoteValue: "قيمة العرض · تقدير",
        updated: "آخر تحديث",
        open: "فتح الطلب",
        noCollection: "لا تنفذ هذه الواجهة دفعًا ولا تصدر إيصالات رسمية.",
      };

  if (query.isLoading) {
    return <div role="status" className="grid min-h-36 place-items-center rounded-2xl border border-[#dce8f6] bg-white"><Loader2 className="h-6 w-6 animate-spin text-[#0878f9]" /><span className="sr-only">{text.loading}</span></div>;
  }

  if (query.isError || !data) {
    return <div role="alert" className="rounded-2xl border border-[#f1c6ca] bg-[#fff7f7] p-4 text-sm text-[#9e3540]" dir={isEnglish ? "ltr" : "rtl"}><p>{text.error}</p><Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()} className="mt-3 border-[#e5b5bb] text-[#9e3540]"><RefreshCw className="me-1 h-3.5 w-3.5" />{text.retry}</Button></div>;
  }

  return (
    <section className="rounded-2xl border border-[#dce8f6] bg-white p-4 shadow-[0_8px_26px_rgba(31,91,151,.05)] sm:p-5" dir={isEnglish ? "ltr" : "rtl"} aria-label={text.title}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf8f1] text-[#238457]"><CheckCircle2 className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1"><h2 className="font-display text-base font-black text-[#17334f]">{text.title}</h2><p className="mt-1 text-xs leading-5 text-[#60778f]">{text.description}</p></div>
        <Badge className="rounded-full bg-[#eff9f1] text-[#238457]">{data.completedRequestCount}</Badge>
      </div>

      <div className="mt-4 rounded-xl border border-[#cfe3fb] bg-[#f5faff] p-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[#45647e]"><CircleDollarSign className="h-4 w-4 text-[#0878f9]" />{text.total}</div>
        <output data-testid="estimated-total" className="mt-1 block font-display text-2xl font-black tabular-nums text-[#17334f]" dir="ltr"><bdi>{displayAmount(data.totalAmount)} SAR</bdi></output>
        <p className="mt-1 text-[11px] leading-5 text-[#60778f]">{text.totalHelp}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold"><Badge variant="outline" className="border-[#b7dbff] text-[#0878f9]">{data.pricedRequestCount} {text.priced}</Badge><Badge variant="outline" className="border-[#e7d7aa] text-[#8b6e26]">{data.unpricedRequestCount} {text.unpriced}</Badge></div>
      <p className="mt-3 text-[11px] leading-5 text-[#70859b]">{text.noCollection}</p>

      {data.items.length ? <>
        <div className="mt-4 flex flex-wrap items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setDetailsOpen(value => !value)} aria-expanded={detailsOpen} className="rounded-lg border-[#b7dbff] text-[#0878f9]">{detailsOpen ? text.hide : text.details}{detailsOpen ? <ChevronRight className="ms-1 h-4 w-4" /> : <ChevronLeft className="ms-1 h-4 w-4" />}</Button><Button type="button" variant="ghost" size="sm" onClick={() => void query.refetch()} aria-label={text.refresh} className="text-[#60778f]"><RefreshCw className="h-3.5 w-3.5" /></Button></div>
        {detailsOpen ? <div className="mt-3 space-y-2 border-t border-[#e7eff8] pt-3">{data.items.map(item => <button key={item.requestId} type="button" onClick={() => onOpenRequest(item.requestId)} aria-label={`${text.open}: ${item.reference}`} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[#e2ecf6] bg-[#fbfdff] p-3 text-start transition-colors hover:border-[#b7dbff] hover:bg-[#f4f9ff]"><span className="min-w-0"><span className="block truncate text-sm font-black text-[#17334f]">{item.reference} · {item.category}{item.subcategory ? ` — ${item.subcategory}` : ""}</span><span className="mt-1 block text-[11px] text-[#70859b]">{text.updated}: {new Date(item.updatedAt).toLocaleDateString(isEnglish ? "en-US" : "ar-SA")}</span></span><span className={`text-end text-xs font-black tabular-nums ${item.priceAmount === null ? "text-[#9b6c25]" : "text-[#0878f9]"}`} dir="ltr">{item.priceAmount === null ? text.notPriced : <><span className="block text-[10px] font-bold text-[#70859b]" dir={isEnglish ? "ltr" : "rtl"}>{text.quoteValue}</span>{displayAmount(item.priceAmount)} SAR</>}</span></button>)}</div> : null}
      </> : <p className="mt-5 rounded-xl bg-[#f7fbff] p-5 text-center text-sm text-[#70859b]">{text.empty}</p>}
    </section>
  );
}
