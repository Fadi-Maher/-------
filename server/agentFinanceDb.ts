import { and, desc, eq, isNotNull, isNull, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  agentFinanceEntries,
  auditLogs,
  requestQuotes,
  transactionRequests,
  type AgentFinanceEntry,
} from "../drizzle/schema";
import {
  amountToHalalas,
  halalasToAmount,
  summarizeFinanceEntries,
} from "../shared/finance";
import { getDb } from "./db";

export async function listCompletedAgentRequests(agentUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db
    .select({
      requestId: transactionRequests.id,
      reference: transactionRequests.reference,
      category: transactionRequests.category,
      subcategory: transactionRequests.subcategory,
      priceAmount: requestQuotes.priceAmount,
      updatedAt: transactionRequests.updatedAt,
    })
    .from(transactionRequests)
    .leftJoin(
      requestQuotes,
      and(
        eq(requestQuotes.requestId, transactionRequests.id),
        eq(requestQuotes.providerUserId, agentUserId),
        eq(requestQuotes.status, "accepted"),
        isNotNull(transactionRequests.providerAcceptedAt)
      )
    )
    .where(
      and(
        eq(transactionRequests.assigneeId, agentUserId),
        eq(transactionRequests.status, "completed")
      )
    )
    .orderBy(desc(transactionRequests.updatedAt), desc(transactionRequests.id));
  let total = BigInt(0);
  let pricedRequestCount = 0;
  const items = rows.map(row => {
    const priceAmount =
      row.priceAmount && amountToHalalas(row.priceAmount) > BigInt(0)
        ? row.priceAmount
        : null;
    if (priceAmount !== null) {
      total += amountToHalalas(priceAmount);
      pricedRequestCount += 1;
    }
    return { ...row, priceAmount, updatedAt: row.updatedAt.getTime() };
  });
  return {
    totalAmount: halalasToAmount(total),
    completedRequestCount: items.length,
    pricedRequestCount,
    unpricedRequestCount: items.length - pricedRequestCount,
    items,
  };
}

export async function getAgentFinance(agentUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const entries = await db
    .select({
      id: agentFinanceEntries.id,
      requestId: agentFinanceEntries.requestId,
      reference: transactionRequests.reference,
      category: transactionRequests.category,
      kind: agentFinanceEntries.kind,
      amount: agentFinanceEntries.amount,
      note: agentFinanceEntries.note,
      occurredAt: agentFinanceEntries.occurredAt,
      createdAt: agentFinanceEntries.createdAt,
      voidedAt: agentFinanceEntries.voidedAt,
      voidReason: agentFinanceEntries.voidReason,
    })
    .from(agentFinanceEntries)
    .innerJoin(
      transactionRequests,
      eq(transactionRequests.id, agentFinanceEntries.requestId)
    )
    .where(eq(agentFinanceEntries.agentUserId, agentUserId))
    .orderBy(
      desc(agentFinanceEntries.occurredAt),
      desc(agentFinanceEntries.id)
    );
  const requests = await db
    .select({
      requestId: transactionRequests.id,
      reference: transactionRequests.reference,
      category: transactionRequests.category,
      status: transactionRequests.status,
      priceAmount: requestQuotes.priceAmount,
    })
    .from(transactionRequests)
    .leftJoin(
      requestQuotes,
      and(
        eq(requestQuotes.requestId, transactionRequests.id),
        eq(requestQuotes.providerUserId, agentUserId),
        eq(requestQuotes.status, "accepted"),
        isNotNull(transactionRequests.providerAcceptedAt)
      )
    )
    .where(
      and(
        eq(transactionRequests.assigneeId, agentUserId),
        or(
          isNull(transactionRequests.quoteSelectedAt),
          isNotNull(transactionRequests.providerAcceptedAt)
        )
      )
    )
    .orderBy(desc(transactionRequests.id));
  // Historical entries stay owned by the recording agent even after reassignment.
  return { ...summarizeFinanceEntries(entries), entries, requests };
}

export type FinanceEntryInput = {
  requestId: number;
  kind: "collection" | "cost";
  amount: string;
  occurredAt: number;
  note?: string;
  clientKey: string;
};
function sameEntry(row: AgentFinanceEntry, input: FinanceEntryInput) {
  return (
    row.requestId === input.requestId &&
    row.kind === input.kind &&
    row.amount === input.amount &&
    row.occurredAt === input.occurredAt &&
    row.note === (input.note || null)
  );
}
function duplicateResult(row: AgentFinanceEntry, input: FinanceEntryInput) {
  if (!sameEntry(row, input))
    throw new TRPCError({
      code: "CONFLICT",
      message: "مفتاح الحفظ مستخدم لقيد مختلف. حدّث النموذج وأعد المحاولة.",
    });
  return { id: row.id, duplicate: true };
}
function isDuplicateError(error: unknown): boolean {
  const value = error as { code?: string; errno?: number; cause?: unknown };
  return (
    value?.code === "ER_DUP_ENTRY" ||
    value?.errno === 1062 ||
    Boolean(value?.cause && isDuplicateError(value.cause))
  );
}

