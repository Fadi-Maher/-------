import { AnnouncementBarView } from "@/components/AnnouncementBar";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  announcementFormToInput,
  announcementToForm,
  emptyAnnouncementForm,
  validateAnnouncementForm,
  type AnnouncementFormField,
  type AnnouncementFormState,
} from "@/lib/announcementForm";
import { formatLocalDateTime } from "@/lib/datetimeLocal";
import { trpc } from "@/lib/trpc";
import { ANNOUNCEMENT_TONES, getAnnouncementStatus, pickLiveAnnouncement, type AnnouncementStatus, type AnnouncementTone } from "@shared/announcements";
import { CalendarClock, Loader2, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const statusLabels: Record<AnnouncementStatus, { label: string; className: string }> = {
  live: { label: "ظاهر الآن", className: "bg-[#e5f6ee] text-[#0b6b47]" },
  scheduled: { label: "مجدول", className: "bg-[#eaf3ff] text-[#0a5bc0]" },
  ended: { label: "منتهٍ", className: "bg-[#f1f5fa] text-[#5d7086]" },
  paused: { label: "موقوف", className: "bg-[#fff1d6] text-[#8a5200]" },
};

const toneLabels: Record<AnnouncementTone, string> = { info: "معلومة", success: "بشرى / عرض", warning: "تنبيه مهم" };

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs font-bold text-[#b42318]">
      {message}
    </p>
  );
}

