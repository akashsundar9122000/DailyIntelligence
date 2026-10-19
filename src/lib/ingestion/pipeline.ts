import "server-only";

import { createHash } from "node:crypto";

import { sql, type SQL } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { execRows, withSystem, type Tx } from "@/lib/db/scope";
import { textArray, uuidArray } from "@/lib/db/sql";
import type { ContentType, Provider } from "@/lib/db/schema/news";
import { confidence, heat, importance, SCORE_VERSION, storyState, type StoryFacts } from "@/lib/ranking/scores";
import { recordedJob } from "@/lib/services/jobs";
import { switchesOff } from "@/lib/services/ops";

import { normalizeTitle, sameStory, significantTokens, titleSignature, urlHash } from "./normalize";
import { ADAPTERS, syncCatalogue } from "./registry";
import { SourceError, type FetchFn, type IncomingItem, type SourceContext } from "./types";

/**
 * The ingestion pipeline: lease a due source, read it through its adapter,
 * store what may be stored, attach each new item to a story, score the
 * stories it touched, and record every step in `ingestion_runs`.
 *
 * IDEMPOTENT BY CONSTRUCTION. Items are upserted on (source, provider id), so
 * replaying a run inserts nothing twice; an item already in a story is never
 * clustered again; scores are recomputed from the items, not incremented.
 * A tick that runs twice, or a batch replayed by hand, changes nothing it
 * should not.
 */

type SourceRow = SourceContext & {
  id: string;
  provider: Provider;
  /** aggregator, publisher, official, research...: decides how long silence may last before "stale". */
  sourceType: string;
  pollIntervalSeconds: number;
  consecutiveFailures: number;
  excerptAllowed: boolean;
  mediaAllowed: boolean;
  retentionDays: number | null;
};

export type RunResult = {
  source: string;
  status: "ok" | "not_modified" | "failed";
  fetched: number;
  inserted: number;
  duplicates: number;
  quarantined: number;
  clustered: number;
  error: string | null;
};

/* ------------------------------------------------------------------ store */

type StoredItem = { id: string; title: string; urlHash: string; scope: "india" | "global"; categories: string[]; countries: string[]; states: string[] };

/**
 * Insert what is new, touch what is known, and return only the new.
 *
 * RIGHTS ARE APPLIED HERE, before anything is written: an excerpt is kept only
 * where the source's terms allow one, and no media URL is kept at all until a
 * source licenses it. A field we may not show is a field we do not store.
 */
async function storeItems(tx: Tx, source: SourceRow, items: IncomingItem[]): Promise<{ inserted: StoredItem[]; duplicates: number }> {
  if (items.length === 0) return { inserted: [], duplicates: 0 };
  // The same provider id twice in one batch would make the upsert touch one row twice, which Postgres refuses.
  const unique = [...new Map(items.map((item) => [item.providerItemId, item])).values()];
  const rows = unique.map((item) => {
    const hash = urlHash(item.url);
    return sql`(${uuidv7()}::uuid, ${source.id}::uuid, ${item.providerItemId}, ${item.url}, ${hash}, ${item.publisherDomain}, ${item.publisherName},
      ${item.title}, ${normalizeTitle(item.title)}, ${source.excerptAllowed ? item.excerpt : null}, ${item.author}, ${item.language},
      ${item.contentType satisfies ContentType}, ${null}, ${item.publishedAt}::timestamptz, ${item.sourceUpdatedAt}::timestamptz,
      ${textArray(item.categories)}, ${textArray(item.eventCountries)}, ${textArray(item.indianStates)}, ${JSON.stringify(item.entities)}::jsonb,
      ${JSON.stringify(item.metadata)}::jsonb,
      ${source.retentionDays === null ? null : sql`now() + make_interval(days => ${source.retentionDays})`})`;
  });
  const result = await execRows<{ id: string; inserted: boolean; url_hash: string; title: string; categories: string[]; event_countries: string[]; indian_states: string[] }>(
    tx,
    sql`insert into raw_source_items (id, source_id, provider_item_id, canonical_url, url_hash, publisher_domain, publisher_name, title,
          normalized_title, excerpt, author, language, content_type, media_url, published_at, source_updated_at, categories, event_countries,
          indian_states, entities, metadata, expires_at)
        values ${sql.join(rows, sql`, `)}
        on conflict (source_id, provider_item_id) do update set last_checked_at = now()
        returning id, (xmax = 0) as inserted, url_hash, title, categories, event_countries, indian_states`,
  );
  const inserted = result
    .filter((row) => row.inserted)
    .map((row) => ({
      id: row.id,
      title: row.title,
      urlHash: row.url_hash,
      scope: (row.event_countries ?? []).includes("IN") ? ("india" as const) : ("global" as const),
      categories: row.categories ?? [],
      countries: row.event_countries ?? [],
      states: row.indian_states ?? [],
    }));
  return { inserted, duplicates: result.length - inserted.length };
}

