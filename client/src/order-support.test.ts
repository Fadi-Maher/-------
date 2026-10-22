// @vitest-environment jsdom
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  en: false,
  paused: false,
  error: false,
  historyError: false,
  restored: false,
  pending: false,
  history: {
    status: "waiting",
    feedback: null as {
      id?: string;
      stars: number;
      followupProvided?: boolean;
    } | null,
    attachments: [] as { id: string }[],
    rating: null,
    messages: [
      {
        id: "restore-message",
        sender: "system",
        content: "أُرسلت محادثتك إلى فريق الدعم للمراجعة.",
        metadata: null,
        createdAt: 0,
      },
    ],
  },
  start: vi.fn(),
  send: vi.fn(),
  handoff: vi.fn(),
  forget: vi.fn(),
  finish: vi.fn(),
  feedback: vi.fn(),
  followup: vi.fn(),
  invalidate: vi.fn(async () => {}),
  refetch: vi.fn(),
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ isEnglish: state.en }),
}));
vi.mock("@/components/AssistantAvatar", () => ({
  AssistantAvatar: () => React.createElement("span", null, "assistant"),
}));
vi.mock("@/components/BrandMark", () => ({
  BrandMark: () => React.createElement("span", null, "brand"),
}));
vi.mock("@/components/LanguageToggle", () => ({
  LanguageToggle: () => React.createElement("button", null, "English"),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      orderSupport: { history: { invalidate: state.invalidate } },
    }),
    orderSupport: {
      config: {
        useQuery: () => ({
          data: { enabled: !state.paused, handoffEnabled: true },
          isLoading: false,
          isError: state.error,
          refetch: state.refetch,
        }),
      },
      // Stable data identity is essential: the page copies a query result in useEffect.
      history: {
        useQuery: (_: unknown, opts: { enabled: boolean }) => ({
          data: opts.enabled && state.restored ? state.history : undefined,
          isLoading: false,
          isError: opts.enabled && state.historyError,
          refetch: state.refetch,
        }),
      },
      start: {
        useMutation: () => ({ mutateAsync: state.start, isPending: false }),
      },
      send: {
        useMutation: () => ({
          mutateAsync: state.send,
          isPending: state.pending,
        }),
      },
      handoff: {
        useMutation: () => ({ mutateAsync: state.handoff, isPending: false }),
      },
      forget: {
        useMutation: () => ({ mutateAsync: state.forget, isPending: false }),
      },
      finish: {
        useMutation: () => ({ mutateAsync: state.finish, isPending: false }),
      },
      feedback: {
        useMutation: () => ({ mutateAsync: state.feedback, isPending: false }),
      },
      followup: {
        useMutation: () => ({ mutateAsync: state.followup, isPending: false }),
      },
    },
  },
}));
import OrderSupport from "./pages/OrderSupport";
import { ConversationFeedback } from "./components/support/ConversationFeedback";
import { SupportTypingIndicator } from "./components/support/SupportTypingIndicator";
import { SupportQuickReplies } from "./components/support/SupportQuickReplies";
beforeEach(() => {
  vi.stubGlobal("React", React);
  // Do not execute RAF synchronously: focus/layout libraries can schedule another frame.
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) =>
    setTimeout(() => fn(performance.now()), 0)
  );
  vi.stubGlobal("cancelAnimationFrame", (id: ReturnType<typeof setTimeout>) =>
    clearTimeout(id)
  );
  localStorage.clear();
  state.en = false;
  state.paused = false;
  state.error = false;
  state.historyError = false;
  state.restored = false;
  state.pending = false;
  state.history = {
    status: "waiting",
    attachments: [],
    feedback: null,
    rating: null,
    messages: [
      {
        id: "restore-message",
        sender: "system",
        content: "أُرسلت محادثتك إلى فريق الدعم للمراجعة.",
        metadata: null,
        createdAt: 0,
      },
    ],
  };
  state.start.mockReset().mockResolvedValue({ token: "a".repeat(64) });
  state.send.mockReset().mockResolvedValue({
    saved: false,
    reply: {
      text: "افتح صفحة التتبع بعد التحقق.",
      intent: "tracking",
      actions: [{ label: "تتبع طلبي بأمان", href: "/track" }],
      suggestions: ["أين أجد مرفقات طلبي؟"],
      handoff: false,
    },
  });
  state.handoff.mockReset().mockResolvedValue({ status: "waiting" });
  state.forget.mockReset().mockResolvedValue({ success: true });
  state.finish.mockReset().mockResolvedValue({ status: "closed" });
  state.feedback
    .mockReset()
    .mockResolvedValue({ success: true, id: crypto.randomUUID(), stars: 4 });
  state.followup.mockReset().mockResolvedValue({ success: true });
  state.invalidate.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function askQuestion() {
  fireEvent.change(screen.getByLabelText("اكتب سؤالك عن الطلب"), {
    target: { value: "كيف أتتبع حالة طلبي؟" },
  });
  fireEvent.click(screen.getByRole("button", { name: "إرسال الرسالة" }));
  await waitFor(() =>
    expect(screen.getByText("افتح صفحة التتبع بعد التحقق.")).toBeTruthy()
  );
}
describe("واجهة مساعد الطلبات", () => {
  it("ترحيب واضح دون بدء تخزين أو إرسال تلقائي", () => {
    render(React.createElement(OrderSupport));
    expect(screen.getByText("أهلًا بك في معاملاتي كير")).toBeTruthy();
    expect(screen.getByRole("log", { name: "سجل رسائل الدعم" })).toBeTruthy();
    expect(state.start).not.toHaveBeenCalled();
    expect(state.send).not.toHaveBeenCalled();
    expect(
      (
        screen.getByRole("button", {
          name: "إرسال الرسالة",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(screen.queryByRole("radio")).toBeNull();
  });
  it("يرسل سؤالًا دون حفظ ويعرض إجراء ومتابعة ويحافظ على الردود السريعة", async () => {
    render(React.createElement(OrderSupport));
    await askQuestion();
    expect(state.send.mock.calls[0][0].token).toBeUndefined();
    expect(
      screen.getByRole("link", { name: "تتبع طلبي بأمان" }).getAttribute("href")
    ).toBe("/track");
    expect(screen.getByLabelText("ردود سريعة للأسئلة الشائعة")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "أين أجد مرفقات طلبي؟" })
    ).toBeTruthy();
  });
  it("يطلب الموافقة قبل الحفظ ويذكر مخاطر المتصفح المشترك", async () => {
    render(React.createElement(OrderSupport));
    fireEvent.click(screen.getByRole("button", { name: "تفعيل الحفظ" }));
    expect(state.start).not.toHaveBeenCalled();
    expect(screen.getByText(/يمكن لمن يستخدمه الوصول/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "أوافق على الحفظ" }));
    await waitFor(() =>
      expect(localStorage.getItem("maalamati_order_support_token_v1")).toBe(
        "a".repeat(64)
      )
    );
    expect(state.start).toHaveBeenCalledWith(
      expect.objectContaining({ consent: true })
    );
  });
  it("لا يصعّد قبل التأكيد ثم يرسل الرمز المحفوظ للفريق", async () => {
    render(React.createElement(OrderSupport));
    fireEvent.click(screen.getByRole("button", { name: "طلب موظف" }));
    expect(state.handoff).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "أوافق، أرسل إلى الدعم" })
    );
    await waitFor(() =>
      expect(state.handoff).toHaveBeenCalledWith({
        token: "a".repeat(64),
        consent: true,
      })
    );
  });
  it("يحتفظ بالسؤال عند الخطأ ويعيد المحاولة بنفس معرّف الإرسال", async () => {
    state.send.mockRejectedValueOnce(new Error("network"));
    render(React.createElement(OrderSupport));
    fireEvent.change(screen.getByLabelText("اكتب سؤالك عن الطلب"), {
      target: { value: "كيف أتتبع طلبي؟" },
    });
    fireEvent.click(screen.getByRole("button", { name: "إرسال الرسالة" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(
      (screen.getByLabelText("اكتب سؤالك عن الطلب") as HTMLTextAreaElement)
        .value
    ).toBe("كيف أتتبع طلبي؟");
    expect(screen.queryByLabelText("المساعد يكتب الآن")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    await waitFor(() => expect(state.send).toHaveBeenCalledTimes(2));
    expect(state.send.mock.calls[1][0].turnId).toBe(
      state.send.mock.calls[0][0].turnId
    );
  });
  it("يعرض حالة الاستعادة وانتظار الموظف ولا يكرر التصعيد أو يعرض FAQ الآلي", () => {
    localStorage.setItem("maalamati_order_support_token_v1", "a".repeat(64));
    state.restored = true;
    render(React.createElement(OrderSupport));
    expect(screen.getByText("بانتظار فريق الدعم")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "طلب موظف" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(screen.queryByLabelText("ردود سريعة للأسئلة الشائعة")).toBeNull();
  });
  it("يظهر حالة خطأ الاستعادة مع إعادة محاولة ومسار بديل", () => {
    localStorage.setItem("maalamati_order_support_token_v1", "a".repeat(64));
    state.historyError = true;
    render(React.createElement(OrderSupport));
    expect(screen.getByRole("alert").textContent).toContain("تعذرت الاستعادة");
    expect(
      (
        screen.getByRole("button", {
          name: "إرسال الرسالة",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });
  it("يدعم الإنجليزية وLTR ويمنع الإرسال أثناء الصيانة", () => {
    state.en = true;
    state.paused = true;
    const { container } = render(React.createElement(OrderSupport));
    expect(container.querySelector(".support-page")?.getAttribute("dir")).toBe(
      "ltr"
    );
    expect(screen.getByText(/assistant is temporarily paused/)).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Send message",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });
  it("يعرض ثلاث نقاط أثناء انتظار الروبوت الحقيقي فقط", () => {
    state.pending = true;
    const { container } = render(React.createElement(OrderSupport));
    expect(
      screen.getByRole("status", { name: "المساعد يكتب الآن" })
    ).toBeTruthy();
    expect(container.querySelectorAll(".support-typing-dot")).toHaveLength(3);
    expect(
      (
        screen.getByRole("button", {
          name: "إرسال الرسالة",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });
  it("يُنهي محادثة الزائر ويجمع النجوم دون تفعيل حفظ السجل", async () => {
    render(React.createElement(OrderSupport));
    await askQuestion();
    fireEvent.click(screen.getByRole("button", { name: "إنهاء المحادثة" }));
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText(/هذا لا يلغي طلبك/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "إنهاء وتقييم المحادثة" })
    );
    await waitFor(() =>
      expect(screen.getByText("كيف كانت تجربة الدعم؟")).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("radio", { name: "4 من 5 نجوم" }));
    fireEvent.click(screen.getByRole("button", { name: "إرسال تقييمي" }));
    await waitFor(() =>
      expect(state.feedback).toHaveBeenCalledWith(
        expect.objectContaining({
          stars: 4,
          consent: true,
          finished: true,
          token: undefined,
        })
      )
    );
    expect(state.start).not.toHaveBeenCalled();
    expect(state.finish).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByText("شكرًا! ملاحظتك تصنع فرقًا.")).toBeTruthy()
    );
  });
  it("يعرض التقييم بعد إغلاق المالك ويستعيد النجوم السابقة دون تكرار", () => {
    state.restored = true;
    state.history.status = "closed";
    state.history.feedback = { stars: 5 };
    localStorage.setItem("maalamati_order_support_token_v1", "a".repeat(64));
    render(React.createElement(OrderSupport));
    expect(screen.getByLabelText("تقييمك 5 من 5")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(state.feedback).not.toHaveBeenCalled();
  });
});
describe("ربط مشاركة الدعم والمتابعة", () => {
  it("يرسل تفاصيل تقييم منخفض بمفتاح مجهول دون تفعيل حفظ المحادثة", async () => {
    const id = crypto.randomUUID();
    state.feedback.mockResolvedValue({ success: true, id, stars: 1 });
    render(React.createElement(OrderSupport));
    await askQuestion();
    fireEvent.click(screen.getByRole("button", { name: "إنهاء المحادثة" }));
    fireEvent.click(
      screen.getByRole("button", { name: "إنهاء وتقييم المحادثة" })
    );
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "1 من 5 نجوم" })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("radio", { name: "1 من 5 نجوم" }));
    fireEvent.click(screen.getByRole("button", { name: "إرسال تقييمي" }));
    await waitFor(() =>
      expect(screen.getByLabelText("تفاصيل إضافية (اختياري)")).toBeTruthy()
    );
    fireEvent.change(screen.getByLabelText("تفاصيل إضافية (اختياري)"), {
      target: { value: "لم أفهم الخطوة التالية" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "أوافق على إرسال هذه التفاصيل الإضافية لتحسين الدعم.",
      })
    );
    fireEvent.submit(
      screen.getByLabelText("تفاصيل إضافية (اختياري)").closest("form")!
    );
    await waitFor(() =>
      expect(state.followup).toHaveBeenCalledWith(
        expect.objectContaining({
          id,
          token: undefined,
          consent: true,
          note: "لم أفهم الخطوة التالية",
          accessKey: state.feedback.mock.calls[0][0].accessKey,
        })
      )
    );
    expect(state.start).not.toHaveBeenCalled();
  });
  it("لا يرفع اللقطة المختارة قبل التأكيد ثم يرسلها مع التصعيد", async () => {
    class TestURL extends URL {
      static createObjectURL = () => "blob:local-only";
      static revokeObjectURL = () => {};
    }
    vi.stubGlobal("URL", TestURL);
    render(React.createElement(OrderSupport));
    fireEvent.click(screen.getByRole("button", { name: "طلب موظف" }));
    const file = new File([new Uint8Array([137, 80, 78, 71])], "issue.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByLabelText("اختيار صورة المشكلة"), {
      target: { files: [file] },
    });
    expect(state.start).not.toHaveBeenCalled();
    expect(state.handoff).not.toHaveBeenCalled();
    expect(screen.getByText(/لم تُرفع بعد/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "أوافق، أرسل إلى الدعم" })
    );
    await waitFor(() =>
      expect(state.handoff).toHaveBeenCalledWith(
        expect.objectContaining({
          token: "a".repeat(64),
          consent: true,
          attachment: expect.objectContaining({
            mimeType: "image/png",
            dataBase64: "iVBORw==",
          }),
        })
      )
    );
  });
});

describe("مكونات الدعم الجديدة", () => {
  it("يوسّع كل9 موضوعات ويُرسل النص المناسب ويعطّل الاختيار", () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      React.createElement(SupportQuickReplies, {
        isEnglish: true,
        disabled: false,
        onSelect,
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "All topics" }));
    expect(screen.getAllByRole("button")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Account access" }));
    expect(onSelect).toHaveBeenCalledWith("I cannot sign in", "account");
    rerender(
      React.createElement(SupportQuickReplies, {
        isEnglish: true,
        disabled: true,
        onSelect,
      })
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Account access",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });
  it("يُبقي مؤشرات النقاط زخرفية ويعلن الحالة مرة واحدة", () => {
    const { container } = render(
      React.createElement(SupportTypingIndicator, { isEnglish: true })
    );
    expect(
      screen.getByRole("status", { name: "The assistant is typing" })
    ).toBeTruthy();
    expect(container.querySelectorAll(".support-typing-dot")).toHaveLength(3);
    expect(
      container
        .querySelector(".support-typing-dot")
        ?.parentElement?.getAttribute("aria-hidden")
    ).toBe("true");
  });
  it("يحتفظ بالنجوم والملاحظة عند فشل الحفظ ويدعم إعادة الإرسال", async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(2);
    render(
      React.createElement(ConversationFeedback, {
        isEnglish: false,
        onSubmit: submit,
      })
    );
    expect(
      (
        screen.getByRole("button", {
          name: "إرسال تقييمي",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "2 من 5 نجوم" }));
    fireEvent.change(
      screen.getByLabelText("ما الذي يمكننا تحسينه؟ (اختياري)"),
      { target: { value: "أحتاج خطوات أوضح" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "إرسال تقييمي" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(
      (
        screen.getByLabelText(
          "ما الذي يمكننا تحسينه؟ (اختياري)"
        ) as HTMLTextAreaElement
      ).value
    ).toBe("أحتاج خطوات أوضح");
    fireEvent.click(screen.getByRole("button", { name: "إعادة إرسال تقييمي" }));
    await waitFor(() =>
      expect(
        screen.getByText(
          "شكرًا لصراحتك، ونعتذر أن التجربة لم تكن بالمستوى المطلوب."
        )
      ).toBeTruthy()
    );
    expect(submit.mock.calls[1]).toEqual([2, "أحتاج خطوات أوضح"]);
  });
});
