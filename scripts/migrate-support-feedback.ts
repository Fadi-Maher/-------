import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

// The shared database's historical ledger predates existing tables. Apply only this
// additive migration; never replay old migrations or rewrite their ledger here.
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required.");
const migration = await readFile(
  new URL("../drizzle/0026_smart_sandman.sql", import.meta.url),
  "utf8"
);
const statements = migration
  .split("--> statement-breakpoint")
  .map(s => s.trim())
  .filter(Boolean);
const prefixes = [
  "CREATE TABLE `order_support_feedback`",
  "ALTER TABLE `order_support_feedback` ADD CONSTRAINT `order_support_feedback_sessionId_order_support_sessions_id_fk`",
  "CREATE INDEX `order_support_feedback_created` ON `order_support_feedback`",
];
if (
  statements.length !== prefixes.length ||
  statements.some((s, i) => !s.startsWith(prefixes[i]))
)
  throw new Error("Unexpected migration; refusing to apply.");
const connection = await mysql.createConnection(url);
try {
  const [tables] = await connection.query<mysql.RowDataPacket[]>(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_support_feedback'"
  );
  if (!tables.length) {
    await connection.query(statements[0]);
    console.log("Created feedback table.");
  } else {
    const [columns] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_support_feedback'"
    );
    for (const name of [
      "id",
      "sessionId",
      "stars",
      "comment",
      "language",
      "consentVersion",
      "createdAt",
    ])
      if (!columns.some(c => c.COLUMN_NAME === name))
        throw new Error(
          `Existing feedback table is missing ${name}; manual review required.`
        );
    console.log("Feedback table already exists; preserving its rows.");
  }
  const [constraints] = await connection.query<mysql.RowDataPacket[]>(
    "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_support_feedback'"
  );
  if (
    !constraints.some(
      c =>
        c.CONSTRAINT_NAME ===
        "order_support_feedback_sessionId_order_support_sessions_id_fk"
    )
  )
    await connection.query(statements[1]);
  const [indexes] = await connection.query<mysql.RowDataPacket[]>(
    "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_support_feedback'"
  );
  if (!indexes.some(i => i.INDEX_NAME === "order_support_feedback_created"))
    await connection.query(statements[2]);
  if (!indexes.some(i => i.INDEX_NAME === "order_support_feedback_one_session"))
    throw new Error("Unique feedback-per-session constraint is missing.");
  console.log(
    "Support feedback migration verified; no existing request data changed."
  );
} finally {
  await connection.end();
}
