import ExcelJS from "exceljs";
import {
  filterApplications,
  looksLikePhoneQuery,
  type ApplicationStatusFilter,
} from "../shared/phoneSearch";

/** Owner-visible application fields (same shape as `toPublicAgentApplication`). */
export type ExportableApplication = {
  id: number;
  reference: string;
  phone: string;
  fullName: string;
  email: string;
  city: string;
  specialty: string;
  experienceYears: number;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  createdAt: number;
  reviewedAt: number | null;
};

export type ExportLanguage = "ar" | "en";

export const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const DEFAULT_EXPORT_TIME_ZONE = "Asia/Riyadh";
/** Generous ceiling that keeps a single export bounded in memory. */
export const MAX_EXPORT_ROWS = 5000;

const PRIMARY = "0668D9";
const INK = "102A43";
const MUTED = "60778F";
const BORDER = "D6E2EE";
const ZEBRA = "F8FBFF";
const STATUS_STYLE = {
  pending: { fill: "FFF3E0", font: "8A5A00" },
  approved: { fill: "E8F5E9", font: "287333" },
  rejected: { fill: "FDE7EA", font: "A63240" },
} as const;
const FONT = "Arial"; // Ships everywhere and renders Arabic and Latin cleanly.

const COPY = {
  ar: {
    sheet: "طلبات الانضمام",
    title: "طلبات انضمام المعقبين",
    brand: "معاملاتي كير",
    search: "البحث",
    noSearch: "بدون بحث",
    phoneSearch: "رقم جوال",
    nameSearch: "اسم",
    status: "الحالة",
    allStatuses: "كل الحالات",
    count: (n: number) => (n === 1 ? "طلب واحد" : n === 2 ? "طلبان" : `${n} طلبات`),
    generated: "تاريخ التصدير",
    summary: (p: number, a: number, r: number) =>
      `قيد المراجعة: ${p} · مقبول: ${a} · مرفوض: ${r}`,
    empty: "لا توجد طلبات مطابقة لهذا البحث.",
    truncated: (n: number) => `عُرض أول ${n} طلب فقط؛ ضيّق البحث لتصدير الباقي.`,
    privacy: "يحتوي هذا الملف على بيانات شخصية؛ احفظه وشاركه مع المخولين فقط.",
    statuses: { pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" },
    columns: [
      "الرقم المرجعي",
      "الاسم الكامل",
      "رقم الجوال",
      "البريد الإلكتروني",
      "المدينة",
      "التخصص",
      "سنوات الخبرة",
      "الحالة",
      "تاريخ التقديم",
      "تاريخ المراجعة",
      "ملاحظة المراجعة",
      "ملاحظات المتقدم",
    ],
  },
  en: {
    sheet: "Join applications",
    title: "Agent join applications",
    brand: "Maalamati Care",
    search: "Search",
    noSearch: "No search",
    phoneSearch: "mobile number",
    nameSearch: "name",
    status: "Status",
    allStatuses: "All statuses",
    count: (n: number) => `${n} ${n === 1 ? "application" : "applications"}`,
    generated: "Exported",
    summary: (p: number, a: number, r: number) =>
      `Pending: ${p} · Approved: ${a} · Rejected: ${r}`,
    empty: "No applications match this search.",
    truncated: (n: number) => `Only the first ${n} applications are included; narrow the search to export the rest.`,
    privacy: "This file contains personal data; store and share it with authorized staff only.",
    statuses: { pending: "Pending", approved: "Approved", rejected: "Rejected" },
    columns: [
      "Reference",
      "Full name",
      "Mobile",
      "Email",
      "City",
      "Specialty",
      "Experience (years)",
      "Status",
      "Submitted",
      "Reviewed",
      "Review note",
      "Applicant notes",
    ],
  },
} as const;

type ColumnKind = "short" | "text" | "long" | "number" | "date" | "status";
const COLUMNS: { width: number; kind: ColumnKind }[] = [
  { width: 14, kind: "short" },
  { width: 26, kind: "text" },
  { width: 16, kind: "short" },
  { width: 30, kind: "text" },
  { width: 16, kind: "short" },
  { width: 24, kind: "text" },
  { width: 14, kind: "number" },
  { width: 16, kind: "status" },
  { width: 19, kind: "date" },
  { width: 19, kind: "date" },
  { width: 36, kind: "long" },
  { width: 40, kind: "long" },
];
const FIRST_COL = 2; // Column A is a narrow margin.
const LAST_COL = FIRST_COL + COLUMNS.length - 1;
const HEADER_ROW = 7;

/** Removes characters that are invalid in XML (they would corrupt the .xlsx). */
export function cleanCellText(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFE\uFFFF]/g, "").trim();
}

