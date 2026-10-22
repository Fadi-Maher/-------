import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required.");
const statements = (
  await readFile(
    new URL("../drizzle/0027_illegal_swordsman.sql", import.meta.url),
    "utf8"
  )
)
  .split("--> statement-breakpoint")
  .map(s => s.trim())
  .filter(Boolean);
const prefixes = [
  "CREATE TABLE `order_support_attachments`",
  "ALTER TABLE `order_support_feedback` ADD `accessKeyHash`",
  "ALTER TABLE `order_support_feedback` ADD `followupNote`",
  "ALTER TABLE `order_support_feedback` ADD `followupCreatedAt`",
  "ALTER TABLE `order_support_attachments` ADD CONSTRAINT `order_support_attachments_sessionId_order_support_sessions_id_fk`",
];
if (
  statements.length !== 5 ||
  statements.some((s, i) => !s.startsWith(prefixes[i]))
)
  throw new Error("Unexpected migration; refusing to apply.");
const db = await mysql.createConnection(url);
try {
  const [tables] = await db.query<mysql.RowDataPacket[]>(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_support_attachments'"
  );
  if (!tables.length) await db.query(statements[0]);
  const [columns] = await db.query<mysql.RowDataPacket[]>(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_support_feedback'"
  );
  for (const [i, name] of [
    "accessKeyHash",
    "followupNote",
    "followupCreatedAt",
  ].entries())
    if (!columns.some(c => c.COLUMN_NAME === name))
      await db.query(statements[i + 1]);
  const [constraints] = await db.query<mysql.RowDataPacket[]>(
    "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_support_attachments'"
  );
  if (
    !constraints.some(
      c =>
        c.CONSTRAINT_NAME ===
        "order_support_attachments_sessionId_order_support_sessions_id_fk"
    )
  )
    await db.query(statements[4]);
  if (
    !constraints.some(
      c => c.CONSTRAINT_NAME === "order_support_attachment_session"
    )
  )
    throw new Error("Unique attachment-per-session constraint is missing.");
  console.log(
    "Support sharing migration applied and verified; historical ledger and request data unchanged."
  );
} finally {
  await db.end();
}
