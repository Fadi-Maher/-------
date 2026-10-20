// @vitest-environment jsdom
import React, { createElement as h } from "react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type AuthUser = {
  name: string;
  email: string;
  role: "admin" | "agent" | "employee" | "user";
};
const mocks = vi.hoisted(() => ({
  auth: { user: null as AuthUser | null, loading: false },
  logout: vi.fn(),
  toggleLanguage: vi.fn(),
  isEnglish: true,
  navigate: vi.fn(),
  request: vi.fn(),
  resend: vi.fn(),
  verify: vi.fn(),
  customer: vi.fn(),
  agent: vi.fn(),
  status: vi.fn(),
  authMe: vi.fn(),
  success: vi.fn(),
  currentPhone: "0500000098",
}));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.auth.user,
    loading: mocks.auth.loading,
    error: null,
    isAuthenticated: Boolean(mocks.auth.user),
    refresh: vi.fn(),
    logout: mocks.logout,
  }),
}));
vi.mock("./contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: mocks.isEnglish ? "en" : "ar",
    isEnglish: mocks.isEnglish,
    setLanguage: vi.fn(),
    toggleLanguage: mocks.toggleLanguage,
  }),
}));
vi.mock("wouter", () => ({ useLocation: () => ["/", mocks.navigate] }));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: vi.fn(), info: vi.fn() },
}));
vi.mock("./lib/trpc", () => ({
  trpc: {
    phoneAuth: {
      requestCode: { useMutation: () => ({ mutateAsync: mocks.request }) },
      resendCode: { useMutation: () => ({ mutateAsync: mocks.resend }) },
      verifyCode: { useMutation: () => ({ mutateAsync: mocks.verify }) },
      agentSignIn: { useMutation: () => ({ mutateAsync: mocks.agent }) },
    },
    customers: {
      findByPhoneAccessToken: {
        useMutation: () => ({ mutateAsync: mocks.customer }),
      },
    },
    useUtils: () => ({
      auth: {
        me: {
          fetch: mocks.authMe,
          invalidate: vi.fn().mockResolvedValue(undefined),
        },
      },
      agentApplications: { status: { fetch: mocks.status } },
    }),
  },
}));
vi.mock("./components/CustomerAuthForm", async importOriginal => {
  const actual =
    await importOriginal<typeof import("./components/CustomerAuthForm")>();
  return {
    ...actual,
    CustomerAuthForm: (props: {
      initialPhone?: string;
      verifiedAccessToken?: string;
      onChangePhone?: () => void;
      onBusyChange?: (busy: boolean) => void;
    }) =>
      h(
        "div",
        { "data-testid": "customer-modal-form" },
        h("output", { "data-testid": "seeded-phone" }, props.initialPhone),
        h(
          "output",
          { "data-testid": "handoff-token" },
          props.verifiedAccessToken
        ),
        h("input", { "aria-label": "Mock customer name" }),
        h("button", { onClick: props.onChangePhone }, "Mock change mobile"),
        h(
          "button",
          { onClick: () => props.onBusyChange?.(true) },
          "Lock request"
        ),
        h(
          "button",
          { onClick: () => props.onBusyChange?.(false) },
          "Unlock request"
        )
      ),
  };
});
vi.mock("./components/AgentJoinForm", () => ({
  AgentJoinForm: (props: { phone: string; verificationToken: string }) =>
    h(
      "div",
      { "data-testid": "agent-join-form" },
      h("output", { "data-testid": "seeded-phone" }, props.phone),
      h("input", { "aria-label": "Mock join name" })
    ),
}));
import { PublicHeader } from "./components/PublicHeader";
import { AuthModal } from "./components/AuthModal";
import { openAuthModal } from "./lib/authFlow";
const publicUser = (role: AuthUser["role"]): AuthUser => ({
  role,
  name: `${role} example`,
  email: `${role}@example.test`,
});
function authRows() {
  return [
    within(screen.getByTestId("public-auth-desktop")),
    within(screen.getByTestId("public-auth-mobile")),
  ];
}
function expectPersistentPublicAuthActions() {
  for (const row of authRows()) {
    const button = row.getByRole("button", { name: "Sign in" });
    expect(button.textContent?.trim()).toContain("Sign in");
    expect(row.getAllByRole("button")).toHaveLength(1);
    expect(row.queryByRole("button", { name: "Create account" })).toBeNull();
    expect(button.getAttribute("href")).toBeNull();
  }
  expect(screen.getAllByRole("button", { name: "Sign in" })).toHaveLength(2);
}
function renderHeader() {
  return render(
    h(
      React.Fragment,
      null,
      h(PublicHeader, { onChooseService: vi.fn() }),
      h(AuthModal)
    )
  );
}
async function openToOtp(user: ReturnType<typeof userEvent.setup>) {
  await user.click(authRows()[0].getByRole("button", { name: "Sign in" }));
  const dialog = await screen.findByRole("dialog");
  await user.type(
    within(dialog).getByRole("textbox", { name: "Mobile number" }),
    "٠٥٠٠٠٠٠٠٩٨"
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Continue", exact: true })
  );
  await screen.findByTestId("phone-otp-step");
  return dialog;
}
async function verifyToRole(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement
) {
  await user.type(
    within(dialog).getByRole("textbox", { name: "Verification code" }),
    "١٢٣٤٥٦"
  );
  await user.click(
    within(dialog).getByRole("button", {
      name: "Verify and continue",
      exact: true,
    })
  );
  await within(dialog).findByRole("button", { name: /^Customer/ });
}
function challenge() {
  const now = Date.now();
  return {
    challengeId: "d48e77c6-c90e-4eb2-92d3-212273ed04b1",
    expiresAt: now + 300_000,
    resendAvailableAt: now,
    serverNow: now,
    mode: "demo",
    demoCode: "123456",
  };
}

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
  vi.stubGlobal(
    "matchMedia",
    vi
      .fn()
      .mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(0), 0)
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) =>
    window.clearTimeout(id)
  );
  if (!globalThis.crypto.randomUUID)
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: () => "84405e79-c4c0-4bdb-a5e6-e218dc1d62bf",
      configurable: true,
    });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.user = null;
  mocks.auth.loading = false;
  mocks.isEnglish = true;
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  mocks.request.mockImplementation(async (input: { phone: string }) => {
    mocks.currentPhone = input.phone;
    return challenge();
  });
  mocks.resend.mockImplementation(async () => challenge());
  mocks.verify.mockImplementation(async () => ({
    phone: mocks.currentPhone,
    verificationToken: "verified-phone-ticket-not-real-session",
    accessToken: "verified-customer-access-not-real-session",
    expiresAt: Date.now() + 900_000,
  }));
  mocks.customer.mockResolvedValue(null);
  mocks.status.mockResolvedValue({ hasActiveAgent: false, application: null });
  mocks.agent.mockResolvedValue({
    success: true,
    role: "agent",
    name: "QA Agent",
  });
  mocks.authMe.mockResolvedValue({ role: "agent" });
});
afterEach(cleanup);

