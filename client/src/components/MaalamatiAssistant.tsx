import { AIChatBox, type Message } from "@/components/AIChatBox";
import { AssistantAvatar } from "@/components/AssistantAvatar";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Database, ExternalLink, MessageCircle, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const CONSENT_STORAGE_KEY = "maalamati-assistant-history-consent";
const SESSION_STORAGE_KEY = "maalamati-assistant-history-session";
const EMPTY_PUBLIC_ID = "00000000-0000-4000-8000-000000000000";
type ConsentChoice = "pending" | "accepted" | "declined";

import { isPublicAssistantPath } from "@/lib/publicAssistantPaths";
export { isPublicAssistantPath };
export function MaalamatiAssistant() {
  const { isEnglish } = useLanguage();
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [consentChoice, setConsentChoice] = useState<ConsentChoice>(() => {
    if (typeof window === "undefined") return "pending";
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return stored === "accepted" || stored === "declined" ? stored : "pending";
  });
  const [publicId, setPublicId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(SESSION_STORAGE_KEY);
  });
  const settings = trpc.settings.publicConfig.useQuery();
  const phone = settings.data?.whatsappNumber;
  const copy = isEnglish
    ? {
        title: "Maalamati Care smart assistant",
        status: "Ready to guide you",
        launcher: "Smart assistant",
        welcome: "Hello, I am the Maalamati Care assistant. I can guide you through services, tracking, quotes, and your customer account.",
        placeholder: "Ask about Maalamati Care...",
        prompts: ["How do I track my request?", "How do price quotes work?", "Where can I see my requests?"],
        privacy: "Do not share mobile numbers, IDs, OTPs, or private documents.",
        consentTitle: "Save this conversation?",
        consentBody: "With your permission, Maalamati Care will save this chat so you can continue it on this browser. It is not linked automatically to your name or mobile number, and you can stop saving at any time.",
        consentAccept: "I agree to save",
        consentDecline: "Continue without saving",
        consentPending: "Saving your preference…",
        savedStatus: "Conversation history is saved",
        privateStatus: "This conversation is not saved",
        enableSaving: "Enable saving",
        stopSaving: "Stop saving",
        consentError: "Could not enable saving. You can continue without saving.",
        historyError: "Saved messages could not be restored, but you can continue chatting.",
        whatsapp: "WhatsApp support",
        error: "The assistant is unavailable right now. You can open Contact & Support for help.",
        open: "Open Maalamati Care smart assistant",
        close: "Close smart assistant",
      }
    : {
        title: "المساعد الذكي من معاملاتي كير",
        status: "جاهز لإرشادك",
        launcher: "المساعد الذكي",
        welcome: "مرحبًا، أنا مساعد معاملاتي كير. أستطيع إرشادك في الخدمات والتتبع وعروض الأسعار وحساب العميل.",
        placeholder: "اسأل عن معاملاتي كير...",
        prompts: ["كيف أتتبّع طلبي؟", "كيف تعمل عروض الأسعار؟", "أين أجد طلباتي؟"],
        privacy: "لا تشارك رقم الجوال أو الهوية أو رمز التحقق أو مستندات خاصة.",
        consentTitle: "هل توافق على حفظ هذه المحادثة؟",
        consentBody: "بعد موافقتك، تحفظ معاملاتي كير رسائل هذه المحادثة لتتمكن من متابعتها من هذا المتصفح. لا تُربط تلقائيًا باسمك أو رقم جوالك، ويمكنك إيقاف الحفظ في أي وقت.",
        consentAccept: "أوافق على الحفظ",
        consentDecline: "المتابعة دون حفظ",
        consentPending: "جارٍ حفظ اختيارك…",
        savedStatus: "سجل المحادثة محفوظ",
        privateStatus: "هذه المحادثة غير محفوظة",
        enableSaving: "تفعيل الحفظ",
        stopSaving: "إيقاف الحفظ",
        consentError: "تعذر تفعيل الحفظ. يمكنك المتابعة دون حفظ.",
        historyError: "تعذر استعادة الرسائل المحفوظة، ويمكنك متابعة المحادثة.",
        whatsapp: "دعم واتساب",
        error: "المساعد غير متاح الآن. يمكنك فتح صفحة «تواصل ودعم» للحصول على المساعدة.",
        open: "فتح المساعد الذكي من معاملاتي كير",
        close: "إغلاق المساعد الذكي",
      };

  const consent = trpc.assistant.consent.useMutation({
    onSuccess: (_result, input) => {
      setPublicId(input.publicId);
      setConsentChoice("accepted");
      window.localStorage.setItem(SESSION_STORAGE_KEY, input.publicId);
      window.localStorage.setItem(CONSENT_STORAGE_KEY, "accepted");
    },
  });
  const history = trpc.assistant.history.useQuery(
    { publicId: publicId || EMPTY_PUBLIC_ID },
    { enabled: consentChoice === "accepted" && Boolean(publicId), refetchOnWindowFocus: false },
  );
  const revokeConsent = trpc.assistant.revokeConsent.useMutation({
    onSuccess: () => {
      setConsentChoice("declined");
      setPublicId(null);
      window.localStorage.setItem(CONSENT_STORAGE_KEY, "declined");
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    },
  });

  useEffect(() => {
    if (consentChoice === "accepted") return;
    setMessages([]);
  }, [isEnglish, consentChoice]);

  useEffect(() => {
    if (window.location.hash === "#assistant") setIsOpen(true);
  }, [location]);

  useEffect(() => {
    if (!history.data) return;
    if (history.data.consented) {
      setMessages(history.data.messages.map(message => ({ role: message.role, content: message.content })));
      return;
    }
    if (consentChoice === "accepted") {
      setConsentChoice("pending");
      setPublicId(null);
      window.localStorage.removeItem(CONSENT_STORAGE_KEY);
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [history.data, consentChoice]);

  const chat = trpc.assistant.chat.useMutation();
  const sendMessage = (content: string) => {
    const trimmed = content.trim().slice(0, 600);
    if (!trimmed || chat.isPending) return;
    const nextMessages: Message[] = [...messages, { role: "user" as const, content: trimmed }].slice(-8);
    setMessages(nextMessages);
    chat.mutate(
      {
        language: isEnglish ? "en" : "ar",
        messages: nextMessages.map(message => ({ role: message.role === "system" ? "assistant" : message.role, content: message.content })),
        consentSessionId: consentChoice === "accepted" ? publicId : null,
      },
      {
        onSuccess: result => setMessages(current => [...current, { role: "assistant" as const, content: result.reply }].slice(-8)),
        onError: () => setMessages(current => [...current, { role: "assistant" as const, content: copy.error }].slice(-8)),
      },
    );
  };

  const acceptSaving = () => {
    const nextPublicId = crypto.randomUUID();
    consent.mutate({ publicId: nextPublicId, language: isEnglish ? "en" : "ar", consent: true });
  };

  const declineSaving = () => {
    setConsentChoice("declined");
    setPublicId(null);
    window.localStorage.setItem(CONSENT_STORAGE_KEY, "declined");
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  const stopSaving = () => {
    if (!publicId || revokeConsent.isPending) return;
    revokeConsent.mutate({ publicId });
  };

  if (!isPublicAssistantPath(location)) return null;
  const whatsappMessage = encodeURIComponent(isEnglish ? "Hello, I need support with Maalamati Care." : "مرحبًا، أحتاج دعمًا بخصوص معاملاتي كير.");

  return (
    <div className="fixed bottom-4 left-4 z-[70] sm:bottom-5 sm:left-5" dir={isEnglish ? "ltr" : "rtl"}>
      {isOpen ? (
        <section
          role="dialog"
          aria-modal="false"
          aria-label={copy.title}
          className="assistant-panel flex h-[min(620px,calc(100dvh-2rem))] w-[min(370px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.6rem] border border-[#d8e8f8] bg-white shadow-[0_24px_70px_rgba(20,73,126,.24)]"
        >
          <header className="relative overflow-hidden bg-[linear-gradient(115deg,#0878f9,#6b35ff)] px-5 pb-4 pt-5 text-white">
            <span className="absolute -right-9 -top-12 h-32 w-32 rounded-full border-[18px] border-white/10" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white/25 bg-white shadow-lg">
                  <AssistantAvatar />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display truncate text-base font-black">{copy.title}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-white/80"><span className="h-2 w-2 rounded-full bg-[#d8ff4f]" />{copy.status}</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} aria-label={copy.close} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/12 text-white transition-colors hover:bg-white/22">
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="flex items-center justify-between gap-3 border-b border-[#e7eff8] bg-[#f8fbff] px-4 py-2.5">
            <p className="flex min-w-0 items-center gap-2 text-[11px] font-bold leading-5 text-[#60778f]"><ShieldCheck className="h-4 w-4 shrink-0 text-[#0878f9]" />{copy.privacy}</p>
            {phone ? (
              <a href={`https://wa.me/${phone}?text=${whatsappMessage}`} target="_blank" rel="noreferrer" aria-label={copy.whatsapp} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e9fff2] text-[#17a65a]" title={copy.whatsapp}>
                <MessageCircle className="h-4 w-4" />
              </a>
            ) : null}
          </div>

          {consentChoice === "pending" ? (
            <div className="border-b border-[#d8e8f8] bg-[#f1f7ff] p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#0878f9] shadow-sm"><Database className="h-4 w-4" /></span>
                <div className="min-w-0"><h3 className="text-sm font-black text-[#17334f]">{copy.consentTitle}</h3><p className="mt-1 text-xs leading-5 text-[#60778f]">{copy.consentBody}</p></div>
              </div>
              {consent.isError ? <p className="mt-2 text-xs font-bold text-[#b33b47]">{copy.consentError}</p> : null}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={acceptSaving} disabled={consent.isPending} className="rounded-xl bg-[#0878f9] px-3 py-2.5 text-xs font-black text-white transition-transform active:scale-[.97] disabled:opacity-60">{consent.isPending ? copy.consentPending : copy.consentAccept}</button>
                <button type="button" onClick={declineSaving} disabled={consent.isPending} className="rounded-xl border border-[#bfd7ef] bg-white px-3 py-2.5 text-xs font-black text-[#31516e] transition-transform active:scale-[.97]">{copy.consentDecline}</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 border-b border-[#e7eff8] bg-white px-4 py-2.5">
              <p className={`flex items-center gap-2 text-[11px] font-bold ${consentChoice === "accepted" ? "text-[#168653]" : "text-[#60778f]"}`}>
                {consentChoice === "accepted" ? <CheckCircle2 className="h-4 w-4" /> : <Database className="h-4 w-4" />}
                {consentChoice === "accepted" ? copy.savedStatus : copy.privateStatus}
              </p>
              <button type="button" onClick={consentChoice === "accepted" ? stopSaving : () => setConsentChoice("pending")} disabled={revokeConsent.isPending} className="shrink-0 text-[11px] font-black text-[#0878f9] underline-offset-4 hover:underline">
                {consentChoice === "accepted" ? copy.stopSaving : copy.enableSaving}
              </button>
            </div>
          )}

          {history.isError ? <p className="border-b border-[#ffd1d5] bg-[#fff4f5] px-4 py-2 text-xs font-bold text-[#a9323f]">{copy.historyError}</p> : null}

          <AIChatBox
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={chat.isPending}
            placeholder={copy.placeholder}
            emptyStateMessage={copy.welcome}
            suggestedPrompts={copy.prompts}
            height="100%"
            className="min-h-0 flex-1 rounded-none border-0 shadow-none"
          />
          <a href="/contact" className="flex h-10 items-center justify-center gap-1.5 border-t border-[#e7eff8] bg-white text-xs font-extrabold text-[#0878f9]">
            {isEnglish ? "Open Contact & Support" : "فتح تواصل ودعم"}<ExternalLink className="h-3.5 w-3.5" />
          </a>
        </section>
      ) : (
        <button type="button" onClick={() => setIsOpen(true)} aria-label={copy.open} className="assistant-launcher group flex items-center gap-3 rounded-full bg-[linear-gradient(115deg,#0878f9,#6b35ff)] p-2 text-white shadow-[0_16px_35px_rgba(64,70,220,.30)] transition-transform duration-200 hover:-translate-y-1 active:scale-[.97] sm:pe-4">
          <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border-2 border-white/35 bg-white"><AssistantAvatar /></span>
          <span className="hidden text-sm font-black sm:inline">{copy.launcher}</span>
          <Sparkles className="hidden h-4 w-4 text-[#d8ff4f] sm:block" />
        </button>
      )}
    </div>
  );
}
