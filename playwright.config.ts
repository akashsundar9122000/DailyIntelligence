import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// The server this suite starts is pointed at the local TEST database below, so
// its URL has to be known here. CI supplies it through the environment instead.
loadEnv({ path: ".env.local", quiet: true });
if (!process.env.DATABASE_URL_TEST) {
  throw new Error("DATABASE_URL_TEST is not set — the end-to-end suite has no database to run against.");
}

import { E2E_ADMIN_EMAIL } from "./e2e/support/admin";
import { PUSH_TLS } from "./e2e/support/push-tls";
import { E2E_VAPID } from "./e2e/support/vapid";
import { E2E_CRON_SECRET } from "./e2e/support/cron";
import { MODEL_STUB_PORT } from "./e2e/support/model-stub";

/** A distinct port per harness, so this can run beside a dev server (4610)
 *  without either of them answering for the other. */
const PORT = Number(process.env.E2E_PORT ?? 4620);

export default defineConfig({
  testDir: "./e2e/tests",

  /*
   * workers: 1 makes ordering deterministic -- which means ONE SPEC'S LEFTOVERS
   * ARE THE NEXT SPEC'S FIXTURES. A journey that changes shared state must put
   * it back before it finishes.
   */
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,

  retries: process.env.CI ? 1 : 0,

  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    navigationTimeout: 45_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    /*
     * A spec named *.mobile.spec.ts or *.desktop.spec.ts is run by that project
     * alone. Selecting by file rather than skipping inside a test means the
     * report never shows a skip: a skipped test looks the same whether it was
     * meant or forgotten.
     */
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      testIgnore: [/motion\.spec\.ts/, /\.mobile\.spec\.ts/, /\.webkit\.spec\.ts/],
    },

    /*
     * A layout that only works at 1440px is a layout that does not work -- and
     * the desktop project exists to prove the same build did not change at
     * 1440px, because a mobile pass that quietly reflows desktop is the failure
     * this is written to avoid.
     */
    { name: "mobile", use: { ...devices["Pixel 7"] }, testIgnore: [/motion\.spec\.ts/, /\.desktop\.spec\.ts/, /\.webkit\.spec\.ts/] },

    /*
     * An iPhone, in WebKit. Only the *.webkit.spec.ts journeys: the failures that
     * passed every Chromium project above and broke on a real iPhone (a dropdown
     * no tap could use, a hydration error from a date). Running the whole suite
     * a second time in WebKit would double the gate for little more than that.
     */
    { name: "webkit", use: { ...devices["iPhone 14"] }, testMatch: /\.webkit\.spec\.ts/ },

    /*
     * Asserts the reduced-motion kill switch actually works. Without a project
     * that runs under it, "we respect prefers-reduced-motion" is a claim in a
     * comment rather than a tested behaviour.
     */
    {
      name: "reduced-motion",
      use: { ...devices["Desktop Chrome"], reducedMotion: "reduce" },
      testMatch: /motion\.spec\.ts/,
    },
  ],

  globalSetup: "./e2e/support/global-setup.ts",

  webServer: {
    /*
     * `pnpm verify` has just built, and sets E2E_SKIP_BUILD so the suite does
     * not build a second time. Run on its own, the suite builds first: starting
     * a stale .next would test yesterday's code and report on today's.
     */
    command: process.env.E2E_SKIP_BUILD ? "pnpm start" : "pnpm build && pnpm start",
    port: PORT,

    /*
     * NEVER ADOPT A SERVER THIS SUITE DID NOT START. A reused server on a
     * shared port can be a different application entirely; every assertion then
     * fails with "element not found", which reads like a broken page rather
     * than the wrong page. Failing because the port is busy is far better.
     */
    reuseExistingServer: false,
    timeout: 600_000,

    env: {
      PORT: String(PORT),
      /* This suite runs a PRODUCTION build, where the design reference pages
         correctly refuse to render. Opting in explicitly is what the flag is
         for; the refusal itself is covered by tests/unit/env.test.ts. */
      APP_DEV_TOOLS: "1",

      /*
       * The TEST database, as the runtime role. Set explicitly because `next
       * start` also reads .env.local, where DATABASE_URL is the development
       * database: without this the suite would write its fixtures into the
       * data a developer is looking at.
       */
      DATABASE_URL: process.env.DATABASE_URL_TEST,
      DATABASE_URL_AUTH: process.env.DATABASE_URL_TEST.replace("//di_app@", "//di_auth@"),

      /* A production build refuses to sign with the development key, which is
         correct. This value exists only for this suite's throwaway database and
         protects nothing. */
      APP_SECRET: "end-to-end-suite-only-".padEnd(48, "x"),

      /* The scheduler's secret, so the suite can run the daily job the way the
         scheduler does. Assembled here; it guards only this suite's server. */
      CRON_SECRET: E2E_CRON_SECRET,

      /* One administrator, so the pages only an administrator has can be opened. The address is this run's own. */
      ADMIN_EMAILS: E2E_ADMIN_EMAIL,

      /*
       * The AI layer talks to a model. Here it talks to a stand-in
       * started by the suite (e2e/support/model-stub.ts), through the same
       * client and the same wire format: no hook in the product chooses it,
       * only the address. The key is a placeholder; the stand-in checks only
       * that one was sent.
       */
      /* Push keys for this run only, made when the config loads (e2e/support/vapid.ts): the
         settings page offers notifications only when push is configured, and no key is committed. */
      WEB_PUSH_PUBLIC_KEY: E2E_VAPID.publicKey,
      WEB_PUSH_PRIVATE_KEY: E2E_VAPID.privateKey,
      WEB_PUSH_SUBJECT: "https://localhost.invalid",
      /* Trust the stand-in push service's certificate (e2e/support/push-tls.ts), and only for this server. */
      NODE_EXTRA_CA_CERTS: PUSH_TLS.cert,

      NVIDIA_API_KEY: "end-to-end-placeholder",
      NVIDIA_BASE_URL: `http://127.0.0.1:${MODEL_STUB_PORT}/v1`,
      NVIDIA_MODEL: "stub/scripted",
      /*
       * Illustrations: the image model at the same stand-in, which has no
       * image route, and a placeholder store token. Set here because `next
       * start` reads .env.local, which holds the REAL Blob token on a machine
       * where the store was connected: without these the suite could draw with
       * a real model and write into the real store.
       */
      NVIDIA_IMAGE_URL: `http://127.0.0.1:${MODEL_STUB_PORT}/v1/genai`,
      BLOB_READ_WRITE_TOKEN: "end-to-end-placeholder-no-store",

      /* RAISED, not disabled: turning the limiter off would leave that code
         path untested. The suite signs up and signs in far more often than a
         person does. */
      AUTH_LIMIT_DEFAULT: "2000",
      AUTH_LIMIT_SIGN_IN: "500",
      AUTH_LIMIT_CODE: "500",
      AUTH_LIMIT_CODE_PER_EMAIL: "500",
      AUTH_LIMIT_CHECK_PER_EMAIL: "500",

      /* No real news source: a spec that needs a feed serves a recorded one. */
      GDELT_DOC_API_URL: "http://127.0.0.1:9/unset-in-e2e",
      GDELT_LASTUPDATE_URL: "http://127.0.0.1:9/unset-in-e2e",
      YOUTUBE_API_KEY: "",
      DEMO_MODE: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",

      /* Blank every outbound provider. A developer with real SMTP settings in
         .env.local would otherwise have this suite emailing made-up addresses.
         With these unset, mail is recorded in the outbox and sent nowhere. */
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASS: "",
      MAIL_FROM: "",
    },
  },
});
