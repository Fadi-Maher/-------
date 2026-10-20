import { TRPCError } from "@trpc/server";
import { and, desc, eq, or } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  agentApplications,
  auditLogs,
  staffAccounts,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb } from "./db";

export type AgentApplicationPermissions = {
  canViewAssigned: boolean;
  canUpdateStatus: boolean;
  canAddCustomerUpdate: boolean;
};

export type SubmitAgentApplicationInput = {
  fullName: string;
  email: string;
  city: string;
  specialty: string;
  experienceYears: number;
  notes?: string;
};

export type ReviewAgentApplicationInput = {
  id: number;
  decision: "approved" | "rejected";
  reviewNote?: string;
  permissions: AgentApplicationPermissions;
  actorUserId: number;
};

type ApplicationForPublicView = {
  id: number;
  phone: string;
  fullName: string;
  email: string;
  city: string;
  specialty: string;
  experienceYears: number;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  createdAt: number;
  reviewedAt: number | null;
};

const SAUDI_MOBILE = /^05\d{8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function conflict(message: string): TRPCError {
  return new TRPCError({ code: "CONFLICT", message });
}

function normalizeSubmission(
  phone: string,
  input: SubmitAgentApplicationInput
) {
  if (!SAUDI_MOBILE.test(phone)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "رقم الجوال الموثق غير صحيح.",
    });
  }
  const fullName = input.fullName.trim();
  const city = input.city.trim();
  const specialty = input.specialty.trim();
  const email = input.email.trim().toLowerCase();
  const notes = input.notes?.trim() || null;
  if (
    fullName.length < 2 ||
    fullName.length > 160 ||
    city.length < 2 ||
    city.length > 120 ||
    specialty.length < 2 ||
    specialty.length > 160 ||
    !EMAIL.test(email) ||
    email.length > 320 ||
    (notes !== null && notes.length > 1000) ||
    !Number.isInteger(input.experienceYears) ||
    input.experienceYears < 0 ||
    input.experienceYears > 80
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "بيانات طلب الانضمام غير صالحة.",
    });
  }
  return {
    fullName,
    city,
    specialty,
    email,
    notes,
    experienceYears: input.experienceYears,
  };
}

function normalizeReview(input: ReviewAgentApplicationInput) {
  const reviewNote = input.reviewNote?.trim() || null;
  if (!Number.isInteger(input.id) || input.id <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "معرّف الطلب غير صالح.",
    });
  }
  if (reviewNote && reviewNote.length > 500) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "ملاحظة المراجعة طويلة جدًا.",
    });
  }
  if (input.decision === "rejected" && (!reviewNote || reviewNote.length < 3)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "سبب الرفض يجب أن يتكون من 3 أحرف على الأقل.",
    });
  }
  if (
    Object.values(input.permissions).some(value => typeof value !== "boolean")
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "صلاحيات المعقب غير صالحة.",
    });
  }
  return { ...input, reviewNote };
}

function isDuplicateError(error: unknown): boolean {
  const value = error as { code?: string; errno?: number; cause?: unknown };
  return (
    value?.code === "ER_DUP_ENTRY" ||
    value?.errno === 1062 ||
    Boolean(value?.cause && isDuplicateError(value.cause))
  );
}

/** Deliberately contains only fields safe to return to the phone-ticket holder. */
export function toPublicAgentApplication(
  application: ApplicationForPublicView
) {
  return {
    id: application.id,
    reference: `JOIN-${application.id}`,
    phone: application.phone,
    fullName: application.fullName,
    email: application.email,
    city: application.city,
    specialty: application.specialty,
    experienceYears: application.experienceYears,
    notes: application.notes,
    status: application.status,
    reviewNote: application.reviewNote,
    createdAt: Number(application.createdAt),
    reviewedAt:
      application.reviewedAt === null ? null : Number(application.reviewedAt),
  };
}

async function findApplicationByPhone(phone: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return (
    (
      await db
        .select()
        .from(agentApplications)
        .where(eq(agentApplications.phone, phone))
        .limit(1)
    )[0] ?? null
  );
}

/** Mirrors getActiveAgentAccountByPhone exactly, including the user-role guard. */
async function hasActiveAgentByPhone(phone: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const active = (
    await db
      .select({ id: staffAccounts.id })
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
      .limit(1)
  )[0];
  return Boolean(active);
}

