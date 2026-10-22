import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PHONE_TRACKING_PAUSED, arabicServiceCopy, englishServiceCopy, homeTrackingCopy } from "./lib/phoneTrackingCopy";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("./pages/Home.tsx");
const footer = read("./components/PublicFooter.tsx");
const header = read("./components/PublicHeader.tsx");

// Self-service tracking wording: the tracking page, verifying a code, or tracking/following by mobile number.
// "تعقّب المعاملات" is the name of the follow-up service the team performs, so it is allowed.
const SELF_TRACKING = /(تتبّع|تتبع|التتبع|رمز|تحقق من|برقم جوالك|باستخدام رقم جوالك|تابع ما يتم|عد إلى سجل|\/track|[Tt]rack|verify|code|tracking)/;

const allText = (value: unknown): string[] =>
  typeof value === "string" ? [value] : Array.isArray(value) ? value.flatMap(allText) : value && typeof value === "object" ? Object.values(value).flatMap(allText) : [];

describe("phone-tracking copy while tracking is paused", () => {
  it("follows the same live-site switch as the verification pause", () => {
    expect(PHONE_TRACKING_PAUSED).toBe(import.meta.env.PROD);
  });

  it("never invites visitors to track by mobile number in either language", () => {
    for (const isEnglish of [false, true]) {
      for (const text of allText(homeTrackingCopy(isEnglish, true))) expect(text).not.toMatch(SELF_TRACKING);
    }
    for (const text of allText(arabicServiceCopy(true))) expect(text).not.toMatch(SELF_TRACKING);
    for (const text of allText(englishServiceCopy(true))) expect(text).not.toMatch(SELF_TRACKING);
    expect(englishServiceCopy(true).trackServiceName).toBe("Transaction follow-up");
  });

  it("points the tracking card and footer link to the request form instead of /track", () => {
    for (const isEnglish of [false, true]) {
      const copy = homeTrackingCopy(isEnglish, true);
      expect(copy.followCard.href).toBe("/#request");
      expect(copy.footerTrackLink.href).toBe("/#request");
    }
    expect(homeTrackingCopy(false, true).footerTrackLink.label).toBe("تعقّب المعاملات");
    expect(homeTrackingCopy(true, true).footerTrackLink.label).toBe("Transaction follow-up");
    expect(homeTrackingCopy(true, true).serviceLabel).toBe("Transaction follow-up");
    expect(homeTrackingCopy(true, false).serviceLabel).toBe("Track requests");
  });

  it("replaces the two tracking FAQ entries with answers that match the live request flow", () => {
    expect(homeTrackingCopy(false, true).faq.map(([question]) => question)).toEqual(["كيف أعرف مستجدات طلبي؟", "هل أحتاج إلى حساب لإرسال طلب؟"]);
    expect(homeTrackingCopy(true, true).faq.map(([question]) => question)).toEqual(["How will I hear about my request?", "Do I need an account to send a request?"]);
  });

  it("keeps the original copy so tracking can be restored by flipping one switch", () => {
    const live = homeTrackingCopy(false, false);
    expect(live.followCard).toMatchObject({ title: "تتبّع برقم جوالك", href: "/track" });
    expect(live.faq[0][0]).toBe("كيف أتابع طلبي؟");
    expect(homeTrackingCopy(true, false).whyItem.title).toBe("Mobile-number tracking");
    expect(arabicServiceCopy(false).individualTrack).toContain("رقم جوالك");
    expect(englishServiceCopy(false)).toMatchObject({ trackServiceName: "Track a transaction", trustStrip: "Orderly tracking" });
  });

  it("leaves no hard-coded tracking copy in the home page, header or footer", () => {
    for (const source of [home, footer, header]) {
      expect(source).not.toContain('href="/track"');
      expect(source).not.toContain('"Track requests"');
      expect(source).not.toMatch(/تتبّع برقم|وتابع جميع التحديثات|صفحة التتبع|Track with your mobile|tracking page/);
    }
    expect(home).not.toMatch(/Track a transaction|Orderly tracking|follow the work in one place/);
    expect(home).toContain("<option value=\"track\">{serviceCopyEn.trackServiceName}</option>");
    expect(home).toContain("[...trackingAr.faq, ");
    expect(home).toContain("[...trackingEn.faq, ");
    expect(home).toContain("href={trackingAr.followCard.href}");
    expect(home).toContain("href={trackingEn.followCard.href}");
    expect(footer).toContain("homeTrackingCopy(false).footerTrackLink");
    expect(footer).toContain("homeTrackingCopy(true).footerTrackLink");
    expect(header.match(/en: homeTrackingCopy\(true\)\.serviceLabel/g)).toHaveLength(2);
  });
});
