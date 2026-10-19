import "server-only";

import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import type { CurrentSession } from "@/lib/auth/session";
import { execRows, withSystem, withUser } from "@/lib/db/scope";
import { isoInstant, textArray } from "@/lib/db/sql";
import { ADMIN_DISABLED } from "@/lib/ingestion/registry";
import { adminEmails } from "@/lib/env";
import { AppError, notFound } from "@/lib/errors";
import { titleSignature } from "@/lib/ingestion/normalize";
import { dryRunSource, refreshStory, type DryRun } from "@/lib/ingestion/pipeline";

import { sendTest } from "./notifications";
import { setSwitch, type SwitchKey } from "./ops";

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

/* ---------------------------------------------------------- phase 3 ops */

export type AdminNotifications = {
  byStatus: { status: string; count: number }[];
  optedIn: number;
  devices: number;
  lastRun: { status: string; startedAt: string; detail: Record<string, unknown> } | null;
};

/** Notifications over the last day, in counts: nothing about who got what. */
export async function adminNotifications(session: CurrentSession | null): Promise<AdminNotifications> {
  await requireAdmin(session);
  return withSystem("admin.notifications", async (tx) => {
    const byStatus = await execRows<{ status: string; count: number }>(
      tx,
      sql`select status, count(*)::int as count from notification_events where created_at > now() - interval '24 hours' group by status order by status`,
    );
    const totals = (
      await execRows<{ optedIn: number; devices: number }>(
        tx,
        sql`select (select count(*)::int from reader_profiles where notify_breaking or notify_hot or notify_topics or notify_story_updates
                     or morning_briefing or evening_briefing or email_digest) as "optedIn",
                   (select count(*)::int from push_subscriptions where revoked_at is null) as devices`,
      )
    )[0]!;
    const lastRun = (
      await execRows<{ status: string; startedAt: string; detail: Record<string, unknown> }>(
        tx,
        sql`select status, ${isoInstant(sql`started_at`)} as "startedAt", detail from job_runs where job = 'notify' order by started_at desc limit 1`,
      )
    )[0] ?? null;
    return { byStatus, ...totals, lastRun };
  });
}

export async function setOpsSwitch(session: CurrentSession | null, input: { key: SwitchKey; enabled: boolean; reason: string }): Promise<void> {
  const admin = await requireAdmin(session);
  if (!input.enabled && input.reason.trim().length < 3) throw new AppError("VALIDATION", "Say why it is being switched off.", { reason: "Say why it is being switched off." });
  await setSwitch(input.key, input.enabled, input.reason, admin.user.id);
}

export async function dryRun(session: CurrentSession | null, sourceId: string): Promise<DryRun> {
  await requireAdmin(session);
  return dryRunSource(sourceId);
}

/** A test notification to the administrator's own devices: the real path, end to end. */
export async function testSendToSelf(session: CurrentSession | null) {
  const admin = await requireAdmin(session);
  return sendTest(admin.user.id);
}

/* ------------------------------------------------- phase 4: the newsroom */

export type OpenReport = { id: string; reason: string; detail: string; createdAt: string; storyId: string | null; headline: string | null };

/** Open reports, oldest first. What was reported and why; nothing about who reported it. */
export async function openReports(session: CurrentSession | null): Promise<OpenReport[]> {
  await requireAdmin(session);
  return withSystem("admin.reports", (tx) =>
    execRows<OpenReport>(
      tx,
      sql`select r.id, r.reason, r.detail, ${isoInstant(sql`r.created_at`)} as "createdAt", r.story_id as "storyId", st.headline
            from content_reports r left join stories st on st.id = r.story_id
           where r.status = 'open' order by r.created_at limit 50`,
    ),
  );
}

