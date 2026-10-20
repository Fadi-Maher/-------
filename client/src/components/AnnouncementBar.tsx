import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, Megaphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { isExternalAnnouncementLink, normalizeAnnouncementLink, type AnnouncementTone } from "@shared/announcements";

export const ANNOUNCEMENT_DISMISS_KEY = "maalamati-announcement-dismissed";

/** Public marketing pages only. Accounts, dashboards and login pages never show the bar. */
const announcementPaths = new Set(["/", "/about", "/contact", "/track", "/customer-signup", "/terms-and-conditions", "/refund-and-cancellation"]);

export function isAnnouncementPath(pathname: string) {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return announcementPaths.has(normalized);
}

const toneStyles: Record<AnnouncementTone, { bar: string; icon: string; link: string; close: string }> = {
  info: {
    bar: "bg-[linear-gradient(100deg,#0a3f7a,#0878f9)] text-white",
    icon: "bg-white/15 text-white",
    link: "bg-white text-[#0a4f9e] hover:bg-[#eaf3ff] focus-visible:ring-white",
    close: "text-white/85 hover:bg-white/15 hover:text-white focus-visible:ring-white",
  },
  success: {
    bar: "bg-[linear-gradient(100deg,#0b5a40,#13805b)] text-white",
    icon: "bg-white/15 text-white",
    link: "bg-white text-[#0b5a40] hover:bg-[#e8f7f0] focus-visible:ring-white",
    close: "text-white/85 hover:bg-white/15 hover:text-white focus-visible:ring-white",
  },
  warning: {
    bar: "border-b border-[#f1d58a] bg-[#fff6dc] text-[#5c3b00]",
    icon: "bg-[#ffe7a3] text-[#7a4d00]",
    link: "bg-[#5c3b00] text-white hover:bg-[#432b00] focus-visible:ring-[#5c3b00]",
    close: "text-[#7a4d00] hover:bg-[#ffe7a3] focus-visible:ring-[#5c3b00]",
  },
};

const toneIcons = { info: Megaphone, success: CheckCircle2, warning: AlertTriangle } as const;

function readDismissed() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ANNOUNCEMENT_DISMISS_KEY);
  } catch {
    return null;
  }
}

export type AnnouncementContent = {
  messageAr: string;
  messageEn: string;
  linkUrl: string | null;
  linkLabelAr: string | null;
  linkLabelEn: string | null;
  tone: AnnouncementTone;
  dismissible: boolean;
};

/** Presentational bar shared by the public site and the owner's live preview. */
export function AnnouncementBarView({ announcement, isEnglish, onDismiss, preview = false }: { announcement: AnnouncementContent; isEnglish: boolean; onDismiss?: () => void; preview?: boolean }) {
  const tone = toneStyles[announcement.tone] ?? toneStyles.info;
  const ToneIcon = toneIcons[announcement.tone] ?? Megaphone;
  const message = isEnglish ? announcement.messageEn : announcement.messageAr;
  const normalizedLink = normalizeAnnouncementLink(announcement.linkUrl);
  const link = normalizedLink && normalizedLink !== "invalid" ? normalizedLink : null;
  const linkLabel = isEnglish ? announcement.linkLabelEn || "Learn more" : announcement.linkLabelAr || "اعرف المزيد";
  const external = link ? isExternalAnnouncementLink(link) : false;
  const Arrow = isEnglish ? ArrowRight : ArrowLeft;
  const linkClass = "inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent sm:text-sm";
  const linkContent = (
    <>
      <span>{linkLabel}</span>
      {external ? <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> : <Arrow className="h-3.5 w-3.5" aria-hidden="true" />}
      {external && !preview ? <span className="sr-only">{isEnglish ? "(opens in a new tab)" : "(يفتح في نافذة جديدة)"}</span> : null}
    </>
  );
  const Wrapper = preview ? "div" : "aside";

  return (
    <Wrapper
      aria-label={preview ? undefined : isEnglish ? "Site announcement" : "إعلان الموقع"}
      dir={isEnglish ? "ltr" : "rtl"}
      lang={isEnglish ? "en" : "ar"}
      data-testid={preview ? "site-announcement-preview" : "site-announcement"}
      data-tone={announcement.tone}
      className={`relative w-full ${preview ? "overflow-hidden rounded-xl" : "z-[45]"} ${tone.bar}`}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-3 py-2 sm:gap-3 sm:px-4">
        <span className={`hidden h-7 w-7 shrink-0 place-items-center rounded-full sm:grid ${tone.icon}`}>
          <ToneIcon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="min-w-0 break-words text-[13px] font-bold leading-6 sm:text-sm">{message || (isEnglish ? "Announcement text" : "نص الإعلان")}</p>
          {link ? (
            preview ? (
              <span className={`${linkClass} ${tone.link}`}>{linkContent}</span>
            ) : external ? (
              <a href={link} target="_blank" rel="noopener noreferrer" className={`${linkClass} ${tone.link}`}>
                {linkContent}
              </a>
            ) : (
              <Link href={link} className={`${linkClass} ${tone.link}`}>
                {linkContent}
              </Link>
            )
          ) : null}
        </div>
        {announcement.dismissible ? (
          preview ? (
            <span aria-hidden="true" className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${tone.close}`}>
              <X className="h-4 w-4" />
            </span>
          ) : (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={isEnglish ? "Close announcement" : "إغلاق الإعلان"}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 ${tone.close}`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )
        ) : null}
      </div>
    </Wrapper>
  );
}

export function AnnouncementBar() {
  const { isEnglish } = useLanguage();
  const [location] = useLocation();
  const visibleOnPage = isAnnouncementPath(location);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() => readDismissed());
  const live = trpc.siteAnnouncements.live.useQuery(undefined, {
    enabled: visibleOnPage,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === ANNOUNCEMENT_DISMISS_KEY) setDismissedVersion(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const announcement = live.data;
  if (!visibleOnPage || !announcement) return null;
  if (announcement.dismissible && dismissedVersion === announcement.version) return null;

  const dismiss = () => {
    setDismissedVersion(announcement.version);
    try {
      window.localStorage.setItem(ANNOUNCEMENT_DISMISS_KEY, announcement.version);
    } catch {
      // Storage can be unavailable (private mode); the bar still hides for this visit.
    }
  };

  return <AnnouncementBarView announcement={announcement} isEnglish={isEnglish} onDismiss={dismiss} />;
}
