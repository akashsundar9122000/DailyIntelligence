import "server-only";

import { createHash } from "node:crypto";

import { sql } from "drizzle-orm";

import { execRows, type Tx } from "@/lib/db/scope";
import { isoInstant, showableSource } from "@/lib/db/sql";

import { recordLine, type BundleRecord, type StoryBundle } from "./explainer";

/** More than this and the model is summarising syndication, not adding reporting. */
const MAX_RECORDS = 12;

/**
 * A story's source bundle: what the model may read about it.
 *
 * The same display rule as every page (`showableSource`): a withdrawn source is
 * withdrawn from the model too. And a narrower rule for text: an excerpt goes
 * in only where the source permits both showing it and summarising it with AI.
 * From GDELT that is never -- the model sees the headline, the publisher and
 * the times, which are what the page already shows.
 *
 * Takes the open transaction rather than opening one: the enrichment job reads
 * in system scope, the reader's question in public scope, and scopes never nest.
 */
export async function loadBundle(tx: Tx, storyId: string): Promise<StoryBundle | null> {
  const story = (
    await execRows<{ headline: string; categories: string[] }>(
      tx,
      sql`select st.headline, st.categories from stories st
           join raw_source_items i on i.id = st.headline_item_id join sources src on src.id = i.source_id
          where st.id = ${storyId}::uuid and ${showableSource()}`,
    )
  )[0];
  if (!story) return null;
  const rows = await execRows<Omit<BundleRecord, "ref" | "text" | "official">>(
    tx,
    sql`select i.id as "itemId", coalesce(i.publisher_name, i.publisher_domain) as publisher, i.content_type as "contentType", i.title as headline,
               case when src.excerpt_display_allowed and src.ai_summary_allowed then i.excerpt else null end as excerpt,
               ${isoInstant(sql`i.published_at`)} as "publishedAt"
          from story_items si
          join raw_source_items i on i.id = si.item_id
          join sources src on src.id = i.source_id
         where si.story_id = ${storyId}::uuid and ${showableSource()} and not i.quarantined
         -- Officials first (they are primary), then one item per publisher, earliest first: the bundle is coverage, not repetition.
         order by (i.content_type = 'official_statement') desc, coalesce(i.published_at, i.ingested_at)
         limit 60`,
  );
  const seen = new Set<string>();
  const records: BundleRecord[] = [];
  for (const row of rows) {
    if (seen.has(row.publisher) || records.length >= MAX_RECORDS) continue;
    seen.add(row.publisher);
    records.push({ ...row, ref: `S${records.length + 1}`, text: recordLine(row), official: row.contentType === "official_statement" });
  }
  return { storyId, headline: story.headline, categories: story.categories, records };
}

/** The ids an explainer was written from, sorted: the same records give the same hash, a new record a new one. */
export function bundleHash(bundle: StoryBundle): string {
  const ids = bundle.records.map((record) => record.itemId).sort();
  return createHash("sha256").update(ids.join(",")).digest("hex").slice(0, 32);
}
