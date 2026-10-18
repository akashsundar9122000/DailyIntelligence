/**
 * Operational tables: the platform's own bookkeeping. All three are
 * system-only (see ../classification.ts) -- no user reads or writes them
 * directly.
 */
import { check, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { inVocab, namedTimestamp, optionalTimestamp, primaryId } from "./_shared";

/**
 * Fixed-window counters. Postgres rather than a cache service: the limiter must
 * hold across serverless instances, and an in-memory counter is per-instance,
 * which under load is no limit at all.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    /** An HMAC of the subject, never the subject. This table must not become a
     *  log of which addresses exist and where they were tried from. */
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true, mode: "date" }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const EMAIL_STATUSES = ["QUEUED", "SENT", "FAILED", "DEV"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

/**
 * Transactional outbox. A message is queued in the same transaction as the
 * change that caused it and delivered after commit, so a rollback cannot leave
 * a "your password was changed" email in flight for a change that never landed.
 * `DEV` marks a message that was recorded but, with no SMTP configured, not sent.
 */
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: primaryId(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    textBody: text("text_body").notNull(),
    template: text("template").notNull(),
    status: text("status").$type<EmailStatus>().notNull().default("QUEUED"),
    error: text("error"),
    createdAt: namedTimestamp("created_at"),
    sentAt: optionalTimestamp("sent_at"),
  },
  (t) => [
    check("email_outbox_status_vocab", inVocab("status", EMAIL_STATUSES)),
    index("email_outbox_recent").on(t.createdAt.desc()),
    index("email_outbox_to").on(t.toEmail, t.createdAt.desc()),
  ],
);

export const JOB_STATUSES = ["RUNNING", "OK", "PARTIAL", "FAILED", "SKIPPED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/**
 * One row per invocation of a background job, written BEFORE the work starts
 * and finalised after. A job that reports only when it finds something looks
 * identical to one that has stopped running; with a row per run, silence is
 * visible as a gap, and a crash is visible as a RUNNING row that never closed.
 */
export const jobRuns = pgTable(
  "job_runs",
  {
    id: primaryId(),
    job: text("job").notNull(),
    trigger: text("trigger").notNull(),
    status: text("status").$type<JobStatus>().notNull().default("RUNNING"),
    startedAt: namedTimestamp("started_at"),
    finishedAt: optionalTimestamp("finished_at"),
    /** Counts and other run facts. Never payloads, never personal data. */
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    error: text("error"),
  },
  (t) => [
    check("job_runs_status_vocab", inVocab("status", JOB_STATUSES)),
    index("job_runs_by_job").on(t.job, t.startedAt.desc()),
  ],
);
