import ExcelJS from "exceljs";
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  record: vi.fn(),
}));
vi.mock("./phoneLoginTicket", () => ({ verifyPhoneLoginTicket: vi.fn() }));
vi.mock("./adminApplicationNotifications", () => ({ publishApplicationNotification: vi.fn() }));
vi.mock("./agentApplicationsDb", () => ({
  getAgentApplicationStatus: vi.fn(),
  submitAgentApplication: vi.fn(),
  reviewAgentApplication: vi.fn(),
  listAgentApplications: mocks.list,
  recordAgentApplicationsExport: mocks.record,
  toPublicAgentApplication: (application: unknown) => application,
}));

import {
  buildAgentApplicationsExport,
  cleanCellText,
  resolveExportTimeZone,
  toExcelLocalDate,
  XLSX_MIME_TYPE,
  type ExportableApplication,
} from "./agentApplicationsExport";
import { agentApplicationsRouter } from "./agentApplicationsRouter";

// 2026-10-20 14:30 UTC = 17:30 in Riyadh (UTC+3, no DST).
const SUBMITTED = Date.UTC(2026, 9, 20, 14, 30);
const base: ExportableApplication = {
  id: 12,
  reference: "JOIN-12",
  phone: "0551234567",
  fullName: "سارة المعقبة",
  email: "sara@example.test",
  city: "الرياض",
  specialty: "الخدمات الحكومية",
  experienceYears: 6,
  notes: "متاحة\u0007 مساءً",
  status: "pending",
  reviewNote: null,
  createdAt: SUBMITTED,
  reviewedAt: null,
};
const applications: ExportableApplication[] = [
  base,
  { ...base, id: 13, reference: "JOIN-13", phone: "0567654321", fullName: "Huda Approved", status: "approved", reviewNote: "مكتمل", reviewedAt: SUBMITTED + 3_600_000 },
  { ...base, id: 14, reference: "JOIN-14", phone: "0509999999", fullName: "Omar Rejected", status: "rejected", reviewNote: "المستند غير واضح", reviewedAt: SUBMITTED + 7_200_000 },
];

async function readSheet(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook.worksheets[0];
}

describe("agent applications Excel export", () => {
  it("exports only the search matches, keeps the leading zero and writes Riyadh local times", async () => {
    const result = await buildAgentApplicationsExport({
      applications,
      query: "+966 55 123 4567",
      status: "all",
      language: "ar",
      timeZone: "Asia/Riyadh",
      generatedAt: SUBMITTED,
    });
    expect(result.count).toBe(1);
    expect(result.searchKind).toBe("phone");
    expect(result.fileName).toBe("maalamati-agent-applications-20261020-1730.xlsx");
    const sheet = await readSheet(result.buffer);
    expect(sheet.name).toBe("طلبات الانضمام");
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 7, rightToLeft: true, showGridLines: false });
    expect(sheet.getCell("B2").value).toBe("طلبات انضمام المعقبين — معاملاتي كير");
    expect(String(sheet.getCell("B3").value)).toContain("+966 55 123 4567 (رقم جوال)");
    expect(String(sheet.getCell("B3").value)).toContain("طلب واحد");
    expect(sheet.getCell("B4").value).toBe("تاريخ التصدير: 2026-10-20 17:30 (Asia/Riyadh)");
    expect(sheet.getRow(7).getCell(2).value).toBe("الرقم المرجعي");
    expect(sheet.getRow(7).getCell(4).value).toBe("رقم الجوال");
    const row = sheet.getRow(8);
    expect(row.getCell(2).value).toBe("JOIN-12");
    expect(row.getCell(4).value).toBe("0551234567");
    expect(row.getCell(8).value).toBe(6);
    expect(row.getCell(9).value).toBe("قيد المراجعة");
    const submitted = row.getCell(10).value as Date;
    expect(submitted.toISOString()).toBe("2026-10-20T17:30:00.000Z");
    expect(row.getCell(10).numFmt).toBe("yyyy-mm-dd hh:mm");
    // Control characters would corrupt the XML, so they are stripped.
    expect(row.getCell(13).value).toBe("متاحة مساءً");
    expect(sheet.getRow(9).getCell(2).value).toBeNull();
    expect(sheet.autoFilter).toBeTruthy();
  });

  it("applies the status tab together with a name search and labels English files", async () => {
    const result = await buildAgentApplicationsExport({
      applications,
      query: "omar",
      status: "rejected",
      language: "en",
      timeZone: "Asia/Riyadh",
      generatedAt: SUBMITTED,
    });
    expect(result.count).toBe(1);
    expect(result.searchKind).toBe("name");
    const sheet = await readSheet(result.buffer);
    expect(sheet.views[0]).toMatchObject({ rightToLeft: false });
    expect(String(sheet.getCell("B3").value)).toBe("Search: omar (name) · Status: Rejected · 1 application");
    expect(sheet.getCell("B5").value).toBe("Pending: 0 · Approved: 0 · Rejected: 1");
    expect(sheet.getRow(8).getCell(3).value).toBe("Omar Rejected");
    expect(sheet.getRow(8).getCell(9).value).toBe("Rejected");
    expect(sheet.getRow(8).getCell(12).value).toBe("المستند غير واضح");
  });

  it("writes an explicit empty-state row instead of a blank table", async () => {
    const result = await buildAgentApplicationsExport({
      applications,
      query: "0590000000",
      status: "all",
      language: "en",
      generatedAt: SUBMITTED,
    });
    expect(result.count).toBe(0);
    const sheet = await readSheet(result.buffer);
    expect(sheet.getCell("B8").value).toBe("No applications match this search.");
  });

  it("falls back to Riyadh for unknown time zones and converts wall-clock time", () => {
    expect(resolveExportTimeZone("Mars/Base")).toBe("Asia/Riyadh");
    expect(resolveExportTimeZone(undefined)).toBe("Asia/Riyadh");
    expect(resolveExportTimeZone("Europe/London")).toBe("Europe/London");
    expect(toExcelLocalDate(SUBMITTED, "UTC").toISOString()).toBe("2026-10-20T14:30:00.000Z");
    expect(cleanCellText(" a\u0000b\u001Fc ")).toBe("abc");
  });
});

