import "server-only";

import { put } from "@vercel/blob";
import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { IMAGE_PROMPT_VERSION, illustrationPrompt, type ImageModel, type Picture, type VisionCheck } from "@/lib/ai/illustration";
import { AiOutOfTime, AiUnavailable } from "@/lib/ai/nvidia-client";
import { execRows, withSystem } from "@/lib/db/scope";
import { showableMedia } from "@/lib/db/sql";
import { env } from "@/lib/env";
import { istDay } from "@/lib/format/date";

import { isOn } from "./ops";

/**
 * Illustrations for the stories readers see first, run at the end of the AI
 * pass with whatever time is left.
 *
 * The same rules as the explainers:
 *   - No model call and no upload inside a transaction: read, close, call,
 *     open again to write.
 *   - A daily ceiling (IMAGE_DAILY_LIMIT), counting refused pictures too, so a
 *     model drawing nothing but refusals cannot spend a month in a day.
 *   - Switch `ai_images` off in the press room and none are drawn.
 * A picture is uploaded only after it passes its check; a refused one is
 * recorded, with why, and never stored.
 */

/** Where a picture is kept: Vercel Blob in production; injected in tests. */
export type Uploader = (path: string, picture: Picture) => Promise<string>;

export function blobUploader(): Uploader {
  const token = env().BLOB_READ_WRITE_TOKEN;
  if (!token) throw new AiUnavailable("Illustrations have nowhere to be stored on this deployment.");
  return async (path, picture) =>
    (await put(path, Buffer.from(picture.bytes), { access: "public", contentType: picture.contentType, token, addRandomSuffix: true })).url;
}

/**
 * `failed` counts stories whose model or store could not be reached: tried
 * again on a later run, but counted, so a run that drew nothing because the
 * provider is down does not read the same as a run with nothing to do.
 */
export type IllustrationSummary = { drawn: number; refused: number; failed: number; left: number; paused?: boolean; lastError?: string };

const PER_RUN = 3;
/** Attempts per story: one, and one more with a new seed if the check refuses it. */
const SEEDS = [1, 2];

async function leftToday(now: Date): Promise<number> {
  const used = (
    await withSystem("images.budget", (tx) =>
      execRows<{ used: number }>(tx, sql`select count(*)::int as used from story_images where (generated_at at time zone 'Asia/Kolkata')::date = ${istDay(now)}::date`),
    )
  )[0]!.used;
  return Math.max(0, env().IMAGE_DAILY_LIMIT - used);
}

/**
 * The stories readers see first -- recent, and the most important and the
 * hottest -- that have no licensed photo and no illustration, and have not
 * been refused today.
 */
async function dueStories(): Promise<{ id: string; headline: string; category: string | null }[]> {
  return withSystem("images.due", (tx) =>
    execRows<{ id: string; headline: string; category: string | null }>(
      tx,
      sql`select st.id, st.headline, st.primary_category as category
            from stories st
           where st.last_updated_at > now() - interval '36 hours'
             and not exists (select 1 from story_images si where si.story_id = st.id and (si.status = 'ready' or si.generated_at > now() - interval '24 hours'))
             and not exists (select 1 from story_items psi join raw_source_items pi on pi.id = psi.item_id join sources ps on ps.id = pi.source_id
                              where psi.story_id = st.id and pi.media_url is not null and ${showableMedia("ps")})
           order by greatest(st.importance, st.heat) desc, st.last_updated_at desc
           limit 30`,
    ),
  );
}

async function record(row: { storyId: string; status: "ready" | "rejected"; url: string | null; alt: string; model: string; prompt: string; rejection: string | null; width: number | null; height: number | null }) {
  await withSystem("images.store", (tx) =>
    tx.execute(sql`insert into story_images (id, story_id, kind, status, url, width, height, alt, model, prompt_version, prompt, rejection)
                   values (${uuidv7()}::uuid, ${row.storyId}::uuid, 'ai', ${row.status}, ${row.url}, ${row.width}, ${row.height}, ${row.alt},
                           ${row.model}, ${IMAGE_PROMPT_VERSION}, ${row.prompt}, ${row.rejection})`),
  );
}

export async function runIllustrations({ now, deadline, image, vision, upload }: { now: Date; deadline: number; image: ImageModel; vision: VisionCheck; upload: Uploader }): Promise<IllustrationSummary> {
  if (!(await isOn("ai_images"))) return { drawn: 0, refused: 0, failed: 0, left: 0, paused: true };
  let left = await leftToday(now);
  const summary: { drawn: number; refused: number; failed: number; lastError?: string } = { drawn: 0, refused: 0, failed: 0 };
  const queue = (await dueStories()).map((story) => ({ story, request: illustrationPrompt(story) })).filter((entry) => entry.request !== null);

  for (const { story, request } of queue) {
    if (summary.drawn + summary.refused + summary.failed >= PER_RUN || left <= 0 || deadline - Date.now() < 20_000) break;
    const reasons: string[] = [];
    let model = "";
    try {
      for (const seed of SEEDS) {
        const picture = await image.draw(request!.prompt, seed);
        model = picture.model;
        const verdict = await vision.inspect(picture);
        if (verdict.ok) {
          // Checked first, stored second: a refused picture never reaches the store.
          const url = await upload(`illustrations/${story.id}.jpg`, picture);
          await record({ storyId: story.id, status: "ready", url, alt: request!.alt, model, prompt: request!.prompt, rejection: null, width: picture.width, height: picture.height });
          summary.drawn += 1;
          left -= 1;
          break;
        }
        reasons.push(...verdict.reasons);
        if (seed === SEEDS.at(-1)) {
          await record({ storyId: story.id, status: "rejected", url: null, alt: request!.alt, model, prompt: request!.prompt, rejection: [...new Set(reasons)].join("; "), width: null, height: null });
          summary.refused += 1;
          left -= 1;
        }
      }
    } catch (error) {
      // Out of time is nothing, not a failure; an unreachable model is tried again on a later run.
      if (error instanceof AiOutOfTime) break;
      if (error instanceof AiUnavailable) {
        // Its message is ours (a status code at most), never the provider's body or the key.
        summary.failed += 1;
        summary.lastError = error.message;
        continue;
      }
      throw error;
    }
  }
  return { ...summary, left };
}
