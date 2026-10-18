import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { amountToHalalas, halalasToAmount, normalizeMoneyInput, summarizeFinanceEntries } from "@shared/finance";
import { filterFinanceEntries, type FinancePeriod } from "@shared/financePeriod";
import { FinancePeriodFilter } from "./FinancePeriodFilter";
import { ArrowDown, ArrowUp, ChevronDown, CircleDollarSign, FileClock, Loader2, Plus, RefreshCw, RotateCcw, WalletCards } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type EntryKind = "collection" | "cost";

type FinanceEntry = {
  id: number;
  requestId: number;
  reference: string;
  category: string;
  kind: EntryKind;
  amount: string;
  note: string | null;
  occurredAt: number;
  createdAt: number;
  voidedAt: number | null;
  voidReason: string | null;
};

type FinanceRequest = {
  requestId: number;
  reference: string;
  category: string;
  status: string;
  priceAmount: string | null;
};

export type AgentFinancePanelProps = {
  isEnglish: boolean;
  requestId?: number;
};

const MAX_HALALAS = BigInt(9_999_999_999);

function createClientKey() {
  return crypto.randomUUID();
}

export function validateLedgerAmount(value: string) {
  const amount = normalizeMoneyInput(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) return { amount, error: "format" as const };
  try {
    const halalas = amountToHalalas(amount);
    if (halalas <= BigInt(0) || halalas > MAX_HALALAS) return { amount, error: "range" as const };
    return { amount, error: null };
  } catch {
    return { amount, error: "format" as const };
  }
}

