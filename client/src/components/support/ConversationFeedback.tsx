import { useId, useState } from "react";
import { Check, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  isEnglish: boolean;
  savedStars?: number | null;
  onSubmit: (stars: number, comment: string) => Promise<number>;
};
export function ConversationFeedback({
  isEnglish: en,
  savedStars,
  onSubmit,
}: Props) {
  const id = useId();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<number | null>(null);
  const actualStars = savedStars ?? submitted;
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
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="support-feedback mx-auto max-w-lg rounded-2xl border border-border bg-white p-4 sm:p-5"
    >
      {actualStars ? (
        <div role="status" className="text-center">
          <span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary">
            <Check className="h-5 w-5" />
          </span>
          <h3 id={`${id}-heading`} className="text-sm font-extrabold">
            {t(
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
          <p className="text-xs leading-6 text-muted-foreground">
            {t(
              "وصل تقييمك إلى فريق الدعم لمساعدتنا على تحسين التجربة.",
              "Your rating has reached support to help us improve the experience."
            )}
          </p>
        </div>
      ) : (
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!stars || pending) return;
            setError("");
            setPending(true);
            try {
              setSubmitted(await onSubmit(stars, comment.trim()));
            } catch (e) {
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
                onChange={e => setComment(e.target.value)}
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
