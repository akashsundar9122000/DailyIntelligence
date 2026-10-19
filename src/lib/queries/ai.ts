import "server-only";

import { sql } from "drizzle-orm";
import { cache } from "react";

import type { Explainer } from "@/lib/ai/explainer";
import { DatabaseNotConfigured } from "@/lib/db/client";
import { execRows, withPublic } from "@/lib/db/scope";
import { isoInstant, showableSource, uuidArray } from "@/lib/db/sql";

/*
 * The AI output a reader may see. Row security already hides everything that
 * is not `ready` (drizzle/migrations/0004_ai_access_rules.sql); the status test
 * is repeated here so the query says what it means.
 */

export type StoryExplainer = {
  content: Explainer & { textRead: boolean };
  model: string;
  promptVersion: string;
  generatedAt: string;
  sourceItemIds: string[];
  /** True when the explainer was written from a bundle the story has since added to. */
  stale: boolean;
};

export const explainerFor = cache(async (storyId: string): Promise<StoryExplainer | null> => {
  try {
    return await withPublic(async (tx) => {
      const row = (
        await execRows<Omit<StoryExplainer, "stale"> & { itemCount: number }>(
          tx,
          sql`select b.content, b.model, b.prompt_version as "promptVersion", ${isoInstant(sql`b.generated_at`)} as "generatedAt",
                     b.source_item_ids as "sourceItemIds", st.item_count as "itemCount"
                from ai_briefings b join stories st on st.id = b.story_id
                join raw_source_items i on i.id = st.headline_item_id join sources src on src.id = i.source_id
               where b.story_id = ${storyId}::uuid and b.kind = 'story_explainer' and b.status = 'ready' and ${showableSource()}
               order by b.generated_at desc limit 1`,
        )
      )[0];
      if (!row) return null;
      // A withdrawn source's items are not in the list any more; an explainer that cited one is not shown.
      const live = await execRows<{ id: string }>(
        tx,
        sql`select i.id from raw_source_items i join sources src on src.id = i.source_id
             where i.id = any(${uuidArray(row.sourceItemIds)}) and ${showableSource()} and not i.quarantined`,
      );
      if (live.length !== row.sourceItemIds.length) return null;
      const { itemCount, ...explainer } = row;
      return { ...explainer, stale: itemCount > row.sourceItemIds.length };
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfigured) return null;
    throw error;
  }
});

export type EditionBriefing = {
  key: string;
  slot: "morning" | "evening";
  lines: { ref: string; text: string; storyId: string; headline: string }[];
  model: string;
  generatedAt: string;
};

/** The newest ready edition briefing, with each line's story still showable. */
export const latestEditionBriefing = cache(async (): Promise<EditionBriefing | null> => {
  try {
    return await withPublic(async (tx) => {
      const row = (
        await execRows<{ key: string; content: { slot: "morning" | "evening"; lines: { ref: string; text: string; storyId: string }[] }; model: string; generatedAt: string }>(
          tx,
          sql`select edition_key as key, content, model, ${isoInstant(sql`generated_at`)} as "generatedAt"
                from ai_briefings where kind = 'edition_briefing' and status = 'ready' and generated_at > now() - interval '30 hours'
               order by generated_at desc limit 1`,
        )
      )[0];
      if (!row) return null;
      const ids = row.content.lines.map((line) => line.storyId);
      const stories = await execRows<{ id: string; headline: string }>(
        tx,
        sql`select st.id, st.headline from stories st join raw_source_items i on i.id = st.headline_item_id join sources src on src.id = i.source_id
             where st.id = any(${uuidArray(ids)}) and ${showableSource()}`,
      );
      const headline = new Map(stories.map((story) => [story.id, story.headline]));
      // A line whose story was withdrawn goes with it; the rest of the briefing stands.
      const lines = row.content.lines.filter((line) => headline.has(line.storyId)).map((line) => ({ ...line, headline: headline.get(line.storyId)! }));
      return lines.length ? { key: row.key, slot: row.content.slot, lines, model: row.model, generatedAt: row.generatedAt } : null;
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfigured) return null;
    throw error;
  }
});

/** Each story's newest checked one-minute summary, for lists that show a line under a headline. */
export async function oneMinuteFor(storyIds: string[]): Promise<Map<string, { text: string; cites: string[] }[]>> {
  if (storyIds.length === 0) return new Map();
  try {
    const rows = await withPublic((tx) =>
      execRows<{ storyId: string; oneMinute: { text: string; cites: string[] }[] }>(
        tx,
        sql`select distinct on (story_id) story_id as "storyId", content->'oneMinute' as "oneMinute"
              from ai_briefings where kind = 'story_explainer' and status = 'ready' and story_id = any(${uuidArray(storyIds)})
             order by story_id, generated_at desc`,
      ),
    );
    return new Map(rows.map((row) => [row.storyId, row.oneMinute]));
  } catch (error) {
    if (error instanceof DatabaseNotConfigured) return new Map();
    throw error;
  }
}
