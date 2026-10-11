import { useAuth } from "@/_core/hooks/useAuth";
import { DeadlineIndicator } from "@/components/DeadlineIndicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  ChevronDown,
  ClipboardList,
  HandCoins,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const statusLabels = {
  received: "تم الاستلام",
  in_review: "قيد المراجعة",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
} as const;

const notificationLabels: Record<string, string> = {
  all: "الكل",
  new_customer_request: "طلبات جديدة",
  request_assigned: "طلبات مسندة",
  quote_selected: "عروض مختارة",
  quote_accepted: "عروض معتمدة",
  assignment_expired: "مهلة منتهية",
  quote_declined: "عروض أخرى",
  customer_comment: "رسائل العملاء",
  customer_review: "تقييمات",
};

function playNotificationTone() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(720, context.currentTime);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.24);
  oscillator.addEventListener("ended", () => void context.close());
}

function HubTrigger({ icon, title, count, tone = "blue" }: { icon: ReactNode; title: string; count: number; tone?: "blue" | "green" }) {
  const green = tone === "green";
  return (
    <button type="button" className={`group flex min-h-24 w-full items-center gap-3 rounded-2xl border bg-white p-4 text-right shadow-[0_10px_28px_rgba(25,93,164,.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(25,93,164,.12)] ${green ? "border-[#d8edcf]" : "border-[#cde3fa]"}`}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${green ? "bg-[#eef9ea] text-[#4c9a43]" : "bg-[#eaf3ff] text-[#0878f9]"}`}>{icon}</span>
      <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-[#60778f]">{title}</span><span className={`mt-1 block text-2xl font-black ${green ? "text-[#275c2a]" : "text-[#17334f]"}`}>{count}</span></span>
      <ChevronDown className="h-4 w-4 text-[#8aa0b5]" />
    </button>
  );
}

function RequestRow({
  icon,
  title,
  meta,
  accent,
  side,
  onOpen,
}: {
  icon: ReactNode;
  title: string;
  meta: string;
  accent: "blue" | "green";
  side: ReactNode;
  onOpen: () => void;
}) {
  const green = accent === "green";
  return (
    <article className={`overflow-hidden rounded-xl border border-[#d8e1ec] border-r-4 bg-white shadow-[0_5px_18px_rgba(31,91,151,.05)] ${green ? "border-r-[#50a269]" : "border-r-[#0878f9]"}`}>
      <button type="button" onClick={onOpen} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 text-right sm:grid-cols-[auto_minmax(0,1fr)_160px_105px]">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${green ? "bg-[#eff9f1] text-[#3b8e55]" : "bg-[#eaf3ff] text-[#0878f9]"}`}>{icon}</span>
        <span className="min-w-0"><span className="block truncate text-sm font-black text-[#17334f]">{title}</span><span className="mt-1 block truncate text-[11px] font-bold text-[#70859b]">{meta}</span></span>
        <span className="shrink-0">{side}</span>
        <span className="hidden items-center justify-end gap-1 text-xs font-black text-[#0878f9] sm:flex">فتح الطلب<ArrowLeft className="h-4 w-4" /></span>
      </button>
    </article>
  );
}

export default function TeamWorkspace() {
  const { user, loading, logout } = useAuth({ redirectOnUnauthenticated: false });
  const [, setLocation] = useLocation();
  const isAgent = user?.role === "agent";
  const isEmployee = user?.role === "employee";
  const isTeam = Boolean(isAgent || isEmployee);
  const agentRequests = trpc.agents.myAssignments.useQuery(undefined, { enabled: isAgent });
  const employeeRequests = trpc.employees.myAssignments.useQuery(undefined, { enabled: isEmployee });
  const openRequests = trpc.quotes.openRequests.useQuery(undefined, { enabled: isTeam, refetchInterval: 20_000, refetchIntervalInBackground: false });
  const account = trpc.staffAccounts.me.useQuery(undefined, { enabled: isTeam });
  const notifications = trpc.teamNotifications.list.useQuery(undefined, { enabled: isTeam, refetchInterval: 20_000, refetchIntervalInBackground: false });
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [soundEnabled, setSoundEnabled] = useState(() => window.localStorage.getItem("maalamati-team-sound") === "on");
  const [openedNotificationIds, setOpenedNotificationIds] = useState<number[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [marketOpen, setMarketOpen] = useState(false);
  const [assignedOpen, setAssignedOpen] = useState(false);
  const utils = trpc.useUtils();
  const previousUnread = useRef<number | null>(null);

  const markRead = trpc.teamNotifications.markRead.useMutation({ onSuccess: () => utils.teamNotifications.list.invalidate() });
  const markAllRead = trpc.teamNotifications.markAllRead.useMutation({ onSuccess: () => utils.teamNotifications.list.invalidate() });
  const deleteNotification = trpc.teamNotifications.delete.useMutation({ onSuccess: () => utils.teamNotifications.list.invalidate() });
  const clearRead = trpc.teamNotifications.clearRead.useMutation({ onSuccess: () => { toast.success("تم مسح الإشعارات المقروءة."); void utils.teamNotifications.list.invalidate(); } });

  useEffect(() => { window.localStorage.setItem("maalamati-team-sound", soundEnabled ? "on" : "off"); }, [soundEnabled]);
  useEffect(() => { const timer = window.setInterval(() => setNowMs(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const unread = notifications.data?.unreadCount;
    if (unread === undefined) return;
    if (previousUnread.current !== null && unread > previousUnread.current) {
      toast.info("وصل إشعار جديد إلى بوابة الفريق.");
      if (soundEnabled) playNotificationTone();
      if (isAgent) void utils.agents.myAssignments.invalidate();
      if (isEmployee) void utils.employees.myAssignments.invalidate();
      void utils.quotes.openRequests.invalidate();
    }
    previousUnread.current = unread;
  }, [notifications.data?.unreadCount, isAgent, isEmployee, soundEnabled, utils]);

  const filteredNotifications = useMemo(() => {
    const items = (notifications.data?.items ?? []).filter((item) => !item.isRead && !openedNotificationIds.includes(item.id));
    return notificationFilter === "all" ? items : items.filter((item) => item.type === notificationFilter);
  }, [notificationFilter, notifications.data?.items, openedNotificationIds]);

  const openTeamNotification = async (item: (typeof filteredNotifications)[number]) => {
    setOpenedNotificationIds(current => current.includes(item.id) ? current : [...current, item.id]);
    try {
      await markRead.mutateAsync({ notificationId: item.id });
      if (item.requestId) openRequestPage(item.requestId);
    } catch (error) {
      setOpenedNotificationIds(current => current.filter(id => id !== item.id));
      toast.error(error instanceof Error ? error.message : "تعذر فتح الإشعار.");
    }
  };

  const readAllTeamNotifications = async () => {
    const hiddenIds = filteredNotifications.map(item => item.id);
    setOpenedNotificationIds(current => Array.from(new Set([...current, ...hiddenIds])));
    try {
      await markAllRead.mutateAsync();
    } catch (error) {
      setOpenedNotificationIds(current => current.filter(id => !hiddenIds.includes(id)));
      toast.error(error instanceof Error ? error.message : "تعذر إخفاء الإشعارات.");
    }
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f4f9ff]"><Loader2 className="h-8 w-8 animate-spin text-[#0878f9]" /></div>;
  if (!user) return <div className="grid min-h-screen w-full max-w-[100vw] place-items-center overflow-x-hidden bg-[#f4f9ff] p-4" dir="rtl"><div className="portal-shadow mx-auto w-[calc(100vw-2rem)] max-w-md rounded-3xl bg-white p-8 text-center max-sm:-translate-x-8"><h1 className="font-display text-2xl font-black">يلزم دخول فريق التشغيل</h1><Button className="mt-6 w-full rounded-xl bg-[#0878f9] text-white" onClick={() => window.location.assign("/team-login")}>فتح صفحة الدخول</Button></div></div>;
  if (!isTeam) return <div className="grid min-h-screen w-full max-w-[100vw] place-items-center overflow-x-hidden bg-[#f4f9ff] p-4" dir="rtl"><div className="portal-shadow mx-auto w-[calc(100vw-2rem)] max-w-md rounded-3xl bg-white p-8 text-center max-sm:-translate-x-8"><h1 className="font-display text-2xl font-black">هذه البوابة لفريق التشغيل</h1><a className="mt-6 block font-bold text-[#0878f9]" href="/">العودة إلى الموقع</a></div></div>;

  const requests = (isAgent ? agentRequests.data : employeeRequests.data) ?? [];
  const query = isAgent ? agentRequests : employeeRequests;
  const sortedOpenRequests = [...(openRequests.data ?? [])].sort((a, b) => b.id - a.id);
  const sortedAssignedRequests = [...requests].sort((a, b) => b.id - a.id);
  const openRequestPage = (requestId: number) => { setMarketOpen(false); setAssignedOpen(false); setLocation(`/team-request/${requestId}`); };

  return (
    <main className="min-h-screen bg-[#f4f9ff]" dir="rtl">
      <header className="border-b border-[#dce8f6] bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0878f9]"><ShieldCheck className="h-5 w-5" /></span><div><p className="font-display text-lg font-black text-[#102a43]">معاملاتي · فريق التشغيل</p><p className="text-xs text-[#60778f]">{isAgent ? "بوابة المعقبين" : "بوابة الموظفين"}</p></div></div><div className="flex items-center gap-2">
        <Popover><PopoverTrigger asChild><Button type="button" variant="outline" size="icon" className="relative rounded-xl border-[#cde3fa] bg-white text-[#0878f9]" aria-label="فتح الإشعارات"><Bell className="h-5 w-5" />{notifications.data?.unreadCount ? <span className="absolute -left-2 -top-2 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#d83c4f] px-1 text-[10px] font-black text-white">{notifications.data.unreadCount > 99 ? "99+" : notifications.data.unreadCount}</span> : null}</Button></PopoverTrigger><PopoverContent align="start" className="w-[min(94vw,420px)] rounded-2xl border-[#dce8f6] p-0" dir="rtl"><div className="border-b border-[#e7eff8] p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-lg font-black text-[#17334f]">الإشعارات</h2><p className="mt-1 text-xs text-[#60778f]">تتحدث تلقائيًا وتختفي بعد فتحها</p></div><div className="flex items-center gap-2"><Volume2 className="h-4 w-4 text-[#60778f]" /><Switch checked={soundEnabled} onCheckedChange={(enabled) => { setSoundEnabled(enabled); if (enabled) playNotificationTone(); }} aria-label="التنبيه الصوتي" /></div></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{Object.entries(notificationLabels).map(([value, label]) => <Button key={value} type="button" size="sm" variant={notificationFilter === value ? "default" : "outline"} onClick={() => setNotificationFilter(value)} className="shrink-0 rounded-full">{label}</Button>)}</div><div className="mt-3 flex flex-wrap justify-between gap-2">{notifications.data?.unreadCount ? <Button type="button" variant="ghost" size="sm" disabled={markAllRead.isPending} onClick={() => void readAllTeamNotifications()} className="text-[#0878f9]"><CheckCheck className="ml-1 h-4 w-4" />قراءة الكل</Button> : <span />}{notifications.data?.items.some((item) => item.isRead) ? <Button type="button" variant="ghost" size="sm" disabled={clearRead.isPending} onClick={() => { if (window.confirm("مسح جميع الإشعارات المقروءة؟")) clearRead.mutate(); }} className="text-[#a23b3b]"><Trash2 className="ml-1 h-4 w-4" />مسح المقروءة</Button> : null}</div></div><div className="max-h-[430px] overflow-y-auto p-2">{filteredNotifications.length ? filteredNotifications.map((item) => <div key={item.id} className="mb-2 flex items-start gap-2 rounded-xl border border-[#b7dbff] bg-[#f0f8ff] p-2"><button type="button" onClick={() => void openTeamNotification(item)} className="flex min-w-0 flex-1 items-start gap-3 p-1 text-right"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#0878f9]" /><span className="min-w-0"><span className="block text-sm font-extrabold text-[#17334f]">{item.title}</span><span className="mt-1 block text-xs leading-6 text-[#60778f]">{item.message}</span><time className="mt-2 block text-[11px] font-bold text-[#8a9bad]">{new Date(item.createdAt).toLocaleString("ar-SA")}</time></span></button><Button type="button" variant="ghost" size="icon" disabled={deleteNotification.isPending} onClick={() => { setOpenedNotificationIds(current => current.includes(item.id) ? current : [...current, item.id]); deleteNotification.mutate({ notificationId: item.id }); }} className="h-8 w-8 shrink-0 text-[#9a5260]" aria-label="حذف الإشعار"><Trash2 className="h-4 w-4" /></Button></div>) : <div className="px-5 py-10 text-center"><Bell className="mx-auto h-8 w-8 text-[#9dcaf2]" /><p className="mt-3 text-sm font-bold text-[#60778f]">لا توجد إشعارات جديدة ضمن هذا النوع</p></div>}</div></PopoverContent></Popover>
        <Button variant="outline" className="rounded-xl border-[#f0caca] text-[#a23b3b]" onClick={async () => { await logout(); window.location.assign("/team-login"); }}><LogOut className="ml-2 h-4 w-4" /><span className="hidden sm:inline">خروج</span></Button>
      </div></div></header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="section-kicker">مركز عمل مدمج</p><h1 className="font-display mt-3 text-3xl font-black text-[#102a43]">مرحبًا {account.data?.fullName || user.name || "بك"}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-[#60778f]">اختر القائمة المطلوبة، ثم افتح كل معاملة في صفحتها المستقلة لإدارة العرض والتحديثات والمحادثة.</p></div><Button variant="outline" className="rounded-xl border-[#b7dbff] bg-white text-[#0878f9]" onClick={() => { void query.refetch(); void openRequests.refetch(); }}><RefreshCw className="ml-2 h-4 w-4" />تحديث</Button></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <p className="sr-only">اسم العميل محجوب قبل الاعتماد، وتبقى بيانات التواصل محجوبة دائمًا عن مقدم الخدمة.</p>
          <Popover open={marketOpen} onOpenChange={setMarketOpen}><PopoverTrigger asChild><div><HubTrigger icon={<HandCoins className="h-5 w-5" />} title="طلبات العملاء الجديدة" count={sortedOpenRequests.length} /></div></PopoverTrigger><PopoverContent align="start" sideOffset={10} className="max-h-[78vh] w-[min(96vw,780px)] overflow-y-auto rounded-3xl border-[#cde3fa] p-3 sm:p-5" dir="rtl"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-display text-xl font-black text-[#17334f]">طلبات العملاء الجديدة</h2><p className="mt-1 text-xs text-[#60778f]">مرتبة من الأحدث؛ كل طلب يفتح في صفحة مستقلة.</p></div><div className="flex items-center gap-2"><Badge className="rounded-full bg-[#f2f5f8] text-[#60778f]">الأحدث أولًا</Badge><Badge className="rounded-full bg-[#eaf3ff] text-[#0878f9]">{sortedOpenRequests.length}</Badge></div></div>{openRequests.isLoading ? <Loader2 className="mx-auto my-12 h-7 w-7 animate-spin text-[#0878f9]" /> : sortedOpenRequests.length ? <div className="space-y-2">{sortedOpenRequests.map((request) => <RequestRow key={request.id} icon={<HandCoins className="h-4 w-4" />} title={`${request.category}${request.subcategory ? ` — ${request.subcategory}` : ""}`} meta={`${request.quoteCount} عرض · ${new Date(request.createdAt).toLocaleDateString("ar-SA")}`} accent="blue" side={<DeadlineIndicator deadline={request.quoteSubmissionDeadline} nowMs={nowMs} isEnglish={false} label="إغلاق" compact />} onOpen={() => openRequestPage(request.id)} />)}</div> : <p className="rounded-2xl bg-[#f5faff] p-8 text-center text-sm text-[#60778f]">لا توجد طلبات جديدة تستقبل عروضًا حاليًا.</p>}</PopoverContent></Popover>
          <Popover open={assignedOpen} onOpenChange={setAssignedOpen}><PopoverTrigger asChild><div><HubTrigger icon={<ClipboardList className="h-5 w-5" />} title="طلباتك الموكلة" count={sortedAssignedRequests.length} tone="green" /></div></PopoverTrigger><PopoverContent align="center" sideOffset={10} className="max-h-[78vh] w-[min(96vw,780px)] overflow-y-auto rounded-3xl border-[#cde3fa] p-3 sm:p-5" dir="rtl"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-display text-xl font-black text-[#17334f]">طلباتك الموكلة</h2><p className="mt-1 text-xs text-[#60778f]">مرتبة من الأحدث؛ كل طلب يفتح في صفحة مستقلة.</p></div><div className="flex items-center gap-2"><Badge className="rounded-full bg-[#f2f5f8] text-[#60778f]">الأحدث أولًا</Badge><Badge className="rounded-full bg-[#eaf3ff] text-[#0878f9]">{sortedAssignedRequests.length}</Badge></div></div>{query.isLoading ? <Loader2 className="mx-auto my-12 h-7 w-7 animate-spin text-[#0878f9]" /> : sortedAssignedRequests.length ? <div className="space-y-2">{sortedAssignedRequests.map((request) => <RequestRow key={request.id} icon={<ClipboardList className="h-4 w-4" />} title={`${request.category}${request.subcategory ? ` — ${request.subcategory}` : ""}`} meta={request.requesterName} accent="green" side={<Badge className="rounded-full bg-[#eaf3ff] text-[#0878f9]">{statusLabels[request.status]}</Badge>} onOpen={() => openRequestPage(request.id)} />)}</div> : <p className="rounded-2xl bg-[#f5faff] p-8 text-center text-sm text-[#60778f]">لم يعتمد عميل عرضك بعد.</p>}</PopoverContent></Popover>
        </div>
        <section className="mt-8 rounded-3xl border border-dashed border-[#b7dbff] bg-white/70 p-6 text-center"><p className="text-sm font-bold text-[#405d78]">القائمة مختصرة للفرز السريع، وتنتقل جميع أدوات العمل إلى صفحة الطلب المستقلة.</p></section>
      </div>
    </main>
  );
}
