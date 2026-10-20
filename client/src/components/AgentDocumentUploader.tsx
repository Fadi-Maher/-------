import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FileCheck2, Loader2, ShieldCheck, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";

type Kind = "national_id" | "work_license";
export function AgentDocumentUploader({
  verificationToken,
  onDocumentsChange,
  onBusyChange,
  disabled = false,
}: {
  verificationToken: string;
  onDocumentsChange: (ids: string[]) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const { isEnglish } = useLanguage();
  const fieldId = useId();
  const drafts = trpc.agentDocuments.drafts.useQuery({ verificationToken });
  const upload = trpc.agentDocuments.upload.useMutation();
  const remove = trpc.agentDocuments.removeDraft.useMutation();
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const workingRef = useRef(false);
  const documents = useMemo(() => drafts.data ?? [], [drafts.data]);
  const ids = useMemo(
    () => documents.map(document => document.id),
    [documents]
  );
  useEffect(() => {
    onDocumentsChange(ids);
  }, [ids, onDocumentsChange]);
  useEffect(() => {
    onBusyChange?.(working);
    return () => onBusyChange?.(false);
  }, [working, onBusyChange]);
  const busy = disabled || working || drafts.isLoading || drafts.isError;
  const title = (kind: Kind) =>
    kind === "national_id"
      ? isEnglish
        ? "National ID"
        : "الهوية الوطنية"
      : isEnglish
        ? "Work license"
        : "رخصة العمل";
  async function choose(file: File | undefined, kind: Kind) {
    if (!file || busy || workingRef.current) return;
    if (!consent) {
      setError(
        isEnglish
          ? "Agree to share the documents before uploading."
          : "وافق على مشاركة المستندات قبل الرفع."
      );
      return;
    }
    if (!file.size || file.size > 5 * 1024 * 1024) {
      setError(
        isEnglish
          ? "Choose a non-empty file up to 5 MB."
          : "اختر ملفًا غير فارغ بحد أقصى 5 ميجابايت."
      );
      return;
    }
    if (
      !["application/pdf", "image/png", "image/jpeg"].includes(file.type) ||
      !/\.(pdf|png|jpe?g)$/i.test(file.name)
    ) {
      setError(
        isEnglish
          ? "Only PDF, PNG and JPG files are allowed."
          : "المسموح ملفات PDF وPNG وJPG فقط."
      );
      return;
    }
    workingRef.current = true;
    setWorking(true);
    setError("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () =>
          reject(
            new Error(
              isEnglish ? "Could not read the file." : "تعذرت قراءة الملف."
            )
          );
        reader.onload = () =>
          resolve(String(reader.result).split(",")[1] ?? "");
        reader.readAsDataURL(file);
      });
      await upload.mutateAsync({
        verificationToken,
        kind,
        fileName: file.name,
        mimeType: file.type as "application/pdf" | "image/png" | "image/jpeg",
        base64,
        consent: true,
      });
      await drafts.refetch();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : isEnglish
            ? "Upload failed. Please try again."
            : "تعذر رفع الملف. حاول مجددًا."
      );
    } finally {
      workingRef.current = false;
      setWorking(false);
    }
  }
  async function removeFile(documentId: string) {
    if (busy || workingRef.current) return;
    workingRef.current = true;
    setWorking(true);
    setError("");
    try {
      await remove.mutateAsync({ verificationToken, documentId });
      await drafts.refetch();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : isEnglish
            ? "Could not remove the draft."
            : "تعذر إزالة المسودة."
      );
    } finally {
      workingRef.current = false;
      setWorking(false);
    }
  }
  return (
    <section
      className="min-w-0 rounded-2xl border border-[#d5e6f7] bg-[#f8fbff] p-3 sm:p-4"
      aria-labelledby={`${fieldId}-heading`}
      dir={isEnglish ? "ltr" : "rtl"}
    >
      <h3
        id={`${fieldId}-heading`}
        className="flex items-center gap-2 text-sm font-extrabold text-[#17334f]"
      >
        <ShieldCheck
          className="h-4 w-4 shrink-0 text-[#0668d9]"
          aria-hidden="true"
        />
        {isEnglish ? "Eligibility documents" : "مستندات الأهلية"}
      </h3>
      <p className="mt-2 rounded-xl border border-[#f0d693] bg-[#fff9e9] p-3 text-xs font-bold leading-6 text-[#785413]">
        {isEnglish
          ? "Demo verification: use sample documents only. Do not upload a real national ID until real mobile verification is connected."
          : "التحقق تجريبي: استخدم مستندات اختبار فقط. لا ترفع هوية حقيقية قبل ربط التحقق الفعلي من الجوال."}
      </p>
      <p className="mt-2 text-xs leading-6 text-[#536e88]">
        {isEnglish
          ? "PDF, PNG or JPG · 5 MB per file. Files are encrypted and attached on submission; only administration can download submitted files."
          : "PDF أو PNG أو JPG · 5 ميجابايت لكل ملف. تُشفّر الملفات وتُرفق عند إرسال الطلب، وتنزيل المستندات المرسلة للإدارة فقط."}
      </p>
      <div className="mt-3 flex items-start gap-2">
        <Checkbox
          id={`${fieldId}-consent`}
          checked={consent}
          disabled={working || disabled}
          onCheckedChange={value => {
            setConsent(value === true);
            setError("");
          }}
          className="mt-1 h-5 w-5"
        />
        <Label
          htmlFor={`${fieldId}-consent`}
          className="cursor-pointer text-xs font-bold leading-6 text-[#17334f]"
        >
          {isEnglish
            ? "I agree to store and share these documents with administration for review."
            : "أوافق على حفظ هذه المستندات ومشاركتها مع الإدارة للمراجعة."}
        </Label>
      </div>
      <div className="mt-3 grid gap-3">
        {(["national_id", "work_license"] as const).map(kind => {
          const document = documents.find(item => item.kind === kind);
          return (
            <div
              key={kind}
              className="min-w-0 rounded-xl border border-[#dce8f6] bg-white p-3"
            >
              <Label
                htmlFor={`${fieldId}-${kind}`}
                className="block text-xs font-extrabold text-[#17334f]"
              >
                {title(kind)}
              </Label>
              {document ? (
                <div className="mt-2 flex min-w-0 items-start gap-2">
                  <FileCheck2
                    className="mt-1 h-4 w-4 shrink-0 text-[#27763c]"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="break-all text-xs leading-6 text-[#536e88]"
                      dir="ltr"
                    >
                      {document.fileName}
                    </p>
                    <p className="text-[11px] leading-5 text-[#536e88]">
                      {isEnglish ? "Ready to attach" : "جاهز للإرفاق"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-11 w-11 shrink-0 text-[#a9323e]"
                    disabled={busy}
                    onClick={() => void removeFile(document.id)}
                    aria-label={`${isEnglish ? "Remove" : "إزالة"} ${title(kind)}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <input
                  id={`${fieldId}-${kind}`}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  disabled={busy || !consent}
                  onChange={event => {
                    void choose(event.target.files?.[0], kind);
                    event.target.value = "";
                  }}
                  className="mt-2 block min-h-11 w-full min-w-0 text-xs text-[#536e88] file:me-2 file:rounded-lg file:border-0 file:bg-[#eaf3ff] file:px-3 file:py-2 file:font-bold file:text-[#075aa8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] disabled:opacity-50"
                />
              )}
            </div>
          );
        })}
      </div>
      {drafts.isError ? (
        <div
          role="alert"
          className="mt-3 text-xs font-bold leading-6 text-[#a9323e]"
        >
          {isEnglish
            ? "Could not load document drafts. Verify your mobile again if the session expired."
            : "تعذر تحميل مسودات المستندات. أعد التحقق من الجوال إذا انتهت الجلسة."}
          <Button
            type="button"
            variant="ghost"
            onClick={() => void drafts.refetch()}
            className="min-h-11 text-[#075aa8]"
          >
            {isEnglish ? "Retry" : "إعادة المحاولة"}
          </Button>
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-[#fff2f4] p-3 text-xs font-bold leading-6 text-[#a9323e]"
        >
          {error}
        </p>
      ) : null}
      {working ? (
        <p
          role="status"
          className="mt-3 flex items-center gap-2 text-xs font-bold text-[#075aa8]"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {isEnglish ? "Processing document…" : "جارٍ معالجة المستند…"}
        </p>
      ) : null}
    </section>
  );
}
