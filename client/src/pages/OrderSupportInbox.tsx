import { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpenText,
  CheckCheck,
  Headset,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Star,
  ThumbsUp,
  Users,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { buildSupportReply, supportIntents } from "@shared/orderSupport";
import { toast } from "sonner";

const statusLabels = {
  bot: "المساعد الآلي",
  waiting: "بانتظار الرد",
  human: "مع الدعم",
  closed: "مغلقة",
};
const emptyId = "00000000-0000-4000-8000-000000000000";
export default function OrderSupportInbox() {
  return (
    <DashboardLayout>
      <Inbox />
    </DashboardLayout>
  );
}
function Inbox() {
  const [tab, setTab] = useState("inbox");
  const [filter, setFilter] = useState<"waiting" | "human" | "closed">(
    "waiting"
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [replyId, setReplyId] = useState(() => crypto.randomUUID());
  const [enabled, setEnabled] = useState(true);
  const [handoffEnabled, setHandoffEnabled] = useState(true);
  const utils = trpc.useUtils();
  const list = trpc.orderSupport.admin.list.useQuery(
    { status: filter },
    {
      enabled: tab === "inbox",
      retry: false,
      refetchInterval: tab === "inbox" ? 10000 : false,
      refetchIntervalInBackground: false,
    }
  );
  const detail = trpc.orderSupport.admin.detail.useQuery(
    { id: selected ?? emptyId },
    {
      enabled: Boolean(selected) && tab === "inbox",
      retry: false,
      refetchInterval: selected && tab === "inbox" ? 5000 : false,
      refetchIntervalInBackground: false,
    }
  );
  const analytics = trpc.orderSupport.admin.analytics.useQuery(undefined, {
    enabled: tab === "analytics",
    retry: false,
  });
  const config = trpc.orderSupport.config.useQuery(undefined, {
    enabled: tab === "settings",
    retry: false,
  });
  useEffect(() => {
    if (config.data) {
      setEnabled(config.data.enabled);
      setHandoffEnabled(config.data.handoffEnabled);
    }
  }, [config.data]);
  const respond = trpc.orderSupport.admin.reply.useMutation({
    onSuccess: async () => {
      setReply("");
      setReplyId(crypto.randomUUID());
      await Promise.all([
        utils.orderSupport.admin.detail.invalidate(),
        utils.orderSupport.admin.list.invalidate(),
      ]);
      toast.success("تم إرسال الرد إلى محادثة العميل.");
    },
    onError: e => toast.error(e.message),
  });
  const close = trpc.orderSupport.admin.close.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.orderSupport.admin.detail.invalidate(),
        utils.orderSupport.admin.list.invalidate(),
      ]);
      toast.success("أُغلقت المحادثة.");
    },
    onError: e => toast.error(e.message),
  });
  const configure = trpc.orderSupport.admin.configure.useMutation({
    onSuccess: async () => {
      await utils.orderSupport.config.invalidate();
      toast.success("حُفظت إعدادات الدعم.");
    },
    onError: e => toast.error(e.message),
  });
  const events = analytics.data?.events ?? [];
  const total = (kind: string) =>
    events
      .filter(e => e.kind === kind)
      .reduce((sum, e) => sum + Number(e.total), 0);
  const answers = total("answer");
  const feedback = total("helpful") + total("unhelpful");
  const starCount = analytics.data?.feedbackSummary.total ?? 0;
  const starAverage = analytics.data?.feedbackSummary.average;
  const waiting = Number(
    analytics.data?.statuses.find(s => s.status === "waiting")?.total ?? 0
  );
  const topicName = (id: string) =>
    supportIntents.find(i => i.id === id)?.ar ??
    (
      {
        fallback: "غير مفهوم",
        human: "مساعدة بشرية",
        knowledge: "قاعدة المعرفة",
        greeting: "الترحيب",
        privacy: "الخصوصية",
      } as Record<string, string>
    )[id] ??
    id;
  return (
    <section className="mx-auto max-w-6xl" dir="rtl">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="section-kicker">دعم الطلبات</p>
          <h1 className="font-display mt-3 text-3xl font-extrabold">
            محادثات تحتاج اهتمامك
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            ردود المساعد، تصعيد العملاء، ومتابعة بشرية في مساحة واحدة. الوصول
            للمالك فقط.
          </p>
        </div>
        <a
          href="/support"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-xs font-bold text-primary"
        >
          <Headset className="h-4 w-4" />
          معاينة مساعد الطلبات
        </a>
      </div>
      <Tabs value={tab} onValueChange={setTab} dir="rtl">
        <TabsList className="h-auto flex-wrap rounded-2xl border border-border bg-white p-1">
          <TabsTrigger value="inbox" className="gap-2 rounded-xl px-4 py-3">
            <MessageSquare className="h-4 w-4" />
            صندوق الدعم
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2 rounded-xl px-4 py-3">
            <BarChart3 className="h-4 w-4" />
            التحليلات
          </TabsTrigger>
          <TabsTrigger value="intents" className="gap-2 rounded-xl px-4 py-3">
            <BookOpenText className="h-4 w-4" />
            النوايا والردود
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2 rounded-xl px-4 py-3">
            <Settings2 className="h-4 w-4" />
            الإعدادات
          </TabsTrigger>
        </TabsList>
        <TabsContent value="inbox" className="mt-5">
          <div className="grid min-h-[600px] overflow-hidden rounded-3xl border border-border bg-white lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="border-b border-border lg:border-b-0 lg:border-l">
              <div className="flex flex-wrap items-center gap-1 border-b border-border p-3">
                {(["waiting", "human", "closed"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => {
                      setFilter(s);
                      setSelected(null);
                      setReply("");
                    }}
                    className={`min-h-10 rounded-lg px-3 text-xs font-bold ${filter === s ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-background"}`}
                  >
                    {statusLabels[s]}
                  </button>
                ))}
                <button
                  className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
                  aria-label="تحديث صندوق الدعم"
                  onClick={() => void list.refetch()}
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              {list.isLoading ? (
                <Loading text="تحميل المحادثات…" />
              ) : list.isError ? (
                <ErrorState
                  text={list.error.message}
                  retry={() => void list.refetch()}
                />
              ) : !list.data?.length ? (
                <Empty
                  title="لا توجد محادثات في هذه الحالة"
                  text="تظهر هنا المحادثات التي يؤكد العميل إرسالها إلى الدعم. لا توجد بيانات تجريبية."
                />
              ) : (
                <div className="max-h-[540px] overflow-y-auto p-2">
                  {list.data.map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelected(item.id);
                        setReply("");
                        setReplyId(crypto.randomUUID());
                      }}
                      className={`mb-1 w-full rounded-xl p-4 text-start transition-colors ${selected === item.id ? "bg-secondary" : "hover:bg-background"}`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-extrabold">
                          محادثة {item.id.slice(0, 6)}
                        </span>
                        <span className="text-[10px] text-primary">
                          {statusLabels[item.status]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {topicName(item.intent)} ·{" "}
                        {item.language === "ar" ? "العربية" : "English"}
                      </p>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {new Date(item.updatedAt).toLocaleString("ar", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex min-h-[520px] flex-col">
              {!selected ? (
                <div className="flex flex-1 items-center justify-center">
                  <Empty
                    title="اختر محادثة لبدء المراجعة"
                    text="راجع سياق العميل ثم أرسل ردًا واضحًا. بيانات الطلب الخاصة لا تظهر في هذا الصندوق."
                  />
                </div>
              ) : detail.isLoading ? (
                <Loading text="تحميل سجل المحادثة…" />
              ) : detail.isError ? (
                <ErrorState
                  text={detail.error.message}
                  retry={() => void detail.refetch()}
                />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
                    <div>
                      <h2 className="text-sm font-bold">
                        محادثة {selected.slice(0, 6)}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {statusLabels[detail.data?.status ?? "waiting"]} ·{" "}
                        {topicName(detail.data?.intent ?? "")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        close.isPending || detail.data?.status === "closed"
                      }
                      onClick={() => {
                        if (window.confirm("إغلاق المحادثة وإبلاغ العميل؟"))
                          close.mutate({ id: selected });
                      }}
                      className="gap-1 rounded-xl"
                    >
                      <CheckCheck className="h-4 w-4" />
                      إغلاق
                    </Button>
                  </div>
                  <div
                    role="log"
                    aria-label="رسائل المحادثة المصعّدة"
                    className="max-h-[480px] flex-1 space-y-4 overflow-y-auto p-5"
                  >
                    {detail.data?.messages.map(m => (
                      <div
                        key={m.id}
                        className={
                          m.sender === "human"
                            ? "ms-auto max-w-[90%]"
                            : "max-w-[90%]"
                        }
                      >
                        <p className="mb-1 text-[10px] text-muted-foreground">
                          {m.sender === "human"
                            ? "فريق الدعم"
                            : m.sender === "user"
                              ? "العميل"
                              : m.sender === "bot"
                                ? "المساعد الآلي"
                                : "النظام"}
                        </p>
                        <p
                          className={`whitespace-pre-wrap break-words rounded-xl p-3 text-sm leading-7 ${m.sender === "human" ? "bg-primary text-white" : m.sender === "system" ? "border border-border text-muted-foreground" : "bg-background"}`}
                        >
                          {m.content}
                        </p>
                      </div>
                    ))}
                  </div>
                  {detail.data?.status !== "closed" ? (
                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        if (reply.trim())
                          respond.mutate({
                            id: selected,
                            content: reply.trim(),
                            turnId: replyId,
                          });
                      }}
                      className="border-t border-border p-4"
                    >
                      <label
                        htmlFor="human-support-reply"
                        className="mb-2 block text-xs font-bold"
                      >
                        رد بشري يصل إلى المحادثة نفسها
                      </label>
                      <Textarea
                        id="human-support-reply"
                        value={reply}
                        onChange={e => {
                          setReply(e.target.value);
                          setReplyId(crypto.randomUUID());
                        }}
                        maxLength={1200}
                        placeholder="اكتب ردك بعد مراجعة المحادثة…"
                        rows={3}
                        disabled={respond.isPending}
                        className="bg-background"
                      />
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <p className="text-[10px] leading-5 text-muted-foreground">
                          لا تطلب كلمات مرور أو رموز تحقق أو بيانات بطاقة.
                        </p>
                        <Button
                          type="submit"
                          disabled={!reply.trim() || respond.isPending}
                          className="gap-2 rounded-xl"
                        >
                          {respond.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          إرسال الرد
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <p className="border-t border-border p-4 text-center text-xs text-muted-foreground">
                      المحادثة مغلقة. السجل للقراءة فقط.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-6 text-muted-foreground">
            آخر 200 محادثة ضمن مدة الاستعادة البالغة 30 يومًا. تُحدّث المحادثات
            أثناء فتح الصندوق فقط.
          </p>
        </TabsContent>
        <TabsContent value="analytics" className="mt-5">
          {analytics.isLoading ? (
            <Loading text="تحميل التحليلات…" />
          ) : analytics.isError ? (
            <ErrorState
              text={analytics.error.message}
              retry={() => void analytics.refetch()}
            />
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  آخر 30 يومًا · أحداث فعلية وتقييمات بموافقة المستخدم
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void analytics.refetch()}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  تحديث
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "الردود الآلية",
                    value: answers,
                    icon: MessageSquare,
                  },
                  {
                    label: "طلبات التصعيد",
                    value: total("handoff"),
                    icon: Users,
                  },
                  { label: "بانتظار أول رد", value: waiting, icon: Headset },
                  {
                    label: "تقييمات مفيدة",
                    value: feedback
                      ? `${Math.round((total("helpful") / feedback) * 100)}%`
                      : "—",
                    icon: ThumbsUp,
                  },
                ].map(c => (
                  <article
                    key={c.label}
                    className="rounded-2xl border border-border bg-white p-5"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {c.label}
                      </p>
                      <c.icon className="h-4 w-4 text-primary" />
                    </div>
                    <p className="mt-5 text-3xl font-extrabold">{c.value}</p>
                    {c.label === "تقييمات مفيدة" ? (
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        من {feedback} تقييم لمحادثات محفوظة
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
              <article className="mt-5 rounded-3xl border border-border bg-white p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                      <Star className="h-5 w-5 text-primary" />
                      تقييم تجربة الدعم
                    </h2>
                    <p className="mt-2 text-xs text-muted-foreground">
                      نجوم تُرسل بعد انتهاء المحادثة؛ لا تُحوّل التقييمات
                      القديمة إلى نجوم افتراضية.
                    </p>
                  </div>
                  <div className="text-end">
                    <span className="text-3xl font-extrabold">
                      {starAverage == null ? "—" : starAverage.toFixed(1)}
                    </span>
                    <span className="ms-1 text-sm text-muted-foreground">
                      /5
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      من {starCount} تقييم
                    </p>
                  </div>
                </div>
                {starCount === 0 ? (
                  <Empty
                    title="لا توجد تقييمات بالنجوم بعد"
                    text="تظهر هنا التقييمات التي يرسلها المستخدمون اختيارياً بعد إنهاء المحادثة. لا نعرض متوسطًا افتراضيًا."
                  />
                ) : (
                  <div className="space-y-3">
                    {[5, 4, 3, 2, 1].map(stars => {
                      const total = Number(
                        analytics.data?.feedbackDistribution.find(
                          r => r.stars === stars
                        )?.total ?? 0
                      );
                      return (
                        <div key={stars} className="flex items-center gap-3">
                          <span className="flex w-10 items-center gap-1 text-xs font-bold">
                            {stars}
                            <Star className="h-3 w-3 text-primary" />
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${(total / starCount) * 100}%` }}
                            />
                          </div>
                          <span className="w-7 text-end text-xs text-muted-foreground">
                            {total}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <h3 className="mb-3 mt-6 text-sm font-bold">
                  ملاحظات المستخدمين الأخيرة
                </h3>
                {!analytics.data?.feedbackComments.length ? (
                  <p className="text-xs leading-6 text-muted-foreground">
                    لا توجد ملاحظات نصية بعد؛ إرسال الملاحظة اختياري.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {analytics.data.feedbackComments.map(item => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border bg-background/45 p-4"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1 text-xs font-bold text-primary">
                            <Star className="h-3 w-3" />
                            {item.stars}/5
                          </span>
                          <time className="text-[10px] text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString("ar")}
                          </time>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-xs leading-7">
                          {item.comment}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-4 text-[10px] leading-6 text-muted-foreground">
                  آخر 20 ملاحظة منقّحة ضمن 30 يومًا. النصوص بيانات غير موثوقة
                  للعرض فقط، ولا تظهر إلا للمالك.
                </p>
              </article>
              <article className="mt-5 rounded-3xl border border-border bg-white p-6">
                <h2 className="mb-5 font-display text-lg font-bold">
                  الموضوعات الأكثر استخدامًا
                </h2>
                {answers === 0 ? (
                  <Empty
                    title="التحليلات فارغة الآن"
                    text="ستظهر الموضوعات عند استخدام العملاء للمساعد. لا نعرض نسب نجاح أو بيانات افتراضية."
                  />
                ) : (
                  <div className="space-y-5">
                    {events
                      .filter(e => e.kind === "answer")
                      .sort((a, b) => Number(b.total) - Number(a.total))
                      .map(e => (
                        <div key={e.intent}>
                          <div className="mb-2 flex justify-between text-xs">
                            <span className="font-semibold">
                              {topicName(e.intent)}
                            </span>
                            <span className="text-muted-foreground">
                              {Number(e.total)} رد
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{
                                width: `${(Number(e.total) / answers) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )}
                <p className="mt-6 text-[11px] leading-6 text-muted-foreground">
                  «غير مفهوم» يرصد الحاجة إلى تحسين الردود. التصعيد ليس حلًا
                  مكتملًا؛ لا تُحسب له نسبة نجاح مصطنعة.
                </p>
              </article>
            </>
          )}
        </TabsContent>
        <TabsContent value="intents" className="mt-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
              نوايا محددة وردود إرشادية دون تنفيذ تغييرات على الطلبات. أسئلة
              المتابعة مثل «قبل الاعتماد» و«بعد الاعتماد» تستخدم سياق السؤال
              السابق.
            </p>
            <a
              href="/settings/assistant"
              className="text-xs font-bold text-primary underline"
            >
              إدارة الأسئلة المعتمدة
            </a>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {supportIntents.map(i => {
              const sample = buildSupportReply("ar", [
                { role: "user", content: i.promptAr },
              ]);
              return (
                <article
                  key={i.id}
                  className="rounded-2xl border border-border bg-white p-5"
                >
                  <h2 className="font-display text-sm font-extrabold">
                    {i.ar}
                  </h2>
                  <p className="mb-3 mt-1 text-xs text-primary">{i.promptAr}</p>
                  <p className="whitespace-pre-wrap text-xs leading-7 text-muted-foreground">
                    {sample.text}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sample.actions.map(a => (
                      <span
                        key={a.href}
                        className="rounded-lg bg-secondary px-2 py-1.5 text-[10px] font-semibold text-primary"
                      >
                        {a.label}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="settings" className="mt-5">
          {config.isLoading ? (
            <Loading text="تحميل الإعدادات…" />
          ) : config.isError ? (
            <ErrorState
              text={config.error.message}
              retry={() => void config.refetch()}
            />
          ) : (
            <article className="max-w-3xl rounded-3xl border border-border bg-white p-6">
              <h2 className="font-display text-lg font-extrabold">
                ضوابط مساعد الطلبات
              </h2>
              <div className="mt-6 space-y-6">
                <label className="flex items-start justify-between gap-5">
                  <div>
                    <span className="block text-sm font-bold">
                      الردود الآلية
                    </span>
                    <span className="mt-2 block text-xs leading-6 text-muted-foreground">
                      إيقافها يعرض حالة صيانة للعميل. تبقى الردود البشرية
                      والسجلات المحفوظة متاحة.
                    </span>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={setEnabled}
                    aria-label="تفعيل الردود الآلية"
                  />
                </label>
                <label className="flex items-start justify-between gap-5">
                  <div>
                    <span className="block text-sm font-bold">
                      التصعيد إلى المالك
                    </span>
                    <span className="mt-2 block text-xs leading-6 text-muted-foreground">
                      يتطلب موافقة العميل على حفظ المحادثة. لا يمنح الموظفين أو
                      المعقبين صلاحية قراءة صندوق الدعم.
                    </span>
                  </div>
                  <Switch
                    checked={handoffEnabled}
                    onCheckedChange={setHandoffEnabled}
                    aria-label="تفعيل التصعيد البشري"
                  />
                </label>
              </div>
              <div className="mt-6 rounded-2xl bg-background p-4">
                <p className="flex items-center gap-2 text-xs font-bold">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  حماية مفعّلة دائمًا
                </p>
                <p className="mt-2 text-xs leading-7 text-muted-foreground">
                  تجزئة رموز الاستعادة على الخادم، حجب الأنماط الرقمية والبريد،
                  حد استخدام دائم في قاعدة البيانات، منع تكرار الإرسال، وصلاحية
                  المالك في الخادم. المحادثة العامة لا تقرأ طلبات العملاء ولا
                  تنفذ دفعًا أو إلغاءً.
                </p>
              </div>
              <Button
                onClick={() => configure.mutate({ enabled, handoffEnabled })}
                disabled={configure.isPending}
                className="mt-6 gap-2 rounded-xl"
              >
                {configure.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4" />
                )}
                حفظ الإعدادات
              </Button>
            </article>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
function Loading({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"
    >
      <Loader2 className="h-5 w-5 animate-spin" />
      {text}
    </div>
  );
}
function ErrorState({ text, retry }: { text: string; retry: () => void }) {
  return (
    <div
      role="alert"
      className="m-4 rounded-2xl border border-destructive/20 bg-red-50 p-5 text-sm leading-7 text-red-800"
    >
      <p>{text}</p>
      <Button variant="outline" size="sm" onClick={retry} className="mt-3">
        إعادة المحاولة
      </Button>
    </div>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">
        <MessageSquare className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-bold">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-7 text-muted-foreground">
        {text}
      </p>
    </div>
  );
}
