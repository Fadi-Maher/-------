import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const phone = "0512345678";
const mocks = vi.hoisted(() => ({
  verifyTicket: vi.fn(),
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
  getAccounts: vi.fn(),
}));

vi.mock("./phoneLoginTicket", () => ({
  verifyPhoneLoginTicket: mocks.verifyTicket,
}));
vi.mock("./phoneProfileDb", () => ({
  getPhoneAccounts: mocks.getAccounts,
  getPhoneProfile: mocks.getProfile,
  savePhoneProfile: mocks.saveProfile,
}));

import { phoneProfileRouter } from "./phoneProfileRouter";

function context(role: "admin" | "agent" | "user" | null = null): TrpcContext {
  return {
    user: role
      ? {
          id: 99,
          openId: `profile-router-${role}`,
          name: "Caller must not select profile identity",
          email: "caller@example.test",
          loginMethod: "test",
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyTicket.mockReturnValue(phone);
  mocks.getProfile.mockResolvedValue({
    profile: { fullName: "ملف محفوظ", email: "saved@example.test" },
    isNewCustomer: false,
    hasActiveAgent: false,
  });
  mocks.saveProfile.mockResolvedValue({
    profile: { fullName: "ملف محفوظ", email: "saved@example.test" },
    customer: null,
    hasActiveAgent: false,
  });
});

describe("phoneProfile router", () => {
  it("looks up existing accounts only for the OTP-verified phone", async () => {
    mocks.getAccounts.mockResolvedValue({
      customer: { fullName: "عميل مسجل" },
      activeAgent: null,
    });
    const caller = phoneProfileRouter.createCaller(context());
    await expect(
      caller.accounts({
        verificationToken: "valid-ticket",
        phone: "0599999999",
      } as never)
    ).resolves.toEqual({ customer: { fullName: "عميل مسجل" }, activeAgent: null });
    expect(mocks.verifyTicket).toHaveBeenCalledWith("valid-ticket");
    expect(mocks.getAccounts).toHaveBeenCalledWith(phone);
    expect(mocks.getAccounts).not.toHaveBeenCalledWith("0599999999");
  });
  it("never reveals accounts for an invalid verification ticket", async () => {
    mocks.verifyTicket.mockImplementation(() => {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "invalid" });
    });
    const caller = phoneProfileRouter.createCaller(context());
    await expect(
      caller.accounts({ verificationToken: "forged-ticket" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.getAccounts).not.toHaveBeenCalled();
  });
  it("verifies the ticket before profile reads and uses no caller-provided phone", async () => {
    const caller = phoneProfileRouter.createCaller(context("admin"));

    await expect(
      caller.get({
        verificationToken: "valid-ticket",
        role: "customer",
        // Zod strips unknown keys; this assertion protects against future schema drift.
        phone: "0599999999",
      } as never)
    ).resolves.toEqual({
      profile: { fullName: "ملف محفوظ", email: "saved@example.test" },
      isNewCustomer: false,
      hasActiveAgent: false,
    });

    expect(mocks.verifyTicket).toHaveBeenCalledWith("valid-ticket");
    expect(mocks.getProfile).toHaveBeenCalledWith(phone, "customer");
    expect(mocks.getProfile).not.toHaveBeenCalledWith("0599999999", "customer");
  });

  it("does not touch storage when the verification ticket is invalid", async () => {
    mocks.verifyTicket.mockImplementation(() => {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    });
    const caller = phoneProfileRouter.createCaller(context());

    await expect(
      caller.save({
        verificationToken: "forged-ticket",
        role: "agent",
        fullName: "معقب اختبار",
        email: "agent@example.test",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(mocks.getProfile).not.toHaveBeenCalled();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("normalizes details and keeps selected role separate from caller session privileges", async () => {
    const caller = phoneProfileRouter.createCaller(context("admin"));

    await caller.save({
      verificationToken: "valid-ticket",
      role: "agent",
      fullName: "  معقب اختبار  ",
      email: "AGENT@EXAMPLE.TEST ",
      acceptedTerms: false,
      phone: "0599999999",
    } as never);

    // Admin/session identity is deliberately ignored; only ticket phone + selected role reach persistence.
    expect(mocks.saveProfile).toHaveBeenCalledWith(phone, {
      role: "agent",
      fullName: "معقب اختبار",
      email: "agent@example.test",
      acceptedTerms: false,
    });
  });

  it("rejects invalid input before the save service receives it", async () => {
    const caller = phoneProfileRouter.createCaller(context());

    await expect(
      caller.save({
        verificationToken: "valid-ticket",
        role: "customer",
        fullName: "أ",
        email: "not-an-email",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(mocks.verifyTicket).not.toHaveBeenCalled();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });
});
