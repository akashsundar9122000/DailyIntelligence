import "server-only";

import { sql } from "drizzle-orm";
import { cache } from "react";

import { execRows, withUser } from "@/lib/db/scope";
import { resolvePreferences, type Preferences } from "@/lib/settings/preferences";

/** A user's preferences, defaults filled in. Cached for the length of one request. */
export const getPreferences = cache(async (userId: string): Promise<Preferences> => {
  const rows = await withUser(userId, (tx) =>
    execRows<{ preferences: unknown }>(tx, sql`select preferences from user_settings where user_id = ${userId}::uuid`),
  );
  return resolvePreferences(rows[0]?.preferences);
});
