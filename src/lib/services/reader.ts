import "server-only";

import { sql } from "drizzle-orm";
import { cache } from "react";
import { uuidv7 } from "uuidv7";

import { execRows, withUser } from "@/lib/db/scope";
import { isoInstant, textArray } from "@/lib/db/sql";
import type { FeedbackKind, InterestKind, InterestStance, ReportReason } from "@/lib/db/schema/reader";
import { AppError, notFound } from "@/lib/errors";
import { LIMITS, take } from "@/lib/rate-limit";
import type { Interest, ReaderContext } from "@/lib/ranking/relevance";

/**
 * What belongs to one reader. Every function runs in that reader's own scope
 * (withUser), so row-level security is the boundary, and every write repeats
 * the owner predicate anyway: a miss is "not found", never "forbidden", so the
 * answer does not confirm that someone else's row exists.
 */

export const MAX_PRIORITIES = 3;

/* -------------------------------------------------------------- interests */

export type InterestRow = Interest & { id: string; position: number; createdAt: string };

export const listInterests = cache(async (userId: string): Promise<InterestRow[]> =>
  withUser(userId, (tx) =>
    execRows<InterestRow>(
      tx,
      sql`select id, kind, value, label, stance, priority, origin, position, ${isoInstant(sql`created_at`)} as "createdAt"
            from user_interests where user_id = ${userId}::uuid order by stance, position, created_at`,
    ),
  ),
);

/**
 * Follow, mute or block one thing, or change its stance. Idempotent on
 * (kind, value): following what is already followed changes nothing. A top
 * priority is only for something followed, at most three; asking for a
 * fourth is refused with a reason, not silently ignored.
 */
export async function setInterest(
  userId: string,
  input: { kind: InterestKind; value: string; label: string; stance: InterestStance; priority?: boolean },
): Promise<InterestRow> {
  const value = input.kind === "keyword" || input.kind === "entity" ? input.value.trim().toLowerCase() : input.value.trim();
  const priority = input.stance === "follow" ? Boolean(input.priority) : false;
  return withUser(userId, async (tx) => {
    if (priority) {
      const others = await execRows<{ n: number }>(
        tx,
        sql`select count(*)::int as n from user_interests where user_id = ${userId}::uuid and priority and not (kind = ${input.kind} and value = ${value})`,
      );
      if ((others[0]?.n ?? 0) >= MAX_PRIORITIES) {
        throw new AppError("VALIDATION", `You can have ${MAX_PRIORITIES} top priorities. Remove one first.`, { priority: "Three at most." });
      }
    }
    const rows = await execRows<InterestRow>(
      tx,
      sql`insert into user_interests (id, user_id, kind, value, label, stance, priority, origin, position)
          values (${uuidv7()}::uuid, ${userId}::uuid, ${input.kind}, ${value}, ${input.label.trim().slice(0, 120)}, ${input.stance}, ${priority}, 'explicit',
                  (select coalesce(max(position), 0) + 1 from user_interests where user_id = ${userId}::uuid))
          on conflict (user_id, kind, value) do update set stance = excluded.stance, priority = excluded.priority, label = excluded.label, origin = 'explicit'
          returning id, kind, value, label, stance, priority, origin, position, ${isoInstant(sql`created_at`)} as "createdAt"`,
    );
    return rows[0]!;
  });
}

export async function removeInterest(userId: string, interestId: string): Promise<void> {
  const removed = await withUser(userId, (tx) =>
    execRows(tx, sql`delete from user_interests where id = ${interestId}::uuid and user_id = ${userId}::uuid returning id`),
  );
  if (removed.length === 0) throw notFound("That interest");
}

/** Put the reader's followed categories in their chosen order. Ids that are not theirs are ignored, not reported. */
export async function reorderInterests(userId: string, orderedIds: string[]): Promise<void> {
  await withUser(userId, async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx.execute(sql`update user_interests set position = ${index + 1} where id = ${id}::uuid and user_id = ${userId}::uuid`);
    }
  });
}

/* ------------------------------------------------------------- onboarding */

export type ReaderProfile = {
  onboardingStep: number | null;
  onboardedAt: string | null;
  timezone: string;
};

