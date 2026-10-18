import { describe, expect, it, vi } from "vitest";
import {
  markWelcomeSeen,
  shouldShowWelcome,
  WELCOME_STORAGE_KEY,
} from "./lib/welcome";

const rootLocation = { pathname: "/", hash: "" };

describe("welcome helpers", () => {
  it("uses the versioned Maalamati Care welcome storage key", () => {
    expect(WELCOME_STORAGE_KEY).toBe("maalamati-care-welcome-v1");
  });

  it("shows the welcome dialog on a first visit to the root route", () => {
    const getItem = vi.fn(() => null);

    expect(shouldShowWelcome(rootLocation, { getItem })).toBe(true);
    expect(getItem.mock.calls).toEqual([[WELCOME_STORAGE_KEY]]);
  });

  it("does not show the welcome dialog after it has been seen", () => {
    const getItem = vi.fn(() => "seen");

    expect(shouldShowWelcome(rootLocation, { getItem })).toBe(false);
    expect(getItem.mock.calls).toEqual([[WELCOME_STORAGE_KEY]]);
  });

  it("never shows the welcome dialog on deep links", () => {
    const getItem = vi.fn(() => null);

    for (const pathname of [
      "/customer-account",
      "/team-request/7",
      "/agent-dashboard",
      "/owner-login",
      "/welcome",
    ]) {
      expect(shouldShowWelcome({ pathname, hash: "" }, { getItem })).toBe(false);
    }

    expect(getItem).not.toHaveBeenCalled();
  });

  it("never shows the welcome dialog for a root URL with a hash", () => {
    const getItem = vi.fn(() => null);

    expect(shouldShowWelcome({ pathname: "/", hash: "#request" }, { getItem })).toBe(false);
    expect(shouldShowWelcome({ pathname: "/", hash: "#anything" }, { getItem })).toBe(false);
    expect(getItem).not.toHaveBeenCalled();
  });

  it("fails open when welcome storage cannot be read", () => {
    const getItem = vi.fn(() => {
      throw new Error("storage unavailable");
    });

    expect(shouldShowWelcome(rootLocation, { getItem })).toBe(true);
    expect(getItem.mock.calls).toEqual([[WELCOME_STORAGE_KEY]]);
  });

  it("records only the welcome marker, with no phone or cookie writes", () => {
    const setItem = vi.fn();

    markWelcomeSeen({ setItem });

    expect(setItem.mock.calls).toEqual([[WELCOME_STORAGE_KEY, "seen"]]);
  });

  it("continues normally when welcome storage cannot be written", () => {
    const setItem = vi.fn(() => {
      throw new Error("storage unavailable");
    });

    expect(() => markWelcomeSeen({ setItem })).not.toThrow();
    expect(setItem.mock.calls).toEqual([[WELCOME_STORAGE_KEY, "seen"]]);
  });

  it("supports unavailable optional storage", () => {
    expect(shouldShowWelcome(rootLocation)).toBe(true);
    expect(() => markWelcomeSeen()).not.toThrow();
  });
});
