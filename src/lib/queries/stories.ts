import "server-only";

import { sql, type SQL } from "drizzle-orm";
import { cache } from "react";

import { DatabaseNotConfigured } from "@/lib/db/client";
import { execRows, withPublic } from "@/lib/db/scope";
import { isoInstant, showableSource, textArray, uuidArray } from "@/lib/db/sql";
import type { ContentType, StoryScope, StoryState } from "@/lib/db/schema/news";

/**
 * Every read of stories for a reader. One shape (StoryCard), one join, one
 * rights predicate: a story appears only through its headline item, and only
 * while that item's source may be shown (showableSource). A source withdrawn
 * by an administrator takes its stories off every page on the next request.
 */

export type StoryCard = {
  id: string;
  headline: string;
  /** The headline item: whose words the headline is, and where to read the original. */
  publisher: string;
  publisherDomain: string;
  /** The catalogue key of the source the headline came from, so a followed or muted source can be matched. */
  sourceKey: string;
  url: string;
  contentType: ContentType;
  isOfficial: boolean;
  /** Only when the headline source's terms allow an excerpt; otherwise null. */
  excerpt: string | null;
  category: string | null;
  categories: string[];
  scope: StoryScope;
  states: string[];
  countries: string[];
  sourceCount: number;
  itemCount: number;
  officialCount: number;
  heat: number;
  confidence: number;
  importance: number;
  state: StoryState;
  /** Instants as ISO strings. publishedAt is null when no source gave one. */
  publishedAt: string | null;
  firstSeenAt: string;
  lastUpdatedAt: string;
  /** "rising" when heat has climbed since an earlier scoring, "cooling" when it has fallen; "steady" otherwise. */
  direction: "rising" | "steady" | "cooling";
};

const CARD_COLUMNS = sql`
  st.id, i.title as headline, coalesce(i.publisher_name, i.publisher_domain) as publisher, i.publisher_domain as "publisherDomain",
  src.key as "sourceKey", i.canonical_url as url, i.content_type as "contentType", src.is_official as "isOfficial",
  case when src.excerpt_display_allowed then i.excerpt else null end as excerpt,
  st.primary_category as category, st.categories, st.scope, st.indian_states as states, st.event_countries as countries,
  st.source_count as "sourceCount", st.item_count as "itemCount", st.official_count as "officialCount",
  st.heat, st.confidence, st.importance, st.state,
  ${isoInstant(sql`coalesce(st.first_published_at, i.published_at)`)} as "publishedAt",
  ${isoInstant(sql`st.first_seen_at`)} as "firstSeenAt", ${isoInstant(sql`st.last_updated_at`)} as "lastUpdatedAt",
  case
    when prev.heat is null then 'steady'
    when st.heat >= prev.heat + 8 then 'rising'
    when st.heat <= prev.heat - 8 then 'cooling'
    else 'steady' end as direction`;

/** Stories, their headline item and its source, and the score from two to six hours ago for the direction marker. */
const FROM = sql`
  from stories st
  join raw_source_items i on i.id = st.headline_item_id
  join sources src on src.id = i.source_id
  left join lateral (
    select ss.heat from story_scores ss
     where ss.story_id = st.id and ss.calculated_at < now() - interval '2 hours' and ss.calculated_at > now() - interval '6 hours'
     order by ss.calculated_at desc limit 1
  ) prev on true`;

export type StoryFilter = {
  scope?: "india" | "global";
  category?: string;
  state?: string;
  /** ISO country codes: a story matches if its event touched any of them. */
  countries?: string[];
  /** Only stories with at least this many independent publishers. */
  minSources?: number;
  /** Only stories updated within this many hours. */
  withinHours?: number;
  rising?: boolean;
};

function where(filter: StoryFilter): SQL {
  const parts: SQL[] = [showableSource(), sql`not i.quarantined`, sql`st.last_updated_at > now() - make_interval(hours => ${filter.withinHours ?? 48})`];
  if (filter.scope) parts.push(sql`st.scope = ${filter.scope}`);
  if (filter.category) parts.push(sql`st.categories @> ${textArray([filter.category])}`);
  if (filter.state) parts.push(sql`st.indian_states @> ${textArray([filter.state])}`);
  if (filter.countries?.length) parts.push(sql`st.event_countries && ${textArray(filter.countries)}`);
  if (filter.minSources) parts.push(sql`st.source_count >= ${filter.minSources}`);
  return sql.join(parts, sql` and `);
}

async function read(query: SQL): Promise<StoryCard[]> {
  try {
    return await withPublic((tx) => execRows<StoryCard>(tx, query));
  } catch (error) {
    // No database is a state the page explains, not an error page.
    if (error instanceof DatabaseNotConfigured) return [];
    throw error;
  }
}

