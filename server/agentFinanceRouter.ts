import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  amountToHalalas,
  halalasToAmount,
  normalizeMoneyInput,
} from "../shared/finance";
import { agentProcedure, router } from "./_core/trpc";
import { getActiveStaffAccountForUser } from "./db";
import {
  addAgentFinanceEntry,
  getAgentFinance,
  listCompletedAgentRequests,
  voidAgentFinanceEntry,
} from "./agentFinanceDb";

const financeProcedure = agentProcedure.use(async ({ ctx, next }) => {
  const staff = await getActiveStaffAccountForUser(ctx.user.id);
  if (!staff || staff.role !== "agent" || !staff.permissions.canViewAssigned)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "لا تملك صلاحية الوصول إلى حساب المعقب المالي.",
    });
  return next({ ctx });
});

export const financeEntryInput = z.object({
  requestId: z.number().int().positive(),
  kind: z.enum(["collection", "cost"]),
  amount: z
    .string()
    .max(40)
    .transform(normalizeMoneyInput)
    .refine(
      value => /^\d{1,8}(?:\.\d{1,2})?$/.test(value),
      "أدخل مبلغًا صحيحًا بخانتين عشريتين كحد أقصى."
    )
    .refine(
      value =>
        /^\d{1,8}(?:\.\d{1,2})?$/.test(value) &&
        amountToHalalas(value) > BigInt(0),
      "المبلغ يجب أن يكون أكبر من صفر."
    )
    .transform(value => halalasToAmount(amountToHalalas(value))),
  occurredAt: z
    .number()
    .int()
    .min(Date.UTC(2000, 0, 1))
    .refine(
      value => Number.isSafeInteger(value) && value <= Date.now(),
      "لا يمكن تسجيل تاريخ مستقبلي."
    ),
  note: z.string().trim().max(500).optional(),
  clientKey: z.string().uuid(),
});

export const agentFinanceRouter = router({
  completed: financeProcedure.query(({ ctx }) =>
    listCompletedAgentRequests(ctx.user.id)
  ),
  mine: financeProcedure.query(({ ctx }) => getAgentFinance(ctx.user.id)),
  addEntry: financeProcedure
    .input(financeEntryInput)
    .mutation(({ ctx, input }) =>
      addAgentFinanceEntry(ctx.user.id, ctx.user.name, input)
    ),
  voidEntry: financeProcedure
    .input(
      z.object({
        entryId: z.number().int().positive(),
        reason: z.string().trim().min(3).max(500),
      })
    )
    .mutation(({ ctx, input }) =>
      voidAgentFinanceEntry(
        ctx.user.id,
        ctx.user.name,
        input.entryId,
        input.reason
      )
    ),
});
