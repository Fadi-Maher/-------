import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import {
  NOTIFICATION_MESSAGE_MAX,
  NOTIFICATION_TEMPLATES,
  NOTIFICATION_TITLE_MAX,
  describeTemplateIssue,
  getNotificationTemplate,
  previewNotificationTemplate,
  validateNotificationTemplate,
  type NotificationTemplateKey,
  type NotificationTemplateText,
  type TemplateField,
} from "@shared/notificationTemplates";
import { Bell, BriefcaseBusiness, Loader2, RotateCcw, Save, Undo2, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Override = NotificationTemplateText & { key: string; updatedAt: Date | string };

const fieldMeta: Record<TemplateField, { label: string; lang: "ar" | "en"; multiline: boolean; max: number }> = {
  titleAr: { label: "العنوان بالعربية", lang: "ar", multiline: false, max: NOTIFICATION_TITLE_MAX },
  messageAr: { label: "نص الإشعار بالعربية", lang: "ar", multiline: true, max: NOTIFICATION_MESSAGE_MAX },
  titleEn: { label: "Title in English", lang: "en", multiline: false, max: NOTIFICATION_TITLE_MAX },
  messageEn: { label: "Message in English", lang: "en", multiline: true, max: NOTIFICATION_MESSAGE_MAX },
};
const fieldOrder: TemplateField[] = ["titleAr", "messageAr", "titleEn", "messageEn"];

const audienceGroups = [
  { audience: "customer" as const, label: "إشعارات العملاء", icon: UserRound },
  { audience: "team" as const, label: "إشعارات المعقبين والفريق", icon: BriefcaseBusiness },
];

function sameText(a: NotificationTemplateText, b: NotificationTemplateText) {
  return a.titleAr === b.titleAr && a.messageAr === b.messageAr && a.titleEn === b.titleEn && a.messageEn === b.messageEn;
}

function pickText(value: NotificationTemplateText): NotificationTemplateText {
  return { titleAr: value.titleAr, messageAr: value.messageAr, titleEn: value.titleEn, messageEn: value.messageEn };
}

function PreviewCard({ title, message, lang }: { title: string; message: string; lang: "ar" | "en" }) {
  const isEnglish = lang === "en";
  return (
    <div dir={isEnglish ? "ltr" : "rtl"} lang={lang} className="flex items-start gap-3 rounded-2xl border border-[#dce8f6] bg-white p-3 shadow-[0_8px_24px_rgba(16,42,67,.06)]">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eaf3ff] text-[#0878f9]">
        <Bell className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="break-words text-sm font-extrabold text-[#17334f]">{title || (isEnglish ? "Title" : "العنوان")}</p>
        <p className="mt-1 break-words text-xs leading-6 text-[#60778f]">{message || (isEnglish ? "Message" : "نص الإشعار")}</p>
      </div>
    </div>
  );
}

export function NotificationTemplatesPanel() {
  const utils = trpc.useUtils();
  const overridesQuery = trpc.notificationTemplates.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const [selectedKey, setSelectedKey] = useState<NotificationTemplateKey>(NOTIFICATION_TEMPLATES[0].key);
  const [drafts, setDrafts] = useState<Partial<Record<NotificationTemplateKey, NotificationTemplateText>>>({});
  const [lastField, setLastField] = useState<TemplateField>("messageAr");
  const [confirmReset, setConfirmReset] = useState(false);
  const fieldRefs = useRef<Partial<Record<TemplateField, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  const overrides = useMemo(() => {
    const map = new Map<string, Override>();
    (overridesQuery.data ?? []).forEach((item) => map.set(item.key, item));
    return map;
  }, [overridesQuery.data]);

  const template = getNotificationTemplate(selectedKey);
  const saved = overrides.get(selectedKey);
  const savedText = saved ? pickText(saved) : template.defaults;
  const draft = drafts[selectedKey] ?? savedText;
  const isDirty = !sameText(draft, savedText);
  const issues = useMemo(() => validateNotificationTemplate(selectedKey, draft), [selectedKey, draft]);
  const preview = useMemo(() => previewNotificationTemplate(selectedKey, draft), [selectedKey, draft]);

  // Once the saved value catches up with a draft, drop the draft so the item is no longer marked "unsaved".
  useEffect(() => {
    setDrafts((current) => {
      let changed = false;
      const next = { ...current };
      (Object.keys(next) as NotificationTemplateKey[]).forEach((key) => {
        const savedOverride = overrides.get(key);
        const base = savedOverride ? pickText(savedOverride) : getNotificationTemplate(key).defaults;
        if (next[key] && sameText(next[key]!, base)) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [overrides]);

  const save = trpc.notificationTemplates.save.useMutation({
    onSuccess: async () => {
      await utils.notificationTemplates.list.invalidate();
      toast.success("تم حفظ نص الإشعار. سيُستخدم في الإشعارات الجديدة فقط.");
    },
    onError: (error) => toast.error(error.message || "تعذر حفظ نص الإشعار."),
  });
  const reset = trpc.notificationTemplates.reset.useMutation({
    onSuccess: async (_result, variables) => {
      setDrafts((current) => {
        const next = { ...current };
        delete next[variables.key];
        return next;
      });
      await utils.notificationTemplates.list.invalidate();
      setConfirmReset(false);
      toast.success("أُعيد النص الافتراضي لهذا الإشعار.");
    },
    onError: (error) => toast.error(error.message || "تعذرت استعادة النص الافتراضي."),
  });

  const updateField = (field: TemplateField, value: string) => {
    setDrafts((current) => ({ ...current, [selectedKey]: { ...(current[selectedKey] ?? savedText), [field]: value } }));
  };

  const insertVariable = (name: string) => {
    const token = `{${name}}`;
    const field = lastField;
    const element = fieldRefs.current[field];
    const value = draft[field];
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    const nextValue = `${value.slice(0, start)}${token}${value.slice(end)}`;
    updateField(field, nextValue);
    requestAnimationFrame(() => {
      const target = fieldRefs.current[field];
      if (!target) return;
      target.focus();
      const caret = start + token.length;
      target.setSelectionRange(caret, caret);
    });
  };

  const discard = () => {
    setDrafts((current) => {
      const next = { ...current };
      delete next[selectedKey];
      return next;
    });
  };

  const isBusy = save.isPending || reset.isPending;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(240px,300px)_1fr]">
      <div className="lg:hidden">
        <label htmlFor="template-picker" className="mb-1.5 block text-sm font-extrabold text-[#17334f]">
          اختر الإشعار
        </label>
        <select
          id="template-picker"
          value={selectedKey}
          onChange={(event) => setSelectedKey(event.target.value as NotificationTemplateKey)}
          className="h-11 w-full rounded-xl border border-[#cfe0f2] bg-white px-3 text-sm font-bold text-[#17334f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9]"
        >
          {audienceGroups.map((group) => (
            <optgroup key={group.audience} label={group.label}>
              {NOTIFICATION_TEMPLATES.filter((item) => item.audience === group.audience).map((item) => (
                <option key={item.key} value={item.key}>
                  {item.labelAr}
                  {overrides.has(item.key) ? " • معدّل" : ""}
                  {drafts[item.key] ? " • غير محفوظ" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <nav aria-label="قائمة الإشعارات التلقائية" className="hidden self-start rounded-2xl border border-[#e3edf8] bg-white p-3 shadow-[0_10px_30px_rgba(16,42,67,.05)] lg:sticky lg:top-4 lg:block">
        {audienceGroups.map((group) => (
          <div key={group.audience} className="mb-3 last:mb-0">
            <p className="mb-1.5 flex items-center gap-2 px-2 text-xs font-extrabold text-[#5d7086]">
              <group.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {group.label}
            </p>
            <ul className="space-y-1">
              {NOTIFICATION_TEMPLATES.filter((item) => item.audience === group.audience).map((item) => {
                const active = item.key === selectedKey;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => setSelectedKey(item.key)}
                      aria-current={active ? "true" : undefined}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-right text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] ${active ? "bg-[#eaf3ff] text-[#0878f9]" : "text-[#3e556d] hover:bg-[#f5f9ff]"}`}
                    >
                      <span className="min-w-0 truncate">{item.labelAr}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {drafts[item.key] ? <span className="rounded-full bg-[#fff1d6] px-2 py-0.5 text-[10px] font-extrabold text-[#8a5200]">غير محفوظ</span> : null}
                        {overrides.has(item.key) ? <span className="rounded-full bg-[#e5f6ee] px-2 py-0.5 text-[10px] font-extrabold text-[#0b6b47]">معدّل</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <section aria-labelledby="template-editor-title" className="min-w-0 rounded-2xl border border-[#e3edf8] bg-white p-4 shadow-[0_10px_30px_rgba(16,42,67,.05)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#edf3fa] pb-4">
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-[#0878f9]">{template.audience === "customer" ? "يصل إلى العميل" : "يصل إلى المعقب أو الموظف"}</p>
            <h2 id="template-editor-title" className="font-display mt-1 text-xl font-black text-[#102a43]">{template.labelAr}</h2>
            <p className="mt-1 text-sm leading-6 text-[#60778f]">{template.whenAr}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${saved ? "bg-[#e5f6ee] text-[#0b6b47]" : "bg-[#f1f5fa] text-[#5d7086]"}`}>
            {saved ? "نص معدّل" : "النص الافتراضي"}
          </span>
        </div>

        {overridesQuery.isError ? (
          <p role="alert" className="mt-4 rounded-xl bg-[#fff1f1] p-3 text-sm font-bold text-[#a1262c]">
            تعذر تحميل النصوص المحفوظة. يعرض المحرر النص الافتراضي حاليًا.
          </p>
        ) : null}

        <div className="mt-4">
          <p className="text-sm font-extrabold text-[#17334f]">المتغيرات المتاحة</p>
          {template.variables.length ? (
            <>
              <p className="mt-1 text-xs leading-5 text-[#60778f]">اضغط على متغير لإدراجه في موضع المؤشر داخل آخر حقل استخدمته. يُستبدل تلقائيًا بالقيمة الفعلية عند الإرسال.</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {template.variables.map((variable) => (
                  <li key={variable.name}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertVariable(variable.name)}
                      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#cfe3f8] bg-[#f5faff] px-3 py-1 text-xs font-bold text-[#17334f] transition-colors hover:bg-[#eaf3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9]"
                      aria-label={`إدراج المتغير ${variable.labelAr}`}
                    >
                      <code dir="ltr" className="font-mono text-[#0878f9]">{`{${variable.name}}`}</code>
                      <span>{variable.labelAr}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-1 text-xs leading-5 text-[#60778f]">هذا الإشعار لا يستخدم متغيرات؛ يُرسل النص كما هو.</p>
          )}
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {fieldOrder.map((field) => {
            const meta = fieldMeta[field];
            const fieldIssues = issues.filter((issue) => issue.field === field);
            const id = `template-${field}`;
            const errorId = `${id}-error`;
            const common = {
              id,
              value: draft[field],
              dir: meta.lang === "en" ? "ltr" : "rtl",
              lang: meta.lang,
              "aria-invalid": fieldIssues.length ? true : undefined,
              "aria-describedby": fieldIssues.length ? errorId : `${id}-count`,
              onFocus: () => setLastField(field),
              className: `rounded-xl border-[#cfe0f2] bg-white text-[#17334f] ${fieldIssues.length ? "border-[#d64545] focus-visible:ring-[#d64545]" : ""}`,
            } as const;
            return (
              <div key={field} className={meta.multiline ? "xl:row-span-1" : ""}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label htmlFor={id} className="text-sm font-extrabold text-[#17334f]" dir={meta.lang === "en" ? "ltr" : "rtl"}>
                    {meta.label}
                  </label>
                  <span id={`${id}-count`} className={`text-[11px] font-bold ${draft[field].trim().length > meta.max ? "text-[#c03535]" : "text-[#8193a6]"}`} dir="ltr">
                    {draft[field].trim().length}/{meta.max}
                  </span>
                </div>
                {meta.multiline ? (
                  <Textarea
                    {...common}
                    ref={(element) => {
                      fieldRefs.current[field] = element;
                    }}
                    rows={3}
                    onChange={(event) => updateField(field, event.target.value)}
                  />
                ) : (
                  <Input
                    {...common}
                    ref={(element) => {
                      fieldRefs.current[field] = element;
                    }}
                    onChange={(event) => updateField(field, event.target.value)}
                  />
                )}
                {fieldIssues.length ? (
                  <ul id={errorId} className="mt-1.5 space-y-0.5 text-xs font-bold text-[#b42318]">
                    {fieldIssues.map((issue, index) => (
                      <li key={`${issue.code}-${issue.variable ?? index}`} dir={meta.lang === "en" ? "ltr" : "rtl"}>
                        {describeTemplateIssue(issue, meta.lang === "en")}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <p className="text-sm font-extrabold text-[#17334f]">معاينة بقيم تجريبية</p>
          <div className="mt-2 grid gap-3 rounded-2xl bg-[#f5f9ff] p-3 md:grid-cols-2" aria-live="polite">
            <PreviewCard title={preview.titleAr} message={preview.messageAr} lang="ar" />
            <PreviewCard title={preview.titleEn} message={preview.messageEn} lang="en" />
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-[#edf3fa] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[#60778f]">التعديل يسري على الإشعارات الجديدة داخل الموقع فقط، ولا يعيد كتابة الإشعارات السابقة ولا يرسل رسائل جوال.</p>
          <div className="flex flex-wrap gap-2">
            {saved ? (
              <Button type="button" variant="outline" disabled={isBusy} onClick={() => setConfirmReset(true)} className="rounded-xl border-[#f0c9c9] bg-white text-[#a1262c] hover:bg-[#fff4f4]">
                <RotateCcw className="ml-2 h-4 w-4" aria-hidden="true" />
                استعادة الافتراضي
              </Button>
            ) : null}
            {isDirty ? (
              <Button type="button" variant="outline" disabled={isBusy} onClick={discard} className="rounded-xl border-[#cfe0f2] bg-white text-[#3e556d]">
                <Undo2 className="ml-2 h-4 w-4" aria-hidden="true" />
                تجاهل التعديلات
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={!isDirty || issues.length > 0 || isBusy}
              onClick={() => save.mutate({ key: selectedKey, ...draft })}
              className="rounded-xl bg-[#0878f9] font-extrabold text-white hover:bg-[#0668d9]"
            >
              {save.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="ml-2 h-4 w-4" aria-hidden="true" />}
              حفظ النص
            </Button>
          </div>
        </div>
      </section>

      <AlertDialog open={confirmReset} onOpenChange={(open) => !reset.isPending && setConfirmReset(open)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader className="text-right sm:text-right">
            <AlertDialogTitle>استعادة النص الافتراضي؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيُحذف النص المعدّل لإشعار «{template.labelAr}» باللغتين، وتعود الإشعارات الجديدة لاستخدام النص الأصلي. الإشعارات المرسلة سابقًا لن تتغير.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start">
            <AlertDialogAction
              disabled={reset.isPending}
              onClick={(event) => {
                event.preventDefault();
                reset.mutate({ key: selectedKey });
              }}
              className="bg-[#c03535] text-white hover:bg-[#a42b2b]"
            >
              {reset.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              استعادة الافتراضي
            </AlertDialogAction>
            <AlertDialogCancel disabled={reset.isPending}>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