export const getReaderProfile = cache(async (userId: string): Promise<ReaderProfile> => {
  const rows = await withUser(userId, (tx) =>
    execRows<ReaderProfile>(
      tx,
      sql`select onboarding_step as "onboardingStep", ${isoInstant(sql`onboarded_at`)} as "onboardedAt", timezone
            from reader_profiles where user_id = ${userId}::uuid`,
    ),
  );
  return rows[0] ?? { onboardingStep: null, onboardedAt: null, timezone: "Asia/Kolkata" };
});

export async function saveOnboardingStep(userId: string, step: number): Promise<void> {
  await withUser(userId, (tx) =>
    tx.execute(sql`insert into reader_profiles (user_id, onboarding_step) values (${userId}::uuid, ${step})
                   on conflict (user_id) do update set onboarding_step = greatest(coalesce(reader_profiles.onboarding_step, 0), excluded.onboarding_step), updated_at = now()`),
  );
}

/**
 * Replace the reader's explicit followed categories and top priorities in one
 * go -- the onboarding step and the Settings list both write whole sets.
 * Mutes and blocks, and other kinds of interest, are left alone.
 */
export async function setCategoryFollows(userId: string, categories: { slug: string; label: string }[], priorities: string[]): Promise<void> {
  if (priorities.length > MAX_PRIORITIES) throw new AppError("VALIDATION", `Choose at most ${MAX_PRIORITIES} top priorities.`, { priorities: "Three at most." });
  if (priorities.some((slug) => !categories.some((category) => category.slug === slug))) {
    throw new AppError("VALIDATION", "A top priority must be one of the sections you follow.", { priorities: "Follow it first." });
  }
  await withUser(userId, async (tx) => {
    const slugs = categories.map((category) => category.slug);
    await tx.execute(sql`delete from user_interests where user_id = ${userId}::uuid and kind = 'category' and stance = 'follow' and not (value = any(${textArray(slugs)}))`);
    for (const [index, category] of categories.entries()) {
      await tx.execute(sql`
        insert into user_interests (id, user_id, kind, value, label, stance, priority, origin, position)
        values (${uuidv7()}::uuid, ${userId}::uuid, 'category', ${category.slug}, ${category.label}, 'follow', ${priorities.includes(category.slug)}, 'explicit', ${index + 1})
        on conflict (user_id, kind, value) do update set stance = 'follow', priority = excluded.priority, position = excluded.position, origin = 'explicit'`);
    }
  });
}

export async function completeOnboarding(userId: string): Promise<void> {
  await withUser(userId, (tx) =>
    tx.execute(sql`insert into reader_profiles (user_id, onboarding_step, onboarded_at) values (${userId}::uuid, 6, now())
                   on conflict (user_id) do update set onboarding_step = 6, onboarded_at = coalesce(reader_profiles.onboarded_at, now()), updated_at = now()`),
  );
}

/* ---------------------------------------------------------------- context */

/** Everything the feed needs to rank for one reader, in one scope. */
export const readerContext = cache(async (userId: string, defaultScope: ReaderContext["defaultScope"], history: boolean): Promise<ReaderContext> =>
  withUser(userId, async (tx) => {
    const interests = await execRows<Interest>(tx, sql`select kind, value, label, stance, priority, origin from user_interests where user_id = ${userId}::uuid`);
    const feedback = await execRows<{ storyId: string; kind: "more" | "less" | "hide"; categories: string[] }>(
      tx,
      sql`select f.story_id as "storyId", f.kind, coalesce(st.categories, '{}') as categories
            from user_story_feedback f left join stories st on st.id = f.story_id
           where f.user_id = ${userId}::uuid and f.created_at > now() - interval '60 days'
           order by f.created_at desc limit 200`,
    );
    const read = history
      ? await execRows<{ story_id: string }>(tx, sql`select story_id from reading_history where user_id = ${userId}::uuid and last_opened_at > now() - interval '7 days'`)
      : [];
    return { interests, defaultScope, feedback, read: new Set(read.map((row) => row.story_id)) };
  }),
);

/* -------------------------------------------------------------- bookmarks */

export type BookmarkRow = { id: string; storyId: string; headline: string; note: string | null; readAt: string | null; createdAt: string; collections: string[] };

