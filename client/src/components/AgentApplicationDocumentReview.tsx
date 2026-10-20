import { useRef, useState } from "react";
import { Download, FileCheck2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";

export function AgentApplicationDocumentReview({
  applicationId,
}: {
  applicationId: number;
}) {
  const { isEnglish } = useLanguage();
  const documents = trpc.agentDocuments.list.useQuery({ applicationId });
  const download = trpc.agentDocuments.download.useMutation();
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const workingRef = useRef(false);
  async function downloadFile(documentId: string) {
    if (workingRef.current) return;
    workingRef.current = true;
    setWorkingId(documentId);
    setError("");
    try {
      const result = await download.mutateAsync({ documentId });
      const binary = atob(result.base64);
      const bytes = Uint8Array.from(binary, character =>
        character.charCodeAt(0)
      );
      const url = URL.createObjectURL(
        new Blob([bytes], { type: result.mimeType })
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : isEnglish
            ? "Could not download the document. Please retry."
            : "تعذر تنزيل المستند. حاول مرة أخرى."
      );
    } finally {
      workingRef.current = false;
      setWorkingId(null);
    }
  }
  return (
    <section
      className="min-w-0 rounded-xl border border-[#dce8f6] bg-[#f8fbff] p-3"
      aria-label={isEnglish ? "Applicant documents" : "مستندات المتقدم"}
      dir={isEnglish ? "ltr" : "rtl"}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-xs font-extrabold text-[#17334f]">
          <ShieldCheck className="h-4 w-4 text-[#0668d9]" aria-hidden="true" />
          {isEnglish ? "Eligibility documents" : "مستندات الأهلية"}
        </h4>
        <Button
          type="button"
          variant="ghost"
          disabled={documents.isFetching}
          onClick={() => void documents.refetch()}
          className="min-h-11 text-xs text-[#075aa8]"
        >
          {isEnglish ? "Refresh documents" : "تحديث المستندات"}
        </Button>
      </div>
      <p className="text-[11px] leading-6 text-[#536e88]">
        {isEnglish
          ? "Encrypted storage · administration-only download. Review eligibility manually; demo OTP is not proof of identity. Files are not automatically scanned for malware."
          : "تخزين مشفر · تنزيل للإدارة فقط. تُراجع الأهلية يدويًا؛ الرمز التجريبي ليس إثبات هوية. لا يوجد فحص آلي للبرمجيات الضارة."}
      </p>
      {documents.isLoading ? (
        <p role="status" className="mt-2 text-xs text-[#536e88]">
          {isEnglish ? "Loading documents…" : "جارٍ تحميل المستندات…"}
        </p>
      ) : documents.isError ? (
        <p role="alert" className="mt-2 text-xs font-bold text-[#a9323e]">
          {isEnglish ? "Could not load documents." : "تعذر تحميل المستندات."}
        </p>
      ) : !documents.data?.length ? (
        <p className="mt-2 text-xs text-[#536e88]">
          {isEnglish ? "No documents attached." : "لم تُرفق مستندات."}
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {documents.data.map(document => (
            <li
              key={document.id}
              className="flex min-w-0 items-center gap-2 rounded-lg border border-[#e3eef9] bg-white p-2"
            >
              <FileCheck2
                className="h-4 w-4 shrink-0 text-[#27763c]"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#17334f]">
                  {document.kind === "national_id"
                    ? isEnglish
                      ? "National ID"
                      : "الهوية الوطنية"
                    : isEnglish
                      ? "Work license"
                      : "رخصة العمل"}
                </p>
                <p
                  dir="ltr"
                  className="break-all text-[11px] leading-5 text-[#536e88]"
                >
                  {document.fileName}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={workingId !== null}
                className="h-11 w-11 shrink-0 border-[#d5e6f7] text-[#075aa8]"
                onClick={() => void downloadFile(document.id)}
                aria-label={`${isEnglish ? "Download" : "تنزيل"} ${document.fileName}`}
              >
                {workingId === document.id ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Download className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-lg bg-[#fff2f4] p-2 text-xs font-bold leading-6 text-[#a9323e]"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
