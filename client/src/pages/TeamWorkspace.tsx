import { useAuth } from "@/_core/hooks/useAuth";
import { AgentFinancePanel } from "@/components/AgentFinancePanel";
import { AgentOverview } from "@/components/AgentOverview";
import { BrandMark } from "@/components/BrandMark";
import { CompletedAgentRequests } from "@/components/CompletedAgentRequests";
import { DeadlineIndicator } from "@/components/DeadlineIndicator";
import { TeamMessageCenter } from "@/components/TeamMessageCenter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  HandCoins,
  Loader2,
  LogOut,
  RefreshCw,
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

const statusLabelsEnglish: Record<keyof typeof statusLabels, string> = {
  received: "Received",
  in_review: "In review",
  in_progress: "In progress",
  completed: "Completed",
};

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

function HubTrigger({ icon, title, count, tone = "blue", isEnglish }: { icon: ReactNode; title: string; count: number; tone?: "blue" | "green"; isEnglish: boolean }) {
  const green = tone === "green";
  return <button type="button" className={`group flex min-h-24 w-full items-center gap-3 rounded-2xl border bg-white p-4 ${isEnglish ? "text-left" : "text-right"} shadow-[0_10px_28px_rgba(25,93,164,.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(25,93,164,.12)] ${green ? "border-[#d8edcf]" : "border-[#cde3fa]"}`}><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${green ? "bg-[#eef9ea] text-[#4c9a43]" : "bg-[#eaf3ff] text-[#0878f9]"}`}>{icon}</span><span className="min-w-0 flex-1"><span className="block text-xs font-bold text-[#60778f]">{title}</span><span className={`mt-1 block text-2xl font-black ${green ? "text-[#275c2a]" : "text-[#17334f]"}`}>{count}</span></span><ChevronDown className="h-4 w-4 text-[#8aa0b5]" /></button>;
}

function RequestRow({ icon, title, meta, accent, side, onOpen, isEnglish }: { icon: ReactNode; title: string; meta: string; accent: "blue" | "green"; side: ReactNode; onOpen: () => void; isEnglish: boolean }) {
  const green = accent === "green";
  return <article className={`overflow-hidden rounded-xl border border-[#d8e1ec] ${isEnglish ? "border-l-4" : "border-r-4"} bg-white shadow-[0_5px_18px_rgba(31,91,151,.05)] ${green ? isEnglish ? "border-l-[#50a269]" : "border-r-[#50a269]" : isEnglish ? "border-l-[#0878f9]" : "border-r-[#0878f9]"}`}><button type="button" onClick={onOpen} className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 ${isEnglish ? "text-left" : "text-right"} sm:grid-cols-[auto_minmax(0,1fr)_160px_105px]`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${green ? "bg-[#eff9f1] text-[#3b8e55]" : "bg-[#eaf3ff] text-[#0878f9]"}`}>{icon}</span><span className="min-w-0"><span className="block truncate text-sm font-black text-[#17334f]">{title}</span><span className="mt-1 block truncate text-[11px] font-bold text-[#70859b]">{meta}</span></span><span className="shrink-0">{side}</span><span className="hidden items-center justify-end gap-1 text-xs font-black text-[#0878f9] sm:flex">{isEnglish ? "Open request" : "فتح الطلب"}{isEnglish ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}</span></button></article>;
}

export default function TeamWorkspace() {
  const { isEnglish } = useLanguage();
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
  const canViewAssigned = account.data?.permissions.canViewAssigned ?? null;
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [soundEnabled, setSoundEnabled] = useState(() => window.localStorage.getItem("maalamati-team-sound") === "on");
  const [openedNotificationIds, setOpenedNotificationIds] = useState<number[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [marketOpen, setMarketOpen] = useState(false);
  const [assignedOpen, setAssignedOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const utils = trpc.useUtils();
  const previousUnread = useRef<number | null>(null);

  const markRead = trpc.teamNotifications.markRead.useMutation({ onSuccess: () => utils.teamNotifications.list.invalidate() });
  const markAllRead = trpc.teamNotifications.markAllRead.useMutation({ onSuccess: () => utils.teamNotifications.list.invalidate() });
  const deleteNotification = trpc.teamNotifications.delete.useMutation({ onSuccess: () => utils.teamNotifications.list.invalidate() });
  const clearRead = trpc.teamNotifications.clearRead.useMutation({ onSuccess: () => { toast.success(isEnglish ? "Read notifications cleared." : "تم مسح الإشعارات المقروءة."); void utils.teamNotifications.list.invalidate(); } });

  useEffect(() => { window.localStorage.setItem("maalamati-team-sound", soundEnabled ? "on" : "off"); }, [soundEnabled]);
  useEffect(() => { const timer = window.setInterval(() => setNowMs(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const unread = notifications.data?.unreadCount;
    if (unread === undefined) return;
    if (previousUnread.current !== null && unread > previousUnread.current) {
      toast.info(isEnglish ? "A new notification arrived." : "وصل إشعار جديد إلى بوابة الفريق.");
      if (soundEnabled) playNotificationTone();
      if (isAgent) void utils.agents.myAssignments.invalidate();
      if (isEmployee) void utils.employees.myAssignments.invalidate();
      void utils.quotes.openRequests.invalidate();
    }
    previousUnread.current = unread;
  }, [notifications.data?.unreadCount, isAgent, isEmployee, soundEnabled, utils, isEnglish]);

  const filteredNotifications = useMemo(() => {
    const items = (notifications.data?.items ?? []).filter(item => !item.isRead && !openedNotificationIds.includes(item.id));
    return notificationFilter === "all" ? items : items.filter(item => item.type === notificationFilter);
  }, [notificationFilter, notifications.data?.items, openedNotificationIds]);

  const openRequestPage = (requestId: number) => {
    setMarketOpen(false);
    setAssignedOpen(false);
    setCompletedOpen(false);
    setMessagesOpen(false);
    setLocation(`/team-request/${requestId}`);
  };

  const openTeamNotification = async (item: (typeof filteredNotifications)[number]) => {
    setOpenedNotificationIds(current => current.includes(item.id) ? current : [...current, item.id]);
    try {
      await markRead.mutateAsync({ notificationId: item.id });
      if (item.requestId) openRequestPage(item.requestId);
    } catch (error) {
      setOpenedNotificationIds(current => current.filter(id => id !== item.id));
      toast.error(error instanceof Error ? error.message : (isEnglish ? "Could not open notification." : "تعذر فتح الإشعار."));
    }
  };

  const readAllTeamNotifications = async () => {
    const hiddenIds = filteredNotifications.map(item => item.id);
    setOpenedNotificationIds(current => Array.from(new Set([...current, ...hiddenIds])));
    try {
      await markAllRead.mutateAsync();
    } catch (error) {
      setOpenedNotificationIds(current => current.filter(id => !hiddenIds.includes(id)));
      toast.error(error instanceof Error ? error.message : (isEnglish ? "Could not hide notifications." : "تعذر إخفاء الإشعارات."));
    }
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f4f9ff]"><Loader2 className="h-8 w-8 animate-spin text-[#0878f9]" /></div>;
  if (!user) return <div className="grid min-h-screen w-full max-w-[100vw] place-items-center overflow-x-hidden bg-[#f4f9ff] p-4" dir={isEnglish ? "ltr" : "rtl"}><div className="portal-shadow mx-auto w-[calc(100vw-2rem)] max-w-md rounded-3xl bg-white p-8 text-center max-sm:-translate-x-8"><h1 className="font-display text-2xl font-black">{isEnglish ? "Operations sign-in is required" : "يلزم دخول فريق التشغيل"}</h1><Button className="mt-6 w-full rounded-xl bg-[#0878f9] text-white" onClick={() => window.location.assign("/team-login")}>{isEnglish ? "Open sign-in" : "فتح صفحة الدخول"}</Button></div></div>;
  if (!isTeam) return <div className="grid min-h-screen w-full max-w-[100vw] place-items-center overflow-x-hidden bg-[#f4f9ff] p-4" dir={isEnglish ? "ltr" : "rtl"}><div className="portal-shadow mx-auto w-[calc(100vw-2rem)] max-w-md rounded-3xl bg-white p-8 text-center max-sm:-translate-x-8"><h1 className="font-display text-2xl font-black">{isEnglish ? "This portal is for operations" : "هذه البوابة لفريق التشغيل"}</h1><a className="mt-6 block font-bold text-[#0878f9]" href="/">{isEnglish ? "Back to site" : "العودة إلى الموقع"}</a></div></div>;

  const requests = (isAgent ? agentRequests.data : employeeRequests.data) ?? [];
  const query = isAgent ? agentRequests : employeeRequests;
  const sortedOpenRequests = [...(openRequests.data ?? [])].sort((first, second) => second.id - first.id);
  const sortedAssignedRequests = requests.filter(request => request.status !== "completed").sort((first, second) => second.id - first.id);
  const sortedCompletedRequests = requests.filter(request => request.status === "completed").sort((first, second) => Number(new Date(second.updatedAt)) - Number(new Date(first.updatedAt)));
  const refreshWorkspace = () => { void query.refetch(); void openRequests.refetch(); if (isAgent) void utils.agentFinance.mine.invalidate(); };
  const language = isEnglish ? {
    workspace: "Compact workspace", hello: "Hello", description: "Choose a list, then open each request in its dedicated page for quotes, updates, messages, and its record.", refresh: "Refresh", newRequests: "New customer requests", active: "Active assignments", completed: "Completed requests", recentFirst: "Newest first", listHint: "Each request opens in a dedicated page.", noNew: "No requests are accepting quotes right now.", noActive: "No active assignments yet.", noCompleted: "No completed requests yet.", completedHint: "Compact completed archive. Quoted values remain estimates, not automatic collections.", inbox: "Customer messages", workspaceHint: "Lists stay compact for quick sorting; request tools open on the dedicated page.", signOut: "Sign out",
  } : {
    workspace: "مركز عمل مدمج", hello: "مرحبًا", description: "اختر القائمة المطلوبة، ثم افتح كل معاملة في صفحتها المستقلة لإدارة العرض والتحديثات والمحادثة والسجل.", refresh: "تحديث", newRequests: "طلبات العملاء الجديدة", active: "طلباتك النشطة", completed: "الطلبات المكتملة", recentFirst: "الأحدث أولًا", listHint: "كل طلب يفتح في صفحة مستقلة.", noNew: "لا توجد طلبات جديدة تستقبل عروضًا حاليًا.", noActive: "لا توجد طلبات نشطة موكلة إليك حاليًا.", noCompleted: "لا توجد طلبات مكتملة حتى الآن.", completedHint: "سجل مكتملات مختصر؛ قيمة العرض تقدير وليست تحصيلًا تلقائيًا.", inbox: "رسائل العملاء", workspaceHint: "القوائم مختصرة للفرز السريع، وتنتقل أدوات كل طلب إلى صفحته المستقلة.", signOut: "خروج",
  };

  const newRequestsTrigger = isEnglish
    ? <HubTrigger icon={<HandCoins className="h-5 w-5" />} title={language.newRequests} count={sortedOpenRequests.length} isEnglish />
    : <HubTrigger icon={<HandCoins className="h-5 w-5" />} title="طلبات العملاء الجديدة" count={sortedOpenRequests.length} isEnglish={false} />;
  const activeRequestsTrigger = isEnglish
    ? <HubTrigger icon={<ClipboardList className="h-5 w-5" />} title={language.active} count={sortedAssignedRequests.length} tone="green" isEnglish />
    : <HubTrigger icon={<ClipboardList className="h-5 w-5" />} title="طلباتك الموكلة" count={sortedAssignedRequests.length} tone="green" isEnglish={false} />;

  return <main className="min-h-screen bg-[#f4f9ff]" dir={isEnglish ? "ltr" : "rtl"}>
    <header className="border-b border-[#dce8f6] bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4"><div className="flex items-center gap-3"><BrandMark className="h-11 w-11 rounded-2xl" isEnglish={isEnglish} /><div><p className="font-display text-lg font-black text-[#102a43]">{isEnglish ? "Maalamati Care · Operations" : "معاملاتي كير · فريق التشغيل"}</p><p className="text-xs text-[#60778f]">{isAgent ? (isEnglish ? "Agent portal" : "بوابة المعقبين") : (isEnglish ? "Employee portal" : "بوابة الموظفين")}</p></div></div><div className="flex items-center gap-2">
      <Popover><PopoverTrigger asChild><Button type="button" variant="outline" size="icon" className="relative rounded-xl border-[#cde3fa] bg-white text-[#0878f9]" aria-label={isEnglish ? "Open notifications" : "فتح الإشعارات"}><Bell className="h-5 w-5" />{notifications.data?.unreadCount ? <span className="absolute -left-2 -top-2 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#d83c4f] px-1 text-[10px] font-black text-white">{notifications.data.unreadCount > 99 ? "99+" : notifications.data.unreadCount}</span> : null}</Button></PopoverTrigger><PopoverContent align="start" className="w-[min(94vw,420px)] rounded-2xl border-[#dce8f6] p-0" dir={isEnglish ? "ltr" : "rtl"}><div className="border-b border-[#e7eff8] p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-lg font-black text-[#17334f]">{isEnglish ? "Notifications" : "الإشعارات"}</h2><p className="mt-1 text-xs text-[#60778f]">{isEnglish ? "They update automatically and close after opening." : "تتحدث تلقائيًا وتختفي بعد فتحها"}</p></div><div className="flex items-center gap-2"><Volume2 className="h-4 w-4 text-[#60778f]" /><Switch checked={soundEnabled} onCheckedChange={enabled => { setSoundEnabled(enabled); if (enabled) playNotificationTone(); }} aria-label={isEnglish ? "Sound alerts" : "التنبيه الصوتي"} /></div></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{Object.entries(notificationLabels).map(([value, label]) => <Button key={value} type="button" size="sm" variant={notificationFilter === value ? "default" : "outline"} onClick={() => setNotificationFilter(value)} className="shrink-0 rounded-full">{label}</Button>)}</div><div className="mt-3 flex flex-wrap justify-between gap-2">{notifications.data?.unreadCount ? <Button type="button" variant="ghost" size="sm" disabled={markAllRead.isPending} onClick={() => void readAllTeamNotifications()} className="text-[#0878f9]"><CheckCheck className="me-1 h-4 w-4" />{isEnglish ? "Read all" : "قراءة الكل"}</Button> : <span />}{notifications.data?.items.some(item => item.isRead) ? <Button type="button" variant="ghost" size="sm" disabled={clearRead.isPending} onClick={() => { if (window.confirm(isEnglish ? "Clear all read notifications?" : "مسح جميع الإشعارات المقروءة؟")) clearRead.mutate(); }} className="text-[#a23b3b]"><Trash2 className="me-1 h-4 w-4" />{isEnglish ? "Clear read" : "مسح المقروءة"}</Button> : null}</div></div><div className="max-h-[430px] overflow-y-auto p-2">{filteredNotifications.length ? filteredNotifications.map(item => <div key={item.id} className="mb-2 flex items-start gap-2 rounded-xl border border-[#b7dbff] bg-[#f0f8ff] p-2"><button type="button" onClick={() => void openTeamNotification(item)} className={`flex min-w-0 flex-1 items-start gap-3 p-1 ${isEnglish ? "text-left" : "text-right"}`}><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#0878f9]" /><span className="min-w-0"><span className="block text-sm font-extrabold text-[#17334f]">{item.title}</span><span className="mt-1 block text-xs leading-6 text-[#60778f]">{item.message}</span><time className="mt-2 block text-[11px] font-bold text-[#8a9bad]">{new Date(item.createdAt).toLocaleString(isEnglish ? "en-US" : "ar-SA")}</time></span></button><Button type="button" variant="ghost" size="icon" disabled={deleteNotification.isPending} onClick={() => { setOpenedNotificationIds(current => current.includes(item.id) ? current : [...current, item.id]); deleteNotification.mutate({ notificationId: item.id }); }} className="h-8 w-8 shrink-0 text-[#9a5260]" aria-label={isEnglish ? "Delete notification" : "حذف الإشعار"}><Trash2 className="h-4 w-4" /></Button></div>) : <div className="px-5 py-10 text-center"><Bell className="mx-auto h-8 w-8 text-[#9dcaf2]" /><p className="mt-3 text-sm font-bold text-[#60778f]">{isEnglish ? "No new notifications in this category" : "لا توجد إشعارات جديدة ضمن هذا النوع"}</p></div>}</div></PopoverContent></Popover>
      <Button variant="outline" className="rounded-xl border-[#f0caca] text-[#a23b3b]" onClick={async () => { await logout(); window.location.assign("/team-login"); }}><LogOut className="me-2 h-4 w-4" /><span className="hidden sm:inline">{language.signOut}</span></Button>
    </div></div></header>

    <div className="mx-auto max-w-6xl px-4 py-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="section-kicker">{language.workspace}</p><h1 className="font-display mt-3 text-3xl font-black text-[#102a43]">{language.hello} {account.data?.fullName || user.name || (isEnglish ? "there" : "بك")}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-[#60778f]">{language.description}</p></div><Button variant="outline" className="rounded-xl border-[#b7dbff] bg-white text-[#0878f9]" onClick={refreshWorkspace}><RefreshCw className="me-2 h-4 w-4" />{language.refresh}</Button></div>
      {isAgent ? <AgentOverview
        isEnglish={isEnglish}
        completedCount={canViewAssigned === true && !agentRequests.isLoading && !agentRequests.isError ? sortedCompletedRequests.length : null}
        totalAssignedCount={canViewAssigned === true && !agentRequests.isLoading && !agentRequests.isError ? requests.length : null}
        requestsLoading={account.isLoading || agentRequests.isLoading}
        requestsError={account.isError || agentRequests.isError || canViewAssigned === false}
        canViewAssigned={canViewAssigned}
        onRetryRequests={() => { void account.refetch(); void agentRequests.refetch(); }}
        onViewCompleted={() => setCompletedOpen(true)}
      /> : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-3"><p className="sr-only">{isEnglish ? "Customer identity is protected before approval, and contact information remains hidden from providers." : "اسم العميل محجوب قبل الاعتماد، وتبقى بيانات التواصل محجوبة دائمًا عن مقدم الخدمة."}</p>
        <Popover open={marketOpen} onOpenChange={setMarketOpen}><PopoverTrigger asChild><div>{newRequestsTrigger}</div></PopoverTrigger><PopoverContent align="start" sideOffset={10} className="max-h-[78vh] w-[min(96vw,780px)] overflow-y-auto rounded-3xl border-[#cde3fa] p-3 sm:p-5" dir={isEnglish ? "ltr" : "rtl"}><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-display text-xl font-black text-[#17334f]">{language.newRequests}</h2><p className="mt-1 text-xs text-[#60778f]">{language.listHint}</p></div><div className="flex items-center gap-2"><Badge className="rounded-full bg-[#f2f5f8] text-[#60778f]">{language.recentFirst}</Badge><Badge className="rounded-full bg-[#eaf3ff] text-[#0878f9]">{sortedOpenRequests.length}</Badge></div></div>{openRequests.isLoading ? <Loader2 className="mx-auto my-12 h-7 w-7 animate-spin text-[#0878f9]" /> : sortedOpenRequests.length ? <div className="space-y-2">{sortedOpenRequests.map(request => <RequestRow key={request.id} icon={<HandCoins className="h-4 w-4" />} title={`${request.category}${request.subcategory ? ` — ${request.subcategory}` : ""}`} meta={`${request.quoteCount} ${isEnglish ? "quotes" : "عرض"} · ${new Date(request.createdAt).toLocaleDateString(isEnglish ? "en-US" : "ar-SA")}`} accent="blue" side={<DeadlineIndicator deadline={request.quoteSubmissionDeadline} nowMs={nowMs} isEnglish={isEnglish} label={isEnglish ? "Closes" : "إغلاق"} compact />} onOpen={() => openRequestPage(request.id)} isEnglish={isEnglish} />)}</div> : <p className="rounded-2xl bg-[#f5faff] p-8 text-center text-sm text-[#60778f]">{language.noNew}</p>}</PopoverContent></Popover>
        <Popover open={assignedOpen} onOpenChange={setAssignedOpen}><PopoverTrigger asChild><div>{activeRequestsTrigger}</div></PopoverTrigger><PopoverContent align="center" sideOffset={10} className="max-h-[78vh] w-[min(96vw,780px)] overflow-y-auto rounded-3xl border-[#cde3fa] p-3 sm:p-5" dir={isEnglish ? "ltr" : "rtl"}><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-display text-xl font-black text-[#17334f]">{language.active}</h2><p className="mt-1 text-xs text-[#60778f]">{language.listHint}</p></div><div className="flex items-center gap-2"><Badge className="rounded-full bg-[#f2f5f8] text-[#60778f]">{language.recentFirst}</Badge><Badge className="rounded-full bg-[#eaf3ff] text-[#0878f9]">{sortedAssignedRequests.length}</Badge></div></div>{query.isLoading ? <Loader2 className="mx-auto my-12 h-7 w-7 animate-spin text-[#0878f9]" /> : query.isError ? <p role="alert" className="rounded-xl bg-[#fff7f7] p-4 text-sm text-[#a23b3b]">{isEnglish ? "Could not load assignments. Refresh and try again." : "تعذر تحميل الطلبات. حدّث الصفحة وحاول مجددًا."}</p> : sortedAssignedRequests.length ? <div className="space-y-2">{sortedAssignedRequests.map(request => <RequestRow key={request.id} icon={<ClipboardList className="h-4 w-4" />} title={`${request.category}${request.subcategory ? ` — ${request.subcategory}` : ""}`} meta={request.requesterName} accent="green" side={<Badge className="rounded-full bg-[#eaf3ff] text-[#0878f9]">{isEnglish ? statusLabelsEnglish[request.status] : statusLabels[request.status]}</Badge>} onOpen={() => openRequestPage(request.id)} isEnglish={isEnglish} />)}</div> : <p className="rounded-2xl bg-[#f5faff] p-8 text-center text-sm text-[#60778f]">{language.noActive}</p>}</PopoverContent></Popover>
        <Popover open={completedOpen} onOpenChange={setCompletedOpen}><PopoverTrigger asChild><div><HubTrigger icon={<CheckCircle2 className="h-5 w-5" />} title={language.completed} count={sortedCompletedRequests.length} tone="green" isEnglish={isEnglish} /></div></PopoverTrigger><PopoverContent align="end" sideOffset={10} className="max-h-[78vh] w-[min(96vw,780px)] overflow-y-auto rounded-3xl border-[#cde3fa] p-3 sm:p-5" dir={isEnglish ? "ltr" : "rtl"}>{isAgent ? <CompletedAgentRequests isEnglish={isEnglish} onOpenRequest={openRequestPage} /> : <><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-display text-xl font-black text-[#17334f]">{language.completed}</h2><p className="mt-1 text-xs text-[#60778f]">{language.completedHint}</p></div><Badge className="rounded-full bg-[#eff9f1] text-[#238457]">{sortedCompletedRequests.length}</Badge></div>{query.isLoading ? <Loader2 className="mx-auto my-12 h-7 w-7 animate-spin text-[#0878f9]" /> : query.isError ? <p role="alert" className="rounded-xl bg-[#fff7f7] p-4 text-sm text-[#a23b3b]">{isEnglish ? "Could not load assignments. Refresh and try again." : "تعذر تحميل الطلبات. حدّث الصفحة وحاول مجددًا."}</p> : sortedCompletedRequests.length ? <div className="space-y-2">{sortedCompletedRequests.map(request => <RequestRow key={request.id} icon={<CheckCircle2 className="h-4 w-4" />} title={`${request.category}${request.subcategory ? ` — ${request.subcategory}` : ""}`} meta={`${request.requesterName} · ${new Date(request.updatedAt).toLocaleDateString(isEnglish ? "en-US" : "ar-SA")}`} accent="green" side={<Badge className="rounded-full bg-[#eff9f1] text-[#238457]">{isEnglish ? "Completed" : "مكتمل"}</Badge>} onOpen={() => openRequestPage(request.id)} isEnglish={isEnglish} />)}</div> : <p className="rounded-2xl bg-[#f5faff] p-8 text-center text-sm text-[#60778f]">{language.noCompleted}</p>}</>}</PopoverContent></Popover>
      </div>
      {isAgent && canViewAssigned === true ? <div id="agent-cash-ledger" tabIndex={-1}><AgentFinancePanel isEnglish={isEnglish} /></div> : null}
      <div className="mt-5"><Button type="button" variant="outline" className="h-10 rounded-xl border-[#dce8f6] bg-white text-[#31516e]" onClick={() => setMessagesOpen(value => !value)} aria-expanded={messagesOpen}>{language.inbox}<ChevronDown className={`ms-2 h-4 w-4 transition-transform ${messagesOpen ? "rotate-180" : ""}`} /></Button>{messagesOpen ? <div className="mt-3"><TeamMessageCenter isEnglish={isEnglish} onOpenRequest={openRequestPage} /></div> : null}</div>
      <section className="mt-8 rounded-3xl border border-dashed border-[#b7dbff] bg-white/70 p-6 text-center"><p className="text-sm font-bold text-[#405d78]">{language.workspaceHint}</p></section>
    </div>
  </main>;
}
