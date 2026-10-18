/**
 * The news model: where things come from, what came, and what it adds up to.
 *
 *   sources            a feed or provider, its RIGHTS and its health
 *   raw_source_items   one article, post or release as a source gave it
 *   stories            a cluster of items about the same event
 *   story_items        which items belong to which story, and how sure we are
 *   story_updates      dated, evidence-backed developments within a story
 *   story_scores       heat, confidence and importance, with their components
 *   ingestion_runs     one row per fetch of one source, success or not
 *
 * All are REFERENCE tables (see ../classification.ts): any reader may SELECT,
 * only the system writes. What a reader may actually SEE is narrower than what
 * they may select -- that is decided by `showable()` in lib/news/rights.ts,
 * which every query that reads items or stories applies.
 */
import { sql, type SQL } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { inVocab, namedTimestamp, optionalTimestamp, primaryId } from "./_shared";

/** Postgres full-text vector. Drizzle has no built-in, and it is only ever written by a generated column. */
const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

/* -------------------------------------------------------------- vocabularies */

/** How a source reaches us. One adapter per provider (lib/ingestion/adapters). */
export const PROVIDERS = ["gdelt_gkg", "gdelt_doc", "rss", "bluesky", "mastodon", "youtube"] as const;
export type Provider = (typeof PROVIDERS)[number];

/**
 * What KIND of voice a source is. Shown on every card, because a ministry's
 * press release, a newspaper's report, a preprint and a post are different
 * kinds of evidence, and a reader must never have to guess which one they
 * are looking at.
 */
