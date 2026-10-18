export type ExportValue = string | number | boolean | null | undefined;

export type ExportColumn = {
  key: string;
  label: string;
};

export type ExportRow = Record<string, ExportValue>;

function stringifyValue(value: ExportValue) {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function escapeCsvCell(value: ExportValue) {
  const text = stringifyValue(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(columns: ExportColumn[], rows: ExportRow[]) {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(",");
  const body = rows.map((row) => columns.map((column) => escapeCsvCell(row[column.key])).join(","));
  return `\uFEFF${[header, ...body].join("\r\n")}`;
}

function escapeHtml(value: ExportValue) {
  return stringifyValue(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildPrintableHtml({
  title,
  subtitle,
  columns,
  rows,
  direction = "rtl",
}: {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: ExportRow[];
  direction?: "rtl" | "ltr";
}) {
  const head = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
  const body = rows.length
    ? rows
        .map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column.key])}</td>`).join("")}</tr>`)
        .join("")
    : `<tr><td class="empty" colspan="${Math.max(columns.length, 1)}">لا توجد بيانات للتصدير.</td></tr>`;

  return `<!doctype html>
<html lang="${direction === "rtl" ? "ar" : "en"}" dir="${direction}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 landscape; margin: 14mm; }
    :root { color-scheme: light; font-family: Tahoma, Arial, sans-serif; }
    body { margin: 0; color: #102a43; background: #fff; font-size: 11px; }
    header { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; border-bottom: 2px solid #0878f9; padding-bottom: 12px; margin-bottom: 16px; }
    h1 { margin: 0; font-size: 22px; letter-spacing: -.03em; }
    p { margin: 6px 0 0; color: #60778f; line-height: 1.6; }
    .meta { color: #60778f; white-space: nowrap; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #c8daec; padding: 7px 8px; text-align: start; vertical-align: top; overflow-wrap: anywhere; }
    th { color: #fff; background: #0b4f9c; font-weight: 700; }
    tr:nth-child(even) td { background: #f7fbff; }
    .empty { text-align: center; color: #60778f; padding: 24px; }
    footer { margin-top: 14px; color: #7b91a8; font-size: 10px; text-align: center; }
  </style>
</head>
<body>
  <header><div><h1>${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}</div><div class="meta">${new Date().toLocaleString(direction === "rtl" ? "ar-SA" : "en-US")}</div></header>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  <footer>معاملاتي كير — ستريك إكسبريس</footer>
</body>
</html>`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(filename: string, columns: ExportColumn[], rows: ExportRow[]) {
  triggerDownload(new Blob([buildCsv(columns, rows)], { type: "text/csv;charset=utf-8" }), filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export function openPdfPrintWindow({
  filename,
  title,
  subtitle,
  columns,
  rows,
  direction = "rtl",
}: {
  filename: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: ExportRow[];
  direction?: "rtl" | "ltr";
}) {
  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (!printWindow) throw new Error("تعذر فتح نافذة PDF. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.");

  printWindow.document.open();
  printWindow.document.write(buildPrintableHtml({ title, subtitle, columns, rows, direction }));
  printWindow.document.close();
  printWindow.document.title = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  printWindow.focus();
  printWindow.addEventListener("afterprint", () => printWindow.close(), { once: true });
  window.setTimeout(() => printWindow.print(), 350);
}
