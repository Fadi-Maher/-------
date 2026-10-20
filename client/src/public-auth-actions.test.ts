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
  auth: {
    user: null as AuthUser | null,
    loading: false,
  },
  logout: vi.fn(),
  toggleLanguage: vi.fn(),
  isEnglish: true,
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

vi.mock("./components/CustomerAuthForm", () => ({ CustomerAuthForm: () => h("input", { "aria-label": "Mock customer phone", "data-testid": "customer-modal-form" }) }));
vi.mock("./components/AgentAuthForm", () => ({ AgentAuthForm: () => h("input", { "aria-label": "Mock agent phone", "data-testid": "agent-modal-form" }) }));

import { PublicHeader } from "./components/PublicHeader";
import { AuthModal } from "./components/AuthModal";

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
    const signIn = row.getByRole("button", { name: "Sign in" });
    const createAccount = row.getByRole("button", { name: "Create account" });

    expect(signIn.textContent?.trim()).toContain("Sign in");
    expect(createAccount.textContent?.trim()).toContain("Create account");
    expect(createAccount.getAttribute("href")).toBeNull();
  }

  // The account menu must not add a third login trigger: exactly one belongs
  // to each responsive public-auth row, even though jsdom renders both rows.
  expect(screen.getAllByRole("button", { name: "Sign in" })).toHaveLength(2);
}

function renderHeader() {
  return render(h(React.Fragment, null, h(PublicHeader, { onChooseService: vi.fn() }), h(AuthModal)));
}

beforeAll(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
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
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.user = null;
  mocks.auth.loading = false;
  mocks.isEnglish = true;
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

afterEach(cleanup);

describe("إجراءات الدخول العامة", () => {
  it.each([
    ["loading", null, true],
    ["guest", null, false],
    ["admin", publicUser("admin"), false],
    ["agent", publicUser("agent"), false],
    ["employee", publicUser("employee"), false],
    ["user", publicUser("user"), false],
  ] as const)(
    "does not hide Sign in or Create account for useAuth state %s",
    (_state, user, loading) => {
      mocks.auth.user = user;
      mocks.auth.loading = loading;

      renderHeader();

      expectPersistentPublicAuthActions();
    }
  );

  it("keeps the public actions when a complete local customer session exists", () => {
    localStorage.setItem("maalamati_customer_name", "Nora Customer");
    localStorage.setItem("maalamati_customer_phone", "+966500000000");
    localStorage.setItem("maalamati_customer_access_token", "valid-local-token");

    renderHeader();

    expectPersistentPublicAuthActions();
  });

  it("uses visible compact text, opens the chooser and customer form without navigation, and restores trigger focus after Escape", async () => {
    const user = userEvent.setup();
    renderHeader();

    const desktopActions = within(screen.getByTestId("public-auth-desktop"));
    const mobileActions = within(screen.getByTestId("public-auth-mobile"));
    const desktopSignIn = desktopActions.getByRole("button", { name: "Sign in" });
    const mobileSignIn = mobileActions.getByRole("button", { name: "Sign in" });

    // This inspects rendered text rather than the accessible-name/aria-label,
    // preventing an icon-only compact trigger from passing the test.
    expect(mobileSignIn.textContent?.trim()).toContain("Sign in");

    await user.click(desktopSignIn);
    const dialog = await screen.findByRole("dialog", {
      name: "How would you like to continue?",
    });

    expect(
      within(dialog).getByRole("button", { name: "Service requester" })
    ).toBeDefined();
    expect(
      within(dialog).getByRole("button", { name: "Transaction specialist" })
    ).toBeDefined();
    expect(
      document.querySelector('a[href="/dashboard"], a[href="/owner-login"]')
    ).toBeNull();

    await user.click(within(dialog).getByRole("button", { name: "Service requester" }));
    expect(await screen.findByTestId("customer-modal-form")).toBeDefined();
    expect(window.location.pathname).toBe("/");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(desktopSignIn);
  });

  it("does not expose a public owner or general-administration link for an admin session", () => {
    mocks.auth.user = publicUser("admin");
    renderHeader();

    expectPersistentPublicAuthActions();
    expect(
      document.querySelector('a[href="/dashboard"], a[href="/owner-login"]')
    ).toBeNull();
  });
});
