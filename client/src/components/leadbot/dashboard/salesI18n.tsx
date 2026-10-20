import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Languages } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

/**
 * Language of the sales dashboard only (owner/staff). It is independent from
 * the public site language so a non-Arabic-speaking employee can work in
 * English without changing what visitors see. Remembered on this device.
 */
export type SalesLang = "ar" | "en";

export const SALES_LANG_KEY = "mm-sales-dashboard-lang";

const listeners = new Set<() => void>();

function readStored(): SalesLang | null {
  try {
    const value = typeof window === "undefined" ? null : window.localStorage.getItem(SALES_LANG_KEY);
    return value === "ar" || value === "en" ? value : null;
  } catch {
    return null;
  }
}

let current: SalesLang | null | undefined;

function snapshot(): SalesLang | null {
  if (current === undefined) current = readStored();
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== SALES_LANG_KEY) return;
    current = readStored();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function setSalesLang(lang: SalesLang) {
  current = lang;
  try {
    window.localStorage.setItem(SALES_LANG_KEY, lang);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  listeners.forEach((listener) => listener());
}

/** Forget the saved choice (back to the site language). Used by tests. */
export function resetSalesLang() {
  current = null;
  try {
    window.localStorage.removeItem(SALES_LANG_KEY);
  } catch {
    // ignore
  }
  listeners.forEach((listener) => listener());
}

const AR = {
  // Page & shells
  kicker: "مساعد المبيعات",
  title: "تأهيل العملاء المحتملين",
  intro: "كل زائر يكمل التأهيل أو يطلب موظفًا عبر مساعد المبيعات يظهر هنا مع ملخصه وتقييمه. الرد يصل إلى نافذة المحادثة عند العميل مباشرة.",
  soundOn: "التنبيه الصوتي مفعّل",
  soundOff: "التنبيه الصوتي متوقف",
  tabsLabel: "أقسام لوحة المبيعات",
  tabLeads: "العملاء المحتملون",
  tabAnalytics: "التحليلات",
  tabSettings: "إعدادات المساعد",
  languageLabel: "لغة لوحة المبيعات",
  languageChanged: "أصبحت لوحة المبيعات بالعربية.",
  staffShellTitle: "مساعد المبيعات",
  backToStaff: "لوحة الموظف",
  deniedTitle: "هذه الصفحة لفريق المبيعات فقط",
  signInBody: "سجّل الدخول بحساب المالك أو موظف المبيعات للاطلاع على العملاء المحتملين.",
  teamLogin: "دخول فريق العمل",
  noAccessBody: "صلاحية حسابك لا تسمح بعرض العملاء المحتملين أو محادثاتهم.",
  backToSite: "العودة إلى الموقع",
  // Leads list
  segAll: "كل العملاء المحتملين",
  segNew: "جديد لم يُتواصل معه",
  segHot: "عملاء ساخنون",
  segWaiting: "بانتظار موظف",
  filterGroup: "تصفية العملاء المحتملين",
  searchLabel: "ابحث بالاسم أو رقم الجوال",
  searchPlaceholder: "ابحث برقم الجوال أو الاسم (05… أو 9665… أو أرقام عربية)",
  clearSearch: "مسح البحث",
  gradeFilter: "التقييم",
  allGrades: "كل التقييمات",
  statusFilter: "الحالة",
  allStatuses: "كل الحالات",
  serviceFilter: "الخدمة",
  allServices: "كل الخدمات",
  refresh: "تحديث القائمة",
  countLive: "{count} عميل محتمل",
  loadErrorTitle: "تعذّر تحميل العملاء المحتملين",
  checkConnection: "تحقق من الاتصال ثم أعد المحاولة.",
  retry: "إعادة المحاولة",
  noResultsTitle: "لا توجد نتائج مطابقة",
  noResultsBody: "جرّب رقمًا آخر أو أزل بعض عوامل التصفية.",
  clearFilters: "مسح عوامل التصفية",
  emptyTitle: "لا يوجد عملاء محتملون بعد",
  emptyBody: "سيظهر هنا كل زائر يكمل التأهيل أو يطلب التحدث مع موظف عبر مساعد المبيعات في الموقع.",
  listLabel: "قائمة العملاء المحتملين",
  unnamed: "زائر بدون اسم",
  unreadSr: "رسائل غير مقروءة",
  partnerTag: "شريك/معقّب",
  joinRequestTag: "طلب انضمام",
  incompleteTag: "غير مكتمل",
  waitingTag: "بانتظار موظف",
  activeTag: "محادثة جارية",
  lastActivitySr: "آخر نشاط: ",
  // Lead detail
  detailTitle: "تفاصيل العميل المحتمل",
  kindPartner: "طلب شراكة/معقّب",
  kindSales: "عميل مبيعات",
  createdOn: "أُنشئ {date}",
  closeDetail: "إغلاق التفاصيل",
  detailError: "تعذّر تحميل التفاصيل",
  copy: "نسخ",
  copied: "تم النسخ",
  copyFailed: "تعذّر النسخ",
  statusFailed: "تعذّر تحديث الحالة.",
  assignFailed: "تعذّر التعيين.",
  noteSaved: "تم حفظ الملاحظة",
  noteFailed: "تعذّر حفظ الملاحظة.",
  handoffEnded: "انتهى التحويل وعاد العميل إلى المساعد.",
  handoffEndFailed: "تعذّر إنهاء التحويل.",
  partnerPending: "طلب انضمام كمعقّب",
  qualificationIncomplete: "تأهيل غير مكتمل",
  noPhone: "لم يترك رقم جوال",
  consented: "وافق على التواصل",
  notConsented: "لم يوافق بعد",
  handoffActive: "محادثة جارية مع {name}",
  handoffWaiting: "العميل بانتظار رد موظف",
  aTeamMember: "موظف",
  reasonLabel: "السبب:",
  reasonComplaint: "شكوى",
  reasonRequested: "طلب موظف",
  endHandoff: "إنهاء التحويل",
  summaryTitle: "ملخص التأهيل",
  noSummary: "لا توجد بيانات تأهيل بعد.",
  scoreTitle: "لماذا هذا التقييم؟ ({score}/100)",
  noSignals: "لا توجد إشارات كافية بعد.",
  followUpTitle: "حالة المتابعة",
  assignedLabel: "المسؤول:",
  unassigned: "غير معيّن",
  assignMe: "تعيين لي",
  notesTitle: "ملاحظات داخلية (لا تظهر للعميل)",
  notesLabel: "ملاحظات داخلية",
  notesPlaceholder: "مثال: طلب عرضًا لعقد سنوي…",
  saveNote: "حفظ الملاحظة",
  cancel: "إلغاء",
  transcriptTitle: "نص المحادثة ({count} رسالة)",
  transcriptLabel: "نص المحادثة",
  noMessages: "لا توجد رسائل.",
  roleVisitor: "العميل",
  roleAgent: "موظف",
  roleBot: "المساعد",
  replyFailed: "تعذّر إرسال الرد. حاول مرة أخرى.",
  replyLabel: "الرد على العميل",
  replyPlaceholderOpen: "اكتب ردك للعميل… (يظهر في نافذة المحادثة فورًا)",
  replyPlaceholderStart: "ابدأ محادثة مباشرة مع العميل…",
  sendReply: "إرسال الرد",
  send: "إرسال",
  replyHint: "لا تطلب من العميل رقم الهوية أو كلمات المرور أو بيانات البطاقة. Ctrl + Enter للإرسال.",
  // Analytics
  analyticsIntro: "مؤشرات استخدام مساعد المبيعات وجودة التأهيل.",
  rangeLabel: "الفترة",
  lastDays: "آخر {days} يومًا",
  analyticsError: "تعذّر تحميل التحليلات",
  noDataTitle: "لا توجد بيانات في هذه الفترة",
  noDataBody: "ستظهر المؤشرات بعد أن يبدأ الزوار محادثاتهم مع مساعد المبيعات.",
  noBarData: "لا توجد بيانات بعد.",
  funnelStarted: "بدأوا محادثة",
  funnelEngaged: "تفاعلوا مع المساعد",
  funnelQualified: "أكملوا التأهيل",
  statConversations: "المحادثات",
  statEngagedHint: "{count} تفاعلوا فعليًا",
  statQualRate: "نسبة التأهيل",
  statQualHint: "{count} عميل محتمل مؤهل",
  statEscalations: "التحويل لموظف",
  statEscalationsHint: "طلبات تحدث مع موظف أو شكاوى",
  statFallback: "معدل عدم الفهم",
  fallbackHigh: "مرتفع: راجع الأسئلة الشائعة",
  fallbackOk: "ضمن المعدل الجيد",
  dailyTrend: "الاتجاه اليومي",
  dailyChartLabel: "رسم بياني للمحادثات اليومية والعملاء المؤهلين",
  dayTitle: "{date}: {conversations} محادثة · {qualified} مؤهل",
  legendConversations: "محادثات",
  legendQualified: "مؤهلون",
  funnelTitle: "قمع التأهيل",
  partnerApps: "منها {count} طلب انضمام كمعقّب.",
  gradeDistribution: "توزيع التقييم (متوسط {avg})",
  topIntents: "أكثر النوايا شيوعًا",
  topServices: "الخدمات الأكثر طلبًا",
  moderationTitle: "الإشراف وحماية البيانات",
  moderationBlocks: "رسائل محظورة لألفاظ مسيئة",
  sensitiveMasked: "بيانات حساسة حُجبت تلقائيًا",
  privacyNote: "تُحجب أرقام الهوية والآيبان والبطاقات قبل الحفظ، ولا تُحفظ بيانات التواصل إلا بعد موافقة صريحة من الزائر.",
  // Settings
  settingsError: "تعذّر تحميل الإعدادات",
  settingsSaved: "تم حفظ الإعدادات وتطبيقها على المحادثات الجديدة.",
  settingsSaveFailed: "تعذّر حفظ الإعدادات. تحقق من الاتصال ثم حاول مرة أخرى.",
  invalid_hours: "يجب أن تكون نهاية الدوام بعد بدايته.",
  invalid_days: "اختر يوم عمل واحدًا على الأقل.",
  invalid_whatsapp: "رقم واتساب غير صحيح. اكتبه مثل 05XXXXXXXX أو ‎+9665XXXXXXXX، أو اتركه فارغًا لاستخدام رقم الموقع.",
  invalid_sla: "اكتب وعد الاستجابة بالعربية والإنجليزية (حتى 80 حرفًا).",
  invalid_escalation: "اختر عددًا بين 1 و5.",
  behaviorTitle: "سلوك المساعد",
  enabledTitle: "تفعيل مساعد المبيعات",
  enabledHint: "عند الإيقاف يظهر للزائر رابط «تواصل ودعم» بدلًا من المحادثة.",
  aiTitle: "الفهم بالذكاء الاصطناعي",
  aiHint: "يُستخدم فقط للرسائل غير الواضحة لاستخراج النية والبيانات، والردود تبقى نصوصًا معتمدة. تُحجب البيانات الحساسة قبل الإرسال.",
  hotTitle: "عرض موظف فوري للعملاء الساخنين",
  hotHint: "للطلبات العاجلة ذات التقييم المرتفع خلال أوقات الدوام.",
  escalateTitle: "عرض التحويل لموظف بعد",
  escalateHint: "عدد مرات عدم الفهم المتتالية قبل اقتراح موظف.",
  timesOne: "مرة واحدة",
  timesMany: "{count} مرات",
  hoursTitle: "أوقات الدوام والتواصل",
  hoursDescription: "تُستخدم لرسائل التحويل لموظف (بتوقيت الرياض). الحالي: {hours} —",
  openNow: "ضمن الدوام الآن",
  closedNow: "خارج الدوام الآن",
  workingDays: "أيام العمل",
  fromHour: "من الساعة",
  toHour: "إلى الساعة",
  slaArLabel: "وعد الاستجابة بالعربية (يظهر للعميل)",
  slaEnLabel: "وعد الاستجابة بالإنجليزية (يظهر للعميل)",
  whatsappLabel: "رقم واتساب المبيعات (اختياري)",
  whatsappHint: "اتركه فارغًا لاستخدام رقم واتساب الدعم المحفوظ في إعدادات الموقع.",
  servicesTitle: "الخدمات المعروضة في المساعد",
  servicesDescription: "إذا لم تختر شيئًا تُعرض كل الخدمات. «خدمة أخرى» تظهر دائمًا.",
  servicesGroup: "الخدمات المعروضة",
  lastUpdated: "آخر تحديث {time}",
  updatedBy: " بواسطة {name}",
  defaultSettings: "الإعدادات الافتراضية",
  restoreDefaults: "الإعدادات الافتراضية",
  undo: "تراجع",
  saveChanges: "حفظ التغييرات",
  // Alerts
  alertOpen: "فتح",
  alertWaitingTitle: "عميل محتمل بانتظار موظف",
  alertWaitingBody: "طلب زائر التحدث مع موظف عبر مساعد المبيعات.",
  alertHotTitle: "عميل محتمل ساخن جديد",
  alertHotBody: "أكمل زائر التأهيل بتقييم مرتفع.",
  alertUnread: "رسالة جديدة من عميل محتمل",
  alertSummary: "مساعد المبيعات: {waiting} بانتظار موظف، {hot} عميل ساخن جديد، {unread} رسالة غير مقروءة",
  // Errors
  errorForbidden: "لا تملك صلاحية تنفيذ هذا الإجراء.",
  errorUnauthorized: "انتهت الجلسة. سجّل الدخول مرة أخرى.",
  now: "الآن",
};

export type SalesKey = keyof typeof AR;

const EN: Record<SalesKey, string> = {
  kicker: "Sales assistant",
  title: "Lead qualification",
  intro: "Every visitor who completes qualification or asks for a team member through the sales assistant appears here with a summary and score. Your reply reaches the visitor's chat window instantly.",
  soundOn: "Sound alerts on",
  soundOff: "Sound alerts off",
  tabsLabel: "Sales dashboard sections",
  tabLeads: "Leads",
  tabAnalytics: "Analytics",
  tabSettings: "Assistant settings",
  languageLabel: "Sales dashboard language",
  languageChanged: "The sales dashboard is now in English.",
  staffShellTitle: "Sales assistant",
  backToStaff: "Employee dashboard",
  deniedTitle: "This page is for the sales team only",
  signInBody: "Sign in with the owner account or a sales team account to view leads.",
  teamLogin: "Team sign-in",
  noAccessBody: "Your account is not allowed to view leads or their conversations.",
  backToSite: "Back to the website",
  segAll: "All leads",
  segNew: "New, not contacted",
  segHot: "Hot leads",
  segWaiting: "Waiting for an agent",
  filterGroup: "Filter leads",
  searchLabel: "Search by name or mobile number",
  searchPlaceholder: "Search by mobile or name (05…, 9665… or Arabic digits)",
  clearSearch: "Clear search",
  gradeFilter: "Grade",
  allGrades: "All grades",
  statusFilter: "Status",
  allStatuses: "All statuses",
  serviceFilter: "Service",
  allServices: "All services",
  refresh: "Refresh list",
  countLive: "{count} leads",
  loadErrorTitle: "Couldn't load leads",
  checkConnection: "Check your connection and try again.",
  retry: "Try again",
  noResultsTitle: "No matching results",
  noResultsBody: "Try another number or remove some filters.",
  clearFilters: "Clear filters",
  emptyTitle: "No leads yet",
  emptyBody: "Every visitor who completes qualification or asks to talk to a team member through the website's sales assistant will appear here.",
  listLabel: "Lead list",
  unnamed: "Unnamed visitor",
  unreadSr: "unread messages",
  partnerTag: "Partner / agent",
  joinRequestTag: "Join request",
  incompleteTag: "Incomplete",
  waitingTag: "Waiting for an agent",
  activeTag: "Live chat",
  lastActivitySr: "Last activity: ",
  detailTitle: "Lead details",
  kindPartner: "Partner / agent request",
  kindSales: "Sales lead",
  createdOn: "Created {date}",
  closeDetail: "Close details",
  detailError: "Couldn't load the details",
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Couldn't copy",
  statusFailed: "Couldn't update the status.",
  assignFailed: "Couldn't assign the lead.",
  noteSaved: "Note saved",
  noteFailed: "Couldn't save the note.",
  handoffEnded: "Handoff ended. The visitor is back with the assistant.",
  handoffEndFailed: "Couldn't end the handoff.",
  partnerPending: "Request to join as an agent",
  qualificationIncomplete: "Qualification incomplete",
  noPhone: "No mobile number left",
  consented: "Agreed to be contacted",
  notConsented: "Has not agreed yet",
  handoffActive: "Live chat with {name}",
  handoffWaiting: "The visitor is waiting for a team member",
  aTeamMember: "a team member",
  reasonLabel: "Reason:",
  reasonComplaint: "Complaint",
  reasonRequested: "Asked for an agent",
  endHandoff: "End handoff",
  summaryTitle: "Qualification summary",
  noSummary: "No qualification data yet.",
  scoreTitle: "Why this score? ({score}/100)",
  noSignals: "Not enough signals yet.",
  followUpTitle: "Follow-up status",
  assignedLabel: "Assigned to:",
  unassigned: "Unassigned",
  assignMe: "Assign to me",
  notesTitle: "Internal notes (not shown to the visitor)",
  notesLabel: "Internal notes",
  notesPlaceholder: "Example: asked for an annual contract quote…",
  saveNote: "Save note",
  cancel: "Cancel",
  transcriptTitle: "Conversation ({count} messages)",
  transcriptLabel: "Conversation transcript",
  noMessages: "No messages.",
  roleVisitor: "Visitor",
  roleAgent: "Team member",
  roleBot: "Assistant",
  replyFailed: "Couldn't send the reply. Please try again.",
  replyLabel: "Reply to the visitor",
  replyPlaceholderOpen: "Type your reply… (it appears in the visitor's chat instantly)",
  replyPlaceholderStart: "Start a live chat with the visitor…",
  sendReply: "Send reply",
  send: "Send",
  replyHint: "Never ask the visitor for ID numbers, passwords or card details. Ctrl + Enter to send.",
  analyticsIntro: "Sales assistant usage and qualification quality.",
  rangeLabel: "Period",
  lastDays: "Last {days} days",
  analyticsError: "Couldn't load analytics",
  noDataTitle: "No data for this period",
  noDataBody: "Metrics appear once visitors start chatting with the sales assistant.",
  noBarData: "No data yet.",
  funnelStarted: "Started a chat",
  funnelEngaged: "Engaged with the assistant",
  funnelQualified: "Completed qualification",
  statConversations: "Conversations",
  statEngagedHint: "{count} actually engaged",
  statQualRate: "Qualification rate",
  statQualHint: "{count} qualified leads",
  statEscalations: "Handoffs to agents",
  statEscalationsHint: "Requests for an agent or complaints",
  statFallback: "Not-understood rate",
  fallbackHigh: "High: review the knowledge answers",
  fallbackOk: "Within a healthy range",
  dailyTrend: "Daily trend",
  dailyChartLabel: "Chart of daily conversations and qualified leads",
  dayTitle: "{date}: {conversations} conversations · {qualified} qualified",
  legendConversations: "Conversations",
  legendQualified: "Qualified",
  funnelTitle: "Qualification funnel",
  partnerApps: "Including {count} requests to join as an agent.",
  gradeDistribution: "Grade distribution (average {avg})",
  topIntents: "Most common intents",
  topServices: "Most requested services",
  moderationTitle: "Moderation and data protection",
  moderationBlocks: "Messages blocked for abusive language",
  sensitiveMasked: "Sensitive details masked automatically",
  privacyNote: "ID numbers, IBANs and card numbers are masked before saving, and contact details are stored only after the visitor's explicit consent.",
  settingsError: "Couldn't load settings",
  settingsSaved: "Settings saved and applied to new conversations.",
  settingsSaveFailed: "Couldn't save settings. Check your connection and try again.",
  invalid_hours: "The end of working hours must be after the start.",
  invalid_days: "Choose at least one working day.",
  invalid_whatsapp: "Invalid WhatsApp number. Use 05XXXXXXXX or +9665XXXXXXXX, or leave it empty to use the site number.",
  invalid_sla: "Write the response promise in Arabic and English (up to 80 characters).",
  invalid_escalation: "Choose a number from 1 to 5.",
  behaviorTitle: "Assistant behavior",
  enabledTitle: "Enable the sales assistant",
  enabledHint: "When off, visitors see a \"Contact & support\" link instead of the chat.",
  aiTitle: "AI understanding",
  aiHint: "Used only for unclear messages to detect intent and details; replies stay approved texts. Sensitive data is masked before sending.",
  hotTitle: "Offer an agent right away to hot leads",
  hotHint: "For urgent, high-scoring requests during working hours.",
  escalateTitle: "Offer a handoff after",
  escalateHint: "Consecutive not-understood messages before suggesting an agent.",
  timesOne: "1 time",
  timesMany: "{count} times",
  hoursTitle: "Working hours and contact",
  hoursDescription: "Used in handoff messages (Riyadh time). Current: {hours} —",
  openNow: "Within working hours now",
  closedNow: "Outside working hours now",
  workingDays: "Working days",
  fromHour: "From",
  toHour: "To",
  slaArLabel: "Response promise in Arabic (shown to visitors)",
  slaEnLabel: "Response promise in English (shown to visitors)",
  whatsappLabel: "Sales WhatsApp number (optional)",
  whatsappHint: "Leave empty to use the support WhatsApp number saved in the site settings.",
  servicesTitle: "Services offered in the assistant",
  servicesDescription: "If none is selected, all services are shown. \"Other service\" always appears.",
  servicesGroup: "Offered services",
  lastUpdated: "Last updated {time}",
  updatedBy: " by {name}",
  defaultSettings: "Default settings",
  restoreDefaults: "Restore defaults",
  undo: "Undo",
  saveChanges: "Save changes",
  alertOpen: "Open",
  alertWaitingTitle: "A lead is waiting for an agent",
  alertWaitingBody: "A visitor asked to talk to a team member through the sales assistant.",
  alertHotTitle: "New hot lead",
  alertHotBody: "A visitor completed qualification with a high score.",
  alertUnread: "New message from a lead",
  alertSummary: "Sales assistant: {waiting} waiting for an agent, {hot} new hot leads, {unread} unread messages",
  errorForbidden: "You don't have permission to do this.",
  errorUnauthorized: "Your session has expired. Please sign in again.",
  now: "now",
};

export const SALES_STRINGS: Record<SalesLang, Record<SalesKey, string>> = { ar: AR, en: EN };

export const DAY_LABELS: Record<SalesLang, string[]> = {
  ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

export type SalesVars = Record<string, string | number>;

export function salesText(lang: SalesLang, key: SalesKey, vars?: SalesVars) {
  const template = SALES_STRINGS[lang][key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export const salesLocale = (lang: SalesLang) => (lang === "en" ? "en-GB" : "ar-SA-u-nu-latn");

/**
 * Current dashboard language: the saved choice, otherwise the site language.
 * Works anywhere (also in the sidebar badge and staff workspace alerts).
 */
export function useSalesLang() {
  const site = useLanguage().language;
  const stored = useSyncExternalStore(subscribe, snapshot, () => null);
  const lang: SalesLang = stored ?? (site === "en" ? "en" : "ar");
  const t = useCallback((key: SalesKey, vars?: SalesVars) => salesText(lang, key, vars), [lang]);
  return useMemo(
    () => ({ lang, dir: (lang === "en" ? "ltr" : "rtl") as "ltr" | "rtl", isEnglish: lang === "en", t, setLang: setSalesLang }),
    [lang, t],
  );
}

/** Two-button switch: «العربية | English». Each label is in its own language. */
export function SalesLanguageToggle({ className }: { className?: string }) {
  const { lang, t, setLang } = useSalesLang();
  const [announcement, setAnnouncement] = useState("");
  const options: Array<{ id: SalesLang; label: string }> = [
    { id: "ar", label: "العربية" },
    { id: "en", label: "English" },
  ];
  return (
    <div role="group" aria-label={t("languageLabel")} className={cn("inline-flex items-center gap-1 rounded-xl border border-[#dce8f6] bg-white p-1", className)}>
      <Languages className="mx-1 h-4 w-4 shrink-0 text-[#60778f]" aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          lang={option.id}
          dir={option.id === "ar" ? "rtl" : "ltr"}
          aria-pressed={lang === option.id}
          onClick={() => {
            if (lang === option.id) return;
            setLang(option.id);
            setAnnouncement(salesText(option.id, "languageChanged"));
          }}
          className={cn(
            "lb-press min-h-8 rounded-lg px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9]/40",
            lang === option.id ? "bg-[#0878f9] text-white" : "text-[#17334f] hover:bg-[#f1f7ff]",
          )}
        >
          {option.label}
        </button>
      ))}
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
