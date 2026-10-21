import { E2E_CRON_SECRET } from "../support/cron";
import { SEED_STORIES } from "../support/seed";
import { expect, test } from "../support/session";

/*
 * Phase 5 end to end: the content security policy, the visual explainer, the
 * retention purge on the daily job, and a rate limit that holds.
 */

const headline = (key: string) => SEED_STORIES.find((story) => story.key === key)!.headline;

test.describe("the content security policy", () => {
  test("gives each page a fresh nonce, allows embeds from only the two cleared platforms, and every inline script carries it", async ({ request }) => {
    const first = await request.get("/app/social");
    const second = await request.get("/app/social");
    const policy = first.headers()["content-security-policy"] ?? "";
    const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
    expect(nonce).toBeTruthy();
    expect(/'nonce-([^']+)'/.exec(second.headers()["content-security-policy"] ?? "")?.[1]).not.toBe(nonce);
    expect(policy).toContain("'strict-dynamic'");
    expect(policy).toContain("frame-src https://mastodon.social https://embed.bsky.app https://www.youtube-nocookie.com");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain("unsafe-eval");
    // Served over plain http here: upgrading requests would point the page at a port that is not listening.
    expect(policy).not.toContain("upgrade-insecure-requests");
    const html = await first.text();
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].map((match) => match[1]!);
    expect(inline.length).toBeGreaterThan(0);
    for (const attributes of inline) expect(attributes).toContain(`nonce="${nonce}"`);
  });

  test("blocks nothing the paper needs, and does block a frame from anywhere else", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/Content Security Policy|Refused to (load|execute|frame)/i.test(message.text())) violations.push(message.text());
    });
    for (const path of ["/", "/app", "/app/social", "/app/settings/notifications", "/app/briefings"]) {
      await page.goto(path, { waitUntil: "load" });
    }
    await page.goto("/app/categories/climate");
    await page.getByRole("link", { name: headline("monsoon") }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(headline("monsoon"));
    // The seeded posts' embeds point at a test host that is not a cleared platform: refusing them is the policy working.
    const foreignFrames = violations.filter((text) => /Framing 'https:\/\/fixtures\.invalid\//.test(text));
    expect(foreignFrames.length).toBeGreaterThan(0);
    expect(violations.filter((text) => !foreignFrames.includes(text))).toEqual([]);
  });
});

test.describe("the visual explainer", () => {
  test("plays the checked explainer as cards, step by step, with every card in the transcript", async ({ page, request }) => {
    await request.post("/api/cron/enrich", { headers: { authorization: `Bearer ${E2E_CRON_SECRET}` } });
    await page.goto("/app/categories/climate");
    await page.getByRole("link", { name: headline("monsoon") }).first().click();
    const cards = page.getByRole("region", { name: "The story in cards" });
    await expect(cards.getByText("no footage, no images", { exact: false })).toBeVisible();
    await cards.getByRole("button", { name: "Play the cards" }).click();
    await expect(cards.getByText(/^Card 1 of \d+$/)).toBeVisible();
    await expect(cards.getByText(headline("monsoon")).first()).toBeVisible();
    await cards.getByRole("button", { name: "Pause" }).click();
    await cards.getByRole("button", { name: "Next" }).click();
    await expect(cards.getByText(/^Card 2 of \d+$/)).toBeVisible();
    await cards.getByText("Transcript of every card").click();
    await expect(cards.getByRole("listitem").filter({ hasText: "Sources" }).first()).toBeVisible();
  });
});

test.describe("the daily job", () => {
  test("runs the retention purge and reports what it removed, in counts", async ({ request }) => {
    const response = await request.get("/api/cron/daily", { headers: { authorization: `Bearer ${E2E_CRON_SECRET}` } });
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { ok: boolean; purged: Record<string, number> };
    expect(body.ok).toBe(true);
    // illustrations (phase 7c): illustration files removed from the store with their stories, and refused attempts aged out.
    expect(Object.keys(body.purged).sort()).toEqual(["aiRejected", "illustrations", "ingestionRuns", "items", "jobRuns", "mail", "notifications", "rateLimits", "stories"]);
  });
});

test.describe("limits", () => {
  test("the new-stories count stops answering one address that asks too often, and says when to come back", async ({ request }) => {
    // Its own address, so the limit it spends is not every other test's.
    const headers = { "x-real-ip": "198.51.100.77" };
    const since = new Date(Date.now() - 60_000).toISOString();
    let last = 200;
    let retryAfter: string | undefined;
    for (let n = 0; n < 125 && last !== 429; n++) {
      const response = await request.get(`/api/feed/pulse?since=${encodeURIComponent(since)}`, { headers });
      last = response.status();
      retryAfter = response.headers()["retry-after"];
    }
    expect(last).toBe(429);
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });
});