/* ---------------------------------------------------------------- cluster */

/** Fewer significant words than this and a headline cannot be matched by words at all; it starts its own story unless its URL matches. */
const JOIN_SHARED = 3;

/**
 * Attach each new item to a story: the story of an item with the same
 * canonical URL from any source; else the most similar recent story by
 * headline; else a new story of its own. Returns the stories touched.
 *
 * Headline similarity is checked twice: trigram similarity (in Postgres,
 * through its index) to find candidates cheaply, then sameStory() here to
 * decide (normalize.ts: three shared significant words at least, then broad
 * overlap or one headline mostly inside the other).
 */
export async function clusterItems(tx: Tx, items: StoredItem[]): Promise<Set<string>> {
  const touched = new Set<string>();
  // Candidate search uses the trigram index; this threshold only narrows the candidates, the decision is below.
  await tx.execute(sql`select set_config('pg_trgm.similarity_threshold', '0.2', true)`);
  for (const item of items) {
    const sameUrl = await execRows<{ story_id: string }>(
      tx,
      sql`select si.story_id from raw_source_items r join story_items si on si.item_id = r.id
           where r.url_hash = ${item.urlHash} and r.id <> ${item.id}::uuid limit 1`,
    );
    let storyId = sameUrl[0]?.story_id ?? null;
    let method = "url";
    let confidenceOfMatch = 100;

    const tokens = significantTokens(item.title);
    const signature = titleSignature(item.title);
    if (!storyId && tokens.length >= JOIN_SHARED) {
      const candidates = await execRows<{ id: string; signature: string; scope: string }>(
        tx,
        sql`select id, signature, scope from stories
             where last_updated_at > now() - interval '72 hours' and signature % ${signature}
             order by similarity(signature, ${signature}) desc limit 12`,
      );
      let best: { id: string; score: number } | null = null;
      for (const candidate of candidates) {
        const score = sameStory(tokens, candidate.signature.split(" "));
        if (score !== null && (!best || score > best.score)) best = { id: candidate.id, score };
      }
      if (best) {
        storyId = best.id;
        method = "title";
        confidenceOfMatch = Math.round(best.score * 100);
      }
    }

    if (!storyId) {
      storyId = uuidv7();
      method = "new";
      await tx.execute(sql`
        insert into stories (id, headline, headline_item_id, signature, scope, categories, primary_category, event_countries, indian_states)
        values (${storyId}::uuid, ${item.title}, ${item.id}::uuid, ${signature}, ${item.scope}, ${textArray(item.categories)},
                ${item.categories[0] ?? null}, ${textArray(item.countries)}, ${textArray(item.states)})`);
    }
    await tx.execute(sql`
      insert into story_items (id, story_id, item_id, association_confidence, method)
      values (${uuidv7()}::uuid, ${storyId}::uuid, ${item.id}::uuid, ${confidenceOfMatch}, ${method})
      on conflict (item_id) do nothing`);
    touched.add(storyId);
  }
  return touched;
}

/* ---------------------------------------------------------------- refresh */

/**
 * Recompute a story from its items -- counts, places, categories, times --
 * then score it. Recomputed, never incremented, so a replay cannot inflate it.
 * Only items whose source may still be shown are counted: a source withdrawn
 * later stops contributing on the next refresh.
 */
