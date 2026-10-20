// @vitest-environment jsdom
import React, { createElement as h } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LeadBotPanel, isSafeLeadBotHref } from "./components/leadbot/LeadBotPanel";
import {
  LEAD_BOT_CONSENT_KEY,
  LEAD_BOT_TOKEN_KEY,
  classifyLeadBotError,
  mergeMessages,
  useLeadBotController,
  type LeadBotTransport,
} from "./components/leadbot/useLeadBotController";
import { isPublicAssistantPath } from "./lib/publicAssistantPaths";

const TOKEN = "tok_abcdefghijklmnopqrstuvwxyz012345";
const now = Date.UTC(2026, 9, 18, 8, 0);

function botMessage(id: number, text: string, reply: Record<string, unknown> | null = null) {
  return { id, role: "bot" as const, text, reply: reply as never, authorName: null, clientId: null, createdAt: now + id };
}

function makeTransport(overrides: Partial<LeadBotTransport> = {}): LeadBotTransport & { calls: Record<string, unknown[]> } {
  const calls: Record<string, unknown[]> = { config: [], start: [], send: [], poll: [], track: [], restart: [] };
  let nextId = 10;
  const transport: LeadBotTransport = {
    config: vi.fn(async () => {
      calls.config.push({});
      return { enabled: true, whatsappNumber: "966530204050" };
    }),
    start: vi.fn(async (input) => {
      calls.start.push(input);
      return {
        disabled: false as const,
        token: TOKEN,
        lang: input.lang,
        stage: "welcome" as const,
        step: null,
        locked: false,
        resumed: Boolean(input.token),
        handoff: null,
        messages: [
          botMessage(1, input.lang === "ar" ? "أهلًا بك في معاملاتي كير" : "Welcome to Maalamati Care"),
          botMessage(2, input.lang === "ar" ? "وش تحب نبدأ فيه؟" : "How can I help?", {
            text: "",
            quickReplies: [{ value: "intent:pricing", label: input.lang === "ar" ? "الأسعار" : "Pricing" }],
            actions: [
              { type: "open_request_form", label: input.lang === "ar" ? "ابدأ نموذج الطلب" : "Open service form", href: "/?service=commercial_registration#request" },
              { type: "whatsapp", label: "WhatsApp", href: "javascript:alert(1)" },
            ],
          }),
        ],
      };
    }),
    restart: vi.fn(async () => {
      throw new Error("not used");
    }),
    send: vi.fn(async (input) => {
      calls.send.push(input);
      nextId += 2;
      return {
        stage: "qualifying" as const,
        step: { step: 2, total: 9 },
        locked: false,
        handoff: null,
        replayed: false,
        messages: [
          { id: nextId - 1, role: "user" as const, text: input.label ?? input.text ?? "", reply: null, authorName: null, clientId: input.clientId, createdAt: now + nextId },
          botMessage(nextId, "تمام، سجّلت طلبك"),
        ],
      };
    }),
    poll: vi.fn(async (input) => {
      calls.poll.push(input);
      return { stage: "escalated" as const, locked: false, handoff: null, messages: [] };
    }),
    track: vi.fn(async (input) => {
      calls.track.push(input);
      return { ok: true };
    }),
    ...overrides,
  };
  return Object.assign(transport, { calls });
}

const source = (relative: string) => readFileSync(join(process.cwd(), "client/src", relative), "utf8");

beforeEach(() => {
  vi.stubGlobal("React", React);
  localStorage.clear();
  Element.prototype.scrollTo = vi.fn();
});
afterEach(() => cleanup());

