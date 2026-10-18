/*
 * Prepares the test database with the SAME code that prepares production:
 * the runtime role from sql/roles.sql, then every migration, as the owner.
 *
 * The suite itself then connects as di_app. That split is the thing under
 * test -- a suite running as the owner bypasses row-level security and would
 * pass every isolation test while proving nothing.
 */
import pg from "pg";

import { applyRoles, migrate } from "../../scripts/db/steps.mts";
import { assertTestDatabase } from "../test-database";

export default async function setup(): Promise<void> {
  const appUrl = process.env.DATABASE_URL_TEST;
  const ownerUrl = process.env.DATABASE_URL_TEST_OWNER;
  if (!appUrl || !ownerUrl) {
    throw new Error("DATABASE_URL_TEST and DATABASE_URL_TEST_OWNER must both be set. See .env.example.");
  }

  // Both must be a local database named *_test. Production is hosted, and no
  // misconfiguration may point a test run at it.
  const name = assertTestDatabase(appUrl);
  if (assertTestDatabase(ownerUrl) !== name) {
    throw new Error("DATABASE_URL_TEST and DATABASE_URL_TEST_OWNER name different databases.");
  }
  if (new URL(appUrl).username === new URL(ownerUrl).username) {
    throw new Error("The test suite must connect as the runtime role, not as the owner: the owner bypasses RLS.");
  }

  await applyRoles(ownerUrl);
  await migrate(ownerUrl);
  await clearRateLimits(ownerUrl);
}

/**
 * Empty both limiter tables before a run.
 *
 * The limiters count in the database on purpose, so their state outlives a
 * test process. Two runs a few seconds apart then share one sliding window:
 * the second run's first request is the first run's fourth, and a test that
 * passed alone fails when repeated. A run must not inherit another's counts.
 */
async function clearRateLimits(ownerUrl: string): Promise<void> {
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    await client.query("truncate auth_rate_limits, rate_limits");
  } finally {
    await client.end();
  }
}
