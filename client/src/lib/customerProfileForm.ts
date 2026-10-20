export type CustomerProfileFormValues = { fullName: string; email: string };
export type CustomerProfileFormErrors = Partial<Record<keyof CustomerProfileFormValues, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LETTER = new RegExp("\\p{L}", "gu");

/** Mirrors the server rules so mistakes are explained before a request is sent. */
export function normalizeCustomerProfileForm(values: CustomerProfileFormValues): CustomerProfileFormValues {
  return {
    fullName: values.fullName.replace(/\s+/g, " ").trim(),
    email: values.email.trim().toLowerCase(),
  };
}

export function validateCustomerProfileForm(
  values: CustomerProfileFormValues,
  isEnglish: boolean,
): CustomerProfileFormErrors {
  const normalized = normalizeCustomerProfileForm(values);
  const errors: CustomerProfileFormErrors = {};
  const letters = normalized.fullName.match(LETTER)?.length ?? 0;
  if (!normalized.fullName) {
    errors.fullName = isEnglish ? "Enter your full name." : "اكتب اسمك الكامل.";
  } else if (letters < 2 || normalized.fullName.length < 2) {
    errors.fullName = isEnglish ? "The name must contain at least 2 letters." : "يجب أن يحتوي الاسم على حرفين على الأقل.";
  } else if (normalized.fullName.length > 160) {
    errors.fullName = isEnglish ? "The name must be 160 characters or fewer." : "يجب ألا يزيد الاسم على 160 حرفًا.";
  }
  if (normalized.email.length > 320 || (normalized.email && !EMAIL.test(normalized.email))) {
    errors.email = isEnglish ? "Enter a valid email, for example name@example.com." : "اكتب بريدًا صحيحًا، مثل name@example.com.";
  }
  return errors;
}

export function isCustomerProfileDirty(current: CustomerProfileFormValues, saved: CustomerProfileFormValues) {
  const a = normalizeCustomerProfileForm(current);
  const b = normalizeCustomerProfileForm(saved);
  return a.fullName !== b.fullName || a.email !== b.email;
}
