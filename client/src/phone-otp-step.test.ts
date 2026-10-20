// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  PhoneOtpStep,
  type PhoneOtpChallenge,
} from "./components/PhoneOtpStep";
vi.mock("./contexts/LanguageContext", () => ({
  useLanguage: () => ({ isEnglish: true }),
}));
beforeAll(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(cleanup);
const challenge: PhoneOtpChallenge = {
  challengeId: "8670cbac-e08e-45c3-bd46-8c1d4bf394c8",
  expiresAt: 300_000,
  resendAvailableAt: 60_000,
  serverNow: 0,
  mode: "demo",
  demoCode: "123456",
};
const props = {
  phone: "0500000098",
  challenge,
  now: 0,
  code: "123456",
  error: "",
  notice: "",
  busy: false,
  onCodeChange: vi.fn(),
  onVerify: vi.fn(),
  onResend: vi.fn(),
  onChangePhone: vi.fn(),
};
describe("شاشة الرمز المشترك", () => {
  it("disables resend during the cooldown and enables it at the exact boundary", () => {
    const view = render(React.createElement(PhoneOtpStep, props));
    expect(
      (
        screen.getByRole("button", {
          name: "Resend in 60s",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    view.rerender(React.createElement(PhoneOtpStep, { ...props, now: 60_000 }));
    expect(
      (screen.getByRole("button", { name: "Resend code" }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });
  it("disables a complete code at exact expiry while keeping resend and mobile change available", () => {
    render(React.createElement(PhoneOtpStep, { ...props, now: 300_000 }));
    expect(
      (
        screen.getByRole("button", {
          name: "Verify and continue",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(
      (
        screen.getByRole("textbox", {
          name: "Verification code",
        }) as HTMLInputElement
      ).disabled
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Resend code" }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
    expect(
      screen.getByText("Code expired. Request another code.")
    ).toBeTruthy();
  });
  it("locks all actions while pending and associates a server error with the labelled code input", () => {
    render(
      React.createElement(PhoneOtpStep, {
        ...props,
        now: 60_000,
        busy: true,
        error: "Incorrect code.",
      })
    );
    for (const name of ["Resend code", "Change mobile number", "Checking…"]) {
      expect(
        (screen.getByRole("button", { name }) as HTMLButtonElement).disabled
      ).toBe(true);
    }
    const field = screen.getByLabelText("Verification code");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(
      document.getElementById(field.getAttribute("aria-describedby")!)
        ?.textContent
    ).toContain("Incorrect code.");
    expect(screen.getByText("Demo verification — no SMS is sent")).toBeTruthy();
  });
});
