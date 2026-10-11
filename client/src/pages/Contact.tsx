import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  ArrowRight,
  CircleHelp,
  FileText,
  Headphones,
  MessageCircle,
  Search,
  UserRound,
} from "lucide-react";

export default function Contact() {
  const { isEnglish } = useLanguage();
  const settings = trpc.settings.publicConfig.useQuery();
  const phone = settings.data?.whatsappNumber;
  const copy = isEnglish
    ? {
        kicker: "SUPPORT & CONTACT",
        title: "We are here to help.",
        description: "Choose the channel that matches your need. Your request, updates, and support path stay easy to reach.",
        whatsappTitle: "WhatsApp support",
        whatsappValue: phone ? `+${phone}` : "Support request",
        whatsappText: phone ? "Contact the support team directly when you need help." : "Send your need through the request form and the team will review it.",
        whatsappCta: phone ? "Chat on WhatsApp" : "Request support",
        trackTitle: "Track a request",
        trackValue: "With your mobile number",
        trackText: "Verify your number to review request status, replies, and attached files.",
        trackCta: "Track request",
        requestTitle: "Request a service",
        requestValue: "Start with the essentials",
        requestText: "Choose the service and send the details needed for review and price quotes.",
        requestCta: "Start a request",
        accountTitle: "My requests",
        accountValue: "One customer account",
        accountText: "Open your account to see requests, quotes, updates, conversations, and files.",
        accountCta: "Open my account",
        helpTitle: "Need a quick next step?",
        helpText: "Track an existing request or start a new one. We keep every step in the right place.",
        helpPrimary: "Track my request",
        helpSecondary: "Start a new request",
        topicsKicker: "HELP TOPICS",
        topicsTitle: "Choose the right support path.",
        topics: [
          ["Price quotes", "Open My requests to compare price and turnaround time."],
          ["Updates and files", "Everything shared on an accepted request stays in its conversation."],
          ["Account access", "Use your verified mobile number to return to your saved customer record."],
        ],
        message: "Hello, I need support regarding a request in Maalamati.",
      }
    : {
        kicker: "الدعم والتواصل",
        title: "نحن هنا لمساعدتك.",
        description: "اختر القناة التي تناسب احتياجك؛ طلباتك وتحديثاتك ومسار الدعم تبقى سهلة الوصول.",
        whatsappTitle: "دعم واتساب",
        whatsappValue: phone ? `+${phone}` : "طلب دعم",
        whatsappText: phone ? "تواصل مباشرة مع فريق الدعم عندما تحتاج إلى مساعدة." : "أرسل احتياجك من نموذج الطلب وسيتولى الفريق مراجعته.",
        whatsappCta: phone ? "تواصل عبر واتساب" : "أرسل طلب دعم",
        trackTitle: "تتبّع طلبك",
        trackValue: "باستخدام رقم الجوال",
        trackText: "تحقق من رقمك لمراجعة حالة الطلب والردود والمرفقات المرتبطة به.",
        trackCta: "تتبّع الطلب",
        requestTitle: "طلب خدمة",
        requestValue: "ابدأ بالتفاصيل الأساسية",
        requestText: "اختر الخدمة وأرسل المعلومات اللازمة للمراجعة واستقبال عروض الأسعار.",
        requestCta: "ابدأ طلبًا",
        accountTitle: "طلباتي",
        accountValue: "حساب عميل واحد",
        accountText: "افتح حسابك لرؤية الطلبات والعروض والتحديثات والمحادثات والمرفقات.",
        accountCta: "فتح حسابي",
        helpTitle: "تحتاج إلى الخطوة التالية؟",
        helpText: "تتبّع طلبًا قائمًا أو ابدأ طلبًا جديدًا؛ ونبقي كل خطوة في مكانها الصحيح.",
        helpPrimary: "تتبّع طلبي",
        helpSecondary: "بدء طلب جديد",
        topicsKicker: "موضوعات المساعدة",
        topicsTitle: "اختر مسار الدعم المناسب.",
        topics: [
          ["عروض الأسعار", "افتح طلباتي لمقارنة السعر ومدة الإنجاز قبل الاعتماد."],
          ["التحديثات والمرفقات", "كل ما يُشارك بعد اعتماد الطلب يبقى داخل محادثته الخاصة."],
          ["الدخول إلى الحساب", "استخدم رقم جوالك الموثق للعودة إلى سجل العميل المحفوظ."],
        ],
        message: "مرحبًا، أحتاج دعمًا بخصوص طلب في تطبيق معاملاتي.",
      };

  const whatsappHref = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(copy.message)}` : "/#request";
  const cards = [
    { icon: MessageCircle, title: copy.whatsappTitle, value: copy.whatsappValue, text: copy.whatsappText, href: whatsappHref, cta: copy.whatsappCta, external: Boolean(phone), tone: "bg-[#e9fff2] text-[#17a65a]" },
    { icon: UserRound, title: copy.accountTitle, value: copy.accountValue, text: copy.accountText, href: "/customer-account", cta: copy.accountCta, external: false, tone: "bg-[#f1efff] text-[#6250d8]" },
    { icon: Search, title: copy.trackTitle, value: copy.trackValue, text: copy.trackText, href: "/track", cta: copy.trackCta, external: false, tone: "bg-[#eaf3ff] text-[#0878f9]" },
    { icon: FileText, title: copy.requestTitle, value: copy.requestValue, text: copy.requestText, href: "/#request", cta: copy.requestCta, external: false, tone: "bg-[#fff4e9] text-[#c46c16]" },
  ];

  return (
    <div className="public-flat min-h-screen overflow-x-hidden bg-[#f4f9ff] text-[#102a43]" dir={isEnglish ? "ltr" : "rtl"}>
      <PublicHeader onChooseService={action => window.location.assign(action === "طلب خدمة" ? "/#request" : "/track")} />
      <main>
        <section className="app-grid relative overflow-hidden bg-[#eef7ff] py-14 sm:py-20">
          <div className="blue-orb absolute -right-40 -top-52 h-[36rem] w-[36rem]" />
          <div className="container relative">
            <span className="section-kicker">{copy.kicker}</span>
            <h1 className="font-display mt-4 max-w-3xl text-4xl font-black tracking-[-.065em] text-[#102a43] sm:text-6xl">{copy.title}</h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[#60778f] sm:text-lg">{copy.description}</p>

            <div className="mt-10 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {cards.map(({ icon: Icon, title, value, text, href, cta, external, tone }) => (
                <article key={title} className="flex min-w-0 flex-col rounded-[1.6rem] border border-[#dce8f6] bg-white p-5 shadow-[0_14px_34px_rgba(25,93,164,.07)] sm:p-6">
                  <span className={`grid h-14 w-14 place-items-center rounded-full ${tone}`}><Icon className="h-6 w-6" /></span>
                  <h2 className="font-display mt-5 text-lg font-black text-[#17334f]">{title}</h2>
                  <p className="mt-2 break-words text-sm font-black text-[#102a43]" dir={phone && title === copy.whatsappTitle ? "ltr" : undefined}>{value}</p>
                  <p className="mt-3 flex-1 text-sm leading-7 text-[#60778f]">{text}</p>
                  <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#eaf3ff] px-4 text-sm font-extrabold text-[#0878f9] transition-colors hover:bg-[#0878f9] hover:text-white">
                    {cta}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-10 sm:py-14">
          <div className="container">
            <div className="flex flex-col gap-5 rounded-[1.7rem] bg-[linear-gradient(115deg,#0878f9,#0665d3)] p-6 text-white shadow-[0_18px_40px_rgba(8,120,249,.20)] sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <Headphones className="h-7 w-7 text-[#dff2ff]" />
                <h2 className="font-display mt-3 text-2xl font-black sm:text-3xl">{copy.helpTitle}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-white/80">{copy.helpText}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <a href="/track" className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-extrabold text-[#0878f9]">
                  {copy.helpPrimary}{isEnglish ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                </a>
                <a href="/#request" className="inline-flex h-11 items-center rounded-xl border border-white/30 bg-white/10 px-4 text-sm font-extrabold text-white hover:bg-white/20">{copy.helpSecondary}</a>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#f5f9ff] py-14 sm:py-20">
          <div className="container">
            <div className="max-w-2xl">
              <span className="section-kicker">{copy.topicsKicker}</span>
              <h2 className="font-display mt-4 text-3xl font-black tracking-[-.055em] text-[#17334f] sm:text-4xl">{copy.topicsTitle}</h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {copy.topics.map(([title, text], index) => (
                <article key={title} className="rounded-2xl border border-[#dce8f6] bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf3ff] text-[#0878f9]"><CircleHelp className="h-5 w-5" /></span>
                    <span className="text-xs font-black text-[#8aa0b5]">0{index + 1}</span>
                  </div>
                  <h3 className="font-display mt-5 text-lg font-black text-[#17334f]">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[#60778f]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
