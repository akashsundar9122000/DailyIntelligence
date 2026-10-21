import "server-only";

import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { categoryFor } from "@/config/categories";
import { BRIEFING_PROMPT_VERSION, writeBriefing, type BriefingStory } from "@/lib/ai/briefing";
import { bundleHash, loadBundle } from "@/lib/ai/bundle";
import { claimsOf, EXPLAINER_PROMPT_VERSION, readArticleText, writeExplainer, type Explainer, type StoryBundle } from "@/lib/ai/explainer";
import { nvidiaEmbedder, vectorLiteral, type Embedder } from "@/lib/ai/embeddings";
import { AiOutOfTime, AiUnavailable, nvidiaModel, type ChatModel } from "@/lib/ai/nvidia-client";
import type { BriefingStatus } from "@/lib/db/schema/news";
import { execRows, withSystem } from "@/lib/db/scope";
import { textArray, uuidArray } from "@/lib/db/sql";
import { aiConfigured, env } from "@/lib/env";
import { istDay } from "@/lib/format/date";

import { recordedJob } from "./jobs";
import { isOn } from "./ops";

/*
 * The AI pass, run by the scheduler after each tick: explainers for the
 * stories that are due, and the edition briefing when its slot comes round.
 *
 * Three rules shape it:
 *   - A model call never happens inside a database transaction. A call can
 *     take twenty seconds; holding Neon's one pooled connection for that would
 *     stall every reader. Read, close, call, then open again to write.
 *   - The same records are never sent twice. An explainer is due when its
 *     story's bundle changed; a rejection for a bundle stands until the bundle
 *     changes, because asking again for the same records is asking the model to
 *     try harder at saying what they do not say.
 *   - A daily ceiling on calls, so a runaway loop costs a day's budget at most.
 */

const PER_RUN = 8;
const PARALLEL = 3;
/** A model that could not be reached is asked again for the same records, but not before this. */
const RETRY_FAILED_AFTER_MS = 60 * 60_000;
const BRIEFING_STORIES = 8;
const MAX_BRIEFING_ATTEMPTS = 3;

// Kept exported from here for its existing callers; it lives with the other date helpers.
export { istDay };

/**
 * Which edition briefing is current: the morning one from 06:00 IST, the
 * evening one from 18:00, and before 06:00 still the previous evening's.
 */
export function briefingSlot(now: Date): { key: string; slot: "morning" | "evening" } {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(now)) % 24;
  if (hour >= 18) return { key: `${istDay(now)}:evening`, slot: "evening" };
  if (hour >= 6) return { key: `${istDay(now)}:morning`, slot: "morning" };
  return { key: `${istDay(new Date(now.getTime() - 24 * 3_600_000))}:evening`, slot: "evening" };
}

type Outcome = "ready" | "rejected" | "failed" | "skipped";
export type EnrichSummary = {
  configured: boolean;
  /** Switched off in the press room. */
  paused?: boolean;
  explained: number;
  rejected: number;
  failed: number;
  dailyCallsLeft: number;
  briefing: { key: string; status: Outcome | "not due" } | null;
  /** Headlines embedded for search by meaning this run. */
  embedded?: number;
};

async function callsLeftToday(now: Date): Promise<number> {
  const used = (
    await withSystem("ai.budget", (tx) =>
      execRows<{ used: number }>(
        tx,
        sql`select count(*)::int as used from ai_briefings
             where status in ('ready', 'review', 'rejected') and (generated_at at time zone 'Asia/Kolkata')::date = ${istDay(now)}::date`,
      ),
    )
  )[0]!.used;
  return Math.max(0, env().AI_DAILY_LIMIT - used);
}