export async function refreshStory(tx: Tx, storyId: string): Promise<void> {
  await tx.execute(sql`
    with items as (
      select r.*, s.is_official, si.associated_at
        from story_items si
        join raw_source_items r on r.id = si.item_id
        join sources s on s.id = r.source_id
       where si.story_id = ${storyId}::uuid and not r.quarantined and s.rights_status = 'cleared'
    ), cats as (
      select c, count(*) as n from items, unnest(items.categories) as c group by c
    )
    update stories set
      item_count = (select count(*) from items),
      source_count = (select count(distinct publisher_domain) from items),
      official_count = (select count(*) from items where is_official),
      categories = coalesce((select array_agg(c order by n desc, c) from cats), '{}'),
      primary_category = (select c from cats order by n desc, c limit 1),
      event_countries = coalesce((select array_agg(distinct c order by c) from items, unnest(items.event_countries) as c), '{}'),
      indian_states = coalesce((select array_agg(distinct c order by c) from items, unnest(items.indian_states) as c), '{}'),
      scope = case when exists (select 1 from items where 'IN' = any(items.event_countries)) then 'india' else 'global' end,
      first_published_at = (select min(published_at) from items),
      last_updated_at = greatest(stories.last_updated_at, coalesce((select max(associated_at) from items), stories.last_updated_at))
    where id = ${storyId}::uuid`);

  const facts = await execRows<{
    items_last_hour: number;
    items_prev_six: number;
    publishers: number;
    publishers_six: number;
    official_items: number;
    countries: number;
    categories: string[];
    age_minutes: number;
    quiet_minutes: number;
  }>(
    tx,
    sql`select
          count(*) filter (where si.associated_at > now() - interval '1 hour')::int as items_last_hour,
          count(*) filter (where si.associated_at <= now() - interval '1 hour' and si.associated_at > now() - interval '7 hours')::int as items_prev_six,
          count(distinct r.publisher_domain)::int as publishers,
          count(distinct r.publisher_domain) filter (where si.associated_at > now() - interval '6 hours')::int as publishers_six,
          count(*) filter (where s.is_official)::int as official_items,
          coalesce(cardinality(max(st.event_countries)), 0)::int as countries,
          max(st.categories) as categories,
          floor(extract(epoch from now() - max(st.first_seen_at)) / 60)::int as age_minutes,
          floor(extract(epoch from now() - max(si.associated_at)) / 60)::int as quiet_minutes
        from story_items si
        join raw_source_items r on r.id = si.item_id
        join sources s on s.id = r.source_id
        join stories st on st.id = si.story_id
       where si.story_id = ${storyId}::uuid and s.rights_status = 'cleared'`,
  );
  const row = facts[0];
  if (!row) return;
  const storyFacts: StoryFacts = {
    itemsLastHour: row.items_last_hour,
    itemsPrevSixHours: row.items_prev_six,
    publishers: row.publishers,
    publishersLastSixHours: row.publishers_six,
    officialItems: row.official_items,
    countries: row.countries,
    categories: row.categories ?? [],
    ageMinutes: row.age_minutes ?? 0,
    quietMinutes: row.quiet_minutes ?? 0,
  };
  const h = heat(storyFacts);
  const c = confidence(storyFacts);
  const i = importance(storyFacts);
  await tx.execute(sql`
    insert into story_scores (id, story_id, version, heat, heat_components, confidence, confidence_components, importance, importance_components)
    values (${uuidv7()}::uuid, ${storyId}::uuid, ${SCORE_VERSION}, ${h.score}, ${JSON.stringify(h.components)}::jsonb,
            ${c.score}, ${JSON.stringify(c.components)}::jsonb, ${i.score}, ${JSON.stringify(i.components)}::jsonb)`);
  await tx.execute(sql`
    update stories set heat = ${h.score}, confidence = ${c.score}, importance = ${i.score}, state = ${storyState(storyFacts)},
                       score_version = ${SCORE_VERSION}, scored_at = now()
     where id = ${storyId}::uuid`);
}

/* -------------------------------------------------------------------- run */

/**
 * Spread retries without chance: a fixed offset per source and attempt, from
 * a hash of its key. Two failing sources do not retry in the same second, and
 * the same source retries at the same offset every time, which makes the
 * schedule reproducible in a test. (Math.random is banned under src/.)
 */
function jitterSeconds(key: string, attempt: number, spread: number): number {
  const digest = createHash("sha256").update(`${key}:${attempt}`).digest();
  return digest.readUInt16BE(0) % spread;
}

/**
 * How long a source may answer without anything new before it is "stale".
 * By kind, from how often each kind really publishes: GDELT always has
 * something within the hour; arXiv is silent at weekends; the Federal Reserve
 * can go days without a release. A source that answers 200 with nothing new
 * for longer than this is not healthy, whatever its status code says.
 */