export async function addAgentFinanceEntry(
  agentUserId: number,
  actorName: string | null | undefined,
  rawInput: FinanceEntryInput
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const input = {
    ...rawInput,
    amount: halalasToAmount(amountToHalalas(rawInput.amount)),
    note: rawInput.note?.trim() || undefined,
  };
  // Repeat the critical validation at the data boundary as well as in tRPC.
  if (
    amountToHalalas(input.amount) <= BigInt(0) ||
    amountToHalalas(input.amount) > BigInt("9999999999") ||
    !Number.isSafeInteger(input.occurredAt) ||
    input.occurredAt < Date.UTC(2000, 0, 1) ||
    input.occurredAt > Date.now()
  )
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "المبلغ أو تاريخ القيد غير صالح.",
    });
  try {
    return await db.transaction(async tx => {
      const existing = (
        await tx
          .select()
          .from(agentFinanceEntries)
          .where(
            and(
              eq(agentFinanceEntries.agentUserId, agentUserId),
              eq(agentFinanceEntries.clientKey, input.clientKey)
            )
          )
          .limit(1)
      )[0];
      if (existing) return duplicateResult(existing, input);
      const request = (
        await tx
          .select()
          .from(transactionRequests)
          .where(eq(transactionRequests.id, input.requestId))
          .limit(1)
          .for("update")
      )[0];
      if (
        !request ||
        request.assigneeId !== agentUserId ||
        (request.quoteSelectedAt && !request.providerAcceptedAt)
      )
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "لا يمكنك تسجيل مبلغ إلا لطلب مسند ومعتمد لك.",
        });
      const inserted = await tx
        .insert(agentFinanceEntries)
        .values({ ...input, agentUserId, createdAt: Date.now() });
      const id = Number(inserted[0].insertId);
      await tx
        .insert(auditLogs)
        .values({
          actorUserId: agentUserId,
          actorRole: "agent",
          actorName,
          requestId: input.requestId,
          action: "agent_finance_entry_created",
          summary:
            input.kind === "collection"
              ? "سجل المعقب مبلغًا محصلًا في دفتره الخاص."
              : "سجل المعقب تكلفة في دفتره الخاص.",
          afterJson: JSON.stringify({
            id,
            kind: input.kind,
            amount: input.amount,
            occurredAt: input.occurredAt,
            note: input.note || null,
          }),
        });
      return { id, duplicate: false };
    });
  } catch (error) {
    if (!isDuplicateError(error)) throw error;
    const existing = (
      await db
        .select()
        .from(agentFinanceEntries)
        .where(
          and(
            eq(agentFinanceEntries.agentUserId, agentUserId),
            eq(agentFinanceEntries.clientKey, input.clientKey)
          )
        )
        .limit(1)
    )[0];
    if (!existing) throw error;
    return duplicateResult(existing, input);
  }
}

export async function voidAgentFinanceEntry(
  agentUserId: number,
  actorName: string | null | undefined,
  entryId: number,
  reason: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const voidReason = reason.trim();
  if (voidReason.length < 3 || voidReason.length > 500)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "اكتب سببًا صالحًا لإلغاء القيد.",
    });
  return db.transaction(async tx => {
    const entry = (
      await tx
        .select()
        .from(agentFinanceEntries)
        .where(
          and(
            eq(agentFinanceEntries.id, entryId),
            eq(agentFinanceEntries.agentUserId, agentUserId)
          )
        )
        .limit(1)
        .for("update")
    )[0];
    if (!entry)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "القيد غير متاح لحسابك.",
      });
    if (entry.voidedAt !== null) return { success: true, alreadyVoided: true };
    const voidedAt = Date.now();
    await tx
      .update(agentFinanceEntries)
      .set({ voidedAt, voidReason })
      .where(eq(agentFinanceEntries.id, entryId));
    await tx
      .insert(auditLogs)
      .values({
        actorUserId: agentUserId,
        actorRole: "agent",
        actorName,
        requestId: entry.requestId,
        action: "agent_finance_entry_voided",
        summary: "ألغى المعقب قيدًا ماليًا مع حفظ أصل القيد وسبب الإلغاء.",
        beforeJson: JSON.stringify({
          id: entry.id,
          kind: entry.kind,
          amount: entry.amount,
        }),
        afterJson: JSON.stringify({ voidedAt, voidReason }),
      });
    return { success: true, alreadyVoided: false };
  });
}
