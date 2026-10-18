#!/usr/bin/env node
/**
 * Guards the JavaScript shipped to a browser.
 *
 * Next 16's Turbopack build emits neither an app-route client manifest nor size
 * columns in its output, so per-route first-load JS is not measurable from the
 * build artefacts today. What IS measurable -- and is the number every single
 * page pays -- is the shared root bundle, plus the total of all client chunks.
 *
 * Runs after `build`, necessarily. A missing or empty build is a FAILURE, not a
 * skip: a budget check that passes because it measured nothing is how a 2 MB
 * bundle ships behind a green gate.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const NEXT = path.join(process.cwd(), ".next");
const MANIFEST = path.join(NEXT, "build-manifest.json");

if (!existsSync(MANIFEST)) {
  console.error("check:budget FAILED — no build output. Run `pnpm build` first.");
  process.exit(1);
}

/*
 * Gzipped kilobytes -- what a phone on a slow connection actually downloads.
 * Raise a number here only with a comment saying what changed and why.
 */

/** Shared by every page. React and the Next runtime. */
const SHARED_BUDGET_KB = 200;
/** All client chunks together. A ceiling on total surface, not a per-page cost. */
const TOTAL_CHUNKS_BUDGET_KB = 1200;

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));

function gzipSize(file) {
  try {
    return gzipSync(readFileSync(file)).length;
  } catch {
    return 0;
  }
}

const shared = [...(manifest.rootMainFiles ?? []), ...(manifest.polyfillFiles ?? [])];
const sharedBytes = shared.reduce((n, asset) => n + gzipSize(path.join(NEXT, asset)), 0);
const sharedKb = Math.round(sharedBytes / 1024);

function walk(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += walk(full);
    else if (entry.name.endsWith(".js")) total += gzipSize(full);
  }
  return total;
}

const chunksDir = path.join(NEXT, "static", "chunks");
const totalKb = existsSync(chunksDir) ? Math.round(walk(chunksDir) / 1024) : 0;

// If the manifest's shape changes, both sums read as zero and every budget
// "passes". Zero bytes of JavaScript is not a plausible measurement.
if (sharedBytes === 0 || totalKb === 0) {
  console.error(
    `check:budget FAILED — measured ${sharedBytes} shared bytes and ${totalKb} KB of chunks.\n` +
      "The build manifest no longer has the shape this script reads; fix the script, do not skip it.",
  );
  process.exit(1);
}

const rows = [
  ["shared root bundle (every page pays this)", sharedKb, SHARED_BUDGET_KB],
  ["all client chunks", totalKb, TOTAL_CHUNKS_BUDGET_KB],
];

let failed = 0;
for (const [label, kb, limit] of rows) {
  const over = kb > limit;
  if (over) failed++;
  console.log(`  ${over ? "OVER" : "ok  "}  ${String(kb).padStart(5)} KB / ${limit} KB gzipped  ${label}`);
}

if (failed > 0) {
  console.error(`\ncheck:budget FAILED — ${failed} budget(s) exceeded`);
  process.exit(1);
}
console.log("check:budget ok — within limits");
