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
const assistantAvatar = readSource("./components/AssistantAvatar.tsx");
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

  it("يبقي الشركة والمعرفات ومفاتيح التخزين وأصول الهاتف ويحدّث أيقونة الهوية فقط", () => {
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

    expect(documentHtml).toContain('/manus-storage/maalamati-care-icon-180_03dff29d.png');
    expect(documentHtml).toContain('/manus-storage/maalamati-care-icon-64_24a83194.png');
    expect(manifest.icons.map(icon => icon.src)).toContain('/manus-storage/maalamati-care-icon-512_a8c15010.png');
    expect(manifest.icons.map(icon => icon.src)).toContain('/manus-storage/maalamati-care-icon-192_6fc97013.png');
    for (const worker of [serviceWorker, versionedServiceWorker]) {
      expect(worker).toContain('const CACHE_NAME = "maalamati-shell-v6"');
      expect(worker).toContain('/manus-storage/maalamati-care-icon-192_6fc97013.png');
    }
    expect(assistantUi.match(/<AssistantAvatar\s*\/>/g)).toHaveLength(2);
    expect(assistantAvatar).toContain('/manus-storage/maalamati-assistant-avatar-original_dac6bf34.webp');
    expect(assistantUi).not.toContain('/manus-storage/maalamati-assistant-avatar_1d2f6239.png');
    expect(notificationCenter).toContain('/manus-storage/maalamati-quote-alert_818d0073_ab955c73.wav');
    expect(appShowcase).toContain('/manus-storage/maalamati-my-requests-demo_0ac8bb82_c4d30924.mp4');
    expect(appShowcase).toContain('/manus-storage/maalamati-requests-scene-1_a053dcd8.webp');
  });
});
