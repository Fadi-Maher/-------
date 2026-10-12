import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ChevronDown, Info, Loader2, RefreshCw, Wallet } from "lucide-react";
import { useState } from "react";

export function EstimatedReceivables({
  isEnglish,
  onOpenRequest,
}: {
  isEnglish: boolean;
  onOpenRequest: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const query = trpc.estimatedReceivables.mine.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const data = query.data;
  const money = (amount: string) =>
    `${new Intl.NumberFormat(isEnglish ? "en-US" : "ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount))} ${isEnglish ? "SAR" : "ر.س"}`;
  const title = isEnglish ? "Estimated receivables" : "المستحقات التقديرية";
  return (
    <section
      className="mt-4 overflow-hidden rounded-2xl border border-[#dce8f6] bg-white"
      dir={isEnglish ? "ltr" : "rtl"}
      aria-label={title}
    >
      <div className="flex items-center gap-3 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eff4ff] text-[#456fc4]">
          <Wallet className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-bold text-[#60778f]">{title}</h2>
          {query.isLoading ? (
            <span
              role="status"
              className="mt-1 flex items-center gap-2 text-xs text-[#70859b]"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              {isEnglish ? "Calculating…" : "جارٍ الحساب…"}
            </span>
          ) : query.isError ? (
            <span className="mt-1 block text-xs text-[#a9323f]" role="alert">
              {isEnglish
                ? "Could not load receivables"
                : "تعذر تحميل المستحقات"}
            </span>
          ) : data ? (
            <p
              className="mt-1 text-xl font-black text-[#17334f]"
              data-testid="estimated-total"
            >
              {money(data.totalAmount)}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-[#70859b]"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          aria-label={isEnglish ? "Refresh receivables" : "تحديث المستحقات"}
        >
          <RefreshCw
            className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}
          />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-[#70859b]"
          disabled={!data || query.isError}
          onClick={() => setExpanded(value => !value)}
          aria-label={isEnglish ? "Receivable details" : "تفاصيل المستحقات"}
          aria-expanded={expanded}
          aria-controls="estimated-receivable-details"
        >
          <ChevronDown className={`h-4 w-4 ${expanded ? "rotate-180" : ""}`} />
        </Button>
      </div>
      <div className="flex items-start gap-2 border-t border-[#edf2f8] bg-[#f8fbff] px-4 py-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7b91ab]" />
        <p className="text-[11px] leading-6 text-[#60778f]">
          {isEnglish
            ? "Accepted quote values for your completed requests only. These are estimates, not received payments or confirmed net profits. No costs, fees or taxes are deducted."
            : "قيمة عروضك المقبولة للطلبات المكتملة فقط. مبالغ تقديرية وليست مبالغ مستلمة أو صافي أرباح مؤكد. لا تُخصم منها تكاليف أو رسوم أو ضرائب."}
        </p>
      </div>
      {data && !query.isError ? (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-[11px] text-[#70859b]">
            <span>
              {isEnglish ? "Completed" : "مكتملة"}:{" "}
              <strong className="text-[#17334f]">
                {data.completedRequestCount}
              </strong>
            </span>
            <span>
              {isEnglish ? "Included in estimate" : "محسوبة بالقيمة"}:{" "}
              <strong className="text-[#17334f]">
                {data.pricedRequestCount}
              </strong>
            </span>
            {data.unpricedRequestCount > 0 ? (
              <span className="text-[#9b6c25]">
                {isEnglish ? "No accepted quote" : "بلا عرض مقبول"}:{" "}
                {data.unpricedRequestCount}{" "}
                {isEnglish ? "(excluded)" : "(غير محسوبة)"}
              </span>
            ) : null}
          </div>
          {data.completedRequestCount === 0 ? (
            <p className="px-4 pb-4 text-xs text-[#70859b]">
              {isEnglish
                ? "No completed requests yet."
                : "لا توجد طلبات مكتملة حتى الآن."}
            </p>
          ) : null}
          {expanded ? (
            <div
              id="estimated-receivable-details"
              className="max-h-72 space-y-1 overflow-y-auto border-t border-[#edf2f8] p-3"
            >
              {data.items.length ? (
                data.items.map(item => (
                  <button
                    key={item.requestId}
                    type="button"
                    onClick={() => onOpenRequest(item.requestId)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-start transition-colors hover:bg-[#f3f8ff]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-extrabold text-[#17334f]">
                        {item.category}
                        {item.subcategory ? ` — ${item.subcategory}` : ""}
                      </span>
                      <span className="mt-1 block text-[10px] text-[#8a9bad]">
                        {isEnglish ? "Request" : "طلب"} {item.reference}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-xs font-bold ${item.priceAmount === null ? "text-[#9b6c25]" : "text-[#456fc4]"}`}
                    >
                      {item.priceAmount === null
                        ? isEnglish
                          ? "Not priced"
                          : "غير مسعّر"
                        : money(item.priceAmount)}
                    </span>
                  </button>
                ))
              ) : (
                <p className="py-4 text-center text-xs text-[#70859b]">
                  {isEnglish
                    ? "No receivable details yet."
                    : "لا توجد تفاصيل مستحقات بعد."}
                </p>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
