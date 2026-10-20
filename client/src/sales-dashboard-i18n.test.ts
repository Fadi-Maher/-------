// @vitest-environment jsdom
import React, { createElement as h } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { LanguageProvider } from "./contexts/LanguageContext";
import { LANGUAGE_STORAGE_KEY } from "./lib/language";
import {
  DAY_LABELS,
  SALES_LANG_KEY,
  SALES_STRINGS,
  SalesLanguageToggle,
  resetSalesLang,
  salesText,
  setSalesLang,
  useSalesLang,
  type SalesKey,
} from "./components/leadbot/dashboard/salesI18n";
import { errorText, gradeLabel, intentLabel, relativeTime, scoreFactorLabel, serviceOptions, statusLabel } from "./components/leadbot/dashboard/labels";

(globalThis as unknown as { React: typeof React }).React = React;

const ARABIC = /[\u0600-\u06FF]/;
const placeholders = (text: string) => Array.from(text.matchAll(/\{(\w+)\}/g), (match) => match[1]).sort();

function Probe() {
  const { lang, dir, t } = useSalesLang();
  return h("section", { "data-testid": "probe", dir, lang }, t("tabLeads"), " | ", t("countLive", { count: 3 }));
}

function renderDashboard() {
  return render(h(LanguageProvider, null, h(SalesLanguageToggle), h(Probe)));
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(LANGUAGE_STORAGE_KEY, "ar");
  resetSalesLang();
});

afterEach(() => cleanup());

describe("sales dashboard dictionary", () => {
  it("has a complete English translation for every Arabic string, with the same placeholders", () => {
    const keys = Object.keys(SALES_STRINGS.ar) as SalesKey[];
    expect(keys.length).toBeGreaterThan(150);
    expect(Object.keys(SALES_STRINGS.en).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      const ar = SALES_STRINGS.ar[key];
      const en = SALES_STRINGS.en[key];
      expect(en.trim(), key).not.toBe("");
      expect(ARABIC.test(en), `${key} must not contain Arabic in English`).toBe(false);
      expect(placeholders(en), key).toEqual(placeholders(ar));
    }
    expect(DAY_LABELS.en).toHaveLength(7);
    expect(DAY_LABELS.en[0]).toBe("Sunday");
  });

  it("fills placeholders and keeps unknown ones visible", () => {
    expect(salesText("en", "countLive", { count: 4 })).toBe("4 leads");
    expect(salesText("ar", "countLive", { count: 4 })).toBe("4 عميل محتمل");
    expect(salesText("en", "alertSummary", { waiting: 1, hot: 2, unread: 3 })).toBe(
      "Sales assistant: 1 waiting for an agent, 2 new hot leads, 3 unread messages",
    );
    expect(salesText("en", "lastDays")).toBe("Last {days} days");
  });
});

describe("sales dashboard language switch", () => {
  it("follows the site language when nothing was chosen", () => {
    renderDashboard();
    const probe = screen.getByTestId("probe");
    expect(probe.getAttribute("dir")).toBe("rtl");
    expect(probe.textContent).toContain("العملاء المحتملون");
    expect(screen.getByRole("button", { name: "العربية" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("switches only the dashboard to English, remembers it and announces the change", () => {
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    const probe = screen.getByTestId("probe");
    expect(probe.getAttribute("dir")).toBe("ltr");
    expect(probe.getAttribute("lang")).toBe("en");
    expect(probe.textContent).toBe("Leads | 3 leads");
    expect(screen.getByRole("button", { name: "English" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("group", { name: "Sales dashboard language" })).toBeTruthy();
    expect(screen.getByText("The sales dashboard is now in English.")).toBeTruthy();
    expect(localStorage.getItem(SALES_LANG_KEY)).toBe("en");
    // The public site language is untouched.
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("ar");
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");

    fireEvent.click(screen.getByRole("button", { name: "العربية" }));
    expect(screen.getByTestId("probe").getAttribute("dir")).toBe("rtl");
    expect(localStorage.getItem(SALES_LANG_KEY)).toBe("ar");
  });

  it("uses a saved choice over the site language and syncs every mounted consumer", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    setSalesLang("ar");
    render(h(LanguageProvider, null, h(Probe), h(Probe)));
    expect(screen.getAllByTestId("probe").every((node) => node.getAttribute("dir") === "rtl")).toBe(true);
    act(() => setSalesLang("en"));
    expect(screen.getAllByTestId("probe").map((node) => node.textContent)).toEqual(["Leads | 3 leads", "Leads | 3 leads"]);
  });
});

describe("sales dashboard labels in English", () => {
  it("translates statuses, grades, intents, services, score reasons and errors", () => {
    expect(statusLabel("won", "en")).toBe("Became a customer");
    expect(statusLabel("won", "ar")).toBe("تحوّل لعميل");
    expect(gradeLabel("hot", "en")).not.toMatch(ARABIC);
    expect(intentLabel("talk_to_human", "en")).toBe("Asked for an agent");
    expect(intentLabel("unknown_intent", "en")).toBe("unknown_intent");
    expect(serviceOptions("en").every((option) => !ARABIC.test(option.label))).toBe(true);
    // Reasons are stored in the visitor's language; the dashboard shows its own.
    expect(scoreFactorLabel("urgent", "يحتاجها خلال 48 ساعة", "en")).toBe("Needs it within 48h");
    expect(scoreFactorLabel("not_a_factor", "سبب قديم", "en")).toBe("سبب قديم");
    const now = Date.UTC(2026, 9, 20, 12, 0);
    expect(relativeTime(now - 5 * 60_000, "en", now)).toBe("5 minutes ago");
    expect(relativeTime(now, "en", now)).toBe("now");
    expect(errorText({ data: { code: "FORBIDDEN" } }, "x", "en")).toBe("You don't have permission to do this.");
    expect(errorText(new Error("boom"), "Fallback", "en")).toBe("Fallback");
  });
});

describe("sales dashboard has no hard-coded Arabic UI text", () => {
  const dir = join(__dirname, "components/leadbot/dashboard");
  const files = [
    ...readdirSync(dir)
      .filter((name) => name.endsWith(".tsx") && name !== "salesI18n.tsx")
      .map((name) => join(dir, name)),
    join(__dirname, "pages/SalesAssistantPage.tsx"),
  ];

  it("routes every visible string through the dictionary", () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
    for (const file of files) {
      const offending = readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => ARABIC.test(line))
        .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
        .filter((line) => !line.includes('"؟"'));
      expect(offending, file).toEqual([]);
    }
  });

  it("puts the toggle in the page header and mirrors layout with the dashboard language", () => {
    const page = readFileSync(join(__dirname, "pages/SalesAssistantPage.tsx"), "utf8");
    expect(page).toContain("<SalesLanguageToggle />");
    expect(page).toContain('dir={dir} lang={lang}');
    const detail = readFileSync(join(dir, "LeadDetail.tsx"), "utf8");
    expect(detail).toContain('side={dir === "rtl" ? "left" : "right"} dir={dir} lang={lang}');
    const leads = readFileSync(join(dir, "LeadsTab.tsx"), "utf8");
    expect(leads).not.toMatch(/\b(rtl|ltr):/);
  });
});