export async function getAgentApplicationStatus(phone: string) {
  if (!SAUDI_MOBILE.test(phone)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "رقم الجوال الموثق غير صحيح.",
    });
  }
  const [application, hasActiveAgent] = await Promise.all([
    findApplicationByPhone(phone),
    hasActiveAgentByPhone(phone),
  ]);
  return {
    hasActiveAgent,
    application: application ? toPublicAgentApplication(application) : null,
  };
}

/**
 * Creates exactly one request per ticket phone. The database unique index is the
 * race-safe fallback when two browser requests observe the empty state together.
 */
export async function submitAgentApplication(
  phone: string,
  rawInput: SubmitAgentApplicationInput
) {
  const input = normalizeSubmission(phone, rawInput);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  try {
    return await db.transaction(async tx => {
      const activeAccount = (
        await tx
          .select({ id: staffAccounts.id })
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
          .limit(1)
          .for("update")
      )[0];
      if (activeAccount) {
        throw conflict(
          "لديك حساب معقب نشط بالفعل، ولا يمكن إرسال طلب انضمام جديد."
        );
      }

      const existing = (
        await tx
          .select()
          .from(agentApplications)
          .where(eq(agentApplications.phone, phone))
          .limit(1)
          .for("update")
      )[0];
      // Pending requests are immutable retries. Resolved rows also remain immutable:
      // submit never changes a review result or grants access.
      if (existing) return existing;

      const now = Date.now();
      const inserted = await tx.insert(agentApplications).values({
        phone,
        ...input,
        consentedAt: now,
        createdAt: now,
        status: "pending",
      });
      const id = Number(inserted[0].insertId);
      return (
        await tx
          .select()
          .from(agentApplications)
          .where(eq(agentApplications.id, id))
          .limit(1)
      )[0]!;
    });
  } catch (error) {
    if (!isDuplicateError(error)) throw error;
    const existing = await findApplicationByPhone(phone);
    if (existing) return existing;
    throw conflict("تعذر حفظ طلب الانضمام بسبب تعارض متزامن. أعد المحاولة.");
  }
}

export async function listAgentApplications() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db
    .select()
    .from(agentApplications)
    .orderBy(desc(agentApplications.createdAt), desc(agentApplications.id));
}

function mobileOpenId(phone: string) {
  return `agent_mobile_${createHash("sha256").update(phone).digest("hex").slice(0, 48)}`;
}

/**
 * Reviews a pending request under a row lock. Approval intentionally never looks
 * up users by email: only the deterministic phone-OTP openId may be promoted.
 */
