import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Bell, BellOff, Check, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function urlBase64ToUint8Array(value: string) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export function PwaInstall({ variant = "footer", isEnglish = false, showPush = true }: { variant?: "footer" | "showcase"; isEnglish?: boolean; showPush?: boolean }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const pushConfig = trpc.push.publicConfig.useQuery();
  const subscribe = trpc.push.subscribe.useMutation();
  const unsubscribe = trpc.push.unsubscribe.useMutation();
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone;
    setInstalled(Boolean(standalone));
    navigator.serviceWorker?.ready.then((registration) => registration.pushManager.getSubscription()).then((subscription) => setPushEnabled(Boolean(subscription))).catch(() => undefined);
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!installPrompt) {
      toast.message(isEnglish ? "Use “Add to Home Screen” from your browser menu to install the app." : "استخدم خيار «إضافة إلى الشاشة الرئيسية» من قائمة المتصفح لتثبيت التطبيق.");
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      toast.success(isEnglish ? "Maalamati Care was added to your device." : "تمت إضافة معاملاتي كير إلى جهازك.");
    }
    setInstallPrompt(null);
  };

  const togglePush = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !pushConfig.data?.publicKey) {
      toast.error("لا يدعم هذا المتصفح إشعارات التطبيق.");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      if (current) {
        await unsubscribe.mutateAsync({ endpoint: current.endpoint });
        await current.unsubscribe();
        setPushEnabled(false);
        toast.success("تم إيقاف اشتراك الإشعارات لهذا الجهاز.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.message("يمكنك تفعيل الإشعارات لاحقًا من إعدادات المتصفح.");
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pushConfig.data.publicKey),
      });
      const serialized = subscription.toJSON();
      const p256dh = serialized.keys?.p256dh;
      const auth = serialized.keys?.auth;
      if (!p256dh || !auth) throw new Error("Push subscription keys are unavailable");
      await subscribe.mutateAsync({ endpoint: subscription.endpoint, p256dh, auth });
      setPushEnabled(true);
      toast.success("تم حفظ اشتراك الإشعارات لهذا الجهاز.");
    } catch {
      toast.error("تعذر تفعيل إشعارات التطبيق الآن.");
    }
  };

  const showcase = variant === "showcase";
  return (
    <div className="flex flex-wrap items-center gap-2" dir={isEnglish ? "ltr" : "rtl"}>
      <Button type="button" onClick={install} variant="outline" className={showcase ? "h-12 rounded-xl border-[#0878f9] bg-[#0878f9] px-6 text-sm font-extrabold text-white shadow-[0_5px_0_#0457ba] hover:bg-[#0668d9] hover:text-white" : "h-10 rounded-full border-[#d7ad7a]/50 bg-transparent px-4 text-xs text-[#f8f3ea] hover:bg-white/10 hover:text-[#f8f3ea]"}>
        {installed ? <Check className={`${isEnglish ? "mr-2" : "ml-2"} h-4 w-4 ${showcase ? "text-white" : "text-[#e5af77]"}`} /> : <Download className={`${isEnglish ? "mr-2" : "ml-2"} h-4 w-4 ${showcase ? "text-white" : "text-[#e5af77]"}`} />}
        {installed ? (isEnglish ? "App installed" : "التطبيق مثبّت") : (isEnglish ? "Install the app" : "ثبّت التطبيق")}
      </Button>
      {showPush ? <Button type="button" onClick={togglePush} disabled={pushConfig.isLoading || subscribe.isPending || unsubscribe.isPending} variant="outline" className="h-10 rounded-full border-[#d7ad7a]/50 bg-transparent px-4 text-xs text-[#f8f3ea] hover:bg-white/10 hover:text-[#f8f3ea]">
        {pushEnabled ? <BellOff className="ml-2 h-4 w-4 text-[#e5af77]" /> : <Bell className="ml-2 h-4 w-4 text-[#e5af77]" />}
        {pushEnabled ? (isEnglish ? "Disable device notifications" : "إيقاف إشعارات الجهاز") : (isEnglish ? "Enable device notifications" : "فعّل إشعارات الجهاز")}
      </Button> : null}
      {showPush ? <span className={`w-full text-xs leading-6 ${showcase ? "text-[#60778f]" : "text-[#d1ddd5]"}`}>{isEnglish ? "This device subscription receives status updates when the delivery channel is enabled." : "يُحفظ اشتراك هذا الجهاز لتلقي تحديثات الحالة عند تفعيل قناة الإرسال، ويتلقى فريق العمل تنبيهًا فوريًا عند وصول الطلب."}</span> : null}
    </div>
  );
}
