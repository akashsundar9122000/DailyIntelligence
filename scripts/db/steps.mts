/*
 * The two database steps, as functions.
 *
 * Shared by the command-line scripts beside this file and by the integration
 * suite's global setup, so the test database is prepared by exactly the code
 * that prepares production. A second copy would drift, and the tests would then
 * prove something about a schema nobody deploys.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate as drizzleMigrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

// The working directory, not import.meta: Playwright's loader compiles its
// global setup (which imports this file) as CommonJS, where import.meta is a
// syntax error. Every caller -- pnpm scripts, vitest, Playwright -- runs from
// the project root.
const ROOT = process.cwd();
const MIGRATIONS = path.join(ROOT, "drizzle", "migrations");
export const APP_ROLE = "di_app";
export const AUTH_ROLE = "di_auth";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocal(url: string): boolean {
  return LOCAL_HOSTS.has(new URL(url).hostname);
}

/** Host and database, never the credentials. Safe to print. */
export function describeTarget(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname.replace(/^\//, "")} on ${parsed.hostname}`;
}

/**
 * Create or refresh the runtime role and its grants.
 *
 * A hosted database must be given a password. A local one with trust
 * authentication needs none, and inventing one would only put a secret in a
 * file for no protection.
 */
export async function applyRoles(ownerUrl: string, password?: string, authPassword?: string): Promise<void> {
  if (!isLocal(ownerUrl)) {
    for (const [name, value] of [
      ["APP_DB_PASSWORD", password],
      ["AUTH_DB_PASSWORD", authPassword],
    ] as const) {
      if (!value || value.length < 24) {
        throw new Error(`${name} must be set, and at least 24 characters, for a hosted database.`);
      }
    }
    if (password === authPassword) throw new Error("APP_DB_PASSWORD and AUTH_DB_PASSWORD must differ.");
  }

  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    const database = (await client.query<{ db: string }>("select current_database() as db")).rows[0]!.db;
    const clauseFor = (value?: string) => (value ? `PASSWORD '${value.replaceAll("'", "''")}'` : "");
    const statement = readFileSync(path.join(ROOT, "sql", "roles.sql"), "utf8")
      // The longer placeholder first: the shorter one is a suffix of it.
      .replaceAll(":AUTH_PASSWORD_CLAUSE:", clauseFor(authPassword))
      .replaceAll(":PASSWORD_CLAUSE:", clauseFor(password))
      .replaceAll(":DATABASE:", `"${database.replaceAll('"', '""')}"`);
    await client.query(statement);

    // Read it back. The statement succeeding says the SQL ran; only the
    // catalogue says the role is what the whole security model assumes it is.
    for (const name of [APP_ROLE, AUTH_ROLE]) {
      const { rows } = await client.query<{ rolbypassrls: boolean; rolsuper: boolean; rolcanlogin: boolean }>(
        "select rolbypassrls, rolsuper, rolcanlogin from pg_roles where rolname = $1",
        [name],
      );
      const role = rows[0];
      if (!role || role.rolbypassrls || role.rolsuper || !role.rolcanlogin) {
        throw new Error(`${name} is not a plain login role after applying roles.sql: ${JSON.stringify(role)}`);
      }
    }
  } finally {
    await client.end();
  }
}

export type MigrateResult = { applied: number; expected: number };

/**
 * Apply pending migrations as the OWNER, then confirm the database agrees.
 *
 * Never run from application start-up: a cold serverless instance racing
 * another to take the migration lock is how a deploy hangs.
 */
export async function migrate(ownerUrl: string): Promise<MigrateResult> {
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS, "meta", "_journal.json"), "utf8")) as {
    entries: unknown[];
  };

  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    await drizzleMigrate(drizzle(client), { migrationsFolder: MIGRATIONS });

    /*
     * Drizzle silently SKIPS a migration whose journal timestamp is not later
     * than the last one applied, and reports success. So count what the
     * database recorded and compare it with what the journal holds.
     */
    const { rows } = await client.query<{ n: number }>("select count(*)::int as n from drizzle.__drizzle_migrations");
    const result = { applied: rows[0]!.n, expected: journal.entries.length };
    if (result.applied !== result.expected) {
      throw new Error(
        `The database records ${result.applied} migrations but the journal lists ${result.expected}. ` +
          "One was skipped: run `pnpm db:generate` to normalise the journal, and check the file order.",
      );
    }
    return result;
  } finally {
    await client.end();
  }
}
