import { redactSupportText } from "./orderSupport";

export type SupportTranscriptMessage = {
  sender: "user" | "bot" | "human" | "system";
  content: string;
  createdAt: number;
};

export type SupportTranscriptLanguage = "ar" | "en";

const REDACTED = "[بيانات محجوبة]";
const HEX_KEY = /\b[a-f0-9]{64}\b/gi;
const URL = /https?:\/\/[^\s<>"']+/gi;
const IMAGE_URL = /\.(?:avif|gif|heic|jpe?g|png|svg|webp)(?:[?#]|$)/i;
const PRIVATE_URL_QUERY =
  /[?&](?:x-amz-[^=&]+|signature|sig|token|access[_-]?token|key|secret|expires)=[^&\s]*/i;

function redactPrivateImageUrls(text: string) {
  return text.replace(URL, value => {
    const match = value.match(/^(.*?)([),.!?]+)?$/);
    const url = match?.[1] ?? value;
    const punctuation = match?.[2] ?? "";

    return IMAGE_URL.test(url) || PRIVATE_URL_QUERY.test(url)
      ? `${REDACTED}${punctuation}`
      : value;
  });
}

function redactTranscriptContent(content: string) {
  const protectedContent = redactPrivateImageUrls(
    content.replace(HEX_KEY, REDACTED)
  );
  // Preserve every line and character of long conversations; the API's turn limit
  // remains 1,200, while export redaction itself must not truncate or reflow text.
  return redactSupportText(protectedContent, Number.MAX_SAFE_INTEGER)
    .replace(HEX_KEY, REDACTED)
    .replace(/\/manus-storage\/[^\s<>"']+/gi, REDACTED);
}

function senderName(
  language: SupportTranscriptLanguage,
  sender: SupportTranscriptMessage["sender"]
) {
  const names =
    language === "en"
      ? {
          user: "You",
          bot: "Assistant",
          human: "Support team",
          system: "System",
        }
      : {
          user: "العميل",
          bot: "المساعد",
          human: "فريق الدعم",
          system: "النظام",
        };

  return names[sender];
}

function formatTime(language: SupportTranscriptLanguage, createdAt: number) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return language === "en" ? "Time unavailable" : "الوقت غير متاح";
  }

  return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** Builds a plain-text, UTF-8-safe support transcript without IDs or metadata. */
export function buildSupportTranscript(
  language: SupportTranscriptLanguage,
  messages: SupportTranscriptMessage[],
  stars?: number,
  attachmentsCount?: number
) {
  const en = language === "en";
  const lines = [
    en ? "Support conversation transcript" : "سجل محادثة الدعم",
    en ? "Exported from your device" : "تم التصدير من جهازك",
  ];

  if (typeof stars === "number") {
    lines.push(en ? `Rating: ${stars}/5` : `التقييم: ${stars}/5`);
  }

  if (attachmentsCount && attachmentsCount > 0) {
    lines.push(
      en
        ? `Attachments are not included in this export (${attachmentsCount}).`
        : `المرفقات غير مضمنة في هذا التصدير (عددها: ${attachmentsCount}).`
    );
  }

  lines.push("");

  for (const message of messages) {
    lines.push(
      `[${formatTime(language, message.createdAt)}] ${senderName(language, message.sender)}:`
    );
    lines.push(redactTranscriptContent(message.content) || REDACTED);
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
