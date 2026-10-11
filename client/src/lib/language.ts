export type AppLanguage = "ar" | "en";

export const LANGUAGE_STORAGE_KEY = "maalamati-language";

export function resolveLanguage(value: string | null): AppLanguage {
  return value === "en" ? "en" : "ar";
}

export function toggleLanguage(language: AppLanguage): AppLanguage {
  return language === "ar" ? "en" : "ar";
}

export function getLanguageDirection(language: AppLanguage) {
  return language === "ar" ? "rtl" : "ltr";
}
