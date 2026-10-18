import "server-only";

import { sql } from "drizzle-orm";
import { cache } from "react";

import { DatabaseNotConfigured } from "@/lib/db/client";
import { execRows, withPublic } from "@/lib/db/scope";
import { isoInstant, showableSource } from "@/lib/db/sql";

export type FrontPageHeadline = {
  id: string;
  /** The headline item's ORIGINAL title, attributable to `publisher`. */
  headline: string;
  publisher: string;
  category: string | null;
  scope: "india" | "global";
  sourceCount: number;
  publishedAt: string | null;
  lastUpdatedAt: string;
};

/**
 * The few most important stories right now, for public pages (the landing
 * page and the sign-in page's front page). Ordered by importance, then heat,
 * then recency, within the last 36 hours.
 *
 * Only stories whose headline item comes from a source cleared for display.
 * Empty before the first ingestion, and the callers say so rather than filling
 * the space.
 */
export const frontPageHeadlines = cache(async (limit = 5): Promise<FrontPageHeadline[]> => {
  try {
    return await withPublic((tx) =>
      execRows<FrontPageHeadline>(
        tx,
        sql`select st.id, i.title as headline, coalesce(i.publisher_name, i.publisher_domain) as publisher,
                   st.primary_category as category, st.scope, st.source_count as "sourceCount",
                   ${isoInstant(sql`st.first_published_at`)} as "publishedAt", ${isoInstant(sql`st.last_updated_at`)} as "lastUpdatedAt"
              from stories st
              join raw_source_items i on i.id = st.headline_item_id
              join sources src on src.id = i.source_id
             where ${showableSource()} and not i.quarantined
               and st.last_updated_at > now() - interval '36 hours'
             order by st.importance desc, st.heat desc, st.last_updated_at desc
             limit ${limit}`,
      ),
    );
  } catch (error) {
    if (error instanceof DatabaseNotConfigured) return [];
    throw error;
  }
});
