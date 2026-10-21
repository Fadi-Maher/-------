import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { readCustomerSession } from "./lib/customerSession";
import { submitPublicRequest } from "./lib/publicRequestSubmission";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("./pages/Home.tsx");
const notice = read("./components/PhoneVerificationUnavailable.tsx");
const authModal = read("./components/AuthModal.tsx");
const customerAuthForm = read("./components/CustomerAuthForm.tsx");
const trackPage = read("./pages/TrackRequest.tsx");
const customerSignupPage = read("./pages/CustomerSignup.tsx");

const draft = { requesterName: "عميل", phone: "0500000000", category: "طلب خدمة" as const, details: "تفاصيل الطلب" };

describe("live public request submission", () => {
  it("saves directly in production and returns the reference", async () => {
    const create = vi.fn().mockResolvedValue({ id: 7, reference: "SE-LIVE-1", ownerNotified: true });
    await expect(submitPublicRequest(draft, { isProduction: true, create })).resolves.toEqual({ mode: "saved", reference: "SE-LIVE-1" });
    expect(create).toHaveBeenCalledWith(draft);
  });
  it("keeps the explicit demo verification step in development without saving early", async () => {
    const create = vi.fn();
    await expect(submitPublicRequest(draft, { isProduction: false, create })).resolves.toEqual({ mode: "verify" });
    expect(create).not.toHaveBeenCalled();
  });
  it("surfaces save failures instead of reporting success", async () => {
    const create = vi.fn().mockRejectedValue(new Error("يرجى اختيار فئة الخدمة الفرعية."));
    await expect(submitPublicRequest(draft, { isProduction: true, create })).rejects.toThrow("فئة الخدمة");
  });
  it("routes both Arabic and English home forms through the direct live save before any demo code", () => {
    expect(home.match(/submitPublicRequest\(draft, \{ isProduction: import\.meta\.env\.PROD/g)).toHaveLength(2);
    expect(home.match(/setSavedDirectly\(true\)/g)).toHaveLength(2);
    for (const block of home.split("const handleRequest = async").slice(1)) {
      const flow = block.slice(0, block.indexOf("const approvePendingRequest"));
      expect(flow.indexOf("submitPublicRequest")).toBeGreaterThan(-1);
      expect(flow.indexOf("submitPublicRequest")).toBeLessThan(flow.indexOf("setVerificationOpen(true)"));
    }
    expect(home).toContain("تم استلام طلبك بنجاح، وسنتواصل معك على الجوال");
    expect(home).toContain("Your request was received. We will contact you on");
    expect(home).not.toMatch(/رقم مرجعي|reference number/i);
  });
});

describe("stale demo customer sessions on the live site", () => {
  const storage = { getItem: (key: string) => ({ maalamati_customer_name: "عميل", maalamati_customer_phone: "0500000000", maalamati_customer_access_token: "demo-token" } as Record<string, string>)[key] ?? null };
  it("ignores a stored demo session when phone sessions are disabled", () => {
    expect(readCustomerSession(storage, false)).toBeNull();
  });
  it("still reads the session in development", () => {
    expect(readCustomerSession(storage, true)).toEqual({ name: "عميل", phone: "0500000000", accessToken: "demo-token" });
  });
});

describe("temporary pause notice design", () => {
  it("uses expressive icons for the device, lock, protection, records, new request and support", () => {
    for (const icon of ["Smartphone", "LockKeyhole", "ShieldCheck", "FileCheck2", "Send", "Headset", "House"]) {
      expect(notice).toContain(`${icon}`);
    }
    expect(notice).toContain("motion-safe:animate-ping");
  });
  it("offers real next steps in both languages without promising phone access", () => {
    expect(notice).toContain('href="/#request"');
    expect(notice).toContain('href="/contact"');
    expect(notice).toContain("الطلبات الجديدة متاحة");
    expect(notice).toContain("New requests are open");
    expect(notice).not.toContain("123456");
  });
  it("keeps decorative icons hidden and the heading level correct per context", () => {
    expect(notice).toContain('const Heading = isCard ? "h1" : "h3"');
    expect(notice).toContain("aria-labelledby={headingId}");
    expect(notice).not.toContain('role="status"');
    expect(notice.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(8);
  });
  it("is wired as a compact dialog, a sign-up card and a full tracking page", () => {
    expect(authModal).toContain('<PhoneVerificationUnavailable variant="dialog" onNavigate={() => setOpen(false)} />');
    expect(customerAuthForm).toContain('variant={props.variant === "modal" ? "dialog" : "card"}');
    expect(trackPage).toContain('<PhoneVerificationUnavailable variant="card" context="track" />');
    expect(trackPage).toContain("<PublicHeader");
  });
  it("describes the paused state to screen readers instead of asking for a code", () => {
    const description = authModal.slice(authModal.indexOf('<DialogDescription className="sr-only">'), authModal.indexOf("</DialogDescription>"));
    expect(description.indexOf("import.meta.env.PROD")).toBeGreaterThan(-1);
    expect(description).toContain("الدخول بالجوال متوقف مؤقتًا حتى ربط خدمة تحقق فعلية.");
    expect(description.indexOf("import.meta.env.PROD")).toBeLessThan(description.indexOf("أدخل رقم الجوال وتحقق من الرمز"));
  });
  it("scrolls /#request links to the form after the page renders", () => {
    expect(home).toContain("useInitialHashScroll();");
    expect(home).toContain("document.getElementById(id)?.scrollIntoView({ block: \"start\" })");
    expect(notice).toContain("text-balance");
  });
  it("hides the verify-your-mobile side panel on the live sign-up page", () => {
    expect(customerSignupPage).toContain("const phonePaused = import.meta.env.PROD;");
    expect(customerSignupPage).toContain('<section className={phonePaused ? "hidden" : "hidden lg:block"}>');
  });
});
