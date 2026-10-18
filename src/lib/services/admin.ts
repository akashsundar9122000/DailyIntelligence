import "server-only";

import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import type { CurrentSession } from "@/lib/auth/session";
import { execRows, withSystem, withUser } from "@/lib/db/scope";
import { isoInstant } from "@/lib/db/sql";
import { ADMIN_DISABLED } from "@/lib/ingestion/registry";
import { adminEmails } from "@/lib/env";
import { notFound } from "@/lib/errors";

/**
 * WHO IS AN ADMINISTRATOR. An account whose email address is in ADMIN_EMAILS
 * AND which has confirmed that address. Both, never either: the list alone
 * would make an administrator of whoever signs up with a listed address before
 * its owner does. Read from the database on every call, not from the session
 * that was handed in.
 *
 * WHO IS NOT gets "not found" from every admin function. The pages do not exist
 * for them; a "forbidden" would say that they do.
 *
 * EVERY FUNCTION checks for itself. A page that checked on the way in is not a
 * boundary: an action is its own entrypoint.
 */
export async function isAdmin(session: CurrentSession | null): Promise<boolean> {
  if (!session) return false;
  const listed = adminEmails();
  if (listed.length === 0) return false;
  const rows = await withUser(session.user.id, (tx) =>
    execRows<{ email: string; verified: boolean }>(tx, sql`select lower(email) as email, email_verified as verified from users where id = ${session.user.id}::uuid`),
  );
  const user = rows[0];
  return Boolean(user && user.verified && listed.includes(user.email));
}

export async function requireAdmin(session: CurrentSession | null): Promise<CurrentSession> {
  if (!session || !(await isAdmin(session))) throw notFound("That page");
  return session;
}

/* ----------------------------------------------------------- operations */

export type AdminSource = {
  id: string;
  key: string;
  name: string;
  provider: string;
  rightsStatus: string;
  enabled: boolean;
  disableReason: string | null;
  health: string;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  nextPollAt: string;
  circuitOpenUntil: string | null;
  newestItemAt: string | null;
  itemsDay: number;
  pollIntervalSeconds: number;
};

export type AdminRun = { id: string; source: string; trigger: string; status: string; startedAt: string; durationMs: number | null; httpStatus: number | null; fetched: number; inserted: number; duplicates: number; quarantined: number; clustered: number; error: string | null };
export type AdminJob = { job: string; trigger: string; status: string; startedAt: string; finishedAt: string | null; error: string | null };

export type AdminOverview = {
  sources: AdminSource[];
  runs: AdminRun[];
  jobs: AdminJob[];
  counts: { stories: number; storiesDay: number; items: number; itemsDay: number; readers: number; openReports: number; mailFailed: number };
};

/** The operations view. Counts and bookkeeping only: nothing a reader saved, followed or read. */
export async function adminOverview(session: CurrentSession | null): Promise<AdminOverview> {
  await requireAdmin(session);
  return withSystem("admin.overview", async (tx) => {
    const sources = await execRows<AdminSource>(
      tx,
      sql`select s.id, s.key, s.name, s.provider, s.rights_status as "rightsStatus", s.enabled, s.disable_reason as "disableReason", s.health_status as health,
                 ${isoInstant(sql`s.last_success_at`)} as "lastSuccessAt", ${isoInstant(sql`s.last_error_at`)} as "lastErrorAt", s.last_error as "lastError",
                 s.consecutive_failures as "consecutiveFailures", ${isoInstant(sql`s.next_poll_at`)} as "nextPollAt",
                 ${isoInstant(sql`s.circuit_open_until`)} as "circuitOpenUntil", ${isoInstant(sql`s.newest_item_at`)} as "newestItemAt",
                 (select count(*)::int from raw_source_items r where r.source_id = s.id and r.ingested_at > now() - interval '24 hours') as "itemsDay",
                 s.poll_interval_seconds as "pollIntervalSeconds"
            from sources s order by s.enabled desc, s.priority, s.name`,
    );
    const runs = await execRows<AdminRun>(
      tx,
      sql`select r.id, s.key as source, r.trigger, r.status, ${isoInstant(sql`r.started_at`)} as "startedAt", r.duration_ms as "durationMs", r.http_status as "httpStatus",
                 r.fetched, r.inserted, r.duplicates, r.quarantined, r.clustered, r.error
            from ingestion_runs r join sources s on s.id = r.source_id order by r.started_at desc limit 40`,
    );
    const jobs = await execRows<AdminJob>(
      tx,
      sql`select job, trigger, status, ${isoInstant(sql`started_at`)} as "startedAt", ${isoInstant(sql`finished_at`)} as "finishedAt", error from job_runs order by started_at desc limit 20`,
    );
    const counts = await execRows<AdminOverview["counts"]>(
      tx,
      sql`select (select count(*)::int from stories) as stories,
                 (select count(*)::int from stories where last_updated_at > now() - interval '24 hours') as "storiesDay",
                 (select count(*)::int from raw_source_items) as items,
                 (select count(*)::int from raw_source_items where ingested_at > now() - interval '24 hours') as "itemsDay",
                 (select count(*)::int from users) as readers,
                 (select count(*)::int from content_reports where status = 'open') as "openReports",
                 (select count(*)::int from email_outbox where status = 'FAILED' and created_at > now() - interval '7 days') as "mailFailed"`,
    );
    return { sources, runs, jobs, counts: counts[0]! };
  });
}

/**
 * Switch a source off, or back on. Off is remembered as the administrator's
 * decision (`admin:` + the reason) so the catalogue sync never switches it
 * back on by itself. On is allowed only for a source whose rights are
 * cleared: the database refuses anything else anyway. Written to the audit
 * log in the same transaction.
 */
export async function setSourceEnabled(session: CurrentSession | null, input: { sourceId: string; enabled: boolean; reason: string }): Promise<void> {
  const admin = await requireAdmin(session);
  await withSystem("admin.source", async (tx) => {
    const updated = await execRows<{ key: string }>(
      tx,
      sql`update sources set enabled = ${input.enabled},
                             disable_reason = ${input.enabled ? null : `${ADMIN_DISABLED} ${input.reason.trim().slice(0, 200) || "switched off by an administrator"}`},
                             health_status = ${input.enabled ? "unknown" : "disabled"}, next_poll_at = now(), updated_at = now()
           where id = ${input.sourceId}::uuid and (${!input.enabled} or rights_status = 'cleared')
       returning key`,
    );
    if (updated.length === 0) throw notFound("That source");
    await tx.execute(sql`
      insert into audit_events (id, actor_user_id, action, target_kind, target_id, detail, source_id)
      values (${uuidv7()}::uuid, ${admin.user.id}::uuid, ${input.enabled ? "source.enable" : "source.disable"}, 'source', ${updated[0]!.key}, ${input.reason.trim().slice(0, 500)}, ${input.sourceId}::uuid)`);
  });
}
