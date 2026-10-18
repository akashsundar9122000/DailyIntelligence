import { jsonb, pgTable, uuid } from "drizzle-orm/pg-core";

import { namedTimestamp } from "./_shared";
import { users } from "./identity";

/**
 * One row per user, holding only the preferences that differ from the
 * defaults. Kept off the `users` table on purpose: that table belongs to the
 * authentication library, and anything on it is returned inside every session
 * lookup.
 */
export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: namedTimestamp("updated_at"),
});
