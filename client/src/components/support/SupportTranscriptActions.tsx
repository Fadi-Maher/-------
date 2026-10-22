import { useMemo, useState } from "react";
import { Check, Copy, Download, Mail } from "lucide-react";
import { z } from "zod";
import {
  buildSupportTranscript,
  type SupportTranscriptMessage,
} from "@shared/supportTranscript";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  isEnglish: boolean;
  messages: SupportTranscriptMessage[];
  stars?: number;
  attachmentsCount?: number;
};

const recipientSchema = z
  .string()
  .max(254, "Email addresses must be 254 characters or fewer.")
  .refine(value => !/[\r\n]/.test(value), "Enter a valid email address.")
  .transform(value => value.trim())
  .refine(
    value => value === "" || z.string().email().safeParse(value).success,
    "Enter a valid email address."
  );

function mailtoHref(recipient: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function SupportTranscriptActions({
  isEnglish: en,
  messages,
  stars,
  attachmentsCount,
}: Props) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [copyError, setCopyError] = useState("");
  const [copySuccess, setCopySuccess] = useState("");
  const [copying, setCopying] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const t = (ar: string, english: string) => (en ? english : ar);
  const transcript = useMemo(
    () =>
      buildSupportTranscript(
        en ? "en" : "ar",
        messages,
        stars,
        attachmentsCount
      ),
    [attachmentsCount, en, messages, stars]
  );
  const recipient = recipientSchema.safeParse(email);
  const emailValue = recipient.success ? recipient.data : "";
  const subject = t(
    `سجل محادثة الدعم${stars ? ` — التقييم ${stars}/5` : ""}`,
    `Support conversation transcript${stars ? ` — rating ${stars}/5` : ""}`
  );
  const fullMailto = mailtoHref(emailValue, subject, transcript);
  const needsCompactEmail = fullMailto.length > 6_000;
  const compactBody = t(
    `مرحبًا،\n\nأود مشاركة سجل محادثة الدعم الخاصة بي. التقييم: ${stars ?? "—"}/5.\n\nالسجل الكامل أطول من أن يُدرج هنا؛ انسخه والصقه في هذه المسودة قبل الإرسال.`,
    `Hello,\n\nI would like to share my support conversation transcript. Rating: ${stars ?? "—"}/5.\n\nThe full transcript is too long to include here. Copy and paste it into this draft before sending.`
  );
  const draftHref = needsCompactEmail
    ? mailtoHref(emailValue, subject, compactBody)
    : fullMailto;

  const validateEmail = () => {
    if (recipient.success) {
      setEmailError("");
      return true;
    }

    setEmailError(
      t(
        "أدخل بريدًا إلكترونيًا صالحًا أو اتركه فارغًا.",
        "Enter a valid email address or leave it blank."
      )
    );
    return false;
  };

  const downloadTranscript = () => {
    setDownloadError("");
    try {
      const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "support-transcript.txt";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch {
      setDownloadError(
        t(
          "تعذر تنزيل السجل. حاول مجددًا.",
          "The transcript could not be downloaded. Try again."
        )
      );
    }
  };

  const copyTranscript = async () => {
    setCopyError("");
    setCopySuccess("");
    setCopying(true);
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(transcript);
      setCopySuccess(
        t(
          "تم نسخ السجل الكامل. الصقه في مسودة البريد قبل الإرسال.",
          "The full transcript was copied. Paste it into the email draft before sending."
        )
      );
    } catch {
      setCopyError(
        t(
          "تعذر النسخ. نزّل ملف .txt وأرفقه يدويًا؛ لا يمكننا إرفاقه تلقائيًا.",
          "Copying failed. Download the .txt file and attach it manually; it cannot be attached automatically."
        )
      );
    } finally {
      setCopying(false);
    }
  };

  return (
    <section
      aria-labelledby="support-transcript-heading"
      className="mt-5 border-t border-border pt-4"
    >
      <h4 id="support-transcript-heading" className="text-sm font-extrabold">
        {t("تصدير أو مشاركة السجل", "Export or share the transcript")}
      </h4>
      <p className="mt-1 text-xs leading-6 text-muted-foreground">
        {t(
          "يمكنك تنزيل نسخة نصية أو فتح مسودة بريد من جهازك.",
          "You can download a text copy or open an email draft from your device."
        )}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-10 gap-2 rounded-xl"
          onClick={downloadTranscript}
        >
          <Download aria-hidden="true" />
          {t("تنزيل السجل (.txt)", "Download transcript (.txt)")}
        </Button>
      </div>
      {downloadError ? (
        <p role="alert" className="mt-2 text-xs leading-6 text-destructive">
          {downloadError}
        </p>
      ) : null}

      <div className="mt-4 rounded-xl border border-border bg-secondary/35 p-3">
        <label
          htmlFor="support-transcript-email"
          className="block text-xs font-semibold"
        >
          {t("بريد المستلم (اختياري)", "Recipient email (optional)")}
        </label>
        <Input
          id="support-transcript-email"
          dir="ltr"
          type="email"
          value={email}
          onChange={event => {
            setEmail(event.target.value);
            if (emailError) setEmailError("");
          }}
          onBlur={validateEmail}
          aria-invalid={Boolean(emailError)}
          aria-describedby="support-transcript-email-note"
          className="mt-2 bg-background"
          autoComplete="email"
        />
        <p
          id="support-transcript-email-note"
          className="mt-2 text-[11px] leading-5 text-muted-foreground"
        >
          {t(
            "يفتح تطبيق البريد؛ راجع النسخة وأرسلها بنفسك. عنوانك لا يُحفظ.",
            "This opens your email app; review the copy and send it yourself. Your address is not saved."
          )}
        </p>
        {emailError ? (
          <p role="alert" className="mt-2 text-xs leading-5 text-destructive">
            {emailError}
          </p>
        ) : null}

        {needsCompactEmail ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs leading-6 text-muted-foreground">
              {t(
                "السجل أطول من أن يُدرج بأمان في مسودة البريد. انسخه كاملًا ثم الصقه في المسودة.",
                "The transcript is too long to safely include in the email draft. Copy it in full and paste it into the draft."
              )}
            </p>
            <Button
              type="button"
              variant="secondary"
              className="min-h-10 gap-2 rounded-xl"
              onClick={copyTranscript}
              disabled={copying}
            >
              {copySuccess ? (
                <Check aria-hidden="true" />
              ) : (
                <Copy aria-hidden="true" />
              )}
              {copying
                ? t("جارٍ النسخ…", "Copying…")
                : t("نسخ السجل كاملًا", "Copy full transcript")}
            </Button>
          </div>
        ) : null}

        <div className="mt-3">
          {recipient.success ? (
            <Button asChild type="button" className="min-h-10 gap-2 rounded-xl">
              <a href={draftHref} onClick={() => setEmailError("")}>
                <Mail aria-hidden="true" />
                {t("فتح مسودة بريد", "Open email draft")}
              </a>
            </Button>
          ) : (
            <Button
              type="button"
              className="min-h-10 gap-2 rounded-xl"
              onClick={validateEmail}
            >
              <Mail aria-hidden="true" />
              {t("فتح مسودة بريد", "Open email draft")}
            </Button>
          )}
        </div>
      </div>

      {copySuccess ? (
        <p role="status" className="mt-2 text-xs leading-6 text-primary">
          {copySuccess}
        </p>
      ) : null}
      {copyError ? (
        <p role="alert" className="mt-2 text-xs leading-6 text-destructive">
          {copyError}
        </p>
      ) : null}
    </section>
  );
}
