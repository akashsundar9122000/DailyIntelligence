/**
 * Heat, confidence and importance: three numbers, never one.
 *
 * Pure functions over a story's measured facts, each returning its score AND
 * the components that produced it, so "why is this trending?" is answered
 * from stored arithmetic rather than a story invented afterwards (blueprint
 * §7). Components are stored as integers in tenths of a point (0-1000).
 *
 * HEAT is how fast and how broadly a story is gaining attention. It reads
 * nothing about whether the story is true.
 * CONFIDENCE is how strong the evidence is: independent publishers, a
 * primary source, time for corroboration. It reads nothing about attention.
 * IMPORTANCE is public consequence by defensible signals: an official
 * statement, the kind of event, how many countries it touches. Never
 * engagement.
 *
 * Nothing in this file may combine them into one number. Ordering a feed by a
 * mix of them is the ranking module's decision, made visibly, with these
 * three kept as they are.
 */

export const SCORE_VERSION = "rules-2026-10-18b";

export type StoryFacts = {
  /** Items attached in the last hour, and in the six hours before that. */
  itemsLastHour: number;
  itemsPrevSixHours: number;
  /** Distinct publishers among all items, and in the last six hours. */
  publishers: number;
  publishersLastSixHours: number;
  /** Items from sources marked official (PIB, NASA, a central bank). */
  officialItems: number;
  /** Distinct event countries across items. */
  countries: number;
  categories: string[];
  /** Minutes since the story was first seen, and since it last gained an item. */
  ageMinutes: number;
  quietMinutes: number;
};

export type Scored = { score: number; components: Record<string, number> };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const tenths = (value: number) => Math.round(clamp01(value) * 1000);
/** Diminishing returns: the first few count most, and the tenth publisher adds less than the second. */
const saturate = (value: number, half: number) => value / (value + half);

/**
 * Starting weights from blueprint §7. A hypothesis to be tuned against
 * outcomes, and versioned (SCORE_VERSION) so a change can be compared with
 * what it replaced.
 */
const HEAT_WEIGHTS = { velocity: 0.3, spread: 0.25, recency: 0.18, engagement: 0.15, breadth: 0.12 } as const;

export function heat(facts: StoryFacts): Scored {
  // Velocity against the story's own recent pace: this hour versus the average hour of the six before.
  const baseline = facts.itemsPrevSixHours / 6;
  const velocity = facts.itemsLastHour === 0 ? 0 : saturate(facts.itemsLastHour / Math.max(baseline, 0.5), 3);
  const spread = saturate(facts.publishersLastSixHours, 4);
  // Half-life of six hours since the last new item: old viral stories cool, however big they were.
  const recency = Math.pow(0.5, facts.quietMinutes / 360);
  // No permitted social source is connected yet (Social Pulse, phase 4). Zero, and labelled as zero, rather than guessed.
  const engagement = 0;
  const breadth = saturate(Math.max(0, facts.countries - 1), 3);
  const components = {
    velocity: tenths(velocity),
    spread: tenths(spread),
    recency: tenths(recency),
    engagement: tenths(engagement),
    breadth: tenths(breadth),
  };
  const score =
    HEAT_WEIGHTS.velocity * velocity +
    HEAT_WEIGHTS.spread * spread +
    HEAT_WEIGHTS.recency * recency +
    HEAT_WEIGHTS.engagement * engagement +
    HEAT_WEIGHTS.breadth * breadth;
  return { score: Math.round(clamp01(score) * 100), components };
}

export function confidence(facts: StoryFacts): Scored {
  // Independent publishers carry most of it: one site is a claim, five are a story.
  const independent = saturate(Math.max(0, facts.publishers - 1), 2);
  // A primary source on the record (a ministry, an agency) -- shown as official, never as independent reporting.
  const primary = facts.officialItems > 0 ? 1 : 0;
  // Time for corroboration: a story minutes old has had none.
  const settled = clamp01(facts.ageMinutes / 180);
  const components = { independent: tenths(independent), primary: tenths(primary), settled: tenths(settled) };
  const score = 0.6 * independent + 0.25 * primary + 0.15 * settled;
  return { score: Math.round(clamp01(score) * 100), components };
}

/** Kinds of event whose consequences reach many people. Engagement never enters here. */
const SEVERE_CATEGORIES = new Set(["health", "climate", "world-politics", "india-politics", "business"]);

export function importance(facts: StoryFacts): Scored {
  /*
   * An official statement counts in full only once others have reported it.
   * On its own it is a press release, and most press releases -- a regulator
   * closing a case against one small bank -- are not front-page news. The
   * first real run (2026-10-18) put exactly that story at the top of every
   * edition when an official item alone was worth a third of importance.
   */
  const official = facts.officialItems > 0 ? (facts.publishers >= 2 ? 1 : 0.25) : 0;
  const severity = facts.categories.some((category) => SEVERE_CATEGORIES.has(category)) ? 1 : 0;
  const reach = saturate(Math.max(0, facts.countries - 1), 2);
  // Coverage carries most of it: how many independent publishers thought it worth reporting.
  const coverage = saturate(Math.max(0, facts.publishers - 1), 3);
  const components = { official: tenths(official), severity: tenths(severity), reach: tenths(reach), coverage: tenths(coverage) };
  const score = 0.2 * official + 0.15 * severity + 0.15 * reach + 0.5 * coverage;
  return { score: Math.round(clamp01(score) * 100), components };
}

/** The story's lifecycle, from the same facts. */
export function storyState(facts: StoryFacts): "developing" | "active" | "cooling" | "closed" {
  if (facts.quietMinutes > 72 * 60) return "closed";
  if (facts.quietMinutes > 12 * 60) return "cooling";
  if (facts.ageMinutes < 6 * 60) return "developing";
  return "active";
}

/** "Rising", "steady" or "cooling", for the Hot Now direction marker. */
export function direction(facts: StoryFacts): "rising" | "steady" | "cooling" {
  const baseline = facts.itemsPrevSixHours / 6;
  if (facts.itemsLastHour > Math.max(1, baseline * 1.5)) return "rising";
  if (facts.quietMinutes > 180) return "cooling";
  return "steady";
}
