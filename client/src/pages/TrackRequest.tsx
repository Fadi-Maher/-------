import { Badge } from "@/components/ui/badge";
import { LanguageToggle } from "@/components/LanguageToggle";
import { CustomerNotificationCenter } from "@/components/CustomerNotificationCenter";
import { CustomerQuotePanel, type CustomerQuote, type CustomerQuoteGroup } from "@/components/CustomerQuotePanel";
import { RequestConversation } from "@/components/RequestConversation";
import { RequestReviewPanel } from "@/components/RequestReviewPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCircle2, Clock3, Download, FileCheck2, FileText, HandCoins, Loader2, Paperclip, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

const statusLabels = { received: "تم الاستلام", in_review: "قيد المراجعة", in_progress: "قيد التنفيذ", completed: "مكتمل" } as const;
const statusLabelsEn = { received: "Received", in_review: "Under review", in_progress: "In progress", completed: "Completed" } as const;
const demoOtp = "123456";
const demoDurationSeconds = 5 * 60;
const demoMaxAttempts = 5;

type PhoneRequest = {
  id: number;
  category: string;
  subcategory: string | null;
  status: keyof typeof statusLabels;
  updatedAt: Date;
  review: { rating: number; reviewText: string | null; providerName: string; createdAt: Date } | null;
  updates: Array<{
    id: number;
    message: string;
    status: keyof typeof statusLabels | null;
    senderType: "owner" | "customer" | "employee" | "agent" | "system";
    senderName: string | null;
    createdAt: Date;
    attachments: Array<{ id: number; fileName: string; fileUrl: string }>;
  }>;
};

type DisplayUpdate = Omit<PhoneRequest["updates"][number], "id"> & { id: number | string };
function normalizeSaudiPhone(value: string) {
  const compact = value.replace(/[\s-]/g, "");
  if (/^05\d{8}$/.test(compact)) return compact;
  if (/^5\d{8}$/.test(compact)) return `0${compact}`;
  if (/^\+9665\d{8}$/.test(compact)) return `0${compact.slice(4)}`;
  if (/^009665\d{8}$/.test(compact)) return `0${compact.slice(5)}`;
  return null;
}

