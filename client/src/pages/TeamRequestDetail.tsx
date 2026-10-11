import { useAuth } from "@/_core/hooks/useAuth";
import { DeadlineIndicator } from "@/components/DeadlineIndicator";
import { RequestConversation } from "@/components/RequestConversation";
import { RequestReviewPanel } from "@/components/RequestReviewPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowRight, ChevronLeft, ChevronRight, ClipboardList, HandCoins, Home, Loader2, ShieldCheck, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

const statuses = ["received", "in_review", "in_progress", "completed"] as const;
const statusLabels = { received: "تم الاستلام", in_review: "قيد المراجعة", in_progress: "قيد التنفيذ", completed: "مكتمل" } as const;

export default function TeamRequestDetail() {
  const { requestId = "" } = useParams<{ requestId: string }>();
  const id = Number(requestId);
  const { user, loading } = useAuth({ redirectOnUnauthenticated: false });
  const [, setLocation] = useLocation();
  const isAgent = user?.role === "agent";
  const isEmployee = user?.role === "employee";
  const isTeam = Boolean(isAgent || isEmployee);
  const agentRequests = trpc.agents.myAssignments.useQuery(undefined, { enabled: isAgent });
  const employeeRequests = trpc.employees.myAssignments.useQuery(undefined, { enabled: isEmployee });
  const openRequests = trpc.quotes.openRequests.useQuery(undefined, { enabled: isTeam, refetchInterval: 20_000, refetchIntervalInBackground: false });
  const account = trpc.staffAccounts.me.useQuery(undefined, { enabled: isTeam });
  const utils = trpc.useUtils();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [quoteNote, setQuoteNote] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("received");
  const [message, setMessage] = useState("");

  const assignedRequests = (isAgent ? agentRequests.data : employeeRequests.data) ?? [];
  const assignedRequest = assignedRequests.find((request) => request.id === id);
  const openRequest = openRequests.data?.find((request) => request.id === id);
  const currentRequest = assignedRequest ?? openRequest;
  const backPath = isAgent ? "/agent-dashboard" : "/employee-dashboard";
  const navigationRequests = [...(assignedRequest ? assignedRequests : openRequests.data ?? [])].sort((a, b) => b.id - a.id);
  const currentIndex = navigationRequests.findIndex((request) => request.id === id);
  const previousRequest = currentIndex >= 0 ? navigationRequests[currentIndex + 1] : undefined;
  const nextRequest = currentIndex > 0 ? navigationRequests[currentIndex - 1] : undefined;
  const isLoading = loading || agentRequests.isLoading || employeeRequests.isLoading || openRequests.isLoading || account.isLoading;

  useEffect(() => { const timer = window.setInterval(() => setNowMs(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (openRequest?.myQuote) {
      setPrice(openRequest.myQuote.priceAmount);
      setDuration(String(openRequest.myQuote.durationDays));
      setQuoteNote(openRequest.myQuote.note ?? "");
    }
  }, [openRequest?.myQuote]);
  useEffect(() => { if (assignedRequest) setStatus(assignedRequest.status); }, [assignedRequest]);

  const submitQuote = trpc.quotes.submit.useMutation({ onSuccess: async (result) => { toast.success(result.updated ? "تم تحديث عرضك." : "تم إرسال عرضك للعميل."); await utils.quotes.openRequests.invalidate(); } });
  const withdrawQuote = trpc.quotes.withdraw.useMutation({ onSuccess: async () => { toast.success("تم سحب العرض."); await utils.quotes.openRequests.invalidate(); } });
  const acceptSelected = trpc.quotes.providerAccept.useMutation({ onSuccess: async () => { toast.success("تم تأكيد استلام الطلب وإشعار العميل."); await Promise.all([utils.agents.myAssignments.invalidate(), utils.employees.myAssignments.invalidate(), utils.quotes.openRequests.invalidate()]); } });
  const agentUpdate = trpc.agents.addUpdate.useMutation({ onSuccess: async () => { toast.success("تم حفظ التحديث وتوثيقه."); setMessage(""); await utils.agents.myAssignments.invalidate(); } });
  const employeeUpdate = trpc.employees.updateAssignment.useMutation({ onSuccess: async () => { toast.success("تم تحديث الحالة وتوثيقها."); setMessage(""); await utils.employees.myAssignments.invalidate(); } });

  if (isLoading) return <main className="grid min-h-screen place-items-center bg-[#f4f9ff]"><Loader2 className="h-8 w-8 animate-spin text-[#0878f9]" /></main>;
  if (!user || !isTeam) return <main dir="rtl" className="grid min-h-screen w-full max-w-[100vw] place-items-center overflow-x-hidden bg-[#f4f9ff] p-4"><div className="mx-auto w-[calc(100vw-2rem)] max-w-md rounded-3xl bg-white p-8 text-center shadow-xl max-sm:-translate-x-8"><h1 className="font-display text-2xl font-black">يلزم دخول فريق التشغيل</h1><Button onClick={() => setLocation("/team-login")} className="mt-5 w-full rounded-xl bg-[#0878f9] text-white">فتح صفحة الدخول</Button></div></main>;
  if (!Number.isInteger(id) || !currentRequest) return <main dir="rtl" className="grid min-h-screen w-full max-w-[100vw] place-items-center overflow-x-hidden bg-[#f4f9ff] p-4"><div className="mx-auto w-[calc(100vw-2rem)] max-w-lg rounded-3xl bg-white p-8 text-center shadow-xl max-sm:-translate-x-8"><h1 className="font-display text-2xl font-black">الطلب غير متاح</h1><p className="mt-3 text-sm leading-7 text-[#60778f]">قد تكون مهلة العروض انتهت، أو أن الطلب غير مسند إلى حسابك.</p><Button onClick={() => setLocation(backPath)} className="mt-5 rounded-xl bg-[#0878f9] text-white">العودة إلى بوابة الفريق</Button></div></main>;

  const title = `${currentRequest.category}${currentRequest.subcategory ? ` — ${currentRequest.subcategory}` : ""}`;
  const submitCurrentQuote = () => {
    const priceAmount = Number(price);
    const durationDays = Number(duration);
    if (!Number.isFinite(priceAmount) || priceAmount <= 0) return toast.error("أدخل سعرًا صحيحًا أكبر من صفر.");
    if (!Number.isInteger(durationDays) || durationDays < 1) return toast.error("أدخل مدة إنجاز صحيحة بالأيام.");
    submitQuote.mutate({ requestId: id, priceAmount, durationDays, note: quoteNote.trim() || undefined });
  };
  const saveAssignedUpdate = () => {
    if (!assignedRequest) return;
    if (isAgent) agentUpdate.mutate({ requestId: id, status, message: message.trim() || undefined });
    else employeeUpdate.mutate({ requestId: id, status, message: message.trim() || undefined });
  };

  return (
    <main className="min-h-screen bg-[#f4f9ff]" dir="rtl">
      <header className="border-b border-[#dce8f6] bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4"><div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0878f9]"><ShieldCheck className="h-5 w-5" /></span><div className="min-w-0"><p className="font-display truncate text-lg font-black text-[#102a43]">صفحة الطلب</p><p className="text-xs text-[#60778f]">{isAgent ? "بوابة المعقبين" : "بوابة الموظفين"}</p></div></div><Button variant="outline" onClick={() => setLocation(backPath)} className="rounded-xl border-[#b7dbff] bg-white text-[#0878f9]"><ArrowRight className="ml-2 h-4 w-4" />العودة</Button></div></header>
      <div className="mx-auto max-w-5xl px-4 py-7 sm:py-10">
        <nav aria-label="مسار التنقل" className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold text-[#60778f]"><button type="button" onClick={() => setLocation(backPath)} className="inline-flex items-center gap-1 transition-colors hover:text-[#0878f9]"><Home className="h-3.5 w-3.5" />بوابة الفريق</button><ChevronLeft className="h-3.5 w-3.5 text-[#9bb0c3]" /><button type="button" onClick={() => setLocation(backPath)} className="transition-colors hover:text-[#0878f9]">{assignedRequest ? "طلباتك الموكلة" : "طلبات العملاء الجديدة"}</button><ChevronLeft className="h-3.5 w-3.5 text-[#9bb0c3]" /><span className="text-[#17334f]">طلب رقم {id}</span></nav>
        <div className="mb-4 flex items-center justify-between gap-3"><Button type="button" variant="outline" disabled={!previousRequest} onClick={() => previousRequest && setLocation(`/team-request/${previousRequest.id}`)} className="rounded-xl border-[#cde3fa] bg-white text-[#31516e]"><ChevronRight className="ml-1 h-4 w-4" />الطلب السابق</Button><span className="text-xs font-bold text-[#8a9bad]">{currentIndex >= 0 ? `${currentIndex + 1} من ${navigationRequests.length}` : ""}</span><Button type="button" variant="outline" disabled={!nextRequest} onClick={() => nextRequest && setLocation(`/team-request/${nextRequest.id}`)} className="rounded-xl border-[#cde3fa] bg-white text-[#31516e]">الطلب التالي<ChevronLeft className="mr-1 h-4 w-4" /></Button></div>
        <section className="overflow-hidden rounded-3xl border border-[#dce8f6] bg-white shadow-[0_16px_40px_rgba(31,91,151,.08)]">
          <div className="grid gap-5 border-b border-[#e7eff8] bg-[#f8fbff] p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-7"><div><p className="text-xs font-black tracking-[.12em] text-[#0878f9]">طلب رقم {id}</p><h1 className="font-display mt-2 text-2xl font-black text-[#17334f]">{title}</h1><p className="mt-3 whitespace-pre-wrap text-sm leading-8 text-[#405d78]">{currentRequest.details}</p></div><Badge className={`w-fit rounded-full px-4 py-2 ${assignedRequest ? "bg-[#e9f8ef] text-[#238457]" : "bg-[#eaf3ff] text-[#0878f9]"}`}>{assignedRequest ? statusLabels[assignedRequest.status] : "مفتوح للعروض"}</Badge></div>

          {openRequest ? <div className="p-5 sm:p-7"><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]"><div><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#eaf3ff] text-[#0878f9]"><HandCoins className="h-5 w-5" /></span><div><h2 className="font-display text-xl font-black text-[#17334f]">تقديم عرض السعر</h2><p className="mt-1 text-xs text-[#60778f]">عرض واحد قابل للتعديل أو السحب قبل اعتماد العميل.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Input type="number" min="1" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className="rounded-xl bg-white" placeholder="السعر بالريال" /><Input type="number" min="1" step="1" value={duration} onChange={(event) => setDuration(event.target.value)} className="rounded-xl bg-white" placeholder="مدة الإنجاز بالأيام" /></div><Textarea value={quoteNote} onChange={(event) => setQuoteNote(event.target.value)} className="mt-3 min-h-28 rounded-xl bg-white" placeholder="ملاحظة مختصرة للعميل…" /><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Button disabled={submitQuote.isPending} onClick={submitCurrentQuote} className="h-11 flex-1 rounded-xl bg-[#0878f9] font-extrabold text-white">{submitQuote.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <HandCoins className="ml-2 h-4 w-4" />}{openRequest.myQuote ? "تحديث العرض" : "إرسال العرض"}</Button>{openRequest.myQuote ? <Button type="button" variant="outline" disabled={withdrawQuote.isPending} onClick={() => { if (window.confirm("سحب عرض السعر قبل اعتماد العميل؟")) withdrawQuote.mutate({ requestId: id }); }} className="h-11 rounded-xl border-[#f0caca] text-[#a23b3b]"><Undo2 className="ml-2 h-4 w-4" />سحب العرض</Button> : null}</div></div><aside className="rounded-2xl border border-[#dce8f6] bg-[#f8fbff] p-4"><p className="text-xs font-black text-[#60778f]">مهلة استقبال العروض</p><DeadlineIndicator deadline={openRequest.quoteSubmissionDeadline} nowMs={nowMs} isEnglish={false} label="إغلاق السوق" /><div className="mt-4 rounded-xl bg-white p-3 text-xs font-bold leading-6 text-[#60778f]">اسم العميل محجوب حتى اعتماد عرضك، وتبقى بيانات التواصل مخفية دائمًا.</div><div className="mt-3 flex items-center justify-between rounded-xl bg-white px-3 py-2"><span className="text-xs text-[#60778f]">العروض الحالية</span><strong className="text-[#17334f]">{openRequest.quoteCount}</strong></div></aside></div></div> : null}

          {assignedRequest ? <div className="p-5 sm:p-7"><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]"><div><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#eff9f1] text-[#3b8e55]"><ClipboardList className="h-5 w-5" /></span><div><h2 className="font-display text-xl font-black text-[#17334f]">إدارة تنفيذ الطلب</h2><p className="mt-1 text-xs text-[#60778f]">العميل: <strong className="text-[#17334f]">{assignedRequest.requesterName}</strong></p></div></div>{assignedRequest.quoteSelectedAt && !assignedRequest.providerAcceptedAt ? <div className="mt-5 rounded-2xl border border-[#f1cf86] bg-[#fff9e9] p-4"><DeadlineIndicator deadline={assignedRequest.providerAcceptanceDeadline} nowMs={nowMs} isEnglish={false} label="مهلة قبول الطلب" /><p className="mt-2 text-xs leading-6 text-[#806b3f]">أكد الاستلام ليصل إشعار للعميل وتُفتح أدوات التحديث.</p><Button type="button" disabled={acceptSelected.isPending} onClick={() => acceptSelected.mutate({ requestId: id })} className="mt-3 h-11 w-full rounded-xl bg-[#0878f9] font-extrabold text-white">تأكيد استلام الطلب</Button></div> : <div className="mt-5 grid gap-3"><Select value={status} onValueChange={(value: (typeof statuses)[number]) => setStatus(value)}><SelectTrigger className="h-11 rounded-xl border-[#c8daec] bg-white"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((item) => <SelectItem key={item} value={item}>{statusLabels[item]}</SelectItem>)}</SelectContent></Select>{account.data?.permissions.canAddCustomerUpdate ? <Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="اكتب تحديثًا واضحًا يظهر للعميل…" className="min-h-28 rounded-xl border-[#c8daec] bg-white" /> : null}<Button disabled={agentUpdate.isPending || employeeUpdate.isPending || !account.data?.permissions.canUpdateStatus} onClick={saveAssignedUpdate} className="h-11 rounded-xl bg-[#0878f9] font-extrabold text-white">حفظ التحديث</Button></div>}</div><aside className="rounded-2xl border border-[#dce8f6] bg-[#f8fbff] p-4"><p className="text-xs font-black text-[#60778f]">ملخص الطلب</p><dl className="mt-3 space-y-3 text-sm"><div className="flex items-center justify-between gap-3"><dt className="text-[#60778f]">الحالة</dt><dd className="font-black text-[#17334f]">{statusLabels[assignedRequest.status]}</dd></div><div className="flex items-center justify-between gap-3"><dt className="text-[#60778f]">آخر تحديث</dt><dd className="font-bold text-[#17334f]">{new Date(assignedRequest.updatedAt).toLocaleDateString("ar-SA")}</dd></div></dl></aside></div>{assignedRequest.providerAcceptedAt ? <RequestConversation requestId={id} isEnglish={false} mode="team" /> : null}<RequestReviewPanel requestId={id} status={assignedRequest.status} review={assignedRequest.review} isEnglish={false} mode="readonly" /></div> : null}
        </section>
      </div>
    </main>
  );
}
