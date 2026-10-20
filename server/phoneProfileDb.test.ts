import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));

import { phoneProfiles } from "../drizzle/schema";
import { savePhoneProfile } from "./phoneProfileDb";

const phone = "0512345678";
const activeAgent = {
  account: {
    id: 17,
    phone,
    role: "agent" as const,
    isActive: true,
    fullName: "الاسم السابق",
    email: "agent-login-alias@internal.test",
  },
  user: { id: 41, role: "agent" as const, name: "الاسم السابق", email: "old@example.test" },
};

function activeSelect(row: typeof activeAgent | null) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.for = vi.fn(async () => (row ? [row] : []));
  return chain;
}

function transactionDb(row: typeof activeAgent | null) {
  const updateSets: Record<string, unknown>[] = [];
  const stagedWrites: Record<string, unknown>[] = [];
  const tx = {
    select: vi.fn(() => activeSelect(row)),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        updateSets.push(values);
        return { where: vi.fn(async () => [{ affectedRows: 1 }]) };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        stagedWrites.push(values);
        return { onDuplicateKeyUpdate: vi.fn(async () => undefined) };
      }),
    })),
  };
  return {
    db: { transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) },
    tx,
    updateSets,
    stagedWrites,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("savePhoneProfile agent authorization boundary", () => {
  it("updates personal users fields and staff fullName only for an active phone-bound agent", async () => {
    const fake = transactionDb(activeAgent);
    mocks.getDb.mockResolvedValue(fake.db);

    const result = await savePhoneProfile(phone, {
      role: "agent",
      fullName: "  الاسم الجديد  ",
      email: "PERSONAL@EXAMPLE.TEST ",
    });

    expect(result).toEqual({
      profile: { fullName: "الاسم الجديد", email: "personal@example.test" },
      customer: null,
      hasActiveAgent: true,
    });
    expect(fake.updateSets).toEqual([
      { name: "الاسم الجديد", email: "personal@example.test" },
      { fullName: "الاسم الجديد" },
    ]);
    // In particular staffAccounts.email—the synthetic/operational login alias—is never set.
    expect(fake.updateSets[1]).not.toHaveProperty("email");
    expect(fake.stagedWrites).toEqual([
      expect.objectContaining({
        phone,
        role: "agent",
        fullName: "الاسم الجديد",
        email: "personal@example.test",
      }),
    ]);
    expect(fake.tx.insert).toHaveBeenCalledWith(phoneProfiles);
  });

  it("does not create users, staff accounts, role changes, or activation for a non-active agent", async () => {
    const fake = transactionDb(null);
    mocks.getDb.mockResolvedValue(fake.db);

    const result = await savePhoneProfile(phone, {
      role: "agent",
      fullName: "معقب بانتظار المراجعة",
      email: "waiting@example.test",
    });

    expect(result).toEqual({
      profile: { fullName: "معقب بانتظار المراجعة", email: "waiting@example.test" },
      customer: null,
      hasActiveAgent: false,
    });
    expect(fake.tx.update).not.toHaveBeenCalled();
    // The only insert is the phone_profiles staging write, never users/staff_accounts.
    expect(fake.tx.insert).toHaveBeenCalledTimes(1);
    expect(fake.tx.insert).toHaveBeenCalledWith(phoneProfiles);
  });
});
