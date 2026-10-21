import { Bot } from "lucide-react";
export function SupportTypingIndicator({ isEnglish }: { isEnglish: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={isEnglish ? "The assistant is typing" : "المساعد يكتب الآن"}
      className="support-typing flex items-center gap-3"
    >
      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-secondary text-primary"
      >
        <Bot className="h-4 w-4" />
      </span>
      <div className="rounded-2xl rounded-ss-sm border border-border bg-background px-4 py-3">
        <span aria-hidden="true" className="flex h-3 items-center gap-1.5">
          {[0, 1, 2].map(n => (
            <span
              key={n}
              className="support-typing-dot h-1.5 w-1.5 rounded-full bg-primary"
              style={{ animationDelay: `${n * 160}ms` }}
            />
          ))}
        </span>
        <span
          aria-hidden="true"
          className="mt-2 block text-[10px] text-muted-foreground"
        >
          {isEnglish ? "Preparing your next step…" : "أجهّز لك الخطوة التالية…"}
        </span>
      </div>
    </div>
  );
}
