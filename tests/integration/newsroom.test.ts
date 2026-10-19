import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { CurrentSession } from "@/lib/auth/session";
import { closeDb } from "@/lib/db/client";
import { mergeStories, openReports, possibleDuplicates, resolveReport, splitItem } from "@/lib/services/admin";
import { fileReport, toggleBookmark } from "@/lib/services/reader";

import { createVerifiedUser, newEmail } from "./auth-helpers";

/*
 * The newsroom tools against the real test database. Every side effect is
 * read back from the tables, not taken from the function that claims it.
 * Every headline here is invented test text.
 */

const ADMIN = `newsroom-${Date.now()}@example.in`;
// Before anything reads the environment: each test file has its own module registry.
process.env.ADMIN_EMAILS = ADMIN;

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

const sessionOf = (user: { userId: string; email: string }): CurrentSession => ({
  sessionId: "test",
  user: { id: user.userId, name: "", email: user.email, emailVerified: true, image: null },
  createdAt: new Date(),
  stepUpAt: null,
});

let admin: CurrentSession;
let reader: CurrentSession;
let sourceId = "";

beforeAll(async () => {
  admin = sessionOf(await createVerifiedUser(ADMIN));
  reader = sessionOf(await createVerifiedUser(newEmail()));
});

beforeEach(async () => {
  await ownerQuery("truncate sources, raw_source_items, stories, story_items, story_scores, story_embeddings, content_reports, audit_events cascade");
  sourceId = (
    await ownerQuery<{ id: string }>(
      `insert into sources (id, key, name, canonical_domain, source_type, provider, feed_url, country_or_region, rights_status, headline_display_allowed, enabled)
       values (gen_random_uuid(), 'newsroom-' || gen_random_uuid(), 'Newsroom Test', 'newsroom.example', 'publisher', 'rss', 'https://newsroom.example/feed', 'IN', 'cleared', true, false) returning id`,
    )
  )[0]!.id;
});

/** A story of N reports from N publishers. */
async function story(headline: string, publishers: number) {
  const items: string[] = [];
  for (let n = 0; n < publishers; n++) {
    items.push(
      (
        await ownerQuery<{ id: string }>(
          `insert into raw_source_items (id, source_id, provider_item_id, canonical_url, url_hash, publisher_domain, title, normalized_title)
           values (gen_random_uuid(), $1, gen_random_uuid()::text, 'https://p' || $3 || '.example/' || gen_random_uuid(), md5(random()::text), 'p' || $3 || '.example', $2, lower($2)) returning id`,
          [sourceId, `${headline} (${n + 1})`, n],
        )
      )[0]!.id,
    );
  }
  const id = (
    await ownerQuery<{ id: string }>(`insert into stories (id, headline, headline_item_id, signature, last_updated_at) values (gen_random_uuid(), $1, $2, lower($1), now()) returning id`, [`${headline} (1)`, items[0]])
  )[0]!.id;
  for (const item of items) await ownerQuery(`insert into story_items (id, story_id, item_id, association_confidence, method) values (gen_random_uuid(), $1, $2, 80, 'title')`, [id, item]);
  await ownerQuery("update stories set source_count = $2, item_count = $2 where id = $1", [id, publishers]);
  return { id, items };
}

describe("the newsroom tools", () => {
  it("are not found for a reader who is not an administrator", async () => {
    const a = await story("Harbour strike enters its third week", 2);
    const b = await story("Port strike continues into a third week", 1);
    await expect(openReports(reader)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(mergeStories(reader, { keepId: a.id, mergeId: b.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(splitItem(reader, { storyId: a.id, itemId: a.items[1]! })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await ownerQuery("select 1 from stories")).toHaveLength(2);
  });

  it("merge one story into another, moving its reports and the readers' saves, and record it", async () => {
    const keep = await story("Harbour strike enters its third week", 2);
    const merge = await story("Port strike continues into a third week", 1);
    await toggleBookmark(reader.user.id, merge.id);
    const { movedItems } = await mergeStories(admin, { keepId: keep.id, mergeId: merge.id });
    expect(movedItems).toBe(1);
    expect(await ownerQuery("select 1 from stories where id = $1", [merge.id])).toEqual([]);
    expect(await ownerQuery<{ n: number }>("select count(*)::int as n from story_items where story_id = $1", [keep.id])).toEqual([{ n: 3 }]);
    // The reader's save followed the story, rather than vanishing with it.
    expect(await ownerQuery("select story_id from bookmarks where user_id = $1", [reader.user.id])).toEqual([{ story_id: keep.id }]);
    expect((await ownerQuery<{ action: string; detail: string }>("select action, detail from audit_events"))[0]).toMatchObject({ action: "story.merge" });
  });

  it("keep one save when the reader had saved both stories", async () => {
    const keep = await story("Harbour strike enters its third week", 2);
    const merge = await story("Port strike continues into a third week", 1);
    await toggleBookmark(reader.user.id, keep.id);
    await toggleBookmark(reader.user.id, merge.id);
    await mergeStories(admin, { keepId: keep.id, mergeId: merge.id });
    expect(await ownerQuery("select story_id from bookmarks where user_id = $1", [reader.user.id])).toEqual([{ story_id: keep.id }]);
  });

  it("split a wrongly attached report into a story of its own, which a later run will not undo", async () => {
    const { id, items } = await story("Harbour strike enters its third week", 3);
    const { newStoryId } = await splitItem(admin, { storyId: id, itemId: items[0]! });
    expect(await ownerQuery("select story_id, method from story_items where item_id = $1", [items[0]])).toEqual([{ story_id: newStoryId, method: "manual" }]);
    // The old story used the moved report's words as its headline; it now uses one it still has.
    const old = (await ownerQuery<{ headline_item_id: string }>("select headline_item_id from stories where id = $1", [id]))[0]!;
    expect(items.slice(1)).toContain(old.headline_item_id);
    await expect(splitItem(admin, { storyId: newStoryId, itemId: items[0]! })).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("resolve a reader's report once, with the note in the audit log", async () => {
    const { id } = await story("Harbour strike enters its third week", 1);
    const report = await fileReport(reader.user.id, { storyId: id, reason: "misleading", detail: "Not what the reports say." });
    expect((await openReports(admin)).map((entry) => entry.id)).toEqual([report.id]);
    await resolveReport(admin, { reportId: report.id, status: "actioned", resolution: "Headline source checked." });
    expect(await ownerQuery("select status, resolution from content_reports where id = $1", [report.id])).toEqual([{ status: "actioned", resolution: "Headline source checked." }]);
    await expect(resolveReport(admin, { reportId: report.id, status: "dismissed", resolution: "" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("suggest two stories close in meaning, and not two that are far apart", async () => {
    const a = await story("Harbour strike enters its third week", 2);
    const b = await story("Port strike continues into a third week", 1);
    const c = await story("Observatory releases an open map of the sky", 1);
    const vector = (lead: number) => `[${Array.from({ length: 2048 }, (_, i) => (i === 0 ? lead : i === 1 ? 1 - lead : 0)).join(",")}]`;
    await ownerQuery("insert into story_embeddings (story_id, model, text_hash, embedding) values ($1, 'test', 'a', $2::halfvec), ($3, 'test', 'b', $4::halfvec), ($5, 'test', 'c', $6::halfvec)", [
      a.id, vector(1), b.id, vector(0.97), c.id, vector(0),
    ]);
    const pairs = await possibleDuplicates(admin);
    expect(pairs.map((pair) => [pair.keepId, pair.mergeId])).toEqual([[a.id, b.id]]);
  });
});