/** The day's front page: importance first, then heat, then recency. The same for every reader. */
export const frontPage = cache(async (filter: StoryFilter = {}, limit = 30) =>
  read(sql`select ${CARD_COLUMNS} ${FROM} where ${where({ withinHours: 36, ...filter })}
           order by st.importance desc, st.heat desc, st.last_updated_at desc limit ${limit}`),
);

/** Hot Now: by heat, as clusters. Confidence is returned beside it and never folded in. */
export const hotStories = cache(async (filter: StoryFilter = {}, limit = 40) => {
  const rows = await read(sql`select ${CARD_COLUMNS} ${FROM} where ${where({ withinHours: 24, ...filter })}
                               order by st.heat desc, st.last_updated_at desc limit ${limit * 2}`);
  return (filter.rising ? rows.filter((row) => row.direction === "rising") : rows).slice(0, limit);
});

/** Newest first, by when the story last gained evidence. Keyset paging on (last_updated_at, id) so pages never repeat or skip. */
export const latestStories = cache(async (filter: StoryFilter = {}, limit = 30, before?: { at: string; id: string }) =>
  read(sql`select ${CARD_COLUMNS} ${FROM} where ${where(filter)}
           ${before ? sql`and (st.last_updated_at, st.id) < (${before.at}::timestamptz, ${before.id}::uuid)` : sql``}
           order by st.last_updated_at desc, st.id desc limit ${limit}`),
);

/** A pool for personal ranking: recent stories, broad enough to rank and to leave room for discovery. */
export const candidateStories = cache(async (filter: StoryFilter = {}, limit = 300) =>
  read(sql`select ${CARD_COLUMNS} ${FROM} where ${where({ withinHours: 48, ...filter })}
           order by st.last_updated_at desc limit ${limit}`),
);

export const storiesByIds = async (ids: string[]) =>
  ids.length === 0 ? [] : read(sql`select ${CARD_COLUMNS} ${FROM} where st.id = any(${uuidArray(ids)}) and ${showableSource()}`);

/* ----------------------------------------------------------------- detail */

export type StorySource = {
  itemId: string;
  title: string;
  publisher: string;
  publisherDomain: string;
  url: string;
  contentType: ContentType;
  isOfficial: boolean;
  sourceName: string;
  attribution: string;
  excerpt: string | null;
  publishedAt: string | null;
  ingestedAt: string;
  method: string;
  associationConfidence: number;
};

export type StoryScore = {
  version: string;
  heat: number;
  heatComponents: Record<string, number>;
  confidence: number;
  confidenceComponents: Record<string, number>;
  importance: number;
  importanceComponents: Record<string, number>;
  calculatedAt: string;
};

export type StoryDetail = { story: StoryCard; sources: StorySource[]; score: StoryScore | null; history: { heat: number; confidence: number; at: string }[] };

/**
 * A story with every item that may be shown, newest evidence first, and the
 * score that explains its heat and confidence. Null for a story that does not
 * exist or cannot be shown: the page answers 404 either way.
 */
export const storyDetail = cache(async (id: string): Promise<StoryDetail | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    return await withPublic(async (tx) => {
      const story = (await execRows<StoryCard>(tx, sql`select ${CARD_COLUMNS} ${FROM} where st.id = ${id}::uuid and ${showableSource()}`))[0];
      if (!story) return null;
      const sources = await execRows<StorySource>(
        tx,
        sql`select i.id as "itemId", i.title, coalesce(i.publisher_name, i.publisher_domain) as publisher, i.publisher_domain as "publisherDomain",
                   i.canonical_url as url, i.content_type as "contentType", src.is_official as "isOfficial", src.name as "sourceName",
                   src.attribution_text as attribution, case when src.excerpt_display_allowed then i.excerpt else null end as excerpt,
                   ${isoInstant(sql`i.published_at`)} as "publishedAt", ${isoInstant(sql`i.ingested_at`)} as "ingestedAt",
                   si.method, si.association_confidence as "associationConfidence"
              from story_items si
              join raw_source_items i on i.id = si.item_id
              join sources src on src.id = i.source_id
             where si.story_id = ${id}::uuid and ${showableSource()} and not i.quarantined
             order by coalesce(i.published_at, i.ingested_at) desc
             limit 60`,
      );
      const score = (
        await execRows<StoryScore>(
          tx,
          sql`select version, heat, heat_components as "heatComponents", confidence, confidence_components as "confidenceComponents",
                     importance, importance_components as "importanceComponents", ${isoInstant(sql`calculated_at`)} as "calculatedAt"
                from story_scores where story_id = ${id}::uuid order by calculated_at desc limit 1`,
        )
      )[0] ?? null;
      const history = await execRows<{ heat: number; confidence: number; at: string }>(
        tx,
        sql`select heat, confidence, ${isoInstant(sql`calculated_at`)} as at from story_scores
             where story_id = ${id}::uuid and calculated_at > now() - interval '48 hours' order by calculated_at limit 200`,
      );
      return { story, sources, score, history };
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfigured) return null;
    throw error;
  }
});

