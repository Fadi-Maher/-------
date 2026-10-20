import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getCustomerProfileByPhone: vi.fn(),
  assertPhoneAccessCurrent: vi.fn(),
  assertCanRequestPhoneChange: vi.fn(),
  changeCustomerPhone: vi.fn(),
  requestPhoneCode: vi.fn(),
  verifyPhoneCode: vi.fn(),
}));
vi.mock("./_core/env", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/env")>();
  return { ENV: { ...actual.ENV, cookieSecret: "unit-test-secret-for-phone-change" } };
});
vi.mock("./customerProfileDb", async importOriginal => {
  const actual = await importOriginal<typeof import("./customerProfileDb")>();
  return { ...actual, getCustomerProfileByPhone: mocks.getCustomerProfileByPhone };
});
vi.mock("./customerPhoneChangeDb", async importOriginal => {
  const actual = await importOriginal<typeof import("./customerPhoneChangeDb")>();
  return {
    ...actual,
    assertPhoneAccessCurrent: mocks.assertPhoneAccessCurrent,
    assertCanRequestPhoneChange: mocks.assertCanRequestPhoneChange,
    changeCustomerPhone: mocks.changeCustomerPhone,
  };
});
vi.mock("./phoneOtpDb", async importOriginal => {
  const actual = await importOriginal<typeof import("./phoneOtpDb")>();
  return { ...actual, requestPhoneCode: mocks.requestPhoneCode, verifyPhoneCode: mocks.verifyPhoneCode };
});

import { maskPhone } from "./customerPhoneChangeDb";
import { issueCustomerPhoneAccess } from "./phoneLoginTicket";
import { appRouter } from "./routers";

const PHONE = "0551234567";
const NEW_PHONE = "0559876543";
const CHALLENGE = "6f1c1f0e-8a7d-4a4b-9f3e-1d2c3b4a5f60";
const CLIENT_KEY = "0c9b8a7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d";
const profile = (phone: string) => ({ fullName: "سارة أحمد", email: null, phone, memberSince: 1 });

function publicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.assertPhoneAccessCurrent.mockResolvedValue(undefined);
  mocks.assertCanRequestPhoneChange.mockResolvedValue(undefined);
  mocks.getCustomerProfileByPhone.mockImplementation(async (phone: string) => profile(phone));
});