export const SOURCE_TYPES = ["aggregator", "publisher", "official", "research", "social", "video"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * Whether a source may be fetched and shown.
 *
 *   cleared         its terms were read and permit what we do with it
 *   pending_review  not yet read, or unclear. NEVER FETCHED.
 *   excluded        read, and they do not permit it. Listed in the public
 *                   source directory with the reason, never fetched.
 *
 * Anything other than `cleared` is the default for a reason: the blueprint's
 * rule is that an unclear rights state is disabled until a person reviews it.
 */
export const RIGHTS_STATUSES = ["cleared", "pending_review", "excluded"] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

export const HEALTH_STATUSES = ["unknown", "healthy", "degraded", "failing", "stale", "disabled"] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

/** What one item IS. Distinct from where it came from: an official account can post commentary. */
export const CONTENT_TYPES = ["report", "official_statement", "preprint", "social_post", "video", "commentary"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const STORY_STATES = ["developing", "active", "cooling", "closed"] as const;
export type StoryState = (typeof STORY_STATES)[number];

/** Where a story's EVENT is, not where its publishers are (config/regions.ts). */
export const STORY_SCOPES = ["india", "global"] as const;
export type StoryScope = (typeof STORY_SCOPES)[number];

export const RUN_STATUSES = ["running", "ok", "not_modified", "partial", "failed", "skipped"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const UPDATE_VERIFICATIONS = ["sourced", "official", "disputed"] as const;
export type UpdateVerification = (typeof UPDATE_VERIFICATIONS)[number];

/* ------------------------------------------------------------------- sources */

export const sources = pgTable(
  "sources",
  {
    id: primaryId(),
    /** A stable, human-readable key used by the catalogue (lib/sources/catalogue.ts) to upsert. */
    key: text("key").notNull(),
    name: text("name").notNull(),
    canonicalDomain: text("canonical_domain").notNull(),
    sourceType: text("source_type").$type<SourceType>().notNull(),
    provider: text("provider").$type<Provider>().notNull(),
    /** The feed or endpoint. For GDELT, the endpoint; for a curated social account, its handle URL. */
    feedUrl: text("feed_url").notNull(),
    countryOrRegion: text("country_or_region").notNull(),
    language: text("language").notNull().default("en"),
    categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
    /** A primary source: a government, regulator, court, agency or the organisation itself. */
    isOfficial: boolean("is_official").notNull().default(false),

    /* Rights. Read by lib/news/rights.ts and nowhere else. */
    rightsStatus: text("rights_status").$type<RightsStatus>().notNull().default("pending_review"),
    termsUrl: text("terms_url"),
    /** The day a person last read the terms. A day, so a string. */
    rightsCheckedOn: text("rights_checked_on"),
    rightsNote: text("rights_note").notNull().default(""),
    commercialUseAllowed: boolean("commercial_use_allowed").notNull().default(false),
    headlineDisplayAllowed: boolean("headline_display_allowed").notNull().default(false),
    excerptDisplayAllowed: boolean("excerpt_display_allowed").notNull().default(false),
    aiSummaryAllowed: boolean("ai_summary_allowed").notNull().default(false),
    mediaReuseAllowed: boolean("media_reuse_allowed").notNull().default(false),
    /** Days an item is kept. Null keeps it until the story closes and the purge job runs. */
    retentionDays: integer("retention_days"),
    attributionText: text("attribution_text").notNull().default(""),
    removalContact: text("removal_contact"),

    /* Operations. */
    enabled: boolean("enabled").notNull().default(false),
    disableReason: text("disable_reason"),
    /** Lower runs first when a tick cannot reach everything. */
    priority: integer("priority").notNull().default(50),
    pollIntervalSeconds: integer("poll_interval_seconds").notNull().default(900),
    nextPollAt: namedTimestamp("next_poll_at"),
    /** A tick holds a source until this time so two overlapping ticks never fetch it twice. */
    leasedUntil: optionalTimestamp("leased_until"),
    etag: text("etag"),
    lastModified: text("last_modified"),
    /** Provider-specific progress, e.g. the last GKG file read. Moved only on success. */
    cursor: jsonb("cursor").$type<Record<string, unknown>>().notNull().default({}),
    /** Provider-specific settings: a GDELT query, a channel id. Never a credential. */
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    lastSuccessAt: optionalTimestamp("last_success_at"),
    lastErrorAt: optionalTimestamp("last_error_at"),
    lastError: text("last_error"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    circuitOpenUntil: optionalTimestamp("circuit_open_until"),
    healthStatus: text("health_status").$type<HealthStatus>().notNull().default("unknown"),
    /** The newest publication time this source has given us. Freshness is measured from it. */
    newestItemAt: optionalTimestamp("newest_item_at"),
    createdAt: namedTimestamp("created_at"),
    updatedAt: namedTimestamp("updated_at"),
  },
  (t) => [
    uniqueIndex("sources_key").on(t.key),
    index("sources_due").on(t.enabled, t.nextPollAt),
    check("sources_provider_vocab", inVocab("provider", PROVIDERS)),
    check("sources_type_vocab", inVocab("source_type", SOURCE_TYPES)),
    check("sources_rights_vocab", inVocab("rights_status", RIGHTS_STATUSES)),
    check("sources_health_vocab", inVocab("health_status", HEALTH_STATUSES)),
    // A source cannot be switched on without its terms having been read and cleared.
    check("sources_enabled_needs_clearance", sql`NOT "enabled" OR "rights_status" = 'cleared'`),
  ],
);

/* ---------------------------------------------------------------------- items */

export const rawSourceItems = pgTable(
  "raw_source_items",
  {
    id: primaryId(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    /** The source's own id for the item, or the canonical URL when it has none. */
    providerItemId: text("provider_item_id").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    /** sha256 of the canonical URL: the cross-source duplicate key. */
    urlHash: text("url_hash").notNull(),
    /** The publisher's domain. For GDELT this is the article's site, not GDELT. */
    publisherDomain: text("publisher_domain").notNull(),
    publisherName: text("publisher_name"),
    title: text("title").notNull(),
    /** Lower-cased, punctuation-free, used for clustering. Never shown. */
    normalizedTitle: text("normalized_title").notNull(),
    /** Only when the source's rights allow an excerpt. Null otherwise, never truncated-anyway. */
    excerpt: text("excerpt"),
    author: text("author"),
    language: text("language").notNull().default("en"),
    contentType: text("content_type").$type<ContentType>().notNull().default("report"),
    /** Only when the source's rights allow media reuse. */
    mediaUrl: text("media_url"),

    /* Time. Six different moments, never substituted for one another (blueprint §6.4). */
    /** When the source says it was published. Null when the source did not say: shown as "time not given". */
    publishedAt: optionalTimestamp("published_at"),
    sourceUpdatedAt: optionalTimestamp("source_updated_at"),
    /** When we first had it. */
    ingestedAt: namedTimestamp("ingested_at"),
    lastCheckedAt: namedTimestamp("last_checked_at"),

    /* Classification, from the source's own tags first and rules second. */
    categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
    /** ISO 3166-1 alpha-2 codes of where the EVENT is. */
    eventCountries: text("event_countries").array().notNull().default(sql`'{}'::text[]`),
    /** Indian state codes (config/regions.ts). */
    indianStates: text("indian_states").array().notNull().default(sql`'{}'::text[]`),
    /** People, organisations and places, as { kind, name }. */
    entities: jsonb("entities").$type<{ kind: string; name: string }[]>().notNull().default([]),
    /** Anything else the adapter preserved: GDELT themes, a feed's category. Never an article body. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    /** Failed validation in a way that is worth keeping to diagnose, never shown. */
    quarantined: boolean("quarantined").notNull().default(false),
    quarantineReason: text("quarantine_reason"),
    /** When the retention policy says this row goes. Null when the source keeps items with their story. */
    expiresAt: optionalTimestamp("expires_at"),
    search: tsvector("search").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('english', coalesce(${rawSourceItems.title}, '') || ' ' || coalesce(${rawSourceItems.publisherName}, ''))`,
    ),
  },
  (t) => [
    uniqueIndex("raw_items_source_item").on(t.sourceId, t.providerItemId),
    index("raw_items_url_hash").on(t.urlHash),
    index("raw_items_recent").on(t.ingestedAt.desc()),
    index("raw_items_published").on(t.publishedAt.desc()),
    index("raw_items_search").using("gin", t.search),
    index("raw_items_title_trgm").using("gin", sql`${t.normalizedTitle} gin_trgm_ops`),
    check("raw_items_content_vocab", inVocab("content_type", CONTENT_TYPES)),
  ],
);

/* -------------------------------------------------------------------- stories */

export const stories = pgTable(
  "stories",
  {
    id: primaryId(),
    /** The headline shown for the cluster: its best-attested item's original title, never a rewrite. */
    headline: text("headline").notNull(),
    /** The item the headline was taken from, so the headline is always attributable. */
    headlineItemId: uuid("headline_item_id"),
    primaryCategory: text("primary_category"),
    categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
    /** India when any item's event is in India; global otherwise. A story about both is India. */
    scope: text("scope").$type<StoryScope>().notNull().default("global"),
    eventCountries: text("event_countries").array().notNull().default(sql`'{}'::text[]`),
    indianStates: text("indian_states").array().notNull().default(sql`'{}'::text[]`),
    entities: jsonb("entities").$type<{ kind: string; name: string; count: number }[]>().notNull().default([]),
    state: text("state").$type<StoryState>().notNull().default("developing"),
    /** The clustering key: the normalized title's significant words, sorted. */
    signature: text("signature").notNull(),

    itemCount: integer("item_count").notNull().default(0),
    /** Distinct publisher domains. The number "N sources" means. */
    sourceCount: integer("source_count").notNull().default(0),
    officialCount: integer("official_count").notNull().default(0),

    firstSeenAt: namedTimestamp("first_seen_at"),
    /** The earliest publication time among the items, when any item gave one. */
    firstPublishedAt: optionalTimestamp("first_published_at"),
    /** The most recent evidence-backed change: a new item or a new update. */
    lastUpdatedAt: namedTimestamp("last_updated_at"),

    /* Latest scores, denormalised from story_scores for ordering. 0-100 integers. */
    heat: integer("heat").notNull().default(0),
    confidence: integer("confidence").notNull().default(0),
    importance: integer("importance").notNull().default(0),
    scoreVersion: text("score_version"),
    scoredAt: optionalTimestamp("scored_at"),

    search: tsvector("search").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('english', coalesce(${stories.headline}, ''))`,
    ),
  },
  (t) => [
    index("stories_recent").on(t.lastUpdatedAt.desc()),
    index("stories_scope_recent").on(t.scope, t.lastUpdatedAt.desc()),
    index("stories_heat").on(t.heat.desc(), t.lastUpdatedAt.desc()),
    index("stories_categories").using("gin", t.categories),
    index("stories_search").using("gin", t.search),
    index("stories_signature_trgm").using("gin", sql`${t.signature} gin_trgm_ops`),
    check("stories_state_vocab", inVocab("state", STORY_STATES)),
    check("stories_scope_vocab", inVocab("scope", STORY_SCOPES)),
    check("stories_scores_range", sql`"heat" BETWEEN 0 AND 100 AND "confidence" BETWEEN 0 AND 100 AND "importance" BETWEEN 0 AND 100`),
  ],
);

export const storyItems = pgTable(
  "story_items",
  {
    id: primaryId(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => rawSourceItems.id, { onDelete: "cascade" }),
    /** 0-100. How sure the clusterer was. Shown to admins; low values are candidates for a split. */
    associationConfidence: integer("association_confidence").notNull(),
    /** Which rule matched: "url", "title", "manual". */
    method: text("method").notNull(),
    associatedAt: namedTimestamp("associated_at"),
  },
  (t) => [
    // An item belongs to one story at a time. Re-clustering moves it.
    uniqueIndex("story_items_item").on(t.itemId),
    index("story_items_story").on(t.storyId, t.associatedAt.desc()),
  ],
);

export const storyUpdates = pgTable(
  "story_updates",
  {
    id: primaryId(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    /** The items that support this update. An update with none is not written. */
    evidenceItemIds: uuid("evidence_item_ids").array().notNull(),
    occurredAt: optionalTimestamp("occurred_at"),
    addedAt: namedTimestamp("added_at"),
    verification: text("verification").$type<UpdateVerification>().notNull().default("sourced"),
  },
  (t) => [
    index("story_updates_story").on(t.storyId, t.addedAt.desc()),
    check("story_updates_verification_vocab", inVocab("verification", UPDATE_VERIFICATIONS)),
    check("story_updates_has_evidence", sql`cardinality("evidence_item_ids") > 0`),
  ],
);

/**
 * Every scoring, kept, so a ranking change can be compared with what it
 * replaced and a "why trending" can be explained from the numbers that
 * produced it. Components are stored as integers 0-1000 (tenths of a point).
 */
export const storyScores = pgTable(
  "story_scores",
  {
    id: primaryId(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    heat: integer("heat").notNull(),
    heatComponents: jsonb("heat_components").$type<Record<string, number>>().notNull(),
    confidence: integer("confidence").notNull(),
    confidenceComponents: jsonb("confidence_components").$type<Record<string, number>>().notNull(),
    importance: integer("importance").notNull(),
    importanceComponents: jsonb("importance_components").$type<Record<string, number>>().notNull(),
    calculatedAt: namedTimestamp("calculated_at"),
  },
  (t) => [index("story_scores_story").on(t.storyId, t.calculatedAt.desc())],
);

/* ------------------------------------------------------------- ingestion runs */

export const ingestionRuns = pgTable(
  "ingestion_runs",
  {
    id: primaryId(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    trigger: text("trigger").notNull(),
    status: text("status").$type<RunStatus>().notNull().default("running"),
    startedAt: namedTimestamp("started_at"),
    finishedAt: optionalTimestamp("finished_at"),
    durationMs: integer("duration_ms"),
    httpStatus: integer("http_status"),
    fetched: integer("fetched").notNull().default(0),
    inserted: integer("inserted").notNull().default(0),
    duplicates: integer("duplicates").notNull().default(0),
    quarantined: integer("quarantined").notNull().default(0),
    clustered: integer("clustered").notNull().default(0),
    /** Short, safe messages. Never a response body, never a credential. */
    error: text("error"),
  },
  (t) => [
    index("ingestion_runs_source").on(t.sourceId, t.startedAt.desc()),
    index("ingestion_runs_recent").on(t.startedAt.desc()),
    check("ingestion_runs_status_vocab", inVocab("status", RUN_STATUSES)),
  ],
);