export function resolveExportTimeZone(value?: string | null) {
  if (!value) return DEFAULT_EXPORT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return DEFAULT_EXPORT_TIME_ZONE;
  }
}

function wallClockParts(ms: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(ms))
      .map(part => [part.type, part.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/**
 * Excel dates carry no time zone. Encode the owner's local wall-clock time as a UTC
 * Date so the cell shows exactly what the dashboard shows.
 */
export function toExcelLocalDate(ms: number, timeZone: string) {
  const p = wallClockParts(ms, timeZone);
  return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second));
}

function formatStamp(ms: number, timeZone: string) {
  const p = wallClockParts(ms, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    display: `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`,
    file: `${p.year}${pad(p.month)}${pad(p.day)}-${pad(p.hour)}${pad(p.minute)}`,
  };
}

function estimatedLines(text: string, width: number) {
  if (!text) return 1;
  const perLine = Math.max(8, Math.floor(width * 1.1));
  return text
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / perLine)), 0);
}

export type AgentApplicationsExportInput = {
  applications: readonly ExportableApplication[];
  query: string;
  status: ApplicationStatusFilter;
  language: ExportLanguage;
  timeZone?: string | null;
  generatedAt: number;
};

export type AgentApplicationsExportResult = {
  fileName: string;
  buffer: Buffer;
  count: number;
  truncated: boolean;
  searchKind: "none" | "phone" | "name";
};

