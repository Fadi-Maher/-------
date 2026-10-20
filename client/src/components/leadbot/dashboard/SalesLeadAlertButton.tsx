import { useEffect, useRef } from "react";
import { Headset } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useSalesLang } from "./salesI18n";

export const SALES_SOUND_KEY = "maalamati-sales-sound";

export function isSalesSoundEnabled() {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(SALES_SOUND_KEY) === "on";
  } catch {
    return false;
  }
}

export function setSalesSoundEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(SALES_SOUND_KEY, enabled ? "on" : "off");
  } catch {
    // Private mode: the preference simply is not remembered.
  }
}

/** Short two-note chime generated in the browser (no media file). */
export function playSalesTone() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    [880, 1175].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.16;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.22);
      if (index === 1) oscillator.addEventListener("ended", () => void context.close());
    });
  } catch {
    // Audio can be blocked until the user interacts with the page.
  }
}

/**
 * Owner/staff alerts for the sales assistant: waiting handoffs, unread visitor
 * messages and new hot leads. Polls lightweight counters only (no lead data).
 * Only one mounted consumer should pass notify=true to avoid duplicate toasts.
 */
export function useSalesLeadAlerts({ notify }: { notify: boolean }) {
  const [location, navigate] = useLocation();
  const { t } = useSalesLang();
  const alerts = trpc.leadBot.staff.alerts.useQuery(undefined, { refetchInterval: 15_000, refetchIntervalInBackground: true, retry: false });
  const previous = useRef<{ waiting: number; hotNew: number; unread: number } | null>(null);

  useEffect(() => {
    const data = alerts.data;
    if (!data) return;
    const before = previous.current;
    previous.current = { waiting: data.waiting, hotNew: data.hotNew, unread: data.unread };
    if (!before || !notify) return;
    const onSalesPage = location.startsWith("/sales-assistant");
    const action = onSalesPage ? undefined : { label: t("alertOpen"), onClick: () => navigate("/sales-assistant") };
    let alerted = false;
    if (data.waiting > before.waiting) {
      toast.warning(t("alertWaitingTitle"), { description: t("alertWaitingBody"), action });
      alerted = true;
    } else if (data.hotNew > before.hotNew) {
      toast.success(t("alertHotTitle"), { description: t("alertHotBody"), action });
      alerted = true;
    } else if (data.unread > before.unread) {
      toast(t("alertUnread"), { action });
      alerted = true;
    }
    if (alerted && isSalesSoundEnabled()) playSalesTone();
    // Language changes must not replay alerts: only fresh counters trigger them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.data, location, navigate, notify]);

  const waiting = alerts.data?.waiting ?? 0;
  const unread = alerts.data?.unread ?? 0;
  const hotNew = alerts.data?.hotNew ?? 0;
  return {
    available: !alerts.isError,
    waiting,
    unread,
    hotNew,
    badge: waiting + hotNew + unread,
    label: t("alertSummary", { waiting, hot: hotNew, unread }),
    open: () => navigate("/sales-assistant"),
  };
}

export function SalesLeadAlertButton({ className, notify = true }: { className?: string; notify?: boolean }) {
  const alerts = useSalesLeadAlerts({ notify });
  if (!alerts.available) return null;
  return (
    <button
      type="button"
      onClick={alerts.open}
      aria-label={alerts.label}
      title={alerts.label}
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef7ff] text-[#0878f9] transition-colors hover:bg-[#e1f0ff] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        alerts.waiting > 0 && "bg-amber-50 text-amber-700",
        className,
      )}
    >
      <Headset className="h-4 w-4" aria-hidden="true" />
      {alerts.badge > 0 ? (
        <span className={cn("absolute -left-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-black text-white", alerts.waiting > 0 ? "bg-amber-600" : "bg-[#d83c4f]")} aria-hidden="true">
          {alerts.badge > 99 ? "99+" : alerts.badge}
        </span>
      ) : null}
    </button>
  );
}

/** Count badge for the "مساعد المبيعات" sidebar item (desktop owner layout). */
export function SalesLeadMenuBadge({ notify }: { notify: boolean }) {
  const alerts = useSalesLeadAlerts({ notify });
  if (!alerts.available || alerts.badge === 0) return null;
  return (
    <span
      className={cn("ms-auto grid min-h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-black text-white group-data-[collapsible=icon]:hidden", alerts.waiting > 0 ? "bg-amber-600" : "bg-[#d83c4f]")}
      aria-label={alerts.label}
      title={alerts.label}
    >
      {alerts.badge > 99 ? "99+" : alerts.badge}
    </span>
  );
}
