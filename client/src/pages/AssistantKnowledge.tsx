import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Bot, BookOpenText, Check, Plus, Save, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type EditableFaq = {
  id: number;
  questionAr: string;
  answerAr: string;
  questionEn: string;
  answerEn: string;
  isActive: boolean;
  sortOrder: number;
};

const emptyFaq = {
  questionAr: "",
  answerAr: "",
  questionEn: "",
  answerEn: "",
  isActive: true,
};

export default function AssistantKnowledge() {
  const utils = trpc.useUtils();
  const faqs = trpc.assistant.knowledge.list.useQuery();
  const [items, setItems] = useState<EditableFaq[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(emptyFaq);

  useEffect(() => {
    if (!faqs.data) return;
    setItems(faqs.data.map(item => ({
      id: item.id,
      questionAr: item.questionAr,
      answerAr: item.answerAr,
      questionEn: item.questionEn || "",
      answerEn: item.answerEn || "",
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    })));
  }, [faqs.data]);

  const refresh = async () => utils.assistant.knowledge.list.invalidate();
  const createFaq = trpc.assistant.knowledge.create.useMutation({
    onSuccess: async () => {
      setDraft(emptyFaq);
      await refresh();
      toast.success("تمت إضافة السؤال إلى معرفة المساعد.");
    },
    onError: error => toast.error(error.message || "تعذرت إضافة السؤال."),
  });
  const updateFaq = trpc.assistant.knowledge.update.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("تم حفظ السؤال والإجابة.");
    },
    onError: error => toast.error(error.message || "تعذر حفظ السؤال."),
  });
  const deleteFaq = trpc.assistant.knowledge.delete.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("تم حذف السؤال من قاعدة المعرفة.");
    },
    onError: error => toast.error(error.message || "تعذر حذف السؤال."),
  });

  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("ar");
    if (!term) return items;
    return items.filter(item => [item.questionAr, item.answerAr, item.questionEn, item.answerEn]
      .some(value => value.toLocaleLowerCase("ar").includes(term)));
  }, [items, search]);

  const patchItem = (id: number, patch: Partial<EditableFaq>) => {
    setItems(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const validatePair = (questionAr: string, answerAr: string, questionEn: string, answerEn: string) => {
    if (questionAr.trim().length < 2 || answerAr.trim().length < 2) {
      toast.error("أدخل السؤال والإجابة بالعربية.");
      return false;
    }
    if (Boolean(questionEn.trim()) !== Boolean(answerEn.trim())) {
      toast.error("أدخل السؤال والإجابة بالإنجليزية معًا أو اتركهما فارغين.");
      return false;
    }
    return true;
  };

  const handleCreate = () => {
    if (!validatePair(draft.questionAr, draft.answerAr, draft.questionEn, draft.answerEn)) return;
    createFaq.mutate({
      questionAr: draft.questionAr.trim(),
      answerAr: draft.answerAr.trim(),
      questionEn: draft.questionEn.trim() || null,
      answerEn: draft.answerEn.trim() || null,
      isActive: draft.isActive,
      sortOrder: items.length,
    });
  };

  const handleSave = (item: EditableFaq) => {
    if (!validatePair(item.questionAr, item.answerAr, item.questionEn, item.answerEn)) return;
    updateFaq.mutate({
      id: item.id,
      questionAr: item.questionAr.trim(),
      answerAr: item.answerAr.trim(),
      questionEn: item.questionEn.trim() || null,
      answerEn: item.answerEn.trim() || null,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    });
  };

  return (
    <DashboardLayout>
      <section className="mx-auto max-w-6xl" dir="rtl">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="section-kicker">المساعد الذكي</p>
            <h1 className="font-display mt-4 text-3xl font-extrabold tracking-[-0.06em] text-[#102a43] sm:text-4xl">قاعدة الأسئلة والأجوبة</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#60778f]">أضف إجابات معتمدة ليستخدمها مساعد معاملاتي كير عند الرد. لا تضع بيانات عملاء أو أرقام طلبات أو معلومات سرية داخل قاعدة المعرفة.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-[#cfe3f8] bg-white px-4 py-3 text-sm font-bold text-[#31516e]">
            <Check className="h-5 w-5 text-[#19a961]" />
            <span>{items.filter(item => item.isActive).length} إجابة نشطة</span>
          </div>
        </div>

        <article className="mt-8 rounded-3xl border border-[#dce8f6] bg-white p-5 shadow-[0_10px_28px_rgba(25,93,164,.07)] sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0878f9]"><Plus className="h-5 w-5" /></span>
            <div><h2 className="font-display text-xl font-extrabold text-[#102a43]">إضافة سؤال جديد</h2><p className="mt-1 text-sm leading-7 text-[#60778f]">العربية مطلوبة، والترجمة الإنجليزية اختيارية لكنها تُدخل كسؤال وإجابة معًا.</p></div>
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <FaqLanguageFields language="العربية" direction="rtl" question={draft.questionAr} answer={draft.answerAr} onQuestion={questionAr => setDraft(current => ({ ...current, questionAr }))} onAnswer={answerAr => setDraft(current => ({ ...current, answerAr }))} />
            <FaqLanguageFields language="English — اختياري" direction="ltr" question={draft.questionEn} answer={draft.answerEn} onQuestion={questionEn => setDraft(current => ({ ...current, questionEn }))} onAnswer={answerEn => setDraft(current => ({ ...current, answerEn }))} />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#e7eff8] pt-5">
            <label className="flex items-center gap-2 text-sm font-bold text-[#405d78]"><Switch checked={draft.isActive} onCheckedChange={isActive => setDraft(current => ({ ...current, isActive }))} />نشط للمساعد</label>
            <Button type="button" onClick={handleCreate} disabled={createFaq.isPending} className="rounded-xl bg-[#0878f9] px-5 text-white hover:bg-[#0668d9]"><Plus className="ml-2 h-4 w-4" />{createFaq.isPending ? "تتم الإضافة…" : "إضافة السؤال"}</Button>
          </div>
        </article>

        <div className="mt-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><h2 className="font-display text-2xl font-extrabold text-[#102a43]">المعرفة الحالية</h2><p className="mt-1 text-sm text-[#60778f]">يمكنك تعطيل أي إجابة مؤقتًا من دون حذفها.</p></div>
          <label className="relative block w-full sm:max-w-sm"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b91a8]" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث في الأسئلة والأجوبة" className="h-11 rounded-xl border-[#c8daec] bg-white pr-10" /></label>
        </div>

        {faqs.isLoading ? <p className="py-16 text-center text-sm text-[#60778f]">يتم تحميل قاعدة المعرفة…</p> : null}
        {faqs.isError ? <div className="mt-6 rounded-2xl border border-[#ffd1d5] bg-[#fff4f5] p-5 text-sm text-[#a9323f]">تحتاج هذه الصفحة إلى دخول المالك وصلاحية الإدارة.</div> : null}
        {!faqs.isLoading && !faqs.isError && filteredItems.length === 0 ? (
          <div className="mt-6 grid min-h-48 place-items-center rounded-3xl border border-dashed border-[#b7dbff] bg-white p-6 text-center"><div><BookOpenText className="mx-auto h-9 w-9 text-[#0878f9]" /><p className="font-display mt-4 font-extrabold text-[#31516e]">{items.length ? "لا توجد نتائج مطابقة." : "قاعدة المعرفة فارغة الآن."}</p><p className="mt-2 text-sm text-[#7b91a8]">أضف أول سؤال مع إجابة معتمدة ليستخدمها المساعد.</p></div></div>
        ) : null}

        <div className="mt-6 space-y-5">
          {filteredItems.map(item => (
            <article key={item.id} className={`rounded-3xl border bg-white p-5 shadow-[0_8px_24px_rgba(25,93,164,.06)] sm:p-6 ${item.isActive ? "border-[#dce8f6]" : "border-[#e2e7ed] opacity-80"}`}>
              <div className="flex flex-col justify-between gap-4 border-b border-[#e7eff8] pb-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f0f6ff] text-[#0878f9]"><Bot className="h-5 w-5" /></span><div><p className="text-sm font-extrabold text-[#17334f]">سؤال رقم {item.id}</p><p className="text-xs text-[#7b91a8]">ترتيب الظهور: {item.sortOrder + 1}</p></div></div>
                <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-xs font-bold text-[#405d78]"><Switch checked={item.isActive} onCheckedChange={isActive => patchItem(item.id, { isActive })} />{item.isActive ? "نشط" : "متوقف"}</label><Input type="number" min={1} max={10001} value={item.sortOrder + 1} onChange={event => patchItem(item.id, { sortOrder: Math.max(0, Number(event.target.value || 1) - 1) })} aria-label="ترتيب السؤال" className="h-9 w-20 rounded-xl border-[#c8daec] text-center" /></div>
              </div>
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <FaqLanguageFields language="العربية" direction="rtl" question={item.questionAr} answer={item.answerAr} onQuestion={questionAr => patchItem(item.id, { questionAr })} onAnswer={answerAr => patchItem(item.id, { answerAr })} />
                <FaqLanguageFields language="English — اختياري" direction="ltr" question={item.questionEn} answer={item.answerEn} onQuestion={questionEn => patchItem(item.id, { questionEn })} onAnswer={answerEn => patchItem(item.id, { answerEn })} />
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-[#e7eff8] pt-5">
                <Button type="button" variant="outline" onClick={() => { if (window.confirm("هل تريد حذف هذا السؤال نهائيًا؟")) deleteFaq.mutate({ id: item.id }); }} disabled={deleteFaq.isPending} className="rounded-xl border-[#f3c8cd] text-[#b33b47] hover:bg-[#fff3f4]"><Trash2 className="ml-2 h-4 w-4" />حذف</Button>
                <Button type="button" onClick={() => handleSave(item)} disabled={updateFaq.isPending} className="rounded-xl bg-[#0878f9] text-white hover:bg-[#0668d9]"><Save className="ml-2 h-4 w-4" />حفظ التعديلات</Button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </DashboardLayout>
  );
}

function FaqLanguageFields({ language, direction, question, answer, onQuestion, onAnswer }: { language: string; direction: "rtl" | "ltr"; question: string; answer: string; onQuestion: (value: string) => void; onAnswer: (value: string) => void }) {
  return <fieldset dir={direction} className="rounded-2xl border border-[#e1edf8] bg-[#f7fbff] p-4"><legend className="px-2 text-xs font-extrabold text-[#0878f9]">{language}</legend><label className="block text-xs font-bold text-[#405d78]">السؤال / Question<Input value={question} onChange={event => onQuestion(event.target.value)} maxLength={500} className="mt-2 h-10 rounded-xl border-[#c8daec] bg-white" /></label><label className="mt-4 block text-xs font-bold text-[#405d78]">الإجابة / Answer<Textarea value={answer} onChange={event => onAnswer(event.target.value)} maxLength={4000} rows={5} className="mt-2 resize-y rounded-xl border-[#c8daec] bg-white leading-7" /></label></fieldset>;
}
