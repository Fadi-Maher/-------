// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CompletePhoneProfile } from "./CompletePhoneProfile";

vi.mock("@/contexts/LanguageContext", () => ({
  LanguageProvider: ({ children }: { children: unknown }) => children,
  useLanguage: () => ({ isEnglish: true }),
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderProfile(props: Partial<ComponentProps<typeof CompletePhoneProfile>> = {}) {
  const onSave = vi.fn();
  render(
    createElement(
      LanguageProvider,
      null,
      createElement(CompletePhoneProfile, {
        role: "customer",
        phone: "0512345678",
        initialProfile: { fullName: "Saved Customer", email: "saved@example.test" },
        isNewCustomer: false,
        ...props,
        onSave,
      })
    )
  );
  return onSave;
}

beforeEach(() => {
  window.history.replaceState({}, "", "/?lang=en");
  localStorage.clear();
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

afterEach(() => cleanup());

describe("CompletePhoneProfile", () => {
  it("prefills an existing profile and does not ask that customer to accept terms again", () => {
    const onSave = renderProfile();

    expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("Saved Customer");
    expect((screen.getByLabelText("Email address") as HTMLInputElement).value).toBe("saved@example.test");
    expect(screen.queryByText(/I agree to the Terms/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Continue to my account" }));
    expect(onSave).toHaveBeenCalledWith({
      fullName: "Saved Customer",
      email: "saved@example.test",
      acceptedTerms: false,
    });
  });

  it("requires legal acceptance only when creating a new customer", () => {
    const onSave = renderProfile({ initialProfile: null, isNewCustomer: true });
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "New Customer" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "NEW@EXAMPLE.TEST" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Continue to my account" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("must agree");

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue to my account" }));
    expect(onSave).toHaveBeenCalledWith({
      fullName: "New Customer",
      email: "new@example.test",
      acceptedTerms: true,
    });
  });
});
