import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getCustomerProfileByPhone: vi.fn(),
  updateCustomerProfileByPhone: vi.fn(),
}));

vi.mock("./_core/env", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/env")>();
  return { ENV: { ...actual.ENV, cookieSecret: "unit-test-secret-for-customer-profile" } };
});
vi.mock("./customerProfileDb", async importOriginal => {
  const actual = await importOriginal<typeof import("./customerProfileDb")>();
  return {
    ...actual,
    getCustomerProfileByPhone: mocks.getCustomerProfileByPhone,
    updateCustomerProfileByPhone: mocks.updateCustomerProfileByPhone,
  };
});

import { normalizeCustomerProfileInput } from "./customerProfileDb";
import { issueCustomerPhoneAccess } from "./phoneLoginTicket";
import { appRouter } from "./routers";

const PHONE = "0551234567";

function publicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("customers.myProfile / updateMyProfile", () => {
  beforeEach(() => {
    mocks.getCustomerProfileByPhone.mockReset();
    mocks.updateCustomerProfileByPhone.mockReset();
  });

  it("rejects an invalid or tampered token before touching the database", async () => {
    const caller = appRouter.createCaller(publicContext());
    const token = issueCustomerPhoneAccess(PHONE);
    const tampered = `${token.slice(0, -2)}${token.endsWith("aa") ? "bb" : "aa"}`;
    await expect(caller.customers.myProfile({ accessToken: "x".repeat(40) })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.customers.myProfile({ accessToken: tampered })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller.customers.updateMyProfile({ accessToken: tampered, fullName: "سارة أحمد", email: null }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.getCustomerProfileByPhone).not.toHaveBeenCalled();
    expect(mocks.updateCustomerProfileByPhone).not.toHaveBeenCalled();
  });

  it("rejects an expired token", async () => {
    const caller = appRouter.createCaller(publicContext());
    const expired = issueCustomerPhoneAccess(PHONE, Date.now() - 8 * 24 * 60 * 60 * 1000);
    await expect(caller.customers.myProfile({ accessToken: expired })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.getCustomerProfileByPhone).not.toHaveBeenCalled();
  });

  it("reads the profile for the phone inside the signed token only", async () => {
    mocks.getCustomerProfileByPhone.mockResolvedValueOnce({ fullName: "سارة", email: null, phone: PHONE, memberSince: 1 });
    const caller = appRouter.createCaller(publicContext());
    await expect(caller.customers.myProfile({ accessToken: issueCustomerPhoneAccess(PHONE) })).resolves.toMatchObject({ phone: PHONE });
    expect(mocks.getCustomerProfileByPhone).toHaveBeenCalledWith(PHONE);
  });

  it("updates using the token phone and ignores any phone sent by the browser", async () => {
    mocks.updateCustomerProfileByPhone.mockResolvedValueOnce({ changed: true, changedFields: ["fullName"], profile: { fullName: "سارة أحمد", email: null, phone: PHONE, memberSince: 1 } });
    const caller = appRouter.createCaller(publicContext());
    await caller.customers.updateMyProfile({
      accessToken: issueCustomerPhoneAccess(PHONE),
      fullName: "  سارة أحمد ",
      email: "Sara@Example.com",
      phone: "0599999999",
    } as never);
    expect(mocks.updateCustomerProfileByPhone).toHaveBeenCalledTimes(1);
    expect(mocks.updateCustomerProfileByPhone).toHaveBeenCalledWith(PHONE, { fullName: "سارة أحمد", email: "Sara@Example.com" });
  });

  it("rejects too-short names at the API boundary", async () => {
    const caller = appRouter.createCaller(publicContext());
    await expect(
      caller.customers.updateMyProfile({ accessToken: issueCustomerPhoneAccess(PHONE), fullName: "س", email: null }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.updateCustomerProfileByPhone).not.toHaveBeenCalled();
  });
});

describe("normalizeCustomerProfileInput", () => {
  it("cleans the name and lowercases the email", () => {
    expect(normalizeCustomerProfileInput({ fullName: "  سارة\u200f   أحمد\u0007 ", email: "  Sara@Example.COM " })).toEqual({
      fullName: "سارة أحمد",
      email: "sara@example.com",
    });
  });

  it("stores an empty email as null", () => {
    expect(normalizeCustomerProfileInput({ fullName: "Sara Ahmed", email: "   " })).toEqual({ fullName: "Sara Ahmed", email: null });
    expect(normalizeCustomerProfileInput({ fullName: "Sara Ahmed", email: undefined })).toEqual({ fullName: "Sara Ahmed", email: null });
  });

  it("rejects names without letters and malformed emails", () => {
    expect(() => normalizeCustomerProfileInput({ fullName: "12345", email: null })).toThrow(/الاسم/);
    expect(() => normalizeCustomerProfileInput({ fullName: "سارة", email: "not-an-email" })).toThrow(/البريد/);
    expect(() => normalizeCustomerProfileInput({ fullName: "س".repeat(161), email: null })).toThrow(/الاسم/);
  });
});
