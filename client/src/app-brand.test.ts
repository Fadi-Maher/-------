import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const documentHtml = readSource("../index.html");
const manifest = JSON.parse(readSource("../public/manifest.webmanifest")) as { name: string; short_name: string; icons: Array<{ src: string }> };
const publicHeader = readSource("./components/PublicHeader.tsx");
const publicFooter = readSource("./components/PublicFooter.tsx");
const ownerLogin = readSource("./pages/OwnerLogin.tsx");
const customerSignup = readSource("./pages/CustomerSignup.tsx");
const pwaInstall = readSource("./components/PwaInstall.tsx");
const assistantUi = readSource("./components/MaalamatiAssistant.tsx");
const assistantServer = readSource("../../server/publicAssistant.ts");
const exportHelpers = readSource("./lib/dataExport.ts");
const customerSession = readSource("./lib/customerSession.ts");
const notificationCenter = readSource("./components/CustomerNotificationCenter.tsx");
const appShowcase = readSource("./components/AppShowcaseSection.tsx");
const serviceWorker = readSource("../public/sw.js");
const versionedServiceWorker = readSource("../public/sw-v4.js");
const sharedConstants = readSource("../../shared/const.ts");
const terms = readSource("./pages/TermsAndConditions.tsx");
const refundPolicy = readSource("./pages/RefundAndCancellation.tsx");

const publicBrandSurfaces = [
  ["PublicHeader", publicHeader],
  ["PublicFooter", publicFooter],
  ["OwnerLogin", ownerLogin],
  ["PwaInstall", pwaInstall],
] as const;

describe("Maalamati Care brand regression", () => {
  it("يعرّف الاسم العربي الجديد في title ووسم Apple وبيان PWA", () => {
    expect(documentHtml).toContain("<title>معاملاتي كير</title>");
    expect(documentHtml).toContain('<meta name="apple-mobile-web-app-title" content="معاملاتي كير" />');
    expect(manifest.name).toBe("معاملاتي كير");
    expect(manifest.short_name).toBe("معاملاتي كير");
  });

  it("يعرض Maalamati Care ومعاملاتي كير في كل أسطح الدخول والتثبيت العامة", () => {
    for (const [surface, source] of publicBrandSurfaces) {
      expect(source, `${surface} should include the English display name`).toContain("Maalamati Care");
      expect(source, `${surface} should include the Arabic display name`).toContain("معاملاتي كير");
    }
    expect(customerSignup).toContain("<PublicHeader");
  });

  it("يسمي المساعد العام الجديد صراحة ويحصر نطاقه في خدمات Maalamati Care", () => {
    expect(assistantServer).toContain("Approved Maalamati Care knowledge base");
    expect(assistantServer).toContain("You are the public Maalamati Care assistant");
    expect(assistantServer).toContain("public guidance about Maalamati Care");
    expect(assistantUi).toContain("Maalamati Care");
    expect(assistantUi).toContain("معاملاتي كير");
  });

  it("يحدث تذييل التصدير وإشعار PWA الافتراضي إلى الاسم العربي الجديد", () => {
    expect(exportHelpers).toContain("<footer>معاملاتي كير — ستريك إكسبريس</footer>");
    for (const worker of [serviceWorker, versionedServiceWorker]) {
      expect(worker).toContain('{ title: "معاملاتي كير", body: "لديك تحديث جديد." }');
    }
  });

  it("يبقي رقم الشركة والمعرفات ومفاتيح التخزين ومسارات الأصول الحالية بلا ترحيل", () => {
    expect(publicFooter).toContain("7051197981");
    expect(terms).toContain("7051197981");
    expect(refundPolicy).toContain("7051197981");

    expect(sharedConstants).toContain('COOKIE_NAME = "app_session_id"');
    expect(sharedConstants).toContain('OAUTH_STATE_COOKIE = "__Host-oauth_state"');
    expect(customerSession).toContain('"maalamati:customer-session-changed"');
    for (const key of [
      "maalamati_customer_name",
      "maalamati_customer_phone",
      "maalamati_customer_access_token",
      "maalamati-assistant-history-consent",
      "maalamati-assistant-history-session",
      "maalamati_customer_quote_sound",
    ]) {
      expect(`${customerSession}\n${assistantUi}\n${notificationCenter}`).toContain(key);
    }

    expect(documentHtml).toContain('/manus-storage/maalamatak-brandmark_6e18d835.png');
    expect(manifest.icons.map(icon => icon.src)).toContain('/manus-storage/maalamatak-brandmark_6e18d835.png');
    for (const worker of [serviceWorker, versionedServiceWorker]) {
      expect(worker).toContain('const CACHE_NAME = "maalamati-shell-v5"');
      expect(worker).toContain('/manus-storage/maalamatak-brandmark_6e18d835.png');
    }
    expect(assistantUi).toContain('/manus-storage/maalamati-assistant-avatar_1d2f6239.png');
    expect(notificationCenter).toContain('/manus-storage/maalamati-quote-alert_818d0073.wav');
    expect(appShowcase).toContain('/manus-storage/maalamati-my-requests-demo_0ac8bb82.mp4');
    expect(appShowcase).toContain('/manus-storage/maalamati-requests-scene-1_7c388ba9.png');
  });
});
