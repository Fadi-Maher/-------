import { PwaInstall } from "@/components/PwaInstall";
import { CheckCircle2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const APP_DEMO_VIDEO_URL = "/manus-storage/maalamati-my-requests-demo_0ac8bb82.mp4";
const APP_DEMO_POSTER_URL = "/manus-storage/maalamati-requests-scene-1_7c388ba9.png";

export function AppShowcaseSection({ isEnglish }: { isEnglish: boolean }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [videoUnavailable, setVideoUnavailable] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReduceMotion(preference.matches);
    updatePreference();
    preference.addEventListener?.("change", updatePreference);
    return () => preference.removeEventListener?.("change", updatePreference);
  }, []);

  const copy = isEnglish ? {
    kicker: "Maalamati Care on your device",
    title: "Your transaction is easier with the Maalamati Care app",
    body: "A faster experience with timely notifications. Compare quotes, follow progress, and keep every update and attachment in one organized place.",
    installLabel: "Install Maalamati Care now",
    note: "A secure web app that installs directly from your browser.",
    quotes: "Compare quotes",
    quoteHint: "Price and completion time",
  } : {
    kicker: "معاملاتي كير على جهازك",
    title: "معاملتك أسهل مع تطبيق معاملاتي كير",
    body: "تجربة استخدام أسرع وإشعارات في وقتها. قارن العروض، تابع الإنجاز، واحتفظ بكل تحديث ومرفق في مكان واحد منظم.",
    installLabel: "ثبّت تطبيق معاملاتي كير الآن",
    note: "تطبيق ويب آمن يُثبّت مباشرة من متصفحك.",
    quotes: "قارن العروض",
    quoteHint: "السعر ومدة الإنجاز",
  };

  return (
    <section id="maalamati-app" className="relative overflow-hidden bg-[linear-gradient(135deg,#f7fcff_0%,#e7f6ff_42%,#e8fbf5_100%)] py-16 sm:py-20 lg:py-24" dir={isEnglish ? "ltr" : "rtl"}>
      <div className="pointer-events-none absolute inset-0 opacity-55" style={{ backgroundImage: "radial-gradient(circle at 18% 24%,rgba(76,190,255,.34),transparent 28%),radial-gradient(circle at 84% 72%,rgba(98,226,183,.28),transparent 30%)" }} />
      <div className="pointer-events-none absolute inset-0 opacity-[.16]" style={{ backgroundImage: "linear-gradient(rgba(8,120,249,.14) 1px,transparent 1px),linear-gradient(90deg,rgba(8,120,249,.14) 1px,transparent 1px)", backgroundSize: "42px 42px", maskImage: "linear-gradient(to bottom,transparent,black 28%,black 72%,transparent)" }} />
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rotate-12 rounded-[4.5rem] border border-white/70 bg-white/24 shadow-[inset_0_0_45px_rgba(255,255,255,.55)] backdrop-blur-sm" />
      <div className="pointer-events-none absolute -right-28 bottom-0 h-80 w-80 -rotate-12 rounded-[5rem] border border-white/60 bg-[#9ee8d0]/18 shadow-[inset_0_0_50px_rgba(255,255,255,.45)]" />
      <div className="pointer-events-none absolute left-[43%] top-10 h-32 w-32 rounded-full border-[18px] border-white/55 shadow-[0_16px_40px_rgba(31,109,181,.08)]" />

      <div className="container relative grid gap-12 lg:grid-cols-[.92fr_1.08fr] lg:items-center lg:gap-16">
        <div className="relative z-10 text-center lg:text-start">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-xs font-extrabold text-[#0878f9] shadow-[0_8px_18px_rgba(31,109,181,.06)]">
            <Sparkles className="h-3.5 w-3.5" />{copy.kicker}
          </span>
          <h2 className="font-display mt-5 text-3xl font-black leading-[1.35] tracking-[-0.075em] text-[#102a43] sm:text-5xl lg:text-[3.5rem]">{copy.title}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[#526d85] sm:text-lg lg:mx-0">{copy.body}</p>
          <div className="mt-8 flex flex-col items-center gap-3 lg:items-start">
            <p className="text-sm font-black text-[#17334f]">{copy.installLabel}</p>
            <PwaInstall variant="showcase" isEnglish={isEnglish} showPush={false} />
            <p className="flex items-center gap-2 text-xs font-bold text-[#60778f]"><CheckCircle2 className="h-4 w-4 text-[#19a961]" />{copy.note}</p>
          </div>
        </div>

        <div className="relative mx-auto h-[545px] w-full max-w-[650px] sm:h-[635px]" aria-label={isEnglish ? "Maalamati Care app preview on a photorealistic modern phone" : "معاينة تطبيق معاملاتي كير على هاتف حديث واقعي"}>
          <div className="absolute left-1/2 top-1/2 h-[86%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.98)_0%,rgba(153,220,255,.56)_40%,transparent_72%)] blur-2xl" />
          <div className={`absolute -top-5 z-20 h-[554px] w-[443px] transform-gpu sm:-top-8 sm:h-[658px] sm:w-[527px] ${isEnglish ? "right-[-4%] rotate-[0.75deg]" : "left-[-4%] -rotate-[0.75deg]"}`}>
            <span aria-hidden="true" className="absolute bottom-[2%] left-[46%] h-[6%] w-[66%] -translate-x-1/2 rounded-full bg-[#54230f]/25 blur-2xl" />

            <div
              data-testid="phone-frame-behind-video"
              aria-hidden="true"
              className="pointer-events-none absolute left-[20.2%] top-[6.4%] z-10 h-[87.2%] w-[59.6%] rounded-[3.15rem] border border-[#ffd0a9] bg-[linear-gradient(145deg,#4a1c08_0%,#db5515_8%,#ff9a45_19%,#ffc088_31%,#d94d10_49%,#ff8a2d_69%,#74300f_86%,#2e1308_100%)] shadow-[inset_3px_0_5px_rgba(255,227,199,.72),inset_-4px_0_7px_rgba(64,20,3,.58),0_34px_44px_rgba(82,36,12,.32)] sm:rounded-[3.65rem]"
            >
              <span className="absolute inset-[7px] rounded-[2.75rem] border-2 border-[#111419] bg-[#050608] shadow-[inset_0_0_0_1px_rgba(255,255,255,.16)] sm:inset-[8px] sm:rounded-[3.2rem]" />
              <span className="absolute -left-[5px] top-[19%] h-[8%] w-[6px] rounded-l-md bg-[linear-gradient(180deg,#ffb979,#ae3e0e,#ff9850)] shadow-[-2px_2px_5px_rgba(59,20,5,.25)]" />
              <span className="absolute -left-[5px] top-[31%] h-[13%] w-[6px] rounded-l-md bg-[linear-gradient(180deg,#ffb979,#ae3e0e,#ff9850)] shadow-[-2px_2px_5px_rgba(59,20,5,.25)]" />
              <span className="absolute -left-[5px] top-[47%] h-[13%] w-[6px] rounded-l-md bg-[linear-gradient(180deg,#ffb979,#ae3e0e,#ff9850)] shadow-[-2px_2px_5px_rgba(59,20,5,.25)]" />
              <span className="absolute -right-[5px] top-[30%] h-[19%] w-[6px] rounded-r-md bg-[linear-gradient(180deg,#ffb979,#a4370b,#ff9850)] shadow-[2px_2px_5px_rgba(59,20,5,.25)]" />
            </div>

            <div className="absolute left-[22.5%] top-[8.5%] z-20 h-[83%] w-[55%] overflow-hidden rounded-[2.6rem] bg-[#f6fbff] shadow-[inset_0_0_0_2px_rgba(11,14,18,.72),0_0_26px_rgba(255,147,70,.2)] sm:rounded-[3rem]">
              {!reduceMotion && !videoUnavailable ? (
                <video
                  className="absolute inset-0 h-full w-full object-cover"
                  src={APP_DEMO_VIDEO_URL}
                  poster={APP_DEMO_POSTER_URL}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-label={isEnglish ? "Short walkthrough of Maalamati Care app features" : "عرض قصير لمميزات تطبيق معاملاتي كير"}
                  onError={() => setVideoUnavailable(true)}
                />
              ) : (
                <img
                  src={APP_DEMO_POSTER_URL}
                  alt={isEnglish ? "My requests account overview" : "معاينة لوحة حساب طلباتي"}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[30%] bg-[linear-gradient(102deg,rgba(255,255,255,.2),rgba(255,255,255,.035)_48%,transparent_72%)]" />
            </div>

            <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[10.5%] z-30 h-[20px] w-[76px] -translate-x-1/2 rounded-full bg-[#020304] shadow-[0_1px_0_rgba(255,255,255,.12)] sm:h-[23px] sm:w-[86px]" />
          </div>
        </div>
      </div>
    </section>
  );
}
