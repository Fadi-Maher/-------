import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";
import {
  JoinSupportCard,
  JoinSupportWhatsAppButton,
} from "@/components/JoinSupportWhatsApp";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSignedInWorkspace, workspaceLabel } from "@/lib/signedInWorkspace";
import { AGENT_DOCUMENT_MAX_BYTES } from "@shared/agentDocuments";
import {
  ArrowLeft,
  BadgeCheck,
  BellRing,
  ClipboardList,
  FileText,
  HandCoins,
  IdCard,
  LockKeyhole,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Wallet,
} from "lucide-react";
import React from "react";

const MAX_MB = Math.round(AGENT_DOCUMENT_MAX_BYTES / (1024 * 1024));

type Card = {
  title: string;
  text: string;
  icon: typeof Sparkles;
  tone: string;
};

function content(isEnglish: boolean) {
  if (isEnglish) {
    return {
      kicker: "Join the Maalamati Care team",
      title: (
        <>
          Become an agent and receive
          <br />
          <span className="text-[#0878f9]">
            customer requests in one place.
          </span>
        </>
      ),
      intro:
        "Review open customer requests, send your quote and turnaround, and follow each assigned request with its messages, files and finances from one organized workspace.",
      apply: "Apply to join",
      documentsLink: "Required documents",
      facts: [
        [
          "Mobile verification",
          "Start with your Saudi mobile number and a verification code.",
        ],
        [
          "Administration review",
          "No account is activated before an owner reviews your application.",
        ],
        [
          "Clear decision",
          "You see the approval or the reason for rejection when you sign in.",
        ],
      ],
      benefitsKicker: "Why join",
      benefitsTitle: "Tools that keep your work organized.",
      benefits: [
        {
          title: "New customer requests",
          text: "Browse requests that are accepting quotes, newest first, with the time left to respond.",
          icon: ClipboardList,
          tone: "bg-[#eaf3ff] text-[#0878f9]",
        },
        {
          title: "Quotes on your terms",
          text: "Set your own price and turnaround for every request, and know when a customer selects your quote.",
          icon: HandCoins,
          tone: "bg-[#f2ffe0] text-[#507900]",
        },
        {
          title: "Organized conversations",
          text: "Private messages and attachments for each assigned request, with an archive once it is completed.",
          icon: MessagesSquare,
          tone: "bg-[#f1efff] text-[#6250d8]",
        },
        {
          title: "Your financial record",
          text: "Record collections and costs per request and see net profit by month or date range.",
          icon: Wallet,
          tone: "bg-[#fff6e5] text-[#a35f00]",
        },
        {
          title: "Instant notifications",
          text: "Alerts for new requests, selected quotes, messages and reviews, with an optional sound.",
          icon: BellRing,
          tone: "bg-[#e9fbf6] text-[#0f7c66]",
        },
        {
          title: "A trusted environment",
          text: "Customer contact details stay protected, and every action is kept in the request record.",
          icon: ShieldCheck,
          tone: "bg-[#ffeef1] text-[#b13b47]",
        },
      ] satisfies Card[],
      documentsKicker: "Required documents",
      documentsTitle: "Prepare these before you start.",
      documentsIntro:
        "Upload one clear file for each document during the application. You can add missing documents while the application is pending review.",
      documents: [
        {
          title: "National ID",
          text: "A clear copy of the front of your national ID, with every edge and detail readable.",
          icon: IdCard,
        },
        {
          title: "Work license",
          text: "A valid license or document that proves you are allowed to practise the activity.",
          icon: FileText,
        },
      ],
      fileRules: `PDF, PNG or JPEG · up to ${MAX_MB} MB per file · stored encrypted and visible only to the administration for verification.`,
      formTitle: "Details requested in the form",
      formFields: [
        "Full name and email",
        "City",
        "Specialty",
        "Years of experience",
        "Optional notes for the reviewer",
        "Consent to share your data and documents for review",
      ],
      stepsKicker: "How it works",
      stepsTitle: "Four steps from application to activation.",
      steps: [
        [
          "Verify your mobile",
          "Enter your Saudi mobile number (05XXXXXXXX) and confirm the code.",
        ],
        [
          "Choose “Agent”",
          "Complete your details and upload your national ID and work license.",
        ],
        [
          "Administration review",
          "The owner reviews your details and documents, then approves or rejects with a reason.",
        ],
        [
          "Activation and sign-in",
          "Once approved, your agent workspace opens with a welcome notice on your next sign-in.",
        ],
      ],
      tipsTitle: "Tips for a faster review",
      tips: [
        "Use the same name that appears on your documents.",
        "Make sure photos are sharp, well lit and not cropped.",
        "Use a Saudi mobile number you can always reach; one application is allowed per number.",
        "Describe your specialty precisely, for example the government platforms you work with.",
      ],
      faqTitle: "Frequently asked questions",
      faq: [
        [
          "Do I need an account first?",
          "No. Your verified mobile number is enough to start the application.",
        ],
        [
          "How will I know the decision?",
          "Sign in through “Agent sign-in”. If approved, your workspace opens with a welcome notice; if not, you will see the reason for the decision.",
        ],
        [
          "Can I add documents after sending?",
          "Yes, while the application is pending review you can upload missing documents from the same path.",
        ],
        [
          "Who can see my documents?",
          "Documents are stored encrypted and only the administration can open them, for verification purposes.",
        ],
        [
          "What if my application is rejected?",
          "The reason appears when you sign in, and you can contact support for clarification.",
        ],
      ],
      finalTitle: "Ready to join?",
      finalText:
        "Start with your mobile number. It only takes a few minutes to send your application.",
      signedInAgent: "You already have an agent account.",
      signedInOther:
        "Sign out of your current account first to apply as an agent.",
      open: "Open",
    };
  }
  return {
    kicker: "انضم إلى فريق معاملاتي كير",
    title: (
      <>
        انضم كمعقّب واستقبل
        <br />
        <span className="text-[#0878f9]">طلبات العملاء في مكان واحد.</span>
      </>
    ),
    intro:
      "استعرض طلبات العملاء المفتوحة، وقدّم عرض السعر ومدة الإنجاز، ثم تابع كل طلب موكل إليك مع رسائله ومرفقاته وحساباته من بوابة عمل منظمة.",
    apply: "قدّم طلب الانضمام",
    documentsLink: "المستندات المطلوبة",
    facts: [
      ["تحقق برقم الجوال", "ابدأ برقم جوالك السعودي ورمز التحقق."],
      ["مراجعة من الإدارة", "لا يُفعّل أي حساب قبل مراجعة طلبك من المالك."],
      ["قرار واضح", "يظهر لك القبول أو سبب الرفض عند تسجيل الدخول."],
    ],
    benefitsKicker: "لماذا تنضم",
    benefitsTitle: "أدوات تجعل عملك منظمًا.",
    benefits: [
      {
        title: "طلبات عملاء جديدة",
        text: "تصفّح الطلبات التي تستقبل العروض، الأحدث أولًا، مع الوقت المتبقي للرد.",
        icon: ClipboardList,
        tone: "bg-[#eaf3ff] text-[#0878f9]",
      },
      {
        title: "عروض بشروطك",
        text: "حدد سعرك ومدة الإنجاز لكل طلب، واعرف فور اختيار العميل لعرضك.",
        icon: HandCoins,
        tone: "bg-[#f2ffe0] text-[#507900]",
      },
      {
        title: "محادثات منظمة",
        text: "رسائل خاصة ومرفقات لكل طلب موكل إليك، مع أرشيف للقراءة بعد الاكتمال.",
        icon: MessagesSquare,
        tone: "bg-[#f1efff] text-[#6250d8]",
      },
      {
        title: "سجلك المالي",
        text: "سجّل التحصيل والتكاليف لكل طلب، واعرف صافي الربح حسب الشهر أو الفترة.",
        icon: Wallet,
        tone: "bg-[#fff6e5] text-[#a35f00]",
      },
      {
        title: "إشعارات فورية",
        text: "تنبيهات للطلبات الجديدة واختيار العروض والرسائل والتقييمات، مع تنبيه صوتي اختياري.",
        icon: BellRing,
        tone: "bg-[#e9fbf6] text-[#0f7c66]",
      },
      {
        title: "بيئة عمل موثوقة",
        text: "بيانات تواصل العميل محمية، وكل إجراء محفوظ في سجل الطلب.",
        icon: ShieldCheck,
        tone: "bg-[#ffeef1] text-[#b13b47]",
      },
    ] satisfies Card[],
    documentsKicker: "المستندات المطلوبة",
    documentsTitle: "جهّز هذه المستندات قبل البدء.",
    documentsIntro:
      "ارفع ملفًا واضحًا لكل مستند أثناء التقديم، ويمكنك إضافة ما ينقص ما دام الطلب قيد المراجعة.",
    documents: [
      {
        title: "الهوية الوطنية",
        text: "صورة واضحة لوجه الهوية تظهر فيها جميع الحواف والبيانات بوضوح.",
        icon: IdCard,
      },
      {
        title: "رخصة العمل",
        text: "رخصة أو وثيقة سارية تثبت أهليتك لمزاولة النشاط.",
        icon: FileText,
      },
    ],
    fileRules: `PDF أو PNG أو JPEG · حتى ${MAX_MB} ميجابايت للملف · تُحفظ مشفّرة ولا يطّلع عليها إلا فريق الإدارة لغرض التحقق.`,
    formTitle: "بيانات تُطلب في النموذج",
    formFields: [
      "الاسم الكامل والبريد الإلكتروني",
      "المدينة",
      "التخصص",
      "سنوات الخبرة",
      "ملاحظات اختيارية للمراجِع",
      "الموافقة على مشاركة بياناتك ومستنداتك للمراجعة",
    ],
    stepsKicker: "كيف يعمل",
    stepsTitle: "أربع خطوات من التقديم إلى التفعيل.",
    steps: [
      [
        "تحقق من جوالك",
        "أدخل رقم جوالك السعودي (05XXXXXXXX) وأكّد رمز التحقق.",
      ],
      ["اختر «معقب»", "أكمل بياناتك وارفع الهوية الوطنية ورخصة العمل."],
      [
        "مراجعة الإدارة",
        "يراجع المالك بياناتك ومستنداتك، ثم يقبل الطلب أو يرفضه مع ذكر السبب.",
      ],
      [
        "التفعيل والدخول",
        "عند القبول تُفتح لك بوابة المعقب مع رسالة ترحيب عند دخولك التالي.",
      ],
    ],
    tipsTitle: "نصائح لمراجعة أسرع",
    tips: [
      "استخدم الاسم نفسه الظاهر في مستنداتك.",
      "تأكد أن الصور واضحة وجيدة الإضاءة وغير مقصوصة.",
      "استخدم رقم جوال سعوديًا متاحًا دائمًا؛ يُقبل طلب واحد لكل رقم.",
      "اكتب تخصصك بدقة، مثل المنصات الحكومية التي تتعامل معها.",
    ],
    faqTitle: "أسئلة شائعة",
    faq: [
      [
        "هل أحتاج حسابًا مسبقًا؟",
        "لا، يكفي رقم جوالك الموثق لبدء طلب الانضمام.",
      ],
      [
        "كيف أعرف قرار طلبي؟",
        "سجّل الدخول من «دخول المعقبين». عند القبول تُفتح بوابتك مع رسالة ترحيب، وعند الرفض يظهر لك سبب القرار.",
      ],
      [
        "هل يمكنني إضافة مستندات بعد الإرسال؟",
        "نعم، ما دام الطلب قيد المراجعة يمكنك رفع المستندات الناقصة من المسار نفسه.",
      ],
      [
        "من يطّلع على مستنداتي؟",
        "تُحفظ المستندات مشفّرة، ولا يفتحها إلا فريق الإدارة لغرض التحقق.",
      ],
      [
        "ماذا لو رُفض طلبي؟",
        "يظهر لك السبب عند الدخول، ويمكنك التواصل مع الدعم للاستفسار.",
      ],
    ],
    finalTitle: "جاهز للانضمام؟",
    finalText: "ابدأ برقم جوالك، فإرسال طلب الانضمام يستغرق دقائق قليلة.",
    signedInAgent: "لديك حساب معقب بالفعل.",
    signedInOther: "سجّل الخروج من حسابك الحالي أولًا للتقديم كمعقب.",
    open: "افتح",
  };
}

