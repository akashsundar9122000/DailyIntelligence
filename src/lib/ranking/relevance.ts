import { categoryFor } from "@/config/categories";
import { INDIAN_STATES } from "@/config/regions";

/**
 * Personal relevance (blueprint §7): how well a story fits what THIS reader
 * asked for. Pure, so every ordering decision is unit-tested and explainable.
 *
 * Rules that are not weights:
 *   - A BLOCK removes a story. A MUTE ranks it down, never out.
 *   - EXPLICIT interests outrank inferred ones, always (inferred counts half).
 *   - Every story carries the reason it is there, in words the reader can act on.
 *   - Relevance is not heat and not confidence; it orders a feed, it does not
 *     say a story matters or is true. Importance still counts, so a reader who
 *     follows only cinema still sees the day's biggest story.
 *   - A share of every page is DISCOVERY: worthwhile stories outside the
 *     reader's interests, marked as such, so the feed does not narrow forever.
 */

export type Interest = {
  kind: "category" | "region" | "state" | "entity" | "keyword" | "source";
  value: string;
  label: string;
  stance: "follow" | "mute" | "block";
  priority: boolean;
  origin: "explicit" | "inferred";
};

export type RankableStory = {
  id: string;
  headline: string;
  categories: string[];
  scope: "india" | "global";
  states: string[];
  countries: string[];
  publisherDomain: string;
  sourceKey?: string;
  importance: number;
  heat: number;
  confidence: number;
  lastUpdatedAt: string;
};

export type ReaderContext = {
  interests: Interest[];
  defaultScope: "both" | "india" | "global";
  /** Stories the reader asked for more or less of, with when. */
  feedback: { storyId: string; kind: "more" | "less" | "hide"; categories: string[] }[];
  /** Stories already read: kept, but lower, so a page is not the same page twice. */
  read: Set<string>;
};

export type Ranked<T> = { story: T; relevance: number; reason: string; discovery: boolean };

/** Starting weights from §7, as a configurable, versioned set. */
export const RELEVANCE_VERSION = "relevance-2026-10-18";
const W = { interests: 0.35, entities: 0.2, geography: 0.15, feedback: 0.15, language: 0.1, discovery: 0.05 } as const;

const matchesText = (story: RankableStory, needle: string) => story.headline.toLowerCase().includes(needle.toLowerCase());

function matches(story: RankableStory, interest: Interest): boolean {
  switch (interest.kind) {
    case "category":
      return story.categories.includes(interest.value);
    case "state":
      return story.states.includes(interest.value);
    case "region":
      return interest.value === "india" ? story.scope === "india" : story.countries.includes(interest.value.toUpperCase());
    case "entity":
    case "keyword":
      return matchesText(story, interest.value);
    case "source":
      return story.sourceKey === interest.value || story.publisherDomain === interest.value;
  }
}

/** Why a matched interest put a story here, in the words shown under it. */
function reasonFor(interest: Interest): string {
  const top = interest.priority ? ", one of your top priorities" : "";
  switch (interest.kind) {
    case "category":
      return `Because you follow ${categoryFor(interest.value)?.label ?? interest.label}${top}`;
    case "state":
      return `Because you follow ${INDIAN_STATES.find((state) => state.code === interest.value)?.label ?? interest.label}`;
    case "source":
      return `Because you follow ${interest.label}`;
    default:
      return `Because you follow “${interest.label}”${top}`;
  }
}

