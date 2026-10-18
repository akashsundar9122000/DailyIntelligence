#!/usr/bin/env node
/**
 * The structural rules, enforced.
 *
 * Each rule exists because the failure it prevents is silent:
 *
 *   1. Every export in src/lib/actions/* must be built by a wrapper. A server
 *      action is its own entrypoint -- it re-runs no layout and passes through
 *      no proxy -- so a bare exported async function is an unguarded mutation
 *      endpoint that looks exactly like a working one.
 *
 *   2. Every file in src/lib/queries/* must `import "server-only"`. Without it,
 *      a query module pulled into a client bundle ships the database code to
 *      the browser, and nothing says so.
 *
 *   3. The product name is written in src/config/brand.ts and nowhere else
 *      under src/. A name typed into forty components cannot be changed
 *      safely, and the one that gets missed ships under the old name.
 *
 *   4. No environment variable that names a secret may be read through a
 *      NEXT_PUBLIC_ prefix. That prefix inlines the value into the browser
 *      bundle at build time.
 *
 *   6. getAuthDb(), the connection that can read password hashes, session
 *      tokens and second-factor secrets, is used only inside src/lib/auth.
 *
 *   7. Every query module that reads raw_source_items or stories also calls
 *      showableSource(). A query that forgot it would show items from a source
 *      whose rights were withdrawn, and look exactly like one that worked.
 *
 *   5. withSystem() is called only from the service, ingestion, auth, mail,
 *      job and rate-limit layers. It reads and writes across every user, so a page or
 *      a component that reached for it would be an authorisation bypass that
 *      type-checks, passes its tests and returns the right data.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ACTIONS_DIR = "src/lib/actions";
const QUERIES_DIR = "src/lib/queries";
const SRC = "src";
const BRAND_FILE = "src/config/brand.ts";
const WRAPPERS = /^(?:public|signedIn|admin|system)Action\s*\(/;

/*
 * Named rather than matched by a pattern: a pattern broad enough to cover these
 * would also cover a real mistake, and the point of this check is that adding an
 * unguarded mutation should be uncomfortable.
 */
const EXCEPTIONS = new Map([]);

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
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const findings = [];

// Files whose name starts with _ are the wrappers and helpers themselves.
const actionFiles = walk(ACTIONS_DIR).filter((f) => !(f.split("/").pop() ?? "").startsWith("_"));
for (const file of actionFiles) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    const fn = line.match(/^export\s+(?:async\s+)?function\s+(\w+)/);
    if (fn && !EXCEPTIONS.has(fn[1])) {
      findings.push(`${file}:${i + 1}  exported function ${fn[1]} is not wrapped`);
      return;
    }
    // An arrow assigned to an exported const is the same unguarded endpoint.
    const konst = line.match(/^export\s+const\s+(\w+)\s*=\s*(.*)$/);
    if (konst && !EXCEPTIONS.has(konst[1]) && !WRAPPERS.test(konst[2].trim())) {
      findings.push(`${file}:${i + 1}  exported const ${konst[1]} is not built by a wrapper`);
    }
  });
}

const queryFiles = walk(QUERIES_DIR);
for (const file of queryFiles) {
  const text = readFileSync(file, "utf8");
  if (!/^\s*import\s+["']server-only["']/m.test(text)) {
    findings.push(`${file}:1  missing \`import "server-only"\``);
  }
  // Rule 7: a reader-facing query over items or stories applies the rights predicate.
  if (/\b(raw_source_items|from\s+stories|join\s+stories)\b/.test(text) && !/showableSource\(/.test(text)) {
    findings.push(`${file}:1  reads items or stories without showableSource() -- withdrawn sources would still show`);
  }
}

const brandName = readFileSync(BRAND_FILE, "utf8").match(/\bname:\s*"([^"]+)"/)?.[1];
if (!brandName) {
  findings.push(`${BRAND_FILE}:1  could not read brand.name — the brand rule cannot run`);
}

const sourceFiles = walk(SRC);
const SECRET_PUBLIC = /NEXT_PUBLIC_[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|DATABASE|NVIDIA)[A-Z0-9_]*/;
const SYSTEM_SCOPE_ALLOWED = [
  "src/lib/db/scope.ts", // where it is defined
  "src/lib/services/",
  "src/lib/ingestion/",
  "src/lib/auth/",
  "src/lib/mail/",
  "src/lib/jobs/",
  "src/lib/rate-limit/",
];
/*
 * getAuthDb() is the connection that can read credentials. Only the
 * authentication layer may hold it.
 */
const AUTH_DB_ALLOWED = ["src/lib/db/client.ts", "src/lib/auth/"];
let systemCallers = 0;
for (const file of sourceFiles) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (/\bwithSystem\s*\(/.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)) {
      if (SYSTEM_SCOPE_ALLOWED.some((allowed) => file.startsWith(allowed))) systemCallers++;
      else findings.push(`${file}:${i + 1}  withSystem() outside the layers allowed to act across users`);
    }
    if (/\bgetAuthDb\b/.test(line) && !AUTH_DB_ALLOWED.some((allowed) => file.startsWith(allowed))) {
      findings.push(`${file}:${i + 1}  getAuthDb() outside lib/auth — that connection can read credentials`);
    }
    if (brandName && file !== BRAND_FILE && line.includes(brandName)) {
      findings.push(`${file}:${i + 1}  product name written out — read it from brand.name`);
    }
    const leak = line.match(SECRET_PUBLIC);
    if (leak) {
      findings.push(`${file}:${i + 1}  ${leak[0]} would ship a secret to the browser`);
    }
  });
}

if (findings.length) {
  console.error("check:guards FAILED — structural rules broken:\n");
  for (const f of findings) console.error("  " + f);
  console.error(
    "\nWrap the export in an action wrapper, add `import \"server-only\"` to the query module,\n" +
      "read the product name from src/config/brand.ts, drop the NEXT_PUBLIC_ prefix, or move the\n" +
      "cross-user work into src/lib/services and call that.\n" +
      "If an export genuinely cannot be wrapped, add it to EXCEPTIONS with a reason.",
  );
  process.exit(1);
}

if (sourceFiles.length === 0) {
  console.error("check:guards FAILED — no source files found under src/. A scan of nothing proves nothing.");
  process.exit(1);
}

console.log(
  `check:guards ok — ${actionFiles.length} action files, ${queryFiles.length} query modules, ` +
    `${systemCallers} system-scope call sites in allowed layers, ` +
    `${sourceFiles.length} source files checked for the brand and public-secret rules`,
);
