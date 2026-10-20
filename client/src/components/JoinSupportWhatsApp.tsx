import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { whatsAppChatHref } from "@/lib/whatsapp";
import { Headset, MessageCircle } from "lucide-react";

export const JOIN_SUPPORT_MESSAGE = {
  ar: "مرحبًا، لدي استفسار عن الانضمام كمعقّب في معاملاتي كير.",
  en: "Hello, I have a question about joining Maalamati Care as an agent.",
} as const;

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
  const copy = copyFor(isEnglish, isWhatsApp);
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
          {text.hint ? <p className="mt-1 text-xs text-[#60778f]">{text.hint}</p> : null}
        </div>
      </div>
      <a
        href={href ?? "/contact"}
        target={isWhatsApp ? "_blank" : undefined}
        rel={isWhatsApp ? "noopener noreferrer" : undefined}
        aria-label={copy.aria}
        data-support-channel={isWhatsApp ? "whatsapp" : "contact"}
        className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#17a65a] px-5 text-sm font-extrabold text-white shadow-[0_4px_0_#0f7a41] transition-[transform,background-color] duration-150 hover:bg-[#13914e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17a65a] focus-visible:ring-offset-2 active:translate-y-0.5 active:shadow-[0_2px_0_#0f7a41]"
      >
        {isWhatsApp ? <MessageCircle className="h-4 w-4" aria-hidden="true" /> : <Headset className="h-4 w-4" aria-hidden="true" />}
        {copy.label}
      </a>
    </aside>
  );
}