/** Stories worth explaining: corroborated or official, recent, most important first, whose records changed since their last attempt. */
async function dueStories(now: Date): Promise<string[]> {
  const rows = await withSystem("ai.due", (tx) =>
    execRows<{ id: string; lastStatus: string | null; lastHash: string | null; lastAt: string | null }>(
      tx,
      sql`select st.id, last.status as "lastStatus", last.bundle_hash as "lastHash", last.generated_at::text as "lastAt"
            from stories st
            left join lateral (
              select status, bundle_hash, generated_at from ai_briefings b
               where b.story_id = st.id and b.kind = 'story_explainer' order by generated_at desc limit 1
            ) last on true
           where st.last_updated_at > now() - interval '36 hours'
             and (st.source_count >= 2 or st.official_count >= 1)
           order by st.importance desc, st.heat desc
           limit 40`,
    ),
  );
  // Whether the BUNDLE changed is known only once it is built; this is the cheap first cut.
  return rows
    .filter((row) => !(row.lastStatus === "failed" && row.lastAt && now.getTime() - new Date(row.lastAt).getTime() < RETRY_FAILED_AFTER_MS))
    .map((row) => row.id);
}

async function store(row: {
  kind: "story_explainer" | "edition_briefing";
  storyId?: string;
  editionKey?: string;
  status: BriefingStatus;
  model: string | null;
  promptVersion: string;
  hash: string;
  itemIds: string[];
  content: unknown;
  rejection: string | null;
  usage: { promptTokens: number; completionTokens: number } | null;
  sections?: string[];
}): Promise<void> {
  await withSystem("ai.store", async (tx) => {
    await tx.execute(
      sql`insert into ai_briefings (id, kind, story_id, edition_key, status, model, prompt_version, bundle_hash, source_item_ids, content, rejection, prompt_tokens, completion_tokens)
          values (${uuidv7()}::uuid, ${row.kind}, ${row.storyId ?? null}::uuid, ${row.editionKey ?? null}, ${row.status}, ${row.model}, ${row.promptVersion}, ${row.hash},
                  ${uuidArray(row.itemIds)}, ${row.content === null ? null : JSON.stringify(row.content)}::jsonb, ${row.rejection},
                  ${row.usage?.promptTokens ?? null}, ${row.usage?.completionTokens ?? null})`,
    );
    // Sections from the model only where the rules found none, and marked as the model's so the page can say so.
    if (row.storyId && row.sections?.length) {
      await tx.execute(
        sql`update stories set categories = ${textArray(row.sections)}, primary_category = ${row.sections[0]!}, categories_by = 'ai'
             where id = ${row.storyId}::uuid and cardinality(categories) = 0`,
      );
    }
  });
}

/** Held for an editor: the stories where a wrong sentence would cost most, or that rest on least. */
export function needsReview(story: { importance: number; confidence: number }): boolean {
  return story.importance >= 80 || story.confidence < 35;
}

async function explain(model: ChatModel, storyId: string): Promise<Outcome> {
  const bundle = await withSystem("ai.bundle", (tx) => loadBundle(tx, storyId));
  if (!bundle || bundle.records.length === 0) return "skipped";
  const hash = bundleHash(bundle);
  const previous = await withSystem("ai.previous", (tx) =>
    execRows<{ status: string }>(
      tx,
      sql`select status from ai_briefings where story_id = ${storyId}::uuid and kind = 'story_explainer' and bundle_hash = ${hash}
           and status in ('ready', 'review', 'rejected') limit 1`,
    ),
  );
  if (previous.length) return "skipped";
  const story = (await withSystem("ai.story", (tx) => execRows<{ importance: number; confidence: number }>(tx, sql`select importance, confidence from stories where id = ${storyId}::uuid`)))[0];
  return explainBundle(model, bundle, hash, env().EDITORIAL_REVIEW === "1" && Boolean(story && needsReview(story)));
}

