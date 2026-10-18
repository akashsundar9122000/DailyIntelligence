/*
 * Rewrites drizzle/migrations/meta/_journal.json so `when` strictly increases.
 *
 * Drizzle silently SKIPS any migration whose timestamp is less than or equal to
 * the last one it applied. Hand-written SQL migrations get their timestamp from
 * whenever you happened to create the file, so one file numbered out of order
 * poisons everything generated after it — with no error, and no applied change.
 *
 * Chained into `pnpm db:generate` so it is never a step someone forgets.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const journalPath = path.join(
  import.meta.dirname,
  "..",
  "..",
  "drizzle",
  "migrations",
  "meta",
  "_journal.json",
);

if (!existsSync(journalPath)) {
  console.log("journal: nothing to normalise yet");
  process.exit(0);
}

const journal = JSON.parse(readFileSync(journalPath, "utf8"));
let previous = 0;
let changed = 0;

for (const entry of journal.entries) {
  if (entry.when <= previous) {
    entry.when = previous + 1;
    changed++;
  }
  previous = entry.when;
}

if (changed > 0) {
  writeFileSync(journalPath, JSON.stringify(journal, null, 2) + "\n");
  console.log(`journal: normalised ${changed} out-of-order timestamp(s)`);
} else {
  console.log(`journal: ${journal.entries.length} entries already in order`);
}
