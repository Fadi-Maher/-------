export function normalizeLoginDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}
export function phoneFormatError(
  value: string,
  isEnglish: boolean
): string | null {
  const compact = normalizeLoginDigits(value).replace(/[\s-]/g, "");
  if (!compact)
    return isEnglish
      ? "Enter your mobile number to continue."
      : "أدخل رقم الجوال للمتابعة.";
  if (!/^\+?\d+$/.test(compact))
    return isEnglish
      ? "Use numbers only. Spaces, hyphens, and +966 are supported."
      : "استخدم أرقامًا فقط؛ يُسمح بالمسافات والشرطات ومفتاح +966.";
  if (
    /^05\d{8}$/.test(compact) ||
    /^5\d{8}$/.test(compact) ||
    /^\+9665\d{8}$/.test(compact) ||
    /^009665\d{8}$/.test(compact)
  )
    return null;
  if (!/^(05|5|\+9665|009665)/.test(compact))
    return isEnglish
      ? "Use a Saudi mobile starting with 05 or +9665; other country codes and landlines are not supported."
      : "أدخل جوالًا سعوديًا يبدأ بـ 05 أو +9665؛ لا يُقبل الهاتف الثابت أو مفتاح دولة أخرى.";
  return isEnglish
    ? "The number must have 10 digits starting with 05, or +966 followed by 9 digits starting with 5."
    : "يجب أن يتكون الجوال من 10 أرقام تبدأ بـ 05، أو +966 ثم 9 أرقام تبدأ بـ 5.";
}