function context(role: "admin" | "agent" | "employee" | "user" | null): TrpcContext {
  return {
    user: role
      ? {
          id: 91,
          role,
          openId: `export-${role}`,
          name: "مالك الاختبار",
          email: "owner@example.test",
          loginMethod: "test",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

describe("agentApplications.exportXlsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue(applications);
    mocks.record.mockResolvedValue(undefined);
  });

  it.each([null, "user", "agent", "employee"] as const)("rejects %s callers before reading any data", async role => {
    const caller = agentApplicationsRouter.createCaller(context(role));
    const promise = caller.exportXlsx({ query: "", status: "all", language: "ar" });
    await expect(promise).rejects.toBeInstanceOf(TRPCError);
    await expect(promise).rejects.toMatchObject({ code: role === null ? "UNAUTHORIZED" : "FORBIDDEN" });
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("returns a valid xlsx for the owner and audits the export without the searched number", async () => {
    const caller = agentApplicationsRouter.createCaller(context("admin"));
    const result = await caller.exportXlsx({ query: "0551", status: "pending", language: "ar", timeZone: "Asia/Riyadh" });
    expect(result.mimeType).toBe(XLSX_MIME_TYPE);
    expect(result.count).toBe(1);
    expect(result.truncated).toBe(false);
    expect(result.fileName).toMatch(/^maalamati-agent-applications-\d{8}-\d{4}\.xlsx$/);
    const bytes = Buffer.from(result.base64, "base64");
    expect(bytes.subarray(0, 2).toString()).toBe("PK"); // xlsx is a zip container
    const sheet = await readSheet(bytes);
    expect(sheet.getRow(8).getCell(4).value).toBe("0551234567");
    expect(mocks.record).toHaveBeenCalledWith({
      actorUserId: 91,
      actorName: "مالك الاختبار",
      count: 1,
      status: "pending",
      searchKind: "phone",
      language: "ar",
    });
    expect(JSON.stringify(mocks.record.mock.calls)).not.toContain("0551");
  });

  it("rejects oversized search text and unknown statuses", async () => {
    const caller = agentApplicationsRouter.createCaller(context("admin"));
    await expect(caller.exportXlsx({ query: "x".repeat(81), status: "all", language: "ar" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.exportXlsx({ query: "", status: "archived" as "all", language: "ar" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
