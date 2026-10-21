import pg from "pg";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { ImageModel, Picture, VisionCheck } from "@/lib/ai/illustration";
import { closeDb } from "@/lib/db/client";
import { execRows, withPublic, withSystem } from "@/lib/db/scope";
import { storyDetail } from "@/lib/queries/stories";
import { runIllustrations } from "@/lib/services/illustrations";
import { runRetention } from "@/lib/services/retention";

/*
 * Illustrations against the real test database, with stand-ins for the image
 * model, the vision check and the store: the same seams production uses, so
 * every query, rule and write here is the production code. Every record is
 * invented test text.
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

const PICTURE: Picture = { bytes: new Uint8Array([0xff, 0xd8, 0xff]), contentType: "image/jpeg", width: 1344, height: 768, model: "test/painter" };

function painter(): ImageModel & { prompts: string[] } {
  const prompts: string[] = [];
  return { prompts, async draw(prompt) { prompts.push(prompt); return PICTURE; } };
}

const passes: VisionCheck = { inspect: async () => ({ ok: true, reasons: [], description: "A pitch at dusk" }) };
const refuses: VisionCheck = { inspect: async () => ({ ok: false, reasons: ["it contains text or letters"], description: "" }) };

function store(): { upload: (path: string) => Promise<string>; paths: string[] } {
  const paths: string[] = [];
  return { paths, upload: async (path) => { paths.push(path); return `https://store.example/${path}`; } };
}

/** One recent story in a section, from a source with no media rights. */
async function seedStory({ category = "cricket", headline = "Regional side wins a tense final on the last ball", withPhoto = false } = {}): Promise<string> {
  const source = (
    await ownerQuery<{ id: string }>(
      `insert into sources (id, key, name, canonical_domain, source_type, provider, feed_url, country_or_region, is_official, rights_status,
                            headline_display_allowed, excerpt_display_allowed, media_reuse_allowed, enabled)
       values (gen_random_uuid(), 'img-' || gen_random_uuid(), 'Img Desk', 'img.example', 'official', 'rss', 'https://fixtures.invalid/feed', 'IN', true, 'cleared', true, false, $1, true)
       returning id`,
      [withPhoto],
    )
  )[0]!.id;
  const item = (
    await ownerQuery<{ id: string }>(
      `insert into raw_source_items (id, source_id, provider_item_id, canonical_url, url_hash, publisher_domain, title, normalized_title, content_type, media_url, published_at)
       values (gen_random_uuid(), $1, gen_random_uuid()::text, 'https://img.example/' || gen_random_uuid(), md5(random()::text), 'img.example', $2, lower($2), 'report', $3, now() - interval '1 hour')
       returning id`,
      [source, headline, withPhoto ? "https://assets.science.nasa.gov/x.jpg" : null],
    )
  )[0]!.id;
  const story = (
    await ownerQuery<{ id: string }>(
      `insert into stories (id, headline, headline_item_id, signature, categories, primary_category, scope, source_count, item_count, official_count, importance, heat, last_updated_at)
       values (gen_random_uuid(), $2, $1, 'sig ' || gen_random_uuid(), array[$3], $3, 'india', 1, 1, 0, 80, 70, now()) returning id`,
      [item, headline, category],
    )
  )[0]!.id;
  await ownerQuery(`insert into story_items (id, story_id, item_id, association_confidence, method) values (gen_random_uuid(), $1, $2, 90, 'title')`, [story, item]);
  return story;
}

beforeEach(async () => {
  await ownerQuery("truncate sources, raw_source_items, stories, story_items, story_images, ops_switches cascade");
});

const run = (vision: VisionCheck, image = painter(), upload = store()) =>
  runIllustrations({ now: new Date(), deadline: Date.now() + 60_000, image, vision, upload: upload.upload as never });

describe("illustrations", () => {
  it("draw a checked picture for a top story, store it, and show it on the story", async () => {
    const storyId = await seedStory();
    const image = painter();
    const upload = store();
    expect(await run(passes, image, upload)).toMatchObject({ drawn: 1, refused: 0 });
    // The model was told the subject, never a name.
    expect(image.prompts[0]).toContain("cricket news story");
    expect(upload.paths).toEqual([`illustrations/${storyId}.jpg`]);
    // Read back through the reader's query, not from the function's word.
    const detail = await storyDetail(storyId);
    expect(detail?.story.illustration).toMatchObject({ src: `https://store.example/illustrations/${storyId}.jpg`, alt: "AI illustration for a Cricket story", width: 1344 });
  });

  it("refuse a picture that fails its check twice: nothing stored, the refusal kept, and readers cannot see it", async () => {
    const storyId = await seedStory();
    const image = painter();
    const upload = store();
    expect(await run(refuses, image, upload)).toMatchObject({ drawn: 0, refused: 1 });
    expect(image.prompts).toHaveLength(2);
    expect(upload.paths).toEqual([]);
    const system = await withSystem("test", (tx) => execRows<{ status: string; rejection: string }>(tx, sql`select status, rejection from story_images where story_id = ${storyId}::uuid`));
    expect(system).toEqual([{ status: "rejected", rejection: "it contains text or letters" }]);
    // Row security: the runtime role, outside the system scope, sees no refused picture at all.
    expect(await withPublic((tx) => execRows(tx, sql`select 1 from story_images where story_id = ${storyId}::uuid`))).toEqual([]);
    expect((await storyDetail(storyId))?.story.illustration).toBeNull();
  });

  it("are not drawn for a sensitive section, nor for a story that has a licensed photo", async () => {
    await seedStory({ category: "india-politics", headline: "A vote on a new bill passes after a long debate" });
    await seedStory({ withPhoto: true, headline: "A rover photographs layered rock on a crater floor" });
    const image = painter();
    expect(await run(passes, image)).toMatchObject({ drawn: 0, refused: 0 });
    expect(image.prompts).toEqual([]);
  });

  it("are not drawn while switched off in the press room", async () => {
    await seedStory();
    await ownerQuery(`insert into ops_switches (key, enabled, reason) values ('ai_images', false, 'test')`);
    expect(await run(passes)).toMatchObject({ paused: true, drawn: 0 });
  });

  it("are not drawn twice for the same story", async () => {
    await seedStory();
    await run(passes);
    const image = painter();
    expect(await run(passes, image)).toMatchObject({ drawn: 0 });
    expect(image.prompts).toEqual([]);
  });

  it("leave the store with their story: the retention purge removes the file too", async () => {
    const storyId = await seedStory();
    await run(passes);
    // The story loses its last item, as the purge leaves it when a source's retention runs out.
    await ownerQuery("delete from story_items where story_id = $1", [storyId]);
    const removed: string[][] = [];
    const summary = await runRetention({ trigger: "test", removeFiles: async (urls) => void removed.push(urls) });
    expect(removed).toEqual([[`https://store.example/illustrations/${storyId}.jpg`]]);
    expect(summary.detail.illustrations).toBe(1);
    expect(await ownerQuery("select 1 from story_images where story_id = $1", [storyId])).toEqual([]);
  });
});
