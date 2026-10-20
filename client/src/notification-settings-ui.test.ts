// @vitest-environment jsdom
import React, { createElement as h } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  isEnglish: false,
  live: { data: null as unknown, isLoading: false, isError: false },
  templates: { data: [] as unknown[], isLoading: false, isError: false },
  announcements: { data: [] as unknown[], isLoading: false, isError: false, refetch: vi.fn() },
  saveTemplate: vi.fn(),
  resetTemplate: vi.fn(),
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  setActive: vi.fn(),
  deleteAnnouncement: vi.fn(),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ isEnglish: mocks.isEnglish, language: mocks.isEnglish ? "en" : "ar" }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/lib/trpc", () => {
  const mutation = (fn: ReturnType<typeof vi.fn>) => () => ({ mutate: fn, isPending: false, variables: undefined });
  return {
  trpc: {
    useUtils: () => ({
      notificationTemplates: { list: { invalidate: vi.fn() } },
      siteAnnouncements: {
        invalidate: vi.fn(),
        list: { cancel: vi.fn(), getData: vi.fn(), setData: vi.fn() },
      },
    }),
    siteAnnouncements: {
      live: { useQuery: () => mocks.live },
      list: { useQuery: () => mocks.announcements },
      create: { useMutation: mutation(mocks.createAnnouncement) },
      update: { useMutation: mutation(mocks.updateAnnouncement) },
      setActive: { useMutation: mutation(mocks.setActive) },
      delete: { useMutation: mutation(mocks.deleteAnnouncement) },
    },
    notificationTemplates: {
      list: { useQuery: () => mocks.templates },
      save: { useMutation: mutation(mocks.saveTemplate) },
      reset: { useMutation: mutation(mocks.resetTemplate) },
    },
  },
  };
});

import { ANNOUNCEMENT_DISMISS_KEY, AnnouncementBar, isAnnouncementPath } from "./components/AnnouncementBar";
import { NotificationTemplatesPanel } from "./components/settings/NotificationTemplatesPanel";
import { AnnouncementsPanel } from "./components/settings/AnnouncementsPanel";
import { announcementFormToInput, emptyAnnouncementForm, validateAnnouncementForm } from "./lib/announcementForm";
import { fromDateTimeLocalValue, toDateTimeLocalValue } from "./lib/datetimeLocal";

const liveAnnouncement = {
  id: 7,
  version: "7:1000",
  messageAr: "عروض خاصة على تجديد السجلات هذا الأسبوع",
  messageEn: "Special offers on registration renewals this week",
  linkUrl: "/contact",
  linkLabelAr: "تواصل معنا",
  linkLabelEn: "Contact us",
  tone: "info" as const,
  dismissible: true,
};

beforeAll(() => {
  vi.stubGlobal("React", React);
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }),
    });
  }
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isEnglish = false;
  mocks.live = { data: liveAnnouncement, isLoading: false, isError: false };
  mocks.templates = { data: [], isLoading: false, isError: false };
  mocks.announcements = { data: [], isLoading: false, isError: false, refetch: vi.fn() };
  window.localStorage.clear();
  window.history.pushState({}, "", "/");
});
afterEach(cleanup);

