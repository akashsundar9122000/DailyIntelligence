import "server-only";

import { categoryFor } from "@/config/categories";
import { env } from "@/lib/env";

import { AiOutOfTime, AiUnavailable } from "./nvidia-client";

/**
 * AI illustrations: what is asked for, how it is drawn, and how it is checked
 * before anyone sees it -- the picture counterpart of checkClaims.
 *
 * WHAT THE MODEL IS TOLD. Only what the page may show: the headline and the
 * section. Never an excerpt, never article text. Every capitalised word is
 * taken out of the headline first -- names, places, organisations, even the
 * first word -- so a story about a minister is drawn as its subject, not as a
 * likeness of the minister. (namesIn spares a sentence's first word; a prompt
 * cannot, since "Rohit Sharma leads…" starts with a name.)
 * Sections marked `sensitive` -- politics, health -- get no AI picture at all.
 *
 * WHAT IT MAY DRAW. Illustrated scenes, flat and stylised; generic figures at a
 * distance, never a face in close-up, never a real person, never text, logos
 * or flags, never violence, never anything that could pass for a photograph of
 * the event.
 *
 * HOW IT IS CHECKED. A vision model looks at every picture and answers eight
 * questions. Any "yes" refuses it: the row is stored as rejected (never shown,
 * row security), and the story keeps its next picture. One retry with a new
 * seed, then it stays rejected.
 *
 * Change the words of the prompt or the check, change IMAGE_PROMPT_VERSION.
 */
export const IMAGE_PROMPT_VERSION = "illustration-2026-10-21c";

/*
 * Stories that get NO AI picture, whatever their section: anything about
 * violence, conflict, crime, death, disaster or accident. Found the hard way
 * (21 October 2026): a story about a photographer attacked by armed men had
 * been filed under Business, and the model drew armed men advancing on a
 * photographer -- an illustration of a real, accused incident. Its check
 * passed: nothing gory, no text. A news paper does not draw what happened to
 * real people in an attack. Such a story keeps its map or its cover art.
 *
 * Words, matched whole, on the headline as published. Kept broad on purpose:
 * a story wrongly kept from an illustration loses nothing it had before.
 */
const NOT_ILLUSTRATED = new RegExp(
  "\\b(" +
    [
      "attack(?:s|ed|er|ers)?", "kill(?:s|ed|ing|er|ers)?", "dead", "deaths?", "died", "dies", "dying", "murder(?:s|ed)?", "shoot(?:s|ing|er)?", "shot",
      "guns?", "gunm[ae]n", "bomb(?:s|ing|ed)?", "blasts?", "explosions?", "war", "wars", "warfare", "airstrikes?", "missiles?", "drones? strikes?",
      "terror(?:ism|ist|ists)?", "riots?", "rioting", "assault(?:s|ed)?", "rape[sd]?", "abuse[sd]?", "violen(?:ce|t)", "injur(?:y|ies|ed)", "wounded",
      "hostages?", "kidnap(?:s|ped|ping)?", "crash(?:es|ed)?", "collapse[sd]?", "disaster", "earthquakes?", "cyclones?", "floods?", "flooding",
      "victims?", "arrest(?:s|ed)?", "police", "protest(?:s|ers)?", "settlers?", "militants?", "soldiers?", "troops", "army", "conflict",
      "clash(?:es|ed)?", "suicide", "accidents?", "fire[sd]?", "stampede", "massacre", "genocide", "refugees?", "famine",
    ].join("|") +
    ")\\b",
  "i",
);

export const IMAGE_SIZE = { width: 1344, height: 768 } as const;

export type IllustrationRequest = { prompt: string; alt: string };

/** The prompt for a story, or null when the story's section gets no AI picture. */
export function illustrationPrompt(story: { headline: string; category: string | null }): IllustrationRequest | null {
  const section = categoryFor(story.category ?? "");
  if (!section || section.sensitive) return null;
  if (NOT_ILLUSTRATED.test(story.headline)) return null;
  const words = story.headline
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}'’-]/gu, ""))
    .filter((word) => word && !/^\p{Lu}/u.test(word) && !/^\d/.test(word));
  // Two words or fewer left say nothing: then the section alone is the subject.
  const subject = words.length > 2 ? words.join(" ") : null;
  /*
   * The wording is measured, not chosen by taste (21 October 2026). NVIDIA's
   * own filter refused ("CONTENT_FILTERED") every prompt carrying the first
   * style sentence -- "Flat, stylised vector illustration with soft gradients,
   * a limited palette of deep indigo, violet, teal and warm coral, generous
   * negative space, calm composition." -- even about a lighthouse, while the
   * same subjects passed without it. "Limited palette, soft gradients" passed
   * but drew pale, empty scenes; this wording passed and drew full, bold ones.
   * Violence is not named here (naming it did not help, and the check catches
   * it); the vision check is what refuses a picture, not the prompt.
   */
  const label = section.label.toLowerCase().replace(/&/g, "and");
  const prompt = [
    subject ? `Flat editorial illustration for a ${label} news story: ${subject}.` : `Flat editorial illustration for a ${label} news story.`,
    "Rich colours, bold simple shapes, the scene fills the frame. Any people are small and seen from a distance.",
    "No text or lettering, no logos or flags, no recognisable people, not photorealistic.",
  ].join(" ");
  return { prompt, alt: `AI illustration for a ${section.label} story` };
}

