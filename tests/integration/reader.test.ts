import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { closeDb } from "@/lib/db/client";
import { exportReaderData } from "@/lib/services/export";
import {
  clearHistory,
  createCollection,
  deleteCollection,
  fileReport,
  listBookmarks,
  listInterests,
  readerContext,
  recordRead,
  removeInterest,
  setCategoryFollows,
  setInCollection,
  setInterest,
  toggleBookmark,
  toggleFeedback,
  updateBookmark,
} from "@/lib/services/reader";

import { createVerifiedUser } from "./auth-helpers";

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

/** One cleared source, one item, one story: enough for a reader to save, rate and report. Invented text. */
let storyId = "";
beforeAll(async () => {
  const source = (
    await ownerQuery<{ id: string }>(
      `insert into sources (id, key, name, canonical_domain, source_type, provider, feed_url, country_or_region, rights_status, headline_display_allowed, enabled)
       values (gen_random_uuid(), 'reader-test-' || gen_random_uuid(), 'Reader Test', 'reader.example', 'publisher', 'rss', 'https://reader.example/feed', 'IN', 'cleared', true, true)
       returning id`,
    )
  )[0]!;
  const item = (
    await ownerQuery<{ id: string }>(
      `insert into raw_source_items (id, source_id, provider_item_id, canonical_url, url_hash, publisher_domain, title, normalized_title)
       values (gen_random_uuid(), $1, 'one', 'https://reader.example/one', md5(random()::text), 'reader.example', 'Council approves the new cycle lane plan', 'council approves the new cycle lane plan')
       returning id`,
      [source.id],
    )
  )[0]!;
  storyId = (
    await ownerQuery<{ id: string }>(
      `insert into stories (id, headline, headline_item_id, signature, categories, primary_category) values (gen_random_uuid(), 'Council approves the new cycle lane plan', $1, 'approve council cycle lane plan', '{india-politics}', 'india-politics') returning id`,
      [item.id],
    )
  )[0]!.id;
  await ownerQuery(`insert into story_items (id, story_id, item_id, association_confidence, method) values (gen_random_uuid(), $1, $2, 100, 'new')`, [storyId, item.id]);
});

