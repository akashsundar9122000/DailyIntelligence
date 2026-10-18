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
