import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

const { env, getDb } = vi.hoisted(() => ({
  env: { appId: "deployment-unit-app", cookieSecret: "deployment-test-secret-only", databaseUrl: "", oAuthServerUrl: "https://example.invalid", ownerOpenId: "owner", isProduction: false, forgeApiUrl: "", forgeApiKey: "" },
  getDb: vi.fn(),
}));
vi.mock("./_core/env", () => ({ ENV: env }));
vi.mock("./db", () => ({ getDb }));
import { assertProductionEnvironment, registerDeploymentRoutes } from "./deployment";
import { assertDemoPhoneVerificationAllowed, getPhoneVerificationConfig } from "./phoneVerificationPolicy";
import { requestPhoneCode, resendPhoneCode, verifyPhoneCode } from "./phoneOtpDb";
import { verifyPhoneLoginTicket } from "./phoneLoginTicket";
import { sdk } from "./_core/sdk";

afterEach(() => {
  vi.unstubAllEnvs();
  env.isProduction = false;
});

describe("production phone authentication policy", () => {
  beforeEach(() => { getDb.mockReset(); });
  it("keeps the existing explicit demo only in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getPhoneVerificationConfig()).toEqual({ mode: "demo", realMessagesSent: false });
    expect(() => assertDemoPhoneVerificationAllowed()).not.toThrow();
  });
  it("never advertises real delivery or demo availability in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(getPhoneVerificationConfig()).toEqual({ mode: "disabled", realMessagesSent: false });
    expect(() => assertDemoPhoneVerificationAllowed("en")).toThrow("real verification service");
  });
  it("rejects requesting, resending and verifying demo codes before touching the database", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(requestPhoneCode("0500000000")).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(resendPhoneCode("00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(verifyPhoneCode({ challengeId: "x", code: "123456", clientKey: "x" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(getDb).not.toHaveBeenCalled();
  });
  it("rejects a previously issued phone login ticket in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => verifyPhoneLoginTicket("previously-issued-demo-ticket")).toThrow("خدمة تحقق فعلية");
  });
});

describe("production startup configuration", () => {
  it("fails clearly on missing required configuration without disclosing values", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    expect(() => assertProductionEnvironment()).toThrow("DATABASE_URL");
  });
  it("does not require production-only configuration in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", "");
    expect(() => assertProductionEnvironment()).not.toThrow();
  });
});

describe("health endpoints and response safety", () => {
  let server: Server;
  let base: string;
  const probe = vi.fn<() => Promise<void>>();
  beforeAll(async () => {
    const app = express();
    registerDeploymentRoutes(app, probe);
    app.get("/api/test", (_req, res) => res.json({ ok: true }));
    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  beforeEach(() => { probe.mockReset().mockResolvedValue(undefined); });
  it("reports process liveness without running a database probe", async () => {
    const response = await fetch(`${base}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", service: "maalamati-care" });
    expect(probe).not.toHaveBeenCalled();
  });
  it("checks the database before reporting readiness", async () => {
    const response = await fetch(`${base}/api/ready`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready", database: "connected" });
    expect(probe).toHaveBeenCalledOnce();
  });
  it("returns a generic 503 instead of leaking database errors", async () => {
    probe.mockRejectedValue(new Error("password=private-database-secret"));
    const response = await fetch(`${base}/api/ready`);
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain("private-database-secret");
    expect(JSON.parse(text)).toEqual({ status: "unavailable", database: "unavailable" });
  });
  it("prevents caching of API data and removes the framework signature", async () => {
    const response = await fetch(`${base}/api/test`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-powered-by")).toBeNull();
  });
  it("adds HTTPS transport policy behind the production proxy", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await fetch(`${base}/api/health`, { headers: { "x-forwarded-proto": "https" } });
    expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000");
  });
});

describe("deployment session isolation", () => {
  it("rejects old sessions and development sessions in production", async () => {
    const secret = new TextEncoder().encode(env.cookieSecret);
    const old = await new SignJWT({ openId: "owner", appId: env.appId, name: "Owner" })
      .setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(secret);
    const development = await sdk.createSessionToken("owner", { name: "Owner" });
    env.isProduction = true;
    expect(await sdk.verifySession(old)).toBeNull();
    expect(await sdk.verifySession(development)).toBeNull();
  });
  it("accepts a fresh production session for this project", async () => {
    env.isProduction = true;
    const token = await sdk.createSessionToken("owner", { name: "Owner" });
    expect(await sdk.verifySession(token)).toMatchObject({ openId: "owner", appId: env.appId });
  });
});
