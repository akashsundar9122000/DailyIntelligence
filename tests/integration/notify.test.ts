import pg from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closeDb } from "@/lib/db/client";
import type { PushOutcome, PushPayload, PushSender, PushTarget } from "@/lib/notifications/push";
import { markOpened, removePushSubscription, savePushSubscription, sendTest } from "@/lib/services/notifications";
import { runNotify } from "@/lib/services/notify";

import { createVerifiedUser } from "./auth-helpers";

/*
 * The notification pass against the real test database, with a recording
 * sender in place of the push service. Every story is invented test text.
 */

afterAll(async () => {
  await closeDb();
});

async function ownerQuery<T extends pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
  const owner = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST_OWNER });
  await owner.connect();
  try {
    return (await owner.query<T>(text, values)).rows;
  } finally {
    await owner.end();
  }
}

function recordingSender(answer: PushOutcome = { ok: true }): PushSender & { sent: { target: PushTarget; payload: PushPayload }[] } {
  const sent: { target: PushTarget; payload: PushPayload }[] = [];
  return {
    sent,
    async send(target, payload) {
      sent.push({ target, payload });
      return answer;
    },
  };
}

let sourceId = "";
async function story(headline: string, { heat = 90, confidence = 70, importance = 60, categories = ["cricket"], minutesOld = 20 } = {}): Promise<string> {
  const item = (
    await ownerQuery<{ id: string }>(
      `insert into raw_source_items (id, source_id, provider_item_id, canonical_url, url_hash, publisher_domain, title, normalized_title, published_at)
       values (gen_random_uuid(), $1, gen_random_uuid()::text, 'https://notify.example/' || gen_random_uuid(), md5(random()::text), 'notify.example', $2, lower($2), now())
       returning id`,
      [sourceId, headline],
    )
  )[0]!.id;
  return (
    await ownerQuery<{ id: string }>(
      `insert into stories (id, headline, headline_item_id, signature, categories, primary_category, scope, source_count, item_count, heat, confidence, importance, first_seen_at, last_updated_at)
       values (gen_random_uuid(), $1, $2, lower($1), $3, $4, 'india', 3, 3, $5, $6, $7, now() - make_interval(mins => $8), now() - make_interval(mins => $8)) returning id`,
      [headline, item, categories, categories[0], heat, confidence, importance, minutesOld],
    )
  )[0]!.id;
}

/** A reader who follows cricket, wants hot stories and topic alerts, and has one device. */
async function reader(rules: Record<string, unknown> = {}) {
  const { userId, email } = await createVerifiedUser();
  const values = { notify_hot: true, notify_topics: true, quiet_hours: false, daily_cap: 3, ...rules };
  const columns = Object.keys(values);
  await ownerQuery(
    `insert into reader_profiles (user_id, ${columns.join(", ")}) values ($1, ${columns.map((_, i) => `$${i + 2}`).join(", ")})`,
    [userId, ...Object.values(values)],
  );
  await ownerQuery(`insert into user_interests (id, user_id, kind, value, label, stance) values (gen_random_uuid(), $1, 'category', 'cricket', 'Cricket', 'follow')`, [userId]);
  const device = await savePushSubscription(userId, { endpoint: `https://fcm.googleapis.com/fcm/send/${crypto.randomUUID()}`, p256dh: "p256dh-key-for-tests", auth: "auth-secret", userAgent: "Mozilla/5.0 (Macintosh; Mac OS X 10_15) Chrome/140.0" });
  return { userId, email, deviceId: device.id };
}

const events = (userId: string) =>
  ownerQuery<{ kind: string; status: string; reason: string | null; story_id: string | null }>("select kind, status, reason, story_id from notification_events where user_id = $1 order by created_at", [userId]);

beforeEach(async () => {
  await ownerQuery("truncate sources, raw_source_items, stories, story_items, notification_events, push_subscriptions, ops_switches, ai_briefings cascade");
  await ownerQuery("delete from reader_profiles");
  sourceId = (
    await ownerQuery<{ id: string }>(
      `insert into sources (id, key, name, canonical_domain, source_type, provider, feed_url, country_or_region, rights_status, headline_display_allowed, enabled)
       values (gen_random_uuid(), 'notify-' || gen_random_uuid(), 'Notify Test', 'notify.example', 'publisher', 'rss', 'https://notify.example/feed', 'IN', 'cleared', true, true) returning id`,
    )
  )[0]!.id;
});

