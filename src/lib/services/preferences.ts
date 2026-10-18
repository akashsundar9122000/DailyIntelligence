import "server-only";

import { sql } from "drizzle-orm";

import { execRows, withUser } from "@/lib/db/scope";
import { resolvePreferences, sparsePreferences, type Preferences } from "@/lib/settings/preferences";

/**
 * Merge a validated patch into a user's stored preferences and return the
 * result AS READ BACK from the row, not as computed here: the caller shows
 * what the database holds, so a write that changed nothing cannot look like one
 * that worked.
 *
 * The row is locked for the merge. Two tabs saving different keys at once would
 * otherwise each read the old object and the later write would undo the earlier.
 */
export async function updatePreferences(userId: string, patch: Partial<Preferences>): Promise<Preferences> {
  return withUser(userId, async (tx) => {
    await tx.execute(
      sql`insert into user_settings (user_id) values (${userId}::uuid) on conflict (user_id) do nothing`,
    );
    const current = await execRows<{ preferences: unknown }>(
      tx,
      sql`select preferences from user_settings where user_id = ${userId}::uuid for update`,
    );
    const next = sparsePreferences({ ...resolvePreferences(current[0]?.preferences), ...patch });
    const written = await execRows<{ preferences: unknown }>(
      tx,
      sql`update user_settings set preferences = ${JSON.stringify(next)}::jsonb, updated_at = now()
          where user_id = ${userId}::uuid returning preferences`,
    );
    return resolvePreferences(written[0]?.preferences);
  });
}
