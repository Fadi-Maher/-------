// @vitest-environment jsdom
import React, { createElement as h } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type MutationOptions = { onSuccess?: (result: unknown) => void; onError?: (error: unknown) => void };
const mocks = vi.hoisted(() => ({
  profile: { data: undefined as unknown, isLoading: false, error: null as unknown, refetch: vi.fn() },
  mutate: vi.fn(),
  options: {} as MutationOptions,
  setData: vi.fn(),
  saveSession: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  pending: false,
  isEnglish: false,
  requestChange: vi.fn(),
  resendCode: vi.fn(),
  confirmChange: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock("@/lib/customerSession", () => ({ saveCustomerSession: mocks.saveSession }));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: mocks.isEnglish ? "en" : "ar", isEnglish: mocks.isEnglish, setLanguage: vi.fn(), toggleLanguage: vi.fn() }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ customers: { myProfile: { setData: mocks.setData } } }),
    customers: {
      myProfile: { useQuery: () => mocks.profile },
      updateMyProfile: {
        useMutation: (options: MutationOptions) => {
          mocks.options = options;
          return { mutate: mocks.mutate, isPending: mocks.pending, error: null };
        },
      },
      requestPhoneChange: { useMutation: () => ({ mutateAsync: mocks.requestChange }) },
      confirmPhoneChange: { useMutation: () => ({ mutateAsync: mocks.confirmChange }) },
    },
    phoneAuth: { resendCode: { useMutation: () => ({ mutateAsync: mocks.resendCode }) } },
  },
}));

import { CustomerProfilePanel } from "./components/CustomerProfilePanel";
import { isCustomerProfileDirty, validateCustomerProfileForm } from "./lib/customerProfileForm";

const TOKEN = "t".repeat(40);
const loaded = { fullName: "سارة أحمد", email: "sara@example.com", phone: "0551234567", memberSince: Date.UTC(2026, 0, 5) };

beforeAll(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("ResizeObserver", class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  if (!document.elementFromPoint) {
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => null });
  }
});
beforeEach(() => {
  mocks.profile = { data: loaded, isLoading: false, error: null, refetch: vi.fn() };
  mocks.mutate.mockReset();
  mocks.setData.mockReset();
  // Like the real query cache: the next render reads what was stored.
  mocks.setData.mockImplementation((_input: unknown, data: unknown) => {
    mocks.profile = { ...mocks.profile, data };
  });
  mocks.saveSession.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
  mocks.requestChange.mockReset();
  mocks.resendCode.mockReset();
  mocks.confirmChange.mockReset();
  mocks.pending = false;
  mocks.isEnglish = false;
});
afterEach(() => cleanup());

const renderPanel = (isEnglish = false, onSessionExpired = vi.fn(), onAccessTokenRotated = vi.fn()) => {
  mocks.isEnglish = isEnglish;
  return render(h(CustomerProfilePanel, { accessToken: TOKEN, isEnglish, onSessionExpired, onAccessTokenRotated }));
};
const NEW_PHONE = "0559876543";
const NEW_TOKEN = "n".repeat(40);
const challenge = () => ({
  challengeId: "6f1c1f0e-8a7d-4a4b-9f3e-1d2c3b4a5f60",
  expiresAt: Date.now() + 300_000,
  resendAvailableAt: Date.now() + 60_000,
  serverNow: Date.now(),
  mode: "demo" as const,
  demoCode: "123456",
});
async function openPhoneChange(user: ReturnType<typeof userEvent.setup>, phone = NEW_PHONE) {
  await user.click(screen.getByRole("button", { name: /Change number/ }));
  await user.type(await screen.findByLabelText("New mobile number"), phone);
  await user.click(screen.getByRole("button", { name: "Send verification code" }));
}

