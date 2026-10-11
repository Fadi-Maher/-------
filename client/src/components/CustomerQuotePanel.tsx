import { DeadlineIndicator } from "@/components/DeadlineIndicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Clock3, HandCoins, Loader2, SlidersHorizontal, Sparkles, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

export type CustomerQuote = {
  id: number;
  providerName: string;
  providerRole: "employee" | "agent";
  priceAmount: string;
  durationDays: number;
  note: string | null;
  status: "submitted" | "selected" | "accepted" | "declined" | "withdrawn";
  createdAt: Date;
};

export type CustomerQuoteGroup = {
  requestId: number;
  quoteSubmissionDeadline: Date | null;
  quoteSelectedAt: Date | null;
  providerAcceptanceDeadline: Date | null;
  providerAcceptedAt: Date | null;
  quotes: CustomerQuote[];
};

export function CustomerQuotePanel({
  group,
  isEnglish,
  acceptingQuoteId,
  nowMs,
  onAccept,
  compact = false,
}: {
  group?: CustomerQuoteGroup;
  isEnglish: boolean;
  acceptingQuoteId: number | null;
  nowMs: number;
  onAccept: (quote: CustomerQuote) => void;
  compact?: boolean;
}) {
  const [sortBy, setSortBy] = useState<"price" | "duration" | "newest">("price");
  const [maxPrice, setMaxPrice] = useState("");
  const [maxDays, setMaxDays] = useState("");

  const quotes = (group?.quotes ?? []).filter((quote) => quote.status !== "declined" && quote.status !== "withdrawn");
  const selected = quotes.find((quote) => quote.status === "selected" || quote.status === "accepted");
  const lowestPrice = quotes.length ? Math.min(...quotes.map((quote) => Number(quote.priceAmount))) : 0;
  const fastestDays = quotes.length ? Math.min(...quotes.map((quote) => quote.durationDays)) : 0;

  const visibleQuotes = useMemo(() => {
    const priceLimit = Number(maxPrice);
    const dayLimit = Number(maxDays);
    return [...quotes]
      .filter((quote) => (!maxPrice || Number(quote.priceAmount) <= priceLimit) && (!maxDays || quote.durationDays <= dayLimit))
      .sort((a, b) =>
        sortBy === "price"
          ? Number(a.priceAmount) - Number(b.priceAmount)
          : sortBy === "duration"
            ? a.durationDays - b.durationDays
            : Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)),
      );
  }, [maxDays, maxPrice, quotes, sortBy]);

  if (!quotes.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[#cde3fa] bg-[#f8fbff] p-5 text-sm text-[#60778f]">
        <HandCoins className="mb-2 h-5 w-5 text-[#0878f9]" />
        {isEnglish ? "No price quotes have been submitted yet." : "لم تصل عروض أسعار بعد."}
      </div>
    );
  }

  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-lg font-extrabold text-[#17334f]">{isEnglish ? "Price quotes" : "عروض الأسعار"}</p>
          <p className="mt-1 text-xs text-[#60778f]">{isEnglish ? "Compare providers by price and turnaround time." : "قارن مقدمي الخدمة حسب السعر ومدة الإنجاز."}</p>
        </div>
        {group?.quoteSelectedAt && !group.providerAcceptedAt ? (
          <DeadlineIndicator deadline={group.providerAcceptanceDeadline} nowMs={nowMs} isEnglish={isEnglish} label={isEnglish ? "Provider acceptance" : "قبول مقدم الخدمة"} compact />
        ) : !group?.quoteSelectedAt ? (
          <DeadlineIndicator deadline={group?.quoteSubmissionDeadline} nowMs={nowMs} isEnglish={isEnglish} label={isEnglish ? "Quotes close" : "إغلاق العروض"} compact />
        ) : null}
      </div>

      <div className="mt-4 grid overflow-hidden rounded-2xl border border-[#d8e6f5] bg-white shadow-[0_10px_30px_rgba(31,91,151,.06)] sm:grid-cols-3">
        <div className="flex items-center gap-3 border-b border-[#e7eff8] px-4 py-3 sm:border-b-0 sm:border-l">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf3ff] text-[#0878f9]"><HandCoins className="h-4 w-4" /></span>
          <div><p className="text-[11px] font-bold text-[#72879a]">{isEnglish ? "Available quotes" : "العروض المتاحة"}</p><p className="mt-0.5 text-lg font-black text-[#17334f]">{quotes.length}</p></div>
        </div>
        <div className="flex items-center gap-3 border-b border-[#e7eff8] px-4 py-3 sm:border-b-0 sm:border-l">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#effbf4] text-[#238457]"><Sparkles className="h-4 w-4" /></span>
          <div><p className="text-[11px] font-bold text-[#72879a]">{isEnglish ? "Lowest price" : "أقل سعر"}</p><p className="mt-0.5 text-lg font-black text-[#17334f]">{lowestPrice.toLocaleString(isEnglish ? "en-US" : "ar-SA")} <span className="text-[11px]">{isEnglish ? "SAR" : "ر.س"}</span></p></div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#fff6e8] text-[#d98500]"><Clock3 className="h-4 w-4" /></span>
          <div><p className="text-[11px] font-bold text-[#72879a]">{isEnglish ? "Fastest delivery" : "أسرع إنجاز"}</p><p className="mt-0.5 text-lg font-black text-[#17334f]">{fastestDays} <span className="text-[11px]">{isEnglish ? "days" : "يوم"}</span></p></div>
        </div>
      </div>

      <div className={`mt-4 grid min-w-0 gap-4 ${compact ? "xl:grid-cols-[190px_minmax(0,1fr)]" : "lg:grid-cols-[220px_minmax(0,1fr)]"}`}>
        <aside className="h-fit rounded-2xl border border-[#dce8f6] bg-[#f8fbff] p-3 lg:sticky lg:top-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#17334f]"><SlidersHorizontal className="h-4 w-4 text-[#0878f9]" />{isEnglish ? "Sort & filter" : "الفرز والتصفية"}</div>
          <label className="mb-1 block text-[11px] font-bold text-[#60778f]">{isEnglish ? "Sort by" : "الترتيب"}</label>
          <Select value={sortBy} onValueChange={(value: "price" | "duration" | "newest") => setSortBy(value)}>
            <SelectTrigger className="h-10 rounded-xl bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="price">{isEnglish ? "Lowest price" : "الأقل سعرًا"}</SelectItem>
              <SelectItem value="duration">{isEnglish ? "Fastest delivery" : "الأسرع إنجازًا"}</SelectItem>
              <SelectItem value="newest">{isEnglish ? "Newest" : "الأحدث"}</SelectItem>
            </SelectContent>
          </Select>
          <label className="mb-1 mt-3 block text-[11px] font-bold text-[#60778f]">{isEnglish ? "Maximum price" : "الحد الأعلى للسعر"}</label>
          <Input type="number" min="1" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder={isEnglish ? "Any price" : "أي سعر"} className="h-10 rounded-xl bg-white" />
          <label className="mb-1 mt-3 block text-[11px] font-bold text-[#60778f]">{isEnglish ? "Maximum days" : "الحد الأعلى للأيام"}</label>
          <Input type="number" min="1" value={maxDays} onChange={(event) => setMaxDays(event.target.value)} placeholder={isEnglish ? "Any duration" : "أي مدة"} className="h-10 rounded-xl bg-white" />
          <div className="mt-3 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#60778f]"><span>{isEnglish ? "Results" : "النتائج"}</span><Badge className="rounded-full bg-[#eaf3ff] text-[#0878f9]">{visibleQuotes.length}/{quotes.length}</Badge></div>
        </aside>

        {visibleQuotes.length ? (
          <div className="min-w-0 space-y-3">
            {visibleQuotes.map((quote) => {
              const accepted = quote.status === "accepted";
              const waiting = quote.status === "selected";
              const isLowest = Number(quote.priceAmount) === lowestPrice;
              const isFastest = quote.durationDays === fastestDays;
              return (
                <article key={quote.id} className={`overflow-hidden rounded-2xl border bg-white shadow-[0_8px_26px_rgba(34,83,130,.07)] ${accepted ? "border-[#8fd2a4]" : waiting ? "border-[#efcb7d]" : "border-[#dce8f6]"}`}>
                  <div className={`grid min-w-0 ${compact ? "2xl:grid-cols-[minmax(0,1fr)_150px_190px]" : "lg:grid-cols-[minmax(0,1fr)_150px_190px]"}`}>
                    <div className="min-w-0 p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#eaf3ff] text-[#0878f9]"><UserRound className="h-5 w-5" /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2"><p className="min-w-0 truncate font-extrabold text-[#17334f]"><span className="text-[#60778f]">{quote.providerRole === "agent" ? (isEnglish ? "Transaction specialist" : "المعقّب") : (isEnglish ? "Employee" : "الموظف")}:</span> {quote.providerName}</p>{accepted ? <Badge className="bg-[#2e8b57] text-white">{isEnglish ? "Accepted" : "تم الاستلام"}</Badge> : waiting ? <Badge className="bg-[#d99800] text-white">{isEnglish ? "Awaiting confirmation" : "بانتظار التأكيد"}</Badge> : null}</div>
                          {quote.note ? <p className="mt-3 line-clamp-2 text-xs leading-6 text-[#60778f]">{quote.note}</p> : <p className="mt-3 text-xs text-[#91a1b1]">{isEnglish ? "No additional note" : "لا توجد ملاحظة إضافية"}</p>}
                          <div className="mt-3 flex flex-wrap gap-2">{isLowest ? <Badge className="rounded-full bg-[#e9f8ef] text-[#238457]">{isEnglish ? "Lowest price" : "الأقل سعرًا"}</Badge> : null}{isFastest ? <Badge className="rounded-full bg-[#fff3dc] text-[#b66e00]">{isEnglish ? "Fastest" : "الأسرع"}</Badge> : null}</div>
                        </div>
                      </div>
                    </div>

                    <div className={`flex items-center justify-between gap-3 border-t border-[#e7eff8] bg-[#fbfdff] px-4 py-3 ${compact ? "2xl:block 2xl:border-r 2xl:border-t-0 2xl:px-4 2xl:py-5 2xl:text-center" : "lg:block lg:border-r lg:border-t-0 lg:px-4 lg:py-5 lg:text-center"}`}>
                      <p className="text-[11px] font-bold text-[#72879a]">{isEnglish ? "Turnaround" : "مدة الإنجاز"}</p>
                      <p className="mt-1 text-xl font-black text-[#17334f]">{quote.durationDays} <span className="text-xs">{isEnglish ? "days" : "يوم"}</span></p>
                      <time className="mt-2 block text-[10px] font-bold text-[#8a9bad]">{new Date(quote.createdAt).toLocaleDateString(isEnglish ? "en-US" : "ar-SA")}</time>
                    </div>

                    <div className={`border-t px-4 py-4 ${compact ? "2xl:border-r 2xl:border-t-0" : "lg:border-r lg:border-t-0"} ${accepted ? "bg-[#effbf3]" : waiting ? "bg-[#fff8e7]" : "bg-[#eef9f8]"}`}>
                      <p className="text-[11px] font-bold text-[#60778f]">{isEnglish ? "Total quote" : "قيمة العرض"}</p>
                      <p className="mt-1 text-2xl font-black text-[#102a43]">{Number(quote.priceAmount).toLocaleString(isEnglish ? "en-US" : "ar-SA")} <span className="text-xs">{isEnglish ? "SAR" : "ر.س"}</span></p>
                      {!selected && quote.status === "submitted" ? (
                        <Button type="button" disabled={acceptingQuoteId !== null} onClick={() => onAccept(quote)} className="mt-3 h-10 w-full rounded-xl bg-[#f5a623] font-extrabold text-white shadow-[0_4px_0_#d98b0b] hover:bg-[#e99913]">
                          {acceptingQuoteId === quote.id ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="ml-2 h-4 w-4" />}
                          {isEnglish ? "Choose quote" : "اعتماد العرض"}
                        </Button>
                      ) : <div className="mt-3 rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-center text-xs font-extrabold text-[#60778f]">{accepted ? (isEnglish ? "Provider confirmed" : "أكد مقدم الخدمة") : waiting ? (isEnglish ? "Waiting for provider" : "بانتظار مقدم الخدمة") : (isEnglish ? "Quote closed" : "العرض مغلق")}</div>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="rounded-2xl bg-[#fff8e8] p-6 text-center text-sm font-bold text-[#916000]">{isEnglish ? "No quotes match these filters." : "لا توجد عروض مطابقة للفلاتر."}</p>
        )}
      </div>
    </section>
  );
}
