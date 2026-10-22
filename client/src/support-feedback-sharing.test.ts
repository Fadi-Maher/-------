// @vitest-environment jsdom
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationFeedback } from "./components/support/ConversationFeedback";
import { SupportTranscriptActions } from "./components/support/SupportTranscriptActions";
import { buildSupportTranscript } from "@shared/supportTranscript";

const messages = [
  {
    sender: "user" as const,
    content: "مرحبًا، أحتاج مساعدة.",
    createdAt: Date.UTC(2025, 0, 2, 9, 30),
  },
  {
    sender: "human" as const,
    content: "سنراجع الخطوة التالية معك.",
    createdAt: Date.UTC(2025, 0, 2, 9, 31),
  },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.stubGlobal("React", React);
});

describe("سجل الدعم القابل للمشاركة", () => {
  it("يبني النص كاملًا بترتيب الرسائل من دون metadata أو مفاتيح أو روابط صور خاصة", () => {
    const secret = "a".repeat(64);
    const transcript = buildSupportTranscript(
      "ar",
      [
        {
          ...messages[0],
          content: `بيانات لا تظهر: ${secret} https://files.example/photo.png?X-Amz-Security-Token=private`,
          id: "message-private-id",
          metadata: { token: "metadata-token" },
        } as unknown as (typeof messages)[number],
        messages[1],
      ],
      2,
      3
    );

    expect(transcript).toContain("سجل محادثة الدعم");
    expect(transcript).toContain("العميل:");
    expect(transcript).toContain("فريق الدعم:");
    expect(transcript).toContain("التقييم: 2/5");
    expect(transcript).toContain("المرفقات غير مضمنة");
    expect(transcript.indexOf("العميل:")).toBeLessThan(
      transcript.indexOf("فريق الدعم:")
    );
    expect(transcript).not.toContain(secret);
    expect(transcript).not.toContain("message-private-id");
    expect(transcript).not.toContain("metadata-token");
    expect(transcript).not.toContain("photo.png");
  });

  it.each([
    [1, true],
    [2, true],
    [3, false],
    [5, false],
  ])("يعرض طلب التفاصيل فقط لتقييم %i", (stars, expectsFollowup) => {
    const { unmount } = render(
      React.createElement(ConversationFeedback, {
        isEnglish: false,
        savedStars: stars,
        onSubmit: vi.fn(),
        onFollowup: vi.fn(),
      })
    );

    if (expectsFollowup) {
      expect(
        screen.getByText("ما الذي لم يساعدك؟ وما الخطوة التي توقفت عندها؟")
      ).toBeTruthy();
      expect(
        screen.getByText(
          "شكرًا لصراحتك، ونعتذر أن التجربة لم تكن بالمستوى المطلوب."
        )
      ).toBeTruthy();
    } else {
      expect(
        screen.queryByText("ما الذي لم يساعدك؟ وما الخطوة التي توقفت عندها؟")
      ).toBeNull();
      expect(screen.queryByLabelText("تفاصيل إضافية (اختياري)")).toBeNull();
    }
    unmount();
  });

  it("لا يعرض المشاركة قبل نجاح التقييم ثم يعرضها مع وجود رسائل", async () => {
    const submit = vi.fn().mockResolvedValue(4);
    render(
      React.createElement(ConversationFeedback, {
        isEnglish: false,
        onSubmit: submit,
        transcriptMessages: messages,
      })
    );

    expect(screen.queryByText("تصدير أو مشاركة السجل")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "4 من 5 نجوم" }));
    fireEvent.click(screen.getByRole("button", { name: "إرسال تقييمي" }));

    await waitFor(() =>
      expect(screen.getByText("تصدير أو مشاركة السجل")).toBeTruthy()
    );
    expect(submit).toHaveBeenCalledWith(4, "");
  });

  it("يرسل تفاصيل المتابعة بموافقة ويحافظ عليها عند الفشل ثم يسمح بإعادة المحاولة", async () => {
    const followup = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(undefined);
    render(
      React.createElement(ConversationFeedback, {
        isEnglish: false,
        savedStars: 1,
        onSubmit: vi.fn(),
        onFollowup: followup,
      })
    );

    const detail = screen.getByLabelText("تفاصيل إضافية (اختياري)");
    fireEvent.change(detail, { target: { value: "توقفت عند تأكيد الطلب" } });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "أوافق على إرسال هذه التفاصيل الإضافية لتحسين الدعم.",
      })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "إرسال التفاصيل الإضافية" })
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(
      (screen.getByLabelText("تفاصيل إضافية (اختياري)") as HTMLTextAreaElement)
        .value
    ).toBe("توقفت عند تأكيد الطلب");

    fireEvent.click(
      screen.getByRole("button", { name: "إعادة إرسال التفاصيل" })
    );
    await waitFor(() =>
      expect(screen.getByText(/وصلت التفاصيل الإضافية/)).toBeTruthy()
    );
    expect(followup).toHaveBeenCalledTimes(2);
    expect(followup).toHaveBeenLastCalledWith("توقفت عند تأكيد الطلب");
    expect(screen.queryByLabelText("تفاصيل إضافية (اختياري)")).toBeNull();
  });

  it("يعرض نجاح متابعة مقدمة مسبقًا ولا يكرر الإرسال", () => {
    const followup = vi.fn();
    render(
      React.createElement(ConversationFeedback, {
        isEnglish: false,
        savedStars: 2,
        onSubmit: vi.fn(),
        onFollowup: followup,
        followupProvided: true,
      })
    );

    expect(screen.getByText(/وصلت التفاصيل الإضافية/)).toBeTruthy();
    expect(screen.queryByLabelText("تفاصيل إضافية (اختياري)")).toBeNull();
    expect(followup).not.toHaveBeenCalled();
  });

  it("يصدر السجل النصي كاملًا ويؤخر إلغاء عنوان Blob", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:support-transcript");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const longMessage = `رسالة كاملة ${"س".repeat(1_400)}`;
    render(
      React.createElement(SupportTranscriptActions, {
        isEnglish: false,
        messages: [{ ...messages[0], content: longMessage }, messages[1]],
        stars: 5,
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "تنزيل السجل (.txt)" }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.size).toBeGreaterThan(longMessage.length);
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:support-transcript");
  });

  it("يرمز البريد العربي بالكامل ويعطي مسودة مختصرة ونسخًا عند تجاوز الحد", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const veryLongMessage = `تقييم مطول، ${"م".repeat(7_000)}`;
    render(
      React.createElement(SupportTranscriptActions, {
        isEnglish: false,
        messages: [{ ...messages[0], content: veryLongMessage }],
        stars: 5,
      })
    );

    fireEvent.change(screen.getByLabelText("بريد المستلم (اختياري)"), {
      target: { value: "reader@example.com" },
    });
    const link = screen.getByRole("link", { name: "فتح مسودة بريد" });
    const href = link.getAttribute("href") ?? "";
    expect(href).toContain("mailto:reader%40example.com");
    expect(href).toContain(
      encodeURIComponent("سجل محادثة الدعم — التقييم 5/5")
    );
    expect(href).toContain(encodeURIComponent("مرحبًا،"));
    expect(href).not.toContain(encodeURIComponent(veryLongMessage));
    expect(screen.getByText(/السجل أطول من أن يُدرج/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "نسخ السجل كاملًا" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0][0]).toContain("تقييم مطول،");
  });
});
