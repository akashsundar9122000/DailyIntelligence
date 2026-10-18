import { brand } from "../../src/config/brand";
import { E2E_CRON_SECRET } from "../support/cron";
import { expect, test } from "../support/test";

test.describe("the platform's own guarantees", () => {
  test("the favicon the page links to is served", async ({ page, request }) => {
    await page.goto("/");
    const href = await page.locator('link[rel="icon"]').first().getAttribute("href");
    expect(href).toContain(brand.assets.mark);
    const response = await request.get(href!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/svg+xml");
  });

  test("security headers are set on every response", async ({ request }) => {
    expect((await request.get("/api/health")).headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    const headers = (await request.get("/")).headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("the health endpoint reports the runtime role and enforced row security", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, database: "ok", runtimeRole: "di_app", rowSecurityEnforced: true });
  });

  test("the scheduled job refuses a caller without the scheduler's secret, and runs for one with it", async ({ request }) => {
    expect((await request.get("/api/cron/daily")).status()).toBe(401);
    expect((await request.get("/api/cron/daily", { headers: { authorization: "Bearer not-the-secret-at-all-000000" } })).status()).toBe(401);
    const run = await request.get("/api/cron/daily", { headers: { authorization: `Bearer ${E2E_CRON_SECRET}`, "x-trigger": "manual" } });
    expect(run.status()).toBe(200);
    expect(await run.json()).toMatchObject({ ok: true });
  });

  test("an unknown route is a 404, not a blank page", async ({ request }) => {
    expect((await request.get("/app/admin/does-not-exist")).status()).toBe(404);
  });

  test("a signed-out visitor is sent to sign in from every page of the paper", async ({ page }) => {
    for (const path of ["/app", "/app/hot", "/app/settings/security"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login\?next=/);
    }
  });
});
