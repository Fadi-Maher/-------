// @vitest-environment jsdom
import React, { createElement as h } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { matchesConversationFilter } from "../../shared/conversation";
const mocks = vi.hoisted(() => ({ send: vi.fn(), query: vi.fn() }));
vi.mock("./lib/trpc", () => {
  const data = [
    { id: 1, senderType: "customer", senderName: "عميل", message: "رسالة واردة", createdAt: new Date(), attachments: [] },
    { id: 2, senderType: "agent", senderName: "معقب", message: "رسالة صادرة", createdAt: new Date(), attachments: [] },
    { id: 3, senderType: "system", senderName: "النظام", message: "تم الاستلام", createdAt: new Date(), attachments: [] },
  ];
  const procedure = { useQuery: (_input: unknown, options: unknown) => { mocks.query(options); return { data, isLoading: false, isError: false, refetch: vi.fn() }; }, useMutation: () => ({ isPending: false, mutate: mocks.send }) };
  return { trpc: { useUtils: () => ({ conversation: { customerList: { invalidate: vi.fn() }, teamList: { invalidate: vi.fn() } } }), conversation: { customerList: procedure, teamList: procedure, customerSend: procedure, teamSend: procedure, customerUpload: procedure, teamUpload: procedure } } };
});
import { RequestConversation } from "./components/RequestConversation";
beforeAll(() => vi.stubGlobal("React", React));
beforeEach(() => { mocks.send.mockClear(); mocks.query.mockClear(); });
afterEach(cleanup);

describe("محادثة خفيفة بثلاثة أقسام", () => {
  it("يبدل الوارد والصادر ويستثني النظام من التصنيف", async () => {
    render(h(RequestConversation, { requestId: 1, isEnglish: false, mode: "team", status: "in_progress" }));
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    await userEvent.click(screen.getByRole("tab", { name: /الوارد/ }));
    expect(screen.getByText("رسالة واردة")).toBeTruthy();
    expect(screen.queryByText("رسالة صادرة")).toBeNull();
    expect(screen.queryByText("تم الاستلام")).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: /الصادر/ }));
    expect(screen.getByText("رسالة صادرة")).toBeTruthy();
    expect(screen.queryByText("رسالة واردة")).toBeNull();
  });
  it("يصغر المكتمل إلى أيقونة فقط ولا يعرض أداة إرسال عند فتح الأرشيف", async () => {
    const { container } = render(h(RequestConversation, { requestId: 1, isEnglish: false, mode: "team", status: "completed" }));
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(container.querySelector("button")?.textContent).toBe("");
    expect(mocks.query).toHaveBeenCalledWith(expect.objectContaining({ enabled: false, refetchInterval: false }));
    await userEvent.click(screen.getByRole("button", { name: "المعقب · سجل محادثة الطلب المكتمل" }));
    expect(screen.getByText(/السجل للقراءة فقط/)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "إرسال" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "تصغير سجل المحادثة" }));
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
  it("يتقفل تلقائيًا عندما يتحول الطلب من نشط إلى مكتمل", async () => {
    const view = render(h(RequestConversation, { requestId: 1, isEnglish: true, mode: "team", status: "in_progress" }));
    await userEvent.type(screen.getByRole("textbox"), "Message draft");
    view.rerender(h(RequestConversation, { requestId: 1, isEnglish: true, mode: "team", status: "completed" }));
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("يعكس التصنيف بالنسبة للعميل بدل المعقب", () => {
    expect(matchesConversationFilter("customer", "customer", "outgoing")).toBe(true);
    expect(matchesConversationFilter("agent", "customer", "incoming")).toBe(true);
    expect(matchesConversationFilter("system", "team", "outgoing")).toBe(false);
  });
});