export function localDateTimeValue(timestamp = Date.now()) {
  const local = new Date(timestamp - new Date(timestamp).getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function validateOccurredAt(value: string, now = Date.now()) {
  const occurredAt = new Date(value).getTime();
  if (!Number.isFinite(occurredAt)) return { occurredAt: null, error: "invalid" as const };
  if (occurredAt > now) return { occurredAt: null, error: "future" as const };
  return { occurredAt, error: null };
}

export function entryFingerprint(input: { requestId: number; kind: EntryKind; amount: string; occurredAt: number; note?: string }) {
  return JSON.stringify([input.requestId, input.kind, input.amount, input.occurredAt, input.note ?? ""]);
}

function displayAmount(amount: string) {
  try {
    return halalasToAmount(amountToHalalas(amount));
  } catch {
    return amount;
  }
}

function SummaryMetric({ label, amount, tone = "blue" }: { label: string; amount: string; tone?: "blue" | "red" | "green" }) {
  const color = tone === "red" ? "text-[#a23b3b]" : tone === "green" ? "text-[#238457]" : "text-[#0878f9]";
  return <div className="rounded-xl border border-[#dce8f6] bg-[#fbfdff] p-3"><dt className="text-[11px] font-bold text-[#60778f]">{label}</dt><dd className={`mt-1 font-display text-lg font-black tabular-nums ${color}`} dir="ltr"><bdi>{displayAmount(amount)} SAR</bdi></dd></div>;
}

export function AgentFinancePanel({ isEnglish, requestId }: AgentFinancePanelProps) {
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [period, setPeriod] = useState<FinancePeriod>(() => ({ mode: "all", startMs: null, endExclusiveMs: null, month: "", from: "", to: "" }));
  const [selectedRequestId, setSelectedRequestId] = useState(requestId ? String(requestId) : "");
  const [kind, setKind] = useState<EntryKind>("collection");
  const [amount, setAmount] = useState("");
  const [occurredAtInput, setOccurredAtInput] = useState(() => localDateTimeValue());
  const [note, setNote] = useState("");
  const [clientKey, setClientKey] = useState("");
  const [clientKeyFingerprint, setClientKeyFingerprint] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveBusyRef = useRef(false);
  const [entryToVoid, setEntryToVoid] = useState<FinanceEntry | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const query = trpc.agentFinance.mine.useQuery();
  const utils = trpc.useUtils();
  const addEntry = trpc.agentFinance.addEntry.useMutation();
  const voidEntry = trpc.agentFinance.voidEntry.useMutation();
  const data = query.data;

  const availableRequests = useMemo(() => {
    const requests = (data?.requests ?? []) as FinanceRequest[];
    return requestId ? requests.filter(request => request.requestId === requestId) : requests;
  }, [data?.requests, requestId]);

  useEffect(() => {
    if (requestId) {
      setSelectedRequestId(String(requestId));
    } else if (!selectedRequestId && availableRequests[0]) {
      setSelectedRequestId(String(availableRequests[0].requestId));
    }
  }, [availableRequests, requestId, selectedRequestId]);

  const selectedId = Number(selectedRequestId);
  const requestEntries = useMemo(() => ((data?.entries ?? []) as FinanceEntry[]).filter(entry => !requestId || entry.requestId === requestId).sort((first, second) => second.occurredAt - first.occurredAt || second.createdAt - first.createdAt), [data?.entries, requestId]);
  const scopedEntries = useMemo(() => filterFinanceEntries(requestEntries, period), [requestEntries, period]);
  const scopedRequest = requestId ? availableRequests[0] : availableRequests.find(request => request.requestId === selectedId);
  const scopedSummary = data ? summarizeFinanceEntries(scopedEntries) : null;
  const canAdd = Boolean(data && !query.isError && scopedRequest && Number.isInteger(selectedId) && !addEntry.isPending && !isSaving);

  const text = isEnglish
    ? {
        title: requestId ? "Request cash ledger" : "My cash ledger",
        subtitle: "Cash-basis operational record from the agent's own entries; it has not been audited and is not a payment channel.",
        collected: period.mode === "all" ? "Collected" : "Collected in period",
        costs: period.mode === "all" ? "Costs" : "Costs in period",
        net: period.mode === "all" ? "Net profit by entries" : "Net profit in period",
        estimate: "Quoted values are estimates only and are not collected automatically.",
        open: "Open ledger",
        close: "Close ledger",
        loading: "Loading ledger…",
        loadError: "Could not load the ledger. Entry is unavailable until it loads.",
        retry: "Retry",
        choose: "Choose request",
        type: "Entry type",
        collection: "Collection",
        cost: "Cost",
        amount: "Amount (SAR)",
        date: "Date and time",
        note: "Note (optional)",
        notePlaceholder: "Brief internal note…",
        add: "Add entry",
        adding: "Saving…",
        noRequests: "No active or completed requests are available for an entry.",
        requestEstimate: "Quoted value · estimate only",
        noQuote: "No quoted value",
        history: "Entries",
        noEntries: period.mode === "all" ? "No entries recorded yet." : "No entries in this period.",
        void: "Void entry",
        voided: "Voided",
        voidReason: "Void reason",
        voidReasonPlaceholder: "State why this entry is being voided…",
        voidConfirmTitle: "Void this entry?",
        voidConfirmText: "This keeps the entry and its reason in the ledger, but excludes it from totals. It cannot be deleted here.",
        cancel: "Cancel",
        confirmVoid: "Void entry",
        voiding: "Voiding…",
        saved: "Entry saved.",
        savedDuplicate: "This entry was already saved.",
        voidedToast: "Entry voided and retained in the ledger.",
        amountFormat: "Enter a positive amount with up to 2 decimal places.",
        amountRange: "Amount must be from 0.01 to 99,999,999.99.",
        dateInvalid: "Enter a valid date and time.",
        futureDate: "A future date cannot be recorded.",
        selectRequest: "Select a request before adding an entry.",
        quoteDisclaimer: "The quoted value below remains an estimate, not a collection.",
        entryFailed: "Could not save the entry. Your fields were kept so you can retry.",
        voidFailed: "Could not void the entry. Please retry.",
        reasonRequired: "Enter at least 3 characters before voiding the entry.",
        created: "Recorded",
        occurred: "Occurred",
        paymentWarning: "No payment is processed and no official receipt is issued here.",
      }
    : {
        title: requestId ? "سجل القيود للطلب" : "سجل قيودي النقدي",
        subtitle: "سجل نقدي تشغيلي مبني على ما سجله المعقب ولم يُدقق؛ ليس قناة دفع.",
        collected: period.mode === "all" ? "المحصّل" : "المحصّل في الفترة",
        costs: period.mode === "all" ? "التكاليف" : "التكاليف في الفترة",
        net: period.mode === "all" ? "صافي الربح حسب القيود" : "صافي الربح في الفترة",
        estimate: "قيم العروض تقديرات وليست تحصيلًا تلقائيًا.",
        open: "فتح السجل",
        close: "إغلاق السجل",
        loading: "جارٍ تحميل السجل…",
        loadError: "تعذر تحميل السجل. لا يمكن إدخال قيد حتى يتم تحميله.",
        retry: "إعادة المحاولة",
        choose: "اختر الطلب",
        type: "نوع القيد",
        collection: "تحصيل",
        cost: "تكلفة",
        amount: "المبلغ (ر.س)",
        date: "التاريخ والوقت",
        note: "ملاحظة (اختيارية)",
        notePlaceholder: "ملاحظة داخلية مختصرة…",
        add: "إضافة قيد",
        adding: "جارٍ الحفظ…",
        noRequests: "لا توجد طلبات نشطة أو مكتملة متاحة لإضافة قيد.",
        requestEstimate: "قيمة العرض · تقدير فقط",
        noQuote: "لا توجد قيمة عرض",
        history: "القيود",
        noEntries: period.mode === "all" ? "لا توجد قيود مسجلة بعد." : "لا توجد قيود ضمن هذه الفترة.",
        void: "تعطيل القيد",
        voided: "معطّل",
        voidReason: "سبب التعطيل",
        voidReasonPlaceholder: "اذكر بوضوح سبب تعطيل القيد…",
        voidConfirmTitle: "تعطيل هذا القيد؟",
        voidConfirmText: "سيبقى القيد وسببه ظاهرين في السجل، لكنه سيُستبعد من الإجماليات. لا يمكن حذفه من هنا.",
        cancel: "إلغاء",
        confirmVoid: "تعطيل القيد",
        voiding: "جارٍ التعطيل…",
        saved: "تم حفظ القيد.",
        savedDuplicate: "هذا القيد محفوظ مسبقًا.",
        voidedToast: "تم تعطيل القيد مع الاحتفاظ به في السجل.",
        amountFormat: "أدخل مبلغًا موجبًا بمنزلتين عشريتين كحد أقصى.",
        amountRange: "يجب أن يكون المبلغ بين 0.01 و99,999,999.99.",
        dateInvalid: "أدخل تاريخًا ووقتًا صحيحين.",
        futureDate: "لا يمكن تسجيل تاريخ مستقبلي.",
        selectRequest: "اختر طلبًا قبل إضافة القيد.",
        quoteDisclaimer: "قيمة العرض أدناه تبقى تقديرًا وليست تحصيلًا.",
        entryFailed: "تعذر حفظ القيد. احتُفظ بالحقول لتتمكن من إعادة المحاولة.",
        voidFailed: "تعذر تعطيل القيد. حاول مرة أخرى.",
        reasonRequired: "أدخل سببًا واضحًا من 3 أحرف على الأقل قبل تعطيل القيد.",
        created: "سُجل",
        occurred: "تاريخ القيد",
        paymentWarning: "لا تتم معالجة أي دفعة ولا يصدر أي إيصال رسمي هنا.",
      };

  const submitEntry = async () => {
    if (saveBusyRef.current || addEntry.isPending || !canAdd) return;
    const checkedAmount = validateLedgerAmount(amount);
    if (checkedAmount.error === "format") return toast.error(text.amountFormat);
    if (checkedAmount.error === "range") return toast.error(text.amountRange);
    const checkedDate = validateOccurredAt(occurredAtInput);
    if (checkedDate.error === "invalid") return toast.error(text.dateInvalid);
    if (checkedDate.error === "future") return toast.error(text.futureDate);
    if (!scopedRequest || !checkedDate.occurredAt) return toast.error(text.selectRequest);

    const normalizedNote = note.trim();
    const fingerprint = entryFingerprint({ requestId: scopedRequest.requestId, kind, amount: checkedAmount.amount, occurredAt: checkedDate.occurredAt, note: normalizedNote || undefined });
    const keyForPayload = clientKeyFingerprint === fingerprint && clientKey ? clientKey : createClientKey();
    if (clientKeyFingerprint !== fingerprint) {
      setClientKey(keyForPayload);
      setClientKeyFingerprint(fingerprint);
    }
    saveBusyRef.current = true;
    setIsSaving(true);
    try {
      const result = await addEntry.mutateAsync({ requestId: scopedRequest.requestId, kind, amount: checkedAmount.amount, occurredAt: checkedDate.occurredAt, note: normalizedNote || undefined, clientKey: keyForPayload });
      toast.success(result.duplicate ? text.savedDuplicate : text.saved);
      setAmount("");
      setNote("");
      setOccurredAtInput(localDateTimeValue());
      setClientKey("");
      setClientKeyFingerprint(null);
      await utils.agentFinance.mine.invalidate();
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : text.entryFailed);
    } finally {
      saveBusyRef.current = false;
      setIsSaving(false);
    }
  };

  const confirmVoid = async () => {
    if (!entryToVoid || voidEntry.isPending) return;
    const reason = voidReason.trim();
    if (reason.length < 3) return toast.error(text.reasonRequired);
    try {
      await voidEntry.mutateAsync({ entryId: entryToVoid.id, reason });
      toast.success(text.voidedToast);
      setEntryToVoid(null);
      setVoidReason("");
      await utils.agentFinance.mine.invalidate();
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : text.voidFailed);
    }
  };

  const netTone = scopedSummary && amountToHalalas(scopedSummary.netProfit) < BigInt(0) ? "red" : "green";
  return (
    <section className="mt-5 rounded-2xl border border-[#cde3fa] bg-white p-4 shadow-[0_8px_26px_rgba(31,91,151,.05)] sm:p-5" dir={isEnglish ? "ltr" : "rtl"} aria-label={text.title}>
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eaf3ff] text-[#0878f9]"><WalletCards className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="font-display text-base font-black text-[#17334f]">{text.title}</h2><p className="mt-1 text-xs leading-5 text-[#60778f]">{text.subtitle}</p></div></div>
      {query.isLoading ? <div role="status" className="grid min-h-28 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[#0878f9]" /><span className="sr-only">{text.loading}</span></div> : query.isError || !data ? <div role="alert" className="mt-4 rounded-xl border border-[#f1c6ca] bg-[#fff7f7] p-4 text-sm text-[#9e3540]"><p>{text.loadError}</p><Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()} className="mt-3 border-[#e5b5bb] text-[#9e3540]"><RefreshCw className="me-1 h-3.5 w-3.5" />{text.retry}</Button></div> : <>
        <FinancePeriodFilter period={period} isEnglish={isEnglish} onApply={setPeriod} />
        {scopedSummary ? <dl className="mt-4 grid gap-2 sm:grid-cols-3"><SummaryMetric label={text.collected} amount={scopedSummary.totalCollected} /><SummaryMetric label={text.costs} amount={scopedSummary.totalCosts} tone="red" /><SummaryMetric label={text.net} amount={scopedSummary.netProfit} tone={netTone} /></dl> : null}
        <p className="mt-3 text-[11px] leading-5 text-[#70859b]">{text.estimate} {text.paymentWarning}</p>
        <Collapsible open={ledgerOpen} onOpenChange={setLedgerOpen}>
          <button type="button" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#b7dbff] bg-[#f7fbff] px-3 text-sm font-black text-[#0878f9] transition-colors hover:bg-[#eaf3ff]" onClick={() => setLedgerOpen(value => !value)} aria-expanded={ledgerOpen} aria-controls="agent-finance-ledger"><FileClock className="h-4 w-4" />{ledgerOpen ? text.close : text.open}<ChevronDown className={`h-4 w-4 transition-transform ${ledgerOpen ? "rotate-180" : ""}`} /></button>
          <CollapsibleContent id="agent-finance-ledger">
            <div className="mt-4 border-t border-[#e7eff8] pt-4">
              {availableRequests.length ? <div className="rounded-xl border border-[#dce8f6] bg-[#f8fbff] p-3 sm:p-4">
                <div className="grid gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-xs font-bold text-[#405d78]" htmlFor="finance-request">{text.choose}</label>{requestId ? <div id="finance-request" className="min-h-10 rounded-lg border border-[#dce8f6] bg-white px-3 py-2 text-sm font-bold text-[#17334f]">{scopedRequest?.reference} · {scopedRequest?.category}</div> : <Select value={selectedRequestId} onValueChange={setSelectedRequestId} disabled={isSaving}><SelectTrigger id="finance-request" className="h-10 rounded-lg bg-white"><SelectValue placeholder={text.choose} /></SelectTrigger><SelectContent>{availableRequests.map(request => <SelectItem key={request.requestId} value={String(request.requestId)}>{request.reference} · {request.category}</SelectItem>)}</SelectContent></Select>}</div><div><span className="mb-1 block text-xs font-bold text-[#405d78]">{text.type}</span><div className="grid grid-cols-2 gap-2"><Button type="button" variant={kind === "collection" ? "default" : "outline"} disabled={isSaving} onClick={() => setKind("collection")} className={`h-10 rounded-lg ${kind === "collection" ? "bg-[#0878f9] text-white" : "border-[#cde3fa] text-[#31516e]"}`}><ArrowDown className="me-1 h-4 w-4" />{text.collection}</Button><Button type="button" variant={kind === "cost" ? "default" : "outline"} disabled={isSaving} onClick={() => setKind("cost")} className={`h-10 rounded-lg ${kind === "cost" ? "bg-[#a35a35] text-white" : "border-[#cde3fa] text-[#31516e]"}`}><ArrowUp className="me-1 h-4 w-4" />{text.cost}</Button></div></div></div>
                {scopedRequest ? <div className="mt-3 rounded-lg border border-[#cfe3fb] bg-white px-3 py-2 text-[11px] leading-5 text-[#60778f]"><strong className="text-[#17334f]">{text.requestEstimate}: </strong><span dir="ltr">{scopedRequest.priceAmount === null ? text.noQuote : `${displayAmount(scopedRequest.priceAmount)} SAR`}</span><span className="ms-1">{text.quoteDisclaimer}</span></div> : null}
                <div className="mt-3 grid gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-xs font-bold text-[#405d78]" htmlFor="finance-amount">{text.amount}</label><Input id="finance-amount" inputMode="decimal" value={amount} disabled={isSaving} onChange={event => setAmount(event.target.value)} onBlur={() => { const value = normalizeMoneyInput(amount); if (value !== amount) setAmount(value); }} placeholder="0.00" className="h-10 rounded-lg bg-white text-start tabular-nums" dir="ltr" /></div><div><label className="mb-1 block text-xs font-bold text-[#405d78]" htmlFor="finance-occurred-at">{text.date}</label><Input id="finance-occurred-at" type="datetime-local" max={localDateTimeValue()} value={occurredAtInput} disabled={isSaving} onChange={event => setOccurredAtInput(event.target.value)} className="h-10 rounded-lg bg-white" /></div></div>
                <label className="mt-3 block text-xs font-bold text-[#405d78]" htmlFor="finance-note">{text.note}</label><Textarea id="finance-note" value={note} disabled={isSaving} onChange={event => setNote(event.target.value)} maxLength={500} placeholder={text.notePlaceholder} className="mt-1 min-h-18 rounded-lg bg-white text-sm" />
                <Button type="button" disabled={!canAdd || isSaving} onClick={() => void submitEntry()} className="mt-3 h-10 w-full rounded-lg bg-[#0878f9] font-extrabold text-white"><Plus className="me-1 h-4 w-4" />{addEntry.isPending ? text.adding : text.add}</Button>
              </div> : <p className="rounded-xl bg-[#f7fbff] p-4 text-center text-sm text-[#70859b]">{text.noRequests}</p>}
              <div className="mt-4"><div className="flex items-center gap-2"><CircleDollarSign className="h-4 w-4 text-[#0878f9]" /><h3 className="text-sm font-black text-[#17334f]">{text.history}</h3><Badge variant="outline" className="ms-auto border-[#dce8f6] text-[#60778f]">{scopedEntries.length}</Badge></div><div className="mt-2 space-y-2">{scopedEntries.length ? scopedEntries.map(entry => <article key={entry.id} className={`rounded-xl border p-3 ${entry.voidedAt === null ? "border-[#dce8f6] bg-white" : "border-[#e4d8d8] bg-[#fcfaf9] opacity-80"}`}><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`text-xs font-black ${entry.kind === "collection" ? "text-[#0878f9]" : "text-[#a35a35]"}`}>{entry.kind === "collection" ? text.collection : text.cost}</span>{entry.voidedAt !== null ? <Badge className="bg-[#f6e7e7] text-[#9e3540]">{text.voided}</Badge> : null}</div><p className="mt-1 truncate text-xs font-bold text-[#405d78]">{entry.reference} · {entry.category}</p></div><strong className={`text-sm tabular-nums ${entry.kind === "collection" ? "text-[#0878f9]" : "text-[#a35a35]"}`} dir="ltr">{displayAmount(entry.amount)} SAR</strong></div>{entry.note ? <p className="mt-2 break-words text-xs leading-5 text-[#60778f]">{entry.note}</p> : null}<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#7b91a8]"><span>{text.occurred}: {new Date(entry.occurredAt).toLocaleString(isEnglish ? "en-US" : "ar-SA")}</span><span>{text.created}: {new Date(entry.createdAt).toLocaleString(isEnglish ? "en-US" : "ar-SA")}</span>{entry.voidedAt !== null && entry.voidReason ? <span className="font-bold text-[#9e3540]">{text.voidReason}: {entry.voidReason}</span> : null}</div>{entry.voidedAt === null ? <Button type="button" variant="ghost" size="sm" onClick={() => { setEntryToVoid(entry); setVoidReason(""); }} className="mt-2 h-8 px-2 text-xs text-[#a23b3b]"><RotateCcw className="me-1 h-3.5 w-3.5" />{text.void}</Button> : null}</article>) : <p className="rounded-xl bg-[#f7fbff] p-4 text-center text-sm text-[#70859b]">{text.noEntries}</p>}</div></div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </>}
      <AlertDialog open={Boolean(entryToVoid)} onOpenChange={open => { if (!open && !voidEntry.isPending) { setEntryToVoid(null); setVoidReason(""); } }}><AlertDialogContent dir={isEnglish ? "ltr" : "rtl"} className="rounded-2xl border-[#dce8f6] bg-white"><AlertDialogHeader><AlertDialogTitle className="font-display font-black text-[#17334f]">{text.voidConfirmTitle}</AlertDialogTitle><AlertDialogDescription className="leading-6 text-[#60778f]">{text.voidConfirmText}</AlertDialogDescription></AlertDialogHeader><label className="text-xs font-bold text-[#405d78]" htmlFor="finance-void-reason">{text.voidReason}</label><Textarea id="finance-void-reason" value={voidReason} onChange={event => setVoidReason(event.target.value)} maxLength={500} placeholder={text.voidReasonPlaceholder} className="min-h-20 rounded-lg" /><AlertDialogFooter><AlertDialogCancel disabled={voidEntry.isPending} className="rounded-lg">{text.cancel}</AlertDialogCancel><AlertDialogAction disabled={voidEntry.isPending || voidReason.trim().length < 3} onClick={event => { event.preventDefault(); void confirmVoid(); }} className="rounded-lg bg-[#a23b3b] text-white hover:bg-[#8e303c]">{voidEntry.isPending ? text.voiding : text.confirmVoid}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </section>
  );
}
