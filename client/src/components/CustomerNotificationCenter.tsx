import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowRight, BadgeDollarSign, Bell, CheckCheck, Loader2, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const englishTitles: Record<string, string> = {
  first_quote_received: "Your first price quote arrived",
  quote_received: "New price quote",
  new_quote: "New price quote",
  quote_selected: "Quote selected",
  provider_accepted: "Request received",
  provider_acceptance_expired: "Provider acceptance expired",
  request_update: "Request update",
};

const englishMessages: Record<string, string> = {
  first_quote_received: "Your request received its first quote. Open it now to compare the price and turnaround time.",
  quote_received: "Another price quote is available for your request.",
  new_quote: "A new price quote is available for your request.",
  quote_selected: "Your selected provider has been notified and has two hours to accept.",
  provider_accepted: "The provider confirmed receiving your request.",
  provider_acceptance_expired: "The provider did not accept in time. You can choose another quote.",
};

const quoteNotificationTypes = new Set(["first_quote_received", "quote_received"]);
const quoteSoundPreferenceKey = "maalamati_customer_quote_sound";
const quoteSoundUrl = "/manus-storage/maalamati-quote-alert_818d0073.wav";
let quoteAudio: HTMLAudioElement | null = null;
let quoteSoundPlayback: Promise<boolean> | null = null;

function getQuoteAudio() {
  if (typeof Audio === "undefined") return null;
  if (!quoteAudio) {
    quoteAudio = new Audio(quoteSoundUrl);
    quoteAudio.preload = "auto";
    quoteAudio.volume = 0.95;
  }
  return quoteAudio;
}

function playQuoteToneOnce(audio: HTMLAudioElement) {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (played: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("error", onError);
      resolve(played);
    };
    const onPlaying = () => finish(true);
    const onError = () => finish(false);
    const timeoutId = window.setTimeout(() => finish(!audio.paused && audio.currentTime > 0), 1_500);
    audio.addEventListener("playing", onPlaying, { once: true });
    audio.addEventListener("error", onError, { once: true });
    audio.pause();
    audio.currentTime = 0;
    void audio.play().catch(() => finish(false));
  });
}

function waitForQuoteToneEnd(audio: HTMLAudioElement) {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      audio.removeEventListener("ended", finish);
      audio.removeEventListener("error", finish);
      resolve();
    };
    const timeoutId = window.setTimeout(finish, 1_400);
    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", finish, { once: true });
  });
}

function playQuoteNotificationTone() {
  if (quoteSoundPlayback) return quoteSoundPlayback;
  quoteSoundPlayback = (async () => {
    const audio = getQuoteAudio();
    if (!audio) return false;
    const firstPlayed = await playQuoteToneOnce(audio);
    if (!firstPlayed) return false;
    await waitForQuoteToneEnd(audio);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
    return playQuoteToneOnce(audio);
  })().finally(() => { quoteSoundPlayback = null; });
  return quoteSoundPlayback;
}

