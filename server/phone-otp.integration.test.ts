import { randomInt, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { phoneOtpChallenges } from "../drizzle/schema";
import { getDb } from "./db";
import { PHONE_LOGIN_TTL_MS, verifyPhoneLoginTicket } from "./phoneLoginTicket";
import {
  OTP_ATTEMPTS,
  OTP_DEMO_CODE,
  OTP_RESEND_MS,
  OTP_TTL_MS,
  requestPhoneCode,
  resendPhoneCode,
  verifyPhoneCode,
} from "./phoneOtpDb";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Fixture = { phone: string; rowIds: Set<number>; cleaned: boolean };

let db: Database;
const fixtures: Fixture[] = [];

function uniqueSaudiPhone() {
  return `05${randomInt(0, 100_000_000).toString().padStart(8, "0")}`;
}

async function createFixture(): Promise<Fixture> {
  for (let tries = 0; tries < 10; tries += 1) {
    const phone = uniqueSaudiPhone();
    const existing = await db.select({ id: phoneOtpChallenges.id }).from(phoneOtpChallenges).where(eq(phoneOtpChallenges.phone, phone)).limit(1);
    if (existing.length === 0) {
      const fixture = { phone, rowIds: new Set<number>(), cleaned: false };
      fixtures.push(fixture);
      return fixture;
    }
  }
  throw new Error("Could not allocate a unique Saudi test phone after 10 attempts.");
}

async function readFixtureRow(fixture: Fixture, challengeId: string) {
  const row = (await db.select().from(phoneOtpChallenges).where(eq(phoneOtpChallenges.challengeId, challengeId)).limit(1))[0];
  expect(row).toBeDefined();
  expect(row?.phone).toBe(fixture.phone);
  fixture.rowIds.add(row!.id);
  return row!;
}

async function cleanupFixture(fixture: Fixture) {
  if (fixture.cleaned) return;
  fixture.cleaned = true;
  for (const id of fixture.rowIds) {
    await db.delete(phoneOtpChallenges).where(eq(phoneOtpChallenges.id, id));
    const remaining = await db.select({ id: phoneOtpChallenges.id }).from(phoneOtpChallenges).where(eq(phoneOtpChallenges.id, id)).limit(1);
    expect(remaining).toEqual([]);
  }
}

beforeAll(async () => {
  const connected = await getDb();
  if (!connected) throw new Error("phone OTP integration tests require DATABASE_URL and migration 0020 to be applied.");
  db = connected;

  try {
    await db.select({ id: phoneOtpChallenges.id }).from(phoneOtpChallenges).limit(1);
  } catch (error) {
    throw new Error("phone_otp_challenges is unavailable; apply migration 0020 before running phone OTP integration tests.", { cause: error });
  }
});

afterAll(async () => {
  for (const fixture of fixtures) await cleanupFixture(fixture);
});

describe.sequential("phone OTP persistence integration", () => {
  it("reuses concurrent fresh requests, renews only after the deadline, and makes same-client verification idempotent", async () => {
    const fixture = await createFixture();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const start = 1_735_689_600_000;

    try {
      const initial = await Promise.allSettled([
        requestPhoneCode(fixture.phone, "en", start),
        requestPhoneCode(fixture.phone, "en", start),
      ]);
      const descriptors = initial.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof requestPhoneCode>>> => result.status === "fulfilled").map(result => result.value);
      const failures = initial.filter((result): result is PromiseRejectedResult => result.status === "rejected");

      expect(descriptors.length).toBeGreaterThanOrEqual(1);
      expect(failures).toHaveLength(initial.length - descriptors.length);
      for (const failure of failures) expect(failure.reason).toMatchObject({ code: "CONFLICT" });
      expect(new Set(descriptors.map(descriptor => descriptor.challengeId)).size).toBe(1);

      const first = descriptors[0]!;
      expect(Object.keys(first).sort()).toEqual(["challengeId", "demoCode", "expiresAt", "mode", "resendAvailableAt", "serverNow"]);
      expect(first).not.toHaveProperty("codeHash");
      expect(first).not.toHaveProperty("phone");
      expect(first).toMatchObject({ mode: "demo", demoCode: OTP_DEMO_CODE, serverNow: start, expiresAt: start + OTP_TTL_MS, resendAvailableAt: start + OTP_RESEND_MS });
      expect(fetchSpy).not.toHaveBeenCalled();

      const firstRow = await readFixtureRow(fixture, first.challengeId);
      expect(firstRow.codeHash).not.toBe(OTP_DEMO_CODE);
      expect(firstRow.codeHash).toMatch(/^[a-f0-9]{64}$/);
      expect(firstRow.attemptCount).toBe(0);

      const cooldownDescriptor = await requestPhoneCode(fixture.phone, "en", start + 1);
      expect(cooldownDescriptor.challengeId).toBe(first.challengeId);
      await expect(resendPhoneCode(first.challengeId, "en", start + OTP_RESEND_MS - 1)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

      const renewed = await resendPhoneCode(first.challengeId, "en", start + OTP_RESEND_MS);
      expect(renewed.challengeId).not.toBe(first.challengeId);
      await readFixtureRow(fixture, renewed.challengeId);
      await expect(verifyPhoneCode({ challengeId: first.challengeId, code: OTP_DEMO_CODE, clientKey: randomUUID(), language: "en" }, start + OTP_RESEND_MS)).rejects.toMatchObject({ code: "UNAUTHORIZED" });

      const clientKey = randomUUID();
      const verifiedAt = start + OTP_RESEND_MS + 10;
      const sameClient = await Promise.all([
        verifyPhoneCode({ challengeId: renewed.challengeId, code: OTP_DEMO_CODE, clientKey, language: "en" }, verifiedAt),
        verifyPhoneCode({ challengeId: renewed.challengeId, code: OTP_DEMO_CODE, clientKey, language: "en" }, verifiedAt),
      ]);
      expect(sameClient.map(result => result.verifiedAt)).toEqual([verifiedAt, verifiedAt]);
      expect(sameClient[0]?.verificationToken).toBe(sameClient[1]?.verificationToken);
      expect(verifyPhoneLoginTicket(sameClient[0]!.verificationToken, verifiedAt)).toBe(fixture.phone);
      expect(sameClient[0]?.expiresAt).toBe(verifiedAt + PHONE_LOGIN_TTL_MS);

      const retry = await verifyPhoneCode({ challengeId: renewed.challengeId, code: OTP_DEMO_CODE, clientKey, language: "en" }, verifiedAt + 5_000);
      expect(retry).toMatchObject({ verifiedAt, verificationToken: sameClient[0]!.verificationToken, expiresAt: verifiedAt + PHONE_LOGIN_TTL_MS });
      await expect(verifyPhoneCode({ challengeId: renewed.challengeId, code: OTP_DEMO_CODE, clientKey: randomUUID(), language: "en" }, verifiedAt + 5_001)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    } finally {
      fetchSpy.mockRestore();
      await cleanupFixture(fixture);
    }
  }, 60_000);

  it("allows exactly one simultaneous correct verification from different client keys", async () => {
    const fixture = await createFixture();
    const now = 1_735_689_700_000;

    try {
      const descriptor = await requestPhoneCode(fixture.phone, "ar", now);
      await readFixtureRow(fixture, descriptor.challengeId);
      const attempts = await Promise.allSettled([
        verifyPhoneCode({ challengeId: descriptor.challengeId, code: OTP_DEMO_CODE, clientKey: randomUUID(), language: "ar" }, now + 1),
        verifyPhoneCode({ challengeId: descriptor.challengeId, code: OTP_DEMO_CODE, clientKey: randomUUID(), language: "ar" }, now + 1),
      ]);
      const successes = attempts.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof verifyPhoneCode>>> => result.status === "fulfilled");
      const failures = attempts.filter((result): result is PromiseRejectedResult => result.status === "rejected");

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      expect(failures[0]?.reason).toMatchObject({ code: "UNAUTHORIZED" });
      expect(verifyPhoneLoginTicket(successes[0]!.value.verificationToken, now + 1)).toBe(fixture.phone);
    } finally {
      await cleanupFixture(fixture);
    }
  }, 60_000);

  it("commits five incorrect attempts before locking the challenge", async () => {
    const fixture = await createFixture();
    const now = 1_735_689_800_000;

    try {
      const descriptor = await requestPhoneCode(fixture.phone, "en", now);
      for (let attempt = 1; attempt <= OTP_ATTEMPTS; attempt += 1) {
        await expect(verifyPhoneCode({ challengeId: descriptor.challengeId, code: "000000", clientKey: randomUUID(), language: "en" }, now + attempt)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
        const row = await readFixtureRow(fixture, descriptor.challengeId);
        expect(row.attemptCount).toBe(attempt);
      }
      await expect(verifyPhoneCode({ challengeId: descriptor.challengeId, code: OTP_DEMO_CODE, clientKey: randomUUID(), language: "en" }, now + OTP_ATTEMPTS + 1)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      const locked = await readFixtureRow(fixture, descriptor.challengeId);
      expect(locked).toMatchObject({ attemptCount: OTP_ATTEMPTS, verifiedAt: null });
    } finally {
      await cleanupFixture(fixture);
    }
  }, 60_000);

  it("uses exclusive expiry and enforces the five-send hourly window with virtual time", async () => {
    const fixture = await createFixture();
    const expiryStart = 1_735_689_900_000;
    try {
      let descriptor = await requestPhoneCode(fixture.phone, "en", expiryStart);
      await readFixtureRow(fixture, descriptor.challengeId);
      await expect(verifyPhoneCode({ challengeId: descriptor.challengeId, code: OTP_DEMO_CODE, clientKey: randomUUID(), language: "en" }, expiryStart + OTP_TTL_MS)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      const expired = await readFixtureRow(fixture, descriptor.challengeId);
      expect(expired.verifiedAt).toBeNull();

      const windowStart = expiryStart + 60 * 60_000;
      descriptor = await requestPhoneCode(fixture.phone, "ar", windowStart);
      await readFixtureRow(fixture, descriptor.challengeId);
      for (let sendCount = 2; sendCount <= 5; sendCount += 1) {
        descriptor = await resendPhoneCode(descriptor.challengeId, "ar", windowStart + (sendCount - 1) * OTP_RESEND_MS);
        const row = await readFixtureRow(fixture, descriptor.challengeId);
        expect(row.sendCount).toBe(sendCount);
      }
      await expect(resendPhoneCode(descriptor.challengeId, "ar", windowStart + 5 * OTP_RESEND_MS)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
      expect((await readFixtureRow(fixture, descriptor.challengeId)).sendCount).toBe(5);

      const afterWindow = await resendPhoneCode(descriptor.challengeId, "ar", windowStart + 60 * 60_000);
      const resetRow = await readFixtureRow(fixture, afterWindow.challengeId);
      expect(resetRow.sendCount).toBe(1);
    } finally {
      await cleanupFixture(fixture);
    }
  }, 60_000);
});
