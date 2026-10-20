import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import {
  adminApplicationNotifications,
  users,
} from "../drizzle/schema";
import { getDb } from "./db";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type ApplicationNotificationTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

export type AdminApplicationNotification = {
  id: number;
  applicationId: number;
  reference: string;
  createdAt: number;
  readAt: number | null;
};

export type AdminApplicationNotificationList = {
  items: AdminApplicationNotification[];
  unreadCount: number;
};

const HEARTBEAT_INTERVAL_MS = 20_000;
const notificationWaiters = new Set<() => void>();

/**
 * Creates one durable notification per current admin. Call this only inside the
 * transaction that created a *new* application. The unique key makes retries
 * harmless and deliberately preserves an existing read state.
 */
export async function createApplicationNotifications(
  tx: ApplicationNotificationTransaction,
  applicationId: number,
  now: number,
): Promise<void> {
  const admins = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .orderBy(users.id)
    .for("update");

  if (admins.length === 0) return;

  await tx
    .insert(adminApplicationNotifications)
    .values(
      admins.map(admin => ({
        recipientUserId: admin.id,
        applicationId,
        createdAt: now,
      })),
    )
    .onDuplicateKeyUpdate({
      // A no-op keeps retries idempotent without turning a read notification
      // back into an unread one.
      set: {
        recipientUserId: sql`${adminApplicationNotifications.recipientUserId}`,
      },
    });
}

export async function listAdminApplicationNotifications(
  recipientUserId: number,
): Promise<AdminApplicationNotificationList> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const [rows, unreadRows] = await Promise.all([
    db
      .select({
        id: adminApplicationNotifications.id,
        applicationId: adminApplicationNotifications.applicationId,
        createdAt: adminApplicationNotifications.createdAt,
        readAt: adminApplicationNotifications.readAt,
      })
      .from(adminApplicationNotifications)
      .where(eq(adminApplicationNotifications.recipientUserId, recipientUserId))
      .orderBy(
        desc(adminApplicationNotifications.createdAt),
        desc(adminApplicationNotifications.id),
      )
      .limit(50),
    db
      .select({ unreadCount: count() })
      .from(adminApplicationNotifications)
      .where(
        and(
          eq(adminApplicationNotifications.recipientUserId, recipientUserId),
          isNull(adminApplicationNotifications.readAt),
        ),
      ),
  ]);

  return {
    items: rows.map(row => ({
      id: row.id,
      applicationId: row.applicationId,
      reference: `JOIN-${row.applicationId}`,
      createdAt: Number(row.createdAt),
      readAt: row.readAt === null ? null : Number(row.readAt),
    })),
    unreadCount: Number(unreadRows[0]?.unreadCount ?? 0),
  };
}

export async function markAdminApplicationNotificationRead(
  notificationId: number,
  recipientUserId: number,
  now = Date.now(),
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db
    .update(adminApplicationNotifications)
    .set({ readAt: now })
    .where(
      and(
        eq(adminApplicationNotifications.id, notificationId),
        eq(adminApplicationNotifications.recipientUserId, recipientUserId),
        isNull(adminApplicationNotifications.readAt),
      ),
    );
}

export async function markAllAdminApplicationNotificationsRead(
  recipientUserId: number,
  now = Date.now(),
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db
    .update(adminApplicationNotifications)
    .set({ readAt: now })
    .where(
      and(
        eq(adminApplicationNotifications.recipientUserId, recipientUserId),
        isNull(adminApplicationNotifications.readAt),
      ),
    );
}

/**
 * Broadcasts a non-sensitive invalidation signal after the enclosing submit
 * transaction commits. Notification content remains durable in MySQL; this
 * process-local signal only lets live admin tabs refresh promptly.
 */
export function publishApplicationNotification(): void {
  Array.from(notificationWaiters).forEach(wake => wake());
}

export type ApplicationNotificationSignal =
  | { type: "application_created" }
  | { type: "keepalive" };

function waitForApplicationNotification(
  signal: AbortSignal,
): Promise<"published" | "heartbeat" | "aborted"> {
  return new Promise(resolve => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const finish = (result: "published" | "heartbeat" | "aborted") => {
      if (settled) return;
      settled = true;
      notificationWaiters.delete(onPublished);
      signal.removeEventListener("abort", onAbort);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      resolve(result);
    };
    const onPublished = () => finish("published");
    const onAbort = () => finish("aborted");

    if (signal.aborted) {
      onAbort();
      return;
    }

    notificationWaiters.add(onPublished);
    signal.addEventListener("abort", onAbort, { once: true });
    timeoutId = setTimeout(() => finish("heartbeat"), HEARTBEAT_INTERVAL_MS);
  });
}

/**
 * An async iterable for tRPC SSE. It emits no application or user data: only
 * invalidation signals and a 20-second keepalive for proxy-friendly streams.
 */
export async function* subscribeToApplicationNotificationSignals(
  signal?: AbortSignal,
): AsyncGenerator<ApplicationNotificationSignal> {
  // tRPC supplies this signal for HTTP subscriptions. The fallback only keeps
  // direct unit callers well-defined; production streams always receive one.
  const activeSignal = signal ?? new AbortController().signal;

  while (!activeSignal.aborted) {
    const result = await waitForApplicationNotification(activeSignal);
    if (result === "aborted") return;
    yield result === "published"
      ? { type: "application_created" }
      : { type: "keepalive" };
  }
}
