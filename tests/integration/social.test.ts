import pg from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closeDb } from "@/lib/db/client";
import { runTick } from "@/lib/ingestion/pipeline";
import { refreshStory } from "@/lib/ingestion/pipeline";
import { withSystem } from "@/lib/db/scope";

/*
 * Social posts from recorded Mastodon answers. Every post and headline here is
 * invented test text; none of it is news, and no real account is named.
 */

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

const now = () => new Date().toISOString();
let counter = 100;
/** A Mastodon status as the API gives it, eligible unless told otherwise. */
function status(overrides: Record<string, unknown> = {}, account: Record<string, unknown> = {}) {
  counter += 1;
  return {
    id: String(counter),
    url: `https://mastodon.social/@reader${counter}/${counter}`,
    created_at: now(),
    visibility: "public",
    language: "en",
    sensitive: false,
    spoiler_text: "",
    content: "<p>Monsoon reaches the southern districts two days early, says the weather office. <a href='x'>#climate</a></p>",
    reblog: null,
    replies_count: 2,
    reblogs_count: 5,
    favourites_count: 9,
    tags: [{ name: "climate" }],
    account: { acct: `reader${counter}`, username: `reader${counter}`, display_name: "A Reader", url: `https://mastodon.social/@reader${counter}`, bot: false, discoverable: true, indexable: true, ...account },
    ...overrides,
  };
}

/** Recorded answers by URL prefix; GDELT and the feeds answer 404, which the tick records and moves past. */
function fakeMastodon(timeline: unknown[], { deleted = new Set<string>() } = {}) {
  const calls: string[] = [];
  const fetchFn = async (input: string) => {
    calls.push(input);
    if (input.startsWith("https://mastodon.social/api/v1/timelines/tag/climate")) return Response.json(timeline);
    if (input.startsWith("https://mastodon.social/api/v1/timelines/tag/")) return Response.json([]);
    const one = /\/api\/v1\/statuses\/(\d+)$/.exec(input);
    if (one) return deleted.has(one[1]!) ? new Response("", { status: 404 }) : Response.json(timeline.find((post) => (post as { id: string }).id === one[1]) ?? status({ id: one[1] }));
    return new Response("", { status: 404 });
  };
  return { fetchFn, calls };
}

async function storyAbout(headline: string, categories: string[] = []) {
  const source = (
    await ownerQuery<{ id: string }>(
      `insert into sources (id, key, name, canonical_domain, source_type, provider, feed_url, country_or_region, rights_status, headline_display_allowed, enabled)
       values (gen_random_uuid(), 'social-test-' || gen_random_uuid(), 'Social Test', 'social.example', 'publisher', 'rss', 'https://social.example/feed', 'IN', 'cleared', true, false) returning id`,
    )
  )[0]!.id;
  const item = (
    await ownerQuery<{ id: string }>(
      `insert into raw_source_items (id, source_id, provider_item_id, canonical_url, url_hash, publisher_domain, title, normalized_title, categories)
       values (gen_random_uuid(), $1, 'one', 'https://social.example/one', md5(random()::text), 'social.example', $2, lower($2), $3) returning id`,
      [source, headline, categories],
    )
  )[0]!.id;
  const { titleSignature } = await import("@/lib/ingestion/normalize");
  const story = (
    await ownerQuery<{ id: string }>(
      `insert into stories (id, headline, headline_item_id, signature, last_updated_at) values (gen_random_uuid(), $1, $2, $3, now()) returning id`,
      [headline, item, titleSignature(headline)],
    )
  )[0]!.id;
  await ownerQuery(`insert into story_items (id, story_id, item_id, association_confidence, method) values (gen_random_uuid(), $1, $2, 100, 'new')`, [story, item]);
  return story;
}

beforeEach(async () => {
  await ownerQuery("truncate sources, raw_source_items, stories, story_items, story_scores, social_posts, ingestion_runs, job_runs, ops_switches cascade");
});

