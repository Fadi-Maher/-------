/**
 * Adds the basic knowledge answers (server/leadBot/knowledgeSeed.ts) to the
 * "assistant knowledge" table. Idempotent: an entry whose Arabic question
 * already exists is left untouched, so owner edits are never overwritten.
 *
 *   npx tsx scripts/seed-assistant-faqs.ts --dry-run   # report only
 *   npx tsx scripts/seed-assistant-faqs.ts             # insert missing entries
 */
import { BASIC_KNOWLEDGE } from "../server/leadBot/knowledgeSeed";
import { createAssistantFaq, getUserByOpenId, listAssistantFaqs } from "../server/db";
import { ENV } from "../server/_core/env";

const dryRun = process.argv.includes("--dry-run");

function key(question: string) {
  return question.replace(/[\s؟?.!،,ـ]/g, "").replace(/[ّ]/g, "");
}

async function main() {
  const owner = ENV.ownerOpenId ? await getUserByOpenId(ENV.ownerOpenId) : undefined;
  if (!owner) throw new Error("Owner account not found; sign in once as the owner first.");
  const existing = await listAssistantFaqs(true);
  const known = new Set(existing.map((row) => key(row.questionAr)));
  const missing = BASIC_KNOWLEDGE.filter((entry) => !known.has(key(entry.questionAr)));
  console.log(`existing=${existing.length} seed=${BASIC_KNOWLEDGE.length} missing=${missing.length} dryRun=${dryRun}`);
  if (dryRun) {
    for (const entry of missing) console.log(`  + ${entry.sortOrder} ${entry.questionAr}`);
    return;
  }
  const createdIds: number[] = [];
  for (const entry of missing) {
    const row = await createAssistantFaq({ ...entry, isActive: true }, owner.id);
    createdIds.push(row.id);
  }
  const after = await listAssistantFaqs(true);
  console.log(`inserted=${createdIds.length} ids=${createdIds.join(",")} total=${after.length} active=${after.filter((row) => row.isActive).length}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