export default function TrackRequest() {
  const { isEnglish } = useLanguage();
  const isDemoMode = new URLSearchParams(window.location.search).get("demo") === "1";
  const [step, setStep] = useState<"phone" | "verify" | "results">("phone");
  const [phoneInput, setPhoneInput] = useState(() => new URLSearchParams(window.location.search).get("phone") || "");
  const [phone, setPhone] = useState("");
  const [demoCodeInput, setDemoCodeInput] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [demoError, setDemoError] = useState(false);
  const [demoAttempts, setDemoAttempts] = useState(0);
  const [demoSecondsLeft, setDemoSecondsLeft] = useState(demoDurationSeconds);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const demoBlocked = demoSecondsLeft === 0 || demoAttempts >= demoMaxAttempts;
  const verifyPhoneDemo = trpc.requests.verifyPhoneDemo.useMutation();
  const phoneTracking = trpc.requests.trackByPhoneVerified.useQuery(
    { accessToken },
    { enabled: step === "results" && accessToken.length > 0, retry: false },
  );
  const utils = trpc.useUtils();
  const quoteOffers = trpc.quotes.customerList.useQuery(
    { accessToken },
    { enabled: step === "results" && accessToken.length > 0, retry: false, refetchInterval: 20_000, refetchIntervalInBackground: false },
  );
  const acceptQuote = trpc.quotes.accept.useMutation({
    onSuccess: async (result) => {
      toast.success(isEnglish ? `You selected ${result.providerName}.` : `تم اعتماد عرض ${result.providerName}.`);
      await Promise.all([utils.quotes.customerList.invalidate(), utils.requests.trackByPhoneVerified.invalidate()]);
    },
    onError: (error) => toast.error(error.message),
  });
  const activeStatusLabels = isEnglish ? statusLabelsEn : statusLabels;
  const demoMinutes = Math.floor(demoSecondsLeft / 60).toString().padStart(2, "0");
  const demoSeconds = (demoSecondsLeft % 60).toString().padStart(2, "0");

  useEffect(() => {
    if (step !== "verify" || demoBlocked) return;
    const timer = window.setInterval(() => setDemoSecondsLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [step, demoBlocked]);

  useEffect(() => {
    if (step !== "results") return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [step]);

  const startVerification = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeSaudiPhone(phoneInput);
    if (!normalized) {
      setDemoError(true);
      return;
    }
    setPhone(normalized);
    setDemoCodeInput("");
    setDemoError(false);
    setStep("verify");
  };

  const verifyDemoCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (demoBlocked) return;
    setDemoAttempts((attempts) => attempts + 1);
    if (demoCodeInput !== demoOtp) {
      setDemoError(true);
      window.setTimeout(() => setDemoError(false), 500);
      return;
    }
    try {
      const result = await verifyPhoneDemo.mutateAsync({ phone, code: demoCodeInput });
      setAccessToken(result.accessToken);
      setDemoError(false);
      setStep("results");
    } catch {
      setDemoError(true);
      window.setTimeout(() => setDemoError(false), 500);
    }
  };

  const resetDemo = () => {
    setStep("phone");
    setPhoneInput("");
    setPhone("");
    setAccessToken("");
    setDemoCodeInput("");
    setDemoError(false);
    setDemoAttempts(0);
    setDemoSecondsLeft(demoDurationSeconds);
  };

  const requests = (phoneTracking.data ?? []) as PhoneRequest[];
  const quoteGroups = (quoteOffers.data ?? []) as CustomerQuoteGroup[];

  return (
    <main className="min-h-screen bg-[#f5f9ff] text-[#102a43]" dir={isEnglish ? "ltr" : "rtl"}>
      <header className="border-b border-[#dce8f6] bg-white">
        <div className="container flex min-h-[72px] items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2.5" aria-label={isEnglish ? "Maalamati home" : "معاملاتي، الصفحة الرئيسية"}>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0878f9] text-white"><FileCheck2 className="h-5 w-5" /></span>
            <span className="font-display text-xl font-extrabold tracking-[-0.075em] text-[#102a43]">{isEnglish ? "Maalamati" : "معاملاتي"}</span>
          </a>
          <div className="flex items-center gap-3"><LanguageToggle /><a href="/" className="inline-flex items-center gap-2 rounded-xl border border-[#dce8f6] px-4 py-2 text-sm font-bold text-[#31516e] transition-colors hover:border-[#0878f9] hover:text-[#0878f9]"><ArrowRight className={`h-4 w-4 ${isEnglish ? "rotate-180" : ""}`} />{isEnglish ? "Home" : "الرئيسية"}</a></div>
        </div>
      </header>

      {step === "results" && accessToken ? <CustomerNotificationCenter accessToken={accessToken} onNewNotification={() => { void utils.quotes.customerList.invalidate(); void utils.requests.trackByPhoneVerified.invalidate(); }} /> : null}

      <section className="app-grid overflow-hidden bg-[#eef7ff] py-14 sm:py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <span className="section-kicker">{isEnglish ? "Track your requests" : "تتبع طلباتك"}</span>
            <h1 className="font-display mt-4 text-3xl font-extrabold leading-[1.45] tracking-[-0.065em] sm:text-5xl">
              {isEnglish ? <>All your requests<br /><span className="text-[#0878f9]">in one place.</span></> : <>جميع طلباتك<br /><span className="text-[#0878f9]">في شاشة واحدة.</span></>}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-[#60778f]">
              {isEnglish ? "Enter your mobile number, verify it, and view every request linked to your customer record." : "أدخل رقم جوالك، تحقق منه، وشاهد جميع الطلبات المرتبطة بسجل العميل."}
            </p>

            {step === "phone" && (
              <form onSubmit={startVerification} className="portal-shadow mx-auto mt-8 flex max-w-2xl flex-col gap-3 rounded-2xl border border-[#dce8f6] bg-white p-3 sm:flex-row">
                <Input required value={phoneInput} onChange={(event) => { setPhoneInput(event.target.value); setDemoError(false); }} placeholder={isEnglish ? "05X XXX XXXX" : "05X XXX XXXX"} dir="ltr" className="h-12 flex-1 border-0 bg-[#f7fbff] text-left shadow-none focus-visible:ring-0" aria-label={isEnglish ? "Mobile number" : "رقم الجوال"} />
                <Button type="submit" className="h-12 rounded-xl bg-[#0878f9] px-6 text-sm font-extrabold text-white hover:bg-[#0668d9]">{isEnglish ? "Continue to verification" : "المتابعة إلى التحقق"}</Button>
              </form>
            )}

            {step === "verify" && (
              <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-[#b7dbff] bg-white p-5 text-left shadow-[0_12px_40px_rgba(8,120,249,0.10)]" dir="ltr">
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#25d366] text-lg font-black text-white">W</span><div><p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#0878f9]">WhatsApp demo</p><p className="mt-1 text-sm font-bold text-[#102a43]">{isEnglish ? "Verification for your mobile number" : "تحقق من رقم جوالك"}</p></div></div>
                <div className="mt-4 rounded-xl bg-[#f2fff6] p-4"><p className="text-sm leading-6 text-[#31516e]">{isEnglish ? "Your Maalamati verification code is:" : "رمز التحقق التجريبي لمعاملاتي هو:"}</p><p className="mt-2 text-2xl font-black tracking-[.35em] text-[#102a43]">{demoOtp}</p><p className="mt-2 text-xs text-[#60778f]">{isEnglish ? `Expires in ${demoMinutes}:${demoSeconds} · ${demoMaxAttempts - demoAttempts} attempts left` : `ينتهي خلال ${demoMinutes}:${demoSeconds} · تبقت ${demoMaxAttempts - demoAttempts} محاولات`}</p></div>
                <form onSubmit={verifyDemoCode} className="mt-4 flex flex-col gap-3"><InputOTP maxLength={6} value={demoCodeInput} onChange={(value) => { setDemoCodeInput(value.replace(/\D/g, "").slice(0, 6)); setDemoError(false); }} disabled={demoBlocked} aria-label={isEnglish ? "Enter six-digit demo verification code" : "أدخل رمز التحقق التجريبي المكون من ست خانات"} containerClassName={`justify-start ${demoError ? "otp-shake" : ""}`} className="gap-2" dir="ltr"><InputOTPGroup>{[0, 1, 2, 3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} className="h-12 w-11 rounded-xl border-[#b7dbff] bg-[#f7fbff] text-lg font-black text-[#102a43] first:border-l last:border-r data-[active=true]:border-[#0878f9] data-[active=true]:ring-[#0878f9]/20 sm:h-14 sm:w-12" />)}</InputOTPGroup></InputOTP><div className="flex flex-col gap-2 sm:flex-row"><Button type="submit" disabled={demoBlocked || demoCodeInput.length !== 6} className="h-11 rounded-xl bg-[#0878f9] px-5 text-sm font-extrabold text-white hover:bg-[#0668d9] disabled:cursor-not-allowed disabled:opacity-60">{isEnglish ? "Verify and view requests" : "تحقق واعرض الطلبات"}</Button><Button type="button" variant="outline" onClick={resetDemo} className="h-11 rounded-xl border-[#b7dbff] bg-white px-4 text-xs font-bold text-[#0878f9] hover:bg-[#f2f8ff]">{isEnglish ? "Use another number" : "استخدام رقم آخر"}</Button></div></form>
                {demoError && <p role="alert" className="mt-3 rounded-xl bg-[#fff1f3] px-3 py-2 text-xs font-bold leading-6 text-[#a9323f]">{isEnglish ? "The code is incorrect. Enter all six digits shown above and try again." : "الرمز غير صحيح. أدخل الخانات الست الظاهرة أعلاه ثم حاول مرة أخرى."}</p>}
                {demoBlocked && <p className="mt-3 text-xs font-bold text-[#a35a00]">{demoSecondsLeft === 0 ? (isEnglish ? "The demo code has expired. Use another number to restart." : "انتهت صلاحية الرمز التجريبي. استخدم رقمًا آخر لإعادة المحاولة.") : (isEnglish ? "Demo attempts are exhausted. Use another number to restart." : "استُنفدت محاولات التجربة. استخدم رقمًا آخر لإعادة المحاولة.")}</p>}
                <p className="mt-3 text-xs leading-5 text-[#a35a00]">{isEnglish ? "Demo only — this code was not sent by WhatsApp and must never be used for real authentication." : "للاختبار فقط — لم يُرسل هذا الرمز عبر واتساب ولا يُستخدم للتحقق الحقيقي."}</p>
              </div>
            )}

            {step === "results" && (
              <div className="mx-auto mt-8 max-w-4xl text-left" dir={isEnglish ? "ltr" : "rtl"}>
                <div className="mb-5 flex flex-col justify-between gap-3 rounded-2xl border border-[#b7dbff] bg-white p-5 shadow-[0_12px_40px_rgba(8,120,249,0.08)] sm:flex-row sm:items-center"><div><p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#0878f9]">{isEnglish ? "Verified customer" : "عميل تم التحقق منه"}</p><h2 className="font-display mt-2 text-xl font-extrabold">{isEnglish ? "Your request history" : "سجل طلباتك"}</h2><p className="mt-1 text-sm text-[#60778f]">{isEnglish ? `Requests linked to ${phone}` : `الطلبات المرتبطة بالرقم ${phone}`}</p></div><Button type="button" variant="outline" onClick={resetDemo} className="rounded-xl border-[#b7dbff] bg-white text-xs font-bold text-[#0878f9]">{isEnglish ? "Track another number" : "تتبع رقمًا آخر"}</Button></div>
                {phoneTracking.isLoading && <div className="soft-card flex items-center gap-3 p-6 text-sm text-[#60778f]"><Loader2 className="h-5 w-5 animate-spin text-[#0878f9]" />{isEnglish ? "Finding your requests…" : "يتم البحث عن طلباتك…"}</div>}
                {phoneTracking.isError && <div className="rounded-2xl border border-[#ffd1d5] bg-[#fff4f5] p-6 text-sm leading-7 text-[#a9323f]">{isEnglish ? "We could not load your requests. Please try again." : "تعذر تحميل طلباتك. حاول مرة أخرى."}</div>}
                {!phoneTracking.isLoading && !phoneTracking.isError && requests.length === 0 && <div className="rounded-2xl border border-[#dce8f6] bg-white p-8 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-[#0878f9]" /><h3 className="font-display mt-4 text-lg font-extrabold">{isEnglish ? "No requests found for this number." : "لا توجد طلبات مسجلة لهذا الرقم."}</h3><p className="mt-2 text-sm leading-7 text-[#60778f]">{isEnglish ? "Submit a request first, then return with the same mobile number." : "أرسل طلبًا أولًا، ثم عد باستخدام رقم الجوال نفسه."}</p></div>}
                <div className="space-y-3">{requests.map((request: PhoneRequest) => { const group = quoteGroups.find((item) => item.requestId === request.id); const updates: DisplayUpdate[] = request.updates.length ? request.updates : [{ id: `status-${request.id}`, message: isEnglish ? `Current request status: ${statusLabelsEn[request.status as keyof typeof statusLabelsEn]}.` : `الحالة الحالية لطلبك: ${statusLabels[request.status as keyof typeof statusLabels]}.`, status: request.status, createdAt: request.updatedAt, attachments: [], senderType: "system", senderName: null }]; return <details key={request.id} className="group portal-shadow overflow-hidden rounded-2xl border border-[#dce8f6] bg-white"><summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-4 bg-white p-4 text-start transition-colors hover:bg-[#f7fbff] sm:p-5 [&::-webkit-details-marker]:hidden"><div><p className="text-xs font-extrabold tracking-[.13em] text-[#0878f9]">{isEnglish ? "REQUEST" : "طلب"}</p><h3 className="font-display mt-3 text-xl font-extrabold">{request.category}{request.subcategory ? ` — ${request.subcategory}` : ""}</h3><p className="mt-2 text-sm text-[#60778f]">{isEnglish ? "Compare quotes, then follow updates and attachments here." : "قارن عروض الأسعار، ثم تابع التحديثات والمرفقات هنا."}</p></div><Badge className="w-fit rounded-full bg-[#0878f9] px-3 py-1.5 text-white">{activeStatusLabels[request.status as keyof typeof statusLabels]}</Badge></summary><div className="border-t border-[#e7eff8] bg-[#fbfdff] p-4 sm:p-6"><CustomerQuotePanel group={group} isEnglish={isEnglish} acceptingQuoteId={acceptQuote.isPending ? acceptQuote.variables?.quoteId ?? null : null} nowMs={nowMs} onAccept={(quote) => { if (window.confirm(isEnglish ? `Choose ${quote.providerName}'s quote for ${quote.priceAmount} SAR?` : `اعتماد عرض ${quote.providerName} بقيمة ${quote.priceAmount} ر.س؟`)) acceptQuote.mutate({ accessToken, quoteId: quote.id }); }} />{group?.providerAcceptedAt ? <RequestConversation requestId={request.id} isEnglish={isEnglish} mode="customer" accessToken={accessToken} /> : null}<RequestReviewPanel requestId={request.id} status={request.status} review={request.review} accessToken={accessToken} isEnglish={isEnglish} /><div className="mt-7 flex items-center gap-2"><FileText className="h-5 w-5 text-[#0878f9]" /><p className="font-display text-lg font-extrabold">{isEnglish ? "Update history" : "سجل التحديثات"}</p></div><div className={`mt-7 space-y-7 ${isEnglish ? "border-l-2 pl-6" : "border-r-2 pr-6"} border-[#d7eaff]`}>{updates.map((update) => <div key={update.id} className="relative"><span className={`absolute ${isEnglish ? "-left-[2.05rem]" : "-right-[2.05rem]"} top-1 grid h-5 w-5 place-items-center rounded-full border-4 border-white bg-[#0878f9]`} /><div className="flex flex-wrap items-center gap-2">{update.status && <Badge variant="outline" className="rounded-full border-[#b7dbff] text-[#0878f9]">{activeStatusLabels[update.status as keyof typeof statusLabels]}</Badge>}<time className="text-xs text-[#7b91a8]">{new Date(update.createdAt).toLocaleString(isEnglish ? "en-US" : "ar-SA")}</time></div><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#405d78]">{update.message}</p>{update.attachments?.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{update.attachments.map((attachment) => <a key={attachment.id} href={attachment.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[#dce8f6] bg-[#f7fbff] px-3 py-2 text-xs font-bold text-[#31516e] transition-colors hover:border-[#0878f9] hover:text-[#0878f9]"><Paperclip className="h-3.5 w-3.5" />{attachment.fileName}<Download className="h-3.5 w-3.5" /></a>)}</div>}</div>)}</div></div></details>; })}</div>
              </div>
            )}

            {isDemoMode && <p className="mx-auto mt-6 max-w-2xl text-xs font-bold leading-6 text-[#a35a00]">{isEnglish ? "Demo mode is active. WhatsApp is not connected, so code 123456 is displayed locally for testing." : "الوضع التجريبي مفعل. لم يتم ربط واتساب، لذلك يظهر الرمز 123456 داخل الموقع للاختبار."}</p>}
          </div>
        </div>
      </section>
    </main>
  );
}

export { normalizeSaudiPhone };
export const DEMO_CUSTOMER_OTP = demoOtp;
export const DEMO_TRACKING_OTP = demoOtp;
