import { createECDH, randomBytes, randomUUID } from "node:crypto";

import pg from "pg";

import { newEmail, signIn } from "../support/auth";
import { E2E_CRON_SECRET } from "../support/cron";
import { PUSH_STUB_PORT } from "../support/push-tls";
import { SEED_STORIES } from "../support/seed";
import { expect, test } from "../support/session";
import { choose, test as fresh } from "../support/test";

/*
 * Notifications and live updates end to end. Delivery goes through the real
 * web-push library to the suite's stand-in push service; every check of a side
 * effect reads the database, not the response that claims it.
 */

const headline = (key: string) => SEED_STORIES.find((story) => story.key === key)!.headline;

async function owner<T extends pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST_OWNER });
  await client.connect();
  try {
    return (await client.query<T>(text, values)).rows;
  } finally {
    await client.end();
  }
}

/** A browser's subscription keys, made the way a browser makes them, so the product's encryption runs for real. */
function deviceKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") };
}

const userIdOf = async (email: string) => (await owner<{ id: string }>("select id from users where lower(email) = lower($1)", [email]))[0]!.id;

test.describe("the notification pass", () => {
  test("refuses a caller without the scheduler's secret", async ({ request }) => {
    expect((await request.post("/api/cron/notify")).status()).toBe(401);
  });
});

fresh.describe("an alert, end to end", () => {
  fresh("reaches a reader's device for a confirmed story they follow, once, and is marked opened when followed", async ({ page, request }) => {
    const email = await signIn(page, newEmail());
    const userId = await userIdOf(email);
    await owner("insert into reader_profiles (user_id, notify_topics, quiet_hours) values ($1, true, false) on conflict (user_id) do update set notify_topics = true, quiet_hours = false", [userId]);
    await owner("insert into user_interests (id, user_id, kind, value, label, stance) values (gen_random_uuid(), $1, 'category', 'india-politics', 'Indian Politics', 'follow')", [userId]);
    const keys = deviceKeys();
    await owner("insert into push_subscriptions (id, user_id, endpoint, p256dh, auth, label) values (gen_random_uuid(), $1, $2, $3, $4, 'Test browser')", [
      userId,
      `https://127.0.0.1:${PUSH_STUB_PORT}/push/${randomUUID()}`,
      keys.p256dh,
      keys.auth,
    ]);

    const run = await request.post("/api/cron/notify", { headers: { authorization: `Bearer ${E2E_CRON_SECRET}` } });
    expect(run.status()).toBe(200);
    const sent = await owner<{ id: string; status: string; kind: string; url: string; title: string }>("select id, status, kind, url, title from notification_events where user_id = $1", [userId]);
    expect(sent).toEqual([expect.objectContaining({ status: "sent", kind: "topic", title: `Indian Politics: ${headline("lane")}` })]);
    expect((await owner<{ last_success_at: Date | null }>("select last_success_at from push_subscriptions where user_id = $1", [userId]))[0]!.last_success_at).not.toBeNull();

    // A second pass sends nothing new: the same story never alerts the same reader twice.
    await request.post("/api/cron/notify", { headers: { authorization: `Bearer ${E2E_CRON_SECRET}` } });
    expect(await owner("select id from notification_events where user_id = $1", [userId])).toHaveLength(1);

    // Following the notification's link opens the story and records the open.
    await page.goto(`${sent[0]!.url}?n=${sent[0]!.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(headline("lane"));
    expect((await owner<{ status: string }>("select status from notification_events where id = $1", [sent[0]!.id]))[0]!.status).toBe("opened");

    // And the reader can see it in their history.
    await page.goto("/app/settings/notifications");
    const history = page.getByRole("region", { name: "Recent notifications" });
    await expect(history.getByText(`Indian Politics: ${headline("lane")}`)).toBeVisible();
    await expect(history.getByText("Opened", { exact: true })).toBeVisible();
  });

  fresh("revokes a device the push service reports gone", async ({ page, request }) => {
    const email = await signIn(page, newEmail());
    const userId = await userIdOf(email);
    await owner("insert into reader_profiles (user_id, notify_topics, quiet_hours) values ($1, true, false) on conflict (user_id) do update set notify_topics = true", [userId]);
    await owner("insert into user_interests (id, user_id, kind, value, label, stance) values (gen_random_uuid(), $1, 'category', 'climate', 'Climate', 'follow')", [userId]);
    const keys = deviceKeys();
    await owner("insert into push_subscriptions (id, user_id, endpoint, p256dh, auth, label) values (gen_random_uuid(), $1, $2, $3, $4, 'Old browser')", [
      userId,
      `https://127.0.0.1:${PUSH_STUB_PORT}/push/${randomUUID()}/gone`,
      keys.p256dh,
      keys.auth,
    ]);
    await request.post("/api/cron/notify", { headers: { authorization: `Bearer ${E2E_CRON_SECRET}` } });
    expect((await owner<{ revoked_at: Date | null }>("select revoked_at from push_subscriptions where user_id = $1", [userId]))[0]!.revoked_at).not.toBeNull();
    await page.goto("/app/settings/notifications");
    await expect(page.getByRole("region", { name: "Your devices" }).getByText("No device yet.")).toBeVisible();
  });
});

