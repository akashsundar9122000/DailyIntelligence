#!/usr/bin/env node
/**
 * No placeholder text reaches a built page.
 *
 * Scans the PRERENDERED OUTPUT, not the source. A TODO in a comment is a note
 * to a developer; a TODO in the rendered HTML is a promise broken in front of a
 * reader, and those are different problems with different severities.
 *
 * Runs after `build`, necessarily.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.env.BUILD_HTML_DIR ?? ".next/server/app";
const PATTERNS = [
  [/\bTODO\b/, "TODO"],
  [/\bFIXME\b/, "FIXME"],
  [/\bLorem ipsum\b/i, "placeholder copy"],
  [/\bTBD\b/, "TBD"],
  [/\bXXX\b/, "XXX"],
  [/\[placeholder\]/i, "placeholder marker"],
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(html|rsc|body)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
if (files.length === 0) {
  console.error(`check:no-todo FAILED — no prerendered output under ${ROOT}.`);
  console.error("Run the build first; this check reads what was rendered, not the source.");
  process.exit(1);
}

const findings = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const [re, label] of PATTERNS) {
    if (re.test(text)) findings.push(`${file}  ${label}`);
  }
}

if (findings.length) {
  console.error("check:no-todo FAILED — placeholder text in rendered output:\n");
  for (const f of findings) console.error("  " + f);
  console.error("\nWrite the real copy, or remove the section until there is some.");
  process.exit(1);
}

console.log(`check:no-todo ok — ${files.length} rendered files clean`);
