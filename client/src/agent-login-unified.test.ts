// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  isEnglish: false,
  loading: false,
  workspace: null as null | { kind: "customer" | "agent" | "employee"; href: string; name: string },
  whatsappNumber: null as string | null,
  toastSuccess: vi.fn(),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    settings: {
      publicConfig: {
        useQuery: () => ({ data: { whatsappNumber: mocks.whatsappNumber, fields: [] }, isLoading: false }),
      },
    },
  },
}));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, info: vi.fn() } }));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: mocks.isEnglish ? "en" : "ar", isEnglish: mocks.isEnglish }),
}));
vi.mock("@/components/PublicHeader", () => ({ PublicHeader: () => null }));
vi.mock("@/components/PublicFooter", () => ({ PublicFooter: () => null }));
vi.mock("@/lib/signedInWorkspace", () => ({
  useSignedInWorkspace: () => ({ workspace: mocks.workspace, loading: mocks.loading }),
  useRedirectSignedInVisitor: () => mocks.workspace,
  workspaceLabel: () => "",
}));

import AgentLogin from "./pages/AgentLogin";
import {
  JOIN_SUPPORT_THANKS,
  JOIN_SUPPORT_THANKS_TOAST_ID,
  JoinSupportCard,
  JoinSupportWhatsAppButton,
} from "./components/JoinSupportWhatsApp";
import { AGENT_ACCESS_COPY } from "./lib/agentAccessCopy";
import { AUTH_MODAL_OPEN_EVENT, type AuthModalRequest } from "./lib/authFlow";

const h = React.createElement;
let opened: AuthModalRequest[] = [];
const onOpen = (event: Event) => opened.push((event as CustomEvent<AuthModalRequest>).detail);

beforeEach(() => {
  mocks.isEnglish = false;
  mocks.loading = false;
  mocks.workspace = null;
  mocks.whatsappNumber = null;
  mocks.toastSuccess.mockReset();
  opened = [];
  window.addEventListener(AUTH_MODAL_OPEN_EVENT, onOpen);
});
afterEach(() => {
  window.removeEventListener(AUTH_MODAL_OPEN_EVENT, onOpen);
  cleanup();
  vi.restoreAllMocks();
});

describe("direct /agent-login page", () => {
  it("uses the pop-up's wording and explains the join request in Arabic", () => {
    const copy = AGENT_ACCESS_COPY.ar;
    render(h(AgentLogin));
    const main = screen.getByRole("main");
    expect(main.getAttribute("dir")).toBe("rtl");
    expect(screen.getByRole("heading", { level: 1, name: copy.title })).toBeTruthy();
    expect(screen.getByText(copy.lead)).toBeTruthy();
    expect(screen.getByText(copy.joinNote)).toBeTruthy();
    expect(screen.getByText(copy.demo)).toBeTruthy();
    const steps = within(screen.getByRole("list", { name: copy.stepsLabel })).getAllByRole("listitem");
    expect(steps.map(step => step.querySelector("p")?.textContent)).toEqual(["الجوال", "الرمز", "النوع", "البيانات"]);
    expect(screen.getByRole("heading", { name: copy.joinTitle })).toBeTruthy();
    expect(screen.getByText(/الهوية الوطنية ورخصة العمل، بصيغة PDF أو PNG أو JPEG/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "مراجعة الإدارة" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "قرار واضح عند الدخول" })).toBeTruthy();
    expect(screen.getByRole("link", { name: copy.joinLink }).getAttribute("href")).toBe("/join-as-agent");
    // The old owner-only demo form is gone from the page.
    expect(screen.queryByText(/حسابات المعقبين ينشئها المالك/)).toBeNull();
  });

  it("opens the same agent sign-in window automatically and again from the button", async () => {
    const user = userEvent.setup();
    render(h(AgentLogin));
    await waitFor(() => expect(opened).toHaveLength(1));
    const button = screen.getByRole("button", { name: AGENT_ACCESS_COPY.ar.cta });
    expect(opened[0]).toMatchObject({ intent: "signin", audience: "agent" });
    expect(opened[0].trigger).toBe(button);
    await user.click(button);
    expect(opened).toHaveLength(2);
    expect(opened[1]).toMatchObject({ intent: "signin", audience: "agent", trigger: button });
  });

  it("waits for the session check before opening the window", async () => {
    mocks.loading = true;
    const view = render(h(AgentLogin));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(opened).toHaveLength(0);
    mocks.loading = false;
    view.rerender(h(AgentLogin));
    await waitFor(() => expect(opened).toHaveLength(1));
  });

  it("does not offer a second sign-in to a signed-in visitor", async () => {
    mocks.workspace = { kind: "customer", href: "/customer-account", name: "Sara" };
    const view = render(h(AgentLogin));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(view.container.innerHTML).toBe("");
    expect(opened).toHaveLength(0);
  });

  it("matches the English pop-up wording in a left-to-right layout", () => {
    mocks.isEnglish = true;
    const copy = AGENT_ACCESS_COPY.en;
    render(h(AgentLogin));
    expect(screen.getByRole("main").getAttribute("dir")).toBe("ltr");
    expect(screen.getByRole("heading", { level: 1, name: "Agent sign-in" })).toBeTruthy();
    expect(screen.getByText(copy.lead)).toBeTruthy();
    expect(screen.getByText(copy.joinNote)).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.cta })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Required documents" })).toBeTruthy();
  });
});

