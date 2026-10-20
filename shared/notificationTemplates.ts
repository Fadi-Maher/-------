/**
 * Editable templates for the automatic notifications sent to customers and to the team.
 * Arabic defaults intentionally match the original hard-coded texts so existing behaviour
 * (and anything relying on those strings) is unchanged until the owner edits a template.
 */

export type NotificationAudience = "customer" | "team";

export type NotificationTemplateKey =
  | "customer.first_quote_received"
  | "customer.quote_received"
  | "customer.quote_selected"
  | "customer.quote_withdrawn"
  | "customer.request_received"
  | "customer.provider_acceptance_expired"
  | "customer.request_status_update"
  | "customer.request_message"
  | "customer.provider_attachment"
  | "team.new_customer_request"
  | "team.request_assigned"
  | "team.quote_selected"
  | "team.quote_declined"
  | "team.assignment_expired"
  | "team.customer_comment"
  | "team.customer_attachment"
  | "team.customer_review";

export type NotificationTemplateText = {
  titleAr: string;
  messageAr: string;
  titleEn: string;
  messageEn: string;
};

export type NotificationVariable = {
  name: string;
  labelAr: string;
  labelEn: string;
  sample: { ar: string; en: string };
};

export type NotificationTemplateDefinition = {
  key: NotificationTemplateKey;
  audience: NotificationAudience;
  /** Value stored in the notification row `type` column (kept for client behaviour such as sounds). */
  type: string;
  labelAr: string;
  labelEn: string;
  whenAr: string;
  whenEn: string;
  variables: NotificationVariable[];
  defaults: NotificationTemplateText;
};

export const NOTIFICATION_TITLE_MAX = 120;
export const NOTIFICATION_MESSAGE_MAX = 400;
const STORED_TITLE_MAX = 180;
const STORED_MESSAGE_MAX = 500;
const VARIABLE_VALUE_MAX = 500;

const v = (name: string, labelAr: string, labelEn: string, sampleAr: string, sampleEn = sampleAr): NotificationVariable => ({
  name,
  labelAr,
  labelEn,
  sample: { ar: sampleAr, en: sampleEn },
});

const priceVar = v("price", "قيمة العرض", "Quote amount", "350");
const daysVar = v("days", "مدة الإنجاز بالأيام", "Turnaround days", "3");
const providerVar = v("provider", "اسم مقدم الخدمة", "Provider name", "أحمد المعقب", "Ahmed");
const messageVar = v("message", "نص الرسالة أو التحديث", "Message or update text", "تم رفع المستندات المطلوبة.", "The required documents were uploaded.");
const fileVar = v("file", "اسم الملف", "File name", "الهوية.pdf", "id-card.pdf");
const customerVar = v("customer", "اسم العميل", "Customer name", "محمد علي", "Mohammed Ali");
const serviceVar = v("service", "اسم الخدمة", "Service name", "تعقيب المعاملات", "Transaction follow-up");

