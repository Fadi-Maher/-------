// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  invalidate: vi.fn(),
  fetch: vi.fn(),
  setData: vi.fn(),
  navigate: vi.fn(),
  toastSuccess: vi.fn(),
  isEnglish: true,
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ isEnglish: mocks.isEnglish }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: {
      agentPhoneDemo: {
        useMutation: () => ({ mutateAsync: mocks.mutateAsync }),
      },
      me: {
        invalidate: mocks.invalidate,
        fetch: mocks.fetch,
        setData: mocks.setData,
      },
    },
    useUtils: () => ({
      auth: {
        me: {
          invalidate: mocks.invalidate,
          fetch: mocks.fetch,
          setData: mocks.setData,
        },
      },
    }),
  },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/agent-login", mocks.navigate],
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess },
}));

import { AgentAuthForm } from "./components/AgentAuthForm";

function otpInput() {
  const input = document.querySelector('input[autocomplete="one-time-code"]');
  if (!input) throw new Error("OTP input was not rendered");
  return input as HTMLInputElement;
}

async function reachVerification(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Mobile number"), "0500000004");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.type(otpInput(), "123456");
}

function renderForm(onBusyChange?: (busy: boolean) => void) {
  return render(React.createElement(AgentAuthForm, { variant: "modal", onBusyChange }));
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  document.elementFromPoint = () => document.body;
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isEnglish = true;
  mocks.invalidate.mockResolvedValue(undefined);
  mocks.fetch.mockResolvedValue({ role: "agent", name: "Agent Ada" });
  sessionStorage.clear();
});

afterEach(cleanup);

describe("AgentAuthForm", () => {
  it("requires the fresh server agent session before showing the welcome and SPA redirect", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("manus-cookie", "stale-preview-mirror");
    mocks.mutateAsync.mockResolvedValue({ success: true, role: "agent", name: "Agent Ada" });
    renderForm();

    await reachVerification(user);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/agent-dashboard"));
    expect(mocks.mutateAsync).toHaveBeenCalledWith({ phone: "0500000004", code: "123456" });
    expect(mocks.invalidate).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("manus-cookie")).toBeNull();
    expect(mocks.setData).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Welcome back, Agent Ada",
      expect.objectContaining({ description: "Your agent workspace is ready." })
    );
  });

  it.each([
    ["a bad OTP", "The verification code is incorrect."],
    ["an unregistered number", "This phone is not an active agent account."],
  ])("keeps the preview mirror and does not fabricate a session after %s", async (_case, message) => {
    const user = userEvent.setup();
    sessionStorage.setItem("manus-cookie", "old-preview-mirror");
    mocks.mutateAsync.mockRejectedValue(new Error(message));
    renderForm();

    await reachVerification(user);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect((await screen.findByRole("alert")).textContent).toContain(message);
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.invalidate).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.setData).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("manus-cookie")).toBe("old-preview-mirror");
  });

  it("does not redirect when the refreshed server session has a non-agent role", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("manus-cookie", "old-preview-mirror");
    mocks.mutateAsync.mockResolvedValue({ success: true, role: "agent", name: "Agent Ada" });
    mocks.fetch.mockResolvedValue({ role: "employee", name: "Unexpected employee" });
    renderForm();

    await reachVerification(user);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect((await screen.findByRole("alert")).textContent).toContain("could not verify an active agent session");
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.setData).not.toHaveBeenCalled();
    // The mutation succeeded, so only then is the obsolete preview mirror removed.
    expect(sessionStorage.getItem("manus-cookie")).toBeNull();
  });

  it("synchronously locks duplicate submissions while the mutation and me refresh are pending", async () => {
    const user = userEvent.setup();
    let resolveMutation: ((value: { success: true; role: "agent"; name: string }) => void) | undefined;
    mocks.mutateAsync.mockImplementation(() => new Promise((resolve) => { resolveMutation = resolve; }));
    const onBusyChange = vi.fn();
    renderForm(onBusyChange);

    await reachVerification(user);
    const verificationForm = otpInput().closest("form");
    if (!verificationForm) throw new Error("Verification form was not rendered");
    fireEvent.submit(verificationForm);
    fireEvent.submit(verificationForm);

    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
    expect(onBusyChange).toHaveBeenCalledWith(true);

    resolveMutation?.({ success: true, role: "agent", name: "Agent Ada" });
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/agent-dashboard"));
    await waitFor(() => expect(onBusyChange).toHaveBeenCalledWith(false));
  });

  it("clears the preview mirror only after a successful server mutation", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("manus-cookie", "stale-preview-mirror");
    mocks.mutateAsync.mockResolvedValue({ success: true, role: "agent", name: "Agent Ada" });
    renderForm();

    await reachVerification(user);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    expect(sessionStorage.getItem("manus-cookie")).toBeNull();
  });
});