export type Picture = { bytes: Uint8Array; contentType: string; width: number; height: number; model: string };

export interface ImageModel {
  draw(prompt: string, seed: number): Promise<Picture>;
}

export type Verdict = { ok: boolean; reasons: string[]; description: string };

export interface VisionCheck {
  inspect(picture: Picture): Promise<Verdict>;
}

/** What the check asks, and the words recorded when the answer is "yes". */
const QUESTIONS = {
  photorealistic: "it looks like a photograph",
  real_identifiable_person: "it shows a real, identifiable person",
  close_up_face: "it shows a face in close-up",
  weapons: "it shows a weapon",
  confrontation: "it shows a fight, a confrontation or people threatening others",
  text_or_letters: "it contains text or letters",
  logo_or_flag: "it contains a logo or a flag",
  violence_or_gore: "it shows violence or gore",
} as const;

/** Any "yes" refuses the picture; an answer that is not the JSON asked for refuses it too. */
export function verdictFrom(content: string | null): Verdict {
  let answer: Record<string, unknown>;
  try {
    const json = /\{[\s\S]*\}/.exec(content ?? "")?.[0] ?? "";
    answer = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return { ok: false, reasons: ["the check did not answer in the form asked"], description: "" };
  }
  const reasons = (Object.keys(QUESTIONS) as (keyof typeof QUESTIONS)[]).filter((key) => answer[key] !== false).map((key) => QUESTIONS[key]);
  return { ok: reasons.length === 0, reasons, description: typeof answer.describe === "string" ? answer.describe.slice(0, 300) : "" };
}

/** The hosted image model. One call per picture, with the run's deadline. */
export function nvidiaImageModel({ deadline }: { deadline: number }): ImageModel {
  const { NVIDIA_API_KEY: key, NVIDIA_IMAGE_URL: base, NVIDIA_IMAGE_MODEL: model } = env();
  if (!key) throw new AiUnavailable("Illustrations are not configured on this deployment.");
  return {
    async draw(prompt, seed) {
      const remaining = deadline - Date.now() - 1_000;
      if (remaining < 15_000) throw new AiOutOfTime();
      const response = await fetch(`${base.replace(/\/$/, "")}/${model}`, {
        method: "POST",
        signal: AbortSignal.timeout(Math.min(60_000, remaining)),
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ prompt, mode: "base", ...IMAGE_SIZE, seed, steps: 30, cfg_scale: 3.5 }),
      });
      if (!response.ok) throw new AiUnavailable(`The illustration model answered ${response.status}.`);
      const body = (await response.json()) as { artifacts?: { base64?: string; finishReason?: string }[] };
      const artifact = body.artifacts?.[0];
      if (!artifact?.base64 || artifact.finishReason !== "SUCCESS") throw new AiUnavailable("The illustration model returned no picture.");
      return { bytes: Uint8Array.from(Buffer.from(artifact.base64, "base64")), contentType: "image/jpeg", ...IMAGE_SIZE, model };
    },
  };
}

/** The hosted vision model, asked the six questions with reasoning off (it answered in 1.5s that way). */
export function nvidiaVisionCheck({ deadline }: { deadline: number }): VisionCheck {
  const { NVIDIA_API_KEY: key, NVIDIA_BASE_URL: base, NVIDIA_VISION_MODEL: model } = env();
  if (!key) throw new AiUnavailable("Illustrations are not configured on this deployment.");
  const fields = Object.keys(QUESTIONS).map((name) => `"${name}": boolean`).join(", ");
  return {
    async inspect(picture) {
      const remaining = deadline - Date.now() - 1_000;
      if (remaining < 5_000) throw new AiOutOfTime();
      const response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(Math.min(30_000, remaining)),
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 300,
          ...(model.startsWith("nvidia/nemotron") ? { chat_template_kwargs: { enable_thinking: false } } : {}),
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: `Look at this picture and answer with JSON only: {${fields}, "describe": string}. Be strict: if unsure, answer true.` },
                { type: "image_url", image_url: { url: `data:${picture.contentType};base64,${Buffer.from(picture.bytes).toString("base64")}` } },
              ],
            },
          ],
        }),
      });
      if (!response.ok) throw new AiUnavailable(`The picture check answered ${response.status}.`);
      const body = (await response.json()) as { choices?: { message?: { content?: string | null } }[] };
      return verdictFrom(body.choices?.[0]?.message?.content ?? null);
    },
  };
}