export async function reviewAgentApplication(
  rawInput: ReviewAgentApplicationInput
) {
  const input = normalizeReview(rawInput);
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  try {
    return await db.transaction(async tx => {
      const application = (
        await tx
          .select()
          .from(agentApplications)
          .where(eq(agentApplications.id, input.id))
          .limit(1)
          .for("update")
      )[0];
      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "طلب الانضمام غير موجود.",
        });
      }

      if (application.status !== "pending") {
        if (application.status === input.decision) return application;
        throw conflict("تمت مراجعة طلب الانضمام بقرار مختلف ولا يمكن تغييره.");
      }

      const reviewedAt = Date.now();
      if (input.decision === "rejected") {
        await tx
          .update(agentApplications)
          .set({
            status: "rejected",
            reviewedAt,
            reviewedByUserId: input.actorUserId,
            reviewNote: input.reviewNote,
          })
          .where(
            and(
              eq(agentApplications.id, application.id),
              eq(agentApplications.status, "pending")
            )
          );
        await tx.insert(auditLogs).values({
          actorUserId: input.actorUserId,
          actorRole: "admin",
          actorName: null,
          requestId: null,
          action: "agent_application_rejected",
          summary: "رُفض طلب انضمام معقب.",
          beforeJson: JSON.stringify({
            applicationId: application.id,
            status: "pending",
          }),
          afterJson: JSON.stringify({
            applicationId: application.id,
            status: "rejected",
          }),
        });
        return (
          await tx
            .select()
            .from(agentApplications)
            .where(eq(agentApplications.id, application.id))
            .limit(1)
        )[0]!;
      }

      // Use the exact active-account policy used by the login path, and lock its
      // indexed staff row before provisioning.
      const activeAccount = (
        await tx
          .select({ id: staffAccounts.id })
          .from(staffAccounts)
          .innerJoin(users, eq(staffAccounts.userId, users.id))
          .where(
            and(
              eq(staffAccounts.phone, application.phone),
              eq(staffAccounts.role, "agent"),
              eq(staffAccounts.isActive, true),
              eq(users.role, "agent")
            )
          )
          .limit(1)
          .for("update")
      )[0];
      if (activeAccount) {
        throw conflict("رقم الجوال مرتبط بالفعل بحساب معقب نشط.");
      }

      const openId = mobileOpenId(application.phone);
      if (ENV.ownerOpenId && openId === ENV.ownerOpenId) {
        throw conflict("لا يمكن استخدام هوية مالك النظام لتوفير حساب معقب.");
      }
      const existingUser = (
        await tx
          .select()
          .from(users)
          .where(eq(users.openId, openId))
          .limit(1)
          .for("update")
      )[0];

      if (
        existingUser &&
        (existingUser.openId !== openId ||
          existingUser.openId === ENV.ownerOpenId ||
          (existingUser.loginMethod !== "phone_otp" &&
            existingUser.loginMethod !== "whatsapp_otp") ||
          (existingUser.role !== "user" && existingUser.role !== "agent"))
      ) {
        throw conflict("هوية الجوال الحالية لا يمكن تحويلها إلى حساب معقب.");
      }

      // Lock all unique staff identities that may conflict. This is deliberately
      // separate from users.email: OAuth users sharing an email are never matched
      // or promoted by this workflow.
      const staffIdentityConflict = (
        await tx
          .select({ id: staffAccounts.id, userId: staffAccounts.userId })
          .from(staffAccounts)
          .where(
            or(
              eq(staffAccounts.phone, application.phone),
              eq(staffAccounts.email, application.email),
              existingUser
                ? eq(staffAccounts.userId, existingUser.id)
                : undefined
            )
          )
          .limit(1)
          .for("update")
      )[0];
      if (staffIdentityConflict) {
        throw conflict("رقم الجوال أو البريد مرتبط مسبقًا بحساب فريق قائم.");
      }

      let userId: number;
      if (existingUser) {
        userId = existingUser.id;
        if (existingUser.role === "user") {
          await tx
            .update(users)
            .set({ role: "agent" })
            .where(eq(users.id, userId));
        }
      } else {
        const createdUser = await tx.insert(users).values({
          openId,
          name: application.fullName,
          email: application.email,
          loginMethod: "phone_otp",
          role: "agent",
        });
        userId = Number(createdUser[0].insertId);
      }

      const createdStaff = await tx.insert(staffAccounts).values({
        userId,
        fullName: application.fullName,
        email: application.email,
        phone: application.phone,
        role: "agent",
        permissionsJson: JSON.stringify(input.permissions),
        isActive: true,
        createdByUserId: input.actorUserId,
      });
      const staffAccountId = Number(createdStaff[0].insertId);
      await tx
        .update(agentApplications)
        .set({
          status: "approved",
          reviewedAt,
          reviewedByUserId: input.actorUserId,
          reviewNote: input.reviewNote,
          activatedStaffAccountId: staffAccountId,
        })
        .where(
          and(
            eq(agentApplications.id, application.id),
            eq(agentApplications.status, "pending")
          )
        );
      await tx.insert(auditLogs).values({
        actorUserId: input.actorUserId,
        actorRole: "admin",
        actorName: null,
        requestId: null,
        action: "agent_application_approved",
        summary: "تمت الموافقة على طلب انضمام معقب وتوفير حسابه.",
        beforeJson: JSON.stringify({
          applicationId: application.id,
          status: "pending",
        }),
        afterJson: JSON.stringify({
          applicationId: application.id,
          status: "approved",
          staffAccountId,
        }),
      });
      return (
        await tx
          .select()
          .from(agentApplications)
          .where(eq(agentApplications.id, application.id))
          .limit(1)
      )[0]!;
    });
  } catch (error) {
    if (isDuplicateError(error)) {
      throw conflict("تعذر توفير الحساب بسبب تعارض في رقم الجوال أو البريد.");
    }
    throw error;
  }
}