describe("thanks after contacting support on WhatsApp", () => {
  const href = `https://wa.me/966530204050?text=`;

  it("confirms with a thank-you toast without blocking the WhatsApp link", async () => {
    mocks.whatsappNumber = "0530204050";
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(h(JoinSupportWhatsAppButton));
    const link = screen.getByRole("link", { name: /واتساب/ });
    expect(link.getAttribute("href")?.startsWith(href)).toBe(true);
    expect(link.getAttribute("target")).toBe("_blank");
    // React handles clicks at its root, so a document listener runs after it and
    // sees whether the component blocked the navigation. jsdom cannot navigate.
    let defaultPrevented: boolean | null = null;
    const afterReact = (event: Event) => {
      defaultPrevented = event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener("click", afterReact);
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    document.removeEventListener("click", afterReact);
    expect(defaultPrevented).toBe(false);
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
    const [title, options] = mocks.toastSuccess.mock.calls[0];
    expect(title).toBe(JOIN_SUPPORT_THANKS.ar.title);
    expect(options).toMatchObject({
      id: JOIN_SUPPORT_THANKS_TOAST_ID,
      description: JOIN_SUPPORT_THANKS.ar.description,
      action: { label: JOIN_SUPPORT_THANKS.ar.reopen },
    });
    options.action.onClick();
    expect(open).toHaveBeenCalledWith(link.getAttribute("href"), "_blank", "noopener,noreferrer");
  });

  it("shows an inline thank-you in the support card, in English too", async () => {
    mocks.isEnglish = true;
    mocks.whatsappNumber = "0530204050";
    render(h(JoinSupportCard));
    expect(screen.queryByText(JOIN_SUPPORT_THANKS.en.inline)).toBeNull();
    const link = screen.getByRole("link", { name: /WhatsApp/ });
    link.addEventListener("click", event => event.preventDefault());
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(await screen.findByText(JOIN_SUPPORT_THANKS.en.inline)).toBeTruthy();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      JOIN_SUPPORT_THANKS.en.title,
      expect.objectContaining({ id: JOIN_SUPPORT_THANKS_TOAST_ID, description: JOIN_SUPPORT_THANKS.en.description }),
    );
  });

  it("does not thank for WhatsApp when no number is saved and the contact page is used", () => {
    render(h(JoinSupportCard));
    const link = screen.getByRole("link", { name: "تواصل مع فريق الدعم" });
    expect(link.getAttribute("href")).toBe("/contact");
    link.addEventListener("click", event => event.preventDefault());
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(screen.queryByText(JOIN_SUPPORT_THANKS.ar.inline)).toBeNull();
  });
});
