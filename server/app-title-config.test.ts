import { describe, expect, it } from "vitest";
import { loadEnv } from "vite";

describe("عنوان التطبيق الرسمي", () => {
  it("يستخدم اسم معاملاتي كير في إعدادات المشروع", () => {
    const env = loadEnv("test", process.cwd(), "VITE_APP_TITLE");
    expect(env.VITE_APP_TITLE).toBe("معاملاتي كير");
  });
});
