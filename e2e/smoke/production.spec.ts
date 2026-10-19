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
  // 401, not 503: production has a secret, and a 503 here would mean it had gone missing and the 15-minute tick was failing.
  for (const path of ["/api/cron/daily", "/api/cron/tick", "/api/cron/enrich", "/api/cron/notify"]) {
    expect((await request.get(path)).status(), path).toBe(401);
  }
});

test("a signed-out request for a reader's data export is refused", async ({ request }) => {
  expect((await request.get("/api/me/export")).status()).toBe(401);
});

test("the developer pages and the outbox do not exist in production", async ({ request }) => {
  for (const path of ["/dev/tokens", "/dev/outbox"]) expect((await request.get(path)).status()).toBe(404);
});

test("a signed-out visitor is sent to sign in, not shown the paper", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("pages carry a content security policy with a fresh nonce, upgraded to https, and embeds from only the cleared platforms", async ({ request }) => {
  const policy = (await request.get("/login")).headers()["content-security-policy"] ?? "";
  expect(policy).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(policy).toContain("frame-src https://mastodon.social https://embed.bsky.app");
  expect(policy).toContain("upgrade-insecure-requests");
  expect(policy).not.toContain("unsafe-eval");
});

test("publishes how to report a security problem", async ({ request }) => {
  const response = await request.get("/.well-known/security.txt");
  expect(response.status()).toBe(200);
  expect(await response.text()).toMatch(/^Contact: https:\/\/github\.com\/.+\/security\/advisories\/new$/m);
});
