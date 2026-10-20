import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import {
  agentApplications,
  auditLogs,
  customerNotifications,
  customerPhoneReleases,
  customers,
  phoneProfiles,
  staffAccounts,
  transactionRequests,
} from "../drizzle/schema";
import type { CustomerProfile } from "./customerProfileDb";
import { getDb } from "./db";

/**
 * Moving a phone-verified customer to a new mobile number.
 *
 * Requests and customer notifications are keyed by phone, so the change moves them in one
 * transaction. The previous number is then "released": customer access tokens for it that
 * were issued before the change are rejected, so another device still signed in with the
 * old number cannot see whatever is later created under it.
 */
export type PhoneChangeLanguage = "ar" | "en";
export type CustomerPhoneChangeResult = {
  profile: CustomerProfile;
  previousPhone: string;
  movedRequests: number;
  movedNotifications: number;
};

const SAUDI_MOBILE = /^05\d{8}$/;
const RELEASE_CACHE_MS = 10_000;
const RELEASE_CACHE_LIMIT = 5_000;
const releaseCache = new Map<string, { releasedAt: number | null; fetchedAt: number }>();

const say = (language: PhoneChangeLanguage, ar: string, en: string) => (language === "en" ? en : ar);

/** Keeps only the prefix and last four digits so audit entries do not copy full numbers. */
export function maskPhone(phone: string) {
  return phone.length >= 6 ? `${phone.slice(0, 2)}••••${phone.slice(-4)}` : "••••";
}

function assertMobile(phone: string, language: PhoneChangeLanguage) {
  if (!SAUDI_MOBILE.test(phone)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: say(language, "أدخل رقم جوال سعودي صحيحًا يبدأ بـ 05.", "Enter a valid Saudi mobile number starting with 05."),
    });
  }
}

function accountMissing(language: PhoneChangeLanguage) {
  return new TRPCError({
    code: "NOT_FOUND",
    message: say(
      language,
      "لا يوجد حساب عميل مرتبط برقم الجوال هذا. سجّل الدخول من جديد.",
      "No customer account is linked to this mobile number. Sign in again.",
    ),
  });
}

function numberUnavailable(language: PhoneChangeLanguage) {
  // One message for every kind of conflict, so the response does not reveal how the number is used.
  return new TRPCError({
    code: "CONFLICT",
    message: say(
      language,
      "هذا الرقم مرتبط بحساب أو طلبات أخرى، فلا يمكن نقله إلى حسابك. استخدم رقمًا آخر أو تواصل مع الدعم.",
      "This number is already linked to another account or to existing requests, so it can't be moved to your account. Use another number or contact support.",
    ),
  });
}

function sameNumber(language: PhoneChangeLanguage) {
  return new TRPCError({
    code: "BAD_REQUEST",
    message: say(language, "هذا هو رقمك الحالي. أدخل رقمًا جديدًا.", "That is your current number. Enter a new one."),
  });
}

function isDuplicateKey(error: unknown) {
  const value = error as { code?: string; errno?: number; cause?: { code?: string; errno?: number } } | null;
  return (
    value?.code === "ER_DUP_ENTRY" ||
    value?.errno === 1062 ||
    value?.cause?.code === "ER_DUP_ENTRY" ||
    value?.cause?.errno === 1062
  );
}

/** When the phone was last given up by a customer's number change, or null. Cached briefly per process. */
export async function getPhoneReleasedAt(phone: string, now = Date.now()): Promise<number | null> {
  const cached = releaseCache.get(phone);
  if (cached && now - cached.fetchedAt < RELEASE_CACHE_MS) return cached.releasedAt;
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const row = (
    await db
      .select({ releasedAt: customerPhoneReleases.releasedAt })
      .from(customerPhoneReleases)
      .where(eq(customerPhoneReleases.phone, phone))
      .limit(1)
  )[0];
  const releasedAt = row ? Number(row.releasedAt) : null;
  if (releaseCache.size >= RELEASE_CACHE_LIMIT) releaseCache.clear();
  releaseCache.set(phone, { releasedAt, fetchedAt: now });
  return releasedAt;
}

/** Rejects a customer token issued at or before the phone was released by a number change. */
export async function assertPhoneAccessCurrent(phone: string, issuedAtMs: number) {
  const releasedAt = await getPhoneReleasedAt(phone);
  if (releasedAt !== null && issuedAtMs <= releasedAt) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "انتهت جلسة التحقق. أعد التحقق من رقم الجوال." });
  }
}

/** Test hook: forget cached release lookups. */
export function clearPhoneReleaseCache() {
  releaseCache.clear();
}