export const NOTIFICATION_TEMPLATES: readonly NotificationTemplateDefinition[] = [
  {
    key: "customer.first_quote_received",
    audience: "customer",
    type: "first_quote_received",
    labelAr: "وصول أول عرض سعر",
    labelEn: "First price quote",
    whenAr: "يُرسل للعميل عند وصول أول عرض على طلبه.",
    whenEn: "Sent to the customer when the first quote arrives on a request.",
    variables: [priceVar, daysVar],
    defaults: {
      titleAr: "وصل أول عرض سعر",
      messageAr: "وصل أول عرض على طلبك بقيمة {price} ر.س ومدة {days} يوم. افتح طلباتي للمقارنة.",
      titleEn: "Your first price quote arrived",
      messageEn: "Your request received its first quote: {price} SAR in {days} days. Open My requests to compare.",
    },
  },
  {
    key: "customer.quote_received",
    audience: "customer",
    type: "quote_received",
    labelAr: "وصول عرض سعر إضافي",
    labelEn: "Additional price quote",
    whenAr: "يُرسل للعميل عند وصول عرض جديد بعد العرض الأول.",
    whenEn: "Sent to the customer for each new quote after the first one.",
    variables: [priceVar, daysVar],
    defaults: {
      titleAr: "وصل عرض سعر جديد",
      messageAr: "وصل عرض بقيمة {price} ر.س ومدة {days} يوم. افتح طلبك للمقارنة.",
      titleEn: "New price quote",
      messageEn: "A quote of {price} SAR in {days} days is available. Open your request to compare.",
    },
  },
  {
    key: "customer.quote_selected",
    audience: "customer",
    type: "quote_selected",
    labelAr: "تأكيد اختيار العرض",
    labelEn: "Quote selection confirmed",
    whenAr: "يُرسل للعميل بعد اختياره أحد العروض.",
    whenEn: "Sent to the customer after choosing a quote.",
    variables: [providerVar],
    defaults: {
      titleAr: "تم اختيار العرض",
      messageAr: "أُرسل الاختيار إلى {provider}. ينتظر النظام تأكيد الاستلام خلال ساعتين.",
      titleEn: "Quote selected",
      messageEn: "{provider} has been notified and has two hours to confirm receiving your request.",
    },
  },
  {
    key: "customer.quote_withdrawn",
    audience: "customer",
    type: "quote_withdrawn",
    labelAr: "سحب عرض سعر",
    labelEn: "Quote withdrawn",
    whenAr: "يُرسل للعميل عند سحب مقدم الخدمة عرضه قبل الاعتماد.",
    whenEn: "Sent to the customer when a provider withdraws a quote before selection.",
    variables: [providerVar],
    defaults: {
      titleAr: "تم سحب عرض سعر",
      messageAr: "سحب {provider} عرضه قبل الاعتماد. يمكنك متابعة بقية العروض.",
      titleEn: "A quote was withdrawn",
      messageEn: "{provider} withdrew their quote before selection. You can continue with the other quotes.",
    },
  },
  {
    key: "customer.request_received",
    audience: "customer",
    type: "request_received",
    labelAr: "تأكيد استلام الطلب",
    labelEn: "Request received by provider",
    whenAr: "يُرسل للعميل عندما يؤكد مقدم الخدمة استلام الطلب.",
    whenEn: "Sent to the customer when the provider confirms receiving the request.",
    variables: [providerVar],
    defaults: {
      titleAr: "تم استلام طلبك",
      messageAr: "{provider} أكد استلام طلبك وبدأت مرحلة التنفيذ.",
      titleEn: "Request received",
      messageEn: "{provider} confirmed receiving your request and work has started.",
    },
  },
  {
    key: "customer.provider_acceptance_expired",
    audience: "customer",
    type: "provider_acceptance_expired",
    labelAr: "انتهاء مهلة قبول مقدم الخدمة",
    labelEn: "Provider acceptance expired",
    whenAr: "يُرسل للعميل إذا لم يؤكد مقدم الخدمة الاستلام خلال المهلة.",
    whenEn: "Sent to the customer if the provider does not confirm in time.",
    variables: [],
    defaults: {
      titleAr: "انتهت مهلة مقدم الخدمة",
      messageAr: "لم يؤكد مقدم الخدمة استلام الطلب خلال المهلة. يمكنك اختيار عرض آخر.",
      titleEn: "Provider acceptance expired",
      messageEn: "The provider did not confirm in time. You can choose another quote.",
    },
  },
  {
    key: "customer.request_status_update",
    audience: "customer",
    type: "request_update",
    labelAr: "تحديث حالة الطلب",
    labelEn: "Request status update",
    whenAr: "يُرسل للعميل عند تغيير حالة طلبه مع نص التحديث.",
    whenEn: "Sent to the customer when the request status changes, with the update text.",
    variables: [messageVar],
    defaults: {
      titleAr: "تحديث حالة طلبك",
      messageAr: "{message}",
      titleEn: "Your request status was updated",
      messageEn: "{message}",
    },
  },
  {
    key: "customer.request_message",
    audience: "customer",
    type: "request_update",
    labelAr: "رسالة أو تحديث جديد",
    labelEn: "New message or update",
    whenAr: "يُرسل للعميل عند إضافة تحديث أو رسالة دون تغيير الحالة.",
    whenEn: "Sent to the customer when an update or message is added without a status change.",
    variables: [messageVar],
    defaults: {
      titleAr: "تحديث جديد على طلبك",
      messageAr: "{message}",
      titleEn: "New update on your request",
      messageEn: "{message}",
    },
  },
  {
    key: "customer.provider_attachment",
    audience: "customer",
    type: "request_update",
    labelAr: "مرفق من مقدم الخدمة",
    labelEn: "Attachment from provider",
    whenAr: "يُرسل للعميل عند إرفاق مقدم الخدمة ملفًا في المحادثة.",
    whenEn: "Sent to the customer when the provider attaches a file in the conversation.",
    variables: [providerVar, fileVar],
    defaults: {
      titleAr: "مرفق جديد من مقدم الخدمة",
      messageAr: "{provider} أرفق {file}",
      titleEn: "New attachment from the provider",
      messageEn: "{provider} attached {file}",
    },
  },
  {
    key: "team.new_customer_request",
    audience: "team",
    type: "new_customer_request",
    labelAr: "طلب جديد من عميل",
    labelEn: "New customer request",
    whenAr: "يُرسل للمعقبين المتاحين عند إنشاء طلب جديد.",
    whenEn: "Sent to available providers when a new request is created.",
    variables: [serviceVar, v("summary", "ملخص الطلب", "Request summary", "تجديد سجل تجاري قبل نهاية الشهر.", "Renew a commercial registration before month end.")],
    defaults: {
      titleAr: "وصل طلب جديد من عميل",
      messageAr: "الخدمة: {service}. {summary}",
      titleEn: "New customer request",
      messageEn: "Service: {service}. {summary}",
    },
  },
  {
    key: "team.request_assigned",
    audience: "team",
    type: "request_assigned",
    labelAr: "إسناد طلب",
    labelEn: "Request assigned",
    whenAr: "يُرسل لعضو الفريق عند إسناد طلب إليه من الإدارة.",
    whenEn: "Sent to a team member when the owner assigns a request to them.",
    variables: [serviceVar],
    defaults: {
      titleAr: "طلب جديد مسند إليك",
      messageAr: "تم إسناد {service} إلى حسابك. افتح بوابة الفريق لمراجعته.",
      titleEn: "A request was assigned to you",
      messageEn: "{service} was assigned to your account. Open the team portal to review it.",
    },
  },
  {
    key: "team.quote_selected",
    audience: "team",
    type: "quote_selected",
    labelAr: "اختيار العميل لعرضك",
    labelEn: "Your quote was selected",
    whenAr: "يُرسل للمعقب عند اختيار العميل عرضه.",
    whenEn: "Sent to the provider when the customer selects their quote.",
    variables: [],
    defaults: {
      titleAr: "اختار العميل عرضك",
      messageAr: "لديك ساعتان لتأكيد استلام الطلب قبل إعادة فتح الاختيار للعميل.",
      titleEn: "The customer selected your quote",
      messageEn: "You have two hours to confirm receiving the request before it reopens for the customer.",
    },
  },
  {
    key: "team.quote_declined",
    audience: "team",
    type: "quote_declined",
    labelAr: "قبول عرض آخر",
    labelEn: "Another quote accepted",
    whenAr: "يُرسل لبقية المعقبين بعد تأكيد صاحب العرض المختار.",
    whenEn: "Sent to the other providers once the selected provider confirms.",
    variables: [],
    defaults: {
      titleAr: "تم قبول عرض آخر",
      messageAr: "أكد مقدم العرض المختار استلام الطلب، وأُغلقت بقية العروض.",
      titleEn: "Another quote was accepted",
      messageEn: "The selected provider confirmed the request, and the other quotes were closed.",
    },
  },
  {
    key: "team.assignment_expired",
    audience: "team",
    type: "assignment_expired",
    labelAr: "انتهاء مهلة القبول",
    labelEn: "Acceptance window expired",
    whenAr: "يُرسل للمعقب إذا لم يؤكد الاستلام خلال المهلة.",
    whenEn: "Sent to the provider if they do not confirm within the time limit.",
    variables: [],
    defaults: {
      titleAr: "انتهت مهلة قبول الطلب",
      messageAr: "لم يُقبل الطلب خلال المهلة، وأُعيد فتح الاختيار للعميل.",
      titleEn: "Acceptance window expired",
      messageEn: "The request was not accepted in time and was reopened for the customer.",
    },
  },
  {
    key: "team.customer_comment",
    audience: "team",
    type: "customer_comment",
    labelAr: "رسالة من العميل",
    labelEn: "Message from customer",
    whenAr: "يُرسل للمعقب المسند عند وصول رسالة من العميل.",
    whenEn: "Sent to the assigned provider when the customer sends a message.",
    variables: [messageVar],
    defaults: {
      titleAr: "رسالة جديدة من العميل",
      messageAr: "{message}",
      titleEn: "New message from the customer",
      messageEn: "{message}",
    },
  },
  {
    key: "team.customer_attachment",
    audience: "team",
    type: "customer_comment",
    labelAr: "مرفق من العميل",
    labelEn: "Attachment from customer",
    whenAr: "يُرسل للمعقب المسند عند إرفاق العميل ملفًا.",
    whenEn: "Sent to the assigned provider when the customer attaches a file.",
    variables: [customerVar, fileVar],
    defaults: {
      titleAr: "مرفق جديد من العميل",
      messageAr: "{customer} أرفق {file}",
      titleEn: "New attachment from the customer",
      messageEn: "{customer} attached {file}",
    },
  },
  {
    key: "team.customer_review",
    audience: "team",
    type: "customer_review",
    labelAr: "تقييم من العميل",
    labelEn: "Customer review",
    whenAr: "يُرسل للمعقب عند تقييم العميل للخدمة بعد الاكتمال.",
    whenEn: "Sent to the provider when the customer rates a completed request.",
    variables: [v("rating", "التقييم من 5", "Rating out of 5", "5")],
    defaults: {
      titleAr: "وصل تقييم جديد",
      messageAr: "قيّم العميل الخدمة {rating} من 5.",
      titleEn: "New review received",
      messageEn: "The customer rated the service {rating} out of 5.",
    },
  },
] as const;

