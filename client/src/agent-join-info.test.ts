// @vitest-environment jsdom
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  isEnglish: false,
  workspace: null as null | { kind: "customer" | "agent" | "employee"; href: string; name: string },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: mocks.isEnglish ? "en" : "ar", isEnglish: mocks.isEnglish }),
}));
vi.mock("@/components/PublicHeader", () => ({ PublicHeader: () => null }));
vi.mock("@/components/PublicFooter", () => ({ PublicFooter: () => null }));
vi.mock("@/lib/signedInWorkspace", () => ({
  useSignedInWorkspace: () => ({ workspace: mocks.workspace, loading: false }),
  workspaceLabel: (workspace: { kind: string }, isEnglish: boolean) =>
    workspace.kind === "agent" ? (isEnglish ? "Agent workspace" : "بوابة المعقب") : isEnglish ? "My requests" : "طلباتي",
}));

import { AgentDecisionNotice, decisionText } from "./components/AgentDecisionNotice";
import AgentJoinInfo from "./pages/AgentJoinInfo";

const h = React.createElement;
const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");

const approvedNotice = {
  status: "approved" as const,
  title: "تمت الموافقة على طلب انضمامك",
  message: "مرحبًا سارة، تمت الموافقة على طلب الانضمام JOIN-12 وتفعيل حسابك.",
  titleEn: "Your application was approved",
  messageEn: "Welcome Sara. Application JOIN-12 was approved and your account is active.",
};

beforeEach(() => {
  mocks.isEnglish = false;
  mocks.workspace = null;
});
afterEach(cleanup);

describe("join-request decision notice", () => {
  it("shows the approval in Arabic with a dismiss and a primary action", async () => {
    const onDismiss = vi.fn();
    const onBrowse = vi.fn();
    const user = userEvent.setup();
    render(
      h(AgentDecisionNotice, {
        notice: approvedNotice,
        isEnglish: false,
        decidedAt: 1_710_000_000_000,
        onDismiss,
        primaryAction: { label: "استعرض طلبات العملاء الجديدة", onClick: onBrowse },
      }),
    );
    const notice = screen.getByRole("status");
    expect(notice.getAttribute("dir")).toBe("rtl");
    expect(notice.getAttribute("aria-live")).toBe("polite");
    expect(within(notice).getByRole("heading", { name: approvedNotice.title })).toBeTruthy();
    expect(within(notice).getByText(approvedNotice.message)).toBeTruthy();
    expect(within(notice).getByText("تاريخ القرار:")).toBeTruthy();

    await user.click(within(notice).getByRole("button", { name: "استعرض طلبات العملاء الجديدة" }));
    expect(onBrowse).toHaveBeenCalledTimes(1);
    await user.click(within(notice).getByRole("button", { name: "إخفاء إشعار القرار" }));
    await user.click(within(notice).getByRole("button", { name: "تم، إخفاء الإشعار" }));
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it("uses the stored English text and disables dismissal while it is saving", () => {
    render(h(AgentDecisionNotice, { notice: approvedNotice, isEnglish: true, onDismiss: vi.fn(), dismissing: true }));
    const notice = screen.getByRole("status");
    expect(notice.getAttribute("dir")).toBe("ltr");
    expect(within(notice).getByRole("heading", { name: "Your application was approved" })).toBeTruthy();
    expect((within(notice).getByRole("button", { name: "Hide decision notice" }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(notice).getByRole("button", { name: /Got it, hide notice/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("falls back to Arabic when a legacy row has no English text", () => {
    expect(decisionText({ ...approvedNotice, titleEn: null, messageEn: "" }, true)).toEqual({
      title: approvedNotice.title,
      message: approvedNotice.message,
    });
  });

  it("is wired to the unread approval notification in the agent workspace", () => {
    const workspace = read("./pages/TeamWorkspace.tsx");
    expect(workspace).toContain('item.type === "agent_application_approved" && !item.isRead');
    expect(workspace).toContain("<AgentDecisionNotice");
    expect(workspace).toContain("onDismiss={() => void openTeamNotification(approvalNotice)}");
    expect(workspace).toContain("setMarketOpen(true)");
  });
});

describe("join as an agent page", () => {
  it("explains benefits, the two required documents, file rules and steps in Arabic", () => {
    render(h(AgentJoinInfo));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("انضم كمعقّب");
    for (const benefit of ["طلبات عملاء جديدة", "عروض بشروطك", "محادثات منظمة", "سجلك المالي", "إشعارات فورية", "بيئة عمل موثوقة"]) {
      expect(screen.getByRole("heading", { name: benefit })).toBeTruthy();
    }
    const documents = screen.getByRole("region", { name: "جهّز هذه المستندات قبل البدء." });
    expect(within(documents).getByRole("heading", { name: "الهوية الوطنية" })).toBeTruthy();
    expect(within(documents).getByRole("heading", { name: "رخصة العمل" })).toBeTruthy();
    expect(within(documents).getByText(/PDF أو PNG أو JPEG · حتى 5 ميجابايت/)).toBeTruthy();
    expect(within(documents).getByText(/مشفّرة/)).toBeTruthy();
    const steps = screen.getByRole("region", { name: "أربع خطوات من التقديم إلى التفعيل." });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getAllByRole("group").length).toBeGreaterThanOrEqual(5);
  });

  it("starts the agent sign-in path from every apply button when signed out", () => {
    render(h(AgentJoinInfo));
    const applyLinks = screen.getAllByRole("link", { name: /قدّم طلب الانضمام/ });
    expect(applyLinks).toHaveLength(2);
    for (const link of applyLinks) {
      expect(link.getAttribute("href")).toBe("/agent-login");
      expect(link.getAttribute("data-auth-trigger")).toBe("agent");
    }
    expect(screen.getAllByRole("link", { name: "المستندات المطلوبة" })[0].getAttribute("href")).toBe("#documents");
  });

  it("does not offer a second sign-in to a signed-in customer and links to their account", () => {
    mocks.isEnglish = true;
    mocks.workspace = { kind: "customer", href: "/customer-account", name: "Sara" };
    render(h(AgentJoinInfo));
    expect(screen.queryByRole("link", { name: /Apply to join/ })).toBeNull();
    expect(screen.getAllByText("Sign out of your current account first to apply as an agent.")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /Open My requests/ })[0].getAttribute("href")).toBe("/customer-account");
  });

  it("sends a signed-in agent to the agent workspace", () => {
    mocks.isEnglish = true;
    mocks.workspace = { kind: "agent", href: "/agent-dashboard", name: "Sara" };
    render(h(AgentJoinInfo));
    expect(screen.getAllByText("You already have an agent account.")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /Open Agent workspace/ })[0].getAttribute("href")).toBe("/agent-dashboard");
    expect(document.querySelector("main")?.getAttribute("dir")).toBe("ltr");
  });

  it("is routed and linked from the public menu, footer and announcement paths", () => {
    expect(read("./App.tsx")).toContain('<Route path={"/join-as-agent"} component={AgentJoinInfo} />');
    expect(read("./components/PublicHeader.tsx")).toContain('{ ar: "انضم كمعقّب", en: "Join as an agent", icon: BriefcaseBusiness, href: "/join-as-agent" }');
    const footer = read("./components/PublicFooter.tsx");
    expect(footer).toContain('{ label: "انضم كمعقّب", href: "/join-as-agent" }');
    expect(footer).toContain('{ label: "Join as an agent", href: "/join-as-agent" }');
    expect(read("./components/AnnouncementBar.tsx")).toContain('"/join-as-agent"');
  });
});
