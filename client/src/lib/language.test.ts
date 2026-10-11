import { describe, expect, it } from "vitest";
import { getLanguageDirection, resolveLanguage, toggleLanguage } from "./language";

describe("language helpers", () => {
  it("uses Arabic as the safe default", () => {
    expect(resolveLanguage(null)).toBe("ar");
    expect(resolveLanguage("unsupported")).toBe("ar");
  });

  it("preserves English and toggles in both directions", () => {
    expect(resolveLanguage("en")).toBe("en");
    expect(toggleLanguage("ar")).toBe("en");
    expect(toggleLanguage("en")).toBe("ar");
  });

  it("maps languages to the correct document direction", () => {
    expect(getLanguageDirection("ar")).toBe("rtl");
    expect(getLanguageDirection("en")).toBe("ltr");
  });
});
