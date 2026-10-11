import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

const requireRole = (roles: Array<"admin" | "employee" | "agent">, message: string) =>
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (!roles.includes(ctx.user.role as "admin" | "employee" | "agent")) {
      throw new TRPCError({ code: "FORBIDDEN", message });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });

/** Employees may only read requests assigned to their own user id. */
export const employeeProcedure = t.procedure.use(
  requireRole(["employee"], "هذه المساحة مخصصة للموظفين."),
);

/** Mu'aqqibs may work only on requests explicitly assigned to them. */
export const agentProcedure = t.procedure.use(
  requireRole(["agent"], "هذه المساحة مخصصة للمعقبين."),
);

/** Shared staff entry point; business procedures still enforce fine-grained permissions. */
export const teamProcedure = t.procedure.use(
  requireRole(["employee", "agent"], "هذه المساحة مخصصة لفريق التشغيل."),
);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    if (ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