describe("customers.requestPhoneChange", () => {
  it("prepares a code for the new number after the session and the request pass", async () => {
    const challenge = { challengeId: CHALLENGE, expiresAt: 2, resendAvailableAt: 1, serverNow: 0, mode: "demo", demoCode: "123456" };
    mocks.requestPhoneCode.mockResolvedValueOnce(challenge);
    const caller = appRouter.createCaller(publicContext());
    await expect(
      caller.customers.requestPhoneChange({ accessToken: issueCustomerPhoneAccess(PHONE), newPhone: NEW_PHONE, language: "en" }),
    ).resolves.toEqual(challenge);
    expect(mocks.assertCanRequestPhoneChange).toHaveBeenCalledWith(PHONE, NEW_PHONE, "en");
    expect(mocks.requestPhoneCode).toHaveBeenCalledWith(NEW_PHONE, "en");
  });

  it("reports an ended session as FORBIDDEN so it is not confused with a wrong code", async () => {
    const caller = appRouter.createCaller(publicContext());
    await expect(
      caller.customers.requestPhoneChange({ accessToken: "x".repeat(40), newPhone: NEW_PHONE, language: "en" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("session has ended") });
    mocks.assertPhoneAccessCurrent.mockRejectedValueOnce(new TRPCError({ code: "UNAUTHORIZED", message: "released" }));
    await expect(
      caller.customers.requestPhoneChange({ accessToken: issueCustomerPhoneAccess(PHONE), newPhone: NEW_PHONE }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("انتهت جلستك") });
    expect(mocks.requestPhoneCode).not.toHaveBeenCalled();
  });

  it("does not send a code when the change itself is refused", async () => {
    mocks.assertCanRequestPhoneChange.mockRejectedValueOnce(new TRPCError({ code: "BAD_REQUEST", message: "same" }));
    const caller = appRouter.createCaller(publicContext());
    await expect(
      caller.customers.requestPhoneChange({ accessToken: issueCustomerPhoneAccess(PHONE), newPhone: PHONE }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.customers.requestPhoneChange({ accessToken: issueCustomerPhoneAccess(PHONE), newPhone: "12345" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.requestPhoneCode).not.toHaveBeenCalled();
  });
});

describe("customers.confirmPhoneChange", () => {
  const confirmInput = (accessToken: string) => ({ accessToken, challengeId: CHALLENGE, code: "123456", clientKey: CLIENT_KEY, language: "ar" as const });

  it("moves the account to the number proven by the code and returns a working token for it", async () => {
    mocks.verifyPhoneCode.mockResolvedValueOnce({ phone: NEW_PHONE });
    mocks.changeCustomerPhone.mockResolvedValueOnce({ profile: profile(NEW_PHONE), previousPhone: PHONE, movedRequests: 2, movedNotifications: 3 });
    const caller = appRouter.createCaller(publicContext());
    // A phone sent by the browser is ignored; only the verified challenge decides the new number.
    const result = await caller.customers.confirmPhoneChange({ ...confirmInput(issueCustomerPhoneAccess(PHONE)), newPhone: "0500000000" } as never);
    expect(mocks.verifyPhoneCode).toHaveBeenCalledWith({ challengeId: CHALLENGE, code: "123456", clientKey: CLIENT_KEY, language: "ar" });
    expect(mocks.changeCustomerPhone).toHaveBeenCalledWith(PHONE, NEW_PHONE, "ar");
    expect(result).toMatchObject({ movedRequests: 2, profile: { phone: NEW_PHONE } });
    expect(result.accessToken.length).toBeGreaterThan(20);
    mocks.getCustomerProfileByPhone.mockClear();
    await expect(caller.customers.myProfile({ accessToken: result.accessToken })).resolves.toMatchObject({ phone: NEW_PHONE });
    expect(mocks.getCustomerProfileByPhone).toHaveBeenCalledWith(NEW_PHONE);
  });

  it("keeps the number when the code is wrong", async () => {
    mocks.verifyPhoneCode.mockRejectedValueOnce(new TRPCError({ code: "UNAUTHORIZED", message: "رمز التحقق غير صحيح." }));
    const caller = appRouter.createCaller(publicContext());
    await expect(caller.customers.confirmPhoneChange(confirmInput(issueCustomerPhoneAccess(PHONE)))).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.changeCustomerPhone).not.toHaveBeenCalled();
  });

  it("does not spend the code when the signed-in account is gone or the session ended", async () => {
    mocks.getCustomerProfileByPhone.mockRejectedValueOnce(new TRPCError({ code: "NOT_FOUND", message: "missing" }));
    const caller = appRouter.createCaller(publicContext());
    await expect(caller.customers.confirmPhoneChange(confirmInput(issueCustomerPhoneAccess(PHONE)))).rejects.toMatchObject({ code: "NOT_FOUND" });
    const expired = issueCustomerPhoneAccess(PHONE, Date.now() - 8 * 24 * 60 * 60 * 1000);
    await expect(caller.customers.confirmPhoneChange(confirmInput(expired))).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.verifyPhoneCode).not.toHaveBeenCalled();
  });
});

describe("tokens for a released number", () => {
  it("are refused by every customer procedure once the number was given up", async () => {
    mocks.assertPhoneAccessCurrent.mockRejectedValue(new TRPCError({ code: "UNAUTHORIZED", message: "انتهت جلسة التحقق." }));
    const caller = appRouter.createCaller(publicContext());
    const token = issueCustomerPhoneAccess(PHONE);
    await expect(caller.customers.myProfile({ accessToken: token })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.customers.updateMyProfile({ accessToken: token, fullName: "سارة", email: null })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.getCustomerProfileByPhone).not.toHaveBeenCalled();
    // The router passes the token's own issue time so only older sessions are cut off.
    const [phone, issuedAtMs] = mocks.assertPhoneAccessCurrent.mock.calls[0] ?? [];
    expect(phone).toBe(PHONE);
    expect(Math.abs(Number(issuedAtMs) - Date.now())).toBeLessThan(5_000);
  });
});

describe("maskPhone", () => {
  it("keeps only the prefix and the last four digits", () => {
    expect(maskPhone("0551234567")).toBe("05••••4567");
    expect(maskPhone("123")).toBe("••••");
  });
});
