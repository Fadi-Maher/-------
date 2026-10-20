/**
 * UI strings for the Maalamati Care sales assistant widget (ported from the
 * approved reference; product name unified to «معاملاتي كير» / Maalamati Care).
 */
import type { Lang } from "./catalog";

export const WIDGET_STRINGS = {
  "title": {
    "ar": "مساعد مبيعات معاملاتي كير",
    "en": "Maalamati Care sales assistant"
  },
  "launcher": {
    "ar": "مساعد المبيعات",
    "en": "Sales assistant"
  },
  "online": {
    "ar": "متصل الآن · يرد فورًا",
    "en": "Online · replies instantly"
  },
  "unavailableStatus": {
    "ar": "غير متاح حاليًا",
    "en": "Unavailable right now"
  },
  "offline": {
    "ar": "غير متصل بالإنترنت",
    "en": "You're offline"
  },
  "waitingAgent": {
    "ar": "بانتظار انضمام موظف…",
    "en": "Waiting for a team member…"
  },
  "withAgent": {
    "ar": "تتحدث الآن مع {name}",
    "en": "You're chatting with {name}"
  },
  "privacy": {
    "ar": "لا تشارك رقم الهوية أو كلمات المرور أو بيانات البطاقة.",
    "en": "Don't share ID numbers, passwords or card details."
  },
  "placeholder": {
    "ar": "اكتب رسالتك…",
    "en": "Type your message…"
  },
  "placeholderTel": {
    "ar": "اكتب رقم جوالك 05XXXXXXXX",
    "en": "Type your mobile 05XXXXXXXX"
  },
  "placeholderName": {
    "ar": "اكتب اسمك",
    "en": "Type your name"
  },
  "placeholderAgent": {
    "ar": "اكتب رسالتك للموظف…",
    "en": "Write to the team member…"
  },
  "send": {
    "ar": "إرسال",
    "en": "Send"
  },
  "close": {
    "ar": "إغلاق مساعد المبيعات",
    "en": "Close sales assistant"
  },
  "open": {
    "ar": "فتح مساعد المبيعات",
    "en": "Open sales assistant"
  },
  "restart": {
    "ar": "بدء محادثة جديدة",
    "en": "Start a new conversation"
  },
  "restartConfirm": {
    "ar": "بدء محادثة جديدة؟ سيبقى طلبك السابق محفوظًا لدى فريقنا.",
    "en": "Start over? Your previous request stays with our team."
  },
  "yes": {
    "ar": "نعم، ابدأ",
    "en": "Yes, start"
  },
  "cancel": {
    "ar": "إلغاء",
    "en": "Cancel"
  },
  "loading": {
    "ar": "جارٍ تجهيز المحادثة…",
    "en": "Preparing your conversation…"
  },
  "startErrorTitle": {
    "ar": "تعذّر تحميل المحادثة",
    "en": "Couldn't load the conversation"
  },
  "startErrorBody": {
    "ar": "تحقق من اتصالك ثم حاول مرة أخرى. لن تفقد أي بيانات.",
    "en": "Check your connection and try again. Nothing will be lost."
  },
  "retry": {
    "ar": "إعادة المحاولة",
    "en": "Try again"
  },
  "failed": {
    "ar": "لم تُرسل",
    "en": "Not sent"
  },
  "remove": {
    "ar": "حذف",
    "en": "Remove"
  },
  "sending": {
    "ar": "جارٍ الإرسال",
    "en": "Sending"
  },
  "offlineBanner": {
    "ar": "لا يوجد اتصال. سنعيد إرسال رسالتك تلقائيًا عند عودة الاتصال.",
    "en": "No connection. We'll resend your message automatically when you're back online."
  },
  "rateBanner": {
    "ar": "أرسلت رسائل كثيرة خلال وقت قصير. انتظر دقيقة ثم أعد المحاولة.",
    "en": "Too many messages in a short time. Wait a minute, then retry."
  },
  "sendErrorBanner": {
    "ar": "تعذّر إرسال رسالتك. اضغط «إعادة المحاولة» على الرسالة.",
    "en": "Your message wasn't sent. Tap “Try again” on the message."
  },
  "expiredBanner": {
    "ar": "انتهت صلاحية المحادثة السابقة فبدأنا محادثة جديدة. يمكنك إعادة إرسال رسالتك.",
    "en": "Your previous chat expired, so we started a new one. You can resend your message."
  },
  "forbiddenBanner": {
    "ar": "هذه المحادثة موقوفة. تواصل معنا من صفحة «تواصل ودعم».",
    "en": "This chat is locked. Please reach us via the Contact page."
  },
  "pollBanner": {
    "ar": "نحاول إعادة الاتصال بالموظف…",
    "en": "Reconnecting to the team member…"
  },
  "resumed": {
    "ar": "استعدنا محادثتك السابقة",
    "en": "We restored your previous conversation"
  },
  "step": {
    "ar": "الخطوة {n} من {total}",
    "en": "Step {n} of {total}"
  },
  "summaryTitle": {
    "ar": "ملخص طلبك",
    "en": "Your request summary"
  },
  "editField": {
    "ar": "تعديل {field}",
    "en": "Edit {field}"
  },
  "closedTitle": {
    "ar": "انتهت المحادثة",
    "en": "Conversation ended"
  },
  "closedBody": {
    "ar": "يمكنك بدء محادثة جديدة في أي وقت.",
    "en": "You can start a new conversation anytime."
  },
  "emptyTitle": {
    "ar": "لا توجد رسائل بعد",
    "en": "No messages yet"
  },
  "emptyBody": {
    "ar": "ابدأ المحادثة وسيساعدك المساعد خلال ثوانٍ.",
    "en": "Start chatting and the assistant will help within seconds."
  },
  "startChat": {
    "ar": "ابدأ المحادثة",
    "en": "Start chatting"
  },
  "agent": {
    "ar": "موظف",
    "en": "Team"
  },
  "you": {
    "ar": "أنت",
    "en": "You"
  },
  "newMessages": {
    "ar": "رسائل جديدة",
    "en": "new messages"
  },
  "chars": {
    "ar": "حرف",
    "en": "chars"
  },
  "consentTitle": {
    "ar": "قبل أن نبدأ",
    "en": "Before we start"
  },
  "consentBody": {
    "ar": "لنخدمك أسرع، نحفظ نص هذه المحادثة بعد حجب البيانات الحساسة تلقائيًا، ولا يطّلع عليه إلا فريق مبيعات معاملاتي كير للتواصل معك بخصوص طلبك. لن نحفظ شيئًا قبل موافقتك.",
    "en": "To serve you faster, we save this chat after automatically masking sensitive data. Only the Maalamati Care sales team sees it, to follow up on your request. Nothing is saved before you agree."
  },
  "consentAccept": {
    "ar": "أوافق وأبدأ المحادثة",
    "en": "I agree, start chatting"
  },
  "consentDecline": {
    "ar": "لا، شكرًا",
    "en": "No, thanks"
  },
  "consentTerms": {
    "ar": "الشروط والأحكام",
    "en": "Terms and conditions"
  },
  "declinedTitle": {
    "ar": "لم نحفظ أي شيء",
    "en": "Nothing was saved"
  },
  "declinedBody": {
    "ar": "يمكنك إكمال طلبك بنفسك من نموذج طلب الخدمة، أو التواصل معنا مباشرة.",
    "en": "You can complete your request yourself using the service request form, or contact us directly."
  },
  "requestForm": {
    "ar": "نموذج طلب الخدمة",
    "en": "Service request form"
  },
  "contactPage": {
    "ar": "تواصل ودعم",
    "en": "Contact & support"
  },
  "whatsappUs": {
    "ar": "تواصل عبر واتساب",
    "en": "Chat on WhatsApp"
  },
  "changedMind": {
    "ar": "غيّرت رأيي، ابدأ المحادثة",
    "en": "Changed my mind, start chatting"
  },
  "disabledTitle": {
    "ar": "مساعد المبيعات غير متاح حاليًا",
    "en": "The sales assistant is unavailable right now"
  },
  "disabledBody": {
    "ar": "يسعدنا تواصلك عبر صفحة «تواصل ودعم» أو واتساب، وسيرد عليك فريقنا.",
    "en": "Please reach us through the Contact page or WhatsApp and our team will get back to you."
  },
  "typing": {
    "ar": "المساعد يكتب…",
    "en": "The assistant is typing…"
  },
  "unreadLabel": {
    "ar": "{n} رسائل جديدة من الفريق",
    "en": "{n} new messages from the team"
  },
  "queueBlocked": {
    "ar": "أعد إرسال الرسائل التي لم تُرسل أو احذفها قبل كتابة رسالة جديدة.",
    "en": "Resend or remove the unsent messages before writing a new one."
  },
  "askHuman": {
    "ar": "يمكنك طلب التحدث مع موظف في أي وقت.",
    "en": "You can ask for a person at any time."
  }
} as const;

export type WidgetStringKey = keyof typeof WIDGET_STRINGS;

export function widgetText(lang: Lang, key: WidgetStringKey, vars: Record<string, string | number> = {}): string {
  return WIDGET_STRINGS[key][lang].replace(/\{(\w+)\}/g, (_match, name: string) => String(vars[name] ?? ""));
}
