import pg from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closeDb } from "@/lib/db/client";
import { runTick } from "@/lib/ingestion/pipeline";

/*
 * YouTube from recorded API answers. A placeholder key, set before anything
 * reads the environment (each test file has its own module registry): the
 * suite blanks the real one, so no test ever spends its quota.
 */
const PLACEHOLDER_KEY = "placeholder-key-for-tests";
process.env.YOUTUBE_API_KEY = PLACEHOLDER_KEY;

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

async function storyAbout(headline: string) {
  const source = (
    await ownerQuery<{ id: string }>(
      `insert into sources (id, key, name, canonical_domain, source_type, provider, feed_url, country_or_region, rights_status, headline_display_allowed, enabled)
       values (gen_random_uuid(), 'yt-test-' || gen_random_uuid(), 'YouTube Test', 'yt.example', 'publisher', 'rss', 'https://yt.example/feed', 'IN', 'cleared', true, false) returning id`,
    )
  )[0]!.id;
  const item = (
    await ownerQuery<{ id: string }>(
      `insert into raw_source_items (id, source_id, provider_item_id, canonical_url, url_hash, publisher_domain, title, normalized_title)
       values (gen_random_uuid(), $1, 'one', 'https://yt.example/one', md5(random()::text), 'yt.example', $2, lower($2)) returning id`,
      [source, headline],
    )
  )[0]!.id;
  const { titleSignature } = await import("@/lib/ingestion/normalize");
  const story = (
    await ownerQuery<{ id: string }>(`insert into stories (id, headline, headline_item_id, signature, last_updated_at) values (gen_random_uuid(), $1, $2, $3, now()) returning id`, [headline, item, titleSignature(headline)])
  )[0]!.id;
  await ownerQuery(`insert into story_items (id, story_id, item_id, association_confidence, method) values (gen_random_uuid(), $1, $2, 100, 'new')`, [story, item]);
  return story;
}

beforeEach(async () => {
  await ownerQuery("truncate sources, raw_source_items, stories, story_items, story_scores, social_posts, ingestion_runs, job_runs, ops_switches cascade");
});

describe("videos from official channels on YouTube", () => {
  const video = (id: string, title: string, status: { privacyStatus?: string; embeddable?: boolean } = {}) => ({
    id,
    snippet: { publishedAt: now(), channelId: "UCLA_DiR1FfKNvjuUpBHmylQ", channelTitle: "An Official Channel", title, description: "Invented test description." },
    status: { privacyStatus: status.privacyStatus ?? "public", embeddable: status.embeddable ?? true },
  });
  function fakeYouTube(found: unknown[], { playlistStatus = 200 } = {}) {
    const calls: string[] = [];
    const fetchFn = async (input: string) => {
      calls.push(input);
      if (input.startsWith("https://www.googleapis.com/youtube/v3/playlistItems")) {
        return playlistStatus === 200 ? Response.json({ items: (found as { id: string }[]).map((entry) => ({ contentDetails: { videoId: entry.id } })) }) : new Response("{}", { status: playlistStatus });
      }
      if (input.startsWith("https://www.googleapis.com/youtube/v3/videos")) return Response.json({ items: found });
      return new Response("", { status: 404 });
    };
    return { fetchFn, calls };
  }

  it("keeps public, embeddable videos only, as YouTube's player, with no statistics", async () => {
    const found = [video("vid-public-1", "Monsoon reaches the southern districts two days early"), video("vid-private", "Private briefing", { privacyStatus: "private" }), video("vid-noembed", "Not embeddable", { embeddable: false })];
    const { detail } = await runTick({ trigger: "test", budgetMs: 30_000, fetchFn: fakeYouTube(found).fetchFn });
    expect(detail.sources.find((run) => run.source === "youtube-official")).toMatchObject({ status: "ok", inserted: 1, quarantined: 2 });
    expect(await ownerQuery("select external_id, embed_url, replies, reposts, likes from social_posts where platform = 'youtube'")).toEqual([
      { external_id: "vid-public-1", embed_url: "https://www.youtube-nocookie.com/embed/vid-public-1", replies: 0, reposts: 0, likes: 0 },
    ]);
  });

  it("never moves a story's heat: its policies forbid deriving measures from its data", async () => {
    const story = await storyAbout("Monsoon reaches the southern districts two days early");
    await runTick({ trigger: "test", budgetMs: 30_000, fetchFn: fakeYouTube([video("vid-a", "Monsoon reaches the southern districts two days early, says the weather office")]).fetchFn });
    expect(await ownerQuery("select 1 from social_posts where story_id = $1 and platform = 'youtube'", [story])).toHaveLength(1);
    const scores = await ownerQuery<{ heat_components: { engagement: number } }>("select heat_components from story_scores where story_id = $1", [story]);
    for (const score of scores) expect(score.heat_components.engagement).toBe(0);
  });

  it("records a refusal without the key in it", async () => {
    await runTick({ trigger: "test", budgetMs: 30_000, fetchFn: fakeYouTube([], { playlistStatus: 403 }).fetchFn });
    const run = (await ownerQuery<{ status: string; error: string }>("select r.status, r.error from ingestion_runs r join sources s on s.id = r.source_id where s.key = 'youtube-official'"))[0]!;
    expect(run.status).toBe("failed");
    expect(run.error).toBe("A channel's uploads answered 403.");
    expect(JSON.stringify(await ownerQuery("select r.error, s.last_error from ingestion_runs r join sources s on s.id = r.source_id"))).not.toContain(PLACEHOLDER_KEY);
  });
});
