// @vitest-environment jsdom
import React, { createElement as h } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  isEnglish: true,
  navigate: vi.fn(),
  verifyPhone: vi.fn(),
  findCustomer: vi.fn(),
  registerCustomer: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: mocks.isEnglish ? "en" : "ar",
    isEnglish: mocks.isEnglish,
    setLanguage: vi.fn(),
    toggleLanguage: vi.fn(),
  }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    requests: {
      verifyPhoneDemo: {
        useMutation: () => ({ mutateAsync: mocks.verifyPhone, isPending: false }),
      },
    },
    customers: {
      findByPhoneAccessToken: {
        useMutation: () => ({ mutateAsync: mocks.findCustomer, isPending: false }),
      },
      registerWithPhone: {
        useMutation: () => ({ mutateAsync: mocks.registerCustomer, isPending: false }),
      },
    },
  },
}));

vi.mock("wouter", () => ({ useLocation: () => ["/", mocks.navigate] }));

vi.mock("sonner", () => ({
  toast: {
    info: mocks.toastInfo,
    success: mocks.toastSuccess,
  },
}));

import { CustomerAuthForm } from "./components/CustomerAuthForm";

const accessToken = "verified-customer-access-token-123456";

async function moveToVerification(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Mobile number"), "0500000000");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.type(screen.getByLabelText("Enter the six-digit demo code"), "123456");
}

async function moveToDetails(user: ReturnType<typeof userEvent.setup>) {
  mocks.verifyPhone.mockResolvedValue({ accessToken });
  mocks.findCustomer.mockResolvedValue(null);
  await moveToVerification(user);
  await user.click(screen.getByRole("button", { name: "Verify and continue" }));
  await screen.findByRole("heading", { name: "Complete your customer profile." });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("React", React);
  vi.stubGlobal("ResizeObserver", class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  if (!document.elementFromPoint) {
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => null,
    });
  }
  mocks.isEnglish = true;
  localStorage.clear();
});

afterEach(cleanup);

describe("CustomerAuthForm", () => {
  it("persists an existing customer, welcomes them, and SPA-redirects to the customer dashboard", async () => {
    const user = userEvent.setup();
    mocks.verifyPhone.mockResolvedValue({ accessToken });
    mocks.findCustomer.mockResolvedValue({ id: 7, fullName: "Nora Customer", phone: "0500000000", email: "nora@example.test" });

    render(h(CustomerAuthForm, { mode: "signin", variant: "modal" }));
    await moveToVerification(user);
    await user.click(screen.getByRole("button", { name: "Verify and continue" }));

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/customer-account"));
    expect(localStorage.getItem("maalamati_customer_name")).toBe("Nora Customer");
    expect(localStorage.getItem("maalamati_customer_phone")).toBe("0500000000");
    expect(localStorage.getItem("maalamati_customer_access_token")).toBe(accessToken);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Welcome back, Nora Customer", expect.any(Object));
  });

  it("uses a valid seeded phone at OTP entry without mutations until the code is submitted", async () => {
    const user = userEvent.setup();
    mocks.verifyPhone.mockResolvedValue({ accessToken });
    mocks.findCustomer.mockResolvedValue({ id: 7, fullName: "Nora Customer", phone: "0500000000", email: "nora@example.test" });

    render(h(CustomerAuthForm, { variant: "modal", initialPhone: "+966500000000" }));

    expect(screen.getByRole("heading", { name: "Verify your mobile number." })).toBeTruthy();
    expect(screen.queryByLabelText("Mobile number")).toBeNull();
    expect(mocks.verifyPhone).not.toHaveBeenCalled();
    expect(mocks.findCustomer).not.toHaveBeenCalled();
    expect(mocks.registerCustomer).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Enter the six-digit demo code"), "123456");
    expect(mocks.verifyPhone).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Verify and continue" }));

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/customer-account"));
    expect(mocks.verifyPhone).toHaveBeenCalledWith({ phone: "0500000000", code: "123456" });
  });

  it("delegates changing a seeded phone to the modal owner instead of returning to phone entry", async () => {
    const onChangePhone = vi.fn();
    render(h(CustomerAuthForm, { variant: "modal", initialPhone: "0500000000", onChangePhone }));

    await userEvent.setup().click(screen.getByRole("button", { name: "Change mobile number" }));

    expect(onChangePhone).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Mobile number")).toBeNull();
    expect(mocks.verifyPhone).not.toHaveBeenCalled();
  });

  it("registers a new customer after consent, then persists, welcomes, and SPA-redirects", async () => {
    const user = userEvent.setup();
    mocks.registerCustomer.mockResolvedValue({ id: 8, fullName: "Layla New", phone: "0500000000", email: "layla@example.test" });

    render(h(CustomerAuthForm, { mode: "signup" }));
    await moveToDetails(user);
    await user.type(screen.getByLabelText("Full name"), "Layla New");
    await user.type(screen.getByLabelText("Email address"), "layla@example.test");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create customer account" }));

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/customer-account"));
    expect(mocks.registerCustomer).toHaveBeenCalledWith(expect.objectContaining({
      fullName: "Layla New",
      phone: "0500000000",
      email: "layla@example.test",
      accessToken,
      termsAccepted: true,
    }));
    expect(localStorage.getItem("maalamati_customer_name")).toBe("Layla New");
    expect(localStorage.getItem("maalamati_customer_access_token")).toBe(accessToken);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Welcome to Maalamati Care, Layla New", expect.any(Object));
  });

  it("does not persist a session or redirect when server verification/find rejects", async () => {
    const user = userEvent.setup();
    mocks.verifyPhone.mockResolvedValue({ accessToken });
    mocks.findCustomer.mockRejectedValue(new Error("Verification expired"));

    render(h(CustomerAuthForm));
    await moveToVerification(user);
    await user.click(screen.getByRole("button", { name: "Verify and continue" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Verification expired");
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(localStorage.getItem("maalamati_customer_name")).toBeNull();
    expect(localStorage.getItem("maalamati_customer_access_token")).toBeNull();
  });

  it("requires legal consent before registering a verified new customer", async () => {
    const user = userEvent.setup();
    render(h(CustomerAuthForm));
    await moveToDetails(user);

    const detailsForm = screen.getByLabelText("Full name").closest("form");
    expect(detailsForm).not.toBeNull();
    fireEvent.submit(detailsForm!);

    expect((await screen.findByRole("alert")).textContent).toContain("You must agree to the Terms and Conditions");
    expect(mocks.registerCustomer).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("locks a verification submit synchronously so repeated Enter submits only once", async () => {
    const user = userEvent.setup();
    let resolveVerification: ((value: { accessToken: string }) => void) | undefined;
    mocks.verifyPhone.mockImplementation(() => new Promise(resolve => {
      resolveVerification = resolve;
    }));
    mocks.findCustomer.mockResolvedValue(null);

    render(h(CustomerAuthForm));
    await moveToVerification(user);
    const verificationForm = screen.getByLabelText("Enter the six-digit demo code").closest("form");
    expect(verificationForm).not.toBeNull();

    fireEvent.submit(verificationForm!);
    fireEvent.submit(verificationForm!);
    expect(mocks.verifyPhone).toHaveBeenCalledTimes(1);

    resolveVerification?.({ accessToken });
    await screen.findByRole("heading", { name: "Complete your customer profile." });
    expect(mocks.findCustomer).toHaveBeenCalledTimes(1);
  });
});
