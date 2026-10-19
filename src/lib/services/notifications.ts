import "server-only";

import { sql } from "drizzle-orm";
import { cache } from "react";
import { uuidv7 } from "uuidv7";

import { execRows, withSystem, withUser } from "@/lib/db/scope";
import { isoInstant } from "@/lib/db/sql";
import { AppError, notFound, unavailable } from "@/lib/errors";
import { webPushSender, type PushSender } from "@/lib/notifications/push";
import { take } from "@/lib/rate-limit";
import type { NotificationKind, NotificationStatus } from "@/lib/reader-vocab";

import { deliverPush } from "./notify";

/** "Chrome on macOS" from a user agent: enough to tell devices apart in Settings, and nothing more is kept. */
export function deviceLabel(userAgent: string | null): string {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "A browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "an unknown system";
  return `${browser} on ${os}`;
}

/**
 * Keep a browser's push subscription for this reader. An endpoint belongs to
 * one browser, not one person: if someone else last signed in on it, it moves
 * to whoever is signed in now, so alerts never reach the previous reader's
 * successor. That move crosses owners, hence the system scope.
 */
export async function savePushSubscription(userId: string, input: { endpoint: string; p256dh: string; auth: string; userAgent: string | null }): Promise<{ id: string }> {
  if (!/^https:\/\//.test(input.endpoint)) throw new AppError("VALIDATION", "That subscription is not from a push service.");
  const id = uuidv7();
  const rows = await withSystem("push.subscribe", (tx) =>
    execRows<{ id: string }>(
      tx,
      sql`insert into push_subscriptions (id, user_id, endpoint, p256dh, auth, label)
          values (${id}::uuid, ${userId}::uuid, ${input.endpoint}, ${input.p256dh}, ${input.auth}, ${deviceLabel(input.userAgent)})
          on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, label = excluded.label,
                                              revoked_at = null, failures = 0
          returning id`,
    ),
  );
  return { id: rows[0]!.id };
}

/** Stop sending to one device. Another reader's device answers not found, never forbidden. */
export async function removePushSubscription(userId: string, subscriptionId: string): Promise<void> {
  const rows = await withUser(userId, (tx) =>
    execRows(tx, sql`update push_subscriptions set revoked_at = now() where id = ${subscriptionId}::uuid and user_id = ${userId}::uuid and revoked_at is null returning id`),
  );
  if (rows.length === 0) throw notFound("That device");
}

/** The same, by the endpoint the browser holds: what "turn off on this device" knows. */
export async function removePushEndpoint(userId: string, endpoint: string): Promise<void> {
  await withUser(userId, (tx) => tx.execute(sql`update push_subscriptions set revoked_at = now() where endpoint = ${endpoint} and user_id = ${userId}::uuid and revoked_at is null`));
}

export type DeviceRow = { id: string; label: string; createdAt: string; lastSuccessAt: string | null; endpoint: string };

export const listDevices = cache(async (userId: string): Promise<DeviceRow[]> =>
  withUser(userId, (tx) =>
    execRows<DeviceRow>(
      tx,
      sql`select id, label, endpoint, ${isoInstant(sql`created_at`)} as "createdAt", ${isoInstant(sql`last_success_at`)} as "lastSuccessAt"
            from push_subscriptions where user_id = ${userId}::uuid and revoked_at is null order by created_at desc`,
    ),
  ),
);

export type NotificationRow = { id: string; kind: NotificationKind; channel: string; status: NotificationStatus; reason: string | null; title: string; url: string; createdAt: string };

export const recentNotifications = cache(async (userId: string, limit = 20): Promise<NotificationRow[]> =>
  withUser(userId, (tx) =>
    execRows<NotificationRow>(
      tx,
      sql`select id, kind, channel, status, reason, title, url, ${isoInstant(sql`created_at`)} as "createdAt"
            from notification_events where user_id = ${userId}::uuid order by created_at desc limit ${limit}`,
    ),
  ),
);

/** A notification the reader opened, by the id carried in its link. Someone else's id changes nothing. */
export async function markOpened(userId: string, eventId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return;
  await withUser(userId, (tx) =>
    tx.execute(sql`update notification_events set status = 'opened', opened_at = now() where id = ${eventId}::uuid and user_id = ${userId}::uuid and status = 'sent'`),
  );
}

export async function pausedUntil(userId: string): Promise<string | null> {
  const rows = await withUser(userId, (tx) =>
    execRows<{ at: string | null }>(tx, sql`select ${isoInstant(sql`paused_until`)} as at from reader_profiles where user_id = ${userId}::uuid and paused_until > now()`),
  );
  return rows[0]?.at ?? null;
}

/** Pause every notification for some hours, or resume (null), without touching a single rule. */
export async function setPause(userId: string, hours: number | null): Promise<string | null> {
  const rows = await withUser(userId, (tx) =>
    execRows<{ at: string | null }>(
      tx,
      sql`insert into reader_profiles (user_id, paused_until) values (${userId}::uuid, ${hours === null ? null : sql`now() + make_interval(hours => ${hours})`})
          on conflict (user_id) do update set paused_until = excluded.paused_until, updated_at = now()
          returning ${isoInstant(sql`paused_until`)} as at`,
    ),
  );
  return rows[0]?.at ?? null;
}

/**
 * A test notification to every device of this reader, now. It goes through
 * the same delivery as a real alert and is recorded like one, so "it worked"
 * means the real path works.
 */
export async function sendTest(userId: string, sender?: PushSender | null): Promise<{ devices: number; sent: boolean }> {
  const allowed = await take(`push-test:${userId}`, { max: 5, windowSeconds: 3600 });
  if (!allowed.ok) throw new AppError("RATE_LIMITED", "That is enough tests for this hour.");
  const push = sender === undefined ? webPushSender() : sender;
  if (!push) throw unavailable("Notifications are not configured on this deployment.");
  const devices = await withUser(userId, (tx) =>
    execRows<{ id: string; endpoint: string; p256dh: string; auth: string }>(tx, sql`select id, endpoint, p256dh, auth from push_subscriptions where user_id = ${userId}::uuid and revoked_at is null`),
  );
  if (devices.length === 0) throw new AppError("INVALID_STATE", "No device has notifications switched on yet.");
  const id = uuidv7();
  await withUser(userId, (tx) =>
    tx.execute(
      sql`insert into notification_events (id, user_id, kind, channel, dedupe_key, status, title, body, url)
          values (${id}::uuid, ${userId}::uuid, 'test', 'push', ${`test:${id}`}, 'queued', 'A test notification', 'This is how an alert will look. Nothing has happened.', '/app/settings/notifications')`,
    ),
  );
  const outcome = await deliverPush(id, devices, { title: "A test notification", body: "This is how an alert will look. Nothing has happened.", url: `/app/settings/notifications?n=${id}`, tag: `test:${id}` }, push);
  return { devices: devices.length, sent: outcome.sent };
}
