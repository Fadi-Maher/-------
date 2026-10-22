import { useId, useState } from "react";
import { Check, Loader2, Star } from "lucide-react";
import type { SupportTranscriptMessage } from "@shared/supportTranscript";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SupportTranscriptActions } from "./SupportTranscriptActions";

type Props = {
  isEnglish: boolean;
  savedStars?: number | null;
  onSubmit: (stars: number, comment: string) => Promise<number>;
  onFollowup?: (note: string) => Promise<void>;
  followupProvided?: boolean;
  transcriptMessages?: SupportTranscriptMessage[];
  attachmentsCount?: number;
};

export function ConversationFeedback({
  isEnglish: en,
  savedStars,
  onSubmit,
  onFollowup,
  followupProvided = false,
  transcriptMessages,
  attachmentsCount,
}: Props) {
  const id = useId();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<number | null>(null);
  const [followup, setFollowup] = useState("");
  const [followupConsent, setFollowupConsent] = useState(false);
  const [followupPending, setFollowupPending] = useState(false);
  const [followupError, setFollowupError] = useState("");
  const [followupSubmitted, setFollowupSubmitted] = useState(false);
  const actualStars = savedStars ?? submitted;
  const lowRating = actualStars !== null && actualStars <= 2;
  const followupDone = followupProvided || followupSubmitted;
  const t = (ar: string, english: string) => (en ? english : ar);
  const labels = en
    ? [
        "Needs improvement",
        "Below expectations",
        "Good",
        "Very good",
        "Excellent",
      ]
    : ["تحتاج تحسينًا", "أقل من المتوقع", "جيدة", "جيدة جدًا", "ممتازة"];
  const ratingSuccess = t(
    "وصل تقييمك إلى فريق الدعم لمساعدتنا على تحسين التجربة.",
    "Your rating has reached support to help us improve the experience."
  );
  const followupSuccess = t(
    "وصلت التفاصيل الإضافية، شكرًا لمساعدتنا على التحسين.",
    "Your additional details have been received. Thank you for helping us improve."
  );

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="support-feedback mx-auto max-w-lg rounded-2xl border border-border bg-white p-4 sm:p-5"
    >
      {actualStars ? (
        <>
          <div className="text-center">
            <span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary">
              <Check className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 id={`${id}-heading`} className="text-sm font-extrabold">
              {lowRating
                ? t(
                    "شكرًا لصراحتك، ونعتذر أن التجربة لم تكن بالمستوى المطلوب.",
                    "Thank you for being candid. We are sorry the experience did not meet expectations."
                  )
                : t(
                    "شكرًا! ملاحظتك تصنع فرقًا.",
                    "Thank you! Your feedback makes a difference."
                  )}
            </h3>
            <div
              className="my-3 flex justify-center gap-1"
              aria-label={t(
                `تقييمك ${actualStars} من 5`,
                `Your rating: ${actualStars} out of 5`
              )}
            >
              {[1, 2, 3, 4, 5].map(n => (
                <Star
                  key={n}
                  aria-hidden="true"
                  className={`h-5 w-5 ${n <= actualStars ? "fill-primary text-primary" : "text-muted-foreground"}`}
                />
              ))}
            </div>
          </div>

          <p
            role="status"
            className="text-center text-xs leading-6 text-muted-foreground"
          >
            {lowRating && followupDone ? followupSuccess : ratingSuccess}
          </p>

          {lowRating ? (
            <div className="mt-4 rounded-xl border border-primary/15 bg-secondary/35 p-3">
              <p className="text-sm font-bold">
                {t(
                  "ما الذي لم يساعدك؟ وما الخطوة التي توقفت عندها؟",
                  "What did not help, and where did you get stuck?"
                )}
              </p>
              {onFollowup && !followupDone ? (
                <form
                  className="mt-3"
                  onSubmit={async event => {
                    event.preventDefault();
                    const note = followup.trim();
                    if (!note || !followupConsent || followupPending) return;

                    setFollowupError("");
                    setFollowupPending(true);
                    try {
                      await onFollowup(note);
                      setFollowupSubmitted(true);
                    } catch {
                      setFollowupError(
                        t(
                          "تعذر إرسال التفاصيل الإضافية. احتفظنا بمسودتك؛ حاول مجددًا.",
                          "Your additional details could not be sent. Your draft is retained; try again."
                        )
                      );
                    } finally {
                      setFollowupPending(false);
                    }
                  }}
                >
                  <label
                    htmlFor={`${id}-followup`}
                    className="mb-2 block text-xs font-semibold"
                  >
                    {t(
                      "تفاصيل إضافية (اختياري)",
                      "Additional details (optional)"
                    )}
                  </label>
                  <Textarea
                    id={`${id}-followup`}
                    value={followup}
                    onChange={event => setFollowup(event.target.value)}
                    maxLength={500}
                    rows={3}
                    disabled={followupPending}
                    placeholder={t(
                      "اكتب ما تتذكره دون بيانات شخصية أو رموز سرية…",
                      "Share what you remember without personal data or secret codes…"
                    )}
                    className="min-h-20 resize-none bg-background/60 text-sm"
                  />
                  <p className="mt-1 text-end text-[10px] text-muted-foreground">
                    {followup.length}/500
                  </p>
                  <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={followupConsent}
                      onChange={event =>
                        setFollowupConsent(event.target.checked)
                      }
                      disabled={followupPending}
                      className="mt-0.5 h-4 w-4 accent-primary"
                    />
                    <span>
                      {t(
                        "أوافق على إرسال هذه التفاصيل الإضافية لتحسين الدعم.",
                        "I agree to send these additional details to improve support."
                      )}
                    </span>
                  </label>
                  {followupError ? (
                    <p
                      role="alert"
                      className="mt-3 text-xs leading-6 text-destructive"
                    >
                      {followupError}
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    disabled={
                      !followup.trim() || !followupConsent || followupPending
                    }
                    className="mt-3 h-10 w-full gap-2 rounded-xl"
                  >
                    {followupPending ? (
                      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                    ) : null}
                    {followupPending
                      ? t("جارٍ إرسال التفاصيل…", "Sending details…")
                      : followupError
                        ? t("إعادة إرسال التفاصيل", "Retry sending details")
                        : t(
                            "إرسال التفاصيل الإضافية",
                            "Send additional details"
                          )}
                  </Button>
                </form>
              ) : null}
            </div>
          ) : null}

          {transcriptMessages?.length ? (
            <SupportTranscriptActions
              isEnglish={en}
              messages={transcriptMessages}
              stars={actualStars}
              attachmentsCount={attachmentsCount}
            />
          ) : null}
        </>
      ) : (
        <form
          onSubmit={async event => {
            event.preventDefault();
            if (!stars || pending) return;
            setError("");
            setPending(true);
            try {
              setSubmitted(await onSubmit(stars, comment.trim()));
            } catch {
              setError(
                t(
                  "تعذر حفظ تقييمك. احتفظنا بالنجوم والملاحظة؛ حاول مجددًا.",
                  "Your rating could not be saved. Your stars and note are retained; try again."
                )
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <h3
            id={`${id}-heading`}
            className="text-center text-sm font-extrabold"
          >
            {t("كيف كانت تجربة الدعم؟", "How was your support experience?")}
          </h3>
          <p className="mt-1 text-center text-xs leading-6 text-muted-foreground">
            {t(
              "انتهت المحادثة. تقييمك اختياري ويساعدنا على التحسين.",
              "This conversation has ended. Your optional rating helps us improve."
            )}
          </p>
          <fieldset disabled={pending} className="mt-3">
            <legend className="sr-only">
              {t(
                "اختر تقييمًا من 1 إلى 5 نجوم",
                "Choose a rating from 1 to 5 stars"
              )}
            </legend>
            <div className="flex justify-center gap-1 sm:gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <label
                  key={n}
                  className="support-rating-star relative grid h-11 w-11 cursor-pointer place-items-center rounded-xl hover:bg-secondary"
                >
                  <input
                    type="radio"
                    name={`${id}-stars`}
                    value={n}
                    checked={stars === n}
                    onChange={() => setStars(n)}
                    className="peer sr-only"
                    aria-label={t(`${n} من 5 نجوم`, `${n} out of 5 stars`)}
                  />
                  <Star
                    aria-hidden="true"
                    className={`h-7 w-7 rounded-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-primary ${n <= stars ? "fill-primary text-primary" : "text-muted-foreground"}`}
                  />
                </label>
              ))}
            </div>
            <p
              aria-live="polite"
              className="mt-1 min-h-6 text-center text-xs font-bold text-primary"
            >
              {stars
                ? `${stars}/5 · ${labels[stars - 1]}`
                : t("اختر عدد النجوم", "Select your stars")}
            </p>
          </fieldset>
          {stars > 0 ? (
            <div className="mt-3">
              <label
                htmlFor={`${id}-note`}
                className="mb-2 block text-xs font-semibold"
              >
                {stars <= 2
                  ? t(
                      "ما الذي يمكننا تحسينه؟ (اختياري)",
                      "What can we improve? (optional)"
                    )
                  : t("هل لديك ملاحظة؟ (اختياري)", "Any feedback? (optional)")}
              </label>
              <Textarea
                id={`${id}-note`}
                value={comment}
                onChange={event => setComment(event.target.value)}
                maxLength={500}
                rows={2}
                disabled={pending}
                placeholder={t(
                  "اكتب ملاحظتك دون أي بيانات شخصية…",
                  "Leave feedback without personal information…"
                )}
                className="min-h-16 resize-none bg-background/60 text-sm"
              />
              <p className="mt-1 text-end text-[10px] text-muted-foreground">
                {comment.length}/500
              </p>
            </div>
          ) : null}
          <p className="mt-3 text-[10px] leading-5 text-muted-foreground">
            {t(
              "بالإرسال توافق على حفظ تقييمك وملاحظتك المنقّحة فقط لتحسين الدعم. لا نفعّل حفظ سجل المحادثة تلقائيًا. لا تكتب بيانات شخصية أو رموزًا سرية.",
              "Submitting consents to saving your rating and redacted note to improve support. It does not enable chat-history saving. Do not include personal information or secret codes."
            )}
          </p>
          {error ? (
            <p role="alert" className="mt-3 text-xs leading-6 text-destructive">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={!stars || pending}
            className="mt-3 h-11 w-full gap-2 rounded-xl"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Star className="h-4 w-4" />
            )}
            {pending
              ? t("جارٍ حفظ تقييمك…", "Saving your rating…")
              : error
                ? t("إعادة إرسال تقييمي", "Retry my rating")
                : t("إرسال تقييمي", "Send my rating")}
          </Button>
        </form>
      )}
    </section>
  );
}
