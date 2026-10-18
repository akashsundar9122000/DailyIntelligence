import "server-only";

import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { execRows, withSystem, withUser } from "@/lib/db/scope";
import { isoInstant } from "@/lib/db/sql";
import type { SecurityEventKind } from "@/lib/db/schema";

type Context = { ip?: string | null; userAgent?: string | null };

/**
 * A network prefix, not an address: enough for somebody to recognise "that was
 * me at home" and not enough to be a record of where a person was.
 */
export function networkPrefix(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(ip.trim());
  if (v4) return `${v4[1]}.${v4[2]}.x.x`;
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}::`;
  return null;
}

/** A browser and platform family. The full string fingerprints a device. */
export function deviceLabel(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Firefox\//.test(userAgent)
      ? "Firefox"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Browser";
  const platform = /iPhone|iPad/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Mac OS X/.test(userAgent)
        ? "macOS"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "unknown platform";
  return `${browser} on ${platform}`;
}

/**
 * Append to an account's security log.
 *
 * Never throws: this is called from inside sign-in and from authentication
 * hooks, and a log that cannot be written must not become a sign-in that
 * cannot complete. A failure is reported on the server log by kind only.
 */
export async function recordSecurityEvent(userId: string, kind: SecurityEventKind, context: Context = {}): Promise<void> {
  const detail: Record<string, string> = {};
  const network = networkPrefix(context.ip);
  const device = deviceLabel(context.userAgent);
  if (network) detail.network = network;
  if (device) detail.device = device;
  try {
    await withSystem(`security-event:${kind}`, (tx) =>
      tx.execute(
        sql`insert into security_events (id, user_id, kind, detail)
            values (${uuidv7()}::uuid, ${userId}::uuid, ${kind}, ${JSON.stringify(detail)}::jsonb)`,
      ),
    );
  } catch (error) {
    console.error(`[security-events] could not record ${kind}:`, error instanceof Error ? error.name : "unknown");
  }
}

export type SecurityEvent = { id: string; kind: SecurityEventKind; detail: Record<string, string>; /** ISO-8601 instant. */ createdAt: string };

/** A user's own log, newest first, and whether its chain is intact. */
export async function listSecurityEvents(userId: string, limit = 100): Promise<{ events: SecurityEvent[]; intact: boolean }> {
  return withUser(userId, async (tx) => {
    const events = await execRows<SecurityEvent>(
      tx,
      sql`select id, kind, detail, ${isoInstant(sql`created_at`)} as "createdAt" from security_events
          where user_id = ${userId}::uuid order by seq desc limit ${limit}`,
    );
    const broken = await execRows<{ seq: number | null }>(
      tx,
      sql`select security_events_first_break(${userId}::uuid) as seq`,
    );
    return { events, intact: broken[0]?.seq === null || broken[0]?.seq === undefined };
  });
}
