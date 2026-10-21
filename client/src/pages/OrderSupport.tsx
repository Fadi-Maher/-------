import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bot,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Headset,
  Loader2,
  LockKeyhole,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { AssistantAvatar } from "@/components/AssistantAvatar";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  redactSupportText,
  supportIntents,
  type SupportReply,
  type SupportTurn,
} from "@shared/orderSupport";
import { toast } from "sonner";
import { ConversationFeedback } from "@/components/support/ConversationFeedback";
import { SupportTypingIndicator } from "@/components/support/SupportTypingIndicator";
import { SupportQuickReplies } from "@/components/support/SupportQuickReplies";

const STORAGE = "maalamati_order_support_token_v1";
const EMPTY_TOKEN = "0".repeat(64);
type UiMessage = {
  id: string;
  sender: "user" | "bot" | "human" | "system";
  content: string;
  createdAt: number;
  reply?: SupportReply | null;
  pending?: boolean;
};
type Payload = {
  language: "ar" | "en";
  turns: SupportTurn[];
  token?: string;
  turnId: string;
};
const topicIcons = [
  MessageSquare,
  FileText,
  Clock3,
  RefreshCw,
  Trash2,
  FileText,
  BadgeCheck,
  UserRound,
  Plus,
];
function storedToken() {
  try {
    const value = localStorage.getItem(STORAGE);
    return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}
export default function OrderSupport() {
  const { isEnglish } = useLanguage();
  const en = isEnglish;
  const lang = en ? "en" : "ar";
  const t = (ar: string, english: string) => (en ? english : ar);
  const [token, setToken] = useState<string | null>(storedToken);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [failed, setFailed] = useState<Payload | null>(null);
  const [dialog, setDialog] = useState<
    "handoff" | "save" | "forget" | "new" | "end" | null
  >(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [ended, setEnded] = useState(false);
  const [feedbackId, setFeedbackId] = useState(() => crypto.randomUUID());
  const viewport = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();
  const config = trpc.orderSupport.config.useQuery(undefined, { retry: 1 });
  const history = trpc.orderSupport.history.useQuery(
    { token: token ?? EMPTY_TOKEN },
    {
      enabled: Boolean(token),
      retry: false,
      refetchOnWindowFocus: Boolean(token),
      refetchInterval: q =>
        q.state.data?.status === "waiting" || q.state.data?.status === "human"
          ? 5000
          : false,
      refetchIntervalInBackground: false,
    }
  );
  const state = ended ? "closed" : (history.data?.status ?? "bot");
  const handoffActive = state === "waiting" || state === "human";
  const start = trpc.orderSupport.start.useMutation();
  const send = trpc.orderSupport.send.useMutation();
  const handoff = trpc.orderSupport.handoff.useMutation();
  const forget = trpc.orderSupport.forget.useMutation();
  const finish = trpc.orderSupport.finish.useMutation();
  const feedback = trpc.orderSupport.feedback.useMutation();
  const busy =
    start.isPending ||
    send.isPending ||
    handoff.isPending ||
    forget.isPending ||
    finish.isPending ||
    feedback.isPending;
  const blocked =
    config.isLoading ||
    config.isError ||
    Boolean(token && (history.isLoading || history.isError)) ||
    state === "closed" ||
    (!config.data?.enabled && !handoffActive);
  useEffect(() => {
    if (!history.data) return;
    setMessages(
      history.data.messages.map(m => {
        let reply: SupportReply | null = null;
        try {
          reply = m.metadata ? JSON.parse(m.metadata) : null;
        } catch {}
        return { ...m, reply };
      })
    );
    setRestored(true);
  }, [history.data]);
  useEffect(() => {
    const element = viewport.current;
    if (
      (messages.length > 0 || send.isPending) &&
      element &&
      element.scrollHeight - element.scrollTop - element.clientHeight < 360
    )
      element.scrollTop = element.scrollHeight;
  }, [messages, send.isPending]);
  useEffect(() => {
    if (state === "closed" && viewport.current)
      viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [state]);
  const lastReply = [...messages]
    .reverse()
    .find(m => m.sender === "bot" && m.reply)?.reply;
  const turns = messages
    .filter(m => m.sender === "user" || m.sender === "bot")
    .map(m => ({
      role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));
  async function submitFeedback(stars: number, comment: string) {
    const result = await feedback.mutateAsync({
      id: feedbackId,
      token: token ?? undefined,
      language: lang,
      stars,
      comment,
      consent: true,
      finished: true,
    });
    if (token) void utils.orderSupport.history.invalidate({ token });
    return result.stars;
  }
  function resetConversation() {
    setMessages([]);
    setInput("");
    setSelected(null);
    setFailed(null);
    setEnded(false);
    setFeedbackId(crypto.randomUUID());
  }
  async function saveConversation() {
    const result = await start.mutateAsync({
      language: lang,
      consent: true,
      turns: turns.slice(-20),
    });
    setToken(result.token);
    try {
      localStorage.setItem(STORAGE, result.token);
    } catch {
      toast.warning(
        t(
          "تعذر حفظ مفتاح الاستعادة في المتصفح. لا تغلق الصفحة أثناء انتظار الرد.",
          "The restore key could not be saved. Keep this page open while waiting for a reply."
        )
      );
    }
    return result.token;
  }
  async function perform(payload: Payload) {
    setFailed(null);
    const optimistic: UiMessage = {
      id: payload.turnId,
      sender: "user",
      pending: true,
      content: redactSupportText(payload.turns.at(-1)!.content),
      createdAt: Date.now(),
    };
    setMessages(current =>
      current.some(m => m.id === optimistic.id)
        ? current
        : [...current, optimistic]
    );
    try {
      const result = await send.mutateAsync(payload);
      setMessages(current =>
        current.map(m =>
          m.id === payload.turnId ? { ...m, pending: false } : m
        )
      );
      if (result.reply)
        setMessages(current => [
          ...current,
          {
            id: `${payload.turnId}-reply`,
            sender: "bot",
            content: result.reply!.text,
            reply: result.reply,
            createdAt: Date.now(),
          },
        ]);
      setInput("");
      if (payload.token)
        await utils.orderSupport.history.invalidate({ token: payload.token });
      composer.current?.focus();
      requestAnimationFrame(() => {
        if (viewport.current)
          viewport.current.scrollTop = viewport.current.scrollHeight;
      });
    } catch {
      setMessages(current => current.filter(m => m.id !== payload.turnId));
      setFailed(payload);
      setInput(payload.turns.at(-1)!.content);
    }
  }
  function sendMessage(content: string, intent?: string) {
    if (!content.trim() || busy || blocked) return;
    setSelected(intent ?? selected);
    void perform({
      language: lang,
      turns: [
        ...turns,
        {
          role: "user" as const,
          content: redactSupportText(content.trim().slice(0, 600)),
        },
      ].slice(-20),
      token: token ?? undefined,
      turnId: crypto.randomUUID(),
    });
  }
  async function confirmDialog() {
    try {
      if (dialog === "end") {
        if (token) await finish.mutateAsync({ token });
        setEnded(true);
        setFailed(null);
        setInput("");
        if (token) void utils.orderSupport.history.invalidate({ token });
      } else if (dialog === "save") {
        await saveConversation();
        toast.success(
          t("تم تفعيل الحفظ الاختياري.", "Optional saving enabled.")
        );
      } else if (dialog === "handoff") {
        const currentToken = token ?? (await saveConversation());
        await handoff.mutateAsync({ token: currentToken, consent: true });
        await utils.orderSupport.history.invalidate({ token: currentToken });
        toast.success(
          t(
            "أُرسلت المحادثة إلى صندوق الدعم.",
            "Conversation sent to the support inbox."
          )
        );
      } else {
        if (token) await forget.mutateAsync({ token });
        try {
          localStorage.removeItem(STORAGE);
        } catch {}
        setToken(null);
        setRestored(false);
        if (dialog === "new") resetConversation();
        toast.success(
          t(
            "حُذف السجل المحفوظ وأُزيل مفتاح الاستعادة.",
            "Saved history and restore key deleted."
          )
        );
      }
      setDialog(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t(
              "تعذر تنفيذ العملية. حاول مجددًا.",
              "Could not complete this action. Try again."
            )
      );
    }
  }
  const statusLabel = t(
    state === "waiting"
      ? "بانتظار فريق الدعم"
      : state === "human"
        ? "محادثة مع فريق الدعم"
        : state === "closed"
          ? "المحادثة مغلقة"
          : "مساعد آلي · إجابات فورية",
    state === "waiting"
      ? "Waiting for support"
      : state === "human"
        ? "Conversation with support"
        : state === "closed"
          ? "Conversation closed"
          : "Automated assistant · instant guidance"
  );
  return (
    <div
      className="support-page min-h-screen bg-background text-foreground"
      dir={en ? "ltr" : "rtl"}
    >
      <a
        href="#support-composer"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:z-50 focus:rounded-xl focus:bg-white focus:p-4"
      >
        {t("تجاوز إلى المحادثة", "Skip to conversation")}
      </a>
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex h-[76px] max-w-[1320px] items-center justify-between gap-3 px-4 sm:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <BrandMark className="h-10 w-10 rounded-xl" />
            <div>
              <span className="font-display block text-lg font-extrabold sm:text-xl">
                {t("معاملاتي كير", "Maalamati Care")}
              </span>
              <span className="hidden text-xs text-muted-foreground sm:block">
                {t(
                  "معاملاتك، بخطوات أوضح",
                  "Your requests, with clearer next steps"
                )}
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3 sm:gap-6">
            <Link
              href="/customer-account"
              className="hidden items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary sm:flex"
            >
              <UserRound className="h-4 w-4" />
              {t("طلباتي", "My requests")}
            </Link>
            <LanguageToggle />
            <Link
              href="/"
              className="grid h-10 w-10 place-items-center rounded-xl border border-border text-muted-foreground hover:bg-secondary"
              aria-label={t("العودة للرئيسية", "Back to home")}
            >
              {en ? (
                <ArrowLeft className="h-4 w-4" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1320px] px-4 pb-8 pt-7 sm:px-8 sm:pt-9">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Link href="/contact" className="hover:text-primary">
                {t("مركز المساعدة", "Help center")}
              </Link>
              {en ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronLeft className="h-3 w-3" />
              )}
              <span className="text-primary">
                {t("دعم الطلبات", "Request support")}
              </span>
            </p>
            <h1 className="font-display text-[27px] font-extrabold tracking-tight sm:text-4xl">
              {t("كل سؤال، خطوة أوضح.", "A clearer next step.")}
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {t(
                "إجابات تساعدك على متابعة طلبك. ومساعدة بشرية عندما تحتاجها.",
                "Guidance for your requests. Human support when you need it."
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {t(
              "لن نطلب بياناتك الحساسة",
              "We will not ask for sensitive information"
            )}
          </div>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[258px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="mb-3 flex items-center gap-2 px-2 text-xs font-bold text-muted-foreground">
              <CircleHelp className="h-4 w-4" />
              {t("بماذا نساعدك؟", "How can we help?")}
            </div>
            <nav
              aria-label={t("موضوعات الدعم", "Support topics")}
              className="space-y-1"
            >
              {supportIntents.map((topic, index) => {
                const Icon = topicIcons[index];
                return (
                  <button
                    key={topic.id}
                    type="button"
                    disabled={busy || blocked || handoffActive}
                    onClick={() =>
                      sendMessage(
                        en ? topic.promptEn : topic.promptAr,
                        topic.id
                      )
                    }
                    aria-pressed={selected === topic.id}
                    className={`support-topic flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors disabled:opacity-50 ${selected === topic.id ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:bg-white hover:text-foreground"}`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="flex-1 text-sm font-semibold">
                      {en ? topic.en : topic.ar}
                    </span>
                    {selected === topic.id ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    ) : null}
                  </button>
                );
              })}
            </nav>
            <div className="mt-6 rounded-2xl bg-foreground p-5 text-white">
              <div className="mb-3 flex items-center gap-2 text-accent">
                <LockKeyhole className="h-5 w-5" />
                <span className="text-sm font-bold">
                  {t("خصوصيتك أولًا", "Privacy comes first")}
                </span>
              </div>
              <p className="text-xs leading-6 text-white/80">
                {t(
                  "لا ترسل رقم الجوال أو الهوية أو رموز التحقق أو المستندات هنا. بيانات طلبك تبقى في حسابك المحمي.",
                  "Never share mobile numbers, IDs, codes or documents here. Request details belong in your protected account."
                )}
              </p>
              <Link
                href="/customer-account"
                className="mt-4 flex items-center gap-2 text-xs font-bold text-white hover:text-accent"
              >
                {t("فتح حسابي الآمن", "Open my account")}
                {en ? (
                  <ArrowRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowLeft className="h-3.5 w-3.5" />
                )}
              </Link>
            </div>
            <p className="mt-4 px-1 text-[11px] leading-6 text-muted-foreground">
              {t(
                "إرشاد عام فقط. لا ينفذ المساعد دفعًا أو إلغاءً أو تعديلًا لطلب.",
                "General guidance only. The assistant cannot pay, cancel or change a request."
              )}
            </p>
          </aside>
          <section
            aria-label={t("محادثة دعم الطلبات", "Request support conversation")}
            className="support-chat flex h-[min(750px,calc(100dvh-110px))] min-h-[540px] flex-col overflow-hidden rounded-[22px] border border-border bg-white shadow-[0_12px_40px_rgba(25,93,164,.065)] sm:min-h-[620px]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border p-4 sm:px-6 sm:py-5">
              <div className="flex items-center gap-3">
                <div className="relative h-11 w-11 shrink-0 rounded-2xl border border-border bg-secondary p-1">
                  <AssistantAvatar />
                  <span className="absolute -bottom-1 -end-1 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-primary text-white">
                    <Bot className="h-3 w-3" />
                  </span>
                </div>
                <div>
                  <h2 className="text-sm font-extrabold sm:text-base">
                    {t("مساعد الطلبات", "Request assistant")}
                  </h2>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${handoffActive ? "bg-primary" : "bg-muted-foreground"}`}
                    />
                    {statusLabel}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && state !== "closed" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy || Boolean(token && history.isError)}
                    onClick={() => setDialog("end")}
                    className="h-10 rounded-xl px-2 text-xs text-primary"
                  >
                    {t("إنهاء", "End chat")}
                    <span className="sr-only">
                      {t("المحادثة", "conversation")}
                    </span>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    token ? setDialog("new") : resetConversation()
                  }
                  disabled={busy}
                  className="h-10 gap-1.5 rounded-xl text-muted-foreground"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {t("محادثة جديدة", "New chat")}
                  </span>
                  <span className="sr-only sm:hidden">
                    {t("محادثة جديدة", "New chat")}
                  </span>
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/35 px-4 py-2.5 sm:px-6">
              <p className="flex items-center gap-2 text-[11px] leading-5 text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                {token
                  ? t(
                      "حفظ اختياري · الاستعادة من هذا المتصفح لمدة 30 يومًا",
                      "Optional saving · restore from this browser for 30 days"
                    )
                  : t(
                      "دون حفظ سجل · تُجمع إحصاءات مجهولة بلا نصوص",
                      "No saved history · anonymous counts without message text"
                    )}
              </p>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={
                  busy ||
                  Boolean(token && history.isLoading) ||
                  state === "closed"
                }
                onClick={() =>
                  token ? setDialog("forget") : setDialog("save")
                }
                className="h-8 shrink-0 px-1 text-[11px] font-bold text-primary"
              >
                {token
                  ? t("إيقاف الحفظ", "Stop saving")
                  : t("تفعيل الحفظ", "Enable saving")}
              </Button>
            </div>
            {token && history.isLoading ? (
              <div
                role="status"
                className="flex flex-1 items-center justify-center gap-3 p-8 text-sm text-muted-foreground"
              >
                <Loader2 className="h-5 w-5 animate-spin" />
                {t("جارٍ استعادة محادثتك…", "Restoring your conversation…")}
              </div>
            ) : (
              <div
                ref={viewport}
                role="log"
                aria-label={t("سجل رسائل الدعم", "Support message log")}
                aria-live="polite"
                aria-relevant="additions"
                className="support-message-area flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-6 sm:px-7"
              >
                {messages.length === 0 ? (
                  <div className="support-welcome">
                    <div className="mb-5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      {t("بداية محادثة جديدة", "A new conversation")}
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    <div className="mb-5 max-w-lg rounded-2xl rounded-ss-sm bg-background p-5">
                      <p className="mb-2 text-sm font-bold">
                        {t(
                          "أهلًا بك في معاملاتي كير",
                          "Welcome to Maalamati Care"
                        )}
                      </p>
                      <p className="text-sm leading-7 text-muted-foreground">
                        {t(
                          "أنا مساعدك الآلي لدعم الطلبات. اختر موضوعًا أو اكتب سؤالك، وسأساعدك في الوصول إلى الخطوة الصحيحة.",
                          "I am your automated request support assistant. Choose a topic or ask a question and I will guide you to the right next step."
                        )}
                      </p>
                    </div>
                    <p className="mb-3 text-xs font-semibold text-muted-foreground">
                      {t("ابدأ بسؤال شائع", "Start with a common question")}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {supportIntents.slice(0, 6).map((topic, index) => {
                        const Icon = topicIcons[index];
                        return (
                          <button
                            type="button"
                            key={topic.id}
                            onClick={() =>
                              sendMessage(
                                en ? topic.promptEn : topic.promptAr,
                                topic.id
                              )
                            }
                            disabled={busy || blocked}
                            className="support-quick flex items-center gap-3 rounded-xl border border-border bg-white p-3.5 text-start hover:border-primary/50 hover:bg-secondary/40 disabled:opacity-50"
                          >
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="flex-1">
                              <span className="block text-xs font-bold sm:text-sm">
                                {en ? topic.en : topic.ar}
                              </span>
                              <span className="mt-1 block text-[10px] leading-5 text-muted-foreground">
                                {en ? topic.descriptionEn : topic.descriptionAr}
                              </span>
                            </span>
                            {en ? (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <>
                    {restored && token ? (
                      <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                        <RefreshCw className="h-3 w-3" />
                        {t(
                          "سجل محفوظ من هذا المتصفح",
                          "Saved history from this browser"
                        )}
                      </div>
                    ) : null}
                    {messages.map(m =>
                      m.sender === "system" ? (
                        <div
                          key={m.id}
                          className="mx-auto max-w-lg rounded-xl border border-border bg-secondary/40 px-4 py-3 text-center text-xs leading-6 text-muted-foreground"
                        >
                          {m.content}
                        </div>
                      ) : (
                        <div
                          key={m.id}
                          className={`lb-msg-in flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div className="max-w-[92%] sm:max-w-[85%]">
                            <p
                              className={`mb-1.5 text-[10px] text-muted-foreground ${m.sender === "user" ? "text-end" : ""}`}
                            >
                              {m.sender === "user"
                                ? t("أنت", "You")
                                : m.sender === "human"
                                  ? t(
                                      "فريق الدعم · رد بشري",
                                      "Support team · human reply"
                                    )
                                  : t(
                                      "مساعد الطلبات · رد آلي",
                                      "Request assistant · automated reply"
                                    )}
                            </p>
                            <div
                              className={`rounded-2xl px-4 py-3.5 ${m.sender === "user" ? "rounded-se-sm bg-foreground text-white" : m.sender === "human" ? "rounded-ss-sm border border-primary/20 bg-secondary text-foreground" : "rounded-ss-sm bg-background text-foreground"}`}
                            >
                              <p className="whitespace-pre-wrap break-words text-sm leading-7">
                                {m.content}
                              </p>
                              {m.reply?.actions.length ? (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {m.reply.actions.map(a => (
                                    <Link
                                      key={a.href}
                                      href={a.href}
                                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/20 bg-white px-3 text-xs font-bold text-primary hover:bg-primary hover:text-white"
                                    >
                                      {a.label}
                                      {en ? (
                                        <ArrowRight className="h-3 w-3" />
                                      ) : (
                                        <ArrowLeft className="h-3 w-3" />
                                      )}
                                    </Link>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <p
                              className={`mt-1 flex items-center gap-1 text-[9px] text-muted-foreground ${m.sender === "user" ? "justify-end" : ""}`}
                            >
                              {new Date(m.createdAt).toLocaleTimeString(
                                en ? "en" : "ar",
                                { hour: "2-digit", minute: "2-digit" }
                              )}
                              {m.sender === "user" ? (
                                m.pending ? (
                                  <Clock3
                                    className="h-3 w-3"
                                    aria-label={t("قيد الإرسال", "Sending")}
                                  />
                                ) : (
                                  <CheckCheck
                                    className="h-3 w-3"
                                    aria-label={t("أُرسلت", "Sent")}
                                  />
                                )
                              ) : null}
                            </p>
                          </div>
                        </div>
                      )
                    )}
                    {lastReply?.suggestions.length &&
                    !handoffActive &&
                    state !== "closed" ? (
                      <div className="flex flex-wrap gap-2">
                        {lastReply.suggestions.map(s => (
                          <button
                            type="button"
                            key={s}
                            onClick={() => sendMessage(s)}
                            disabled={busy || blocked}
                            className="min-h-10 rounded-full border border-border px-3 text-xs font-semibold text-primary hover:bg-secondary disabled:opacity-50"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
                {send.isPending ? (
                  handoffActive ? (
                    <div
                      role="status"
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                      {t("جارٍ إرسال الرسالة…", "Sending your message…")}
                    </div>
                  ) : (
                    <SupportTypingIndicator isEnglish={en} />
                  )
                ) : null}
                {state === "closed" && !history.isError ? (
                  <ConversationFeedback
                    key={token ?? feedbackId}
                    isEnglish={en}
                    savedStars={history.data?.feedback?.stars}
                    onSubmit={submitFeedback}
                  />
                ) : null}
              </div>
            )}
            {config.isError || history.isError || failed ? (
              <div
                role="alert"
                className="border-t border-destructive/20 bg-red-50 p-3 text-xs leading-6 text-red-800"
              >
                <p>
                  {history.isError
                    ? t(
                        "تعذرت الاستعادة. لم نحذف محادثتك؛ يمكنك إعادة المحاولة أو بدء محادثة جديدة.",
                        "Restore failed. Your conversation has not been deleted; retry or start a new chat."
                      )
                    : config.isError
                      ? t(
                          "تعذر تحميل خدمة الدعم. حاول مجددًا أو افتح قنوات الدعم.",
                          "Could not load support. Retry or open support channels."
                        )
                      : t(
                          "لم تُرسل الرسالة بنجاح. احتفظنا بها لتعيد المحاولة.",
                          "The message was not sent successfully. It is retained for retry."
                        )}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    failed
                      ? void perform(failed)
                      : history.isError
                        ? void history.refetch()
                        : void config.refetch()
                  }
                  className="mt-1 inline-flex min-h-8 items-center gap-1 font-bold underline"
                >
                  <RefreshCw className="h-3 w-3" />
                  {t("إعادة المحاولة", "Retry")}
                </button>
                <Link href="/contact" className="ms-4 font-bold underline">
                  {t("قنوات الدعم", "Support channels")}
                </Link>
              </div>
            ) : null}
            {!config.isError &&
            !config.isLoading &&
            !config.data?.enabled &&
            !handoffActive ? (
              <div
                role="status"
                className="bg-secondary p-3 text-xs leading-6 text-muted-foreground"
              >
                {t(
                  "المساعد متوقف مؤقتًا. يمكنك فتح قنوات الدعم أو الاطلاع على محادثتك المحفوظة.",
                  "The assistant is temporarily paused. Use support channels or review saved history."
                )}{" "}
                <Link
                  className="font-bold text-primary underline"
                  href="/contact"
                >
                  {t("تواصل ودعم", "Contact support")}
                </Link>
              </div>
            ) : null}
            {handoffActive ? (
              <div
                role="status"
                className="flex items-center gap-2 border-t border-border bg-secondary/50 px-4 py-2.5 text-[11px] leading-5 text-primary"
              >
                <Clock3 className="h-4 w-4 shrink-0" />
                {t(
                  "وصل الطلب إلى صندوق الدعم. يمكنك إضافة رسالة، وسيظهر الرد هنا عند وصوله.",
                  "Support has received the conversation. Add a message if needed; replies will appear here."
                )}
              </div>
            ) : null}
            {!handoffActive && state !== "closed" ? (
              <SupportQuickReplies
                isEnglish={en}
                disabled={busy || blocked}
                onSelect={sendMessage}
              />
            ) : null}
            {state === "closed" ? (
              <div className="border-t border-border p-4 text-center">
                <p className="mb-2 text-xs text-muted-foreground">
                  {t(
                    "أُغلقت المحادثة. تحتاج مساعدة أخرى؟",
                    "This chat is closed. Need more help?"
                  )}
                </p>
                <Button
                  onClick={() =>
                    token ? setDialog("new") : resetConversation()
                  }
                  size="sm"
                >
                  {t("بدء محادثة جديدة", "Start a new chat")}
                </Button>
              </div>
            ) : (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  sendMessage(input);
                }}
                className="border-t border-border bg-white p-3 sm:px-6 sm:py-4"
              >
                <div className="flex items-end gap-2 rounded-2xl border border-input bg-background/40 p-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
                  <label htmlFor="support-composer" className="sr-only">
                    {t("اكتب سؤالك عن الطلب", "Write your request question")}
                  </label>
                  <Textarea
                    id="support-composer"
                    ref={composer}
                    value={input}
                    maxLength={600}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault();
                        sendMessage(input);
                      }
                    }}
                    placeholder={t(
                      "اكتب سؤالك هنا…",
                      "Type your question here…"
                    )}
                    rows={1}
                    disabled={busy || blocked}
                    className="max-h-24 min-h-10 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
                  />
                  <Button
                    type="submit"
                    disabled={!input.trim() || busy || blocked}
                    aria-label={t("إرسال الرسالة", "Send message")}
                    className="h-10 w-10 shrink-0 rounded-xl bg-primary p-0 text-white hover:bg-primary/90"
                  >
                    {send.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className={`h-4 w-4 ${en ? "" : "-scale-x-100"}`} />
                    )}
                  </Button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span>
                    {t(
                      "Enter للإرسال · Shift + Enter لسطر جديد",
                      "Enter to send · Shift + Enter for a new line"
                    )}
                  </span>
                  <span>{input.length}/600</span>
                </div>
              </form>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={() => setDialog("handoff")}
                disabled={
                  busy ||
                  handoffActive ||
                  state === "closed" ||
                  !config.data?.handoffEnabled ||
                  Boolean(token && history.isError)
                }
                className="inline-flex min-h-9 items-center gap-2 rounded-lg px-1 text-xs font-bold text-foreground hover:text-primary disabled:opacity-40"
              >
                <Headset className="h-4 w-4" />
                {t("طلب موظف", "Request a human")}
              </button>
              <span className="text-[10px] text-muted-foreground">
                {t(
                  "إرشاد عام، دون الوصول إلى بيانات طلبك",
                  "General guidance, without accessing your request"
                )}
              </span>
            </div>
          </section>
        </div>
      </main>
      <Dialog
        open={dialog !== null}
        onOpenChange={open => {
          if (!open && !busy) setDialog(null);
        }}
      >
        <DialogContent dir={en ? "ltr" : "rtl"} className="rounded-3xl">
          <DialogHeader>
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">
              {dialog === "end" ? (
                <CheckCheck className="h-5 w-5" />
              ) : dialog === "handoff" || dialog === "save" ? (
                <Headset className="h-6 w-6" />
              ) : (
                <Trash2 className="h-5 w-5" />
              )}
            </div>
            <DialogTitle>
              {dialog === "end"
                ? t("إنهاء المحادثة وتقييمها؟", "End and rate this chat?")
                : dialog === "save"
                  ? t("تفعيل حفظ المحادثة؟", "Enable conversation saving?")
                  : dialog === "handoff"
                    ? t(
                        "إرسال المحادثة إلى فريق الدعم؟",
                        "Send this chat to support?"
                      )
                    : t("حذف السجل المحفوظ؟", "Delete saved history?")}
            </DialogTitle>
            <DialogDescription className="pt-3 text-sm leading-7">
              {dialog === "end"
                ? t(
                    "ستنتهي محادثة الدعم الحالية، ويمكنك تقييم التجربة بالنجوم وترك ملاحظة اختيارية. هذا لا يلغي طلبك ولا يغيّر بياناته. إذا كنت تنتظر ردًا بشريًا، فستنتهي متابعة هذه المحادثة أيضًا.",
                    "This support chat will close, and you may rate it with stars and leave optional feedback. This does not cancel or change your request. If you are waiting for a human reply, follow-up in this conversation will also end."
                  )
                : dialog === "save"
                  ? t(
                      "بموافقتك تُحفظ رسائل هذه المحادثة المحجوبة على الخادم. يُحفظ مفتاح استعادتها في هذا المتصفح؛ يمكن لمن يستخدمه الوصول للمحادثة لمدة 30 يومًا. لا تُربط المحادثة تلقائيًا بحسابك أو رقمك. يمكنك إيقاف الحفظ وحذف السجل في أي وقت.",
                      "With your permission, redacted messages are saved on the server. A restore key is kept in this browser; anyone using it can access the conversation for 30 days. The chat is not linked automatically to your account or mobile number. You can stop saving and delete history at any time."
                    )
                  : dialog === "handoff"
                    ? t(
                        "بالتأكيد توافق على حفظ رسائل هذه المحادثة وإرسالها إلى المالك لمراجعتها والرد هنا. نحجب أنماط البيانات الحساسة، لكن لا ترسل معلومات خاصة. مفتاح الاستعادة محفوظ في هذا المتصفح ويتيح لمن يستخدمه رؤية المحادثة لمدة 30 يومًا. لا يوجد موعد رد مضمون.",
                        "Confirming saves this conversation and sends its messages to the owner for review and a reply here. Sensitive patterns are redacted, but do not share private information. A restore key in this browser allows its users to see this conversation for 30 days. Response time is not guaranteed."
                      )
                    : t(
                        "سيُحذف سجل هذه المحادثة من الخادم ويُزال مفتاح الاستعادة من المتصفح. لا يمكن استعادته بعد الحذف. يمكنك بعدها المتابعة دون حفظ أو بدء محادثة جديدة.",
                        "This chat's history will be deleted from the server and its restore key removed from the browser. It cannot be restored afterwards. You can then continue without saving or start a new chat."
                      )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-3 gap-2">
            <Button
              variant="outline"
              onClick={() => setDialog(null)}
              disabled={busy}
            >
              {t("رجوع", "Back")}
            </Button>
            <Button onClick={() => void confirmDialog()} disabled={busy}>
              {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {dialog === "end"
                ? t("إنهاء وتقييم المحادثة", "End and rate conversation")
                : dialog === "save"
                  ? t("أوافق على الحفظ", "I agree to save")
                  : dialog === "handoff"
                    ? t("أوافق، أرسل إلى الدعم", "I agree, send to support")
                    : t("حذف السجل والمتابعة", "Delete history and continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