describe("public posts from Mastodon", () => {
  it("keeps only public posts from local, discoverable, indexable, human accounts with no content warning", async () => {
    const kept = status();
    const timeline = [
      kept,
      status({ visibility: "unlisted" }),
      status({}, { acct: "someone@another.example" }),
      status({}, { bot: true }),
      status({ reblog: { id: "1" } }),
      status({ sensitive: true, spoiler_text: "spoilers" }),
      status({}, { discoverable: false }),
      status({}, { indexable: false }),
    ];
    const { detail } = await runTick({ trigger: "test", budgetMs: 30_000, fetchFn: fakeMastodon(timeline).fetchFn });
    expect(detail.sources.find((run) => run.source === "mastodon-social")).toMatchObject({ status: "ok", fetched: 1, inserted: 1, quarantined: 7 });
    const rows = await ownerQuery<{ external_id: string; embed_url: string; author_handle: string }>("select external_id, embed_url, author_handle from social_posts");
    expect(rows).toEqual([{ external_id: kept.id, embed_url: `${kept.url}/embed`, author_handle: `@${kept.account.acct}@mastodon.social` }]);
  });

  it("never stores the post's text, only the words that match it to a story", async () => {
    await runTick({ trigger: "test", budgetMs: 30_000, fetchFn: fakeMastodon([status()]).fetchFn });
    const columns = await ownerQuery<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'social_posts'");
    expect(columns.map((column) => column.column_name)).not.toContain("text");
    expect(columns.map((column) => column.column_name)).not.toContain("content");
    const row = (await ownerQuery<{ tokens: string[] }>("select tokens from social_posts"))[0]!;
    expect(row.tokens).toContain("monsoon");
    expect(row.tokens.join(" ")).not.toContain("weather office says");
  });

  it("attaches a post to the story it is about, and the conversation feeds heat, never confidence", async () => {
    const story = await storyAbout("Monsoon reaches the southern districts two days early");
    await runTick({ trigger: "test", budgetMs: 30_000, fetchFn: fakeMastodon([status(), status(), status()]).fetchFn });
    expect((await ownerQuery("select 1 from social_posts where story_id = $1", [story])).length).toBe(3);
    const score = (
      await ownerQuery<{ heat_components: { engagement: number }; confidence_components: Record<string, number> }>(
        "select heat_components, confidence_components from story_scores where story_id = $1 order by calculated_at desc limit 1",
        [story],
      )
    )[0]!;
    expect(score.heat_components.engagement).toBeGreaterThan(0);
    // Confidence has no social input at all: its components are the same three, in any order jsonb keeps them.
    expect(Object.keys(score.confidence_components).sort()).toEqual(["independent", "primary", "settled"]);
  });

  it("removes a post at its next check once its author has deleted it", async () => {
    const post = status();
    await runTick({ trigger: "test", budgetMs: 30_000, fetchFn: fakeMastodon([post]).fetchFn });
    await ownerQuery("update social_posts set checked_at = now() - interval '7 hours'");
    await ownerQuery("update sources set next_poll_at = now() where key = 'mastodon-social'");
    await runTick({ trigger: "test", budgetMs: 30_000, fetchFn: fakeMastodon([], { deleted: new Set([post.id]) }).fetchFn });
    expect(await ownerQuery("select 1 from social_posts")).toEqual([]);
  });
});

describe("a story's sections", () => {
  it("keep a section the model chose when a refresh finds none in the items, and give way to the rules' when they find one", async () => {
    const story = await storyAbout("Monsoon reaches the southern districts two days early");
    await ownerQuery("update stories set categories = '{climate}', primary_category = 'climate', categories_by = 'ai' where id = $1", [story]);
    await withSystem("test.refresh", (tx) => refreshStory(tx, story));
    expect((await ownerQuery("select categories, categories_by from stories where id = $1", [story]))[0]).toEqual({ categories: ["climate"], categories_by: "ai" });
    await ownerQuery("update raw_source_items set categories = '{science}'");
    await withSystem("test.refresh", (tx) => refreshStory(tx, story));
    expect((await ownerQuery("select categories, categories_by from stories where id = $1", [story]))[0]).toEqual({ categories: ["science"], categories_by: "rules" });
  });
});