const templateByKey = new Map<NotificationTemplateKey, NotificationTemplateDefinition>(
  NOTIFICATION_TEMPLATES.map((template) => [template.key, template]),
);

export const NOTIFICATION_TEMPLATE_KEYS = NOTIFICATION_TEMPLATES.map((template) => template.key) as [NotificationTemplateKey, ...NotificationTemplateKey[]];

export function isNotificationTemplateKey(value: string): value is NotificationTemplateKey {
  return templateByKey.has(value as NotificationTemplateKey);
}

export function getNotificationTemplate(key: NotificationTemplateKey) {
  const template = templateByKey.get(key);
  if (!template) throw new Error(`Unknown notification template: ${key}`);
  return template;
}

const placeholderPattern = /\{([a-zA-Z_]+)\}/g;

export function extractPlaceholders(text: string) {
  return Array.from(text.matchAll(placeholderPattern), (match) => match[1]);
}

export type TemplateField = keyof NotificationTemplateText;

export type TemplateValidationIssue = {
  field: TemplateField;
  code: "required" | "too_long" | "unknown_variable" | "unbalanced_braces";
  variable?: string;
};

/** Validates an edited template against the variables allowed for its key. */
export function validateNotificationTemplate(key: NotificationTemplateKey, text: NotificationTemplateText) {
  const allowed = new Set(getNotificationTemplate(key).variables.map((variable) => variable.name));
  const issues: TemplateValidationIssue[] = [];
  (Object.keys(text) as TemplateField[]).forEach((field) => {
    const value = text[field] ?? "";
    const trimmed = value.trim();
    const max = field.startsWith("title") ? NOTIFICATION_TITLE_MAX : NOTIFICATION_MESSAGE_MAX;
    if (!trimmed) {
      issues.push({ field, code: "required" });
      return;
    }
    if (trimmed.length > max) issues.push({ field, code: "too_long" });
    const withoutPlaceholders = trimmed.replace(placeholderPattern, "");
    if (/[{}]/.test(withoutPlaceholders)) issues.push({ field, code: "unbalanced_braces" });
    extractPlaceholders(trimmed).forEach((name) => {
      if (!allowed.has(name)) issues.push({ field, code: "unknown_variable", variable: name });
    });
  });
  return issues;
}

