/**
 * What belongs to one reader: what they follow and mute, what they saved, what
 * they read, what they told us, and how they want to be alerted.
 *
 * Every table here is OWNER-scoped (FORCE RLS on app.user_id) and cascades from
 * `users`, so deleting an account removes all of it with one statement.
 */
import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import {
  FEEDBACK_KINDS,
  INTEREST_KINDS,
  INTEREST_ORIGINS,
  INTEREST_STANCES,
  REPORT_REASONS,
  REPORT_STATUSES,
  type FeedbackKind,
  type InterestKind,
  type InterestOrigin,
  type InterestStance,
  type ReportReason,
  type ReportStatus,
} from "@/lib/reader-vocab";

import { inVocab, namedTimestamp, optionalTimestamp, primaryId } from "./_shared";

export * from "@/lib/reader-vocab";
import { users } from "./identity";
import { rawSourceItems, sources, stories } from "./news";




export const userInterests = pgTable(
  "user_interests",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<InterestKind>().notNull(),
    /** Normalised: a slug, a code, or lower-cased free text. */
    value: text("value").notNull(),
    /** As the reader typed or picked it, for display. */
    label: text("label").notNull(),
    stance: text("stance").$type<InterestStance>().notNull().default("follow"),
    /** One of the reader's top priorities. At most three (enforced by the service). */
    priority: boolean("priority").notNull().default(false),
    /** The reader's own order for their categories. */
    position: integer("position").notNull().default(0),
    origin: text("origin").$type<InterestOrigin>().notNull().default("explicit"),
    createdAt: namedTimestamp("created_at"),
  },
  (t) => [
    uniqueIndex("user_interests_unique").on(t.userId, t.kind, t.value),
    index("user_interests_user").on(t.userId, t.stance),
    check("user_interests_kind_vocab", inVocab("kind", INTEREST_KINDS)),
    check("user_interests_stance_vocab", inVocab("stance", INTEREST_STANCES)),
    check("user_interests_origin_vocab", inVocab("origin", INTEREST_ORIGINS)),
    // A priority is something the reader chose to follow, never a guess and never a mute.
    check("user_interests_priority_explicit", sql`NOT "priority" OR ("origin" = 'explicit' AND "stance" = 'follow')`),
  ],
);

/**
 * One row per reader: where they are in onboarding and how they want to be
 * alerted. Times of day are "HH:MM" strings in the reader's own timezone: a
 * time of day is not an instant, and storing one as a timestamp would move
 * quiet hours an hour twice a year in every zone that has daylight saving.
 */
export const readerProfiles = pgTable("reader_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** The last onboarding step reached, 1-6. Null before the first. */
  onboardingStep: integer("onboarding_step"),
  onboardedAt: optionalTimestamp("onboarded_at"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),

  /* Notification rules (blueprint §12). Everything is off until the reader opts in. */
  notifyBreaking: boolean("notify_breaking").notNull().default(false),
  notifyHot: boolean("notify_hot").notNull().default(false),
  notifyTopics: boolean("notify_topics").notNull().default(false),
  notifyStoryUpdates: boolean("notify_story_updates").notNull().default(false),
  morningBriefing: boolean("morning_briefing").notNull().default(false),
  eveningBriefing: boolean("evening_briefing").notNull().default(false),
  emailDigest: boolean("email_digest").notNull().default(false),
  morningAt: text("morning_at").notNull().default("07:30"),
  eveningAt: text("evening_at").notNull().default("19:00"),
  quietHours: boolean("quiet_hours").notNull().default(true),
  quietStart: text("quiet_start").notNull().default("22:00"),
  quietEnd: text("quiet_end").notNull().default("07:00"),
  dailyCap: integer("daily_cap").notNull().default(3),
  /** Pause everything until this time, without changing any rule. */
  pausedUntil: optionalTimestamp("paused_until"),
  updatedAt: namedTimestamp("updated_at"),
}, () => [
  check("reader_profiles_step_range", sql`"onboarding_step" IS NULL OR "onboarding_step" BETWEEN 1 AND 6`),
  check("reader_profiles_cap_range", sql`"daily_cap" BETWEEN 0 AND 20`),
  check("reader_profiles_times", sql`"morning_at" ~ '^[0-2][0-9]:[0-5][0-9]$' AND "evening_at" ~ '^[0-2][0-9]:[0-5][0-9]$' AND "quiet_start" ~ '^[0-2][0-9]:[0-5][0-9]$' AND "quiet_end" ~ '^[0-2][0-9]:[0-5][0-9]$'`),
]);

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    /** A private note. Never shown to anyone else, never sent to a model. */
    note: text("note"),
    /** The headline and source links as they were when saved, so a saved story still makes sense if it is re-clustered. */
    headlineSnapshot: text("headline_snapshot").notNull(),
    readAt: optionalTimestamp("read_at"),
    createdAt: namedTimestamp("created_at"),
  },
  (t) => [uniqueIndex("bookmarks_user_story").on(t.userId, t.storyId), index("bookmarks_user_recent").on(t.userId, t.createdAt.desc())],
);

