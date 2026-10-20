import { ANNOUNCEMENT_LINK_LABEL_MAX, ANNOUNCEMENT_MESSAGE_MAX, normalizeAnnouncementLink, type AnnouncementTone } from "@shared/announcements";
import { fromDateTimeLocalValue, toDateTimeLocalValue } from "./datetimeLocal";

export type AnnouncementFormState = {
  messageAr: string;
  messageEn: string;
  linkUrl: string;
  linkLabelAr: string;
  linkLabelEn: string;
  tone: AnnouncementTone;
  isActive: boolean;
  dismissible: boolean;
  startsAt: string;
  endsAt: string;
};

export type AnnouncementFormField = keyof AnnouncementFormState;
export type AnnouncementFormErrors = Partial<Record<AnnouncementFormField, string>>;

export type AnnouncementRecord = {
  messageAr: string;
  messageEn: string;
  linkUrl: string | null;
  linkLabelAr: string | null;
  linkLabelEn: string | null;
  tone: AnnouncementTone;
  isActive: boolean;
  dismissible: boolean;
  startsAt: number;
  endsAt: number | null;
};

export function emptyAnnouncementForm(now = Date.now()): AnnouncementFormState {
  return {
    messageAr: "",
    messageEn: "",
    linkUrl: "",
    linkLabelAr: "",
    linkLabelEn: "",
    tone: "info",
    isActive: true,
    dismissible: true,
    startsAt: toDateTimeLocalValue(now),
    endsAt: "",
  };
}

export function announcementToForm(record: AnnouncementRecord): AnnouncementFormState {
  return {
    messageAr: record.messageAr,
    messageEn: record.messageEn,
    linkUrl: record.linkUrl ?? "",
    linkLabelAr: record.linkLabelAr ?? "",
    linkLabelEn: record.linkLabelEn ?? "",
    tone: record.tone,
    isActive: record.isActive,
    dismissible: record.dismissible,
    startsAt: toDateTimeLocalValue(record.startsAt),
    endsAt: toDateTimeLocalValue(record.endsAt),
  };
}

export function validateAnnouncementForm(form: AnnouncementFormState) {
  const errors: AnnouncementFormErrors = {};
  const checkMessage = (field: "messageAr" | "messageEn", required: string, tooLong: string) => {
    const length = form[field].trim().length;
    if (length < 3) errors[field] = required;
    else if (length > ANNOUNCEMENT_MESSAGE_MAX) errors[field] = tooLong;
  };
  checkMessage("messageAr", "اكتب نص الإعلان بالعربية (3 أحرف على الأقل).", `الحد الأقصى ${ANNOUNCEMENT_MESSAGE_MAX} حرفًا.`);
  checkMessage("messageEn", "Write the English announcement (at least 3 characters).", `Keep it within ${ANNOUNCEMENT_MESSAGE_MAX} characters.`);
  const link = normalizeAnnouncementLink(form.linkUrl);
  if (link === "invalid") errors.linkUrl = "استخدم رابطًا يبدأ بـ / لصفحة داخل الموقع أو https:// لموقع خارجي.";
  if (form.linkLabelAr.trim().length > ANNOUNCEMENT_LINK_LABEL_MAX) errors.linkLabelAr = `الحد الأقصى ${ANNOUNCEMENT_LINK_LABEL_MAX} حرفًا.`;
  if (form.linkLabelEn.trim().length > ANNOUNCEMENT_LINK_LABEL_MAX) errors.linkLabelEn = `Keep it within ${ANNOUNCEMENT_LINK_LABEL_MAX} characters.`;
  const startsAt = fromDateTimeLocalValue(form.startsAt);
  if (startsAt === null) errors.startsAt = "حدد وقت بداية صحيحًا.";
  const endsAt = form.endsAt.trim() ? fromDateTimeLocalValue(form.endsAt) : null;
  if (form.endsAt.trim() && endsAt === null) errors.endsAt = "حدد وقت انتهاء صحيحًا أو اتركه فارغًا.";
  else if (startsAt !== null && endsAt !== null && endsAt <= startsAt) errors.endsAt = "وقت الانتهاء يجب أن يكون بعد وقت البداية.";
  return errors;
}

/** Converts a valid form into the tRPC payload (UTC milliseconds). Call only after validation passes. */
export function announcementFormToInput(form: AnnouncementFormState) {
  const link = normalizeAnnouncementLink(form.linkUrl);
  const linkUrl = link && link !== "invalid" ? link : null;
  return {
    messageAr: form.messageAr.trim(),
    messageEn: form.messageEn.trim(),
    linkUrl,
    linkLabelAr: linkUrl ? form.linkLabelAr.trim() || null : null,
    linkLabelEn: linkUrl ? form.linkLabelEn.trim() || null : null,
    tone: form.tone,
    isActive: form.isActive,
    dismissible: form.dismissible,
    startsAt: fromDateTimeLocalValue(form.startsAt) ?? Date.now(),
    endsAt: form.endsAt.trim() ? fromDateTimeLocalValue(form.endsAt) : null,
  };
}
