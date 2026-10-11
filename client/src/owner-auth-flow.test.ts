import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboardLayout = readFileSync(new URL("./components/DashboardLayout.tsx", import.meta.url), "utf8");
const authHook = readFileSync(new URL("./_core/hooks/useAuth.ts", import.meta.url), "utf8");
const ownerLogin = readFileSync(new URL("./pages/OwnerLogin.tsx", import.meta.url), "utf8");
const skill = readFileSync(new URL("../../../skills/maalamati-owner-dashboard/SKILL.md", import.meta.url), "utf8");

describe("محاكاة دورة دخول وخروج المالك", () => {
  it("يربط زر الخروج بإنهاء جلسة الخادم ثم يعيد إلى مدخل المالك", () => {
    expect(dashboardLayout).toContain("const handleLogout = async () =>");
    expect(dashboardLayout).toContain("await logout()");
    expect(dashboardLayout).toContain('setLocation("/owner-login")');
    expect(dashboardLayout).toContain('aria-label="تسجيل الخروج"');
    expect(authHook).toContain("trpc.auth.logout.useMutation");
    expect(authHook).toContain('sessionStorage.removeItem("manus-cookie")');
  });

  it("لا يفتح لوحة الإدارة للحساب غير المصرح به ويستخدم مسار المالك المستقل", () => {
    expect(ownerLogin).toContain('useAuth({ redirectOnUnauthenticated: false })');
    expect(ownerLogin).toContain('user?.role === "admin"');
    expect(ownerLogin).toContain('window.location.assign("/dashboard")');
    expect(ownerLogin).toContain('user && user.role !== "admin"');
    expect(dashboardLayout).toContain('window.location.assign("/owner-login")');
  });

  it("يوثق عزل دخول وخروج المالك ضمن المهارة", () => {
    expect(skill).toContain("فصل صلاحيات المالك والعملاء");
    expect(skill).toContain("/owner-login");
    expect(skill).toContain("تسجيل الخروج");
  });
});