function AnnouncementEditor({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (open: boolean) => void; editing: (Parameters<typeof announcementToForm>[0] & { id: number }) | null }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<AnnouncementFormState>(() => emptyAnnouncementForm());
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? announcementToForm(editing) : emptyAnnouncementForm());
    setSubmitted(false);
  }, [open, editing]);

  const errors = useMemo(() => validateAnnouncementForm(form), [form]);
  const visibleErrors = submitted ? errors : {};
  const done = async (message: string) => {
    await utils.siteAnnouncements.invalidate();
    toast.success(message);
    onOpenChange(false);
  };
  const create = trpc.siteAnnouncements.create.useMutation({
    onSuccess: () => done("تم حفظ الإعلان."),
    onError: (error) => toast.error(error.message || "تعذر حفظ الإعلان."),
  });
  const update = trpc.siteAnnouncements.update.useMutation({
    onSuccess: () => done("تم تحديث الإعلان. سيظهر مجددًا لمن أغلقه سابقًا."),
    onError: (error) => toast.error(error.message || "تعذر تحديث الإعلان."),
  });
  const isPending = create.isPending || update.isPending;
  const set = <K extends AnnouncementFormField>(field: K, value: AnnouncementFormState[K]) => setForm((current) => ({ ...current, [field]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) {
      const first = Object.keys(errors)[0];
      document.getElementById(`announcement-${first}`)?.focus();
      return;
    }
    const payload = announcementFormToInput(form);
    if (editing) update.mutate({ id: editing.id, ...payload });
    else create.mutate(payload);
  };

  const previewContent = {
    messageAr: form.messageAr.trim(),
    messageEn: form.messageEn.trim(),
    linkUrl: form.linkUrl.trim() || null,
    linkLabelAr: form.linkLabelAr.trim() || null,
    linkLabelEn: form.linkLabelEn.trim() || null,
    tone: form.tone,
    dismissible: form.dismissible,
  };

  const inputProps = (field: AnnouncementFormField) => ({
    id: `announcement-${field}`,
    "aria-invalid": visibleErrors[field] ? true : undefined,
    "aria-describedby": visibleErrors[field] ? `announcement-${field}-error` : undefined,
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent dir="rtl" className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle>{editing ? "تعديل الإعلان" : "إعلان جديد"}</DialogTitle>
          <DialogDescription>يظهر الشريط أعلى صفحات الموقع العامة فقط، وليس في حسابات العملاء أو لوحات الإدارة.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="announcement-messageAr" className="mb-1.5 block text-sm font-extrabold text-[#17334f]">نص الإعلان بالعربية</label>
              <Textarea {...inputProps("messageAr")} dir="rtl" lang="ar" rows={3} value={form.messageAr} onChange={(event) => set("messageAr", event.target.value)} className="rounded-xl border-[#cfe0f2]" />
              <FieldError id="announcement-messageAr-error" message={visibleErrors.messageAr} />
            </div>
            <div dir="ltr">
              <label htmlFor="announcement-messageEn" className="mb-1.5 block text-sm font-extrabold text-[#17334f]">Announcement in English</label>
              <Textarea {...inputProps("messageEn")} dir="ltr" lang="en" rows={3} value={form.messageEn} onChange={(event) => set("messageEn", event.target.value)} className="rounded-xl border-[#cfe0f2]" />
              <FieldError id="announcement-messageEn-error" message={visibleErrors.messageEn} />
            </div>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-extrabold text-[#17334f]">نمط الشريط</legend>
            <div className="flex flex-wrap gap-2">
              {ANNOUNCEMENT_TONES.map((tone) => (
                <label key={tone} className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-bold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#0878f9] ${form.tone === tone ? "border-[#0878f9] bg-[#eaf3ff] text-[#0878f9]" : "border-[#dce8f6] bg-white text-[#3e556d]"}`}>
                  <input type="radio" name="announcement-tone" value={tone} checked={form.tone === tone} onChange={() => set("tone", tone)} className="sr-only" />
                  {toneLabels[tone]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="rounded-2xl border border-[#e3edf8] p-3">
            <p className="text-sm font-extrabold text-[#17334f]">رابط اختياري</p>
            <div className="mt-2">
              <label htmlFor="announcement-linkUrl" className="mb-1.5 block text-xs font-bold text-[#5d7086]">الرابط (صفحة داخلية مثل ‎/contact أو رابط https)</label>
              <Input {...inputProps("linkUrl")} dir="ltr" inputMode="url" placeholder="/contact" value={form.linkUrl} onChange={(event) => set("linkUrl", event.target.value)} className="rounded-xl border-[#cfe0f2]" />
              <FieldError id="announcement-linkUrl-error" message={visibleErrors.linkUrl} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="announcement-linkLabelAr" className="mb-1.5 block text-xs font-bold text-[#5d7086]">نص الزر بالعربية</label>
                <Input {...inputProps("linkLabelAr")} dir="rtl" placeholder="اعرف المزيد" disabled={!form.linkUrl.trim()} value={form.linkLabelAr} onChange={(event) => set("linkLabelAr", event.target.value)} className="rounded-xl border-[#cfe0f2]" />
                <FieldError id="announcement-linkLabelAr-error" message={visibleErrors.linkLabelAr} />
              </div>
              <div dir="ltr">
                <label htmlFor="announcement-linkLabelEn" className="mb-1.5 block text-xs font-bold text-[#5d7086]">Button text in English</label>
                <Input {...inputProps("linkLabelEn")} dir="ltr" placeholder="Learn more" disabled={!form.linkUrl.trim()} value={form.linkLabelEn} onChange={(event) => set("linkLabelEn", event.target.value)} className="rounded-xl border-[#cfe0f2]" />
                <FieldError id="announcement-linkLabelEn-error" message={visibleErrors.linkLabelEn} />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="announcement-startsAt" className="mb-1.5 block text-sm font-extrabold text-[#17334f]">يبدأ الظهور</label>
              <Input {...inputProps("startsAt")} type="datetime-local" dir="ltr" value={form.startsAt} onChange={(event) => set("startsAt", event.target.value)} className="rounded-xl border-[#cfe0f2]" />
              <FieldError id="announcement-startsAt-error" message={visibleErrors.startsAt} />
            </div>
            <div>
              <label htmlFor="announcement-endsAt" className="mb-1.5 block text-sm font-extrabold text-[#17334f]">ينتهي الظهور (اختياري)</label>
              <Input {...inputProps("endsAt")} type="datetime-local" dir="ltr" value={form.endsAt} onChange={(event) => set("endsAt", event.target.value)} className="rounded-xl border-[#cfe0f2]" />
              <FieldError id="announcement-endsAt-error" message={visibleErrors.endsAt} />
              {!visibleErrors.endsAt ? <p className="mt-1 text-[11px] text-[#8193a6]">اتركه فارغًا ليبقى الإعلان حتى إيقافه.</p> : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[#e3edf8] px-3 text-sm font-bold text-[#17334f]">
              <span>مفعّل</span>
              <Switch checked={form.isActive} onCheckedChange={(value) => set("isActive", value)} aria-label="تفعيل الإعلان" />
            </label>
            <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[#e3edf8] px-3 text-sm font-bold text-[#17334f]">
              <span>يسمح للزائر بإغلاقه</span>
              <Switch checked={form.dismissible} onCheckedChange={(value) => set("dismissible", value)} aria-label="السماح بإغلاق الإعلان" />
            </label>
          </div>

          <div>
            <p className="text-sm font-extrabold text-[#17334f]">معاينة الشريط</p>
            <div className="mt-2 space-y-2 rounded-2xl bg-[#f5f9ff] p-2">
              <AnnouncementBarView announcement={previewContent} isEnglish={false} preview />
              <AnnouncementBarView announcement={previewContent} isEnglish preview />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-start">
            <Button type="submit" disabled={isPending} className="rounded-xl bg-[#0878f9] font-extrabold text-white hover:bg-[#0668d9]">
              {isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {editing ? "حفظ التعديلات" : "حفظ الإعلان"}
            </Button>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)} className="rounded-xl border-[#cfe0f2] bg-white">
              إلغاء
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AnnouncementsPanel() {
  const utils = trpc.useUtils();
  const list = trpc.siteAnnouncements.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const [now, setNow] = useState(() => Date.now());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const items = list.data ?? [];
  const live = useMemo(() => pickLiveAnnouncement(items, now), [items, now]);
  const editing = editingId === null ? null : items.find((item) => item.id === editingId) ?? null;
  const deleting = deleteId === null ? null : items.find((item) => item.id === deleteId) ?? null;

  const setActive = trpc.siteAnnouncements.setActive.useMutation({
    onMutate: async ({ id, isActive }) => {
      await utils.siteAnnouncements.list.cancel();
      const previous = utils.siteAnnouncements.list.getData();
      utils.siteAnnouncements.list.setData(undefined, (current) => current?.map((item) => (item.id === id ? { ...item, isActive } : item)));
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) utils.siteAnnouncements.list.setData(undefined, context.previous);
      toast.error(error.message || "تعذر تغيير حالة الإعلان.");
    },
    onSuccess: (_result, variables) => toast.success(variables.isActive ? "تم تفعيل الإعلان." : "تم إيقاف الإعلان."),
    onSettled: () => utils.siteAnnouncements.invalidate(),
  });
  const remove = trpc.siteAnnouncements.delete.useMutation({
    onSuccess: async () => {
      await utils.siteAnnouncements.invalidate();
      setDeleteId(null);
      toast.success("تم حذف الإعلان.");
    },
    onError: (error) => toast.error(error.message || "تعذر حذف الإعلان."),
  });

  const openCreate = () => {
    setEditingId(null);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-5">
      <section aria-labelledby="live-announcement-title" className="rounded-2xl border border-[#e3edf8] bg-white p-4 shadow-[0_10px_30px_rgba(16,42,67,.05)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="live-announcement-title" className="font-display text-xl font-black text-[#102a43]">الشريط الظاهر الآن</h2>
            <p className="mt-1 text-sm leading-6 text-[#60778f]">يظهر إعلان واحد فقط في كل وقت. إذا تداخلت عدة إعلانات يُعرض الأحدث بدايةً.</p>
          </div>
          <Button type="button" onClick={openCreate} className="rounded-xl bg-[#0878f9] font-extrabold text-white hover:bg-[#0668d9]">
            <Plus className="ml-2 h-4 w-4" aria-hidden="true" />
            إعلان جديد
          </Button>
        </div>
        <div className="mt-4">
          {list.isLoading ? (
            <div className="h-12 animate-pulse rounded-xl bg-[#eef4fb]" aria-label="جاري التحميل" />
          ) : live ? (
            <div className="space-y-2 rounded-2xl bg-[#f5f9ff] p-2">
              <AnnouncementBarView announcement={live} isEnglish={false} preview />
              <AnnouncementBarView announcement={live} isEnglish preview />
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-[#cfe0f2] p-4 text-center text-sm font-bold text-[#5d7086]">لا يوجد إعلان ظاهر حاليًا في الموقع.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="announcements-list-title" className="rounded-2xl border border-[#e3edf8] bg-white p-4 shadow-[0_10px_30px_rgba(16,42,67,.05)] sm:p-6">
        <h2 id="announcements-list-title" className="font-display text-lg font-black text-[#102a43]">كل الإعلانات</h2>
        {list.isError ? (
          <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fff1f1] p-3 text-sm font-bold text-[#a1262c]">
            <span>تعذر تحميل الإعلانات.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => list.refetch()} className="rounded-lg bg-white">إعادة المحاولة</Button>
          </div>
        ) : null}
        {!list.isLoading && !list.isError && !items.length ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[#cfe0f2] p-6 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-[#9db4cc]" aria-hidden="true" />
            <p className="mt-2 text-sm font-bold text-[#3e556d]">لم تُنشأ إعلانات بعد.</p>
            <p className="mt-1 text-xs text-[#60778f]">أنشئ إعلانًا لعرض عرض أو تنبيه أو موعد مهم أعلى الموقع.</p>
          </div>
        ) : null}
        <ul className="mt-4 space-y-3">
          {items.map((item) => {
            const status = getAnnouncementStatus(item, now);
            const badge = statusLabels[status];
            return (
              <li key={item.id} className="rounded-2xl border border-[#e3edf8] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${badge.className}`}>{badge.label}</span>
                      <span className="rounded-full bg-[#f5f9ff] px-2.5 py-0.5 text-xs font-bold text-[#5d7086]">{toneLabels[item.tone]}</span>
                      {item.dismissible ? null : <span className="rounded-full bg-[#f5f9ff] px-2.5 py-0.5 text-xs font-bold text-[#5d7086]">لا يُغلق</span>}
                    </div>
                    <p className="mt-2 break-words text-sm font-bold text-[#17334f]">{item.messageAr}</p>
                    <p className="mt-1 break-words text-xs text-[#60778f]" dir="ltr" lang="en">{item.messageEn}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-[#5d7086]">
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>من {formatLocalDateTime(item.startsAt)}</span>
                      <span>{item.endsAt ? `إلى ${formatLocalDateTime(item.endsAt)}` : "دون تاريخ انتهاء"}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-[#3e556d]">
                      <Switch
                        checked={item.isActive}
                        disabled={setActive.isPending && setActive.variables?.id === item.id}
                        onCheckedChange={(value) => setActive.mutate({ id: item.id, isActive: value })}
                        aria-label={item.isActive ? "إيقاف الإعلان" : "تفعيل الإعلان"}
                      />
                      {item.isActive ? "مفعّل" : "موقوف"}
                    </label>
                    <Button type="button" variant="outline" size="icon" onClick={() => { setEditingId(item.id); setEditorOpen(true); }} aria-label="تعديل الإعلان" className="rounded-xl border-[#cfe0f2] bg-white">
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" onClick={() => setDeleteId(item.id)} aria-label="حذف الإعلان" className="rounded-xl border-[#f0c9c9] bg-white text-[#a1262c] hover:bg-[#fff4f4]">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <AnnouncementEditor open={editorOpen} onOpenChange={setEditorOpen} editing={editing} />

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !remove.isPending && !open && setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader className="text-right sm:text-right">
            <AlertDialogTitle>حذف الإعلان؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيختفي الإعلان من الموقع ولن يمكن استرجاعه{deleting ? `: «${deleting.messageAr.slice(0, 80)}»` : ""}. إذا أردت إخفاءه مؤقتًا استخدم الإيقاف بدل الحذف.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start">
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleteId !== null) remove.mutate({ id: deleteId });
              }}
              className="bg-[#c03535] text-white hover:bg-[#a42b2b]"
            >
              {remove.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              حذف نهائي
            </AlertDialogAction>
            <AlertDialogCancel disabled={remove.isPending}>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