async function explainBundle(model: ChatModel, bundle: StoryBundle, hash: string, hold = false): Promise<Outcome> {
  const base = { kind: "story_explainer" as const, storyId: bundle.storyId, promptVersion: EXPLAINER_PROMPT_VERSION, hash, itemIds: bundle.records.map((record) => record.itemId) };
  try {
    const outcome = await writeExplainer(model, bundle);
    if (outcome.ok) {
      // A held explainer's section suggestion waits with it: applied when an editor approves (services/admin.ts).
      const sections = bundle.categories.length === 0 && !hold ? outcome.value.categories.filter((slug) => categoryFor(slug)) : [];
      // Whether any article text was read is part of the record: it bounds what the explainer could know, and the page says so.
      await store({ ...base, status: hold ? "review" : "ready", model: outcome.model, content: { ...outcome.value, textRead: readArticleText(bundle) }, rejection: null, usage: outcome.usage, sections });
      return "ready";
    }
    await store({ ...base, status: "rejected", model: outcome.model, content: outcome.raw ?? null, rejection: outcome.reason.slice(0, 1000), usage: outcome.usage });
    return "rejected";
  } catch (error) {
    // Out of this run's time: nothing happened to record, and the story is simply due again next run.
    if (error instanceof AiOutOfTime) return "skipped";
    if (!(error instanceof AiUnavailable)) throw error;
    await store({ ...base, status: "failed", model: null, content: null, rejection: "The model could not be reached.", usage: null });
    return "failed";
  }
}

const EMBED_BATCH = 32;
const EMBED_BATCHES_PER_RUN = 4;

/**
 * Embed the headlines of recent stories that have no vector, or whose headline
 * changed since theirs. Headlines only -- the page already shows them -- and
 * the hash of exactly what was embedded is kept, so the same headline is
 * never embedded twice.
 */
async function embedHeadlines(embedder: Embedder, deadline: number): Promise<number> {
  let done = 0;
  for (let batch = 0; batch < EMBED_BATCHES_PER_RUN && deadline - Date.now() > 8_000; batch++) {
    const due = await withSystem("ai.embed.due", (tx) =>
      execRows<{ id: string; headline: string; hash: string }>(
        tx,
        sql`select st.id, st.headline, md5(st.headline) as hash from stories st
              left join story_embeddings se on se.story_id = st.id
             where st.last_updated_at > now() - interval '48 hours' and (se.story_id is null or se.text_hash <> md5(st.headline) or se.model <> ${embedder.model})
             order by st.importance desc, st.last_updated_at desc
             limit ${EMBED_BATCH}`,
      ),
    );
    if (due.length === 0) break;
    const vectors = await embedder.embed(due.map((story) => story.headline), "passage");
    await withSystem("ai.embed.store", async (tx) => {
      for (const [index, story] of due.entries()) {
        await tx.execute(
          sql`insert into story_embeddings (story_id, model, text_hash, embedding) values (${story.id}::uuid, ${embedder.model}, ${story.hash}, ${vectorLiteral(vectors[index]!)}::halfvec)
              on conflict (story_id) do update set model = excluded.model, text_hash = excluded.text_hash, embedding = excluded.embedding, embedded_at = now()`,
        );
      }
    });
    done += due.length;
  }
  return done;
}