test.describe("notification settings", () => {
  test("explains a browser that has blocked notifications, and asks for permission only when the reader presses the button", async ({ page }) => {
    // Headless Chromium starts with notifications denied: the page must say so, not offer a button that cannot work.
    await page.goto("/app/settings/notifications");
    await expect(page.getByRole("region", { name: "This device" }).getByText("This browser has blocked notifications from this site.", { exact: false })).toBeVisible();

    // A browser that has not been asked yet, which headless Chromium cannot be: the permission reads "default", and asking is recorded.
    let prompted = 0;
    await page.exposeFunction("__permissionAsked", () => {
      prompted += 1;
    });
    await page.addInitScript(() => {
      let state: NotificationPermission = "default";
      Object.defineProperty(Notification, "permission", { get: () => state });
      Notification.requestPermission = async () => {
        await (window as unknown as { __permissionAsked: () => Promise<void> }).__permissionAsked();
        state = "denied";
        return state;
      };
    });
    await page.goto("/app/settings/notifications");
    const device = page.getByRole("region", { name: "This device" });
    await expect(device.getByRole("button", { name: "Turn on for this device" })).toBeVisible();
    expect(prompted).toBe(0);
    await device.getByRole("button", { name: "Turn on for this device" }).click();
    await expect.poll(() => prompted).toBe(1);
    // Refused at the prompt: the page explains, and no subscription was saved.
    await expect(device.getByText("This browser has blocked notifications from this site.", { exact: false })).toBeVisible();
  });

  test("saves the alert rules, and they are still there after a reload", async ({ page }) => {
    await page.goto("/app/settings/notifications");
    const rules = page.getByRole("region", { name: "What to alert you about" });
    await rules.getByRole("switch", { name: "Hot stories you follow" }).click();
    await choose(rules.getByRole("combobox", { name: "At most, per day" }), "2 alerts");
    await rules.getByRole("button", { name: "Save alert rules" }).click();
    await expect(page.getByText("Done: Your alert rules were saved.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("region", { name: "What to alert you about" }).getByRole("switch", { name: "Hot stories you follow" })).toBeChecked();
    await expect(page.getByRole("region", { name: "What to alert you about" }).getByRole("combobox", { name: "At most, per day" })).toHaveText("2 alerts");
  });

  test("pauses everything without changing a rule, and resumes", async ({ page }) => {
    await page.goto("/app/settings/notifications");
    const pause = page.getByRole("region", { name: "Pause" });
    await pause.getByRole("button", { name: "Pause for 8 hours" }).click();
    await expect(pause.getByText(/^Paused until /)).toBeVisible();
    await pause.getByRole("button", { name: "Resume now" }).click();
    await expect(pause.getByRole("button", { name: "Pause for 8 hours" })).toBeVisible();
  });

  test("shows an alert held back by the reader's rules, with the reason", async ({ page, signedIn }) => {
    const userId = await userIdOf(signedIn.email);
    await owner(
      `insert into notification_events (id, user_id, kind, channel, dedupe_key, status, reason, title, body, url)
       values (gen_random_uuid(), $1, 'hot', 'push', $2, 'suppressed', 'It arrived during your quiet hours.', 'Hot now: a held-back test alert', 'x', '/app')`,
      [userId, `e2e:${randomUUID()}`],
    );
    await page.goto("/app/settings/notifications");
    const history = page.getByRole("region", { name: "Recent notifications" });
    await expect(history.getByText("Hot now: a held-back test alert")).toBeVisible();
    await expect(history.getByText("It arrived during your quiet hours.").first()).toBeVisible();
    await expect(history.getByText("Held back", { exact: true }).first()).toBeVisible();
  });
});

test.describe("live updates", () => {
  test("an open page offers stories that arrived after it was drawn, and loads them only when asked", async ({ page }) => {
    await page.clock.install();
    await page.goto("/app/hot");
    const item = (
      await owner<{ id: string }>(
        `insert into raw_source_items (id, source_id, provider_item_id, canonical_url, url_hash, publisher_domain, title, normalized_title)
         select gen_random_uuid(), id, gen_random_uuid()::text, 'https://late.example/' || gen_random_uuid(), md5(random()::text), 'late.example',
                'Late edition: harbour reopens after the storm', 'late edition: harbour reopens after the storm' from sources where key = 'e2e-news-index' returning id`,
      )
    )[0]!.id;
    const story = (
      await owner<{ id: string }>(
        `insert into stories (id, headline, headline_item_id, signature, scope, source_count, item_count, heat, confidence, importance, first_seen_at, last_updated_at)
         values (gen_random_uuid(), 'Late edition: harbour reopens after the storm', $1, 'late harbour ' || gen_random_uuid(), 'global', 2, 2, 60, 50, 50, now(), now()) returning id`,
        [item],
      )
    )[0]!.id;
    try {
      const banner = page.getByRole("button", { name: /1 new story · show/ });
      // A minute of page time at a time until the poll has run: on a slow runner the page may still be hydrating after the first minute.
      await expect(async () => {
        await page.clock.runFor(65_000);
        await expect(banner).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 30_000 });
      await expect(page.getByRole("heading", { level: 3, name: "Late edition: harbour reopens after the storm" })).toHaveCount(0);
      await banner.click();
      await expect(page.getByRole("heading", { level: 3, name: "Late edition: harbour reopens after the storm" })).toBeVisible();
      await expect(banner).toHaveCount(0);
    } finally {
      await owner("delete from stories where id = $1", [story]);
      await owner("delete from raw_source_items where id = $1", [item]);
    }
  });

  test("the count refuses an instant that is not recent", async ({ request }) => {
    expect((await request.get("/api/feed/pulse?since=2020-01-01T00:00:00Z")).status()).toBe(400);
  });
});
