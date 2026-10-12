// @vitest-environment jsdom
import React, { createElement as h, useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "./components/ui/input-otp";
import { normalizeDigits, normalizeOtp, normalizeSaudiPhone } from "../../shared/phone";
import { DemoRequestOtp } from "./pages/Home";

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("React", React);
  // input-otp checks password-manager overlays with this browser-only API.
  document.elementFromPoint = () => null;
});
afterEach(cleanup);

function ControlledOtp() {
  const [value, setValue] = useState("");
  return h("div", { dir: "rtl" }, h(InputOTP, { maxLength: 6, value, onChange: setValue, "aria-label": "code" },
    h(InputOTPGroup, {}, ...Array.from({ length: 6 }, (_, index) => h(InputOTPSlot, { key: index, index })))));
}

describe("تطبيع أرقام التسجيل دون قلب ترتيبها", () => {
  it.each(["٠٥٣٠٢٠٤٠٥٠", "۰۵۳۰۲۰۴۰۵۰", "+966 (53) 020-4050", "966530204050", "00966530204050", "530204050"])("يوحد رقم %s", value => {
    expect(normalizeSaudiPhone(value)).toBe("0530204050");
  });
  it.each(["123", "٠١٢٣٤٥٦٧٨٩", "966123456789", "05abc0204050"])("يرفض رقمًا غير صالح %s", value => expect(normalizeSaudiPhone(value)).toBeNull());
  it("يطبع رموز العربية والفارسية واللصق مع الفراغات", () => {
    expect(normalizeDigits("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹")).toBe("01234567890123456789");
    expect(normalizeOtp("١ ٢ ٣ ٤ ٥ ٦")).toBe("123456");
    expect(normalizeOtp("۱۲۳۴۵۶")).toBe("123456");
  });
});

describe("خانات الرمز في واجهة عربية", () => {
  it("يبقي مجموعة الخانات LTR حتى داخل RTL", async () => {
    const { container } = render(h(ControlledOtp));
    await userEvent.type(screen.getByRole("textbox", { name: "code" }), "123456");
    expect(container.querySelector('[data-slot="input-otp-group"]')?.getAttribute("dir")).toBe("ltr");
    expect([...container.querySelectorAll('[data-slot="input-otp-slot"]')].map(x => x.textContent).join("")).toBe("123456");
  });
  it("يقبل كتابة الأرقام العربية ويحفظها إنجليزية", async () => {
    render(h(ControlledOtp));
    await userEvent.type(screen.getByRole("textbox", { name: "code" }), "١٢٣٤٥٦");
    expect((screen.getByRole("textbox", { name: "code" }) as HTMLInputElement).value).toBe("123456");
  });
  it("يقبل لصق رمز فارسي مع مسافات", async () => {
    render(h(ControlledOtp));
    const user = userEvent.setup();
    await user.click(screen.getByRole("textbox", { name: "code" }));
    await user.paste("۱ ۲ ۳ ۴ ۵ ۶");
    expect((screen.getByRole("textbox", { name: "code" }) as HTMLInputElement).value).toBe("123456");
  });
});

describe("اعتماد الطلب بعد التحقق", () => {
  it("لا يحسب فشل الحفظ محاولة رمز خاطئ ويتيح إعادة الاعتماد", async () => {
    const approve = vi.fn().mockResolvedValue(false);
    render(h(DemoRequestOtp, { isEnglish: false, onVerified: approve }));
    await userEvent.type(screen.getByRole("textbox"), "123456");
    for (let i = 0; i < 6; i++) {
      await userEvent.click(screen.getByRole("button", { name: "اعتماد الطلب بعد التحقق" }));
      await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("الرمز صحيح، لكن تعذر حفظ الطلب"));
    }
    expect(approve).toHaveBeenCalledTimes(6);
    expect(screen.getByText(/تبقت 5 محاولات/)).toBeTruthy();
    expect(screen.queryByText(/الرمز غير صحيح/)).toBeNull();
  });
  it("يحسب الرمز الخاطئ فقط ولا يحفظ الطلب", async () => {
    const approve = vi.fn();
    render(h(DemoRequestOtp, { isEnglish: false, onVerified: approve }));
    await userEvent.type(screen.getByRole("textbox"), "654321");
    await userEvent.click(screen.getByRole("button", { name: "اعتماد الطلب بعد التحقق" }));
    expect(screen.getByRole("alert").textContent).toContain("الرمز غير صحيح");
    expect(screen.getByText(/تبقت 4 محاولات/)).toBeTruthy();
    expect(approve).not.toHaveBeenCalled();
  });
  it("يمنع إرسالين متزامنين ويوقف أزرار الحفظ وإعادة الرمز", async () => {
    let resolve!: (value: boolean) => void;
    const approve = vi.fn(() => new Promise<boolean>(r => { resolve = r; }));
    render(h(DemoRequestOtp, { isEnglish: true, onVerified: approve }));
    await userEvent.type(screen.getByRole("textbox"), "123456");
    const button = screen.getByRole("button", { name: "Approve after verification" });
    fireEvent.click(button); fireEvent.click(button);
    expect(approve).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: "Saving request…" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Resend demo code" }) as HTMLButtonElement).disabled).toBe(true);
    resolve(true);
    await waitFor(() => expect(screen.getByText(/Verified. Your request/)).toBeTruthy());
    expect(screen.queryByText(/Attempts are exhausted/)).toBeNull();
  });
  it("يعالج فشل الاتصال برسالة حفظ لا برسالة رمز خاطئ", async () => {
    render(h(DemoRequestOtp, { isEnglish: true, onVerified: vi.fn().mockRejectedValue(new Error("offline")) }));
    await userEvent.type(screen.getByRole("textbox"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Approve after verification" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("The code is correct"));
  });
});
