/**
 * Sales-assistant test-data cleanup (run right before hand-off and again right before publishing).
 * Deletes ALL rows of the new lead-bot content tables and only the two new team-notification types.
 * Keeps lead_bot_settings, audit_logs and every existing table untouched.
 * Usage: npx tsx scripts/leadbot-cleanup.ts [--dry-run]
 */
import { count, inArray } from "drizzle-orm";
import { getDb } from "../server/db";
import {
  assistantFaqs,
  auditLogs,
  leadBotConversations,
  leadBotEvents,
  leadBotLeads,
  leadBotMessages,
  leadBotSettings,
  staffAccounts,
  teamNotifications,
  transactionRequests,
  users,
} from "../drizzle/schema";
import { LEAD_NOTIFICATION_TYPES } from "../server/leadBot/notifications";

const dryRun = process.argv.includes("--dry-run");
const db = await getDb();
if (!db) throw new Error("DATABASE_URL is not configured");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function total(table: any, where?: any) {
  const query = db.select({ value: count() }).from(table);
  const rows = where ? await query.where(where) : await query;
  return Number(rows[0]?.value ?? 0);
}

const leadNotifications = inArray(teamNotifications.type, [...LEAD_NOTIFICATION_TYPES]);
const targets = [
  { name: "lead_bot_events", table: leadBotEvents },
  { name: "lead_bot_messages", table: leadBotMessages },
  { name: "lead_bot_leads", table: leadBotLeads },
  { name: "lead_bot_conversations", table: leadBotConversations },
] as const;
const untouched = [
  { name: "lead_bot_settings", table: leadBotSettings },
  { name: "audit_logs", table: auditLogs },
  { name: "users", table: users },
  { name: "staff_accounts", table: staffAccounts },
  { name: "transaction_requests", table: transactionRequests },
  { name: "assistant_faqs", table: assistantFaqs },
] as const;

const before: Record<string, number> = {};
for (const target of targets) before[target.name] = await total(target.table);
before["team_notifications (lead_handoff_requested, lead_hot)"] = await total(teamNotifications, leadNotifications);
const untouchedBefore: Record<string, number> = {};
for (const item of untouched) untouchedBefore[item.name] = await total(item.table);
untouchedBefore["team_notifications (other types)"] = (await total(teamNotifications)) - before["team_notifications (lead_handoff_requested, lead_hot)"];

if (!dryRun) {
  await db.transaction(async (tx) => {
    for (const target of targets) await tx.delete(target.table);
    await tx.delete(teamNotifications).where(leadNotifications);
  });
}

const report: Array<Record<string, string | number>> = [];
for (const target of targets) report.push({ table: target.name, before: before[target.name], deleted: dryRun ? 0 : before[target.name], remaining: await total(target.table) });
const typeKey = "team_notifications (lead_handoff_requested, lead_hot)";
report.push({ table: typeKey, before: before[typeKey], deleted: dryRun ? 0 : before[typeKey], remaining: await total(teamNotifications, leadNotifications) });
for (const item of untouched) report.push({ table: `${item.name} (kept)`, before: untouchedBefore[item.name], deleted: 0, remaining: await total(item.table) });
const otherKey = "team_notifications (other types)";
report.push({ table: `${otherKey} (kept)`, before: untouchedBefore[otherKey], deleted: 0, remaining: (await total(teamNotifications)) - (await total(teamNotifications, leadNotifications)) });

console.log(dryRun ? "DRY RUN — nothing deleted" : "Cleanup done");
console.table(report);
process.exit(0);