describe("leadBot controller: consent before any storage", () => {
  it("only reads the public config before consent, and starts with consentToStore after acceptance", async () => {
    const transport = makeTransport();
    const { result } = renderHook(() => useLeadBotController({ transport, lang: "ar", pagePath: "/contact" }));
    act(() => result.current.open());
    await waitFor(() => expect(result.current.status).toBe("consent"));
    expect(transport.start).not.toHaveBeenCalled();
    expect(localStorage.getItem(LEAD_BOT_TOKEN_KEY)).toBeNull();
    await act(async () => {
      await result.current.acceptConsent();
    });
    expect(transport.calls.start[0]).toMatchObject({ lang: "ar", pagePath: "/contact", consentToStore: true });
    expect(result.current.status).toBe("ready");
    expect(localStorage.getItem(LEAD_BOT_CONSENT_KEY)).toBe("1");
    expect(localStorage.getItem(LEAD_BOT_TOKEN_KEY)).toBe(TOKEN);
  });

  it("declining keeps everything local: no start call and nothing in storage", async () => {
    const transport = makeTransport();
    const { result } = renderHook(() => useLeadBotController({ transport, lang: "ar", pagePath: "/" }));
    act(() => result.current.open());
    await waitFor(() => expect(result.current.status).toBe("consent"));
    act(() => result.current.declineConsent());
    expect(result.current.status).toBe("declined");
    expect(transport.start).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it("resumes a saved conversation with its token after consent was given before", async () => {
    localStorage.setItem(LEAD_BOT_CONSENT_KEY, "1");
    localStorage.setItem(LEAD_BOT_TOKEN_KEY, TOKEN);
    const transport = makeTransport();
    const { result } = renderHook(() => useLeadBotController({ transport, lang: "en", pagePath: "/" }));
    act(() => result.current.open());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(transport.calls.start[0]).toMatchObject({ token: TOKEN, consentToStore: true });
    expect(transport.config).not.toHaveBeenCalled();
  });
});

describe("leadBot controller: sending, failures and retry", () => {
  async function readyController(transport: LeadBotTransport) {
    localStorage.setItem(LEAD_BOT_CONSENT_KEY, "1");
    const hook = renderHook(() => useLeadBotController({ transport, lang: "ar", pagePath: "/" }));
    act(() => hook.result.current.open());
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));
    return hook;
  }

  it("sends text with the token and a clientId and merges the server turn", async () => {
    const transport = makeTransport();
    const { result } = await readyController(transport);
    await act(async () => {
      await result.current.send({ text: "أبغى سجل تجاري" });
    });
    const sent = transport.calls.send[0] as { token: string; clientId: string; text: string };
    expect(sent.token).toBe(TOKEN);
    expect(sent.clientId.length).toBeGreaterThan(6);
    expect(result.current.messages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(result.current.messages.at(-1)?.text).toBe("تمام، سجّلت طلبك");
  });

  it("marks a failed message, blocks new ones and retries with the same clientId", async () => {
    let fail = true;
    const base = makeTransport();
    const send = vi.fn(async (input: Parameters<LeadBotTransport["send"]>[0]) => {
      if (fail) throw Object.assign(new TypeError("Failed to fetch"), {});
      return base.send(input);
    });
    const transport = makeTransport({ send });
    const { result } = await readyController(transport);
    await act(async () => {
      await result.current.send({ text: "مرحبا" });
    });
    expect(result.current.messages.some((message) => message.localStatus === "failed")).toBe(true);
    expect(result.current.failedCount).toBe(1);
    let accepted = true;
    await act(async () => {
      accepted = await result.current.send({ text: "رسالة ثانية" });
    });
    expect(accepted).toBe(false);
    fail = false;
    await act(async () => {
      await result.current.retry();
    });
    expect(send.mock.calls[1][0].clientId).toBe(send.mock.calls[0][0].clientId);
    expect(result.current.failedCount).toBe(0);
  });

  it("classifies tRPC and network errors", () => {
    expect(classifyLeadBotError({ data: { code: "TOO_MANY_REQUESTS" } })).toBe("rate_limited");
    expect(classifyLeadBotError({ data: { code: "NOT_FOUND" } })).toBe("not_found");
    expect(classifyLeadBotError({ data: { code: "FORBIDDEN" } })).toBe("forbidden");
    expect(classifyLeadBotError(new TypeError("Failed to fetch"))).toBe("network");
    expect(classifyLeadBotError({ message: "boom" })).toBe("unknown");
  });

  it("merges messages without duplicates in time order", () => {
    const merged = mergeMessages([botMessage(2, "b")], [botMessage(1, "a"), botMessage(2, "b")]);
    expect(merged.map((message) => message.id)).toEqual([1, 2]);
  });
});

function Harness({ transport, lang, onClose = () => undefined }: { transport: LeadBotTransport; lang: "ar" | "en"; onClose?: () => void }) {
  const controller = useLeadBotController({ transport, lang, pagePath: "/" });
  return h("div", null, h("button", { type: "button", onClick: controller.open }, "open"), controller.isOpen ? h(LeadBotPanel, { controller, lang, onClose, onNavigate: () => undefined }) : null);
}

describe("leadBot panel UI", () => {
  it("shows the Arabic consent card (RTL) and starts only after «أوافق»", async () => {
    const transport = makeTransport();
    render(h(Harness, { transport, lang: "ar" }));
    fireEvent.click(screen.getByText("open"));
    const accept = await screen.findByRole("button", { name: "أوافق وأبدأ المحادثة" });
    expect(screen.getByRole("dialog").getAttribute("dir")).toBe("rtl");
    expect(screen.getByRole("button", { name: "لا، شكرًا" })).toBeTruthy();
    expect(transport.start).not.toHaveBeenCalled();
    fireEvent.click(accept);
    await screen.findByText("أهلًا بك في معاملاتي كير");
    expect(transport.start).toHaveBeenCalledTimes(1);
  });

  it("renders English LTR, sends quick replies, tracks safe actions and drops unsafe links", async () => {
    localStorage.setItem(LEAD_BOT_CONSENT_KEY, "1");
    const transport = makeTransport();
    render(h(Harness, { transport, lang: "en" }));
    fireEvent.click(screen.getByText("open"));
    await screen.findByText("Welcome to Maalamati Care");
    expect(screen.getByRole("dialog").getAttribute("dir")).toBe("ltr");
    const link = screen.getByRole("link", { name: /Open service form/ });
    expect(link.getAttribute("href")).toBe("/?service=commercial_registration#request");
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).toBeNull();
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(transport.track).toHaveBeenCalledWith({ token: TOKEN, action: "open_request_form" });
    fireEvent.click(screen.getByRole("button", { name: "Pricing" }));
    await waitFor(() => expect(transport.send).toHaveBeenCalledTimes(1));
    expect((transport.calls.send[0] as { quickReply: string }).quickReply).toBe("intent:pricing");
  });

  it("closes with Escape", async () => {
    localStorage.setItem(LEAD_BOT_CONSENT_KEY, "1");
    const onClose = vi.fn();
    render(h(Harness, { transport: makeTransport(), lang: "ar", onClose }));
    fireEvent.click(screen.getByText("open"));
    await screen.findByText("أهلًا بك في معاملاتي كير");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("only allows internal paths and wa.me links", () => {
    expect(isSafeLeadBotHref("/track")).toBe(true);
    expect(isSafeLeadBotHref("https://wa.me/966530204050")).toBe(true);
    expect(isSafeLeadBotHref("//evil.example")).toBe(false);
    expect(isSafeLeadBotHref("https://evil.example")).toBe(false);
    expect(isSafeLeadBotHref("javascript:alert(1)")).toBe(false);
  });
});

describe("leadBot placement", () => {
  it("is limited to public pages and replaces the old floating assistant in App", () => {
    expect(isPublicAssistantPath("/")).toBe(true);
    expect(isPublicAssistantPath("/contact")).toBe(true);
    expect(isPublicAssistantPath("/join-as-agent")).toBe(true);
    expect(isPublicAssistantPath("/support-center")).toBe(true);
    // The request support page has its own chat; the admin support inbox is private.
    expect(isPublicAssistantPath("/support")).toBe(false);
    expect(isPublicAssistantPath("/support?topic=status")).toBe(false);
    for (const path of ["/support-inbox", "/dashboard", "/sales-assistant", "/settings/notifications", "/employees", "/agents", "/agent-dashboard", "/employee-dashboard", "/team-request", "/audit"]) {
      expect(isPublicAssistantPath(path)).toBe(false);
    }
    const app = source("App.tsx");
    expect(app).toContain("<SiteLeadBot />");
    expect(app).not.toContain("<MaalamatiAssistant />");
    const site = source("components/leadbot/SiteLeadBot.tsx");
    expect(site).toContain("isPublicAssistantPath");
    expect(site).toContain("trpc.useUtils");
  });
});

describe("sales dashboard wiring", () => {
  it("registers /sales-assistant for owner and active sales staff, with settings for the owner only", () => {
    const app = source("App.tsx");
    expect(app).toContain('<Route path={"/sales-assistant"} component={SalesAssistantPage} />');
    const layout = source("components/DashboardLayout.tsx");
    expect(layout).toContain('{ icon: Headset, label: "مساعد المبيعات", path: "/sales-assistant" }');
    expect(layout).toContain("<SalesLeadMenuBadge notify={!isMobile} />");
    const page = source("pages/SalesAssistantPage.tsx");
    expect(page).toContain("trpc.leadBot.staff.access.useQuery");
    expect(page).toContain('initial.tab === "settings" ? "leads"');
    expect(page.match(/role === "owner" \?/g)?.length).toBeGreaterThanOrEqual(2);
    const team = source("pages/TeamWorkspace.tsx");
    expect(team).toContain('item.type === "lead_handoff_requested" || item.type === "lead_hot"');
  });
});