export function describeTemplateIssue(issue: TemplateValidationIssue, isEnglish: boolean) {
  if (issue.code === "required") return isEnglish ? "This field is required." : "هذا الحقل مطلوب.";
  if (issue.code === "too_long") {
    const max = issue.field.startsWith("title") ? NOTIFICATION_TITLE_MAX : NOTIFICATION_MESSAGE_MAX;
    return isEnglish ? `Keep it within ${max} characters.` : `الحد الأقصى ${max} حرفًا.`;
  }
  if (issue.code === "unbalanced_braces") return isEnglish ? "Use braces only around an available variable, such as {provider}." : "استخدم الأقواس فقط حول متغير متاح مثل {provider}.";
  return isEnglish ? `{${issue.variable}} is not available for this notification.` : `المتغير {${issue.variable}} غير متاح لهذا الإشعار.`;
}

function cleanVariableValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ")
    .trim()
    .slice(0, VARIABLE_VALUE_MAX);
}

function fillText(text: string, variables: Record<string, unknown>, allowed: Set<string>) {
  return text
    .replace(placeholderPattern, (match, name: string) => (allowed.has(name) ? cleanVariableValue(variables[name]) : match))
    .trim();
}

export type LocalizedVariables = Record<string, unknown> & { ar?: Record<string, unknown>; en?: Record<string, unknown> };

