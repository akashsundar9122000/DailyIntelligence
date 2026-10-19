/**
 * The reader vocabularies: what an interest can be about, the stances, the
 * feedback kinds, the report reasons. In a module with no database import, so
 * components can name them without reaching into the schema (which the lint
 * layering rule forbids); src/lib/db/schema/reader.ts builds its CHECK
 * constraints from these same arrays.
 */
export const INTEREST_KINDS = ["category", "region", "state", "entity", "keyword", "source"] as const;
export type InterestKind = (typeof INTEREST_KINDS)[number];

export const INTEREST_STANCES = ["follow", "mute", "block"] as const;
export type InterestStance = (typeof INTEREST_STANCES)[number];

export const INTEREST_ORIGINS = ["explicit", "inferred"] as const;
export type InterestOrigin = (typeof INTEREST_ORIGINS)[number];

export const FEEDBACK_KINDS = ["more", "less", "hide"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const REPORT_REASONS = ["misleading", "misattributed", "duplicate", "wrong_category", "harmful", "rights", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ["open", "actioned", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const NOTIFICATION_KINDS = ["breaking", "hot", "topic", "story_update", "morning_briefing", "evening_briefing", "digest", "test"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_CHANNELS = ["push", "email"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/**
 *   suppressed  the policy said no (quiet hours, the daily cap, a cooldown);
 *               kept with the reason, so "why did I not get it" has an answer
 *   queued      allowed, waiting to be sent
 *   sent        handed to the push service or the mail server -- which is all
 *               we can know; "delivered" is never claimed
 *   failed      the hand-over failed
 *   opened      the reader opened it
 */
export const NOTIFICATION_STATUSES = ["suppressed", "queued", "sent", "failed", "opened"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];
