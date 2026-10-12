import { and, desc, eq, isNotNull } from "drizzle-orm";
import { requestQuotes, transactionRequests } from "../drizzle/schema";
import { summarizeEstimatedReceivables } from "../shared/estimatedReceivables";
import { getDb } from "./db";

export async function listEstimatedReceivables(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  // Unique (requestId, providerUserId) means a request can contribute only once.
  const rows = await db
    .select({
      requestId: transactionRequests.id,
      reference: transactionRequests.reference,
      category: transactionRequests.category,
      subcategory: transactionRequests.subcategory,
      priceAmount: requestQuotes.priceAmount,
    })
    .from(transactionRequests)
    .leftJoin(
      requestQuotes,
      and(
        eq(requestQuotes.requestId, transactionRequests.id),
        eq(requestQuotes.providerUserId, userId),
        eq(requestQuotes.status, "accepted"),
        isNotNull(transactionRequests.providerAcceptedAt)
      )
    )
    .where(
      and(
        eq(transactionRequests.assigneeId, userId),
        eq(transactionRequests.status, "completed")
      )
    )
    .orderBy(desc(transactionRequests.id));
  return summarizeEstimatedReceivables(rows);
}
