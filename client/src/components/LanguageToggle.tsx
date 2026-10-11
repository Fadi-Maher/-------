import { Globe2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { isEnglish, toggleLanguage } = useLanguage();
  const label = isEnglish ? "العربية" : "English";

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={compact
        ? "grid h-10 w-10 place-items-center rounded-xl border border-[#cde3fa] bg-white text-[#0878f9] transition-colors hover:border-[#0878f9] hover:bg-[#eef7ff]"
        : "inline-flex h-10 items-center gap-2 rounded-xl border border-[#cde3fa] bg-white px-3 text-xs font-extrabold text-[#0878f9] transition-colors hover:border-[#0878f9] hover:bg-[#eef7ff]"}
      aria-label={isEnglish ? "Switch to Arabic" : "Switch to English"}
      title={label}
    >
      {compact ? <Globe2 className="h-4 w-4" /> : <><Globe2 className="h-4 w-4" /><span>{label}</span></>}
    </button>
  );
}
