#!/usr/bin/env node
/**
 * Refuses to let a credential reach a commit.
 *
 * Runs FIRST in `pnpm verify`, before anything slower, because this repository
 * lives inside a directory tree that holds other projects' .env files. The cost
 * of catching a leak late is that it is already in the git history.
 *
 * Scans what git WOULD commit: tracked files plus untracked files that are not
 * ignored. Tracked-only would report "0 files scanned" on a fresh repository
 * and pass, which is exactly when a pasted connection string is most likely.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";

/*
 * The parent directory is itself a git repository belonging to a different
 * project. If this one ever loses its own .git, every git command here would
 * silently describe that other repository instead -- so prove where we are.
 */
const toplevel = realpathSync(execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim());
const here = realpathSync(process.cwd());
if (toplevel !== here) {
  console.error(`check:secrets FAILED — git root is ${toplevel}, expected ${here}.`);
  console.error("This project must have its own repository. Run `git init` here; never run git in the parent.");
  process.exit(1);
}

/*
 * Next loads .env.production and .env.production.local on its own for every
 * `next build` and `next start`, on a developer's machine as much as on a
 * server, and ranks them above .env.local. A production connection string kept
 * in one of them points every local production build -- the e2e server, the
 * screenshot script -- at the production database. Production values for the
 * migration scripts live in .env.neon.local, which Next never reads.
 */
for (const name of [".env.production", ".env.production.local"]) {
  if (existsSync(name)) {
    console.error(`check:secrets FAILED — ${name} exists.`);
    console.error("Next loads it for every local production build. Move its contents to .env.neon.local.");
    process.exit(1);
  }
}

const PATTERNS = [
  [/-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/, "private key"],
  // The password segment must not be a ${...} interpolation or a :placeholder.
  // A template that BUILDS a connection string at runtime is not a stored
  // credential, and flagging it either trains people to ignore this gate or
  // pushes them to allowlist a whole file — which is how a real one gets in.
  [/postgres(ql)?:\/\/[^\s"'`<]*:(?!\$\{|:)[^\s"'`@<$]+@/i, "postgres URL with a password"],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}/, "GitHub token"],
  [/\bsk-[A-Za-z0-9_-]{20,}/, "OpenAI-style secret key"],
  [/\bnvapi-[A-Za-z0-9_-]{20,}/, "NVIDIA API key"],
  [/\bvercel_blob_rw_[A-Za-z0-9_]{20,}/, "Vercel Blob token"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key id"],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/\bnpg_[A-Za-z0-9]{12,}/, "Neon credential"],
  [/\bAIza[0-9A-Za-z_-]{35}/, "Google API key"],
  [/\bGOCSPX-[A-Za-z0-9_-]{20,}/, "Google OAuth client secret"],
];

// .env.example is the documented shape of the config and holds only empty keys.
const ALLOW = new Set([".env.example", "scripts/check-secrets.mjs"]);

const listed = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
})
  .split("\0")
  .filter(Boolean);

const findings = [];

// An env file that git would commit is a failure whatever it contains today.
for (const file of listed) {
  const base = file.split("/").pop() ?? "";
  if (/^\.env(\..+)?$/.test(base) && base !== ".env.example") {
    findings.push(`${file}  env file is not ignored`);
  }
}

const files = listed.filter((f) => !ALLOW.has(f));
for (const file of files) {
  let stat;
  try {
    stat = statSync(file);
  } catch {
    continue; // deleted but still indexed
  }
  if (!stat.isFile() || stat.size > 2_000_000) continue;

  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // binary
  }
  if (text.includes("\0")) continue;

  text.split("\n").forEach((line, i) => {
    for (const [re, label] of PATTERNS) {
      if (re.test(line)) findings.push(`${file}:${i + 1}  ${label}`);
    }
  });
}

if (findings.length) {
  console.error("check:secrets FAILED — possible credentials in files git would commit:\n");
  for (const f of findings) console.error("  " + f);
  console.error(
    "\nIf a match is a false positive, add the path to ALLOW in scripts/check-secrets.mjs\n" +
      "with a comment saying why. Do not weaken a pattern.",
  );
  process.exit(1);
}

if (files.length === 0) {
  console.error("check:secrets FAILED — git listed no files. A scan of nothing proves nothing.");
  process.exit(1);
}

console.log(`check:secrets ok — ${files.length} files scanned (tracked and untracked, ignored files excluded)`);