export async function toggleBookmark(userId: string, storyId: string): Promise<{ saved: boolean }> {
  return withUser(userId, async (tx) => {
    const removed = await execRows(tx, sql`delete from bookmarks where user_id = ${userId}::uuid and story_id = ${storyId}::uuid returning id`);
    if (removed.length > 0) return { saved: false };
    const story = await execRows<{ headline: string }>(tx, sql`select headline from stories where id = ${storyId}::uuid`);
    if (!story[0]) throw notFound("That story");
    await tx.execute(sql`insert into bookmarks (id, user_id, story_id, headline_snapshot) values (${uuidv7()}::uuid, ${userId}::uuid, ${storyId}::uuid, ${story[0].headline})`);
    return { saved: true };
  });
}

export const savedStoryIds = cache(async (userId: string): Promise<Set<string>> => {
  const rows = await withUser(userId, (tx) => execRows<{ story_id: string }>(tx, sql`select story_id from bookmarks where user_id = ${userId}::uuid`));
  return new Set(rows.map((row) => row.story_id));
});

export const listBookmarks = cache(async (userId: string, collectionId?: string): Promise<BookmarkRow[]> =>
  withUser(userId, (tx) =>
    execRows<BookmarkRow>(
      tx,
      sql`select b.id, b.story_id as "storyId", b.headline_snapshot as headline, b.note, ${isoInstant(sql`b.read_at`)} as "readAt",
                 ${isoInstant(sql`b.created_at`)} as "createdAt",
                 coalesce((select array_agg(ci.collection_id::text) from collection_items ci where ci.bookmark_id = b.id), '{}') as collections
            from bookmarks b
           where b.user_id = ${userId}::uuid
             ${collectionId ? sql`and exists (select 1 from collection_items ci where ci.bookmark_id = b.id and ci.collection_id = ${collectionId}::uuid)` : sql``}
           order by b.created_at desc limit 500`,
    ),
  ),
);

export async function updateBookmark(userId: string, bookmarkId: string, patch: { note?: string | null; read?: boolean }): Promise<void> {
  const updated = await withUser(userId, (tx) =>
    execRows(
      tx,
      sql`update bookmarks set
            note = ${patch.note === undefined ? sql`note` : patch.note === null || patch.note.trim() === "" ? null : patch.note.trim().slice(0, 2000)},
            read_at = ${patch.read === undefined ? sql`read_at` : patch.read ? sql`now()` : null}
          where id = ${bookmarkId}::uuid and user_id = ${userId}::uuid returning id`,
    ),
  );
  if (updated.length === 0) throw notFound("That saved story");
}

/* ------------------------------------------------------------ collections */

export type CollectionRow = { id: string; name: string; count: number };

export const listCollections = cache(async (userId: string): Promise<CollectionRow[]> =>
  withUser(userId, (tx) =>
    execRows<CollectionRow>(
      tx,
      sql`select c.id, c.name, (select count(*)::int from collection_items ci where ci.collection_id = c.id) as count
            from collections c where c.user_id = ${userId}::uuid order by c.name`,
    ),
  ),
);

export async function createCollection(userId: string, name: string): Promise<CollectionRow> {
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length < 1 || clean.length > 80) throw new AppError("VALIDATION", "Please check the highlighted fields.", { name: "Between 1 and 80 characters." });
  try {
    const rows = await withUser(userId, (tx) =>
      execRows<CollectionRow>(tx, sql`insert into collections (id, user_id, name) values (${uuidv7()}::uuid, ${userId}::uuid, ${clean}) returning id, name, 0 as count`),
    );
    return rows[0]!;
  } catch (error) {
    if (String((error as { cause?: { code?: string }; code?: string })?.cause?.code ?? (error as { code?: string })?.code) === "23505") {
      throw new AppError("CONFLICT", "You already have a collection with that name.", { name: "Choose another name." });
    }
    throw error;
  }
}

export async function deleteCollection(userId: string, collectionId: string): Promise<void> {
  const removed = await withUser(userId, (tx) => execRows(tx, sql`delete from collections where id = ${collectionId}::uuid and user_id = ${userId}::uuid returning id`));
  if (removed.length === 0) throw notFound("That collection");
}

