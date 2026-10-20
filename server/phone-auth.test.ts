import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

const PHONE = "0512345678";
const { UNIT_SECRET, mocks } = vi.hoisted(() => ({
  UNIT_SECRET: "phone-auth-unit-test-secret",
  mocks: {
    createSessionToken: vi.fn(),
    getActiveAgentAccountByPhone: vi.fn(),
    getDb: vi.fn(),
  },
}));

vi.mock("./_core/env", () => ({
  ENV: {
    appId: "unit-app",
    cookieSecret: UNIT_SECRET,
    databaseUrl: "",
    forgeApiKey: "",
    forgeApiUrl: "",
    isProduction: false,
    oAuthServerUrl: "",
    ownerOpenId: "",
  },
}));

vi.mock("./db", () => ({
  getActiveAgentAccountByPhone: mocks.getActiveAgentAccountByPhone,
  getDb: mocks.getDb,
}));

vi.mock("./_core/sdk", () => ({
  sdk: { createSessionToken: mocks.createSessionToken },
}));

import { phoneAuthRouter } from "./phoneAuthRouter";
import {
  PHONE_LOGIN_TTL_MS,
  issueCustomerPhoneAccess,
  issuePhoneLoginTicket,
  verifyPhoneLoginTicket,
} from "./phoneLoginTicket";

type CookieCall = { name: string; value: string; options: Record<string, unknown> };

function createCaller() {
  const cookies: CookieCall[] = [];
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
    } as TrpcContext["res"],
  };

  return { caller: phoneAuthRouter.createCaller(ctx), cookies };
}

function signPayload(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", UNIT_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

beforeEach(() => {
  mocks.createSessionToken.mockReset();
  mocks.getActiveAgentAccountByPhone.mockReset();
  mocks.getDb.mockReset();
  mocks.getDb.mockResolvedValue(null);
  mocks.createSessionToken.mockResolvedValue("synthetic-session-token");
});

describe("phone login tickets", () => {
  it("issues a 15-minute HMAC ticket restricted to the phone-login scope", () => {
    const now = 1_735_689_600_000;
    const token = issuePhoneLoginTicket(PHONE, now);

    expect(verifyPhoneLoginTicket(token, now)).toBe(PHONE);
    expect(() => verifyPhoneLoginTicket(token, now + PHONE_LOGIN_TTL_MS)).toThrow(/انتهت جلسة التحقق/);
  });

  it("rejects malformed, tampered, wrong-scope, expired, and invalid-phone tickets", () => {
    const now = 1_735_689_600_000;
    const valid = issuePhoneLoginTicket(PHONE, now);
    const tampered = `${valid.slice(0, -1)}${valid.endsWith("A") ? "B" : "A"}`;
    const wrongScope = signPayload({ phone: PHONE, expiresAt: now + PHONE_LOGIN_TTL_MS, scope: "customer-access-v1" });
    const expired = signPayload({ phone: PHONE, expiresAt: now - 1, scope: "phone-login-v1" });
    const invalidPhone = signPayload({ phone: "059999999", expiresAt: now + PHONE_LOGIN_TTL_MS, scope: "phone-login-v1" });

    for (const candidate of ["", "not.a.ticket", "a.b.c", "x".repeat(501), tampered, wrongScope, expired, invalidPhone]) {
      expect(() => verifyPhoneLoginTicket(candidate, now)).toThrow(/انتهت جلسة التحقق/);
    }
  });

  it("keeps the customer access token in the established phone.expiry HMAC format", () => {
    const now = 1_735_689_600_123;
    const token = issueCustomerPhoneAccess(PHONE, now);
    const [payload, signature] = token.split(".");
    const legacyPayload = `${PHONE}.${Math.floor(now / 1000) + 7 * 24 * 60 * 60}`;
    const expectedSignature = createHmac("sha256", UNIT_SECRET).update(legacyPayload).digest("base64url");

    expect(payload).toBe(Buffer.from(legacyPayload).toString("base64url"));
    expect(signature).toBe(expectedSignature);
    expect(() => issueCustomerPhoneAccess("051234567", now)).toThrow(/رقم الجوال غير صحيح/);
  });

  it("does not write the HMAC secret to console output", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const token = issuePhoneLoginTicket(PHONE, 1_735_689_600_000);
      verifyPhoneLoginTicket(token, 1_735_689_600_001);
      issueCustomerPhoneAccess(PHONE, 1_735_689_600_000);

      const output = [...log.mock.calls, ...warn.mock.calls, ...error.mock.calls].flat().map(String).join(" ");
      expect(output).not.toContain(UNIT_SECRET);
    } finally {
      log.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    }
  });
});

describe("phoneAuth.agentSignIn", () => {
  it("requires a verification ticket rather than a customer phone-access token", async () => {
    const { caller, cookies } = createCaller();
    const customerAccessToken = issueCustomerPhoneAccess(PHONE);

    await expect(caller.agentSignIn({ verificationToken: customerAccessToken })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.getActiveAgentAccountByPhone).not.toHaveBeenCalled();
    expect(mocks.createSessionToken).not.toHaveBeenCalled();
    expect(cookies).toEqual([]);
  });

  it.each(["unknown", "inactive", "role-downgraded"])("does not set a cookie when the %s account is not an active agent", async () => {
    const { caller, cookies } = createCaller();
    mocks.getActiveAgentAccountByPhone.mockResolvedValue(null);

    await expect(caller.agentSignIn({ verificationToken: issuePhoneLoginTicket(PHONE) })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getActiveAgentAccountByPhone).toHaveBeenCalledWith(PHONE);
    expect(mocks.createSessionToken).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(cookies).toEqual([]);
  });

  it("creates the normal secure session cookie for a synthetic active agent and returns only the agent role", async () => {
    const { caller, cookies } = createCaller();
    mocks.getActiveAgentAccountByPhone.mockResolvedValue({
      fullName: "Synthetic active agent",
      user: { openId: "synthetic-agent-open-id" },
    });

    const result = await caller.agentSignIn({ verificationToken: issuePhoneLoginTicket(PHONE) });

    expect(mocks.createSessionToken).toHaveBeenCalledWith("synthetic-agent-open-id", {
      expiresInMs: 30 * 24 * 60 * 60 * 1000,
      name: "Synthetic active agent",
    });
    expect(cookies).toEqual([
      expect.objectContaining({
        name: COOKIE_NAME,
        value: "synthetic-session-token",
        options: expect.objectContaining({ httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, path: "/", sameSite: "none", secure: true }),
      }),
    ]);
    expect(result).toEqual({ success: true, name: "Synthetic active agent", role: "agent", phone: PHONE });
  });
});