export async function resolveReport(session: CurrentSession | null, input: { reportId: string; status: "actioned" | "dismissed"; resolution: string }): Promise<void> {
  const admin = await requireAdmin(session);
  await withSystem("admin.report.resolve", async (tx) => {
    const rows = await execRows(
      tx,
      sql`update content_reports set status = ${input.status}, resolution = ${input.resolution.trim().slice(0, 500) || null}, resolved_at = now()
           where id = ${input.reportId}::uuid and status = 'open' returning id`,
    );
    if (rows.length === 0) throw notFound("That report");
    await tx.execute(
      sql`insert into audit_events (id, actor_user_id, action, target_kind, target_id, detail)
          values (${uuidv7()}::uuid, ${admin.user.id}::uuid, ${`report.${input.status}`}, 'report', ${input.reportId}, ${input.resolution.trim().slice(0, 500)})`,
    );
  });
}

export type DuplicatePair = { keepId: string; keepHeadline: string; keepSources: number; mergeId: string; mergeHeadline: string; mergeSources: number; distance: number };

/**
 * Stories that are probably one event the clusterer kept apart: headlines
 * almost the same in meaning (embedding distance under 0.25), both updated in
 * the last two days. A suggestion for a person to confirm, never merged
 * automatically: "almost the same" includes two different fires on one day.
 */
export async function possibleDuplicates(session: CurrentSession | null, limit = 12): Promise<DuplicatePair[]> {
  await requireAdmin(session);
  return withSystem("admin.duplicates", (tx) =>
    execRows<DuplicatePair>(
      tx,
      sql`select a.id as "keepId", a.headline as "keepHeadline", a.source_count as "keepSources",
                 b.id as "mergeId", b.headline as "mergeHeadline", b.source_count as "mergeSources",
                 round((ea.embedding <=> eb.embedding)::numeric, 3)::float as distance
            from stories a join story_embeddings ea on ea.story_id = a.id
            join lateral (
              select s.id, s.headline, s.source_count, e.embedding from stories s join story_embeddings e on e.story_id = s.id
               where s.id <> a.id and s.last_updated_at > now() - interval '48 hours'
                 and (s.source_count < a.source_count or (s.source_count = a.source_count and s.id > a.id))
               order by e.embedding <=> ea.embedding limit 1
            ) b on true
            join story_embeddings eb on eb.story_id = b.id
           where a.last_updated_at > now() - interval '48 hours' and (ea.embedding <=> eb.embedding) < 0.25
           order by distance limit ${limit}`,
    ),
  );
}

/**
 * Merge one story into another, in one transaction: its reports, what readers
 * attached to it (saves, feedback, reading), its posts, notifications and
 * reports move to the kept story; its explainers are dropped (the kept story's
 * records changed, so its own is due again); then it is deleted and the kept
 * story rescored. Audited with both headlines.
 */
