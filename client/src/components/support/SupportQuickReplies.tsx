import { useId, useState } from "react";
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { supportIntents } from "@shared/orderSupport";
export function SupportQuickReplies({
  isEnglish: en,
  disabled,
  onSelect,
}: {
  isEnglish: boolean;
  disabled: boolean;
  onSelect: (text: string, intent: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return (
    <div
      className="support-faq border-t border-border bg-background/35 px-4 py-2.5 sm:px-6"
      aria-label={en ? "FAQ quick replies" : "ردود سريعة للأسئلة الشائعة"}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
          <MessageSquare className="h-3 w-3" />
          {en ? "Frequently asked questions" : "أسئلة شائعة"}
        </p>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(value => !value)}
          className="inline-flex min-h-7 items-center gap-1 text-[10px] font-bold text-primary"
        >
          {expanded
            ? en
              ? "Show less"
              : "عرض أقل"
            : en
              ? "All topics"
              : "كل الموضوعات"}
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
      </div>
      <div id={id} className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
        {supportIntents
          .slice(0, expanded ? supportIntents.length : 3)
          .map(i => (
            <button
              type="button"
              key={i.id}
              onClick={() => onSelect(en ? i.promptEn : i.promptAr, i.id)}
              disabled={disabled}
              className="min-h-10 rounded-full border border-input bg-white px-3 py-2 text-[11px] font-semibold text-foreground hover:border-primary hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45"
            >
              {en ? i.en : i.ar}
            </button>
          ))}
      </div>
    </div>
  );
}
