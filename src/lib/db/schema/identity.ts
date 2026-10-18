/**
 * Identity tables.
 *
 * The first five are owned by the authentication library and written only
 * through its own database role (see lib/auth/auth.ts). Their PROPERTY names
 * are the library's field names and must not be renamed: the adapter looks
 * columns up by them, and a mismatch is a runtime error on first sign-in, not a
 * build error.
 *
 * `security_events` is ours: an append-only, hash-chained record of what
 * happened to an account.
 */
import { bigint, boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import type { SecurityEventKind } from "@/lib/auth/security-event-kinds";

import { namedTimestamp, optionalTimestamp } from "./_shared";

export { SECURITY_EVENT_KINDS, type SecurityEventKind } from "@/lib/auth/security-event-kinds";

const stamps = () => ({
  createdAt: namedTimestamp("created_at"),
  updatedAt: namedTimestamp("updated_at"),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    ...stamps(),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: namedTimestamp("expires_at"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    /**
     * When this session last re-proved who is using it. Sensitive actions
     * require it to be recent. Not the library's "fresh session", which only
     * measures time since sign-in and cannot be renewed without signing out.
     */
    stepUpAt: optionalTimestamp("step_up_at"),
    ...stamps(),
  },
  (t) => [
    uniqueIndex("sessions_token_key").on(t.token),
    index("sessions_user_idx").on(t.userId),
    index("sessions_expires_idx").on(t.expiresAt),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: optionalTimestamp("access_token_expires_at"),
    refreshTokenExpiresAt: optionalTimestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    ...stamps(),
  },
  (t) => [
    index("accounts_user_idx").on(t.userId),
    uniqueIndex("accounts_provider_account_key").on(t.providerId, t.accountId),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: namedTimestamp("expires_at"),
    ...stamps(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier), index("verifications_expires_idx").on(t.expiresAt)],
);

/** The authentication library's own request counters. Ours are in `rate_limits`. */
export const authRateLimits = pgTable(
  "auth_rate_limits",
  {
    id: uuid("id").primaryKey(),
    key: text("key").notNull(),
    count: integer("count").notNull(),
    lastRequest: bigint("last_request", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("auth_rate_limits_key").on(t.key)],
);

/**
 * What happened to an account, append-only. Each row carries the hash of the
 * one before it (set by a trigger, not by the application), so a row that is
 * edited or removed breaks the chain from that point on and can be detected.
 * The runtime role can insert and read; it has no policy to update or delete.
 */
export const securityEvents = pgTable(
  "security_events",
  {
    id: uuid("id").primaryKey(),
    /** Insertion order within the table. Ids are time-sortable but two in one millisecond are not ordered. */
    seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<SecurityEventKind>().notNull(),
    /** Coarse context only: a network prefix and a browser family. Never a full address. */
    detail: jsonb("detail").$type<Record<string, string>>().notNull().default({}),
    createdAt: namedTimestamp("created_at"),
    prevHash: text("prev_hash").notNull().default(""),
    hash: text("hash").notNull().default(""),
  },
  (t) => [index("security_events_user_idx").on(t.userId, t.seq.desc())],
);