export type RenderedNotification = {
  type: string;
  title: string;
  message: string;
  titleEn: string;
  messageEn: string;
};

/**
 * Builds the stored notification text. `variables` may include per-language overrides in `ar`/`en`
 * (for example a fallback summary sentence). Overrides that fail validation are ignored so a bad
 * saved template can never block a notification.
 */
export function renderNotificationTemplate(
  key: NotificationTemplateKey,
  variables: LocalizedVariables = {},
  override?: Partial<NotificationTemplateText> | null,
): RenderedNotification {
  const template = getNotificationTemplate(key);
  const candidate: NotificationTemplateText = { ...template.defaults, ...(override ?? {}) } as NotificationTemplateText;
  const text = override && validateNotificationTemplate(key, candidate).length === 0 ? candidate : template.defaults;
  const allowed = new Set(template.variables.map((variable) => variable.name));
  const { ar = {}, en = {}, ...shared } = variables;
  const arVars = { ...shared, ...ar };
  const enVars = { ...shared, ...en };
  const fallback = (value: string, defaultValue: string, vars: Record<string, unknown>) => value || fillText(defaultValue, vars, allowed);
  const title = fallback(fillText(text.titleAr, arVars, allowed), template.defaults.titleAr, arVars).slice(0, STORED_TITLE_MAX);
  const message = fallback(fillText(text.messageAr, arVars, allowed), template.defaults.messageAr, arVars).slice(0, STORED_MESSAGE_MAX);
  const titleEn = fallback(fillText(text.titleEn, enVars, allowed), template.defaults.titleEn, enVars).slice(0, STORED_TITLE_MAX);
  const messageEn = fallback(fillText(text.messageEn, enVars, allowed), template.defaults.messageEn, enVars).slice(0, STORED_MESSAGE_MAX);
  return { type: template.type, title, message, titleEn, messageEn };
}

/** Preview with the sample values shown in the owner settings page. */
export function previewNotificationTemplate(key: NotificationTemplateKey, text: NotificationTemplateText) {
  const template = getNotificationTemplate(key);
  const allowed = new Set(template.variables.map((variable) => variable.name));
  const arVars = Object.fromEntries(template.variables.map((variable) => [variable.name, variable.sample.ar]));
  const enVars = Object.fromEntries(template.variables.map((variable) => [variable.name, variable.sample.en]));
  return {
    titleAr: fillText(text.titleAr, arVars, allowed),
    messageAr: fillText(text.messageAr, arVars, allowed),
    titleEn: fillText(text.titleEn, enVars, allowed),
    messageEn: fillText(text.messageEn, enVars, allowed),
  };
}