export const collections = pgTable(
  "collections",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: namedTimestamp("created_at"),
  },
  (t) => [uniqueIndex("collections_user_name").on(t.userId, t.name), check("collections_name_length", sql`char_length("name") BETWEEN 1 AND 80`)],
);

export const collectionItems = pgTable(
  "collection_items",
  {
    /** Denormalised owner, so the row-level policy needs no join. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    bookmarkId: uuid("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    addedAt: namedTimestamp("added_at"),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.bookmarkId] }), index("collection_items_user").on(t.userId)],
);


export const userStoryFeedback = pgTable(
  "user_story_feedback",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    kind: text("kind").$type<FeedbackKind>().notNull(),
    createdAt: namedTimestamp("created_at"),
  },
  (t) => [
    uniqueIndex("feedback_user_story_kind").on(t.userId, t.storyId, t.kind),
    index("feedback_user_recent").on(t.userId, t.createdAt.desc()),
    check("feedback_kind_vocab", inVocab("kind", FEEDBACK_KINDS)),
  ],
);

/** Only written while the reader's `readingHistory` preference is on. Cleared by one button. */
export const readingHistory = pgTable(
  "reading_history",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    firstOpenedAt: namedTimestamp("first_opened_at"),
    lastOpenedAt: namedTimestamp("last_opened_at"),
    opens: integer("opens").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.userId, t.storyId] }), index("reading_history_recent").on(t.userId, t.lastOpenedAt.desc())],
);


/**
 * A reader's report about a story or an item. The reader may see their own
 * reports; the moderation queue reads them all through the system scope.
 */
export const contentReports = pgTable(
  "content_reports",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storyId: uuid("story_id").references(() => stories.id, { onDelete: "set null" }),
    itemId: uuid("item_id").references(() => rawSourceItems.id, { onDelete: "set null" }),
    reason: text("reason").$type<ReportReason>().notNull(),
    detail: text("detail").notNull().default(""),
    status: text("status").$type<ReportStatus>().notNull().default("open"),
    resolution: text("resolution"),
    createdAt: namedTimestamp("created_at"),
    resolvedAt: optionalTimestamp("resolved_at"),
  },
  (t) => [
    index("content_reports_status").on(t.status, t.createdAt.desc()),
    index("content_reports_user").on(t.userId, t.createdAt.desc()),
    check("content_reports_reason_vocab", inVocab("reason", REPORT_REASONS)),
    check("content_reports_status_vocab", inVocab("status", REPORT_STATUSES)),
    check("content_reports_detail_length", sql`char_length("detail") <= 2000`),
  ],
);

/**
 * What administrators did: enabling a source, editing its rights, merging a
 * cluster, resolving a report. System-only. Never content, never a secret.
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: primaryId(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetKind: text("target_kind").notNull(),
    targetId: text("target_id").notNull(),
    detail: text("detail").notNull().default(""),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
    createdAt: namedTimestamp("created_at"),
  },
  (t) => [index("audit_events_recent").on(t.createdAt.desc())],
);
