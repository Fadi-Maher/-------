import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import {
  agentApplications,
  customers,
  phoneProfiles,
  staffAccounts,
  users,
} from "../drizzle/schema";
import { CURRENT_TERMS_VERSION } from "../shared/legal";
import { getDb } from "./db";

export type PhoneProfileRole = "customer" | "agent";
export type SavedPhoneProfile = { fullName: string; email: string };
export type PhoneProfileCustomer = {
  id: number;
  fullName: string;
  email: string | null;
  phone: string | null;
};

export type PhoneProfileGetResult = {
  profile: SavedPhoneProfile | null;
  isNewCustomer: boolean;
  hasActiveAgent: boolean;
};

export type PhoneProfileSaveResult = {
  profile: SavedPhoneProfile;
  customer: PhoneProfileCustomer | null;
  hasActiveAgent: boolean;
};

export type SavePhoneProfileInput = SavedPhoneProfile & {
  role: PhoneProfileRole;
  acceptedTerms?: boolean;
};
/** Which existing accounts a verified phone already owns. Read-only; never creates or links anything. */
export type PhoneAccountsResult = {
  customer: { fullName: string } | null;
  activeAgent: { fullName: string } | null;
};
const SAUDI_MOBILE = /^05\d{8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badRequest(message: string): TRPCError {
  return new TRPCError({ code: "BAD_REQUEST", message });
}

function profileFrom(values: { fullName: string | null; email: string | null }): SavedPhoneProfile {
  return {
    fullName: values.fullName?.trim() || "",
    email: values.email?.trim().toLowerCase() || "",
  };
}

/** Revalidate at the storage boundary; callers must never make these constraints optional. */
export function normalizePhoneProfileInput(input: SavePhoneProfileInput): SavePhoneProfileInput {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  if (fullName.length < 2 || fullName.length > 160 || email.length > 320 || !EMAIL.test(email)) {
    throw badRequest("بيانات الملف الشخصي غير صالحة.");
  }
  return { ...input, fullName, email };
}

function assertPhone(phone: string) {
  if (!SAUDI_MOBILE.test(phone)) throw badRequest("رقم الجوال الموثق غير صحيح.");
}

async function stagedProfile(db: any, phone: string, role: PhoneProfileRole) {
  return (
    (
      await db
        .select({ fullName: phoneProfiles.fullName, email: phoneProfiles.email })
        .from(phoneProfiles)
        .where(and(eq(phoneProfiles.phone, phone), eq(phoneProfiles.role, role)))
        .limit(1)
    )[0] ?? null
  );
}

/** This is the same four-part authorization predicate as phone agent sign-in. */
async function activeAgentProfile(db: any, phone: string, lock = false) {
  let query = db
    .select({ account: staffAccounts, user: users })
    .from(staffAccounts)
    .innerJoin(users, eq(staffAccounts.userId, users.id))
    .where(
      and(
        eq(staffAccounts.phone, phone),
        eq(staffAccounts.role, "agent"),
        eq(staffAccounts.isActive, true),
        eq(users.role, "agent")
      )
    )
    .limit(1);
  if (lock) query = query.for("update");
  return (await query)[0] ?? null;
}

async function pendingAgentProfile(db: any, phone: string) {
  return (
    (
      await db
        .select({ fullName: agentApplications.fullName, email: agentApplications.email })
        .from(agentApplications)
        .where(
          and(
            eq(agentApplications.phone, phone),
            eq(agentApplications.status, "pending")
          )
        )
        .limit(1)
    )[0] ?? null
  );
}

async function writeStagedProfile(
  db: any,
  phone: string,
  role: PhoneProfileRole,
  profile: SavedPhoneProfile
) {
  const updatedAt = Date.now();
  await db
    .insert(phoneProfiles)
    .values({ phone, role, ...profile, updatedAt })
    .onDuplicateKeyUpdate({
      set: { fullName: profile.fullName, email: profile.email, updatedAt },
    });
}

function publicCustomer(customer: {
  id: number;
  fullName: string;
  email: string | null;
  phone: string | null;
}): PhoneProfileCustomer {
  return {
    id: customer.id,
    fullName: customer.fullName,
    email: customer.email,
    phone: customer.phone,
  };
}

/**
 * Reads only identity material for the signed phone and selected role. In
 * particular, no OAuth identity, arbitrary email, or unverified phone is used.
 */
export async function getPhoneProfile(
  phone: string,
  role: PhoneProfileRole
): Promise<PhoneProfileGetResult> {
  assertPhone(phone);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  if (role === "customer") {
    const [customerRows, staged] = await Promise.all([
      db
        .select({
          id: customers.id,
          fullName: customers.fullName,
          email: customers.email,
          phone: customers.phone,
        })
        .from(customers)
        .where(eq(customers.phone, phone))
        .limit(1),
      stagedProfile(db, phone, role),
    ]);
    const customer = customerRows[0] ?? null;
    if (customer) {
      return {
        // A customer record is authoritative; a staged email only fills legacy nulls.
        profile: {
          fullName: customer.fullName.trim(),
          email: customer.email?.trim().toLowerCase() || staged?.email || "",
        },
        isNewCustomer: false,
        hasActiveAgent: false,
      };
    }
    return {
      profile: staged ? profileFrom(staged) : null,
      isNewCustomer: true,
      hasActiveAgent: false,
    };
  }

  const [active, pending, staged] = await Promise.all([
    activeAgentProfile(db, phone),
    pendingAgentProfile(db, phone),
    stagedProfile(db, phone, role),
  ]);
  if (active) {
    return {
      profile: {
        fullName: active.user.name?.trim() || active.account.fullName.trim(),
        // staff_accounts.email is an immutable operational alias, not this profile email.
        email: active.user.email?.trim().toLowerCase() || staged?.email || "",
      },
      isNewCustomer: false,
      hasActiveAgent: true,
    };
  }
  if (pending) {
    return {
      profile: profileFrom(pending),
      isNewCustomer: false,
      hasActiveAgent: false,
    };
  }
  return {
    profile: staged ? profileFrom(staged) : null,
    isNewCustomer: false,
    hasActiveAgent: false,
  };
}

/**
 * Lets the sign-in window send a returning customer or active agent straight to
 * their workspace after OTP, skipping the account-type and profile steps.
 */
export async function getPhoneAccounts(phone: string): Promise<PhoneAccountsResult> {
  assertPhone(phone);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [customerRows, active] = await Promise.all([
    db
      .select({ fullName: customers.fullName })
      .from(customers)
      .where(eq(customers.phone, phone))
      .limit(1),
    activeAgentProfile(db, phone),
  ]);
  const customer = customerRows[0] ?? null;
  return {
    customer: customer ? { fullName: customer.fullName?.trim() || "" } : null,
    activeAgent: active
      ? { fullName: active.user.name?.trim() || active.account.fullName.trim() }
      : null,
  };
}

/**
 * Stores post-OTP details without creating roles or linking OAuth accounts. The
 * only agent update permitted here is to an already active, phone-bound agent.
 */
export async function savePhoneProfile(
  phone: string,
  rawInput: SavePhoneProfileInput
): Promise<PhoneProfileSaveResult> {
  assertPhone(phone);
  const input = normalizePhoneProfileInput(rawInput);
  const profile = { fullName: input.fullName, email: input.email };
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  return db.transaction(async (tx: any) => {
    if (input.role === "customer") {
      const existing = (
        await tx
          .select({
            id: customers.id,
            fullName: customers.fullName,
            email: customers.email,
            phone: customers.phone,
          })
          .from(customers)
          .where(eq(customers.phone, phone))
          .limit(1)
          .for("update")
      )[0] ?? null;

      let customer: PhoneProfileCustomer;
      if (existing) {
        await tx
          .update(customers)
          .set({ fullName: profile.fullName, email: profile.email })
          .where(eq(customers.id, existing.id));
        customer = {
          ...publicCustomer(existing),
          fullName: profile.fullName,
          email: profile.email,
        };
      } else {
        if (input.acceptedTerms !== true) {
          throw badRequest("يجب الموافقة على الشروط والأحكام قبل إنشاء حساب العميل.");
        }
        const created = await tx.insert(customers).values({
          phone,
          fullName: profile.fullName,
          email: profile.email,
          termsAcceptedAt: new Date(),
          termsVersion: CURRENT_TERMS_VERSION,
        });
        const id = Number(created[0].insertId);
        customer = { id, fullName: profile.fullName, email: profile.email, phone };
      }

      await writeStagedProfile(tx, phone, input.role, profile);
      return { profile, customer, hasActiveAgent: false };
    }

    // Lock and recheck all four attributes before touching any agent identity.
    const active = await activeAgentProfile(tx, phone, true);
    if (active) {
      const changedUser = await tx
        .update(users)
        .set({ name: profile.fullName, email: profile.email })
        .where(and(eq(users.id, active.user.id), eq(users.role, "agent")));
      if (Number(changedUser[0]?.affectedRows ?? 0) !== 1) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "حساب المعقب لم يعد مفعّلًا.",
        });
      }

      // Do not change staffAccounts.email: it remains the login/operational alias.
      const changedStaff = await tx
        .update(staffAccounts)
        .set({ fullName: profile.fullName })
        .where(
          and(
            eq(staffAccounts.id, active.account.id),
            eq(staffAccounts.phone, phone),
            eq(staffAccounts.role, "agent"),
            eq(staffAccounts.isActive, true)
          )
        );
      if (Number(changedStaff[0]?.affectedRows ?? 0) !== 1) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "حساب المعقب لم يعد مفعّلًا.",
        });
      }
    }

    // Pending/rejected/no-account agents get only a staged profile—never a user,
    // staff row, role change, or activation.
    await writeStagedProfile(tx, phone, input.role, profile);
    return { profile, customer: null, hasActiveAgent: Boolean(active) };
  });
}
