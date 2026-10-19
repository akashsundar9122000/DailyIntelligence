import "server-only";

import { sql } from "drizzle-orm";

import { hmac } from "@/lib/crypto";
import { execRows, withSystem } from "@/lib/db/scope";

export type Limit = { max: number; windowSeconds: number };

/** An integer from the environment, or the fallback. Overridable so the e2e
 *  suite can RAISE a limit; nothing here can switch one off. */
function limitFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return parsed > 0 ? parsed : fallback;
}

export const LIMITS = {
  searchPerIp: { max: limitFromEnv("SEARCH_LIMIT_PER_IP", 120), windowSeconds: 60 },
  apiPerIp: { max: limitFromEnv("API_LIMIT_PER_IP", 120), windowSeconds: 60 },
  // An export reads everything about an account. A few an hour is generous.
  exportPerIp: { max: limitFromEnv("EXPORT_LIMIT_PER_IP", 10), windowSeconds: 3600 },
  // A report about a story lands in a person's moderation queue. Honest readers file a handful; a flood is abuse.
  reportPerUser: { max: limitFromEnv("REPORT_LIMIT_PER_USER", 20), windowSeconds: 3600 },
  // Each question about a story is a paid call to a hosted model, and sometimes several. Twenty an hour is a long conversation.
  aiPerUser: { max: limitFromEnv("AI_LIMIT_PER_USER", 20), windowSeconds: 3600 },
  aiPerUserDaily: { max: limitFromEnv("AI_LIMIT_PER_USER_DAILY", 60), windowSeconds: 86_400 },
  /* Accounts are free, so a per-account limit alone is a limit per mailbox. Per address of the caller, and for everyone together. */
  aiPerIp: { max: limitFromEnv("AI_LIMIT_PER_IP", 60), windowSeconds: 3600 },
  aiReadersDaily: { max: limitFromEnv("AI_LIMIT_READERS_DAILY", 2000), windowSeconds: 86_400 },
  /*
   * Per ACCOUNT, where the authentication library counts per address of the caller only. A code is
   * six digits and each new one starts its guesses afresh, so without a cap on the account a caller
   * with many addresses could keep asking and keep guessing; and anybody could fill an inbox.
   */
  codeSendPerEmail: { max: limitFromEnv("AUTH_LIMIT_CODE_PER_EMAIL", 5), windowSeconds: 3600 },
  codeCheckPerEmail: { max: limitFromEnv("AUTH_LIMIT_CHECK_PER_EMAIL", 10), windowSeconds: 3600 },
} satisfies Record<string, Limit>;

export type Taken = { ok: boolean; count: number; retryAfterSeconds: number };

/**
 * Take a slot.
 *
 * ONE statement, so two concurrent requests cannot both read "under the limit".
 * The key is an HMAC of the subject: this table must not become a record of
 * which addresses exist and where they were tried from.
 *
 * It opens its OWN transaction, and that is the point. Counted inside the
 * caller's transaction, a request that is then refused and rolled back would
 * erase its own count, and the limiter would never bite. So call this BEFORE
 * opening a scope, never inside one (the nesting guard will refuse).
 *
 * Fails OPEN by default: if the counter cannot be reached, the request
 * proceeds. A limiter that takes the product down with it is worse than one
 * that briefly lets traffic through. `failClosed` is for the limits that guard
 * money or a secret -- paid model calls, guesses at a code -- where an outage
 * of the counter must not become an unlimited allowance.
 */
export async function take(subject: string, limit: Limit, now: Date = new Date(), { failClosed = false }: { failClosed?: boolean } = {}): Promise<Taken> {
  const seconds = Math.floor(now.getTime() / 1000);
  const windowStart = Math.floor(seconds / limit.windowSeconds) * limit.windowSeconds;
  const retryAfterSeconds = Math.max(1, limit.windowSeconds - (seconds - windowStart));
  try {
    const key = hmac("rate-limit", subject);
    const rows = await withSystem("rate-limit", (tx) =>
      execRows<{ count: number }>(
        tx,
        sql`insert into rate_limits (key, window_start, count)
            values (${key}, to_timestamp(${windowStart}), 1)
            on conflict (key, window_start) do update set count = rate_limits.count + 1
            returning count`,
      ),
    );
    const count = rows[0]?.count ?? 1;
    return { ok: count <= limit.max, count, retryAfterSeconds };
  } catch (error) {
    console.error(`rate-limit: counter unavailable, failing ${failClosed ? "closed" : "open"}:`, error instanceof Error ? error.name : "unknown");
    return { ok: !failClosed, count: 0, retryAfterSeconds: failClosed ? 60 : 0 };
  }
}
