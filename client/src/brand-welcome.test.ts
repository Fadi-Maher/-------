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
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const mocks = vi.hoisted(() => ({
  isEnglish: false,
  toggle: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("./contexts/LanguageContext", () => ({
  useLanguage: () => ({
    isEnglish: mocks.isEnglish,
    toggleLanguage: mocks.toggle,
  }),
}));
vi.mock("wouter", () => ({ useLocation: () => ["/", mocks.navigate] }));
import { BrandWelcome, WelcomePage } from "./components/BrandWelcome";
import { WELCOME_STORAGE_KEY } from "./lib/welcome";
beforeAll(() => {
  vi.stubGlobal("React", React);
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.isEnglish = false;
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});
afterEach(cleanup);
describe("ترحيب معاملاتي كير", () => {
  it("opens once on the home page, focuses the start button and persists dismissal only", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "maalamati_customer_access_token",
      "keep-existing-session"
    );
    render(h(BrandWelcome));
    expect(
      screen.getByRole("dialog", { name: "مرحبًا بك في معاملاتي كير" })
    ).toBeTruthy();
    const start = screen.getByRole("button", { name: "لنبدأ" });
    await waitFor(() => expect(document.activeElement).toBe(start));
    await user.click(start);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(localStorage.getItem(WELCOME_STORAGE_KEY)).toBe("seen");
    expect(localStorage.getItem("maalamati_customer_access_token")).toBe(
      "keep-existing-session"
    );
    cleanup();
    render(h(BrandWelcome));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("supports immediate skip and language change, with no timed wait", async () => {
    const user = userEvent.setup();
    render(h(BrandWelcome));
    await user.click(screen.getByRole("button", { name: "Switch to English" }));
    expect(mocks.toggle).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "تخطي الترحيب" }));
    expect(localStorage.getItem(WELCOME_STORAGE_KEY)).toBe("seen");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("supports Escape to dismiss and leaves existing navigation untouched", async () => {
    render(h(BrandWelcome));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(localStorage.getItem(WELCOME_STORAGE_KEY)).toBe("seen");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("never intercepts request, account, portal or in-page links on first arrival", () => {
    for (const path of [
      "/team-request/7",
      "/agent-dashboard",
      "/customer-account",
      "/#request",
      "/welcome",
    ]) {
      window.history.replaceState({}, "", path);
      render(h(BrandWelcome));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(localStorage.getItem(WELCOME_STORAGE_KEY)).toBeNull();
      cleanup();
    }
  });
  it("provides a replay page in English that returns home without showing onboarding again", async () => {
    const user = userEvent.setup();
    mocks.isEnglish = true;
    render(h(WelcomePage));
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Welcome to Maalamati Care",
      })
    ).toBeTruthy();
    expect(screen.getByRole("main").querySelector('[dir="ltr"]')).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Let's get started" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/");
    expect(localStorage.getItem(WELCOME_STORAGE_KEY)).toBe("seen");
  });
});
