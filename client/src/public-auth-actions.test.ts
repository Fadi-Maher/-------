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
type ProfileResult = {
  profile: { fullName: string; email: string };
  hasActiveAgent: boolean;
  isNewCustomer: boolean;
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
  agent: vi.fn(),
  authMe: vi.fn(),
  success: vi.fn(),
  profileGet: vi.fn(),
  profileSave: vi.fn(),
  accounts: vi.fn(),
  info: vi.fn(),
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
  toast: { success: mocks.success, error: vi.fn(), info: mocks.info },
}));
vi.mock("./lib/trpc", () => ({
  trpc: {
    phoneAuth: {
      requestCode: { useMutation: () => ({ mutateAsync: mocks.request }) },
      resendCode: { useMutation: () => ({ mutateAsync: mocks.resend }) },
      verifyCode: { useMutation: () => ({ mutateAsync: mocks.verify }) },
      agentSignIn: { useMutation: () => ({ mutateAsync: mocks.agent }) },
    },
    phoneProfile: {
      save: { useMutation: () => ({ mutateAsync: mocks.profileSave }) },
    },
    useUtils: () => ({
      auth: {
        me: {
          fetch: mocks.authMe,
          invalidate: vi.fn().mockResolvedValue(undefined),
        },
      },
      phoneProfile: {
        get: { fetch: mocks.profileGet },
        accounts: { fetch: mocks.accounts },
      },
    }),
  },
}));
vi.mock("./components/AgentJoinForm", () => ({
  AgentJoinForm: (props: {
    phone: string;
    verificationToken: string;
    initialProfile?: { fullName: string; email: string };
  }) =>
    h(
      "div",
      { "data-testid": "agent-join-form" },
      h("output", { "data-testid": "seeded-phone" }, props.phone),
      h(
        "output",
        { "data-testid": "join-profile" },
        JSON.stringify(props.initialProfile)
      )
    ),
}));
import { PublicHeader } from "./components/PublicHeader";
import { AuthModal } from "./components/AuthModal";
import { openAuthModal } from "./lib/authFlow";

