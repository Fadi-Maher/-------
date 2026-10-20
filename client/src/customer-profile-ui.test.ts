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
}));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock("@/lib/customerSession", () => ({ saveCustomerSession: mocks.saveSession }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ customers: { myProfile: { setData: mocks.setData } } }),
    customers: {
      myProfile: { useQuery: () => mocks.profile },
      updateMyProfile: {
        useMutation: (options: MutationOptions) => {
          mocks.options = options;
          return { mutate: mocks.mutate, isPending: false, error: null };
        },
      },
    },
  },
}));

import { CustomerProfilePanel } from "./components/CustomerProfilePanel";
import { isCustomerProfileDirty, validateCustomerProfileForm } from "./lib/customerProfileForm";

const TOKEN = "t".repeat(40);
const loaded = { fullName: "سارة أحمد", email: "sara@example.com", phone: "0551234567", memberSince: Date.UTC(2026, 0, 5) };

beforeAll(() => {
  vi.stubGlobal("React", React);
});
beforeEach(() => {
  mocks.profile = { data: loaded, isLoading: false, error: null, refetch: vi.fn() };
  mocks.mutate.mockReset();
  mocks.setData.mockReset();
  mocks.saveSession.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
});
afterEach(() => cleanup());

const renderPanel = (isEnglish = false, onSessionExpired = vi.fn()) =>
  render(h(CustomerProfilePanel, { accessToken: TOKEN, isEnglish, onSessionExpired }));

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
    expect(mocks.saveSession).toHaveBeenCalledWith({ name: "سارة محمد", phone: "0551234567", accessToken: TOKEN });
    expect(mocks.toastSuccess).toHaveBeenCalled();
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