describe("إجراءات الدخول العامة والتحقق المشترك", () => {
  it.each([
    ["loading", null, true],
    ["guest", null, false],
    ["admin", publicUser("admin"), false],
    ["agent", publicUser("agent"), false],
    ["employee", publicUser("employee"), false],
    ["user", publicUser("user"), false],
  ] as const)(
    "keeps exactly one Sign in entry for %s",
    (_state, user, loading) => {
      mocks.auth.user = user;
      mocks.auth.loading = loading;
      renderHeader();
      expectPersistentPublicAuthActions();
    }
  );
  it("keeps one entry when a complete local customer session exists", () => {
    localStorage.setItem("maalamati_customer_name", "Nora");
    localStorage.setItem("maalamati_customer_phone", "0500000098");
    localStorage.setItem("maalamati_customer_access_token", "old-test-session");
    renderHeader();
    expectPersistentPublicAuthActions();
  });
  it("uses mobile then one OTP then role and seeded customer details without navigation, and restores focus", async () => {
    const user = userEvent.setup();
    renderHeader();
    const trigger = authRows()[0].getByRole("button", { name: "Sign in" });
    const dialog = await openToOtp(user);
    expect(
      within(dialog).queryByRole("button", { name: /^Customer/ })
    ).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /^Agent/ })).toBeNull();
    expect(mocks.customer).not.toHaveBeenCalled();
    expect(mocks.status).not.toHaveBeenCalled();
    expect(mocks.request).toHaveBeenCalledWith({
      phone: "0500000098",
      language: "en",
    });
    await verifyToRole(user, dialog);
    expect(mocks.verify).toHaveBeenCalledTimes(1);
    await user.click(within(dialog).getByRole("button", { name: /^Customer/ }));
    await screen.findByTestId("customer-modal-form");
    expect(screen.getByTestId("seeded-phone").textContent).toBe("0500000098");
    expect(screen.getByTestId("handoff-token").textContent).toBe(
      "verified-customer-access-not-real-session"
    );
    expect(
      within(dialog).queryByRole("textbox", { name: "Verification code" })
    ).toBeNull();
    expect(window.location.pathname).toBe("/");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
  it.each([
    ["", "Enter your mobile"],
    ["not-a-number", "Use numbers only"],
    ["+12025550111", "Saudi mobile"],
    ["050123", "10 digits"],
  ])(
    "announces specific invalid mobile errors for %s and never requests a code",
    async (value, expected) => {
      const user = userEvent.setup();
      renderHeader();
      await user.click(authRows()[0].getByRole("button", { name: "Sign in" }));
      const dialog = await screen.findByRole("dialog");
      const input = within(dialog).getByRole("textbox", {
        name: "Mobile number",
      });
      if (value) await user.type(input, value);
      await user.click(
        within(dialog).getByRole("button", { name: "Continue", exact: true })
      );
      expect(within(dialog).getByRole("alert").textContent).toContain(expected);
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(input);
      expect(mocks.request).not.toHaveBeenCalled();
    }
  );
  it("keeps roles hidden after a wrong code and enables retry without bypassing verification", async () => {
    mocks.verify.mockRejectedValueOnce(new Error("The code is incorrect."));
    const user = userEvent.setup();
    renderHeader();
    const dialog = await openToOtp(user);
    await user.type(
      within(dialog).getByRole("textbox", { name: "Verification code" }),
      "999999"
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Verify and continue" })
    );
    await waitFor(() =>
      expect(within(dialog).getByRole("alert").textContent).toContain(
        "incorrect"
      )
    );
    expect(
      within(dialog).queryByRole("button", { name: /^Customer/ })
    ).toBeNull();
    expect(mocks.agent).not.toHaveBeenCalled();
  });
  it("resends through the server and clears the old code without showing account roles", async () => {
    const user = userEvent.setup();
    renderHeader();
    const dialog = await openToOtp(user);
    await user.type(
      within(dialog).getByRole("textbox", { name: "Verification code" }),
      "123"
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Resend code", exact: true })
    );
    expect(mocks.resend).toHaveBeenCalledWith({
      challengeId: "d48e77c6-c90e-4eb2-92d3-212273ed04b1",
      language: "en",
    });
    await waitFor(() =>
      expect(
        (
          within(dialog).getByRole("textbox", {
            name: "Verification code",
          }) as HTMLInputElement
        ).value
      ).toBe("")
    );
    expect(within(dialog).queryByRole("button", { name: /^Agent/ })).toBeNull();
  });
  it("clears verification and old code when changing mobile and never enters roles without another OTP", async () => {
    const user = userEvent.setup();
    renderHeader();
    const dialog = await openToOtp(user);
    await verifyToRole(user, dialog);
    await user.click(
      within(dialog).getByRole("button", { name: "Change mobile number" })
    );
    expect(
      (
        within(dialog).getByRole("textbox", {
          name: "Mobile number",
        }) as HTMLInputElement
      ).value
    ).toBe("0500000098");
    await user.click(
      within(dialog).getByRole("button", { name: "Continue", exact: true })
    );
    expect(
      (
        within(dialog).getByRole("textbox", {
          name: "Verification code",
        }) as HTMLInputElement
      ).value
    ).toBe("");
    expect(within(dialog).queryByRole("button", { name: /^Agent/ })).toBeNull();
  });
  it("shows a join form rather than signing in or self-activating an inactive agent", async () => {
    const user = userEvent.setup();
    renderHeader();
    const dialog = await openToOtp(user);
    await verifyToRole(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: /^Agent/ }));
    await screen.findByTestId("agent-join-form");
    expect(mocks.agent).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it("routes an existing customer only after verification and account lookup", async () => {
    mocks.customer.mockResolvedValue({
      id: 999,
      fullName: "QA Customer",
      phone: "0500000098",
      email: null,
    });
    const user = userEvent.setup();
    renderHeader();
    const dialog = await openToOtp(user);
    await verifyToRole(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: /^Customer/ }));
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith("/customer-account")
    );
    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("maalamati_customer_phone")).toBe("0500000098");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("requires active staff and a confirmed server agent session, clears old customer state, then welcomes and routes", async () => {
    mocks.status.mockResolvedValue({ hasActiveAgent: true, application: null });
    localStorage.setItem("maalamati_customer_name", "Old Customer");
    localStorage.setItem("maalamati_customer_phone", "0500000098");
    localStorage.setItem("maalamati_customer_access_token", "old-token");
    const user = userEvent.setup();
    renderHeader();
    const dialog = await openToOtp(user);
    await verifyToRole(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: /^Agent/ }));
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith("/agent-dashboard")
    );
    expect(mocks.authMe).toHaveBeenCalled();
    expect(localStorage.getItem("maalamati_customer_access_token")).toBeNull();
    expect(mocks.success).toHaveBeenCalledTimes(1);
  });
  it("does not welcome or route on an unconfirmed server role", async () => {
    mocks.status.mockResolvedValue({ hasActiveAgent: true });
    mocks.authMe.mockResolvedValue({ role: "user" });
    const user = userEvent.setup();
    renderHeader();
    const dialog = await openToOtp(user);
    await verifyToRole(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: /^Agent/ }));
    await waitFor(() =>
      expect(within(dialog).getByRole("alert").textContent).toContain(
        "could not be confirmed"
      )
    );
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it("locks closing and repeat verification while the server is pending", async () => {
    let resolve!: (value: unknown) => void;
    mocks.verify.mockImplementationOnce(
      () =>
        new Promise(r => {
          resolve = r;
        })
    );
    const user = userEvent.setup();
    renderHeader();
    const dialog = await openToOtp(user);
    await user.type(
      within(dialog).getByRole("textbox", { name: "Verification code" }),
      "123456"
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Verify and continue" })
    );
    expect(
      (
        within(dialog).getByRole("button", {
          name: "Close sign in",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    openAuthModal({ intent: "signup", audience: "agent" });
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(mocks.verify).toHaveBeenCalledTimes(1);
    resolve({
      phone: "0500000098",
      verificationToken: "ticket",
      accessToken: "access",
      expiresAt: Date.now() + 900_000,
    });
    await within(dialog).findByRole("button", { name: /^Customer/ });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("does not expose a public owner link for an admin session", () => {
    mocks.auth.user = publicUser("admin");
    renderHeader();
    expect(
      document.querySelector('a[href="/dashboard"],a[href="/owner-login"]')
    ).toBeNull();
  });
});
