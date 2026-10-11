import { describe, expect, it } from "vitest";
import { requiresAuthentication } from "./routeAuth";

describe("حماية المسارات", () => {
  it("يبقي صفحات الموقع العامة قابلة للفتح دون تسجيل دخول", () => {
    expect(requiresAuthentication("/")).toBe(false);
    expect(requiresAuthentication("/track")).toBe(false);
    expect(requiresAuthentication("/about")).toBe(false);
    expect(requiresAuthentication("/contact")).toBe(false);
  });

  it("يتطلب تسجيل الدخول للحساب ولوحات الإدارة", () => {
    expect(requiresAuthentication("/account")).toBe(true);
    expect(requiresAuthentication("/dashboard")).toBe(true);
    expect(requiresAuthentication("/customers/30001")).toBe(true);
    expect(requiresAuthentication("/settings")).toBe(true);
  });
});
