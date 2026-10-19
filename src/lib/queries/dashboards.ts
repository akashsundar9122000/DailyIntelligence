import "server-only";

import { sql } from "drizzle-orm";
import { cache } from "react";

import { DatabaseNotConfigured } from "@/lib/db/client";
import { execRows, withPublic, withUser } from "@/lib/db/scope";
import { showableSource } from "@/lib/db/sql";

/*
 * The numbers behind the dashboards. Every one is a count of what this paper
 * holds -- never a claim about all the news in the world -- and every one
 * goes through the same display rule as the stories it counts.
 */

async function read<T>(query: Parameters<typeof execRows>[1]): Promise<T[]> {
  try {
    return await withPublic((tx) => execRows<T>(tx, query));
  } catch (error) {
    if (error instanceof DatabaseNotConfigured) return [];
    throw error;
  }
}

const SHOWN = sql`from stories st join raw_source_items i on i.id = st.headline_item_id join sources src on src.id = i.source_id where ${showableSource()}`;

export type DayInNumbers = { stories: number; india: number; global: number; publishers: number; official: number; corroborated: number };

/** The last 24 hours: how many stories, where, from how many publishers, and how many had a second source. */
export const dayInNumbers = cache(async (): Promise<DayInNumbers> => {
  const rows = await read<DayInNumbers>(
    sql`select count(*)::int as stories,
               count(*) filter (where st.scope = 'india')::int as india,
               count(*) filter (where st.scope = 'global')::int as global,
               (select count(distinct r.publisher_domain)::int from raw_source_items r join sources src on src.id = r.source_id
                 where ${showableSource()} and r.ingested_at > now() - interval '24 hours') as publishers,
               count(*) filter (where st.official_count > 0)::int as official,
               count(*) filter (where st.source_count >= 2)::int as corroborated
          ${SHOWN} and st.last_updated_at > now() - interval '24 hours'`,
  );
  return rows[0] ?? { stories: 0, india: 0, global: 0, publishers: 0, official: 0, corroborated: 0 };
});

export type HeatmapCell = { category: string; window: number; stories: number };

/**
 * Sections against the last day in four six-hour windows: how many stories in
 * each section were first seen in each window. Window 0 is the oldest. Counts,
 * so a quiet section is a zero, not a gap.
 */
export const topicHeatmap = cache(async (): Promise<HeatmapCell[]> =>
  read<HeatmapCell>(
    sql`select st.primary_category as category, (3 - floor(extract(epoch from now() - st.first_seen_at) / 21600))::int as window, count(*)::int as stories
          ${SHOWN} and st.first_seen_at > now() - interval '24 hours' and st.primary_category is not null
         group by 1, 2`,
  ),
);

export type InterestActivity = { value: string; label: string; stories: number; hot: number };

/** For each section the reader follows: stories in the last day, and how many of them are hot. */
export async function interestActivity(userId: string): Promise<InterestActivity[]> {
  const follows = await withUser(userId, (tx) =>
    execRows<{ value: string; label: string }>(tx, sql`select value, label from user_interests where user_id = ${userId}::uuid and kind = 'category' and stance = 'follow' order by priority desc, position`),
  );
  const out: InterestActivity[] = [];
  for (const follow of follows.slice(0, 8)) {
    const row = (
      await read<{ stories: number; hot: number }>(
        sql`select count(*)::int as stories, count(*) filter (where st.heat >= 60)::int as hot
              ${SHOWN} and st.last_updated_at > now() - interval '24 hours' and st.categories @> array[${follow.value}]::text[]`,
      )
    )[0];
    out.push({ ...follow, stories: row?.stories ?? 0, hot: row?.hot ?? 0 });
  }
  return out;
}

export type ReadingNumbers = { saved: number; unread: number; collections: number; readWeek: number; historyOn: boolean };

/** The reader's own reading: what is saved and unread, and what was opened this week (only while history is on). */
export async function readingNumbers(userId: string, historyOn: boolean): Promise<ReadingNumbers> {
  const row = (
    await withUser(userId, (tx) =>
      execRows<Omit<ReadingNumbers, "historyOn">>(
        tx,
        sql`select (select count(*)::int from bookmarks where user_id = ${userId}::uuid) as saved,
                   (select count(*)::int from bookmarks where user_id = ${userId}::uuid and read_at is null) as unread,
                   (select count(*)::int from collections where user_id = ${userId}::uuid) as collections,
                   (select count(*)::int from reading_history where user_id = ${userId}::uuid and last_opened_at > now() - interval '7 days') as "readWeek"`,
      ),
    )
  )[0]!;
  return { ...row, historyOn };
}
