#!/usr/bin/env node
/**
 * The mobile layout invariants, enforced the way colour is.
 *
 * A sibling of check-tokens.mjs rather than another rule inside it: that
 * script's docblock, its allowlist and its failure message are entirely about
 * colour, and a mixed one would print the wrong advice for half its findings.
 *
 * Each rule below is load-bearing, not a style preference:
 *
 *   1. A raw env() at a call site is INVISIBLE TO CI. env() is resolved by the
 *      browser from real hardware and is always 0 in a headless run, so an
 *      inset layout cannot be asserted against at all unless every inset goes
 *      through the four --safe-* variables, which a test can override.
 *
 *   2. vh is the LARGE viewport — the height with the address bar collapsed —
 *      so a 100vh element is taller than the screen whenever the bar is
 *      showing, which is most of the time on a phone.
 *
 *   3. A fixed element that hard-codes its distance from the bottom edge is
 *      correct on exactly one device. --bottom-nav-h is the tab bar's height
 *      including its home-indicator padding, and it is 0px from lg, so it is
 *      correct at every width with no breakpoint variant.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SCAN = ["src/components", "src/app", "src/lib"];
const ALLOW = [
  /^src\/styles\//, // where the tokens are defined
  /globals\.css$/, // the token entry point
];

const RULES = [
  {
    test: /env\(\s*safe-area-inset-/,
    name: "raw env() inset",
    advice: "use var(--safe-top|right|bottom|left) — a raw env() is invisible to the layout test",
  },
  {
    test: /\b(?:100vh|h-screen|min-h-screen|max-h-screen)\b/,
    name: "large-viewport height",
    advice: "use dvh (h-dvh / min-h-dvh) — vh measures the viewport with the address bar collapsed",
  },
  {
    // A literal length in a bottom-* utility. var(...) and 0 are fine.
    test: /\bbottom-\[(?!var\()[^\]]*(?:rem|px)\]/,
    name: "hard-coded bottom offset",
    advice: "use bottom-[var(--bottom-nav-h)] — it is 0px from lg and needs no breakpoint variant",
  },
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
    else if (/\.(tsx?|css|mts)$/.test(e.name)) out.push(p);
  }
  return out;
}

const findings = [];
let scanned = 0;
for (const root of SCAN) {
  for (const file of walk(root)) {
    if (ALLOW.some((re) => re.test(file))) continue;
    scanned++;
    const text = readFileSync(file, "utf8");

    /*
     * A mention inside a comment is documentation, not a style, and every one
     * of these rules is explained in a comment somewhere near its own fix — so
     * without this the file that documents a rule is the file that fails it.
     *
     * Block comments are blanked across the WHOLE file before splitting, with
     * their line breaks preserved so the reported line numbers stay true. A
     * line-by-line strip sees the middle line of a multi-line comment as bare
     * code.
     */
    const blanked = text
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/^[^\n]*\/\/.*$/gm, (m) => m.replace(/\/\/.*$/, ""));

    blanked.split("\n").forEach((code, i) => {
      for (const rule of RULES) {
        if (rule.test.test(code)) {
          findings.push({ where: `${file}:${i + 1}`, rule, snippet: code.trim().slice(0, 80) });
          break;
        }
      }
    });
  }
}

if (findings.length) {
  console.error("check:layout FAILED — mobile layout invariants broken:\n");
  for (const f of findings) {
    console.error(`  ${f.where}  ${f.rule.name}`);
    console.error(`    ${f.snippet}`);
    console.error(`    → ${f.rule.advice}\n`);
  }
  process.exit(1);
}

if (scanned === 0) {
  console.error("check:layout FAILED — no source files found under src/. A scan of nothing proves nothing.");
  process.exit(1);
}

console.log(`check:layout ok — ${scanned} files: insets named, heights dynamic, bottom offsets tokenised`);