async function editionBriefing(model: ChatModel, now: Date, deadline: number): Promise<{ key: string; status: Outcome | "not due" }> {
  const { key, slot } = briefingSlot(now);
  const attempts = await withSystem("ai.briefing.attempts", (tx) =>
    execRows<{ ready: number; tries: number }>(
      tx,
      sql`select count(*) filter (where status = 'ready')::int as ready, count(*)::int as tries from ai_briefings where kind = 'edition_briefing' and edition_key = ${key}`,
    ),
  );
  if (attempts[0]!.ready > 0 || attempts[0]!.tries >= MAX_BRIEFING_ATTEMPTS || deadline - Date.now() < 15_000) return { key, status: "not due" };

  const picked = await withSystem("ai.briefing.stories", (tx) =>
    execRows<{ storyId: string; headline: string; content: Explainer; itemIds: string[] }>(
      tx,
      sql`select st.id as "storyId", st.headline, b.content, b.source_item_ids as "itemIds"
            from stories st
            join lateral (select content, source_item_ids from ai_briefings b where b.story_id = st.id and b.kind = 'story_explainer' and b.status = 'ready'
                           order by generated_at desc limit 1) b on true
           where st.last_updated_at > now() - interval '18 hours'
           order by st.importance desc, st.heat desc
           limit ${BRIEFING_STORIES}`,
    ),
  );
  // Fewer than three explained stories is not a briefing; it is a list. Wait for the next tick.
  if (picked.length < 3) return { key, status: "not due" };
  const stories: BriefingStory[] = picked.map((story, index) => ({
    ref: `B${index + 1}`,
    storyId: story.storyId,
    headline: story.headline,
    text: `headline: ${story.headline} | note: ${claimsOf(story.content).map((claim) => claim.text).join(" ")}`,
  }));
  const base = {
    kind: "edition_briefing" as const,
    editionKey: key,
    promptVersion: BRIEFING_PROMPT_VERSION,
    hash: stories.map((story) => story.storyId).join(","),
    itemIds: [...new Set(picked.flatMap((story) => story.itemIds))],
  };
  try {
    const outcome = await writeBriefing(model, slot, stories);
    if (outcome.ok) {
      const lines = outcome.value.lines.map((line) => ({ ...line, storyId: stories.find((story) => story.ref === line.ref)!.storyId }));
      await store({ ...base, status: "ready", model: outcome.model, content: { slot, lines }, rejection: null, usage: outcome.usage });
      return { key, status: "ready" };
    }
    await store({ ...base, status: "rejected", model: outcome.model, content: outcome.raw ?? null, rejection: outcome.reason.slice(0, 1000), usage: outcome.usage });
    return { key, status: "rejected" };
  } catch (error) {
    if (error instanceof AiOutOfTime) return { key, status: "skipped" };
    if (!(error instanceof AiUnavailable)) throw error;
    await store({ ...base, status: "failed", model: null, content: null, rejection: "The model could not be reached.", usage: null });
    return { key, status: "failed" };
  }
}

export async function runEnrichment({ trigger, budgetMs = 50_000, model, embedder }: { trigger: string; budgetMs?: number; model?: ChatModel; embedder?: Embedder | null }) {
  return recordedJob<EnrichSummary>("enrich", trigger, async () => {
    const now = new Date();
    const deadline = Date.now() + budgetMs;
    if (!model && !aiConfigured()) return { configured: false, explained: 0, rejected: 0, failed: 0, dailyCallsLeft: 0, briefing: null };
    if (!(await isOn("ai"))) return { configured: true, paused: true, explained: 0, rejected: 0, failed: 0, dailyCallsLeft: 0, briefing: null };
    // The model gets the run's deadline: a call never outlives the request that made it.
    const chat = model ?? nvidiaModel({ deadline: deadline - 2_000 });
    let left = await callsLeftToday(now);
    const queue = (await dueStories(now)).slice(0, 40);
    const counts = { ready: 0, rejected: 0, failed: 0 };
    let attempted = 0;

    // A small pool: the model is the slow part, and three at once fits a tick's budget without hammering the provider.
    const worker = async () => {
      while (queue.length && attempted < PER_RUN && left > 0 && deadline - Date.now() > 12_000) {
        const storyId = queue.shift()!;
        // Counted before the call, not after: three workers checking the cap together would otherwise all pass it.
        attempted += 1;
        const outcome = await explain(chat, storyId);
        if (outcome === "skipped") {
          attempted -= 1;
          continue;
        }
        if (outcome !== "failed") left -= 1;
        counts[outcome] += 1;
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));

    const briefing = left > 0 ? await editionBriefing(chat, now, deadline) : null;
    // Last, and with whatever time is left: search by meaning is a convenience, the explainers are not.
    let embedded = 0;
    const vectors = embedder === undefined ? (model ? null : nvidiaEmbedder({ deadline: deadline - 1_000 })) : embedder;
    if (vectors) {
      try {
        embedded = await embedHeadlines(vectors, deadline);
      } catch (error) {
        if (!(error instanceof AiUnavailable)) throw error;
      }
    }
    return { configured: true, explained: counts.ready, rejected: counts.rejected, failed: counts.failed, dailyCallsLeft: left, briefing, embedded };
  });
}