/** Put a saved story in a collection, or take it out. Both must be the reader's own. */
export async function setInCollection(userId: string, bookmarkId: string, collectionId: string, inCollection: boolean): Promise<void> {
  await withUser(userId, async (tx) => {
    const owned = await execRows(
      tx,
      sql`select 1 from bookmarks b, collections c where b.id = ${bookmarkId}::uuid and b.user_id = ${userId}::uuid and c.id = ${collectionId}::uuid and c.user_id = ${userId}::uuid`,
    );
    if (owned.length === 0) throw notFound("That saved story or collection");
    if (inCollection) {
      await tx.execute(sql`insert into collection_items (user_id, collection_id, bookmark_id) values (${userId}::uuid, ${collectionId}::uuid, ${bookmarkId}::uuid) on conflict do nothing`);
    } else {
      await tx.execute(sql`delete from collection_items where collection_id = ${collectionId}::uuid and bookmark_id = ${bookmarkId}::uuid and user_id = ${userId}::uuid`);
    }
  });
}

/* --------------------------------------------------------------- feedback */

/** More, less or hide. Asking for the same again takes it back: a toggle, so a mis-tap is undone by tapping again. */
export async function toggleFeedback(userId: string, storyId: string, kind: FeedbackKind): Promise<{ active: boolean }> {
  return withUser(userId, async (tx) => {
    const removed = await execRows(tx, sql`delete from user_story_feedback where user_id = ${userId}::uuid and story_id = ${storyId}::uuid and kind = ${kind} returning id`);
    if (removed.length > 0) return { active: false };
    // "More" and "less" contradict each other: setting one clears the other.
    if (kind !== "hide") await tx.execute(sql`delete from user_story_feedback where user_id = ${userId}::uuid and story_id = ${storyId}::uuid and kind in ('more', 'less')`);
    const exists = await execRows(tx, sql`select 1 from stories where id = ${storyId}::uuid`);
    if (exists.length === 0) throw notFound("That story");
    await tx.execute(sql`insert into user_story_feedback (id, user_id, story_id, kind) values (${uuidv7()}::uuid, ${userId}::uuid, ${storyId}::uuid, ${kind})`);
    return { active: true };
  });
}

export const feedbackFor = cache(async (userId: string, storyId: string): Promise<FeedbackKind[]> => {
  const rows = await withUser(userId, (tx) =>
    execRows<{ kind: FeedbackKind }>(tx, sql`select kind from user_story_feedback where user_id = ${userId}::uuid and story_id = ${storyId}::uuid`),
  );
  return rows.map((row) => row.kind);
});

/* ---------------------------------------------------------------- reports */

export async function fileReport(userId: string, input: { storyId: string; itemId?: string | null; reason: ReportReason; detail: string }): Promise<{ id: string }> {
  // Counted before the scope opens: counted inside it, a refused report would roll its own count back.
  const allowed = await take(`report:${userId}`, LIMITS.reportPerUser);
  if (!allowed.ok) throw new AppError("RATE_LIMITED", "You have sent a lot of reports this hour. Please try again later.");
  const id = uuidv7();
  await withUser(userId, async (tx) => {
    const exists = await execRows(tx, sql`select 1 from stories where id = ${input.storyId}::uuid`);
    if (exists.length === 0) throw notFound("That story");
    await tx.execute(sql`insert into content_reports (id, user_id, story_id, item_id, reason, detail)
                         values (${id}::uuid, ${userId}::uuid, ${input.storyId}::uuid, ${input.itemId ?? null}::uuid, ${input.reason}, ${input.detail.trim().slice(0, 2000)})`);
  });
  return { id };
}

/* ---------------------------------------------------------------- history */

/** Record that a story was opened -- only while the reader has reading history on. Off means not written, not written and hidden. */
export async function recordRead(userId: string, storyId: string, historyOn: boolean): Promise<void> {
  if (!historyOn) return;
  await withUser(userId, (tx) =>
    tx.execute(sql`insert into reading_history (user_id, story_id) select ${userId}::uuid, id from stories where id = ${storyId}::uuid
                   on conflict (user_id, story_id) do update set last_opened_at = now(), opens = reading_history.opens + 1`),
  );
}

/** When the reader last opened this story before now, for "what changed since your last visit". */
export async function previousVisit(userId: string, storyId: string): Promise<string | null> {
  const rows = await withUser(userId, (tx) =>
    execRows<{ at: string }>(tx, sql`select ${isoInstant(sql`last_opened_at`)} as at from reading_history where user_id = ${userId}::uuid and story_id = ${storyId}::uuid`),
  );
  return rows[0]?.at ?? null;
}