export async function mergeStories(session: CurrentSession | null, input: { keepId: string; mergeId: string }): Promise<{ movedItems: number }> {
  const admin = await requireAdmin(session);
  if (input.keepId === input.mergeId) throw new AppError("VALIDATION", "A story cannot be merged into itself.");
  return withSystem("admin.merge", async (tx) => {
    const both = await execRows<{ id: string; headline: string }>(tx, sql`select id, headline from stories where id in (${input.keepId}::uuid, ${input.mergeId}::uuid) for update`);
    if (both.length !== 2) throw notFound("That story");
    const keep = input.keepId;
    const merge = input.mergeId;
    const moved = await execRows(tx, sql`update story_items set story_id = ${keep}::uuid, method = 'manual' where story_id = ${merge}::uuid returning id`);
    // A reader's row follows the story, unless they already have the same on the kept one (then it goes with the merged story).
    await tx.execute(sql`update bookmarks b set story_id = ${keep}::uuid where story_id = ${merge}::uuid
                          and not exists (select 1 from bookmarks x where x.user_id = b.user_id and x.story_id = ${keep}::uuid)`);
    await tx.execute(sql`update reading_history h set story_id = ${keep}::uuid where story_id = ${merge}::uuid
                          and not exists (select 1 from reading_history x where x.user_id = h.user_id and x.story_id = ${keep}::uuid)`);
    await tx.execute(sql`update user_story_feedback f set story_id = ${keep}::uuid where story_id = ${merge}::uuid
                          and not exists (select 1 from user_story_feedback x where x.user_id = f.user_id and x.story_id = ${keep}::uuid and x.kind = f.kind)`);
    await tx.execute(sql`update social_posts set story_id = ${keep}::uuid where story_id = ${merge}::uuid`);
    await tx.execute(sql`update story_updates set story_id = ${keep}::uuid where story_id = ${merge}::uuid`);
    await tx.execute(sql`update content_reports set story_id = ${keep}::uuid where story_id = ${merge}::uuid`);
    await tx.execute(sql`update notification_events set story_id = ${keep}::uuid where story_id = ${merge}::uuid`);
    await tx.execute(sql`delete from ai_briefings where story_id = ${merge}::uuid`);
    await tx.execute(sql`delete from stories where id = ${merge}::uuid`);
    await refreshStory(tx, keep);
    const headlines = Object.fromEntries(both.map((story) => [story.id, story.headline]));
    await tx.execute(
      sql`insert into audit_events (id, actor_user_id, action, target_kind, target_id, detail)
          values (${uuidv7()}::uuid, ${admin.user.id}::uuid, 'story.merge', 'story', ${keep}, ${`merged "${headlines[merge]}" into "${headlines[keep]}"`.slice(0, 1000)})`,
    );
    return { movedItems: moved.length };
  });
}

/**
 * Move one report out of a story into a story of its own, when the clusterer
 * attached it wrongly. Its association is marked manual, so a later run does
 * not put it back. Both stories are rescored; audited.
 */
export async function splitItem(session: CurrentSession | null, input: { storyId: string; itemId: string }): Promise<{ newStoryId: string }> {
  const admin = await requireAdmin(session);
  return withSystem("admin.split", async (tx) => {
    const item = (
      await execRows<{ title: string; categories: string[]; countries: string[]; states: string[]; count: number }>(
        tx,
        sql`select i.title, i.categories, i.event_countries as countries, i.indian_states as states,
                   (select count(*)::int from story_items where story_id = ${input.storyId}::uuid) as count
              from story_items si join raw_source_items i on i.id = si.item_id
             where si.story_id = ${input.storyId}::uuid and si.item_id = ${input.itemId}::uuid`,
      )
    )[0];
    if (!item) throw notFound("That report");
    if (item.count < 2) throw new AppError("INVALID_STATE", "A story with one report is already on its own.");
    const newStoryId = uuidv7();
    await tx.execute(
      sql`insert into stories (id, headline, headline_item_id, signature, scope, categories, primary_category, event_countries, indian_states)
          values (${newStoryId}::uuid, ${item.title}, ${input.itemId}::uuid, ${titleSignature(item.title)}, ${item.countries.includes("IN") ? "india" : "global"},
                  ${textArray(item.categories)}, ${item.categories[0] ?? null}, ${textArray(item.countries)}, ${textArray(item.states)})`,
    );
    await tx.execute(sql`update story_items set story_id = ${newStoryId}::uuid, method = 'manual', association_confidence = 100 where item_id = ${input.itemId}::uuid`);
    // The old story may have used this report's words as its headline: point it at one it still has.
    await tx.execute(
      sql`update stories set headline_item_id = si.item_id, headline = i.title
            from (select item_id from story_items where story_id = ${input.storyId}::uuid order by associated_at limit 1) si
            join raw_source_items i on i.id = si.item_id
           where stories.id = ${input.storyId}::uuid and stories.headline_item_id = ${input.itemId}::uuid`,
    );
    await refreshStory(tx, input.storyId);
    await refreshStory(tx, newStoryId);
    await tx.execute(
      sql`insert into audit_events (id, actor_user_id, action, target_kind, target_id, detail)
          values (${uuidv7()}::uuid, ${admin.user.id}::uuid, 'story.split', 'story', ${input.storyId}, ${`moved "${item.title}" to its own story`.slice(0, 1000)})`,
    );
    return { newStoryId };
  });
}

