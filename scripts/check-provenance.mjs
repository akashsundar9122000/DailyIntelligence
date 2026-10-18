#!/usr/bin/env node
/**
 * No fabricated news, enforced.
 *
 * The product's central promise is that every story on screen came from a
 * rights-checked source, with its link and its times -- or is in the demo
 * edition, badged "Sample" under a banner saying it is not live news. Each
 * rule here closes one way that promise gets broken without anybody deciding
 * to break it:
 *
 *   1. Math.random() anywhere under src/. A "live-looking" feed is one
 *      setInterval and one random pick away, and indistinguishable on screen
 *      from a real one. Ids are uuidv7; nothing here needs chance.
 *
 *   2. Sample, fixture, mock and demo data files live only under
 *      src/lib/demo/. Anywhere else, a file of made-up stories is one import
 *      away from being rendered as though it were real.
 *
 *   3. src/lib/demo/ is imported only by its own provider
 *      (src/lib/demo/provider.ts) -- the one module that decides, from
 *      DEMO_MODE, whether the sample edition may be shown, and wraps every
 *      sample story in the Sample label.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = "src";
const DEMO_DIR = "src/lib/demo/";
const DEMO_GATE = "src/lib/demo/provider.ts";

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
    else if (/\.(tsx?|mts|json)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Blank comments, keeping line breaks so reported line numbers stay true. */
function withoutComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/^[^\n]*\/\/.*$/gm, (m) => m.replace(/\/\/.*$/, ""));
}

const files = walk(SRC);
const findings = [];

for (const file of files) {
  const name = file.split("/").pop() ?? "";
  if (/(sample|fixture|mock|demo)/i.test(name) && !file.startsWith(DEMO_DIR)) {
    findings.push(`${file}  sample data outside ${DEMO_DIR}`);
  }
  if (file.endsWith(".json")) continue;

  withoutComments(readFileSync(file, "utf8"))
    .split("\n")
    .forEach((line, i) => {
      if (/\bMath\.random\s*\(/.test(line)) {
        findings.push(`${file}:${i + 1}  Math.random() -- a generated value must never stand in for news`);
      }
      const imported = line.match(/from\s+["'](@\/lib\/demo\/[^"']+|\.{1,2}\/[^"']*demo[^"']*)["']/);
      if (imported && !file.startsWith(DEMO_DIR) && imported[1] !== "@/lib/demo/provider") {
        findings.push(`${file}:${i + 1}  imports ${imported[1]} -- only ${DEMO_GATE} may read the sample edition`);
      }
    });
}

if (findings.length) {
  console.error("check:provenance FAILED -- a path to fabricated news:\n");
  for (const f of findings) console.error("  " + f);
  console.error(
    "\nKeep sample stories under src/lib/demo/ and read them only through src/lib/demo/provider.ts,\n" +
      "which labels each one Sample. Never generate a headline, a count or a time.",
  );
  process.exit(1);
}

if (files.length === 0) {
  console.error("check:provenance FAILED -- no source files found under src/. A scan of nothing proves nothing.");
  process.exit(1);
}

console.log(`check:provenance ok -- ${files.length} files free of generated values and stray sample data`);
