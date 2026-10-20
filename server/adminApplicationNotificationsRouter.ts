import { z } from "zod";
import {
  listAdminApplicationNotifications,
  markAdminApplicationNotificationRead,
  markAllAdminApplicationNotificationsRead,
  subscribeToApplicationNotificationSignals,
} from "./adminApplicationNotifications";
import { adminProcedure, router } from "./_core/trpc";

export const adminApplicationNotificationsRouter = router({
  list: adminProcedure.query(({ ctx }) =>
    listAdminApplicationNotifications(ctx.user.id),
  ),

  markRead: adminProcedure
    .input(z.object({ notificationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await markAdminApplicationNotificationRead(
        input.notificationId,
        ctx.user.id,
      );
      return { success: true } as const;
    }),

  markAllRead: adminProcedure.mutation(async ({ ctx }) => {
    await markAllAdminApplicationNotificationsRead(ctx.user.id);
    return { success: true } as const;
  }),

  /** Contains only non-PII invalidation signals for the admin notification UI. */
  onNew: adminProcedure.subscription(({ signal }) =>
    subscribeToApplicationNotificationSignals(signal),
  ),
});