export function staleAfterHours(sourceType: string): number {
  switch (sourceType) {
    case "aggregator":
      return 6;
    case "research":
      return 96;
    case "official":
      return 168;
    default:
      return 36;
  }
}

/**
 * The health of a source that answered: healthy, or stale when its newest item
 * is older than its kind allows. `newest` is this run's newest item: an UPDATE
 * reads the row's old value, so without it a run that just brought fresh items
 * would be judged on the last run's.
 */
function answeredHealth(sourceType: string, newest: string | null = null): SQL {
  return sql`case when greatest(newest_item_at, ${newest}::timestamptz) < now() - make_interval(hours => ${staleAfterHours(sourceType)}) then 'stale' else 'healthy' end`;
}

/** The next time to ask a source, after a success or after the Nth failure in a row. */
export function nextPollDelaySeconds(source: { key: string; pollIntervalSeconds: number }, failures: number): number {
  if (failures === 0) return source.pollIntervalSeconds;
  // Exponential backoff from the normal interval, capped at six hours, plus up to a minute of spread.
  const backoff = Math.min(source.pollIntervalSeconds * 2 ** Math.min(failures, 6), 6 * 3600);
  return backoff + jitterSeconds(source.key, failures, 60);
}

async function openRun(sourceId: string, trigger: string): Promise<string> {
  const runId = uuidv7();
  await withSystem("ingest.run-open", (tx) => tx.execute(sql`insert into ingestion_runs (id, source_id, trigger) values (${runId}::uuid, ${sourceId}::uuid, ${trigger})`));
  return runId;
}

export async function runSource(source: SourceRow, trigger: string, deadline: number, fetchFn: FetchFn): Promise<RunResult> {
  const started = Date.now();
  const runId = await openRun(source.id, trigger);
  const adapter = ADAPTERS[source.provider];
  const result: RunResult = { source: source.key, status: "ok", fetched: 0, inserted: 0, duplicates: 0, quarantined: 0, clustered: 0, error: null };
  try {
    if (!adapter) throw new SourceError("No adapter for this provider.");
    const outcome = await adapter.read(source, { fetch: fetchFn, deadline });
    if (outcome.status === "not_modified") {
      result.status = "not_modified";
      await withSystem("ingest.not-modified", async (tx) => {
        await tx.execute(sql`
          update sources set last_success_at = now(), consecutive_failures = 0, health_status = ${answeredHealth(source.sourceType)}, last_error = null,
                             leased_until = null, next_poll_at = now() + make_interval(secs => ${source.pollIntervalSeconds}),
                             cursor = coalesce(${outcome.cursor ? JSON.stringify(outcome.cursor) : null}::jsonb, cursor), updated_at = now()
           where id = ${source.id}::uuid`);
        await tx.execute(sql`
          update ingestion_runs set status = 'not_modified', finished_at = now(), duration_ms = ${Date.now() - started}, http_status = ${outcome.httpStatus}
           where id = ${runId}::uuid`);
      });
      return result;
    }

    result.fetched = outcome.items.length;
    result.quarantined = outcome.quarantined.length;
    await withSystem("ingest.store", async (tx) => {
      const { inserted, duplicates } = await storeItems(tx, source, outcome.items);
      result.inserted = inserted.length;
      result.duplicates = duplicates;
      const touched = await clusterItems(tx, inserted);
      result.clustered = touched.size;
      for (const storyId of touched) await refreshStory(tx, storyId);
      await tx.execute(sql`
        update sources set last_success_at = now(), consecutive_failures = 0, health_status = ${answeredHealth(source.sourceType, outcome.newestAt ?? null)}, last_error = null, leased_until = null,
                           next_poll_at = now() + make_interval(secs => ${source.pollIntervalSeconds}),
                           etag = coalesce(${outcome.etag ?? null}, etag), last_modified = coalesce(${outcome.lastModified ?? null}, last_modified),
                           cursor = coalesce(${outcome.cursor ? JSON.stringify(outcome.cursor) : null}::jsonb, cursor),
                           newest_item_at = greatest(newest_item_at, ${outcome.newestAt ?? null}::timestamptz),
                           updated_at = now()
         where id = ${source.id}::uuid`);
      await tx.execute(sql`
        update ingestion_runs set status = ${outcome.quarantined.length > 0 ? "partial" : "ok"}, finished_at = now(), duration_ms = ${Date.now() - started},
                                  http_status = ${outcome.httpStatus}, fetched = ${result.fetched}, inserted = ${result.inserted},
                                  duplicates = ${result.duplicates}, quarantined = ${result.quarantined}, clustered = ${result.clustered}
         where id = ${runId}::uuid`);
    });
    return result;
  } catch (error) {
    // Only our own messages are stored. Anything else is named by its kind: a stack or a body is not a log line.
    const message = error instanceof SourceError ? error.message : `Unexpected ${error instanceof Error ? error.name : "error"}.`;
    const throttled = error instanceof SourceError && error.throttled;
    const failures = source.consecutiveFailures + 1;
    result.status = "failed";
    result.error = message;
    await withSystem("ingest.failed", async (tx) => {
      await tx.execute(sql`
        update sources set consecutive_failures = ${failures}, last_error_at = now(), last_error = ${message}, leased_until = null,
                           health_status = ${failures >= 3 ? "failing" : "degraded"},
                           next_poll_at = now() + make_interval(secs => ${nextPollDelaySeconds(source, failures)}),
                           circuit_open_until = ${throttled ? sql`now() + interval '1 hour'` : sql`circuit_open_until`},
                           updated_at = now()
         where id = ${source.id}::uuid`);
      await tx.execute(sql`
        update ingestion_runs set status = 'failed', finished_at = now(), duration_ms = ${Date.now() - started},
                                  http_status = ${error instanceof SourceError ? error.httpStatus : null}, error = ${message}
         where id = ${runId}::uuid`);
    });
    return result;
  }
}