export type AdminAi = { byStatus: { status: string; count: number }[]; tokens: number; embedded: number };

/** The AI pass over the last day: outputs by outcome, tokens used, headlines embedded. */
export async function adminAi(session: CurrentSession | null): Promise<AdminAi> {
  await requireAdmin(session);
  return withSystem("admin.ai", async (tx) => {
    const byStatus = await execRows<{ status: string; count: number }>(
      tx,
      sql`select status, count(*)::int as count from ai_briefings where generated_at > now() - interval '24 hours' group by status order by status`,
    );
    const totals = (
      await execRows<{ tokens: number; embedded: number }>(
        tx,
        sql`select coalesce(sum(coalesce(prompt_tokens, 0) + coalesce(completion_tokens, 0)), 0)::int as tokens,
                   (select count(*)::int from story_embeddings where embedded_at > now() - interval '24 hours') as embedded
              from ai_briefings where generated_at > now() - interval '24 hours'`,
      )
    )[0]!;
    return { byStatus, ...totals };
  });
}

export type HeldExplainer = { id: string; storyId: string; headline: string; importance: number; confidence: number; oneMinute: { text: string; cites: string[] }[]; model: string; generatedAt: string };

/** Explainers held for an editor (EDITORIAL_REVIEW), oldest first. */
export async function heldExplainers(session: CurrentSession | null): Promise<HeldExplainer[]> {
  await requireAdmin(session);
  return withSystem("admin.review", (tx) =>
    execRows<HeldExplainer>(
      tx,
      sql`select b.id, b.story_id as "storyId", st.headline, st.importance, st.confidence, b.content->'oneMinute' as "oneMinute", b.model,
                 ${isoInstant(sql`b.generated_at`)} as "generatedAt"
            from ai_briefings b join stories st on st.id = b.story_id
           where b.status = 'review' order by b.generated_at limit 30`,
    ),
  );
}

/** Approve a held explainer (readers see it now, and its section suggestion applies) or reject it with a reason. Audited. */
export async function reviewExplainer(session: CurrentSession | null, input: { id: string; approve: boolean; note: string }): Promise<void> {
  const admin = await requireAdmin(session);
  const note = input.note.trim().slice(0, 500);
  if (!input.approve && note.length < 3) throw new AppError("VALIDATION", "Say why it is rejected.", { note: "Say why it is rejected." });
  await withSystem("admin.review.decide", async (tx) => {
    const rows = await execRows<{ storyId: string; categories: string[] | null }>(
      tx,
      sql`update ai_briefings set status = ${input.approve ? "ready" : "rejected"}, rejection = ${input.approve ? null : `Rejected by an editor: ${note}`}
           where id = ${input.id}::uuid and status = 'review'
           returning story_id as "storyId", array(select jsonb_array_elements_text(coalesce(content->'categories', '[]'::jsonb))) as categories`,
    );
    const row = rows[0];
    if (!row) throw notFound("That explainer");
    if (input.approve && row.categories?.length) {
      await tx.execute(
        sql`update stories set categories = ${textArray(row.categories.slice(0, 2))}, primary_category = ${row.categories[0]!}, categories_by = 'ai'
             where id = ${row.storyId}::uuid and cardinality(categories) = 0`,
      );
    }
    await tx.execute(
      sql`insert into audit_events (id, actor_user_id, action, target_kind, target_id, detail)
          values (${uuidv7()}::uuid, ${admin.user.id}::uuid, ${input.approve ? "explainer.approve" : "explainer.reject"}, 'explainer', ${input.id}, ${note})`,
    );
  });
}
