import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

/*
 * A SEPARATE FILE from the unit and component configs, rather than one config
 * with projects: each layer has a different environment and a different reason
 * to be slow, and a single --project flag typo silently running the wrong set is
 * a bad failure mode.
 */

loadEnv({ path: ".env.local", quiet: true });

/*
 * POINT THE DATA LAYER AT THE TEST DATABASE, BEFORE ANYTHING IMPORTS IT.
 *
 * An env module parses process.env at module load, which happens on the first
 * import of any query module -- earlier than any beforeAll hook can run.
 * Reassigning DATABASE_URL inside a hook has no effect, and a suite that then
 * reads the real database can pass anyway if it holds the same seed data.
 */
const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  throw new Error(
    "DATABASE_URL_TEST is not set — the integration suite has no database to use. See .env.example.",
  );
}
// tests/integration/global-setup.ts refuses anything that is not a local
// database named *_test before a single test runs.

export default defineConfig({
  test: {
    name: "integration",
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    env: {
      DATABASE_URL: testUrl,
      // The same database, as the authentication library's own role. Local and
      // CI Postgres trust local connections, so the role name is the whole
      // difference between the two URLs.
      DATABASE_URL_AUTH: testUrl.replace("//di_app@", "//di_auth@"),

      // No model key in this tier, whatever .env.local holds: every test hands the
      // pipeline a scripted model, and none may reach a paid service by accident.
      // The live model is exercised by `pnpm eval:ai`, which is not part of the gate.
      NVIDIA_API_KEY: "",

      // Nor the real news sources: a test that wants a feed serves a recorded
      // one from this machine and hands the adapter its address. A suite that
      // read the live internet would pass or fail with somebody else's website.
      GDELT_DOC_API_URL: "http://127.0.0.1:9/unset-in-tests",
      GDELT_LASTUPDATE_URL: "http://127.0.0.1:9/unset-in-tests",
      YOUTUBE_API_KEY: "",
      DEMO_MODE: "",

      // RAISED, not disabled: the suite signs up far more often than a person
      // does. auth-rate-limit.test.ts lowers them again to prove they bite.
      AUTH_LIMIT_DEFAULT: "5000",
      AUTH_LIMIT_SIGN_IN: "5000",
      AUTH_LIMIT_CODE: "5000",
      AUTH_LIMIT_CODE_PER_EMAIL: "500",
      AUTH_LIMIT_CHECK_PER_EMAIL: "500",
    },

    /* Sequential: suites share tables, so two files running at once would
       delete each other's fixtures mid-assertion. */
    fileParallelism: false,
    maxWorkers: 1,

    testTimeout: 30_000,
    hookTimeout: 30_000,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});
