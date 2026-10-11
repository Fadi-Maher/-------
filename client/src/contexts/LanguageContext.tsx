import { createContext, useContext, useEffect, useState } from "react";
import { getLanguageDirection, LANGUAGE_STORAGE_KEY, resolveLanguage, toggleLanguage as toggleAppLanguage, type AppLanguage } from "@/lib/language";

export type { AppLanguage } from "@/lib/language";

type LanguageContextValue = {
  language: AppLanguage;
  isEnglish: boolean;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(() => {
    const languageFromUrl = new URLSearchParams(window.location.search).get("lang");
    return resolveLanguage(languageFromUrl || localStorage.getItem(LANGUAGE_STORAGE_KEY));
  });

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = getLanguageDirection(language);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  return <LanguageContext.Provider value={{ language, isEnglish: language === "en", setLanguage, toggleLanguage: () => setLanguage(toggleAppLanguage) }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
