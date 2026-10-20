import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Bell, CheckCheck, ClipboardList, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type ApplicationNotification = {
  id: number;
  applicationId: number;
  reference: string;
  createdAt: number;
  readAt: number | null;
};

const supportsSse =
  typeof window !== "undefined" && typeof window.EventSource !== "undefined";

function readableDate(value: number, isEnglish: boolean) {
  return new Intl.DateTimeFormat(isEnglish ? "en" : "ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

/**
 * Contract consumed by AgentApplicationsPanel integration:
 * - URL: /agents?applicationId=<positive integer>
 * - Browser event: "admin-application:open", detail: { applicationId: number }
 *
 * The URL is the durable hand-off. The event is dispatched after navigation as
 * an optional immediate-focus signal for an already-mounted panel.
 */
function openApplicationInAdminPanel(
  applicationId: number,
  setLocation: (to: string) => void,
) {
  setLocation(`/agents?applicationId=${encodeURIComponent(String(applicationId))}`);
  window.setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent("admin-application:open", { detail: { applicationId } }),
    );
  }, 0);
}

export function AdminApplicationNotificationCenter() {
  const { isEnglish } = useLanguage();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  // This is intentionally a union rather than the current 50-row page. A row
  // that temporarily falls outside that window must never become "new" again.
  const knownNotificationIds = useRef<Set<number> | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const openingApplication = useRef(false);

  const copy = isEnglish
    ? {
        title: "Agent membership applications",
        realtime: "Live updates while the admin stream is connected.",
        polling: "Near-real-time updates every 3 seconds while the live stream reconnects.",
        bell: "Agent membership application notifications",
        unreadBell: (count: number) => `${count} unread agent membership application notifications`,
        readAll: "Read all",
        loading: "Loading notifications",
        loadError: "We could not load notifications. Reopen the menu or refresh the page.",
        empty: "No membership application notifications.",
        newApplication: "New membership application",
        unread: "Unread",
        markReadError: "We could not mark this notification as read.",
        markAllError: "We could not mark notifications as read.",
        toastOne: "A new agent membership application arrived.",
        toastMany: (count: number) => `${count} new agent membership applications arrived.`,
      }
    : {
        title: "طلبات انضمام المعقبين",
        realtime: "تحديث فوري أثناء اتصال بث الإدارة.",
        polling: "التحديث شبه فوري كل 3 ثوانٍ أثناء إعادة اتصال البث المباشر.",
        bell: "إشعارات طلبات انضمام المعقبين",
        unreadBell: (count: number) => `${count} إشعار طلب انضمام غير مقروء`,
        readAll: "قراءة الكل",
        loading: "جارٍ تحميل الإشعارات",
        loadError: "تعذر تحميل الإشعارات. أعد فتح القائمة أو حدّث الصفحة.",
        empty: "لا توجد إشعارات طلبات انضمام.",
        newApplication: "طلب انضمام جديد",
        unread: "غير مقروء",
        markReadError: "تعذر تعليم الإشعار كمقروء.",
        markAllError: "تعذر تعليم الإشعارات كمقروءة.",
        toastOne: "وصل طلب انضمام معقب جديد.",
        toastMany: (count: number) => `وصلت ${count} طلبات انضمام معقبين جديدة.`,
      };

  const notifications = trpc.adminApplicationNotifications.list.useQuery(
    undefined,
    {
      // Do not infer a healthy stream from EventSource capability alone. Poll
      // until onStarted confirms connection and resume it after any error.
      refetchInterval: streamConnected ? false : 3_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    },
  );

  const refreshFromSignal = useCallback(async () => {
    await Promise.all([
      utils.adminApplicationNotifications.list.invalidate(),
      utils.agentApplications.list.invalidate(),
    ]);
  }, [utils]);

  trpc.adminApplicationNotifications.onNew.useSubscription(undefined, {
    enabled: supportsSse,
    // This reconciliation makes notifications durable across reconnects. The
    // toast remains driven by rows newly observed after the initial DB baseline.
    onStarted: () => {
      setStreamConnected(true);
      void refreshFromSignal();
    },
    onData: signal => {
      if (signal.type === "application_created") void refreshFromSignal();
    },
    onError: () => setStreamConnected(false),
    onComplete: () => setStreamConnected(false),
  });

  const markRead = trpc.adminApplicationNotifications.markRead.useMutation({
    onSuccess: () => void utils.adminApplicationNotifications.list.invalidate(),
  });
  const markAllRead =
    trpc.adminApplicationNotifications.markAllRead.useMutation({
      onSuccess: () => void utils.adminApplicationNotifications.list.invalidate(),
    });

  const items = (notifications.data?.items ?? []) as ApplicationNotification[];
  const unreadCount = notifications.data?.unreadCount ?? 0;

  useEffect(() => {
    // A query can be undefined during the initial render. Never seed from that
    // synthetic empty array, otherwise the first persisted history is toasted.
    if (!notifications.data) return;

    if (knownNotificationIds.current === null) {
      knownNotificationIds.current = new Set(items.map(item => item.id));
      return;
    }

    const newUnreadItems = items.filter(
      item => item.readAt === null && !knownNotificationIds.current!.has(item.id),
    );
    items.forEach(item => knownNotificationIds.current!.add(item.id));

    if (newUnreadItems.length > 0) {
      toast.info(
        newUnreadItems.length === 1
          ? copy.toastOne
          : copy.toastMany(newUnreadItems.length),
      );
    }
  }, [copy, items, notifications.data]);

  const openNotification = async (notification: ApplicationNotification) => {
    try {
      if (notification.readAt === null) {
        await markRead.mutateAsync({ notificationId: notification.id });
      }
      openingApplication.current = true;
      setMenuOpen(false);
      openApplicationInAdminPanel(notification.applicationId, setLocation);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.markReadError);
    }
  };

  const readAll = async () => {
    try {
      await markAllRead.mutateAsync();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.markAllError);
    }
  };

  const textAlign = isEnglish ? "text-left" : "text-right";
  const direction = isEnglish ? "ltr" : "rtl";

  return (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-11 w-11 shrink-0 rounded-xl text-[#31516e] hover:bg-[#eaf3ff] hover:text-[#0668d9] focus-visible:ring-2 focus-visible:ring-[#0668d9]"
          aria-label={
            unreadCount ? copy.unreadBell(unreadCount) : copy.bell
          }
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 ? (
            <span
              className="absolute -left-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-[#c83243] px-1 text-[10px] font-black leading-none text-white"
              aria-hidden="true"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        className={`w-[min(92vw,320px)] rounded-2xl border-[#dce8f6] p-0 ${textAlign}`}
        dir={direction}
        onCloseAutoFocus={event => {
          if (openingApplication.current) {
            event.preventDefault();
            openingApplication.current = false;
          }
        }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#e7eff8] p-4">
          <div>
            <h2 className="font-display text-base font-black text-[#17334f]">
              {copy.title}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#60778f]">
              {streamConnected ? copy.realtime : copy.polling}
            </p>
          </div>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void readAll()}
              disabled={markAllRead.isPending}
              className="h-9 shrink-0 rounded-lg px-2 text-[#0668d9] hover:bg-[#edf6ff] hover:text-[#055bbd]"
            >
              <CheckCheck
                className={`${isEnglish ? "mr-1" : "ml-1"} h-4 w-4`}
                aria-hidden="true"
              />
              {copy.readAll}
            </Button>
          ) : null}
        </div>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {notifications.isLoading ? (
            <div className="grid min-h-32 place-items-center" aria-live="polite">
              <Loader2 className="h-6 w-6 animate-spin text-[#0878f9]" />
              <span className="sr-only">{copy.loading}</span>
            </div>
          ) : null}
          {notifications.isError ? (
            <div role="alert" className="p-4 text-sm leading-6 text-[#a63240]">
              {copy.loadError}
            </div>
          ) : null}
          {!notifications.isLoading && !notifications.isError && items.length === 0 ? (
            <div className="grid min-h-32 place-items-center px-4 text-center text-sm font-bold text-[#60778f]">
              {copy.empty}
            </div>
          ) : null}
          {!notifications.isLoading && !notifications.isError
            ? items.map(item => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => void openNotification(item)}
                  disabled={markRead.isPending}
                  className={`mb-2 flex w-full items-start gap-3 rounded-xl border p-3 ${textAlign} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0668d9] disabled:cursor-wait ${
                    item.readAt === null
                      ? "border-[#b7dbff] bg-[#f0f8ff] hover:bg-[#e7f3ff]"
                      : "border-[#e4eef8] bg-white hover:bg-[#f8fbff]"
                  }`}
                >
                  <span
                    className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                      item.readAt === null
                        ? "bg-[#0878f9] text-white"
                        : "bg-[#eef4fa] text-[#60778f]"
                    }`}
                    aria-hidden="true"
                  >
                    <ClipboardList className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold text-[#17334f]">
                      {copy.newApplication}
                    </span>
                    <span className="mt-1 block text-xs font-bold text-[#0878f9]" dir="ltr">
                      {item.reference}
                    </span>
                    <time className="mt-1.5 block text-[11px] text-[#6d8397]">
                      {readableDate(item.createdAt, isEnglish)}
                    </time>
                  </span>
                  {item.readAt === null ? (
                    <span
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#0878f9]"
                      aria-label={copy.unread}
                    />
                  ) : null}
                </button>
              ))
            : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
