import "server-only";

import { sql } from "drizzle-orm";
import { cache } from "react";

import { DatabaseNotConfigured } from "@/lib/db/client";
import { execRows, withPublic } from "@/lib/db/scope";
import { isoInstant } from "@/lib/db/sql";

export type EditionStatus = {
  /** When any enabled source was last fetched successfully. Null before the first fetch. */
  updatedAt: string | null;
  /** Enabled sources, and how many of those are healthy right now. */
  sources: number;
  healthy: number;
  /** False when there is no database to ask: the strip then says so instead of inventing a time. */
  available: boolean;
};

/**
 * What the edition strip says about freshness. Taken from the sources' own
 * records, never from the clock: "Updated 3:42 pm" means a source answered at
 * 3:42, not that the page was drawn then (blueprint §6.4).
 */
export const getEditionStatus = cache(async (): Promise<EditionStatus> => {
  try {
    const rows = await withPublic((tx) =>
      execRows<{ updated: string | null; sources: number; healthy: number }>(
        tx,
        sql`select ${isoInstant(sql`max(last_success_at)`)} as updated,
                   count(*)::int as sources,
                   count(*) filter (where health_status = 'healthy')::int as healthy
              from sources where enabled`,
      ),
    );
    const row = rows[0];
    return { updatedAt: row?.updated ?? null, sources: row?.sources ?? 0, healthy: row?.healthy ?? 0, available: true };
  } catch (error) {
    if (error instanceof DatabaseNotConfigured) return { updatedAt: null, sources: 0, healthy: 0, available: false };
    throw error;
  }
});
