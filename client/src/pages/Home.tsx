import { AppShowcaseSection } from "@/components/AppShowcaseSection";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { CustomerNotificationCenter } from "@/components/CustomerNotificationCenter";
import { WhatsAppSupportButton } from "@/components/WhatsAppSupportButton";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Textarea } from "@/components/ui/textarea";
import { CUSTOMER_SESSION_EVENT, readCustomerSession, requiredFieldMessage, saveCustomerSession } from "@/lib/customerSession";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  ArrowUpLeft,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Headphones,
  Layers3,
  Route,
  Send,
  Sparkles,
} from "lucide-react";
import { type ElementType, type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

const serviceSubcategories = ["خدمات إدارية وتشغيلية", "وثائق ومستندات أعمال", "تأسيس وتطوير الأعمال", "تنسيق مواعيد ومتابعات", "استشارة أو طلب مخصص"];
type ServiceRoute = { title: string; description: string; icon: ElementType; tone: string; action?: string; href?: string };
const individualRoutes: ServiceRoute[] = [
  { title: "تعقّب معاملة", description: "راجع حالة طلبك ورسائل فريق العمل باستخدام رقم جوالك.", icon: Route, tone: "bg-[#eaf3ff] text-[#0878f9]", action: "تعقّب المعاملات" },
  { title: "طلب خدمة", description: "أرسل احتياجك في خطوات قصيرة، ثم تابع ما يتم عليه.", icon: Send, tone: "bg-[#f2ffe0] text-[#507900]", action: "طلب خدمة" },
  { title: "مستندات وتحديثات", description: "احتفظ بالمرفقات والردود ضمن سجل الطلب نفسه.", icon: FileText, tone: "bg-[#f1efff] text-[#6250d8]", action: "تعقّب المعاملات" },
];
const businessRoutes: ServiceRoute[] = [
  { title: "خدمة تشغيلية", description: "أرسل احتياج فريقك بتفاصيل مرتبة تساعد على بدء المراجعة.", icon: BriefcaseBusiness, tone: "bg-[#f2ffe0] text-[#507900]", action: "طلب خدمة" },
  { title: "متابعة المعاملات", description: "تابع مراحل المعاملة برقم جوالك دون رسائل متفرقة.", icon: Route, tone: "bg-[#eaf3ff] text-[#0878f9]", action: "تعقّب المعاملات" },
  { title: "إدارة الطلبات", description: "للمالك: حدّث الحالة والردود والمرفقات من لوحة واحدة.", icon: ClipboardCheck, tone: "bg-[#f1efff] text-[#6250d8]", href: "/dashboard" },
];
const featuredServices = [
  { title: "تعقّب معاملة", description: "افتح مسار المتابعة وراجع آخر ما تم على طلبك.", icon: Route, tone: "bg-[#eaf3ff] text-[#0878f9]", action: "تعقّب المعاملات", label: "متابعة منظمة" },
  { title: "طلب خدمة", description: "أرسل احتياجك الإداري أو التشغيلي في نموذج واحد.", icon: Building2, tone: "bg-[#effbe1] text-[#507900]", action: "طلب خدمة", label: "ابدأ من هنا" },
  { title: "المستندات والتحديثات", description: "حافظ على الردود والمرفقات ضمن سجل طلبك.", icon: FileText, tone: "bg-[#f1efff] text-[#6250d8]", action: "تعقّب المعاملات", label: "سجل موحّد" },
  { title: "تواصل ودعم", description: "اختر وسيلة الدعم المناسبة عند الحاجة إلى مساعدة.", icon: Headphones, tone: "bg-[#fff3e7] text-[#b76410]", href: "/contact", label: "دعم معاملاتي كير" },
];

const servicePlatforms = [
  { nameAr: "أبشر", nameEn: "Absher", logo: "/manus-storage/absher_220430b7_f3bb0555.jpg", href: "https://www.absher.sa" },
  { nameAr: "ناجز", nameEn: "Najiz", logo: "/manus-storage/najiz_d82c1ae6_90d34677.png", href: "https://najiz.sa" },
  { nameAr: "بلدي", nameEn: "Balady", logo: "/manus-storage/balady_635d333c_6a1cd43d.jpg", href: "https://balady.gov.sa" },
  { nameAr: "قوى", nameEn: "Qiwa", logo: "/manus-storage/qiwa_b2b31845_420bf070.jpg", href: "https://qiwa.sa" },
  { nameAr: "هيئة الحكومة الرقمية", nameEn: "Digital Government Authority", logo: "/manus-storage/dga_f9e2226f_ce53f547.png", href: "https://dga.gov.sa" },
];

function ServicePlatforms({ isEnglish }: { isEnglish: boolean }) {
  return <section className="border-b border-[#e5eef5] bg-white py-10 sm:py-12"><div className="container"><div className="text-center"><p className="text-xs font-extrabold text-[#0878f9]">{isEnglish ? "SERVICE PLATFORMS" : "منصات وجهات خدمية"}</p><h2 className="font-display mt-2 text-xl font-extrabold text-[#17334f] sm:text-2xl">{isEnglish ? "Platforms related to the transactions we serve" : "جهات ومنصات نخدم معاملات مرتبطة بها"}</h2><p className="mx-auto mt-2 max-w-2xl text-xs leading-6 text-[#70859b]">{isEnglish ? "Logos identify common service platforms and do not imply an official partnership or endorsement." : "توضح الشعارات نطاق الخدمات الشائع، ولا تعني وجود شراكة أو اعتماد رسمي من هذه الجهات."}</p></div><div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{servicePlatforms.map((platform) => <a key={platform.nameAr} href={platform.href} target="_blank" rel="noreferrer" className="group flex min-h-28 flex-col items-center justify-center rounded-2xl border border-[#e3edf4] bg-[#fbfdff] p-4 transition-all hover:-translate-y-1 hover:border-[#a9d8ee] hover:bg-white hover:shadow-[0_12px_25px_rgba(28,104,182,.08)]"><img src={platform.logo} alt={isEnglish ? platform.nameEn : platform.nameAr} loading="lazy" className="h-12 w-full object-contain mix-blend-multiply sm:h-14" /><span className="mt-3 text-xs font-extrabold text-[#526d85] group-hover:text-[#0878f9]">{isEnglish ? platform.nameEn : platform.nameAr}</span></a>)}</div></div></section>;
}

function WhyMaalamati({ isEnglish }: { isEnglish: boolean }) {
  const items = isEnglish ? [
    { title: "Easy comparison", text: "Compare price and completion time before choosing the service provider.", icon: Layers3 },
    { title: "No scattered messages", text: "Updates, attachments and conversation stay inside one request record.", icon: FileText },
    { title: "Mobile-number tracking", text: "Verify your mobile number to review all your requests in one place.", icon: Route },
    { title: "Clear deadlines", text: "Visible quote and acceptance windows keep every step understandable.", icon: CheckCircle2 },
    { title: "Direct communication", text: "Chat with the selected provider and exchange the required files securely.", icon: Send },
    { title: "Support when needed", text: "Reach the support path whenever your request needs clarification.", icon: Headphones },
  ] : [
    { title: "مقارنة سهلة", text: "قارن السعر ومدة الإنجاز قبل اختيار المعقّب أو مقدم الخدمة الأنسب.", icon: Layers3 },
    { title: "لا رسائل متفرقة", text: "التحديثات والمرفقات والمحادثة تبقى داخل سجل طلب واحد.", icon: FileText },
    { title: "تتبّع برقم الجوال", text: "تحقق من جوالك ثم راجع جميع طلباتك في مكان واحد.", icon: Route },
    { title: "مهل زمنية واضحة", text: "عدادات عروض الأسعار وقبول الطلب تجعل كل خطوة مفهومة.", icon: CheckCircle2 },
    { title: "تواصل مباشر", text: "تحدث مع مقدم الخدمة المختار وتبادل الملفات المطلوبة بأمان.", icon: Send },
    { title: "دعم عند الحاجة", text: "انتقل إلى الدعم بسهولة عندما يحتاج طلبك إلى توضيح أو مساعدة.", icon: Headphones },
  ];
  return <section className="bg-white py-16 sm:py-24"><div className="container"><div className="mx-auto max-w-3xl text-center"><span className="section-kicker">{isEnglish ? "Why Maalamati Care" : "لماذا معاملاتي كير؟"}</span><h2 className="font-display mt-4 text-3xl font-extrabold leading-[1.35] tracking-[-0.065em] text-[#102a43] sm:text-5xl">{isEnglish ? "A clearer way to submit, compare and follow up." : "لأن طلبك يستحق مسارًا أوضح وأسهل."}</h2><p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-[#60778f]">{isEnglish ? "Maalamati Care brings service providers, offers, updates and files together so you can make an informed choice." : "يجمع معاملاتي كير مقدمي الخدمة والعروض والتحديثات والملفات، حتى تختار بوضوح وتتابع بثقة."}</p></div><div className="mt-11 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => { const Icon = item.icon; return <article key={item.title} className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#eaf6ff] text-[#0878f9]"><Icon className="h-5 w-5" /></span><div><h3 className="font-display text-lg font-extrabold text-[#17334f]">{item.title}</h3><p className="mt-2 text-sm leading-7 text-[#698098]">{item.text}</p></div></article>; })}</div></div></section>;
}
type ConfiguredField = { fieldKey: string; label: string; type: "text" | "textarea" | "tel" | "email" | "select"; placeholder?: string | null; options: string[]; isRequired: boolean };

type RequestDraft = { requesterName: string; phone: string; category: "تعقّب المعاملات" | "طلب خدمة"; subcategory?: string; details: string; customFields: Record<string, string> };
const demoOtp = "123456";
const demoOtpSeconds = 5 * 60;
const demoOtpMaxAttempts = 5;

function normalizeSaudiPhone(value: string) {
  const compact = value.replace(/[\s-]/g, "");
  if (/^05\d{8}$/.test(compact)) return compact;
  if (/^5\d{8}$/.test(compact)) return `0${compact}`;
  if (/^\+9665\d{8}$/.test(compact)) return `0${compact.slice(4)}`;
  if (/^009665\d{8}$/.test(compact)) return `0${compact.slice(5)}`;
  return null;
}

function useCustomerSession() {
  const [session, setSession] = useState<{ name: string; phone: string; accessToken: string } | null>(null);
  useEffect(() => {
    const refresh = () => setSession(readCustomerSession(localStorage));
    refresh();
    window.addEventListener(CUSTOMER_SESSION_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CUSTOMER_SESSION_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return session;
}

type ValidatedControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
function showLocalizedValidation(event: FormEvent<ValidatedControl>, isEnglish: boolean) {
  const control = event.currentTarget;
  control.setCustomValidity(requiredFieldMessage(isEnglish, control instanceof HTMLInputElement ? control.type : undefined));
}
function clearLocalizedValidation(event: FormEvent<ValidatedControl>) {
  event.currentTarget.setCustomValidity("");
}

function useLocalizedRequestValidation(isEnglish: boolean) {
  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>("#request form");
    if (!form) return;
    const onInvalid = (event: Event) => {
      const control = event.target as ValidatedControl;
      control.setCustomValidity(requiredFieldMessage(isEnglish, control instanceof HTMLInputElement ? control.type : undefined));
    };
    const onInput = (event: Event) => (event.target as ValidatedControl).setCustomValidity("");
    form.addEventListener("invalid", onInvalid, true);
    form.addEventListener("input", onInput);
    return () => {
      form.removeEventListener("invalid", onInvalid, true);
      form.removeEventListener("input", onInput);
    };
  }, [isEnglish]);
}

function DemoRequestOtp({ isEnglish, onVerified }: { isEnglish: boolean; onVerified: () => Promise<boolean> }) {
  const [code, setCode] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(demoOtpSeconds);
  const [error, setError] = useState(false);
  const [verified, setVerified] = useState(false);
  const blocked = verified || secondsLeft === 0 || attempts >= demoOtpMaxAttempts;
  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");

  useEffect(() => {
    if (verified || secondsLeft === 0) return;
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [verified, secondsLeft]);

  const verify = async () => {
    if (blocked) return;
    setAttempts((value) => value + 1);
    if (code === demoOtp) {
      const approved = await onVerified();
      if (approved) {
        setError(false);
        setVerified(true);
      } else {
        setError(true);
        window.setTimeout(() => setError(false), 500);
      }
      return;
    }
    setError(true);
    window.setTimeout(() => setError(false), 500);
  };

  const resend = () => {
    setCode("");
    setAttempts(0);
    setSecondsLeft(demoOtpSeconds);
    setError(false);
    setVerified(false);
  };

  return <div className="mt-5 rounded-2xl border border-[#b7dbff] bg-[#f7fbff] p-4 sm:p-5" dir="rtl"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#25d366] text-lg font-black text-white">W</span><div><p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#0878f9]">WhatsApp demo</p><p className="mt-1 text-sm font-extrabold text-[#17334f]">{isEnglish ? "Verify your phone before approving the request" : "تحقق من جوالك قبل اعتماد الطلب"}</p></div></div><div className="mt-4 rounded-xl bg-[#effff5] p-3"><p className="text-xs leading-6 text-[#405d78]">{isEnglish ? "Your demo verification code is:" : "رمز التحقق التجريبي هو:"}</p><p className="mt-1 text-2xl font-black tracking-[.35em] text-[#102a43]" dir="ltr">{demoOtp}</p><p className="mt-1 text-xs text-[#60778f]">{isEnglish ? `Expires in ${minutes}:${seconds} · ${demoOtpMaxAttempts - attempts} attempts left` : `ينتهي خلال ${minutes}:${seconds} · تبقت ${demoOtpMaxAttempts - attempts} محاولات`}</p></div><div className="mt-4 flex flex-col gap-3"><InputOTP maxLength={6} value={code} onChange={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))} disabled={blocked} aria-label={isEnglish ? "Enter the six-digit demo verification code" : "أدخل رمز التحقق التجريبي المكون من ست خانات"} containerClassName={`justify-start ${error ? "otp-shake" : ""}`} className="gap-2" dir="ltr"><InputOTPGroup>{[0, 1, 2, 3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} className="h-11 w-10 rounded-xl border-[#b7dbff] bg-white text-lg font-black text-[#102a43] first:border-l last:border-r data-[active=true]:border-[#0878f9] data-[active=true]:ring-[#0878f9]/20 sm:h-12 sm:w-11" />)}</InputOTPGroup></InputOTP><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => { void verify(); }} disabled={blocked || code.length !== 6} className="h-10 rounded-xl bg-[#0878f9] px-4 text-xs font-extrabold text-white hover:bg-[#0668d9] disabled:opacity-60">{isEnglish ? "Approve after verification" : "اعتماد الطلب بعد التحقق"}</Button><Button type="button" variant="outline" onClick={resend} className="h-10 rounded-xl border-[#b7dbff] bg-white px-4 text-xs font-bold text-[#0878f9]">{isEnglish ? "Resend demo code" : "إعادة إرسال الرمز التجريبي"}</Button></div></div>{verified && <p className="otp-success-pop mt-3 flex items-center gap-2 rounded-xl bg-[#effff5] px-3 py-3 text-xs font-bold leading-6 text-[#17824b]"><CheckCircle2 className="h-4 w-4 shrink-0" />{isEnglish ? "Verified. Your request is being approved and added to the customer list." : "تم التحقق. جارٍ اعتماد طلبك وإضافتك إلى قائمة العملاء."}</p>}{!verified && error && <p role="alert" className="mt-3 rounded-xl bg-[#fff1f3] px-3 py-2 text-xs font-bold leading-6 text-[#a9323f]">{isEnglish ? "The code is incorrect. Enter all six digits from the demo message." : "الرمز غير صحيح. أدخل الخانات الست الظاهرة في الرسالة التجريبية."}</p>}{!verified && blocked && <p className="mt-3 text-xs font-bold leading-6 text-[#a35a00]">{secondsLeft === 0 ? (isEnglish ? "The demo code expired. Resend it to continue." : "انتهت صلاحية الرمز التجريبي. أعد إرساله للمتابعة.") : (isEnglish ? "Attempts are exhausted. Resend the demo code to continue." : "استُنفدت المحاولات. أعد إرسال الرمز التجريبي للمتابعة.")}</p>}<p className="mt-3 text-xs leading-5 text-[#a35a00]">{isEnglish ? "Demo only — no real WhatsApp message was sent." : "للاختبار فقط — لم تُرسل أي رسالة واتساب حقيقية."}</p></div>;
}

function CustomRequestFields({ fields, values, onChange }: { fields: ConfiguredField[]; values: Record<string, string>; onChange: (fieldKey: string, value: string) => void }) {
  const { isEnglish } = useLanguage();
  if (fields.length === 0) return null;

  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      {fields.map((field) => (
        <label key={field.fieldKey} className={`text-sm font-bold text-[#17334f] ${field.type === "textarea" ? "sm:col-span-2" : ""}`}>
          {field.label}{field.isRequired && <span className="mr-1 text-[#0878f9]">*</span>}
          {field.type === "textarea" ? <Textarea required={field.isRequired} value={values[field.fieldKey] || ""} onInvalid={(event) => showLocalizedValidation(event, isEnglish)} onInput={clearLocalizedValidation} onChange={(event) => onChange(field.fieldKey, event.target.value)} placeholder={field.placeholder || undefined} className="mt-2 min-h-28 rounded-xl border-[#c8daec] bg-white px-3 py-3 text-sm shadow-none" /> : field.type === "select" ? <select required={field.isRequired} value={values[field.fieldKey] || ""} onInvalid={(event) => showLocalizedValidation(event, isEnglish)} onInput={clearLocalizedValidation} onChange={(event) => onChange(field.fieldKey, event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#c8daec] bg-white px-3 text-sm outline-none focus:border-[#0878f9]"><option value="">{isEnglish ? "Select an option" : "اختر خيارًا"}</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select> : <Input required={field.isRequired} type={field.type} value={values[field.fieldKey] || ""} onInvalid={(event) => showLocalizedValidation(event, isEnglish)} onInput={clearLocalizedValidation} onChange={(event) => onChange(field.fieldKey, event.target.value)} placeholder={field.placeholder || undefined} className="mt-2 h-11 rounded-xl border-[#c8daec] bg-white" />}
        </label>
      ))}
    </div>
  );
}

function RequestSuccessNotice({ visible, isEnglish }: { visible: boolean; isEnglish: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-x-4 top-20 z-[80] mx-auto max-w-md" role="status" aria-live="polite" dir={isEnglish ? "ltr" : "rtl"}>
      <div className="overflow-hidden rounded-2xl border border-[#b9e5cc] bg-white p-4 shadow-[0_20px_55px_rgba(20,92,57,.22)] sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e8faef] text-[#17824b]"><CheckCircle2 className="h-6 w-6" /></span>
          <div className="min-w-0">
            <p className="font-display text-base font-extrabold text-[#123d2a]">{isEnglish ? "Request created successfully" : "تم إنشاء طلبك بنجاح"}</p>
            <p className="mt-1 text-sm leading-6 text-[#4f6f61]">{isEnglish ? "You are signed in. Taking you to My Requests now…" : "تم تسجيل دخولك. سننقلك الآن إلى صفحة طلباتي…"}</p>
          </div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#dff3e7]"><span className="request-success-progress block h-full rounded-full bg-[#24a865]" /></div>
      </div>
    </div>
  );
}

function HomeEnglish() {
  const customerSession = useCustomerSession();
  useLocalizedRequestValidation(true);
  const [audience, setAudience] = useState<"individual" | "business">("individual");
  const [submitted, setSubmitted] = useState(false);
  const [successRedirecting, setSuccessRedirecting] = useState(false);
  const [submittedPhone, setSubmittedPhone] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [serviceSubcategory, setServiceSubcategory] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [pendingRequest, setPendingRequest] = useState<RequestDraft | null>(null);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const settings = trpc.settings.publicConfig.useQuery();
  const submitRequest = trpc.requests.create.useMutation();
  const submitCustomerRequest = trpc.requests.createForCustomer.useMutation();
  const verifyCustomer = trpc.requests.verifyPhoneDemo.useMutation();
  const routes = audience === "individual"
    ? [
        { title: "Track a transaction", description: "Review your request status and team messages through one clear record.", icon: Route, tone: "bg-[#eaf3ff] text-[#0878f9]", action: "track" },
        { title: "Request a service", description: "Share what you need in a few steps, then follow the work in one place.", icon: Send, tone: "bg-[#f2ffe0] text-[#507900]", action: "service" },
        { title: "Files and updates", description: "Keep attachments and replies together in the same request record.", icon: FileText, tone: "bg-[#f1efff] text-[#6250d8]", action: "track" },
      ]
    : [
        { title: "Operational support", description: "Send your team's request with the detail needed for an orderly review.", icon: BriefcaseBusiness, tone: "bg-[#f2ffe0] text-[#507900]", action: "service" },
        { title: "Transaction follow-up", description: "Follow each stage through one record rather than scattered messages.", icon: Route, tone: "bg-[#eaf3ff] text-[#0878f9]", action: "track" },
        { title: "Documents and records", description: "Keep key files, replies, and updates easy to revisit when needed.", icon: FileText, tone: "bg-[#f1efff] text-[#6250d8]", action: "track" },
      ];

  const chooseService = (service: "track" | "service") => {
    setServiceType(service);
    if (service !== "service") setServiceSubcategory("");
    document.getElementById("request")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const category = form.get("category") === "service" ? "طلب خدمة" : "تعقّب المعاملات";
    const subcategory = String(form.get("subcategory") || "") || undefined;
    const details = String(form.get("details") || "");
    if (customerSession) {
      try {
        await submitCustomerRequest.mutateAsync({ accessToken: customerSession.accessToken, category, subcategory, details });
        setSubmittedPhone(customerSession.phone);
        setSubmitted(true);
        formElement.reset();
        setServiceType("");
        setServiceSubcategory("");
        toast.success("Your request was added directly to your account.");
      } catch (error) {
        toast.error(error instanceof Error && error.message ? error.message : "We could not save your request right now. Please try again.");
      }
      return;
    }
    const phone = normalizeSaudiPhone(String(form.get("phone") || ""));
    if (!phone) {
      toast.error("Enter a valid Saudi mobile number, for example 05X XXX XXXX.");
      return;
    }
    setPendingRequest({ requesterName: String(form.get("name") || "").trim(), phone, category, subcategory, details, customFields: customValues });
    setSubmitted(false);
    setVerificationOpen(true);
    toast.info("A demo WhatsApp verification code is ready below. The request is not saved yet.");
  };

  const approvePendingRequest = async () => {
    if (!pendingRequest) return false;
    try {
      const requestPhone = pendingRequest.phone;
      const verifiedCustomer = await verifyCustomer.mutateAsync({ phone: requestPhone, code: demoOtp });
      await submitRequest.mutateAsync(pendingRequest);
      saveCustomerSession({ name: verifiedCustomer.customerName || pendingRequest.requesterName, phone: requestPhone, accessToken: verifiedCustomer.accessToken });
      setSubmittedPhone(requestPhone);
      setSubmitted(true);
      setVerificationOpen(false);
      setPendingRequest(null);
      setSuccessRedirecting(true);
      toast.success("Your request has been saved and added to the customer list.");
      window.setTimeout(() => window.location.assign("/customer-account"), 2000);
      return true;
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "We could not save your request right now. Please try again.");
      return false;
    }
  };

  return (
    <div className="public-flat min-h-screen overflow-x-hidden bg-[#f5f9ff] text-[#102a43]" dir="ltr">
      <PublicHeader onChooseService={(action) => chooseService(action === "طلب خدمة" ? "service" : "track")} />
      {customerSession ? <CustomerNotificationCenter accessToken={customerSession.accessToken} onOpenRequest={(requestId) => window.location.assign(`/customer-account?request=${requestId}`)} /> : null}
      <RequestSuccessNotice visible={successRedirecting} isEnglish />
      <main id="top">
        <section className="relative overflow-hidden bg-[#eef8fe] py-14 sm:py-16 lg:py-20">
          <div className="absolute -right-36 -top-44 h-[30rem] w-[30rem] rounded-full bg-[#d9f1fc]" />
          <div className="container relative grid gap-10 lg:grid-cols-[1.18fr_.82fr] lg:items-center">
            <div className="min-w-0 text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-xs font-extrabold text-[#0878f9]"><Sparkles className="h-3.5 w-3.5" />Maalamati Care for business and service requests</span>
              <h1 className="font-display mt-6 max-w-3xl text-[clamp(1.65rem,4.7vw,3.45rem)] font-extrabold leading-[1.25] tracking-[-0.075em] text-[#102a43]">One platform to submit your request and <span className="text-[#0878f9]">compare service offers.</span></h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[#526d85] sm:text-lg lg:mx-0">Choose the service, submit the essential details, then compare price and completion time and follow every update through your mobile number.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
                <button type="button" onClick={() => chooseService("track")} className="rounded-xl bg-[#0878f9] px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_6px_0_#0457ba] transition-all hover:-translate-y-0.5 hover:bg-[#0668d9] active:translate-y-0 active:scale-[0.98]">Get started <ArrowLeft className="ml-2 inline h-4 w-4 rotate-180" /></button>
                <a href="#services" className="inline-flex items-center gap-2 rounded-xl border border-[#bfd8f2] bg-white px-5 py-3.5 text-sm font-bold text-[#31516e] transition-colors hover:border-[#0878f9] hover:text-[#0878f9]">Explore services <ChevronDown className="h-4 w-4" /></a>
              </div>
            </div>
            <div className="relative mx-auto h-[360px] w-full max-w-[470px] sm:h-[430px] lg:h-[455px]">
              <div className="absolute inset-x-4 bottom-0 top-8 rounded-[2.25rem] bg-[linear-gradient(145deg,#d9effb,#f8fcff)]" />
              <div className="absolute left-7 top-11 h-28 w-28 rounded-[2rem] bg-white/45 rotate-[-18deg]" />
              <img src="/manus-storage/maalamati-black-abaya-hero-a_7b0c4efb_0904de2d.png" alt="An elegant Saudi professional wearing a black abaya and holding a document folder" className="absolute bottom-0 left-1/2 z-10 h-[98%] w-auto max-w-[98%] -translate-x-1/2 object-contain object-bottom" />
            </div>
          </div>
        </section>
        <section className="border-y border-[#e5eef5] bg-white py-6"><div className="container flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm font-bold text-[#60778f]"><span className="text-[#0878f9]">Trusted service paths</span><span>Orderly tracking</span><span>Service requests</span><span>Price comparison</span><span>Updates and files</span></div></section>
        <ServicePlatforms isEnglish />
        <WhyMaalamati isEnglish />
        <section id="services" className="bg-[#f5f9ff] py-16 sm:py-24"><div className="container"><div className="text-center"><span className="section-kicker">Services</span><h2 className="font-display mt-4 text-3xl font-extrabold tracking-[-0.065em] sm:text-5xl">Choose the path that fits.</h2><p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-[#60778f]">Browse the options by what you need, then move directly to the right request form.</p><div className="mx-auto mt-7 inline-flex rounded-2xl border border-[#dce8f6] bg-white p-1.5"><button type="button" onClick={() => setAudience("individual")} className={`rounded-xl px-5 py-2.5 text-sm font-extrabold transition-colors ${audience === "individual" ? "bg-[#0878f9] text-white" : "text-[#60778f] hover:text-[#0878f9]"}`}>Individuals</button><button type="button" onClick={() => setAudience("business")} className={`rounded-xl px-5 py-2.5 text-sm font-extrabold transition-colors ${audience === "business" ? "bg-[#0878f9] text-white" : "text-[#60778f] hover:text-[#0878f9]"}`}>Business</button></div></div><div className="mt-10 grid gap-5 md:grid-cols-3">{routes.map((service) => { const Icon = service.icon; return <button type="button" key={service.title} onClick={() => chooseService(service.action as "track" | "service")} className="group rounded-3xl border border-[#dce8f6] bg-white p-6 text-left transition-all hover:-translate-y-1 hover:border-[#9fcaef] hover:shadow-[0_18px_32px_rgba(28,104,182,.10)]"><span className={`grid h-12 w-12 place-items-center rounded-2xl ${service.tone}`}><Icon className="h-6 w-6" /></span><h3 className="font-display mt-7 text-xl font-extrabold">{service.title}</h3><p className="mt-3 text-sm leading-7 text-[#698098]">{service.description}</p><span className="mt-7 inline-flex items-center gap-2 text-sm font-extrabold text-[#0878f9]">Get started <ArrowLeft className="h-4 w-4 rotate-180" /></span></button>; })}</div></div></section>
        <section id="request" className="bg-white py-16 sm:py-24"><div className="container grid gap-12 lg:grid-cols-[.82fr_1.18fr] lg:items-start"><div className="lg:pt-7"><span className="section-kicker">Start a request</span><h2 className="font-display mt-4 text-3xl font-extrabold leading-[1.45] tracking-[-0.065em] sm:text-5xl">Share what you need, then let it move forward.</h2><p className="mt-5 max-w-md text-base leading-8 text-[#60778f]">Enter the essential details only. After submission, use your mobile number to follow the request; when quotes are available, you can compare price and turnaround time before choosing.</p><div className="mt-8 space-y-3">{["Choose the right service.", "Enter the essential details.", "Use your mobile number when tracking."].map((item) => <div key={item} className="flex items-center gap-3 text-sm font-bold text-[#405d78]"><CheckCircle2 className="h-5 w-5 text-[#0878f9]" />{item}</div>)}</div></div><form onSubmit={handleRequest} className="portal-shadow rounded-[1.75rem] border border-[#dce8f6] bg-[#fbfdff] p-6 sm:p-8"><div className="flex items-center justify-between border-b border-[#e7eff8] pb-5"><div><p className="font-display text-xl font-extrabold tracking-[-0.06em]">Create a Maalamati Care request</p><p className="mt-1.5 text-sm text-[#70859b]">Adding the basics takes only a few minutes.</p></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0878f9]"><Layers3 className="h-5 w-5" /></span></div>{!customerSession ? <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-[#17334f]">Full name<Input name="name" required placeholder="Enter your name" className="mt-2 h-11 rounded-xl border-[#c8daec] bg-white" /></label><label className="text-sm font-bold text-[#17334f]">Mobile number<Input name="phone" required type="tel" placeholder="05X XXX XXXX" dir="ltr" className="mt-2 h-11 rounded-xl border-[#c8daec] bg-white text-left" /></label></div> : <div className="mt-6 rounded-xl border border-[#b7dbff] bg-[#eef7ff] p-3 text-sm font-bold text-[#31516e]">Signed in as {customerSession.name}. This request will be added directly to your account.</div>}<label className="mt-4 block text-sm font-bold text-[#17334f]">Requested service<select name="category" required value={serviceType} onChange={(event) => { setServiceType(event.target.value); setServiceSubcategory(""); }} className="mt-2 h-11 w-full rounded-xl border border-[#c8daec] bg-white px-3 text-sm outline-none focus:border-[#0878f9]"><option value="" disabled>Select a service</option><option value="track">Track a transaction</option><option value="service">Request a service</option></select></label>{serviceType === "service" && <label className="mt-4 block text-sm font-bold text-[#17334f]">Service category<select name="subcategory" required value={serviceSubcategory} onChange={(event) => setServiceSubcategory(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#c8daec] bg-white px-3 text-sm outline-none focus:border-[#0878f9]"><option value="" disabled>Select a service category</option>{serviceSubcategories.map((subcategory) => <option key={subcategory}>{subcategory}</option>)}</select></label>}<label className="mt-4 block text-sm font-bold text-[#17334f]">Request summary<Textarea name="details" required placeholder="Describe your request or the latest step completed…" className="mt-2 min-h-[118px] rounded-xl border border-[#c8daec] bg-white px-3 py-3 text-sm" /></label>{!customerSession ? <CustomRequestFields fields={settings.data?.fields || []} values={customValues} onChange={(fieldKey, value) => setCustomValues((current) => ({ ...current, [fieldKey]: value }))} /> : null}{verificationOpen && pendingRequest && <DemoRequestOtp isEnglish onVerified={approvePendingRequest} />}<Button type="submit" disabled={submitRequest.isPending || submitCustomerRequest.isPending || verificationOpen} className="mt-7 h-12 w-full rounded-xl bg-[#0878f9] text-sm font-extrabold text-white shadow-[0_6px_0_#0457ba] hover:bg-[#0668d9]">{verificationOpen ? "Verify below to approve" : submitRequest.isPending || submitCustomerRequest.isPending ? "Saving your request…" : customerSession ? "Add to my requests" : "Send request"}<ArrowUpLeft className="ml-2 h-4 w-4" /></Button>{submitted && <div className="mt-4 rounded-xl border border-[#b7dbff] bg-[#edf7ff] p-3 text-center text-sm font-bold text-[#0963bd]">Your request has been saved. Track it with mobile number <strong dir="ltr">{submittedPhone}</strong>. When quotes are available, you can compare price and turnaround time.</div>}</form></div></section>
        <section className="bg-[#f5f9ff] py-16 sm:py-20"><div className="container grid gap-6 lg:grid-cols-2"><div className="rounded-3xl bg-[#eaf6ff] p-7 sm:p-9"><span className="section-kicker">Independent tracking</span><h2 className="font-display mt-4 text-3xl font-extrabold leading-[1.45] tracking-[-0.065em]">Track with your mobile number</h2><p className="mt-4 text-base leading-8 text-[#60778f]">Enter your mobile number, verify the code, then review the status, replies, and attachments.</p><a href="/track" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0878f9] px-5 py-3 text-sm font-extrabold text-white">Track your request <ArrowLeft className="h-4 w-4 rotate-180" /></a></div><div className="rounded-3xl border border-[#dce8f6] bg-white p-7 sm:p-9"><Headphones className="h-9 w-9 text-[#0878f9]" /><h2 className="font-display mt-5 text-3xl font-extrabold leading-[1.45] tracking-[-0.065em]">Need support?</h2><p className="mt-4 text-base leading-8 text-[#60778f]">Contact the support team whenever you need help with a service or request.</p><a href="/contact" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[#bfd8f2] bg-white px-5 py-3 text-sm font-extrabold text-[#0878f9]">Contact support <ArrowLeft className="h-4 w-4 rotate-180" /></a></div></div></section>
        <AppShowcaseSection isEnglish />
        <section className="bg-white py-16"><div className="container max-w-4xl"><div className="text-center"><span className="section-kicker">Common questions</span><h2 className="font-display mt-4 text-3xl font-extrabold tracking-[-0.065em]">What would you like to know?</h2></div><div className="mt-8 space-y-3">{[["How do I track my request?", "Open the tracking page, enter your mobile number, and verify the code to view your requests."], ["Do attachments appear in tracking?", "Files added by the team appear in the update record linked to your request."], ["How do I request a service?", "Choose “Request a service”, then add the essential details in the form."]].map(([question, answer]) => <details key={question} className="group rounded-2xl border border-[#dce8f6] bg-[#fbfdff] p-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-extrabold text-[#17334f]">{question}<CircleHelp className="h-5 w-5 shrink-0 text-[#0878f9] transition-transform group-open:rotate-180" /></summary><p className="mt-3 max-w-2xl text-sm leading-7 text-[#60778f]">{answer}</p></details>)}</div></div></section>
      </main>
      <PublicFooter />
      <WhatsAppSupportButton />
    </div>
  );
}

function HomeArabic() {
  const customerSession = useCustomerSession();
  useLocalizedRequestValidation(false);
  const [audience, setAudience] = useState<"individual" | "business">("individual");
  const [submitted, setSubmitted] = useState(false);
  const [successRedirecting, setSuccessRedirecting] = useState(false);
  const [submittedPhone, setSubmittedPhone] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [serviceSubcategory, setServiceSubcategory] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [pendingRequest, setPendingRequest] = useState<RequestDraft | null>(null);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const settings = trpc.settings.publicConfig.useQuery();
  const submitRequest = trpc.requests.create.useMutation();
  const submitCustomerRequest = trpc.requests.createForCustomer.useMutation();
  const verifyCustomer = trpc.requests.verifyPhoneDemo.useMutation();
  const routes = audience === "individual" ? individualRoutes : businessRoutes;
  const chooseService = (service: string) => {
    setServiceType(service);
    if (service !== "طلب خدمة") setServiceSubcategory("");
    document.getElementById("request")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const handleRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const category = form.get("category") === "طلب خدمة" ? "طلب خدمة" : "تعقّب المعاملات";
    const subcategory = String(form.get("subcategory") || "") || undefined;
    const details = String(form.get("details") || "");
    if (customerSession) {
      try {
        await submitCustomerRequest.mutateAsync({ accessToken: customerSession.accessToken, category, subcategory, details });
        setSubmittedPhone(customerSession.phone);
        setSubmitted(true);
        formElement.reset();
        setServiceType("");
        setServiceSubcategory("");
        toast.success("تمت إضافة الطلب مباشرة إلى حسابك.");
      } catch (error) {
        toast.error(error instanceof Error && error.message ? error.message : "تعذر حفظ الطلب الآن. حاول مرة أخرى.");
      }
      return;
    }
    const phone = normalizeSaudiPhone(String(form.get("phone") || ""));
    if (!phone) {
      toast.error("أدخل رقم جوال سعودي صحيحًا، مثل 05X XXX XXXX.");
      return;
    }
    setPendingRequest({ requesterName: String(form.get("name") || "").trim(), phone, category, subcategory, details, customFields: customValues });
    setSubmitted(false);
    setVerificationOpen(true);
    toast.info("تم تجهيز رمز تحقق واتساب التجريبي أدناه. لم يتم حفظ الطلب بعد.");
  };

  const approvePendingRequest = async () => {
    if (!pendingRequest) return false;
    try {
      const requestPhone = pendingRequest.phone;
      const verifiedCustomer = await verifyCustomer.mutateAsync({ phone: requestPhone, code: demoOtp });
      await submitRequest.mutateAsync(pendingRequest);
      saveCustomerSession({ name: verifiedCustomer.customerName || pendingRequest.requesterName, phone: requestPhone, accessToken: verifiedCustomer.accessToken });
      setSubmittedPhone(requestPhone);
      setSubmitted(true);
      setVerificationOpen(false);
      setPendingRequest(null);
      setSuccessRedirecting(true);
      toast.success("تم حفظ الطلب وإضافة العميل إلى قائمة العملاء.");
      window.setTimeout(() => window.location.assign("/customer-account"), 2000);
      return true;
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "تعذر حفظ الطلب الآن. حاول مرة أخرى.");
      return false;
    }
  };

  return (
    <div className="public-flat min-h-screen overflow-x-hidden bg-[#f5f9ff] text-[#102a43]" dir="rtl">
      <PublicHeader onChooseService={chooseService} />
      {customerSession ? <CustomerNotificationCenter accessToken={customerSession.accessToken} onOpenRequest={(requestId) => window.location.assign(`/customer-account?request=${requestId}`)} /> : null}
      <RequestSuccessNotice visible={successRedirecting} isEnglish={false} />
      <main id="top">
        <section className="relative overflow-hidden bg-[#eef8fe] py-14 sm:py-16 lg:py-20">
          <div className="absolute -right-36 -top-44 h-[30rem] w-[30rem] rounded-full bg-[#d9f1fc]" />
          <div className="container relative grid gap-10 lg:grid-cols-[1.18fr_.82fr] lg:items-center">
            <div className="text-center lg:text-right">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-xs font-extrabold text-[#0878f9]"><Sparkles className="h-3.5 w-3.5" />معاملاتي كير لطلبات الأعمال والخدمات</span>
              <h1 className="font-display mt-6 text-[clamp(1.65rem,4.7vw,3.45rem)] font-extrabold leading-[1.25] tracking-[-0.075em] text-[#102a43]">أول منصة تجمع طلبك <span className="text-[#0878f9]">وعروض المعقّبين في مكان واحد.</span></h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[#526d85] sm:text-lg lg:mx-0">اختر الخدمة، واكتب التفاصيل الأساسية، ثم قارن السعر ومدة الإنجاز وتابع جميع التحديثات باستخدام رقم جوالك.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
                <button type="button" onClick={() => chooseService("تعقّب المعاملات")} className="rounded-xl bg-[#0878f9] px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_6px_0_#0457ba] transition-all hover:-translate-y-0.5 hover:bg-[#0668d9] active:translate-y-0 active:scale-[0.98]">ابدأ الآن <ArrowLeft className="mr-2 inline h-4 w-4" /></button>
                <a href="#services" className="inline-flex items-center gap-2 rounded-xl border border-[#bfd8f2] bg-white px-5 py-3.5 text-sm font-bold text-[#31516e] transition-colors hover:border-[#0878f9] hover:text-[#0878f9]">استعرض الخدمات <ChevronDown className="h-4 w-4" /></a>
              </div>
            </div>

            <div className="relative mx-auto h-[360px] w-full max-w-[470px] sm:h-[430px] lg:h-[455px]">
              <div className="absolute inset-x-4 bottom-0 top-8 rounded-[2.25rem] bg-[linear-gradient(145deg,#d9effb,#f8fcff)]" />
              <div className="absolute left-7 top-11 h-28 w-28 rounded-[2rem] bg-white/45 rotate-[-18deg]" />
              <img src="/manus-storage/maalamati-black-abaya-hero-a_7b0c4efb_0904de2d.png" alt="سيدة سعودية أنيقة بعباية سوداء تحمل حافظة مستندات" className="absolute bottom-0 left-1/2 z-10 h-[98%] w-auto max-w-[98%] -translate-x-1/2 object-contain object-bottom" />
            </div>
          </div>
        </section>

        <section className="border-y border-[#e5eef5] bg-white py-6"><div className="container flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm font-bold text-[#60778f]"><span className="text-[#0878f9]">مسارات خدمة موثوقة</span><span>تعقّب منظم</span><span>طلبات خدمات</span><span>مقارنة عروض</span><span>تحديثات ومرفقات</span></div></section>
        <ServicePlatforms isEnglish={false} />
        <WhyMaalamati isEnglish={false} />

        <section id="featured-services" className="bg-white py-14 sm:py-20"><div className="container"><div className="overflow-hidden rounded-[1.5rem] border border-[#dce8f6] bg-[#f8fbfd] p-3 shadow-[0_14px_34px_rgba(28,104,182,.07)] sm:p-5"><div className="relative overflow-hidden rounded-[1.25rem] border border-[#d8eaf5] bg-[linear-gradient(115deg,#e8f6fd_0%,#f7fcff_100%)] px-6 py-7 text-[#102a43] sm:px-10 sm:py-8"><span className="absolute -right-10 -top-16 h-48 w-48 rounded-full border-[22px] border-[#c5e7f8]/50" /><span className="absolute -bottom-16 left-[24%] h-40 w-40 rounded-full bg-[#8bd5f5]/25 blur-2xl" /><div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-extrabold text-[#0878f9]">خدمات مختارة من معاملاتي كير</p><h2 className="font-display mt-2 text-2xl font-extrabold tracking-[-0.055em] sm:text-3xl">مسارات عملية تبدأ من احتياجك.</h2><p className="mt-2 max-w-2xl text-sm leading-7 text-[#526d85]">اختر خدمة واضحة، أرسل التفاصيل، ثم عد إلى سجل واحد لمتابعة ما يتم.</p></div><a href="#services" className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#0878f9] px-5 py-3 text-sm font-extrabold text-white shadow-[0_5px_0_#0457ba] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]">جميع الخدمات <ArrowLeft className="mr-2 h-4 w-4" /></a></div></div><div className="grid gap-4 pt-5 sm:grid-cols-2 xl:grid-cols-4">{featuredServices.map((service) => { const Icon = service.icon; const content = <><div className="flex items-start justify-between gap-3"><span className={`grid h-12 w-12 place-items-center rounded-full ${service.tone}`}><Icon className="h-5 w-5" /></span><span className="rounded-full bg-[#f2f7fa] px-2.5 py-1 text-[11px] font-extrabold text-[#60778f]">{service.label}</span></div><h3 className="font-display mt-5 text-lg font-extrabold tracking-[-0.04em] text-[#17334f]">{service.title}</h3><p className="mt-2 min-h-14 text-sm leading-6 text-[#698098]">{service.description}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#0878f9]">انتقل للخدمة <ArrowLeft className="h-4 w-4" /></span></>; return service.href ? <a href={service.href} key={service.title} className="group min-h-60 rounded-2xl border border-[#dce8f6] bg-white p-5 transition-all hover:-translate-y-1 hover:border-[#9fcaef] hover:shadow-[0_14px_24px_rgba(28,104,182,.10)]">{content}</a> : <button type="button" key={service.title} onClick={() => chooseService(service.action!)} className="group min-h-60 rounded-2xl border border-[#dce8f6] bg-white p-5 text-right transition-all hover:-translate-y-1 hover:border-[#9fcaef] hover:shadow-[0_14px_24px_rgba(28,104,182,.10)]">{content}</button>; })}</div></div></div></section>

        <section id="services" className="bg-[#f5f9ff] py-16 sm:py-24"><div className="container"><div className="text-center"><span className="section-kicker">الخدمات</span><h2 className="font-display mt-4 text-3xl font-extrabold tracking-[-0.065em] sm:text-5xl">اختر المسار الذي يناسبك.</h2><p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-[#60778f]">تصفح الخيارات حسب نوع احتياجك، ثم انتقل مباشرة إلى نموذج الطلب المناسب.</p><div className="mx-auto mt-7 inline-flex rounded-2xl border border-[#dce8f6] bg-white p-1.5"><button type="button" onClick={() => setAudience("individual")} className={`rounded-xl px-5 py-2.5 text-sm font-extrabold transition-colors ${audience === "individual" ? "bg-[#0878f9] text-white" : "text-[#60778f] hover:text-[#0878f9]"}`}>للأفراد</button><button type="button" onClick={() => setAudience("business")} className={`rounded-xl px-5 py-2.5 text-sm font-extrabold transition-colors ${audience === "business" ? "bg-[#0878f9] text-white" : "text-[#60778f] hover:text-[#0878f9]"}`}>للأعمال</button></div></div><div className="mt-10 grid gap-5 md:grid-cols-3">{routes.map((service) => { const Icon = service.icon; const content = <><span className={`grid h-12 w-12 place-items-center rounded-2xl ${service.tone}`}><Icon className="h-6 w-6" /></span><h3 className="font-display mt-7 text-xl font-extrabold">{service.title}</h3><p className="mt-3 text-sm leading-7 text-[#698098]">{service.description}</p><span className="mt-7 inline-flex items-center gap-2 text-sm font-extrabold text-[#0878f9]">ابدأ الآن <ArrowLeft className="h-4 w-4" /></span></>; return service.href ? <a href={service.href} key={service.title} className="group rounded-3xl border border-[#dce8f6] bg-white p-6 transition-all hover:-translate-y-1 hover:border-[#9fcaef] hover:shadow-[0_18px_32px_rgba(28,104,182,.10)]">{content}</a> : <button type="button" key={service.title} onClick={() => chooseService(service.action!)} className="group rounded-3xl border border-[#dce8f6] bg-white p-6 text-right transition-all hover:-translate-y-1 hover:border-[#9fcaef] hover:shadow-[0_18px_32px_rgba(28,104,182,.10)]">{content}</button>; })}</div></div></section>


        <section id="request" className="bg-white py-16 sm:py-24"><div className="container grid gap-12 lg:grid-cols-[.82fr_1.18fr] lg:items-start"><div className="lg:pt-7"><span className="section-kicker">ابدأ الطلب</span><h2 className="font-display mt-4 text-3xl font-extrabold leading-[1.45] tracking-[-0.065em] sm:text-5xl">أرسل احتياجك، ثم دعه يأخذ مساره.</h2><p className="mt-5 max-w-md text-base leading-8 text-[#60778f]">اكتب التفاصيل الأساسية فقط. بعد الإرسال استخدم رقم جوالك لمتابعة الطلب، وعند توفر عروض الأسعار ستتمكن من اختيار العرض ومقارنة السعر ومدة الإنجاز.</p><div className="mt-8 space-y-3">{["اختر الخدمة المناسبة.", "أدخل التفاصيل الأساسية.", "استخدم رقم جوالك عند التتبع."].map((item) => <div key={item} className="flex items-center gap-3 text-sm font-bold text-[#405d78]"><CheckCircle2 className="h-5 w-5 text-[#0878f9]" />{item}</div>)}</div></div><form onSubmit={handleRequest} className="portal-shadow rounded-[1.75rem] border border-[#dce8f6] bg-[#fbfdff] p-6 sm:p-8"><div className="flex items-center justify-between border-b border-[#e7eff8] pb-5"><div><p className="font-display text-xl font-extrabold tracking-[-0.06em]">إعداد طلب معاملاتي كير</p><p className="mt-1.5 text-sm text-[#70859b]">لن يستغرق إدخال الأساسيات سوى دقائق.</p></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0878f9]"><Layers3 className="h-5 w-5" /></span></div>{!customerSession ? <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-[#17334f]">الاسم الكامل<Input name="name" required placeholder="اكتب اسمك" className="mt-2 h-11 rounded-xl border-[#c8daec] bg-white" /></label><label className="text-sm font-bold text-[#17334f]">رقم التواصل<Input name="phone" required type="tel" placeholder="05X XXX XXXX" dir="ltr" className="mt-2 h-11 rounded-xl border-[#c8daec] bg-white text-right" /></label></div> : <div className="mt-6 rounded-xl border border-[#b7dbff] bg-[#eef7ff] p-3 text-sm font-bold text-[#31516e]">أنت مسجل باسم {customerSession.name}. سيُضاف الطلب مباشرة إلى طلباتك.</div>}<label className="mt-4 block text-sm font-bold text-[#17334f]">الخدمة المطلوبة<select name="category" required value={serviceType} onChange={(event) => { setServiceType(event.target.value); setServiceSubcategory(""); }} className="mt-2 h-11 w-full rounded-xl border border-[#c8daec] bg-white px-3 text-sm outline-none focus:border-[#0878f9]"><option value="" disabled>اختر الخدمة</option><option>تعقّب المعاملات</option><option>طلب خدمة</option></select></label>{serviceType === "طلب خدمة" && <label className="mt-4 block text-sm font-bold text-[#17334f]">فئة الخدمة<select name="subcategory" required value={serviceSubcategory} onChange={(event) => setServiceSubcategory(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#c8daec] bg-white px-3 text-sm outline-none focus:border-[#0878f9]"><option value="" disabled>اختر فئة الخدمة</option>{serviceSubcategories.map((subcategory) => <option key={subcategory}>{subcategory}</option>)}</select></label>}<label className="mt-4 block text-sm font-bold text-[#17334f]">ملخص الطلب<Textarea name="details" required placeholder="اشرح طلبك أو آخر خطوة تم تنفيذها…" className="mt-2 min-h-[118px] rounded-xl border border-[#c8daec] bg-white px-3 py-3 text-sm" /></label>{!customerSession ? <CustomRequestFields fields={settings.data?.fields || []} values={customValues} onChange={(fieldKey, value) => setCustomValues((current) => ({ ...current, [fieldKey]: value }))} /> : null}{verificationOpen && pendingRequest && <DemoRequestOtp isEnglish={false} onVerified={approvePendingRequest} />}<Button type="submit" disabled={submitRequest.isPending || submitCustomerRequest.isPending || verificationOpen} className="mt-7 h-12 w-full rounded-xl bg-[#0878f9] text-sm font-extrabold text-white shadow-[0_6px_0_#0457ba] hover:bg-[#0668d9]">{verificationOpen ? "أدخل الرمز لاعتماد الطلب" : submitRequest.isPending || submitCustomerRequest.isPending ? "يتم حفظ الطلب…" : customerSession ? "إضافة إلى طلباتي" : "إرسال الطلب"}<ArrowUpLeft className="mr-2 h-4 w-4" /></Button>{submitted && <div className="mt-4 rounded-xl border border-[#b7dbff] bg-[#edf7ff] p-3 text-center text-sm font-bold text-[#0963bd]">تم حفظ طلبك. تابعه برقم الجوال <strong dir="ltr">{submittedPhone}</strong>. عند توفر عروض الأسعار يمكنك مقارنة السعر ومدة الإنجاز.</div>}</form></div></section>

        <section className="bg-[#f5f9ff] py-16 sm:py-20"><div className="container grid gap-6 lg:grid-cols-2"><div className="rounded-3xl bg-[#eaf6ff] p-7 sm:p-9"><span className="section-kicker">متابعة مستقلة</span><h2 className="font-display mt-4 text-3xl font-extrabold leading-[1.45] tracking-[-0.065em]">تتبّع برقم جوالك</h2><p className="mt-4 text-base leading-8 text-[#60778f]">أدخل رقم الجوال، ثم تحقق من الرمز لمراجعة الحالة والردود والمرفقات.</p><a href="/track" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0878f9] px-5 py-3 text-sm font-extrabold text-white">تتبع طلبك <ArrowLeft className="h-4 w-4" /></a></div><div className="rounded-3xl border border-[#dce8f6] bg-white p-7 sm:p-9"><Headphones className="h-9 w-9 text-[#0878f9]" /><h2 className="font-display mt-5 text-3xl font-extrabold leading-[1.45] tracking-[-0.065em]">تحتاج إلى مساعدة؟</h2><p className="mt-4 text-base leading-8 text-[#60778f]">تواصل مع فريق الدعم عندما تحتاج إلى مساعدة في خدمة أو طلب.</p><a href="/contact" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[#bfd8f2] bg-white px-5 py-3 text-sm font-extrabold text-[#0878f9]">تواصل مع الدعم <ArrowLeft className="h-4 w-4" /></a></div></div></section>
        <AppShowcaseSection isEnglish={false} />

        <section className="bg-white py-16"><div className="container max-w-4xl"><div className="text-center"><span className="section-kicker">أسئلة شائعة</span><h2 className="font-display mt-4 text-3xl font-extrabold tracking-[-0.065em]">ما الذي تحتاج معرفته؟</h2></div><div className="mt-8 space-y-3">{[["كيف أتابع طلبي؟", "افتح صفحة التتبع، وأدخل رقم جوالك، ثم تحقق من الرمز لعرض جميع طلباتك."], ["هل تظهر المرفقات في صفحة التتبع؟", "تظهر المرفقات التي يضيفها فريق العمل ضمن سجل التحديثات المرتبط بطلبك."], ["كيف أطلب خدمة؟", "اختر «طلب خدمة» ثم اكتب التفاصيل الأساسية في النموذج."]].map(([question, answer]) => <details key={question} className="group rounded-2xl border border-[#dce8f6] bg-[#fbfdff] p-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-extrabold text-[#17334f]">{question}<CircleHelp className="h-5 w-5 shrink-0 text-[#0878f9] transition-transform group-open:rotate-180" /></summary><p className="mt-3 max-w-2xl text-sm leading-7 text-[#60778f]">{answer}</p></details>)}</div></div></section>
      </main>
      <PublicFooter />
      <WhatsAppSupportButton />
    </div>
  );
}

export default function Home() {
  const { isEnglish } = useLanguage();
  return isEnglish ? <HomeEnglish /> : <HomeArabic />;
}