export function score<T extends RankableStory>(story: T, reader: ReaderContext): Ranked<T> | null {
  const active = reader.interests;
  if (active.some((interest) => interest.stance === "block" && matches(story, interest))) return null;
  if (reader.feedback.some((entry) => entry.storyId === story.id && entry.kind === "hide")) return null;

  const followed = active.filter((interest) => interest.stance === "follow" && matches(story, interest));
  const weight = (interest: Interest) => (interest.origin === "explicit" ? 1 : 0.5) * (interest.priority ? 1.5 : 1);
  const topical = followed.filter((interest) => interest.kind === "category" || interest.kind === "source");
  const named = followed.filter((interest) => interest.kind === "entity" || interest.kind === "keyword");
  const places = followed.filter((interest) => interest.kind === "state" || interest.kind === "region");

  const interestsPart = Math.min(1, topical.reduce((sum, interest) => sum + weight(interest), 0) / 1.5);
  const entitiesPart = Math.min(1, named.reduce((sum, interest) => sum + weight(interest), 0));
  const scopeFit = reader.defaultScope === "both" || reader.defaultScope === story.scope ? 0.6 : 0;
  const geographyPart = Math.min(1, scopeFit + places.reduce((sum, interest) => sum + 0.4 * weight(interest), 0));
  // Feedback on OTHER stories in the same section, decaying by count rather than by time: recent clicks are what the reader is telling us now.
  const signal = reader.feedback.filter((entry) => entry.storyId !== story.id && entry.categories.some((category) => story.categories.includes(category)));
  const feedbackPart = Math.max(-1, Math.min(1, signal.reduce((sum, entry) => sum + (entry.kind === "more" ? 0.34 : entry.kind === "less" ? -0.34 : 0), 0)));
  const languagePart = 1; // English is the only edition; the term is kept so adding a language changes a value, not the formula.
  const muted = active.some((interest) => interest.stance === "mute" && matches(story, interest));

  let relevance =
    W.interests * interestsPart + W.entities * entitiesPart + W.geography * geographyPart + W.feedback * Math.max(0, feedbackPart) + W.language * languagePart;
  // Importance keeps the day's biggest stories in every feed, whatever the reader follows.
  relevance += 0.25 * (story.importance / 100);
  if (feedbackPart < 0) relevance *= 1 + feedbackPart / 2;
  if (muted) relevance *= 0.35;
  if (reader.read.has(story.id)) relevance *= 0.6;

  const best = [...topical, ...named, ...places].sort((a, b) => weight(b) - weight(a))[0];
  const reason = best
    ? reasonFor(best)
    : story.importance >= 60
      ? `One of the most important stories ${story.scope === "india" ? "in India" : "in the world"} right now`
      : muted
        ? "Shown lower because you muted something in it"
        : "Recent, from your edition";
  return { story, relevance: Math.round(relevance * 1000) / 1000, reason, discovery: false };
}

/**
 * Order a candidate pool for one reader. Then three passes that keep a feed
 * worth reading:
 *   1. DISCOVERY: every fifth place goes to the most important story that
 *      matched none of the reader's interests, labelled as discovery.
 *   2. NO RUNS: no more than two stories in a row from one section.
 *   3. NO FLOODS: at most three stories from one publisher on a page.
 */
export function rankForReader<T extends RankableStory>(stories: T[], reader: ReaderContext, limit = 40): Ranked<T>[] {
  const scored = stories.map((story) => score(story, reader)).filter((entry): entry is Ranked<T> => entry !== null);
  const hasInterests = reader.interests.some((interest) => interest.stance === "follow");
  const matched = scored.filter((entry) => entry.reason.startsWith("Because")).sort((a, b) => b.relevance - a.relevance);
  const unmatched = scored
    .filter((entry) => !entry.reason.startsWith("Because"))
    .sort((a, b) => b.story.importance - a.story.importance || b.relevance - a.relevance);

  const ordered: Ranked<T>[] = [];
  const pool = hasInterests ? matched : [...scored].sort((a, b) => b.relevance - a.relevance);
  const discoveries = hasInterests ? unmatched.map((entry) => ({ ...entry, discovery: true, reason: "Discovery: worth knowing, outside what you follow" })) : [];
  while (ordered.length < limit && (pool.length || discoveries.length)) {
    const next = hasInterests && (ordered.length + 1) % 5 === 0 && discoveries.length ? discoveries.shift()! : (pool.shift() ?? discoveries.shift()!);
    ordered.push(next);
  }

  const out: Ranked<T>[] = [];
  const deferred: Ranked<T>[] = [];
  const perPublisher = new Map<string, number>();
  for (const entry of ordered) {
    const publisher = entry.story.publisherDomain;
    if ((perPublisher.get(publisher) ?? 0) >= 3) continue;
    const last = out.slice(-2);
    const section = entry.story.categories[0];
    if (section && last.length === 2 && last.every((previous) => previous.story.categories[0] === section)) {
      deferred.push(entry);
      continue;
    }
    perPublisher.set(publisher, (perPublisher.get(publisher) ?? 0) + 1);
    out.push(entry);
    // A deferred story goes in as soon as it no longer extends a run.
    for (let i = 0; i < deferred.length; i++) {
      const waiting = deferred[i]!;
      const tail = out.slice(-2);
      if (!(tail.length === 2 && tail.every((previous) => previous.story.categories[0] === waiting.story.categories[0]))) {
        out.push(waiting);
        deferred.splice(i, 1);
        break;
      }
    }
  }
  return [...out, ...deferred].slice(0, limit);
}
