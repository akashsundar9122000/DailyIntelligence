import { config as loadEnv } from "dotenv";
import pg from "pg";

import { applyRoles, migrate } from "../../scripts/db/steps.mts";
import { assertTestDatabase } from "../../tests/test-database";
import { startModelStub } from "./model-stub";
import { seedEdition } from "./seed";

/*
 * The suite's server runs against the local test database. Prepare it here, with
 * the same role and migration code as every other environment, so the suite
 * does not depend on the integration tier having happened to run first.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  loadEnv({ path: ".env.local", quiet: true });
  const appUrl = process.env.DATABASE_URL_TEST;
  const ownerUrl = process.env.DATABASE_URL_TEST_OWNER;
  if (!appUrl || !ownerUrl) {
    throw new Error("DATABASE_URL_TEST and DATABASE_URL_TEST_OWNER must both be set. See .env.example.");
  }
  assertTestDatabase(appUrl);
  assertTestDatabase(ownerUrl);
  await applyRoles(ownerUrl);
  await migrate(ownerUrl);

  // The limiters count in the database, so a previous run's counts would
  // otherwise carry into this one. See tests/integration/global-setup.ts.
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    await client.query("truncate auth_rate_limits, rate_limits");
    // The integration tier leaves its own sources and stories in this same
    // database. The suite starts from "no source has been read".
    await client.query("truncate sources, raw_source_items, stories, story_items, story_updates, story_scores, ingestion_runs cascade");
  } finally {
    await client.end();
  }
  // A small invented edition, so the journeys have stories to read (e2e/support/seed.ts).
  await seedEdition(ownerUrl);
  // Returned so that Playwright stops the stand-in model when the run ends.
  return startModelStub();
}
