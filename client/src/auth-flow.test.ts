// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: mocks.success } }));
import { AUTH_COMPLETED_EVENT, AUTH_MODAL_OPEN_EVENT, finishSignIn, getAuthenticatedWorkspace, openAuthModal } from "./lib/authFlow";

beforeEach(() => vi.clearAllMocks());
describe("توجيه الدخول الموثق", () => {
  it.each([["customer", "/customer-account"], ["agent", "/agent-dashboard"]] as const)("يرسل %s إلى لوحته فقط", (role, path) => expect(getAuthenticatedWorkspace(role)).toBe(path));
  it.each(["admin", "employee", "user", "https://example.invalid", "/dashboard", ""])("يرفض الدور غير المدعوم %s دون توجيه", role => {
    const navigate = vi.fn();
    expect(() => finishSignIn({ role: role as "agent", name: "Test" }, true, navigate)).toThrow("Unsupported authenticated account role");
    expect(navigate).not.toHaveBeenCalled(); expect(mocks.success).not.toHaveBeenCalled();
  });
  it.each([true, false])("يغلق النافذة ويرحب قبل انتقال العميل، الإنجليزية=%s", isEnglish => {
    const sequence: string[] = []; const listener = () => sequence.push("close");
    window.addEventListener(AUTH_COMPLETED_EVENT, listener, { once: true });
    mocks.success.mockImplementation(() => sequence.push("welcome"));
    finishSignIn({ role: "customer", name: "Nora", isNew: true }, isEnglish, path => sequence.push(path));
    expect(sequence).toEqual(["close", "welcome", "/customer-account"]);
    expect(mocks.success.mock.calls[0][0]).toContain("Nora");
    expect(mocks.success.mock.calls[0][0]).toContain(isEnglish ? "Maalamati Care" : "معاملاتي كير");
  });
  it("يفتح النافذة من الزر دون تغيير الرابط أو كتابة جلسة", () => {
    window.history.replaceState({}, "", "/contact"); localStorage.clear();
    const trigger = document.createElement("button"); const listener = vi.fn();
    window.addEventListener(AUTH_MODAL_OPEN_EVENT, listener, { once: true });
    openAuthModal({ intent: "signup", audience: "customer", trigger });
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ intent: "signup", audience: "customer", trigger });
    expect(window.location.pathname).toBe("/contact"); expect(localStorage.length).toBe(0);
  });
});
