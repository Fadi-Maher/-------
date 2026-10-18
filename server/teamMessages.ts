import { and, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { requestUpdates, transactionRequests } from "../drizzle/schema";
import { getDb } from "./db";

export async function listTeamPrivateMessages(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select({
    id: requestUpdates.id,
    requestId: requestUpdates.requestId,
    message: requestUpdates.message,
    senderType: requestUpdates.senderType,
    senderName: requestUpdates.senderName,
    createdAt: requestUpdates.createdAt,
    category: transactionRequests.category,
    requestStatus: transactionRequests.status,
  }).from(requestUpdates)
    .innerJoin(transactionRequests, eq(requestUpdates.requestId, transactionRequests.id))
    .where(and(
      eq(transactionRequests.assigneeId, userId),
      isNotNull(transactionRequests.providerAcceptedAt),
      or(eq(requestUpdates.senderType, "customer"), and(inArray(requestUpdates.senderType, ["agent", "employee"]), eq(requestUpdates.senderUserId, userId))),
    ))
    .orderBy(desc(requestUpdates.createdAt), desc(requestUpdates.id)).limit(200);
}
