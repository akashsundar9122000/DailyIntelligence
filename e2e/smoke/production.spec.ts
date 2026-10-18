import { expect, test } from "@playwright/test";

/*
 * Read-only checks against a DEPLOYED build, run by the deploy workflow after
 * every production deploy. Nothing here signs in, writes, or sends mail: it
 * reads what any visitor can read, and asserts the things that are invisible
 * when they break -- the commit that is live, the role the database is
 * reached as, and the doors that must stay shut.
 */
const EXPECTED_COMMIT = process.env.SMOKE_EXPECTED_COMMIT?.slice(0, 7);

test("the deployed build is the commit that was pushed, on the runtime role, with row security enforced", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const health = await response.json();
  expect(health).toMatchObject({ ok: true, database: "ok", runtimeRole: "di_app", rowSecurityEnforced: true });
  if (EXPECTED_COMMIT) expect(health.commit).toBe(EXPECTED_COMMIT);
});

for (const path of ["/", "/login", "/sources", "/status", "/privacy", "/terms", "/ai-policy"]) {
  test(`${path} renders without a console error`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const response = await page.goto(path, { waitUntil: "load" });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("the scheduler's endpoints refuse a caller without the secret", async ({ request }) => {
  for (const path of ["/api/cron/daily"]) {
    expect([401, 503]).toContain((await request.get(path)).status());
  }
});

test("the developer pages and the outbox do not exist in production", async ({ request }) => {
  for (const path of ["/dev/tokens", "/dev/outbox"]) expect((await request.get(path)).status()).toBe(404);
});

test("a signed-out visitor is sent to sign in, not shown the paper", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?next=/);
});
