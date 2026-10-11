import { describe, expect, it } from "vitest";
import { buildCsv, buildPrintableHtml } from "./dataExport";

describe("data export helpers", () => {
  const columns = [
    { key: "reference", label: "المرجع" },
    { key: "details", label: "التفاصيل" },
  ];

  it("builds UTF-8 CSV with quoted commas, quotes, and line breaks", () => {
    const csv = buildCsv(columns, [{ reference: "SE-1", details: 'سطر، ثم "اقتباس"\nسطر ثانٍ' }]);
    expect(csv.startsWith("\uFEFF"), "CSV should include a UTF-8 BOM for Arabic spreadsheet compatibility").toBe(true);
    expect(csv).toContain('"سطر، ثم ""اقتباس""\nسطر ثانٍ"');
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("escapes printable HTML values and preserves the requested direction", () => {
    const html = buildPrintableHtml({
      title: "سجل الطلبات",
      columns,
      rows: [{ reference: "SE-1", details: "<script>alert(1)</script>" }],
      direction: "rtl",
    });
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