/**
 * Cheap checks before a code is prepared for the new number. Whether the new number is
 * already in use is only answered after it is verified, so this cannot be used to probe numbers.
 */
export async function assertCanRequestPhoneChange(currentPhone: string, newPhone: string, language: PhoneChangeLanguage) {
  assertMobile(currentPhone, language);
  assertMobile(newPhone, language);
  if (currentPhone === newPhone) throw sameNumber(language);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const customer = (
    await db.select({ id: customers.id }).from(customers).where(eq(customers.phone, currentPhone)).limit(1)
  )[0];
  if (!customer) throw accountMissing(language);
}

/** Called only after the new number passed OTP verification. */
export async function changeCustomerPhone(
  currentPhone: string,
  newPhone: string,
  language: PhoneChangeLanguage,
  now = Date.now(),
): Promise<CustomerPhoneChangeResult> {
  assertMobile(currentPhone, language);
  assertMobile(newPhone, language);
  if (currentPhone === newPhone) throw sameNumber(language);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  let result: CustomerPhoneChangeResult;
  try {
    result = await db.transaction(async (tx: any) => {
      const customer = (
        await tx
          .select({ id: customers.id, fullName: customers.fullName, email: customers.email, createdAt: customers.createdAt })
          .from(customers)
          .where(eq(customers.phone, currentPhone))
          .limit(1)
          .for("update")
      )[0];
      if (!customer) throw accountMissing(language);

      // The new number must be completely unused, so nobody else's requests or account are merged in.
      const probes = [
        tx.select({ id: customers.id }).from(customers).where(eq(customers.phone, newPhone)).limit(1),
        tx.select({ id: phoneProfiles.id }).from(phoneProfiles).where(eq(phoneProfiles.phone, newPhone)).limit(1),
        tx.select({ id: staffAccounts.id }).from(staffAccounts).where(eq(staffAccounts.phone, newPhone)).limit(1),
        tx.select({ id: agentApplications.id }).from(agentApplications).where(eq(agentApplications.phone, newPhone)).limit(1),
        tx.select({ id: transactionRequests.id }).from(transactionRequests).where(eq(transactionRequests.phone, newPhone)).limit(1),
        tx.select({ id: customerNotifications.id }).from(customerNotifications).where(eq(customerNotifications.phone, newPhone)).limit(1),
      ];
      for (const probe of probes) {
        if ((await probe).length > 0) throw numberUnavailable(language);
      }

      await tx.update(customers).set({ phone: newPhone }).where(and(eq(customers.id, customer.id), eq(customers.phone, currentPhone)));
      await tx
        .update(phoneProfiles)
        .set({ phone: newPhone, updatedAt: now })
        .where(and(eq(phoneProfiles.phone, currentPhone), eq(phoneProfiles.role, "customer")));
      const movedRequests = Number(
        (await tx.update(transactionRequests).set({ phone: newPhone }).where(eq(transactionRequests.phone, currentPhone)))[0]?.affectedRows ?? 0,
      );
      const movedNotifications = Number(
        (await tx.update(customerNotifications).set({ phone: newPhone }).where(eq(customerNotifications.phone, currentPhone)))[0]?.affectedRows ?? 0,
      );
      await tx
        .insert(customerPhoneReleases)
        .values({ phone: currentPhone, customerId: customer.id, releasedAt: now })
        .onDuplicateKeyUpdate({ set: { customerId: customer.id, releasedAt: now } });
      await tx.insert(auditLogs).values({
        actorUserId: null,
        actorRole: "customer",
        actorName: String(customer.fullName).slice(0, 160),
        action: "customer.phone_changed",
        summary: `غيّر العميل رقم جواله بعد التحقق من الرقم الجديد (${maskPhone(currentPhone)} ← ${maskPhone(newPhone)}).`,
        beforeJson: JSON.stringify({ customerId: customer.id, phone: maskPhone(currentPhone) }),
        afterJson: JSON.stringify({ customerId: customer.id, phone: maskPhone(newPhone), movedRequests, movedNotifications }),
      });
      return {
        profile: {
          fullName: String(customer.fullName).trim(),
          email: customer.email?.trim().toLowerCase() || null,
          phone: newPhone,
          memberSince: customer.createdAt ? new Date(customer.createdAt).getTime() : null,
        },
        previousPhone: currentPhone,
        movedRequests,
        movedNotifications,
      };
    });
  } catch (error) {
    // A parallel sign-up can claim the number between the check and the update.
    if (isDuplicateKey(error)) throw numberUnavailable(language);
    throw error;
  }
  releaseCache.set(currentPhone, { releasedAt: now, fetchedAt: now });
  return result;
}
