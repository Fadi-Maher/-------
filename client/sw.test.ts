import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("عامل خدمة ستريك إكسبريس", () => {
  const worker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

  it("يصدر ذاكرة تطبيق جديدة ويستثني واجهة API من التخزين المؤقت", () => {
    expect(worker).toContain('streak-express-shell-v3');
    expect(worker).toContain('url.pathname.startsWith("/api/")');
  });
});
