import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { auditLogs, customers, phoneProfiles } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Self-service profile for a phone-verified customer. The phone is the account
 * identity, so it is read-only here: it always comes from the signed access
 * token, never from the browser, and changing it would need a new OTP.
 */
export type CustomerProfile = {
  fullName: string;
  email: string | null;
  phone: string;
  memberSince: number | null;
};

export type CustomerProfileInput = { fullName: string; email: string | null | undefined };

export type CustomerProfileUpdateResult = {
  profile: CustomerProfile;
  changed: boolean;
  changedFields: Array<"fullName" | "email">;
};

const SAUDI_MOBILE = /^05\d{8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Control and invisible formatting characters are never meaningful in a name or email.
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
// Built at runtime because the project's TS target rejects the literal `u` flag.
const LETTER = new RegExp("\\p{L}", "gu");

function badRequest(message: string) {
  return new TRPCError({ code: "BAD_REQUEST", message });
}

function notFound() {
  return new TRPCError({
    code: "NOT_FOUND",
    message: "لا يوجد حساب عميل مرتبط برقم الجوال هذا. سجّل الدخول من جديد.",
  });
}

function assertPhone(phone: string) {
  if (!SAUDI_MOBILE.test(phone)) throw badRequest("رقم الجوال الموثق غير صحيح.");
}

/** Revalidates at the storage boundary; the router schema is not the only guard. */
export function normalizeCustomerProfileInput(input: CustomerProfileInput) {
  const fullName = input.fullName.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim();
  const letters = fullName.match(LETTER)?.length ?? 0;
  if (fullName.length < 2 || fullName.length > 160 || letters < 2) {
    throw badRequest("اكتب الاسم الكامل بحرفين على الأقل.");
  }
  const email = (input.email ?? "").replace(CONTROL_CHARS, "").trim().toLowerCase();
  if (email.length > 320 || (email && !EMAIL.test(email))) {
    throw badRequest("البريد الإلكتروني غير صالح.");
  }
  return { fullName, email: email || null };
}

function toProfile(row: { fullName: string; email: string | null; phone: string | null; createdAt: Date | null }, phone: string): CustomerProfile {
  return {
    fullName: row.fullName.trim(),
    email: row.email?.trim().toLowerCase() || null,
    phone: row.phone ?? phone,
    memberSince: row.createdAt ? row.createdAt.getTime() : null,
  };
}

const profileColumns = {
  id: customers.id,
  fullName: customers.fullName,
  email: customers.email,
  phone: customers.phone,
  createdAt: customers.createdAt,
};

export async function getCustomerProfileByPhone(phone: string): Promise<CustomerProfile> {
  assertPhone(phone);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const row = (await db.select(profileColumns).from(customers).where(eq(customers.phone, phone)).limit(1))[0];
  if (!row) throw notFound();
  return toProfile(row, phone);
}

export async function updateCustomerProfileByPhone(
  phone: string,
  rawInput: CustomerProfileInput,
): Promise<CustomerProfileUpdateResult> {
  assertPhone(phone);
  const input = normalizeCustomerProfileInput(rawInput);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async (tx: any) => {
    const existing = (
      await tx.select(profileColumns).from(customers).where(eq(customers.phone, phone)).limit(1).for("update")
    )[0];
    if (!existing) throw notFound();
    const before = toProfile(existing, phone);
    const changedFields: CustomerProfileUpdateResult["changedFields"] = [];
    if (before.fullName !== input.fullName) changedFields.push("fullName");
    if ((before.email ?? null) !== input.email) changedFields.push("email");
    if (changedFields.length === 0) return { profile: before, changed: false, changedFields };

    await tx
      .update(customers)
      .set({ fullName: input.fullName, email: input.email })
      .where(and(eq(customers.id, existing.id), eq(customers.phone, phone)));
    // Keep the staged post-OTP profile in step; otherwise a cleared email would be refilled from it.
    await tx
      .update(phoneProfiles)
      .set({ fullName: input.fullName, email: input.email ?? "", updatedAt: Date.now() })
      .where(and(eq(phoneProfiles.phone, phone), eq(phoneProfiles.role, "customer")));
    // Record which fields changed, not their values, so the log does not duplicate personal data.
    await tx.insert(auditLogs).values({
      actorUserId: null,
      actorRole: "customer",
      actorName: input.fullName.slice(0, 160),
      action: "customer.profile_updated",
      summary: `عدّل العميل بيانات ملفه الشخصي (${changedFields.map(field => (field === "fullName" ? "الاسم" : "البريد الإلكتروني")).join("، ")}).`,
      beforeJson: JSON.stringify({ customerId: existing.id, changedFields }),
      afterJson: JSON.stringify({ customerId: existing.id, changedFields }),
    });
    return {
      profile: { ...before, fullName: input.fullName, email: input.email },
      changed: true,
      changedFields,
    };
  });
}