/** Stories that share this one's section and at least one place, most recent first. */
export const relatedStories = cache(async (story: StoryCard, limit = 5) => {
  if (!story.category) return [];
  return read(sql`select ${CARD_COLUMNS} ${FROM}
                  where ${where({ withinHours: 96 })} and st.id <> ${story.id}::uuid and st.categories @> ${textArray([story.category])}
                    ${story.countries.length ? sql`and st.event_countries && ${textArray(story.countries)}` : sql``}
                  order by st.importance desc, st.last_updated_at desc limit ${limit}`);
});

/* ----------------------------------------------------------------- search */

export type SearchFilter = StoryFilter & { query: string };

/**
 * Full-text search over story headlines and every item title (so a story is
 * found by any of its publishers' wording), ranked by relevance and then
 * recency. Postgres websearch syntax: quotes for phrases, "-" to exclude.
 */
export async function searchStories(filter: SearchFilter, limit = 40): Promise<StoryCard[]> {
  const query = filter.query.trim().slice(0, 200);
  if (query.length < 2) return [];
  return read(sql`
    with q as (select websearch_to_tsquery('english', ${query}) as tsq),
    matched as (
      select si.story_id, max(ts_rank(r.search, q.tsq)) as rank
        from raw_source_items r join story_items si on si.item_id = r.id, q
       where r.search @@ q.tsq
       group by si.story_id
      union all
      select st2.id, ts_rank(st2.search, q.tsq) * 1.2 from stories st2, q where st2.search @@ q.tsq
    ),
    best as (select story_id, max(rank) as rank from matched group by story_id)
    select ${CARD_COLUMNS} ${FROM} join best on best.story_id = st.id
     where ${where({ withinHours: 24 * 30, ...filter })}
     order by best.rank desc, st.last_updated_at desc limit ${limit}`);
}

export type SourceDirectoryRow = { key: string; domain: string; name: string; sourceType: string; isOfficial: boolean; stories: number };

/** Sources a reader may follow or mute, with how many recent stories each has given. */
export async function searchableSources(): Promise<SourceDirectoryRow[]> {
  try {
    return await withPublic((tx) =>
      execRows<SourceDirectoryRow>(
        tx,
        sql`select src.key, src.canonical_domain as domain, src.name, src.source_type as "sourceType", src.is_official as "isOfficial",
                   (select count(distinct si.story_id)::int from raw_source_items r join story_items si on si.item_id = r.id
                     where r.source_id = src.id and r.ingested_at > now() - interval '7 days') as stories
              from sources src where ${showableSource()} and src.enabled order by src.priority, src.name`,
      ),
    );
  } catch (error) {
    if (error instanceof DatabaseNotConfigured) return [];
    throw error;
  }
}

/** How many showable stories each Indian state, each event country, and each section has in the window. For the filter chips. */
export const editionCounts = cache(async (withinHours = 48) => {
  try {
    return await withPublic(async (tx) => {
      const states = await execRows<{ code: string; n: number }>(
        tx,
        sql`select s as code, count(*)::int as n from stories st join raw_source_items i on i.id = st.headline_item_id join sources src on src.id = i.source_id,
                   unnest(st.indian_states) as s
             where ${showableSource()} and st.last_updated_at > now() - make_interval(hours => ${withinHours}) group by s`,
      );
      const countries = await execRows<{ code: string; n: number }>(
        tx,
        sql`select c as code, count(*)::int as n from stories st join raw_source_items i on i.id = st.headline_item_id join sources src on src.id = i.source_id,
                   unnest(st.event_countries) as c
             where ${showableSource()} and st.last_updated_at > now() - make_interval(hours => ${withinHours}) group by c`,
      );
      const categories = await execRows<{ code: string; n: number }>(
        tx,
        sql`select c as code, count(*)::int as n from stories st join raw_source_items i on i.id = st.headline_item_id join sources src on src.id = i.source_id,
                   unnest(st.categories) as c
             where ${showableSource()} and st.last_updated_at > now() - make_interval(hours => ${withinHours}) group by c`,
      );
      const toMap = (rows: { code: string; n: number }[]) => new Map(rows.map((row) => [row.code, row.n]));
      return { states: toMap(states), countries: toMap(countries), categories: toMap(categories) };
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfigured) return { states: new Map<string, number>(), countries: new Map<string, number>(), categories: new Map<string, number>() };
    throw error;
  }
});