/**
 * When the reader last read here, for "since you last checked": the newest
 * story opened more than an hour ago, so reading one story a minute ago does
 * not make the catch-up empty. Null with history off or nothing read.
 */
export async function lastSessionAt(userId: string): Promise<string | null> {
  const rows = await withUser(userId, (tx) =>
    execRows<{ at: string | null }>(
      tx,
      sql`select ${isoInstant(sql`max(last_opened_at)`)} as at from reading_history where user_id = ${userId}::uuid and last_opened_at < now() - interval '1 hour'`,
    ),
  );
  return rows[0]?.at ?? null;
}

export async function clearHistory(userId: string): Promise<number> {
  const removed = await withUser(userId, (tx) => execRows(tx, sql`delete from reading_history where user_id = ${userId}::uuid returning story_id`));
  return removed.length;
}

/* ---------------------------------------------------------- notifications */

export type NotificationPrefs = {
  breaking: boolean;
  hot: boolean;
  topics: boolean;
  storyUpdates: boolean;
  morningBriefing: boolean;
  eveningBriefing: boolean;
  emailDigest: boolean;
  morningAt: string;
  eveningAt: string;
  quietHours: boolean;
  quietStart: string;
  quietEnd: string;
  dailyCap: number;
};

export const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  breaking: false,
  hot: false,
  topics: false,
  storyUpdates: false,
  morningBriefing: false,
  eveningBriefing: false,
  emailDigest: false,
  morningAt: "07:30",
  eveningAt: "19:00",
  quietHours: true,
  quietStart: "22:00",
  quietEnd: "07:00",
  dailyCap: 3,
};

export const getNotificationPrefs = cache(async (userId: string): Promise<NotificationPrefs> => {
  const rows = await withUser(userId, (tx) =>
    execRows<NotificationPrefs>(
      tx,
      sql`select notify_breaking as breaking, notify_hot as hot, notify_topics as topics, notify_story_updates as "storyUpdates",
                 morning_briefing as "morningBriefing", evening_briefing as "eveningBriefing", email_digest as "emailDigest",
                 morning_at as "morningAt", evening_at as "eveningAt", quiet_hours as "quietHours", quiet_start as "quietStart",
                 quiet_end as "quietEnd", daily_cap as "dailyCap"
            from reader_profiles where user_id = ${userId}::uuid`,
    ),
  );
  return rows[0] ?? DEFAULT_NOTIFICATIONS;
});

/** Save the reader's alert rules, and read back what the row now holds. */
export async function saveNotificationPrefs(userId: string, prefs: NotificationPrefs): Promise<NotificationPrefs> {
  await withUser(userId, (tx) =>
    tx.execute(sql`
      insert into reader_profiles (user_id, notify_breaking, notify_hot, notify_topics, notify_story_updates, morning_briefing, evening_briefing,
                                   email_digest, morning_at, evening_at, quiet_hours, quiet_start, quiet_end, daily_cap)
      values (${userId}::uuid, ${prefs.breaking}, ${prefs.hot}, ${prefs.topics}, ${prefs.storyUpdates}, ${prefs.morningBriefing}, ${prefs.eveningBriefing},
              ${prefs.emailDigest}, ${prefs.morningAt}, ${prefs.eveningAt}, ${prefs.quietHours}, ${prefs.quietStart}, ${prefs.quietEnd}, ${prefs.dailyCap})
      on conflict (user_id) do update set
        notify_breaking = excluded.notify_breaking, notify_hot = excluded.notify_hot, notify_topics = excluded.notify_topics,
        notify_story_updates = excluded.notify_story_updates, morning_briefing = excluded.morning_briefing, evening_briefing = excluded.evening_briefing,
        email_digest = excluded.email_digest, morning_at = excluded.morning_at, evening_at = excluded.evening_at, quiet_hours = excluded.quiet_hours,
        quiet_start = excluded.quiet_start, quiet_end = excluded.quiet_end, daily_cap = excluded.daily_cap, updated_at = now()`),
  );
  return getNotificationPrefs(userId);
}
