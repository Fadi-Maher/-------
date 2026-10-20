import React, { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { whatsAppChatHref } from "@/lib/whatsapp";
import { CheckCircle2, Headset, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const JOIN_SUPPORT_MESSAGE = {
  ar: "مرحبًا، لدي استفسار عن الانضمام كمعقّب في معاملاتي كير.",
  en: "Hello, I have a question about joining Maalamati Care as an agent.",
} as const;

export const JOIN_SUPPORT_THANKS = {
  ar: {
    title: "شكرًا لتواصلك معنا",
    description:
      "فتحنا محادثة واتساب مع فريق دعم معاملاتي كير في نافذة جديدة. أرسل رسالتك وسنرد على استفسارك في أقرب وقت.",
    reopen: "لم تُفتح؟ افتح واتساب",
    inline:
      "شكرًا لتواصلك! فُتحت محادثة واتساب في نافذة جديدة؛ أرسل رسالتك وسيرد عليك فريق الدعم قريبًا.",
  },
  en: {
    title: "Thanks for reaching out",
    description:
      "We opened a WhatsApp chat with the Maalamati Care support team in a new tab. Send your message and we'll reply as soon as possible.",
    reopen: "Didn't open? Open WhatsApp",
    inline:
      "Thanks for reaching out! WhatsApp opened in a new tab; send your message and our support team will reply soon.",
  },
} as const;

export const JOIN_SUPPORT_THANKS_TOAST_ID = "join-support-thanks";

/**
 * Confirms the hand-off after the WhatsApp link opens (the click itself is never
 * blocked). One toast id avoids stacking on repeated clicks, and the action
 * reopens the chat if a browser did not open the new tab.
 */
export function showJoinSupportThanks(isEnglish: boolean, href: string) {
  const copy = JOIN_SUPPORT_THANKS[isEnglish ? "en" : "ar"];
  toast.success(copy.title, {
    id: JOIN_SUPPORT_THANKS_TOAST_ID,
    description: copy.description,
    duration: 7000,
    action: {
      label: copy.reopen,
      onClick: () => {
        window.open(href, "_blank", "noopener,noreferrer");
      },
    },
  });
}

/** Resolves the support destination: WhatsApp when the owner saved a number, else the contact page. */
export function useJoinSupportLink() {
  const { isEnglish } = useLanguage();
  const settings = trpc.settings.publicConfig.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const href = whatsAppChatHref(
    settings.data?.whatsappNumber,
    JOIN_SUPPORT_MESSAGE[isEnglish ? "en" : "ar"]
  );
  return { href, isWhatsApp: Boolean(href), isEnglish };
}

const copyFor = (isEnglish: boolean, isWhatsApp: boolean) =>
  isEnglish
    ? {
        label: isWhatsApp ? "Ask support on WhatsApp" : "Contact support",
        aria: isWhatsApp
          ? "Ask the support team on WhatsApp (opens in a new tab)"
          : "Contact the support team",
      }
    : {
        label: isWhatsApp ? "اسأل الدعم عبر واتساب" : "تواصل مع الدعم",
        aria: isWhatsApp
          ? "اسأل فريق الدعم عبر واتساب (يفتح في نافذة جديدة)"
          : "تواصل مع فريق الدعم",
      };

export function JoinSupportWhatsAppButton({ className = "" }: { className?: string }) {
  const { href, isWhatsApp, isEnglish } = useJoinSupportLink();
  const copy = copyFor(isEnglish, isWhatsApp);
  return (
    <a
      href={href ?? "/contact"}
      target={isWhatsApp ? "_blank" : undefined}
      rel={isWhatsApp ? "noopener noreferrer" : undefined}
      aria-label={copy.aria}
      data-support-channel={isWhatsApp ? "whatsapp" : "contact"}
      onClick={() => {
        if (isWhatsApp && href) showJoinSupportThanks(isEnglish, href);
      }}
      className={`inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#bfe5cf] bg-white px-5 text-sm font-extrabold text-[#137a43] transition-[transform,background-color,border-color] duration-150 hover:border-[#17a65a] hover:bg-[#f1fbf5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17a65a] focus-visible:ring-offset-2 active:scale-[0.97] ${className}`}
    >
      {isWhatsApp ? (
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Headset className="h-4 w-4" aria-hidden="true" />
      )}
      {copy.label}
    </a>
  );
}

/** A prominent support card shown under the FAQ for questions the page does not answer. */
export function JoinSupportCard() {
  const { href, isWhatsApp, isEnglish } = useJoinSupportLink();
  const [thanked, setThanked] = useState(false);
  const copy = copyFor(isEnglish, isWhatsApp);
  const thanks = JOIN_SUPPORT_THANKS[isEnglish ? "en" : "ar"];
  const text = isEnglish
    ? {
        title: "Still have a question?",
        body: isWhatsApp
          ? "Message our support team on WhatsApp about documents, review or activation and get a direct reply."
          : "Send your question to our support team and they will help you with documents, review or activation.",
        hint: isWhatsApp ? "A ready-made message opens; you can edit it before sending." : null,
      }
    : {
        title: "لديك سؤال لم تجد إجابته؟",
        body: isWhatsApp
          ? "راسل فريق الدعم عبر واتساب عن المستندات أو المراجعة أو التفعيل، واحصل على رد مباشر."
          : "أرسل سؤالك إلى فريق الدعم وسيساعدك في المستندات أو المراجعة أو التفعيل.",
        hint: isWhatsApp ? "تُفتح رسالة جاهزة يمكنك تعديلها قبل الإرسال." : null,
      };
  return (
    <aside
      className="mt-5 flex flex-col gap-4 rounded-2xl border border-[#cfeedd] bg-[#f3fcf6] p-5 sm:flex-row sm:items-center sm:justify-between"
      aria-labelledby="join-support-title"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#17a65a] text-white" aria-hidden="true">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 id="join-support-title" className="font-display text-lg font-extrabold text-[#102a43]">{text.title}</h3>
          <p className="mt-1 text-sm leading-7 text-[#41617e]">{text.body}</p>
          {thanked && isWhatsApp ? (
            <p
              data-support-thanks
              className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 mt-2 flex items-start gap-1.5 rounded-xl bg-white/80 px-3 py-2 text-xs font-bold leading-6 text-[#137a43]"
            >
              <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {thanks.inline}
            </p>
          ) : text.hint ? (
            <p className="mt-1 text-xs text-[#60778f]">{text.hint}</p>
          ) : null}
        </div>
      </div>
      <a
        href={href ?? "/contact"}
        target={isWhatsApp ? "_blank" : undefined}
        rel={isWhatsApp ? "noopener noreferrer" : undefined}
        aria-label={copy.aria}
        data-support-channel={isWhatsApp ? "whatsapp" : "contact"}
        onClick={() => {
          if (!isWhatsApp || !href) return;
          setThanked(true);
          showJoinSupportThanks(isEnglish, href);
        }}
        className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#17a65a] px-5 text-sm font-extrabold text-white shadow-[0_4px_0_#0f7a41] transition-[transform,background-color] duration-150 hover:bg-[#13914e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17a65a] focus-visible:ring-offset-2 active:translate-y-0.5 active:shadow-[0_2px_0_#0f7a41]"
      >
        {isWhatsApp ? <MessageCircle className="h-4 w-4" aria-hidden="true" /> : <Headset className="h-4 w-4" aria-hidden="true" />}
        {copy.label}
      </a>
    </aside>
  );
}
