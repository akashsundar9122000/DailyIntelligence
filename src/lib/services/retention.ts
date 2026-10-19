import "server-only";

import { sql } from "drizzle-orm";

import { execRows, withSystem } from "@/lib/db/scope";

import { recordedJob } from "./jobs";

/**
 * The retention purge, run daily: what is kept is what was promised.
 *
 * Items go when their source's retention runs out (GDELT's is thirty days),
 * or, for a source that names none, ninety days after their story last moved.
 * A story a reader saved is never purged, and neither is the item its
 * headline came from: a save that vanished because a timer ran would be the
 * paper deleting a reader's data. Bookkeeping goes by age. The audit and
 * security logs are the record, and are kept.
 */
export type RetentionSummary = {
  items: number;
  stories: number;
  aiRejected: number;
  notifications: number;
  ingestionRuns: number;
  jobRuns: number;
  mail: number;
  rateLimits: number;
};

const count = async (rows: Promise<unknown[]>) => (await rows).length;

export async function runRetention({ trigger }: { trigger: string }) {
  return recordedJob<RetentionSummary>("retention", trigger, () =>
    withSystem("retention", async (tx) => {
      const saved = sql`select story_id from bookmarks`;
      const items = await count(
        execRows(
          tx,
          sql`delete from raw_source_items i using sources s
               where s.id = i.source_id
                 and not exists (select 1 from stories st where st.headline_item_id = i.id and st.id in (${saved}))
                 and (
                   (s.retention_days is not null and i.ingested_at < now() - make_interval(days => s.retention_days))
                   or (s.retention_days is null and exists (
                         select 1 from story_items si join stories st on st.id = si.story_id
                          where si.item_id = i.id and st.last_updated_at < now() - interval '90 days'))
                 )
               returning i.id`,
        ),
      );
      // A story whose headline item went, but which kept others, takes its headline from its earliest remaining one:
      // left pointing at nothing, every page would hide it without a word.
      await tx.execute(
        sql`update stories st set headline_item_id = first.item_id, headline = first.title
              from (select distinct on (si.story_id) si.story_id, si.item_id, i.title from story_items si join raw_source_items i on i.id = si.item_id
                     order by si.story_id, si.associated_at) first
             where first.story_id = st.id and not exists (select 1 from raw_source_items h where h.id = st.headline_item_id)`,
      );
      // A story left with no items has nothing left to show; one a reader saved stays, its headline item with it.
      const stories = await count(
        execRows(tx, sql`delete from stories st where not exists (select 1 from story_items si where si.story_id = st.id) and st.id not in (${saved}) returning st.id`),
      );
      const aiRejected = await count(execRows(tx, sql`delete from ai_briefings where status in ('rejected', 'failed') and generated_at < now() - interval '30 days' returning id`));
      const notifications = await count(execRows(tx, sql`delete from notification_events where created_at < now() - interval '90 days' returning id`));
      const ingestionRuns = await count(execRows(tx, sql`delete from ingestion_runs where started_at < now() - interval '30 days' returning id`));
      const jobRuns = await count(execRows(tx, sql`delete from job_runs where started_at < now() - interval '60 days' and job <> 'retention' returning id`));
      const mail = await count(execRows(tx, sql`delete from email_outbox where status in ('SENT', 'DEV') and created_at < now() - interval '30 days' returning id`));
      const rateLimits = await count(execRows(tx, sql`delete from rate_limits where window_start < now() - interval '2 days' returning key`));
      return { items, stories, aiRejected, notifications, ingestionRuns, jobRuns, mail, rateLimits };
    }),
  );
}
