export type CustomerSession = {
  name: string;
  phone: string;
  accessToken: string;
};

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

export const CUSTOMER_SESSION_EVENT = "maalamati:customer-session-changed";

const keys = {
  name: "maalamati_customer_name",
  phone: "maalamati_customer_phone",
  accessToken: "maalamati_customer_access_token",
} as const;

export function readCustomerSession(storage: StorageReader): CustomerSession | null {
  const name = storage.getItem(keys.name)?.trim() || "";
  const phone = storage.getItem(keys.phone)?.trim() || "";
  const accessToken = storage.getItem(keys.accessToken)?.trim() || "";
  return name && phone && accessToken ? { name, phone, accessToken } : null;
}

export function saveCustomerSession(session: CustomerSession, storage?: StorageWriter) {
  const target = storage ?? window.localStorage;
  target.setItem(keys.name, session.name);
  target.setItem(keys.phone, session.phone);
  target.setItem(keys.accessToken, session.accessToken);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CUSTOMER_SESSION_EVENT));
}

export function clearCustomerSession(storage?: Pick<Storage, "removeItem">) {
  const target = storage ?? window.localStorage;
  target.removeItem(keys.name);
  target.removeItem(keys.phone);
  target.removeItem(keys.accessToken);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CUSTOMER_SESSION_EVENT));
}

export function requiredFieldMessage(isEnglish: boolean, type?: string) {
  if (type === "email") return isEnglish ? "Enter a valid email address." : "يرجى إدخال بريد إلكتروني صحيح.";
  if (type === "tel") return isEnglish ? "Enter a valid mobile number." : "يرجى إدخال رقم جوال صحيح.";
  return isEnglish ? "Please complete this field." : "يرجى تعبئة هذا الحقل.";
}