describe("bookmarks and collections", () => {
  it("save, toggle off, and read back from the table", async () => {
    const { userId } = await createVerifiedUser();
    expect(await toggleBookmark(userId, storyId)).toEqual({ saved: true });
    const saved = await listBookmarks(userId);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.headline).toBe("Council approves the new cycle lane plan");
    expect(await toggleBookmark(userId, storyId)).toEqual({ saved: false });
    expect(await ownerQuery("select 1 from bookmarks where user_id = $1", [userId])).toHaveLength(0);
  });

  it("are invisible to another reader, and another reader's ids answer not found", async () => {
    const owner = await createVerifiedUser();
    const stranger = await createVerifiedUser();
    await toggleBookmark(owner.userId, storyId);
    const bookmark = (await listBookmarks(owner.userId))[0]!;
    const collection = await createCollection(owner.userId, "Trips");
    expect(await listBookmarks(stranger.userId)).toEqual([]);
    // 404, not 403: a "forbidden" would confirm the id is real.
    await expect(updateBookmark(stranger.userId, bookmark.id, { note: "mine now" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteCollection(stranger.userId, collection.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setInCollection(stranger.userId, bookmark.id, collection.id, true)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await ownerQuery<{ note: string | null }>("select note from bookmarks where id = $1", [bookmark.id]))[0]!.note).toBeNull();
  });

  it("keep notes, read state and collections, and refuse a duplicate collection name", async () => {
    const { userId } = await createVerifiedUser();
    await toggleBookmark(userId, storyId);
    const bookmark = (await listBookmarks(userId))[0]!;
    await updateBookmark(userId, bookmark.id, { note: "  For the weekend.  ", read: true });
    const collection = await createCollection(userId, "Cycling");
    await expect(createCollection(userId, "Cycling")).rejects.toMatchObject({ code: "CONFLICT" });
    await setInCollection(userId, bookmark.id, collection.id, true);
    const inCollection = await listBookmarks(userId, collection.id);
    expect(inCollection).toHaveLength(1);
    expect(inCollection[0]).toMatchObject({ note: "For the weekend.", collections: [collection.id] });
    expect(inCollection[0]!.readAt).not.toBeNull();
  });
});

describe("interests", () => {
  it("follow, mute and block are one row per thing, changed in place", async () => {
    const { userId } = await createVerifiedUser();
    const first = await setInterest(userId, { kind: "keyword", value: "Harbour Strike", label: "Harbour strike", stance: "follow" });
    const again = await setInterest(userId, { kind: "keyword", value: "harbour strike", label: "Harbour strike", stance: "mute" });
    expect(again.id).toBe(first.id);
    expect((await listInterests(userId)).filter((entry) => entry.kind === "keyword")).toEqual([expect.objectContaining({ value: "harbour strike", stance: "mute", origin: "explicit" })]);
    await removeInterest(userId, first.id);
    expect(await listInterests(userId)).toEqual([]);
  });

  it("allow three top priorities and refuse a fourth, with a reason", async () => {
    const { userId } = await createVerifiedUser();
    await setCategoryFollows(userId, ["cricket", "ai", "cinema", "science"].map((slug) => ({ slug, label: slug })), ["cricket", "ai", "cinema"]);
    await expect(setInterest(userId, { kind: "category", value: "science", label: "Science", stance: "follow", priority: true })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setCategoryFollows(userId, [{ slug: "cricket", label: "Cricket" }], ["ai"])).rejects.toMatchObject({ code: "VALIDATION" });
    // A priority is never a mute: the database refuses it outright.
    await expect(ownerQuery(`update user_interests set stance = 'mute' where user_id = $1 and priority`, [userId])).rejects.toThrow(/user_interests_priority_explicit/);
  });

  it("feed the ranking: interests, feedback and what was read", async () => {
    const { userId } = await createVerifiedUser();
    await setInterest(userId, { kind: "category", value: "cricket", label: "Cricket", stance: "follow" });
    expect(await toggleFeedback(userId, storyId, "more")).toEqual({ active: true });
    // "Less" replaces "more" for the same story.
    expect(await toggleFeedback(userId, storyId, "less")).toEqual({ active: true });
    await recordRead(userId, storyId, true);
    const context = await readerContext(userId, "both", true);
    expect(context.interests).toEqual([expect.objectContaining({ kind: "category", value: "cricket" })]);
    expect(context.feedback).toEqual([{ storyId, kind: "less", categories: ["india-politics"] }]);
    expect(context.read.has(storyId)).toBe(true);
  });
});

describe("reading history", () => {
  it("is not written at all while the reader has it switched off", async () => {
    const { userId } = await createVerifiedUser();
    await recordRead(userId, storyId, false);
    expect(await ownerQuery("select 1 from reading_history where user_id = $1", [userId])).toHaveLength(0);
  });

  it("counts opens, and clears in one go", async () => {
    const { userId } = await createVerifiedUser();
    await recordRead(userId, storyId, true);
    await recordRead(userId, storyId, true);
    expect((await ownerQuery<{ opens: number }>("select opens from reading_history where user_id = $1", [userId]))[0]!.opens).toBe(2);
    expect(await clearHistory(userId)).toBe(1);
    expect(await ownerQuery("select 1 from reading_history where user_id = $1", [userId])).toHaveLength(0);
  });
});

describe("reports", () => {
  it("are filed as open, readable by their author only", async () => {
    const author = await createVerifiedUser();
    const { id } = await fileReport(author.userId, { storyId, reason: "misleading", detail: "The headline overstates it." });
    expect((await ownerQuery<{ status: string; user_id: string }>("select status, user_id from content_reports where id = $1", [id]))[0]).toMatchObject({ status: "open", user_id: author.userId });
  });

  it("are rate limited per reader", async () => {
    vi.stubEnv("REPORT_LIMIT_PER_USER", "2");
    vi.resetModules();
    const fresh = await import("@/lib/services/reader");
    const { userId } = await createVerifiedUser();
    await fresh.fileReport(userId, { storyId, reason: "other", detail: "" });
    await fresh.fileReport(userId, { storyId, reason: "other", detail: "" });
    await expect(fresh.fileReport(userId, { storyId, reason: "other", detail: "" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    vi.unstubAllEnvs();
    await (await import("@/lib/db/client")).closeDb();
  });
});

describe("the data export", () => {
  it("holds the reader's own records and nothing of anyone else's, and no credential", async () => {
    const reader = await createVerifiedUser();
    const other = await createVerifiedUser();
    await toggleBookmark(reader.userId, storyId);
    await setInterest(reader.userId, { kind: "keyword", value: "cycle lane", label: "cycle lane", stance: "follow" });
    await setInterest(other.userId, { kind: "keyword", value: "someone else's secret", label: "x", stance: "follow" });
    const data = await exportReaderData(reader.userId);
    expect(data).toMatchObject({ account: { email: reader.email }, interests: [expect.objectContaining({ value: "cycle lane" })], saved: [expect.objectContaining({ storyId })] });
    const text = JSON.stringify(data);
    expect(text).not.toContain("someone else's secret");
    expect(text).not.toContain(other.email);
    expect(text).not.toMatch(/token|password|otp/i);
  });
});