function ApplyActions({
  isEnglish,
  copy,
  tone = "light",
}: {
  isEnglish: boolean;
  copy: ReturnType<typeof content>;
  tone?: "light" | "dark";
}) {
  const { workspace } = useSignedInWorkspace();
  const arrow = (
    <ArrowLeft
      className={`h-4 w-4 ${isEnglish ? "rotate-180" : ""}`}
      aria-hidden="true"
    />
  );
  if (workspace) {
    const isAgent = workspace.kind === "agent";
    return (
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <div
          role="note"
          className={`inline-flex max-w-xl flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${tone === "dark" ? "border-white/25 bg-white/10 text-white" : "border-[#cfe3fa] bg-white text-[#31516e]"}`}
        >
          <UserRoundCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            {isAgent ? copy.signedInAgent : copy.signedInOther}
          </span>
          <a
            href={workspace.href}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0878f9] px-4 text-sm font-extrabold text-white transition-colors hover:bg-[#0668d9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] focus-visible:ring-offset-2"
          >
            {copy.open} {workspaceLabel(workspace, isEnglish)}
            {arrow}
          </a>
        </div>
        <JoinSupportWhatsAppButton />
      </div>
    );
  }
  return (
    <div className="mt-7 flex flex-wrap items-center gap-3">
      <a
        href="/agent-login"
        data-auth-trigger="agent"
        className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#0878f9] px-6 text-sm font-extrabold text-white shadow-[0_5px_0_#0457ba] transition-[transform,background-color] duration-150 hover:bg-[#0668d9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] focus-visible:ring-offset-2 active:translate-y-0.5 active:shadow-[0_3px_0_#0457ba]"
      >
        <BadgeCheck className="h-4 w-4" aria-hidden="true" />
        {copy.apply}
        {arrow}
      </a>
      {tone === "light" ? (
        <a
          href="#documents"
          className="inline-flex min-h-12 items-center rounded-xl border border-[#cfe3fa] bg-white px-5 text-sm font-bold text-[#075aa8] transition-colors hover:border-[#0878f9] hover:bg-[#f1f7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9]"
        >
          {copy.documentsLink}
        </a>
      ) : null}
      <JoinSupportWhatsAppButton />
    </div>
  );
}

