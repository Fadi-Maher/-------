import { describe, expect, it } from "vitest";
import {
  findPhoneMatch,
  isCompleteSaudiMobile,
  looksLikePhoneQuery,
  matchesApplicationSearch,
  normalizePhoneQuery,
  toAsciiDigits,
} from "../client/src/lib/phoneSearch";

describe("owner phone search", () => {
  it("normalizes every common Saudi mobile variant to the stored form", () => {
    expect(normalizePhoneQuery("+966 50 123 4567")).toBe("0501234567");
    expect(normalizePhoneQuery("00966501234567")).toBe("0501234567");
    expect(normalizePhoneQuery("966501234567")).toBe("0501234567");
    expect(normalizePhoneQuery("501234567")).toBe("0501234567");
    expect(normalizePhoneQuery("٠٥٠١٢٣٤٥٦٧")).toBe("0501234567");
    expect(normalizePhoneQuery("۰۵۰۱-۲۳۴-۵۶۷")).toBe("0501234567");
    expect(normalizePhoneQuery("(050) 123.4567")).toBe("0501234567");
    expect(toAsciiDigits("٠٥ab٩")).toBe("059");
  });

  it("treats only phone-shaped input as a phone query", () => {
    expect(looksLikePhoneQuery("+966 5")).toBe(true);
    expect(looksLikePhoneQuery("٠٥٥")).toBe(true);
    expect(looksLikePhoneQuery("Amina 05")).toBe(false);
    expect(looksLikePhoneQuery("   ")).toBe(false);
    expect(looksLikePhoneQuery("+-")).toBe(false);
  });

  it("finds partial and exact matches and the range to highlight", () => {
    expect(findPhoneMatch("0501234567", "1234")).toEqual({ start: 3, end: 7 });
    expect(findPhoneMatch("0501234567", "+96650")).toEqual({ start: 0, end: 3 });
    expect(findPhoneMatch("+966501234567", "0501234567")).toEqual({ start: 0, end: 10 });
    expect(findPhoneMatch("0501234567", "0559")).toBeNull();
    expect(isCompleteSaudiMobile("0501234567")).toBe(true);
    expect(isCompleteSaudiMobile("050123456")).toBe(false);
  });

  it("never falls back to name matching for a phone-shaped query", () => {
    const application = { fullName: "Agent 05", phone: "0551234567" };
    expect(matchesApplicationSearch(application, "")).toBe(true);
    expect(matchesApplicationSearch(application, "agent")).toBe(true);
    expect(matchesApplicationSearch(application, "05")).toBe(true);
    expect(matchesApplicationSearch(application, "0559")).toBe(false);
    expect(matchesApplicationSearch({ fullName: "رقم 0559", phone: "0551234567" }, "0559")).toBe(false);
  });
});