const baseProfile: ProfileResult = {
  profile: { fullName: "Nora Existing", email: "nora@example.test" },
  hasActiveAgent: false,
  isNewCustomer: false,
};
function authRows() {
  return [
    within(screen.getByTestId("public-auth-desktop")),
    within(screen.getByTestId("public-auth-mobile")),
  ];
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
function challenge() {
  const now = Date.now();
  return {
    challengeId: "d48e77c6-c90e-4eb2-92d3-212273ed04b1",
    expiresAt: now + 300_000,
    resendAvailableAt: now,
    serverNow: now,
    mode: "demo" as const,
    demoCode: "123456",
  };
}
async function openToRole(user: ReturnType<typeof userEvent.setup>) {
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
  return dialog;
}
async function verifyOtp(user: ReturnType<typeof userEvent.setup>) {
  await user.click(authRows()[0].getByRole("button", { name: "Sign in" }));
  const dialog = await screen.findByRole("dialog");
  await user.type(
    within(dialog).getByRole("textbox", { name: "Mobile number" }),
    "0500000098"
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Continue", exact: true })
  );
  await screen.findByTestId("phone-otp-step");
  await user.type(
    within(dialog).getByRole("textbox", { name: "Verification code" }),
    "123456"
  );
  await user.click(
    within(dialog).getByRole("button", {
      name: "Verify and continue",
      exact: true,
    })
  );
  return dialog;
}
async function chooseProfile(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  role: "Customer" | "Agent"
) {
  await user.click(
    within(dialog).getByRole("button", { name: new RegExp(`^${role}`) })
  );
  await within(dialog).findByRole("heading", { name: "Complete your profile" });
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
    vi.fn().mockImplementation((query: string) => ({
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
  mocks.profileGet.mockResolvedValue(baseProfile);
  // Default: a new mobile with no customer or active agent account yet.
  mocks.accounts.mockResolvedValue({ customer: null, activeAgent: null });
  mocks.profileSave.mockImplementation(
    async (input: {
      role: "customer" | "agent";
      fullName: string;
      email: string;
    }) => ({
      profile: { fullName: input.fullName, email: input.email },
      customer:
        input.role === "customer"
          ? { fullName: input.fullName, phone: mocks.currentPhone }
          : null,
      hasActiveAgent: false,
    })
  );
  mocks.agent.mockResolvedValue({
    success: true,
    role: "agent",
    name: "QA Agent",
  });
  mocks.authMe.mockResolvedValue({ role: "agent" });
});
afterEach(cleanup);

describe("إجراءات الدخول العامة والتحقق المشترك", () => {
  it("keeps exactly one public Sign in entry for every session state", () => {
    for (const [user, loading] of [
      [null, true],
      [null, false],
      [{ role: "admin", name: "admin", email: "a@test" } as AuthUser, false],
    ]) {
      mocks.auth.user = user;
      mocks.auth.loading = loading;
      const view = renderHeader();
      for (const row of authRows()) {
        expect(
          row.getByRole("button", { name: "Sign in" }).getAttribute("href")
        ).toBeNull();
        expect(
          row.queryByRole("button", { name: "Create account" })
        ).toBeNull();
      }
      view.unmount();
    }
  });
  it("does not reveal a role, lookup a profile, or redirect until the one OTP succeeds", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(authRows()[0].getByRole("button", { name: "Sign in" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).queryByRole("button", { name: /^Customer/ })
    ).toBeNull();
    await user.type(
      within(dialog).getByRole("textbox", { name: "Mobile number" }),
      "0500000098"
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Continue", exact: true })
    );
    expect(mocks.request).toHaveBeenCalledWith({
      phone: "0500000098",
      language: "en",
    });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Verification code" }),
      "123456"
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: "Verify and continue",
        exact: true,
      })
    );
    await within(dialog).findByRole("button", { name: /^Customer/ });
    expect(mocks.profileGet).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("sends a registered customer straight to their requests after OTP, with no type or profile step", async () => {
    const user = userEvent.setup();
    mocks.accounts.mockResolvedValue({
      customer: { fullName: "Nora Existing" },
      activeAgent: null,
    });
    renderHeader();
    const dialog = await verifyOtp(user);
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith("/customer-account")
    );
    expect(mocks.accounts).toHaveBeenCalledWith({
      verificationToken: "verified-phone-ticket-not-real-session",
    });
    expect(within(dialog).queryByRole("button", { name: /^Customer/ })).toBeNull();
    expect(mocks.profileGet).not.toHaveBeenCalled();
    expect(mocks.profileSave).not.toHaveBeenCalled();
    expect(mocks.agent).not.toHaveBeenCalled();
    expect(localStorage.getItem("maalamati_customer_name")).toBe("Nora Existing");
    expect(localStorage.getItem("maalamati_customer_phone")).toBe("0500000098");
    expect(localStorage.getItem("maalamati_customer_access_token")).toBe(
      "verified-customer-access-not-real-session"
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("signs a registered active agent in directly and still confirms the server role", async () => {
    const user = userEvent.setup();
    mocks.accounts.mockResolvedValue({
      customer: null,
      activeAgent: { fullName: "Active Agent" },
    });
    renderHeader();
    await verifyOtp(user);
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith("/agent-dashboard")
    );
    expect(mocks.agent).toHaveBeenCalledWith({
      verificationToken: "verified-phone-ticket-not-real-session",
    });
    expect(mocks.authMe).toHaveBeenCalled();
    expect(mocks.profileGet).not.toHaveBeenCalled();
    expect(mocks.profileSave).not.toHaveBeenCalled();
  });
  it("asks which account only when one mobile owns both, then opens it without a profile step", async () => {
    const user = userEvent.setup();
    mocks.accounts.mockResolvedValue({
      customer: { fullName: "Dual Owner" },
      activeAgent: { fullName: "Dual Owner" },
    });
    renderHeader();
    const dialog = await verifyOtp(user);
    await user.click(
      await within(dialog).findByRole("button", { name: /^Customer/ })
    );
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith("/customer-account")
    );
    expect(mocks.profileGet).not.toHaveBeenCalled();
    expect(mocks.agent).not.toHaveBeenCalled();
  });
  it("does not open a second sign-in while a customer is signed in", async () => {
    localStorage.setItem("maalamati_customer_name", "Nora Existing");
    localStorage.setItem("maalamati_customer_phone", "0500000098");
    localStorage.setItem("maalamati_customer_access_token", "stored-customer-access");
    const user = userEvent.setup();
    renderHeader();
    for (const row of authRows()) {
      expect(row.queryByRole("button", { name: "Sign in" })).toBeNull();
      expect(
        row.getByRole("link", { name: "My requests" }).getAttribute("href")
      ).toBe("/customer-account");
    }
    await user.click(authRows()[0].getByRole("link", { name: "My requests" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/customer-account");
    mocks.navigate.mockClear();
    // Old entry points (welcome screen, /login links) are redirected too.
    openAuthModal({ intent: "signin" });
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith("/customer-account")
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.info).toHaveBeenCalledWith(
      "You're already signed in as Nora Existing.",
      expect.objectContaining({ description: expect.stringContaining("Sign out first") })
    );
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("sends a signed-in agent to the agent workspace instead of the sign-in window", async () => {
    mocks.auth.user = { name: "QA Agent", email: "agent@test", role: "agent" };
    renderHeader();
    for (const row of authRows()) {
      expect(
        row.getByRole("link", { name: "Agent workspace" }).getAttribute("href")
      ).toBe("/agent-dashboard");
    }
    openAuthModal({ intent: "signin" });
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith("/agent-dashboard")
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("shows a visible agent sign-in entry that opens the agent path directly", async () => {
    const user = userEvent.setup();
    // The mobile owns both accounts; the agent entry must skip the type step.
    mocks.accounts.mockResolvedValue({
      customer: { fullName: "Both Accounts" },
      activeAgent: { fullName: "Active Agent" },
    });
    renderHeader();
    for (const row of authRows()) {
      expect(
        row.getByRole("link", { name: "Agent sign-in" }).getAttribute("href")
      ).toBe("/agent-login");
    }
    await user.click(authRows()[1].getByRole("link", { name: "Agent sign-in" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Agent sign-in" })
    ).toBeTruthy();
    await user.type(
      within(dialog).getByRole("textbox", { name: "Mobile number" }),
      "0500000098"
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Continue", exact: true })
    );
    await user.type(
      await within(dialog).findByRole("textbox", { name: "Verification code" }),
      "123456"
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: "Verify and continue",
        exact: true,
      })
    );
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith("/agent-dashboard")
    );
    expect(mocks.agent).toHaveBeenCalledWith({
      verificationToken: "verified-phone-ticket-not-real-session",
    });
    expect(within(dialog).queryByRole("button", { name: /^Customer/ })).toBeNull();
  });
  it("hides the agent sign-in entry while any account is signed in", () => {
    localStorage.setItem("maalamati_customer_name", "Nora Existing");
    localStorage.setItem("maalamati_customer_phone", "0500000098");
    localStorage.setItem("maalamati_customer_access_token", "stored-customer-access");
    const view = renderHeader();
    for (const row of authRows()) {
      expect(row.queryByRole("link", { name: "Agent sign-in" })).toBeNull();
    }
    view.unmount();
    localStorage.clear();
    mocks.auth.user = { name: "QA Agent", email: "agent@test", role: "agent" };
    renderHeader();
    for (const row of authRows()) {
      expect(row.queryByRole("link", { name: "Agent sign-in" })).toBeNull();
    }
  });
  it("requires terms only for a new customer and saves no profile before consent", async () => {
    const user = userEvent.setup();
    mocks.profileGet.mockResolvedValue({
      ...baseProfile,
      profile: { fullName: "New Customer", email: "new@example.test" },
      isNewCustomer: true,
    });
    renderHeader();
    const dialog = await openToRole(user);
    await chooseProfile(user, dialog, "Customer");
    const checkbox = within(dialog).getByRole("checkbox");
    expect(checkbox).toBeTruthy();
    await user.click(
      within(dialog).getByRole("button", { name: "Continue to my account" })
    );
    expect(within(dialog).getByRole("alert").textContent).toContain(
      "must agree"
    );
    expect(mocks.profileSave).not.toHaveBeenCalled();
    await user.click(checkbox);
    await user.click(
      within(dialog).getByRole("button", { name: "Continue to my account" })
    );
    await waitFor(() =>
      expect(mocks.profileSave).toHaveBeenCalledWith(
        expect.objectContaining({ role: "customer", acceptedTerms: true })
      )
    );
  });
  it("falls back to the type and profile steps if the account lookup fails, then confirms the agent role", async () => {
    const user = userEvent.setup();
    mocks.accounts.mockRejectedValue(new Error("lookup unavailable"));
    mocks.profileGet.mockResolvedValue({
      profile: { fullName: "Active Agent", email: "agent@example.test" },
      hasActiveAgent: true,
      isNewCustomer: false,
    });
    mocks.profileSave.mockResolvedValue({
      profile: { fullName: "Active Agent", email: "agent@example.test" },
      customer: null,
      hasActiveAgent: true,
    });
    renderHeader();
    const dialog = await openToRole(user);
    await chooseProfile(user, dialog, "Agent");
    expect(mocks.agent).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    await user.click(
      within(dialog).getByRole("button", { name: "Save and continue" })
    );
    await waitFor(() =>
      expect(mocks.agent).toHaveBeenCalledWith({
        verificationToken: "verified-phone-ticket-not-real-session",
      })
    );
    expect(mocks.authMe).toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith("/agent-dashboard");
  });
  it("never creates or signs in an inactive agent and hands the confirmed profile to AgentJoinForm", async () => {
    const user = userEvent.setup();
    mocks.profileGet.mockResolvedValue({
      profile: { fullName: "Pending Agent", email: "pending@example.test" },
      hasActiveAgent: false,
      isNewCustomer: false,
    });
    mocks.profileSave.mockResolvedValue({
      profile: { fullName: "Pending Agent", email: "pending@example.test" },
      customer: null,
      hasActiveAgent: false,
    });
    renderHeader();
    const dialog = await openToRole(user);
    await chooseProfile(user, dialog, "Agent");
    await user.click(
      within(dialog).getByRole("button", { name: "Save and continue" })
    );
    await screen.findByTestId("agent-join-form");
    expect(screen.getByTestId("join-profile").textContent).toBe(
      JSON.stringify({
        fullName: "Pending Agent",
        email: "pending@example.test",
      })
    );
    expect(mocks.agent).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it("does not trust an expired verification ticket to fetch a profile, show a completed role path, or redirect", async () => {
    mocks.verify.mockResolvedValueOnce({
      phone: "0500000098",
      verificationToken: "expired-ticket",
      accessToken: "access",
      expiresAt: Date.now() - 1,
    });
    const user = userEvent.setup();
    renderHeader();
    const dialog = await openToRole(user);
    await user.click(within(dialog).getByRole("button", { name: /^Customer/ }));
    await waitFor(() =>
      expect(within(dialog).getByRole("alert").textContent).toContain("expired")
    );
    expect(mocks.profileGet).not.toHaveBeenCalled();
    expect(mocks.profileSave).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("rejects malformed mobile input without requesting a code and restores focus after escape", async () => {
    const user = userEvent.setup();
    renderHeader();
    const trigger = authRows()[0].getByRole("button", { name: "Sign in" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByRole("textbox", {
      name: "Mobile number",
    });
    await user.type(input, "not-a-number");
    await user.click(
      within(dialog).getByRole("button", { name: "Continue", exact: true })
    );
    expect(within(dialog).getByRole("alert").textContent).toContain(
      "numbers only"
    );
    expect(mocks.request).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
  it("locks duplicate verification while pending", async () => {
    let resolve!: (value: unknown) => void;
    mocks.verify.mockImplementationOnce(
      () =>
        new Promise(r => {
          resolve = r;
        })
    );
    const user = userEvent.setup();
    renderHeader();
    await user.click(authRows()[0].getByRole("button", { name: "Sign in" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByRole("textbox", { name: "Mobile number" }),
      "0500000098"
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Continue", exact: true })
    );
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
    resolve({
      phone: "0500000098",
      verificationToken: "ticket",
      accessToken: "access",
      expiresAt: Date.now() + 900_000,
    });
    await within(dialog).findByRole("button", { name: /^Customer/ });
  });
});
