import "server-only";

import { and, eq, ne, sql } from "drizzle-orm";

import { getAuthDb } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { execRows, withUser } from "@/lib/db/scope";
import { isoInstant } from "@/lib/db/sql";
import { notFound } from "@/lib/errors";

import { deviceLabel, networkPrefix } from "./security-events";

export type DeviceSession = {
  id: string;
  device: string;
  network: string | null;
  /** ISO-8601 instants. */
  createdAt: string;
  lastActiveAt: string;
  current: boolean;
};

/**
 * The devices signed in to an account.
 *
 * Read through the user's own scope and by NAMED columns: the row also holds
 * the session token, which is a credential, and it never leaves the database
 * on this path. The browser is given ids to act on, not tokens.
 */
export async function listDeviceSessions(userId: string, currentSessionId: string): Promise<DeviceSession[]> {
  const rows = await withUser(userId, (tx) =>
    execRows<{ id: string; ip_address: string | null; user_agent: string | null; created_at: string; updated_at: string }>(
      tx,
      sql`select id, ip_address, user_agent,
                 ${isoInstant(sql`created_at`)} as created_at, ${isoInstant(sql`updated_at`)} as updated_at
          from sessions where user_id = ${userId}::uuid and expires_at > now() order by sessions.updated_at desc`,
    ),
  );
  return rows.map((row) => ({
    id: row.id,
    device: deviceLabel(row.user_agent) ?? "Unknown device",
    network: networkPrefix(row.ip_address),
    createdAt: row.created_at,
    lastActiveAt: row.updated_at,
    current: row.id === currentSessionId,
  }));
}

/**
 * End one of a user's sessions. The owner is part of the WHERE clause, so
 * somebody else's session id matches nothing and is reported as not found:
 * a "forbidden" would confirm the id is real.
 */
export async function revokeDeviceSession(userId: string, sessionId: string): Promise<void> {
  const removed = await getAuthDb()
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning({ id: sessions.id });
  if (removed.length === 0) throw notFound("That session");
}

/** End every session but the one making the request. Returns how many were ended. */
export async function revokeOtherDeviceSessions(userId: string, currentSessionId: string): Promise<number> {
  const removed = await getAuthDb()
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, currentSessionId)))
    .returning({ id: sessions.id });
  return removed.length;
}

/**
 * Which sign-in providers are linked to an account: "google", "github". The
 * email code is not a stored link, so it is never in this list.
 *
 * Through the authentication role, by NAMED column: the accounts table also
 * holds OAuth tokens, which never leave the database on this path, and the
 * application role has no policy on it at all.
 */
export async function linkedProviders(userId: string): Promise<string[]> {
  const rows = await getAuthDb().execute(sql`select distinct provider_id from accounts where user_id = ${userId}::uuid and provider_id in ('google', 'github')`);
  const list = Array.isArray(rows) ? rows : (rows as { rows: unknown[] }).rows;
  return (list as { provider_id: string }[]).map((row) => row.provider_id).sort();
}
