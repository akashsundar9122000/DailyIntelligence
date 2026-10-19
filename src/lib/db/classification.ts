/**
 * Every table, and who may touch it.
 *
 *   owner      belongs to one user. FORCE RLS on app.user_id; another user's
 *              row is invisible, and the route answers 404, never 403.
 *   reference  shared news data every reader reads (sources, items, stories).
 *              Readable by all; written only by the system. What may be SHOWN
 *              is narrower, and decided by lib/news/rights.ts.
 *   system     the platform's own bookkeeping. Invisible outside withSystem().
 *   auth       owned by the authentication library and reached through its
 *              own role, not through these scopes.
 *
 * tests/integration/isolation.conformance.test.ts reads the live catalogue and
 * fails when a table exists that is not listed here, so a new table cannot be
 * added without deciding this.
 */
export type TableClass = "owner" | "reference" | "system" | "auth";

export const TABLE_CLASSES = {
  users: "auth",
  sessions: "auth",
  accounts: "auth",
  verifications: "auth",
  auth_rate_limits: "auth",
  security_events: "owner",
  user_settings: "owner",
  reader_profiles: "owner",
  user_interests: "owner",
  bookmarks: "owner",
  collections: "owner",
  collection_items: "owner",
  user_story_feedback: "owner",
  reading_history: "owner",
  content_reports: "owner",
  sources: "reference",
  raw_source_items: "reference",
  stories: "reference",
  story_items: "reference",
  story_updates: "reference",
  story_scores: "reference",
  ai_briefings: "reference",
  push_subscriptions: "owner",
  notification_events: "owner",
  ops_switches: "reference",
  social_posts: "reference",
  story_embeddings: "reference",
  ingestion_runs: "reference",
  rate_limits: "system",
  email_outbox: "system",
  job_runs: "system",
  audit_events: "system",
} as const satisfies Record<string, TableClass>;

export type ClassifiedTable = keyof typeof TABLE_CLASSES;