describe("CustomerProfilePanel", () => {
  it("shows the saved details with a read-only phone and a disabled save until something changes", () => {
    renderPanel();
    expect((screen.getByLabelText(/الاسم الكامل/) as HTMLInputElement).value).toBe("سارة أحمد");
    expect((screen.getByLabelText(/البريد الإلكتروني/) as HTMLInputElement).value).toBe("sara@example.com");
    const phone = screen.getByLabelText("رقم الجوال") as HTMLInputElement;
    expect(phone.readOnly).toBe(true);
    expect(phone.value).toBe("0551234567");
    expect(screen.getByRole("button", { name: /حفظ التغييرات/ })).toHaveProperty("disabled", true);
  });

  it("saves the normalized values, updates the session name and confirms", async () => {
    const user = userEvent.setup();
    renderPanel();
    const name = screen.getByLabelText(/الاسم الكامل/);
    await user.clear(name);
    await user.type(name, "  سارة   محمد ");
    const email = screen.getByLabelText(/البريد الإلكتروني/);
    await user.clear(email);
    await user.click(screen.getByRole("button", { name: /حفظ التغييرات/ }));
    expect(mocks.mutate).toHaveBeenCalledWith({ accessToken: TOKEN, fullName: "سارة محمد", email: null });
    const profile = { ...loaded, fullName: "سارة محمد", email: null };
    mocks.options.onSuccess?.({ changed: true, changedFields: ["fullName", "email"], profile });
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("تم تحديث ملفك الشخصي"));
    expect(screen.getByRole("status").textContent).toContain("حُدِّث الاسم والبريد الإلكتروني");
    expect(mocks.saveSession).toHaveBeenCalledWith({ name: "سارة محمد", phone: "0551234567", accessToken: TOKEN });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("تم تحديث ملفك الشخصي.", { description: "حُدِّث الاسم والبريد الإلكتروني." });
    // The save button confirms briefly, and the account card is highlighted.
    expect(screen.getByRole("button", { name: /تم الحفظ/ })).toBeTruthy();
    expect(screen.getByRole("complementary").className).toContain("profile-saved-glow");
  });

  it("shows a moving progress bar, a spinner and a busy form while saving", () => {
    mocks.pending = true;
    renderPanel();
    expect(screen.getByTestId("profile-save-progress")).toBeTruthy();
    expect(screen.getByRole("button", { name: /جارٍ الحفظ/ }).getAttribute("aria-busy")).toBe("true");
    expect(document.querySelector("form")?.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("جارٍ حفظ تغييراتك");
    expect((screen.getByLabelText(/الاسم الكامل/) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: /تغيير الرقم/ })).toHaveProperty("disabled", true);
  });

  it("shows a skeleton with an announced loading message while the profile loads", () => {
    mocks.profile = { data: undefined, isLoading: true, error: null, refetch: vi.fn() };
    renderPanel(true);
    expect(screen.getByTestId("profile-skeleton")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Loading your profile");
  });

  it("explains invalid fields and does not send the request", async () => {
    const user = userEvent.setup();
    renderPanel(true);
    const name = screen.getByLabelText(/Full name/);
    await user.clear(name);
    await user.type(name, "1");
    const email = screen.getByLabelText(/Email/);
    await user.clear(email);
    await user.type(email, "wrong");
    await user.click(screen.getByRole("button", { name: /Save changes/ }));
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText(/at least 2 letters/)).toBeTruthy();
    expect(document.activeElement).toBe(name);
  });

  it("keeps the save confirmation and field errors in the current language after switching", async () => {
    const user = userEvent.setup();
    const view = renderPanel(true);
    const name = screen.getByLabelText(/Full name/);
    await user.clear(name);
    await user.type(name, "Sara Mohammed");
    await user.click(screen.getByRole("button", { name: /Save changes/ }));
    mocks.options.onSuccess?.({ changed: true, changedFields: ["fullName"], profile: { ...loaded, fullName: "Sara Mohammed" } });
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Your profile was updated"));
    view.rerender(h(CustomerProfilePanel, { accessToken: TOKEN, isEnglish: false, onSessionExpired: vi.fn() }));
    expect(screen.getByRole("status").textContent).toContain("تم تحديث ملفك الشخصي");
    expect(screen.getByRole("status").textContent).not.toContain("Your profile was updated");

    const arabicName = screen.getByLabelText(/الاسم الكامل/);
    await user.clear(arabicName);
    await user.type(arabicName, "1");
    await user.click(screen.getByRole("button", { name: /حفظ التغييرات/ }));
    view.rerender(h(CustomerProfilePanel, { accessToken: TOKEN, isEnglish: true, onSessionExpired: vi.fn() }));
    expect(screen.getByText(/at least 2 letters/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Please fix the highlighted fields");
  });

  it("can undo unsaved edits", async () => {
    const user = userEvent.setup();
    renderPanel();
    const name = screen.getByLabelText(/الاسم الكامل/) as HTMLInputElement;
    await user.type(name, " الجديد");
    await user.click(screen.getByRole("button", { name: /تراجع عن التغييرات/ }));
    expect(name.value).toBe("سارة أحمد");
  });

  it("asks the customer to sign in again when the session is no longer valid", async () => {
    const user = userEvent.setup();
    const onSessionExpired = vi.fn();
    mocks.profile = { data: undefined, isLoading: false, error: { data: { code: "UNAUTHORIZED" } }, refetch: vi.fn() };
    renderPanel(false, onSessionExpired);
    expect(screen.getByRole("alert").textContent).toContain("انتهت جلستك");
    await user.click(screen.getByRole("button", { name: "تسجيل الدخول من جديد" }));
    expect(onSessionExpired).toHaveBeenCalled();
  });
});

describe("changing the mobile number", () => {
  it("verifies the new number with a code, then stores the new session and confirms", async () => {
    const user = userEvent.setup();
    const onRotated = vi.fn();
    mocks.requestChange.mockResolvedValueOnce(challenge());
    const moved = { fullName: "سارة أحمد", email: "sara@example.com", phone: NEW_PHONE, memberSince: loaded.memberSince };
    mocks.confirmChange.mockResolvedValueOnce({ profile: moved, previousPhone: loaded.phone, movedRequests: 2, movedNotifications: 3, accessToken: NEW_TOKEN, expiresInSeconds: 1 });
    renderPanel(true, vi.fn(), onRotated);

    await openPhoneChange(user, "+966 55 987 6543");
    expect(mocks.requestChange).toHaveBeenCalledWith({ accessToken: TOKEN, newPhone: NEW_PHONE, language: "en" });
    expect(await screen.findByText("Verify the new number")).toBeTruthy();
    await user.type(screen.getByLabelText("Verification code"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirm new number" }));

    await waitFor(() => expect(mocks.confirmChange).toHaveBeenCalledTimes(1));
    expect(mocks.confirmChange.mock.calls[0]?.[0]).toMatchObject({ accessToken: TOKEN, challengeId: challenge().challengeId, code: "123456", language: "en" });
    expect(mocks.confirmChange.mock.calls[0]?.[0].clientKey).toMatch(/^[0-9a-f-]{36}$/);
    // The page learns the new token before the session is saved, so the profile tab stays open.
    expect(onRotated).toHaveBeenCalledWith(NEW_TOKEN);
    expect(onRotated.mock.invocationCallOrder[0]).toBeLessThan(mocks.saveSession.mock.invocationCallOrder[0] ?? Infinity);
    expect(mocks.saveSession).toHaveBeenCalledWith({ name: "سارة أحمد", phone: NEW_PHONE, accessToken: NEW_TOKEN });
    expect(mocks.setData).toHaveBeenCalledWith({ accessToken: NEW_TOKEN }, moved);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Your mobile number was changed.", { description: `Your sign-in number is now ${NEW_PHONE}` });
    expect(await screen.findByText("Your mobile number was changed")).toBeTruthy();
    expect(screen.getByText("2 requests moved to the new number.")).toBeTruthy();
  });

  it("refuses the current or a malformed number without asking the server", async () => {
    const user = userEvent.setup();
    renderPanel(true);
    await openPhoneChange(user, loaded.phone);
    expect((await screen.findByRole("alert")).textContent).toContain("That is your current number");
    const input = screen.getByLabelText("New mobile number");
    await user.clear(input);
    await user.type(input, "0123");
    await user.click(screen.getByRole("button", { name: "Send verification code" }));
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(mocks.requestChange).not.toHaveBeenCalled();
  });

  it("keeps the number and explains when the code is wrong", async () => {
    const user = userEvent.setup();
    const onRotated = vi.fn();
    mocks.requestChange.mockResolvedValueOnce(challenge());
    mocks.confirmChange.mockRejectedValueOnce(Object.assign(new Error("Incorrect code. 4 attempts left."), { data: { code: "UNAUTHORIZED" } }));
    renderPanel(true, vi.fn(), onRotated);
    await openPhoneChange(user);
    await user.type(await screen.findByLabelText("Verification code"), "111111");
    await user.click(screen.getByRole("button", { name: "Confirm new number" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Incorrect code");
    expect(onRotated).not.toHaveBeenCalled();
    expect(mocks.saveSession).not.toHaveBeenCalled();
  });

  it("returns to the number step when the verified number is already in use", async () => {
    const user = userEvent.setup();
    mocks.requestChange.mockResolvedValueOnce(challenge());
    mocks.confirmChange.mockRejectedValueOnce(Object.assign(new Error("This number is already linked to another account."), { data: { code: "CONFLICT" } }));
    renderPanel(true);
    await openPhoneChange(user);
    await user.type(await screen.findByLabelText("Verification code"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirm new number" }));
    expect((await screen.findByRole("alert")).textContent).toContain("already linked");
    expect(screen.getByLabelText("New mobile number")).toBeTruthy();
  });

  it("offers a fresh sign-in when the session ended", async () => {
    const user = userEvent.setup();
    const onSessionExpired = vi.fn();
    mocks.requestChange.mockRejectedValueOnce(Object.assign(new Error("Your session has ended."), { data: { code: "FORBIDDEN" } }));
    renderPanel(true, onSessionExpired);
    await openPhoneChange(user);
    expect((await screen.findByRole("alert")).textContent).toContain("Sign in again, then change your number");
    await user.click(screen.getByRole("button", { name: "Sign in again" }));
    expect(onSessionExpired).toHaveBeenCalled();
  });
});

describe("customer profile form rules", () => {
  it("accepts an empty email and rejects malformed ones", () => {
    expect(validateCustomerProfileForm({ fullName: "Sara", email: "" }, true)).toEqual({});
    expect(validateCustomerProfileForm({ fullName: "Sara", email: "a@b" }, true).email).toBeTruthy();
    expect(validateCustomerProfileForm({ fullName: "١٢", email: "" }, false).fullName).toBeTruthy();
  });

  it("ignores whitespace and email case when deciding if there are changes", () => {
    expect(isCustomerProfileDirty({ fullName: " Sara  Ahmed ", email: "SARA@x.com" }, { fullName: "Sara Ahmed", email: "sara@x.com" })).toBe(false);
    expect(isCustomerProfileDirty({ fullName: "Sara", email: "" }, { fullName: "Sara Ahmed", email: "" })).toBe(true);
  });
});
