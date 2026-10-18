/**
 * The kinds of event the security log records.
 *
 * In a module of its own, with no database import, so the page that lists the
 * log can name the kinds without importing the schema (which pages may not).
 */
export const SECURITY_EVENT_KINDS = [
  "signed_in",
  "signed_out",
  "session_revoked",
  "other_sessions_revoked",
  "step_up",
  "data_exported",
  "account_deleted",
] as const;
export type SecurityEventKind = (typeof SECURITY_EVENT_KINDS)[number];