/** Builds the workbook for exactly the applications the owner currently sees. */
export async function buildAgentApplicationsExport(
  input: AgentApplicationsExportInput
): Promise<AgentApplicationsExportResult> {
  const copy = COPY[input.language];
  const isArabic = input.language === "ar";
  const timeZone = resolveExportTimeZone(input.timeZone);
  const query = cleanCellText(input.query).slice(0, 80);
  const searchKind: AgentApplicationsExportResult["searchKind"] = !query
    ? "none"
    : looksLikePhoneQuery(query)
      ? "phone"
      : "name";

  const matches = filterApplications(input.applications, query, input.status);
  const truncated = matches.length > MAX_EXPORT_ROWS;
  const rows = matches.slice(0, MAX_EXPORT_ROWS);
  const stamp = formatStamp(input.generatedAt, timeZone);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = copy.brand;
  workbook.created = new Date(input.generatedAt);
  workbook.title = copy.title;

  const sheet = workbook.addWorksheet(copy.sheet, {
    views: [
      {
        state: "frozen",
        ySplit: HEADER_ROW,
        xSplit: 0,
        topLeftCell: `A${HEADER_ROW + 1}`,
        rightToLeft: isArabic,
        showGridLines: false,
      },
    ],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
    },
    properties: { defaultRowHeight: 18 },
  });

  sheet.getColumn(1).width = 3;
  COLUMNS.forEach((column, index) => {
    sheet.getColumn(FIRST_COL + index).width = column.width;
  });

  const startAlign = isArabic ? "right" : "left";
  const readingOrder = isArabic ? "rtl" : "ltr";
  const lastLetter = sheet.getColumn(LAST_COL).letter;
  const firstLetter = sheet.getColumn(FIRST_COL).letter;

  const headline = (row: number, value: string, font: Partial<ExcelJS.Font>, height: number) => {
    sheet.mergeCells(`${firstLetter}${row}:${lastLetter}${row}`);
    const cell = sheet.getCell(`${firstLetter}${row}`);
    cell.value = value;
    cell.font = { name: FONT, ...font };
    cell.alignment = { horizontal: startAlign, vertical: "middle", readingOrder };
    sheet.getRow(row).height = height;
  };

  sheet.getRow(1).height = 10;
  headline(2, `${copy.title} — ${copy.brand}`, { size: 18, bold: true, color: { argb: `FF${INK}` } }, 34);
  const searchText = query
    ? `${copy.search}: ${query} (${searchKind === "phone" ? copy.phoneSearch : copy.nameSearch})`
    : `${copy.search}: ${copy.noSearch}`;
  const statusText = `${copy.status}: ${input.status === "all" ? copy.allStatuses : copy.statuses[input.status]}`;
  headline(3, `${searchText} · ${statusText} · ${copy.count(rows.length)}`, { size: 11, bold: true, color: { argb: `FF${PRIMARY}` } }, 22);
  headline(4, `${copy.generated}: ${stamp.display} (${timeZone})`, { size: 10, color: { argb: `FF${MUTED}` } }, 18);
  const tally = { pending: 0, approved: 0, rejected: 0 };
  rows.forEach(row => {
    tally[row.status] += 1;
  });
  headline(5, copy.summary(tally.pending, tally.approved, tally.rejected), { size: 10, color: { argb: `FF${MUTED}` } }, 18);

  const thin = { style: "thin" as const, color: { argb: `FF${BORDER}` } };
  const header = sheet.getRow(HEADER_ROW);
  header.height = 30;
  copy.columns.forEach((label, index) => {
    const cell = header.getCell(FIRST_COL + index);
    cell.value = label;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PRIMARY}` } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true, readingOrder };
    cell.border = {
      top: thin,
      bottom: { style: "medium", color: { argb: `FF${INK}` } },
      left: index === 0 ? thin : undefined,
      right: index === COLUMNS.length - 1 ? thin : undefined,
    };
  });

  rows.forEach((application, rowIndex) => {
    const rowNumber = HEADER_ROW + 1 + rowIndex;
    const values: (string | number | Date | null)[] = [
      application.reference,
      cleanCellText(application.fullName),
      cleanCellText(application.phone),
      cleanCellText(application.email),
      cleanCellText(application.city),
      cleanCellText(application.specialty),
      application.experienceYears,
      copy.statuses[application.status],
      toExcelLocalDate(application.createdAt, timeZone),
      application.reviewedAt === null ? null : toExcelLocalDate(application.reviewedAt, timeZone),
      cleanCellText(application.reviewNote),
      cleanCellText(application.notes),
    ];
    const row = sheet.getRow(rowNumber);
    let lines = 1;
    values.forEach((value, index) => {
      const column = COLUMNS[index];
      const cell = row.getCell(FIRST_COL + index);
      cell.value = value === "" ? null : value;
      cell.font = { name: FONT, size: 11, color: { argb: `FF${INK}` } };
      const zebra = rowIndex % 2 === 1;
      if (zebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${ZEBRA}` } };
      cell.border = {
        top: thin,
        bottom: thin,
        left: index === 0 ? thin : undefined,
        right: index === COLUMNS.length - 1 ? thin : undefined,
      };
      switch (column.kind) {
        case "number":
          cell.numFmt = "#,##0";
          cell.alignment = { horizontal: "center", vertical: "middle" };
          break;
        case "date":
          cell.numFmt = "yyyy-mm-dd hh:mm";
          cell.alignment = { horizontal: "center", vertical: "middle" };
          break;
        case "status": {
          const style = STATUS_STYLE[application.status];
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${style.fill}` } };
          cell.font = { name: FONT, size: 11, bold: true, color: { argb: `FF${style.font}` } };
          cell.alignment = { horizontal: "center", vertical: "middle", readingOrder };
          break;
        }
        case "short":
          // Mobile numbers stay text so the leading zero is never lost.
          cell.numFmt = "@";
          cell.alignment = { horizontal: "center", vertical: "middle", readingOrder };
          break;
        case "long":
          cell.alignment = { horizontal: startAlign, vertical: "middle", wrapText: true, indent: 1, readingOrder };
          lines = Math.max(lines, estimatedLines(typeof value === "string" ? value : "", column.width));
          break;
        default:
          cell.alignment = { horizontal: startAlign, vertical: "middle", indent: 1, readingOrder };
      }
    });
    row.height = Math.min(120, Math.max(20, lines * 15 + 6));
  });

  const lastDataRow = HEADER_ROW + Math.max(rows.length, 0);
  if (rows.length > 0) {
    sheet.autoFilter = { from: { row: HEADER_ROW, column: FIRST_COL }, to: { row: lastDataRow, column: LAST_COL } };
  } else {
    headline(HEADER_ROW + 1, copy.empty, { size: 11, italic: true, color: { argb: `FF${MUTED}` } }, 24);
  }

  let noteRow = Math.max(lastDataRow, HEADER_ROW + 1) + 2;
  if (truncated) {
    headline(noteRow, copy.truncated(MAX_EXPORT_ROWS), { size: 10, bold: true, color: { argb: "FFA63240" } }, 18);
    noteRow += 1;
  }
  headline(noteRow, copy.privacy, { size: 9, italic: true, color: { argb: `FF${MUTED}` } }, 16);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    fileName: `maalamati-agent-applications-${stamp.file}.xlsx`,
    buffer,
    count: rows.length,
    truncated,
    searchKind,
  };
}