describe("the notification pass", () => {
  it("sends one alert about a confirmed story the reader follows, and never the same one twice", async () => {
    const storyId = await story("Regional side wins the final on the last ball");
    const { userId } = await reader();
    const sender = recordingSender();
    const { detail } = await runNotify({ trigger: "test", sender });
    expect(detail).toMatchObject({ sent: 1, failed: 0 });
    expect(sender.sent[0]!.payload).toMatchObject({ title: "Cricket: Regional side wins the final on the last ball", tag: `alert:${storyId}` });
    expect(sender.sent[0]!.payload.url).toMatch(new RegExp(`^/app/story/${storyId}\\?n=[0-9a-f-]{36}$`));
    expect(await events(userId)).toEqual([{ kind: "topic", status: "sent", reason: null, story_id: storyId }]);
    const device = (await ownerQuery<{ last_success_at: Date | null }>("select last_success_at from push_subscriptions where user_id = $1", [userId]))[0]!;
    expect(device.last_success_at).not.toBeNull();

    await runNotify({ trigger: "test", sender });
    expect(sender.sent).toHaveLength(1);
  });

  it("never alerts on heat alone, and records nothing for a story that was not good enough", async () => {
    await story("A viral claim spreads with no one confirming it", { heat: 99, confidence: 10 });
    const { userId } = await reader();
    const sender = recordingSender();
    await runNotify({ trigger: "test", sender });
    expect(sender.sent).toEqual([]);
    expect(await events(userId)).toEqual([]);
  });

  it("holds an alert in quiet hours and says why in the reader's history", async () => {
    await story("Regional side wins the final on the last ball");
    // A quiet window covering the whole day, whatever the clock says.
    const { userId } = await reader({ quiet_hours: true, quiet_start: "00:00", quiet_end: "23:59" });
    const sender = recordingSender();
    await runNotify({ trigger: "test", sender });
    expect(sender.sent).toEqual([]);
    expect(await events(userId)).toEqual([expect.objectContaining({ status: "suppressed", reason: "It arrived during your quiet hours." })]);
  });

  it("sends nothing while the editors have paused notifications", async () => {
    await story("Regional side wins the final on the last ball");
    const { userId } = await reader();
    await ownerQuery("insert into ops_switches (key, enabled, reason) values ('notifications', false, 'test')");
    const sender = recordingSender();
    const { detail } = await runNotify({ trigger: "test", sender });
    expect(detail.paused).toBe(true);
    expect(sender.sent).toEqual([]);
    expect(await events(userId)).toEqual([]);
  });

  it("revokes a device the push service says is gone, and records the alert as not delivered", async () => {
    await story("Regional side wins the final on the last ball");
    const { userId } = await reader();
    await runNotify({ trigger: "test", sender: recordingSender({ ok: false, gone: true, status: 410 }) });
    expect((await ownerQuery<{ revoked_at: Date | null }>("select revoked_at from push_subscriptions where user_id = $1", [userId]))[0]!.revoked_at).not.toBeNull();
    expect(await events(userId)).toEqual([expect.objectContaining({ status: "failed", reason: "No device accepted it." })]);
  });
});

describe("a reader's devices and notifications", () => {
  it("are the reader's own: another reader's device and notification ids change nothing", async () => {
    await story("Regional side wins the final on the last ball");
    const owner = await reader();
    const stranger = await createVerifiedUser();
    await runNotify({ trigger: "test", sender: recordingSender() });
    const eventId = (await ownerQuery<{ id: string }>("select id from notification_events where user_id = $1", [owner.userId]))[0]!.id;

    // 404, not 403: a "forbidden" would confirm the id is real.
    await expect(removePushSubscription(stranger.userId, owner.deviceId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await markOpened(stranger.userId, eventId);
    expect((await ownerQuery<{ status: string }>("select status from notification_events where id = $1", [eventId]))[0]!.status).toBe("sent");
    await markOpened(owner.userId, eventId);
    expect((await ownerQuery<{ status: string }>("select status from notification_events where id = $1", [eventId]))[0]!.status).toBe("opened");
  });

  it("moves a browser's subscription to whoever signs in on it last", async () => {
    const first = await createVerifiedUser();
    const second = await createVerifiedUser();
    const endpoint = `https://fcm.googleapis.com/fcm/send/${crypto.randomUUID()}`;
    const input = { endpoint, p256dh: "p256dh-key-for-tests", auth: "auth-secret", userAgent: null };
    await savePushSubscription(first.userId, input);
    await savePushSubscription(second.userId, input);
    expect(await ownerQuery("select user_id from push_subscriptions where endpoint = $1", [endpoint])).toEqual([{ user_id: second.userId }]);
  });

  it("accepts a subscription only from a browser's push service, and at most ten devices per reader", async () => {
    const { userId } = await createVerifiedUser();
    const keys = { p256dh: "p256dh-key-for-tests", auth: "auth-secret", userAgent: null };
    for (const endpoint of ["https://attacker.example/collect", "https://fcm.googleapis.com:8443/x", "http://fcm.googleapis.com/fcm/send/x", "https://evil.push.services.mozilla.com.attacker.example/x"]) {
      await expect(savePushSubscription(userId, { endpoint, ...keys })).rejects.toMatchObject({ code: "VALIDATION" });
    }
    for (let n = 0; n < 10; n++) await savePushSubscription(userId, { endpoint: `https://updates.push.services.mozilla.com/wpush/v2/${crypto.randomUUID()}`, ...keys });
    await expect(savePushSubscription(userId, { endpoint: `https://web.push.apple.com/${crypto.randomUUID()}`, ...keys })).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(await ownerQuery("select 1 from push_subscriptions where user_id = $1", [userId])).toHaveLength(10);
  });

  it("sends a test through the real delivery path, and refuses when there is no device", async () => {
    const { userId } = await reader();
    const sender = recordingSender();
    expect(await sendTest(userId, sender)).toEqual({ devices: 1, sent: true });
    expect(await events(userId)).toEqual([expect.objectContaining({ kind: "test", status: "sent" })]);
    const lonely = await createVerifiedUser();
    await expect(sendTest(lonely.userId, sender)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});
