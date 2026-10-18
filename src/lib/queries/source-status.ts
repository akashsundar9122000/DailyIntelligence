import "server-only";

import { sql } from "drizzle-orm";

import { DatabaseNotConfigured } from "@/lib/db/client";
import { execRows, withPublic } from "@/lib/db/scope";
import { isoInstant } from "@/lib/db/sql";
import type { HealthStatus } from "@/lib/db/schema/news";

export type SourceStatusRow = {
  key: string;
  name: string;
  enabled: boolean;
  health: HealthStatus;
  lastSuccessAt: string | null;
  newestItemAt: string | null;
  pollIntervalSeconds: number;
};

/**
 * Public freshness, per source: when it last answered and how recent its
 * newest item is. Counts and times only -- no errors, no URLs fetched, no
 * operational detail an attacker could use. Those are on the admin page.
 */
export async function sourceStatus(): Promise<SourceStatusRow[] | null> {
  try {
    return await withPublic((tx) =>
      execRows<SourceStatusRow>(
        tx,
        sql`select s.key, s.name, s.enabled, s.health_status as health,
                   ${isoInstant(sql`s.last_success_at`)} as "lastSuccessAt", ${isoInstant(sql`s.newest_item_at`)} as "newestItemAt",
                   s.poll_interval_seconds as "pollIntervalSeconds"
              from sources s where s.rights_status = 'cleared' order by s.priority, s.name`,
      ),
    );
  } catch (error) {
    if (error instanceof DatabaseNotConfigured) return null;
    throw error;
  }
}
