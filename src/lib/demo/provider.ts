import "server-only";

import { demoModeEnabled } from "@/lib/env";
import type { StoryCard } from "@/lib/queries/stories";

import { SAMPLE_STORIES } from "./sample-stories";

export type SampleCard = StoryCard & { sample: true };

/**
 * The ONE door to the sample edition. Returns invented stories only when
 * DEMO_MODE=1 AND there is no real story to show -- never both at once, so a
 * sample cannot sit in a feed beside real news -- and every one carries
 * `sample: true`, which the card turns into a "Sample" label before anything
 * else. check:provenance fails if anything else imports the fixtures.
 */
export function sampleEdition(realCount: number, now: Date): SampleCard[] {
  if (!demoModeEnabled() || realCount > 0) return [];
  return SAMPLE_STORIES.map((story) => {
    const at = new Date(now.getTime() - story.minutesAgo * 60_000).toISOString();
    return {
      id: story.id,
      headline: story.headline,
      publisher: "Sample Gazette",
      publisherDomain: "sample.invalid",
      sourceKey: "sample",
      url: "https://sample.invalid/",
      contentType: story.official ? "official_statement" : story.category === "science" ? "preprint" : "report",
      isOfficial: story.official,
      excerpt: story.excerpt,
      category: story.category,
      categories: [story.category],
      scope: story.scope,
      states: story.states,
      countries: story.scope === "india" ? ["IN"] : [],
      sourceCount: story.sourceCount,
      itemCount: story.sourceCount,
      officialCount: story.official ? 1 : 0,
      heat: story.heat,
      confidence: story.confidence,
      importance: story.importance,
      state: story.minutesAgo < 60 ? "developing" : "active",
      publishedAt: at,
      firstSeenAt: at,
      lastUpdatedAt: at,
      direction: story.heat > 70 ? "rising" : "steady",
      sample: true,
    };
  });
}

export { demoModeEnabled };
