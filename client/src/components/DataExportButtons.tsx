import { Button } from "@/components/ui/button";
import { buildCsv, downloadCsv, openPdfPrintWindow, type ExportColumn, type ExportRow } from "@/lib/dataExport";
import { Download, FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type DataExportButtonsProps = {
  columns: ExportColumn[];
  rows: ExportRow[];
  title: string;
  subtitle?: string;
  filename: string;
  direction?: "rtl" | "ltr";
  isEnglish?: boolean;
};

export function DataExportButtons({
  columns,
  rows,
  title,
  subtitle,
  filename,
  direction = "rtl",
  isEnglish = false,
}: DataExportButtonsProps) {
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);

  const exportCsv = () => {
    setBusy("csv");
    try {
      if (!rows.length) {
        toast.info(isEnglish ? "There is no data to export yet." : "لا توجد بيانات لتصديرها حاليًا.");
        return;
      }
      downloadCsv(filename, columns, rows);
      toast.success(isEnglish ? "CSV file downloaded." : "تم تنزيل ملف CSV.");
    } finally {
      setBusy(null);
    }
  };

  const exportPdf = () => {
    setBusy("pdf");
    try {
      if (!rows.length) {
        toast.info(isEnglish ? "There is no data to export yet." : "لا توجد بيانات لتصديرها حاليًا.");
        return;
      }
      openPdfPrintWindow({ filename, title, subtitle, columns, rows, direction });
      toast.success(isEnglish ? "The PDF print window is ready. Choose Save as PDF." : "تم تجهيز نافذة PDF؛ اختر «حفظ كملف PDF».");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : isEnglish ? "Could not prepare the PDF." : "تعذر تجهيز ملف PDF.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2" dir={direction}>
      <Button type="button" variant="outline" onClick={exportCsv} disabled={busy !== null || rows.length === 0} className="h-10 rounded-xl border-[#b7dbff] bg-white text-[#0878f9] hover:bg-[#f1f8ff]">
        {busy === "csv" ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Download className="ml-2 h-4 w-4" />}
        {isEnglish ? "Export CSV" : "تصدير CSV"}
      </Button>
      <Button type="button" variant="outline" onClick={exportPdf} disabled={busy !== null || rows.length === 0} className="h-10 rounded-xl border-[#cfd2fb] bg-white text-[#6250d8] hover:bg-[#f7f5ff]">
        {busy === "pdf" ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <FileDown className="ml-2 h-4 w-4" />}
        {isEnglish ? "Export PDF" : "تصدير PDF"}
      </Button>
      <span className="text-xs font-bold text-[#70859b]">{isEnglish ? `${rows.length} rows` : `${rows.length} سجل`}</span>
    </div>
  );
}

export function canExportRows(columns: ExportColumn[], rows: ExportRow[]) {
  return columns.length > 0 && rows.length > 0 && buildCsv(columns, rows).length > 0;
}
