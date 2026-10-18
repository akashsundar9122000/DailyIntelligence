import { defineConfig, devices } from "@playwright/test";

/*
 * The production smoke suite: read-only, against the URL in SMOKE_BASE_URL,
 * with no server of its own. Run by .github/workflows/deploy.yml after each
 * production deploy; a failure fails the deploy job.
 */
const BASE_URL = process.env.SMOKE_BASE_URL;
if (!BASE_URL) throw new Error("SMOKE_BASE_URL is not set: the smoke suite has no deployment to check.");

export default defineConfig({
  testDir: "./e2e/smoke",
  workers: 1,
  forbidOnly: true,
  retries: 1,
  timeout: 60_000,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
