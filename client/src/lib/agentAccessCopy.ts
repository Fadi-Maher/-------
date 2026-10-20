import { AGENT_DOCUMENT_MAX_BYTES } from "@shared/agentDocuments";

const MAX_MB = Math.round(AGENT_DOCUMENT_MAX_BYTES / (1024 * 1024));

type TextItem = { label: string; text: string };
type CardItem = { title: string; text: string };
export type AgentAccessCopy = {
  brand: string;
  kicker: string;
  title: string;
  phoneHeading: string;
  lead: string;
  joinNote: string;
  demo: string;
  stepsLabel: string;
  steps: TextItem[];
  cta: string;
  ctaHint: string;
  joinKicker: string;
  joinTitle: string;
  joinIntro: string;
  joinCards: CardItem[];
  joinLink: string;
};

/**
 * One source for the agent sign-in wording. The "دخول المعقبين" pop-up (AuthModal
 * with the agent audience) and the direct /agent-login page both read from here,
 * so their title, explanation, steps, join-request note and demo notice never drift.
 */
export const AGENT_ACCESS_COPY: { ar: AgentAccessCopy; en: AgentAccessCopy } = {
  ar: {
    brand: "معاملاتي كير",
    kicker: "بوابة المعقبين",
    title: "دخول المعقبين",
    phoneHeading: "أدخل رقم جوالك",
    lead: "المعقب المفعّل يدخل مباشرة إلى بوابته بعد رمز التحقق، والرقم الجديد يقدّم طلب انضمام تراجعه الإدارة قبل التفعيل.",
    joinNote: `رقم جديد؟ ستُكمل بياناتك وترفع الهوية الوطنية ورخصة العمل، ولا يُفعّل الحساب إلا بعد موافقة الإدارة.`,
    demo: "وضع تجريبي: يظهر الرمز داخل النافذة، ولا تُرسل رسالة SMS.",
    stepsLabel: "خطوات الدخول",
    steps: [
      { label: "الجوال", text: "أدخل رقم جوالك السعودي." },
      { label: "الرمز", text: "أكّد رمز التحقق المكوّن من 6 أرقام." },
      { label: "النوع", text: "يُحدَّد الحساب كمعقّب تلقائيًا عند الدخول من هنا." },
      { label: "البيانات", text: "الرقم الجديد يُكمل الاسم والبريد ويرفع المستندات لإرسال طلب الانضمام." },
    ],
    cta: "متابعة برقم الجوال",
    ctaHint: "تُفتح نافذة الدخول نفسها التي تظهر من زر «دخول المعقبين».",
    joinKicker: "طلب الانضمام",
    joinTitle: "معقّب جديد؟ هذا ما تحتاجه.",
    joinIntro: "يبدأ طلب الانضمام من الخطوات نفسها: تحقق من رقمك، ثم أكمل بياناتك وارفع مستنداتك ليراجعها فريق الإدارة.",
    joinCards: [
      {
        title: "المستندات المطلوبة",
        text: `الهوية الوطنية ورخصة العمل، بصيغة PDF أو PNG أو JPEG حتى ${MAX_MB} ميجابايت للملف. تُحفظ مشفّرة ولا يطّلع عليها إلا فريق الإدارة.`,
      },
      {
        title: "مراجعة الإدارة",
        text: "يراجع المالك بياناتك ومستنداتك، ولا يُفعّل أي حساب قبل الموافقة. يُقبل طلب واحد لكل رقم جوال.",
      },
      {
        title: "قرار واضح عند الدخول",
        text: "عند القبول تُفتح بوابتك مع رسالة ترحيب، وعند الرفض يظهر لك سبب القرار عند تسجيل الدخول.",
      },
    ],
    joinLink: "مزايا الانضمام والمستندات بالتفصيل",
  },
  en: {
    brand: "Maalamati Care",
    kicker: "Agent portal",
    title: "Agent sign-in",
    phoneHeading: "Enter your mobile number",
    lead: "Active agents go straight to their portal after the code. A new mobile submits a join request that the admin reviews before activation.",
    joinNote: `New mobile? You'll complete your details and upload your national ID and work license. The account is activated only after admin approval.`,
    demo: "Demo mode: the code is displayed in the window; no SMS is sent.",
    stepsLabel: "Account access steps",
    steps: [
      { label: "Mobile", text: "Enter your Saudi mobile number." },
      { label: "Code", text: "Confirm the 6-digit verification code." },
      { label: "Type", text: "Signing in here selects the agent account automatically." },
      { label: "Profile", text: "A new mobile adds a name and email and uploads documents to send the join request." },
    ],
    cta: "Continue with your mobile",
    ctaHint: "Opens the same sign-in window as the “Agent sign-in” button.",
    joinKicker: "Join request",
    joinTitle: "New agent? Here's what you need.",
    joinIntro: "A join request starts with the same steps: verify your mobile, then complete your details and upload your documents for the admin team to review.",
    joinCards: [
      {
        title: "Required documents",
        text: `National ID and work license as PDF, PNG or JPEG, up to ${MAX_MB} MB each. They are stored encrypted and only the admin team can open them.`,
      },
      {
        title: "Admin review",
        text: "The owner reviews your details and documents; no account is activated before approval. One request per mobile number.",
      },
      {
        title: "A clear decision at sign-in",
        text: "If approved, your portal opens with a welcome message. If not, you'll see the reason when you sign in.",
      },
    ],
    joinLink: "Joining benefits and documents in detail",
  },
};

export function agentAccessCopy(isEnglish: boolean): AgentAccessCopy {
  return isEnglish ? AGENT_ACCESS_COPY.en : AGENT_ACCESS_COPY.ar;
}
