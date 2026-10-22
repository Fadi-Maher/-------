// @vitest-environment jsdom
import { createElement, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SupportScreenshotPicker,
  type SelectedSupportImage,
} from "./components/support/SupportScreenshotPicker";
const create = vi.fn(() => "blob:local-screenshot");
const revoke = vi.fn();
function Picker() {
  const [value, setValue] = useState<SelectedSupportImage | null>(null);
  return createElement(SupportScreenshotPicker, {
    isEnglish: false,
    value,
    onChange: setValue,
    disabled: false,
  });
}
beforeEach(() => {
  class TestURL extends URL {
    static createObjectURL = create;
    static revokeObjectURL = revoke;
  }
  vi.stubGlobal("URL", TestURL);
  create.mockClear();
  revoke.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("اختيار صور التصعيد", () => {
  it("يعرض معاينة محلية فقط وينظف Blob عند الإزالة", () => {
    render(createElement(Picker));
    const file = new File([new Uint8Array([137, 80, 78, 71])], "problem.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByLabelText("اختيار صورة المشكلة"), {
      target: { files: [file] },
    });
    expect(
      screen.getByAltText("معاينة محلية للصورة قبل إرسالها").getAttribute("src")
    ).toBe("blob:local-screenshot");
    expect(screen.getByText(/لم تُرفع بعد/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "إزالة الصورة" }));
    expect(screen.queryByAltText("معاينة محلية للصورة قبل إرسالها")).toBeNull();
    expect(revoke).toHaveBeenCalledWith("blob:local-screenshot");
  });
  it("يرفض صيغة مستند وحجمًا أكبر من3MB بلا معاينة", () => {
    render(createElement(Picker));
    for (const file of [
      new File(["pdf"], "document.pdf", { type: "application/pdf" }),
      new File([new Uint8Array(3 * 1024 * 1024 + 1)], "large.png", {
        type: "image/png",
      }),
    ]) {
      fireEvent.change(screen.getByLabelText("اختيار صورة المشكلة"), {
        target: { files: [file] },
      });
      expect(screen.getByRole("alert")).toBeTruthy();
    }
    expect(create).not.toHaveBeenCalled();
  });
});
