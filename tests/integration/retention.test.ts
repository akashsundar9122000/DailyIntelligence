import pg from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closeDb } from "@/lib/db/client";
import { runRetention } from "@/lib/services/retention";
import { toggleBookmark } from "@/lib/services/reader";

import { createVerifiedUser } from "./auth-helpers";

/* The retention purge, read back from the tables. Every headline is invented test text. */

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

async function source(retentionDays: number | null) {
  return (
    await ownerQuery<{ id: string }>(
      `insert into sources (id, key, name, canonical_domain, source_type, provider, feed_url, country_or_region, rights_status, headline_display_allowed, enabled, retention_days)
       values (gen_random_uuid(), 'retention-' || gen_random_uuid(), 'Retention Test', 'retention.example', 'publisher', 'rss', 'https://retention.example/feed', 'IN', 'cleared', true, false, $1) returning id`,
      [retentionDays],
    )
  )[0]!.id;
}

/** A story of items ingested `ages` days ago, the first being its headline. */
async function story(sourceId: string, ages: number[], lastUpdatedDaysAgo = 0) {
  const items: string[] = [];
  for (const [n, age] of ages.entries()) {
    items.push(
      (
        await ownerQuery<{ id: string }>(
          `insert into raw_source_items (id, source_id, provider_item_id, canonical_url, url_hash, publisher_domain, title, normalized_title, ingested_at)
           values (gen_random_uuid(), $1, gen_random_uuid()::text, 'https://retention.example/' || gen_random_uuid(), md5(random()::text), 'retention.example', $2, lower($2), now() - make_interval(days => $3)) returning id`,
          [sourceId, `Harbour strike report ${n + 1}`, age],
        )
      )[0]!.id,
    );
  }
  const id = (
    await ownerQuery<{ id: string }>(
      `insert into stories (id, headline, headline_item_id, signature, last_updated_at) values (gen_random_uuid(), 'Harbour strike report 1', $1, 'harbour strike', now() - make_interval(days => $2)) returning id`,
      [items[0], lastUpdatedDaysAgo],
    )
  )[0]!.id;
  for (const [n, item] of items.entries()) {
    await ownerQuery(`insert into story_items (id, story_id, item_id, association_confidence, method, associated_at) values (gen_random_uuid(), $1, $2, 90, 'title', now() - make_interval(days => $3))`, [id, item, ages[n]]);
  }
  return { id, items };
}

beforeEach(async () => {
  await ownerQuery("truncate sources, raw_source_items, stories, story_items, ai_briefings, ingestion_runs, notification_events cascade");
});

describe("the retention purge", () => {
  it("removes items past their source's retention, and a story left with none", async () => {
    const thirty = await source(30);
    const old = await story(thirty, [40, 35]);
    const fresh = await story(thirty, [3]);
    const { detail } = await runRetention({ trigger: "test" });
    expect(detail).toMatchObject({ items: 2, stories: 1 });
    expect(await ownerQuery("select id from stories order by id")).toEqual([{ id: fresh.id }]);
    expect(await ownerQuery("select 1 from raw_source_items where id = any($1)", [old.items])).toEqual([]);
  });

  it("gives a story whose headline item went the headline of the earliest item it still has", async () => {
    const thirty = await source(30);
    const { id, items } = await story(thirty, [40, 5, 2]);
    await runRetention({ trigger: "test" });
    expect((await ownerQuery("select headline_item_id, headline from stories where id = $1", [id]))[0]).toEqual({ headline_item_id: items[1], headline: "Harbour strike report 2" });
  });

  it("never purges a story a reader saved, nor the item its headline came from", async () => {
    const thirty = await source(30);
    const { id, items } = await story(thirty, [40, 35]);
    const reader = await createVerifiedUser();
    await toggleBookmark(reader.userId, id);
    await runRetention({ trigger: "test" });
    expect(await ownerQuery("select story_id from bookmarks where user_id = $1", [reader.userId])).toEqual([{ story_id: id }]);
    expect(await ownerQuery("select id from raw_source_items where id = $1", [items[0]])).toEqual([{ id: items[0] }]);
    // The other item was past retention and is not the headline: it goes.
    expect(await ownerQuery("select 1 from raw_source_items where id = $1", [items[1]])).toEqual([]);
  });

  it("keeps a source with no retention of its own until its story has been still for ninety days", async () => {
    const unlimited = await source(null);
    const active = await story(unlimited, [200], 10);
    const closed = await story(unlimited, [200], 100);
    await runRetention({ trigger: "test" });
    expect(await ownerQuery("select id from stories")).toEqual([{ id: active.id }]);
    expect(closed.id).not.toBe(active.id);
  });
});