export function CustomerNotificationCenter({ accessToken, onNewNotification, onOpenRequest, onUnreadQuoteRequestsChange }: { accessToken: string; onNewNotification?: () => void; onOpenRequest?: (requestId: number) => void; onUnreadQuoteRequestsChange?: (requestIds: number[]) => void }) {
  const { isEnglish } = useLanguage();
  const utils = trpc.useUtils();
  const previousLatestNotificationId = useRef<number | null>(null);
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(() => typeof window !== "undefined" && localStorage.getItem(quoteSoundPreferenceKey) === "true");
  const [soundReady, setSoundReady] = useState(false);
  const notifications = trpc.customerNotifications.list.useQuery(
    { accessToken },
    { enabled: Boolean(accessToken), refetchInterval: 10_000, refetchIntervalInBackground: false },
  );
  const markRead = trpc.customerNotifications.markRead.useMutation({
    onSuccess: () => utils.customerNotifications.list.invalidate({ accessToken }),
  });
  const markAllRead = trpc.customerNotifications.markAllRead.useMutation({
    onSuccess: () => utils.customerNotifications.list.invalidate({ accessToken }),
  });

  const visibleNotifications = (notifications.data?.items ?? []).filter(
    item => !item.isRead && !dismissedIds.includes(item.id),
  );

  const openNotification = async (notification: (typeof visibleNotifications)[number]) => {
    setDismissedIds(current => current.includes(notification.id) ? current : [...current, notification.id]);
    try {
      await markRead.mutateAsync({ accessToken, notificationId: notification.id });
      if (onOpenRequest) onOpenRequest(notification.requestId);
      else window.location.assign(`/customer-account?request=${notification.requestId}`);
    } catch (error) {
      setDismissedIds(current => current.filter(id => id !== notification.id));
      toast.error(error instanceof Error ? error.message : (isEnglish ? "We could not open this notification." : "تعذر فتح هذا الإشعار."));
    }
  };

  const readAll = async () => {
    const hiddenIds = visibleNotifications.map(item => item.id);
    setDismissedIds(current => Array.from(new Set([...current, ...hiddenIds])));
    try {
      await markAllRead.mutateAsync({ accessToken });
    } catch (error) {
      setDismissedIds(current => current.filter(id => !hiddenIds.includes(id)));
      toast.error(error instanceof Error ? error.message : (isEnglish ? "We could not clear the notifications." : "تعذر إخفاء الإشعارات."));
    }
  };

  useEffect(() => {
    const latestNotificationId = notifications.data?.items[0]?.id;
    if (latestNotificationId === undefined) return;
    if (previousLatestNotificationId.current !== null && latestNotificationId !== previousLatestNotificationId.current) {
      toast.info(isEnglish ? "A new notification arrived for your request." : "وصل إشعار جديد على طلبك.");
      onNewNotification?.();
      if (soundEnabled && soundReady) void playQuoteNotificationTone().then((played) => { if (!played) setSoundReady(false); });
    }
    previousLatestNotificationId.current = latestNotificationId;
  }, [isEnglish, notifications.data?.items, onNewNotification, soundEnabled, soundReady]);

  useEffect(() => {
    const unreadQuoteNotifications = notifications.data?.items.filter((item) => !item.isRead && quoteNotificationTypes.has(item.type)) ?? [];
    const requestIds = Array.from(new Set(unreadQuoteNotifications.map((item) => item.requestId)));
    onUnreadQuoteRequestsChange?.(requestIds);
  }, [notifications.data?.items, onUnreadQuoteRequestsChange]);

  const enableSound = async () => {
    const played = await playQuoteNotificationTone();
    if (!played) {
      toast.error(isEnglish ? "Your browser blocked audio. Check the tab and site sound permissions, then try again." : "منع المتصفح تشغيل الصوت. تحقق من صوت علامة التبويب وصلاحية الصوت للموقع ثم حاول مجددًا.");
      return;
    }
    setSoundEnabled(true);
    setSoundReady(true);
    localStorage.setItem(quoteSoundPreferenceKey, "true");
    toast.success(isEnglish ? "Notification sound is ready for this session." : "صوت الإشعارات جاهز لهذه الجلسة.");
  };

  const disableSound = () => {
    setSoundEnabled(false);
    setSoundReady(false);
    localStorage.setItem(quoteSoundPreferenceKey, "false");
    quoteAudio?.pause();
    toast.success(isEnglish ? "Notification sound disabled." : "تم إيقاف صوت الإشعارات.");
  };

  const unreadQuoteCount = visibleNotifications.filter(item => quoteNotificationTypes.has(item.type)).length;
  const firstQuote = visibleNotifications.find(item => item.type === "first_quote_received");
  const acknowledgeFirstQuote = (openRequest: boolean) => {
    if (!firstQuote) return;
    setDismissedIds((current) => [...current, firstQuote.id]);
    if (openRequest) void openNotification(firstQuote);
    else markRead.mutate({ accessToken, notificationId: firstQuote.id });
  };

  return (
    <>
      {firstQuote ? (
        <div className="container pt-5" dir={isEnglish ? "ltr" : "rtl"}>
          <section role="alert" aria-live="assertive" className="relative overflow-hidden rounded-2xl border border-[#b7dbff] bg-[linear-gradient(110deg,#eef8ff,#ffffff)] p-4 shadow-[0_14px_36px_rgba(8,120,249,.12)] sm:p-5">
            <div className={`flex items-start gap-3 sm:items-center ${isEnglish ? "pr-8 sm:pr-0" : "pl-8 sm:pl-0"}`}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#0878f9] text-white"><BadgeDollarSign className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-black text-[#17334f]">{isEnglish ? englishTitles.first_quote_received : firstQuote.title}</p>
                <p className="mt-1 text-sm leading-6 text-[#60778f]">{isEnglish ? englishMessages.first_quote_received : firstQuote.message}</p>
              </div>
              <Button type="button" onClick={() => acknowledgeFirstQuote(true)} className="hidden h-10 shrink-0 rounded-xl bg-[#0878f9] px-4 text-sm font-extrabold text-white hover:bg-[#0668d9] sm:inline-flex">
                {isEnglish ? "Open request" : "فتح الطلب"}{isEnglish ? <ArrowRight className="ml-2 h-4 w-4" /> : <ArrowLeft className="mr-2 h-4 w-4" />}
              </Button>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => acknowledgeFirstQuote(false)} aria-label={isEnglish ? "Dismiss first quote alert" : "إغلاق تنبيه أول عرض"} className={`absolute top-2 h-8 w-8 rounded-full text-[#60778f] hover:bg-white ${isEnglish ? "right-2" : "left-2"}`}><X className="h-4 w-4" /></Button>
            <Button type="button" onClick={() => acknowledgeFirstQuote(true)} className="mt-3 h-10 w-full rounded-xl bg-[#0878f9] text-sm font-extrabold text-white hover:bg-[#0668d9] sm:hidden">
              {isEnglish ? "Open request" : "فتح الطلب"}{isEnglish ? <ArrowRight className="ml-2 h-4 w-4" /> : <ArrowLeft className="mr-2 h-4 w-4" />}
            </Button>
          </section>
        </div>
      ) : null}
      {!soundEnabled || !soundReady ? (
        <Button type="button" onClick={() => void enableSound()} className="fixed bottom-24 left-20 z-40 h-11 rounded-full bg-white px-4 text-xs font-extrabold text-[#0878f9] shadow-[0_12px_30px_rgba(8,120,249,.18)] ring-1 ring-[#b7dbff] hover:bg-[#f2f8ff]">
          <Volume2 className={`${isEnglish ? "mr-2" : "ml-2"} h-4 w-4`} />{soundEnabled ? (isEnglish ? "Tap to ready notification sound" : "اضغط لتجهيز صوت الإشعارات") : (isEnglish ? "Enable notification sound" : "تفعيل صوت الإشعارات")}
        </Button>
      ) : null}
      <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          className={`fixed bottom-24 left-4 z-40 h-12 w-12 rounded-full bg-[#0878f9] text-white shadow-[0_14px_30px_rgba(8,120,249,.3)] hover:bg-[#0668d9] ${unreadQuoteCount ? "quote-bell-alert" : ""}`}
          aria-label={unreadQuoteCount ? (isEnglish ? `${unreadQuoteCount} unread price quote notification(s)` : `${unreadQuoteCount} إشعار عرض سعر غير مقروء`) : (isEnglish ? "My request notifications" : "إشعارات طلباتي")}
        >
          <Bell className={`relative z-10 h-5 w-5 ${unreadQuoteCount ? "quote-bell-icon" : ""}`} />
          {notifications.data?.unreadCount ? (
            <span className="absolute -left-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#d83c4f] px-1 text-[10px] font-black text-white">
              {notifications.data.unreadCount > 99 ? "99+" : notifications.data.unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-[min(92vw,400px)] rounded-2xl border-[#dce8f6] p-0" dir={isEnglish ? "ltr" : "rtl"}>
        <div className="flex items-center justify-between border-b border-[#e7eff8] p-4">
          <div>
            <h2 className="font-display text-lg font-black text-[#17334f]">{isEnglish ? "Request notifications" : "إشعارات طلباتك"}</h2>
            <p className="mt-1 text-xs text-[#60778f]">{isEnglish ? "Updates while this page is open" : "تتحدث أثناء فتح الصفحة"}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => soundEnabled ? disableSound() : void enableSound()} aria-label={soundEnabled ? (isEnglish ? "Disable notification sound" : "إيقاف صوت الإشعارات") : (isEnglish ? "Enable notification sound" : "تفعيل صوت الإشعارات")} className={soundReady ? "text-[#0878f9]" : "text-[#8295a8]"}>{soundReady ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}<span>{soundReady ? (isEnglish ? "Sound ready" : "الصوت جاهز") : soundEnabled ? (isEnglish ? "Ready sound" : "تجهيز الصوت") : (isEnglish ? "Enable sound" : "تفعيل الصوت")}</span></Button>
            {notifications.data?.unreadCount ? (
              <Button type="button" variant="ghost" size="sm" disabled={markAllRead.isPending} onClick={() => void readAll()} className="text-[#0878f9]">
                <CheckCheck className={`${isEnglish ? "mr-1" : "ml-1"} h-4 w-4`} />
                {isEnglish ? "Read all" : "قراءة الكل"}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {notifications.isLoading ? (
            <div className="grid min-h-32 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[#0878f9]" /></div>
          ) : visibleNotifications.length ? (
            visibleNotifications.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => void openNotification(item)}
                className={`mb-2 flex w-full items-start gap-3 rounded-xl border border-[#b7dbff] bg-[#f0f8ff] p-3 ${isEnglish ? "text-left" : "text-right"}`}
              >
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#0878f9]" />
                <span>
                  <span className="block text-sm font-extrabold text-[#17334f]">{isEnglish ? englishTitles[item.type] ?? item.title : item.title}</span>
                  <span className="mt-1 block text-xs leading-6 text-[#60778f]">{isEnglish ? englishMessages[item.type] ?? item.message : item.message}</span>
                  <time className="mt-2 block text-[11px] font-bold text-[#8a9bad]">{new Date(item.createdAt).toLocaleString(isEnglish ? "en-US" : "ar-SA")}</time>
                </span>
              </button>
            ))
          ) : (
            <div className="px-5 py-10 text-center text-sm font-bold text-[#60778f]">{isEnglish ? "No new notifications" : "لا توجد إشعارات جديدة"}</div>
          )}
        </div>
      </PopoverContent>
      </Popover>
    </>
  );
}