/* ------------------------------------------------------------------- tick */

/**
 * Lease the most urgent due source: enabled, due, not in a circuit-break, not
 * leased by an overlapping tick. FOR UPDATE SKIP LOCKED, so two ticks that run
 * at once take different sources instead of the same one twice.
 */
type LeasedRow = {
  id: string; key: string; name: string; provider: Provider; feed_url: string; canonical_domain: string; is_official: boolean;
  language: string; country_or_region: string; categories: string[]; etag: string | null; last_modified: string | null;
  cursor: Record<string, unknown>; config: Record<string, unknown>; poll_interval_seconds: number; consecutive_failures: number;
  excerpt_display_allowed: boolean; media_reuse_allowed: boolean; retention_days: number | null; source_type: string;
};
const LEASED_COLUMNS = sql`id, key, name, provider, feed_url, canonical_domain, is_official, language, country_or_region, categories, etag,
  last_modified, cursor, config, poll_interval_seconds, consecutive_failures, excerpt_display_allowed, media_reuse_allowed, retention_days, source_type`;

/** A source row as the adapters and the pipeline use it. */
function toSourceRow(row: LeasedRow): SourceRow {
  const contentType: ContentType = row.source_type === "official" ? "official_statement" : row.source_type === "research" ? "preprint" : "report";
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    provider: row.provider,
    feedUrl: row.feed_url,
    canonicalDomain: row.canonical_domain,
    isOfficial: row.is_official,
    contentType,
    language: row.language,
    countryOrRegion: row.country_or_region,
    categories: row.categories ?? [],
    etag: row.etag,
    lastModified: row.last_modified,
    cursor: row.cursor ?? {},
    config: row.config ?? {},
    pollIntervalSeconds: row.poll_interval_seconds,
    consecutiveFailures: row.consecutive_failures,
    excerptAllowed: row.excerpt_display_allowed,
    mediaAllowed: row.media_reuse_allowed,
    retentionDays: row.retention_days,
    sourceType: row.source_type,
  };
}

async function leaseNextDue(exclude: string[], providersOff: string[] = []): Promise<SourceRow | null> {
  const rows = await withSystem("ingest.lease", (tx) =>
    execRows<LeasedRow>(
      tx,
      sql`update sources set leased_until = now() + interval '3 minutes'
           where id = (
             select id from sources
              where enabled and rights_status = 'cleared' and next_poll_at <= now()
                and (leased_until is null or leased_until < now())
                and (circuit_open_until is null or circuit_open_until < now())
                and not (id = any(${uuidArray(exclude)}))
                and not (provider = any(${textArray(providersOff)}))
              order by priority, next_poll_at
              limit 1
              for update skip locked)
          returning ${LEASED_COLUMNS}`,
    ),
  );
  const row = rows[0];
  if (!row) return null;
  return toSourceRow(row);
}