export default function AgentJoinInfo() {
  const { isEnglish } = useLanguage();
  const copy = content(isEnglish);
  return (
    <main
      className="public-flat min-h-screen overflow-x-hidden bg-[#f5f9ff] text-[#102a43]"
      dir={isEnglish ? "ltr" : "rtl"}
    >
      <PublicHeader
        onChooseService={action =>
          window.location.assign(action === "طلب خدمة" ? "/#request" : "/track")
        }
      />

      <section
        className="app-grid relative overflow-hidden bg-[#eef7ff] py-14 sm:py-20"
        aria-labelledby="join-agent-title"
      >
        <div
          className="blue-orb absolute -right-32 -top-36 h-[32rem] w-[32rem]"
          aria-hidden="true"
        />
        <div className="container relative">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#cce2fb] bg-white px-4 py-2 text-xs font-extrabold text-[#0878f9] shadow-sm">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {copy.kicker}
            </span>
            <h1
              id="join-agent-title"
              className="font-display mt-6 text-4xl font-extrabold leading-[1.4] tracking-[-0.06em] sm:text-6xl"
            >
              {copy.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#59718b] sm:text-lg">
              {copy.intro}
            </p>
            <ApplyActions isEnglish={isEnglish} copy={copy} />
          </div>
          <ul className="mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
            {copy.facts.map(([title, text]) => (
              <li key={title} className="soft-card p-5 text-start">
                <p className="font-display text-lg font-extrabold text-[#102a43]">
                  {title}
                </p>
                <p className="mt-2 text-sm leading-7 text-[#60778f]">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        className="bg-white py-16 sm:py-20"
        aria-labelledby="join-benefits-title"
      >
        <div className="container">
          <div className="max-w-2xl">
            <span className="section-kicker">{copy.benefitsKicker}</span>
            <h2
              id="join-benefits-title"
              className="font-display mt-4 text-3xl font-extrabold leading-[1.45] tracking-[-0.05em] sm:text-5xl"
            >
              {copy.benefitsTitle}
            </h2>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {copy.benefits.map(benefit => {
              const Icon = benefit.icon;
              return (
                <article
                  key={benefit.title}
                  className="rounded-3xl border border-[#dce8f6] bg-[#f7fbff] p-6 transition-transform duration-200 motion-safe:hover:-translate-y-1"
                >
                  <span
                    className={`grid h-12 w-12 place-items-center rounded-2xl ${benefit.tone}`}
                    aria-hidden="true"
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="font-display mt-6 text-xl font-extrabold">
                    {benefit.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[#698098]">
                    {benefit.text}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="documents"
        tabIndex={-1}
        className="scroll-mt-24 bg-[#f5f9ff] py-16 focus:outline-none sm:py-20"
        aria-labelledby="join-documents-title"
      >
        <div className="container grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-start">
          <div>
            <span className="section-kicker">{copy.documentsKicker}</span>
            <h2
              id="join-documents-title"
              className="font-display mt-4 text-3xl font-extrabold leading-[1.45] tracking-[-0.05em] sm:text-4xl"
            >
              {copy.documentsTitle}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[#60778f]">
              {copy.documentsIntro}
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {copy.documents.map(document => {
                const Icon = document.icon;
                return (
                  <article
                    key={document.title}
                    className="rounded-3xl border border-[#cfe3fa] bg-white p-5 shadow-[0_10px_28px_rgba(25,93,164,.06)]"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0878f9]"
                        aria-hidden="true"
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <h3 className="font-display text-lg font-extrabold">
                        {document.title}
                      </h3>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[#60778f]">
                      {document.text}
                    </p>
                  </article>
                );
              })}
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-2xl border border-[#dce8f6] bg-white p-4 text-sm leading-7 text-[#31516e]">
              <LockKeyhole
                className="mt-1 h-4 w-4 shrink-0 text-[#0878f9]"
                aria-hidden="true"
              />
              <span>{copy.fileRules}</span>
            </p>
          </div>
          <aside
            className="rounded-3xl border border-[#dce8f6] bg-white p-6 shadow-[0_10px_28px_rgba(25,93,164,.06)]"
            aria-labelledby="join-form-fields-title"
          >
            <h3
              id="join-form-fields-title"
              className="font-display text-xl font-extrabold"
            >
              {copy.formTitle}
            </h3>
            <ul className="mt-4 space-y-3">
              {copy.formFields.map(field => (
                <li
                  key={field}
                  className="flex items-start gap-3 text-sm leading-7 text-[#31516e]"
                >
                  <BadgeCheck
                    className="mt-1 h-4 w-4 shrink-0 text-[#287333]"
                    aria-hidden="true"
                  />
                  {field}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <section
        className="bg-[#0b4f9c] py-16 text-white sm:py-20"
        aria-labelledby="join-steps-title"
      >
        <div className="container">
          <span className="inline-flex items-center gap-2 text-sm font-extrabold text-[#d8ff4f]">
            <span
              className="h-2 w-2 rounded-full bg-[#d8ff4f]"
              aria-hidden="true"
            />
            {copy.stepsKicker}
          </span>
          <h2
            id="join-steps-title"
            className="font-display mt-4 max-w-2xl text-3xl font-extrabold leading-[1.45] tracking-[-0.05em] sm:text-4xl"
          >
            {copy.stepsTitle}
          </h2>
          <ol className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {copy.steps.map(([title, text], index) => (
              <li
                key={title}
                className="rounded-2xl border border-white/15 bg-white/10 p-5"
              >
                <span
                  className="grid h-9 w-9 place-items-center rounded-full bg-[#d8ff4f] font-display text-base font-black text-[#0b3f7d]"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <h3 className="font-display mt-4 text-lg font-extrabold">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-[#d3e8ff]">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        className="bg-white py-16 sm:py-20"
        aria-labelledby="join-faq-title"
      >
        <div className="container grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
          <div className="rounded-3xl bg-[#eef7ff] p-6">
            <h2 className="font-display text-2xl font-extrabold">
              {copy.tipsTitle}
            </h2>
            <ul className="mt-4 space-y-3">
              {copy.tips.map(tip => (
                <li
                  key={tip}
                  className="flex items-start gap-3 text-sm leading-7 text-[#31516e]"
                >
                  <Sparkles
                    className="mt-1 h-4 w-4 shrink-0 text-[#0878f9]"
                    aria-hidden="true"
                  />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2
              id="join-faq-title"
              className="font-display text-2xl font-extrabold sm:text-3xl"
            >
              {copy.faqTitle}
            </h2>
            <div className="mt-5 space-y-3">
              {copy.faq.map(([question, answer]) => (
                <details
                  key={question}
                  className="group rounded-2xl border border-[#dce8f6] bg-[#fbfdff] p-4 open:bg-white open:shadow-[0_8px_24px_rgba(25,93,164,.06)]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg font-bold text-[#17334f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] [&::-webkit-details-marker]:hidden">
                    {question}
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#eaf3ff] text-[#0878f9] transition-transform duration-200 group-open:rotate-45"
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-7 text-[#60778f]">
                    {answer}
                  </p>
                </details>
              ))}
            </div>
            <JoinSupportCard />
          </div>
        </div>
      </section>

      <section
        className="bg-white pb-16 sm:pb-20"
        aria-labelledby="join-final-title"
      >
        <div className="container">
          <div className="rounded-3xl bg-[#eef7ff] p-7 text-center sm:p-10">
            <BadgeCheck
              className="mx-auto h-9 w-9 text-[#0878f9]"
              aria-hidden="true"
            />
            <h2
              id="join-final-title"
              className="font-display mt-5 text-3xl font-extrabold tracking-[-0.05em]"
            >
              {copy.finalTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-[#60778f]">
              {copy.finalText}
            </p>
            <div className="flex justify-center">
              <ApplyActions isEnglish={isEnglish} copy={copy} tone="light" />
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