describe("public announcement bar", () => {
  it("only targets public marketing pages", () => {
    expect(isAnnouncementPath("/")).toBe(true);
    expect(isAnnouncementPath("/contact/")).toBe(true);
    ["/dashboard", "/settings/notifications", "/customer-account", "/agent-dashboard", "/owner-login", "/team-request/4"].forEach((path) => {
      expect(isAnnouncementPath(path)).toBe(false);
    });
  });

  it("shows the Arabic message with an internal link and remembers dismissal per version", async () => {
    const user = userEvent.setup();
    const { unmount } = render(h(AnnouncementBar));
    const bar = screen.getByRole("complementary", { name: "إعلان الموقع" });
    expect(bar.getAttribute("dir")).toBe("rtl");
    expect(within(bar).getByText(liveAnnouncement.messageAr)).toBeTruthy();
    const link = within(bar).getByRole("link", { name: /تواصل معنا/ });
    expect(link.getAttribute("href")).toBe("/contact");
    expect(link.getAttribute("target")).toBeNull();
    await user.click(within(bar).getByRole("button", { name: "إغلاق الإعلان" }));
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(window.localStorage.getItem(ANNOUNCEMENT_DISMISS_KEY)).toBe("7:1000");
    unmount();
    render(h(AnnouncementBar));
    expect(screen.queryByRole("complementary")).toBeNull();
    cleanup();
    mocks.live = { data: { ...liveAnnouncement, version: "7:2000" }, isLoading: false, isError: false };
    render(h(AnnouncementBar));
    expect(screen.getByRole("complementary")).toBeTruthy();
  });

  it("renders English, opens external links safely and hides the close button when not dismissible", () => {
    mocks.isEnglish = true;
    mocks.live = { data: { ...liveAnnouncement, linkUrl: "https://example.com/offer", dismissible: false, tone: "warning" }, isLoading: false, isError: false };
    render(h(AnnouncementBar));
    const bar = screen.getByRole("complementary", { name: "Site announcement" });
    expect(bar.getAttribute("dir")).toBe("ltr");
    expect(bar.getAttribute("data-tone")).toBe("warning");
    expect(within(bar).getByText(liveAnnouncement.messageEn)).toBeTruthy();
    const link = within(bar).getByRole("link", { name: /Contact us/ });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(within(bar).queryByRole("button")).toBeNull();
  });

  it("never renders on private pages or unsafe links", () => {
    window.history.pushState({}, "", "/dashboard");
    render(h(AnnouncementBar));
    expect(screen.queryByRole("complementary")).toBeNull();
    cleanup();
    window.history.pushState({}, "", "/");
    mocks.live = { data: { ...liveAnnouncement, linkUrl: "javascript:alert(1)" }, isLoading: false, isError: false };
    render(h(AnnouncementBar));
    expect(screen.getByRole("complementary")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("notification templates panel", () => {
  it("edits a template with a live bilingual preview and saves it", async () => {
    const user = userEvent.setup();
    render(h(NotificationTemplatesPanel));
    expect(screen.getByRole("heading", { name: "وصول أول عرض سعر" })).toBeTruthy();
    const save = screen.getByRole("button", { name: "حفظ النص" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    const title = screen.getByLabelText("العنوان بالعربية") as HTMLInputElement;
    await user.clear(title);
    await user.type(title, "عرض جديد بانتظارك");
    expect(screen.getAllByText("عرض جديد بانتظارك").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/350 ر.س/).length).toBeGreaterThan(0);
    expect(save.disabled).toBe(false);
    await user.click(save);
    expect(mocks.saveTemplate).toHaveBeenCalledWith(expect.objectContaining({ key: "customer.first_quote_received", titleAr: "عرض جديد بانتظارك", messageEn: expect.stringContaining("{price}") }));
  });

  it("blocks saving unknown variables and inserts allowed ones at the cursor", async () => {
    const user = userEvent.setup();
    render(h(NotificationTemplatesPanel));
    const message = screen.getByLabelText("نص الإشعار بالعربية") as HTMLTextAreaElement;
    fireEvent.change(message, { target: { value: "مرحبا {phone}" } });
    expect(screen.getByText("المتغير {phone} غير متاح لهذا الإشعار.")).toBeTruthy();
    expect(message.getAttribute("aria-invalid")).toBe("true");
    expect((screen.getByRole("button", { name: "حفظ النص" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(message, { target: { value: "مرحبا " } });
    message.focus();
    message.setSelectionRange(6, 6);
    await user.click(screen.getByRole("button", { name: "إدراج المتغير قيمة العرض" }));
    expect(message.value).toBe("مرحبا {price}");
  });

  it("offers reset only for customised templates and confirms before resetting", async () => {
    const user = userEvent.setup();
    mocks.templates = {
      data: [{ key: "customer.first_quote_received", titleAr: "مخصص", messageAr: "نص {price}", titleEn: "Custom", messageEn: "Text {price}", updatedAt: new Date() }],
      isLoading: false,
      isError: false,
    };
    render(h(NotificationTemplatesPanel));
    expect((screen.getByLabelText("العنوان بالعربية") as HTMLInputElement).value).toBe("مخصص");
    await user.click(screen.getByRole("button", { name: "استعادة الافتراضي" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/الإشعارات المرسلة سابقًا لن تتغير/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "استعادة الافتراضي" }));
    expect(mocks.resetTemplate).toHaveBeenCalledWith({ key: "customer.first_quote_received" });
  });
});

describe("announcements management", () => {
  const now = Date.now();
  const row = (id: number, patch: Record<string, unknown>) => ({
    id,
    messageAr: `إعلان رقم ${id}`,
    messageEn: `Announcement ${id}`,
    linkUrl: null,
    linkLabelAr: null,
    linkLabelEn: null,
    tone: "info",
    isActive: true,
    dismissible: true,
    startsAt: now - 60_000,
    endsAt: null,
    createdByUserId: 1,
    createdAt: new Date(now - id),
    updatedAt: new Date(now - id),
    ...patch,
  });

  it("labels live, scheduled, ended and paused announcements", () => {
    mocks.announcements = {
      data: [row(1, {}), row(2, { startsAt: now + 3_600_000 }), row(3, { startsAt: now - 7_200_000, endsAt: now - 3_600_000 }), row(4, { isActive: false })],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
    render(h(AnnouncementsPanel));
    const list = screen.getByRole("heading", { name: "كل الإعلانات" }).parentElement!;
    ["ظاهر الآن", "مجدول", "منتهٍ"].forEach((label) => expect(within(list).getByText(label)).toBeTruthy());
    expect(within(list).getAllByText("موقوف").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("site-announcement-preview")).toHaveLength(2);
  });

  it("validates the form and sends UTC milliseconds", async () => {
    const user = userEvent.setup();
    render(h(AnnouncementsPanel));
    await user.click(screen.getByRole("button", { name: "إعلان جديد" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("نص الإعلان بالعربية"), "خصم 20% على خدمات التعقيب");
    await user.type(within(dialog).getByLabelText("Announcement in English"), "20% off follow-up services");
    await user.type(within(dialog).getByLabelText(/الرابط/), "javascript:alert(1)");
    await user.click(within(dialog).getByRole("button", { name: "حفظ الإعلان" }));
    expect(within(dialog).getByText(/استخدم رابطًا يبدأ بـ \//)).toBeTruthy();
    expect(mocks.createAnnouncement).not.toHaveBeenCalled();
    const linkInput = within(dialog).getByLabelText(/الرابط/);
    await user.clear(linkInput);
    await user.type(linkInput, "/contact");
    await user.click(within(dialog).getByRole("button", { name: "حفظ الإعلان" }));
    await waitFor(() => expect(mocks.createAnnouncement).toHaveBeenCalledTimes(1));
    const payload = mocks.createAnnouncement.mock.calls[0][0];
    expect(payload).toMatchObject({ messageAr: "خصم 20% على خدمات التعقيب", linkUrl: "/contact", linkLabelAr: null, endsAt: null, tone: "info", isActive: true, dismissible: true });
    expect(typeof payload.startsAt).toBe("number");
    expect(Math.abs(payload.startsAt - Date.now())).toBeLessThan(120_000);
  });

  it("asks for confirmation before deleting", async () => {
    const user = userEvent.setup();
    mocks.announcements = { data: [row(9, {})], isLoading: false, isError: false, refetch: vi.fn() };
    render(h(AnnouncementsPanel));
    await user.click(screen.getByRole("button", { name: "حذف الإعلان" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(mocks.deleteAnnouncement).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "حذف نهائي" }));
    expect(mocks.deleteAnnouncement).toHaveBeenCalledWith({ id: 9 });
  });
});

describe("announcement form helpers", () => {
  it("round-trips datetime-local values in the viewer timezone", () => {
    const value = toDateTimeLocalValue(fromDateTimeLocalValue("2026-11-03T14:30")!);
    expect(value).toBe("2026-11-03T14:30");
    expect(fromDateTimeLocalValue("2026-02-31T10:00")).toBeNull();
    expect(fromDateTimeLocalValue("")).toBeNull();
  });

  it("requires an end after the start and drops labels without a link", () => {
    const form = { ...emptyAnnouncementForm(fromDateTimeLocalValue("2026-11-03T10:00")!), messageAr: "نص كافٍ", messageEn: "Long enough", linkLabelAr: "زر" };
    expect(validateAnnouncementForm({ ...form, endsAt: "2026-11-03T09:00" }).endsAt).toBeTruthy();
    expect(validateAnnouncementForm({ ...form, endsAt: "2026-11-03T11:00" })).toEqual({});
    expect(announcementFormToInput(form).linkLabelAr).toBeNull();
  });
});