/**
 * Stories whose scores decay with time but gained nothing this tick: heat's
 * recency term falls every hour, and a score last computed at noon is wrong by
 * evening. The hottest recent ones are re-scored within what is left of the
 * budget.
 */
async function rescoreRecent(deadline: number, skip: Set<string>): Promise<number> {
  const due = await withSystem("ingest.rescore-list", (tx) =>
    execRows<{ id: string }>(
      tx,
      sql`select id from stories where last_updated_at > now() - interval '48 hours' and (scored_at is null or scored_at < now() - interval '30 minutes')
           order by heat desc, last_updated_at desc limit 80`,
    ),
  );
  let done = 0;
  for (const { id } of due) {
    if (skip.has(id)) continue;
    if (Date.now() > deadline) break;
    await withSystem("ingest.rescore", (tx) => refreshStory(tx, id));
    done++;
  }
  return done;
}

export type TickSummary = { sources: RunResult[]; rescored: number; catalogue: number; paused?: string[]; [key: string]: unknown };

/**
 * One tick of the scheduler. Reads due sources until the budget is spent;
 * what it does not reach is still due and is reached next tick. Recorded in
 * job_runs as "tick" whatever happens, so a scheduler that stopped calling is
 * visible as a gap.
 */
export async function runTick({ trigger, budgetMs = 50_000, fetchFn = fetch }: { trigger: string; budgetMs?: number; fetchFn?: FetchFn }) {
  return recordedJob<TickSummary>("tick", trigger, async () => {
    const deadline = Date.now() + budgetMs;
    const catalogue = await withSystem("ingest.sync", (tx) => syncCatalogue(tx));
    // Switches from the press room. Off is recorded in the run, so a paused paper is never mistaken for a quiet news day.
    const off = await switchesOff();
    const paused = [...off].filter((key) => key === "ingestion" || key.startsWith("provider:"));
    if (off.has("ingestion")) return { catalogue, sources: [], rescored: 0, paused };
    const providersOff = paused.filter((key) => key.startsWith("provider:")).map((key) => key.slice("provider:".length));
    const results: RunResult[] = [];
    const seen: string[] = [];
    while (Date.now() < deadline - 6_000) {
      const source = await leaseNextDue(seen, providersOff);
      if (!source) break;
      seen.push(source.id);
      results.push(await runSource(source, trigger, deadline - 3_000, fetchFn));
    }
    const rescored = await rescoreRecent(deadline - 1_000, new Set());
    return { catalogue, sources: results, rescored, paused };
  });
}

export type DryRun = { status: "ok" | "not_modified" | "failed"; fetched: number; quarantined: number; sample: string[]; error: string | null; ms: number };

/**
 * Read one source the way a tick would, and store nothing: no items, no
 * cursor, no health. For an administrator checking a feed before switching it
 * on, or after it started failing. Conditional headers are left off so the
 * answer is the feed as it is, not "not modified since last time".
 */
export async function dryRunSource(sourceId: string, fetchFn: FetchFn = fetch): Promise<DryRun> {
  const started = Date.now();
  const row = (await withSystem("ingest.dry-run", (tx) => execRows<LeasedRow>(tx, sql`select ${LEASED_COLUMNS} from sources where id = ${sourceId}::uuid`)))[0];
  if (!row) return { status: "failed", fetched: 0, quarantined: 0, sample: [], error: "No such source.", ms: 0 };
  const source = { ...toSourceRow(row), etag: null, lastModified: null };
  const adapter = ADAPTERS[source.provider];
  if (!adapter) return { status: "failed", fetched: 0, quarantined: 0, sample: [], error: "No adapter for this provider.", ms: 0 };
  try {
    const outcome = await adapter.read(source, { fetch: fetchFn, deadline: Date.now() + 20_000 });
    if (outcome.status === "not_modified") return { status: "not_modified", fetched: 0, quarantined: 0, sample: [], error: null, ms: Date.now() - started };
    return { status: "ok", fetched: outcome.items.length, quarantined: outcome.quarantined.length, sample: outcome.items.slice(0, 3).map((item) => item.title), error: null, ms: Date.now() - started };
  } catch (error) {
    return { status: "failed", fetched: 0, quarantined: 0, sample: [], error: error instanceof SourceError ? error.message : "The read failed.", ms: Date.now() - started };
  }
}
