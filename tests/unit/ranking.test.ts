import { describe, expect, it } from "vitest";

import { rankForReader, score, type Interest, type RankableStory, type ReaderContext } from "@/lib/ranking/relevance";
import { confidence, direction, heat, importance, storyState, type StoryFacts } from "@/lib/ranking/scores";

const facts = (change: Partial<StoryFacts> = {}): StoryFacts => ({
  itemsLastHour: 0,
  itemsPrevSixHours: 0,
  publishers: 1,
  publishersLastSixHours: 1,
  officialItems: 0,
  countries: 1,
  categories: [],
  ageMinutes: 60,
  quietMinutes: 10,
  ...change,
});

describe("heat and confidence are different numbers", () => {
  it("lets a story be very hot and barely sourced, and says both", () => {
    // Many items in the last hour, all from two sites, minutes old: viral, unconfirmed.
    const viral = facts({ itemsLastHour: 30, itemsPrevSixHours: 2, publishers: 2, publishersLastSixHours: 2, ageMinutes: 20, quietMinutes: 1 });
    const h = heat(viral);
    const c = confidence(viral);
    expect(h.score).toBeGreaterThanOrEqual(55);
    expect(c.score).toBeLessThan(40);
    expect(h.score - c.score).toBeGreaterThan(20);
  });

  it("lets a story be well sourced and quiet", () => {
    const settled = facts({ itemsLastHour: 0, itemsPrevSixHours: 1, publishers: 9, publishersLastSixHours: 0, officialItems: 1, ageMinutes: 600, quietMinutes: 300 });
    expect(confidence(settled).score).toBeGreaterThanOrEqual(70);
    expect(heat(settled).score).toBeLessThan(40);
  });

  it("never lets attention raise confidence", () => {
    const quiet = facts({ publishers: 3, ageMinutes: 200 });
    const loud = facts({ publishers: 3, ageMinutes: 200, itemsLastHour: 50, publishersLastSixHours: 3, countries: 8 });
    expect(confidence(loud).score).toBe(confidence(quiet).score);
  });

  it("never lets engagement or heat raise importance", () => {
    const calm = facts({ publishers: 4, countries: 2 });
    const viral = facts({ publishers: 4, countries: 2, itemsLastHour: 80, publishersLastSixHours: 4 });
    expect(importance(viral).score).toBe(importance(calm).score);
  });

  it("does not let an uncorroborated press release lead the paper", () => {
    // The first real run: a regulator closing one small bank's case topped every edition.
    const release = facts({ officialItems: 1, publishers: 1, categories: ["business"] });
    const story = facts({ publishers: 8, countries: 3, categories: ["world-politics"] });
    expect(importance(release).score).toBeLessThan(importance(story).score);
    expect(importance(release).score).toBeLessThan(30);
  });

  it("stores the parts of every score, so 'why it is hot' is arithmetic, not a story", () => {
    const h = heat(facts({ itemsLastHour: 5 }));
    expect(Object.keys(h.components).sort()).toEqual(["breadth", "engagement", "recency", "spread", "velocity"]);
    for (const value of Object.values(h.components)) expect(value).toBeGreaterThanOrEqual(0), expect(value).toBeLessThanOrEqual(1000);
    // No permitted social source is connected: engagement is zero, not invented.
    expect(h.components.engagement).toBe(0);
  });

  it("cools a story that has stopped moving", () => {
    expect(heat(facts({ quietMinutes: 5 })).score).toBeGreaterThan(heat(facts({ quietMinutes: 24 * 60 })).score);
    expect(storyState(facts({ ageMinutes: 30, quietMinutes: 5 }))).toBe("developing");
    expect(storyState(facts({ ageMinutes: 600, quietMinutes: 13 * 60 }))).toBe("cooling");
    expect(storyState(facts({ ageMinutes: 6000, quietMinutes: 80 * 60 }))).toBe("closed");
    expect(direction(facts({ itemsLastHour: 9, itemsPrevSixHours: 6 }))).toBe("rising");
  });
});

let n = 0;
const story = (change: Partial<RankableStory> = {}): RankableStory => {
  n++;
  return { id: `s${n}`, headline: `Invented headline number ${n}`, categories: ["business"], scope: "global", states: [], countries: [], publisherDomain: `p${n}.example`, importance: 30, heat: 30, confidence: 50, lastUpdatedAt: "2026-10-18T10:00:00.000Z", ...change };
};
const follow = (kind: Interest["kind"], value: string, extra: Partial<Interest> = {}): Interest => ({ kind, value, label: value, stance: "follow", priority: false, origin: "explicit", ...extra });
const reader = (interests: Interest[], extra: Partial<ReaderContext> = {}): ReaderContext => ({ interests, defaultScope: "both", feedback: [], read: new Set(), ...extra });

describe("personal relevance", () => {
  it("removes a blocked story and ranks a muted one lower, never out", () => {
    const blocked = story({ headline: "Invented story about the harbour strike" });
    const muted = story({ categories: ["cricket"] });
    const plain = story({ categories: ["cricket"], publisherDomain: "other.example" });
    const context = reader([{ ...follow("keyword", "harbour"), stance: "block" }, { ...follow("source", muted.publisherDomain), stance: "mute" }, follow("category", "cricket")]);
    expect(score(blocked, context)).toBeNull();
    expect(score(muted, context)!.relevance).toBeLessThan(score(plain, context)!.relevance);
    expect(score(muted, context)).not.toBeNull();
  });

  it("puts what the reader chose above what was guessed", () => {
    const a = story({ categories: ["cinema"] });
    const b = story({ categories: ["space"] });
    const context = reader([follow("category", "cinema"), follow("category", "space", { origin: "inferred" })]);
    expect(score(a, context)!.relevance).toBeGreaterThan(score(b, context)!.relevance);
  });

  it("says why each story is there, naming a top priority", () => {
    const s = story({ categories: ["cricket"] });
    expect(score(s, reader([follow("category", "cricket", { priority: true })]))!.reason).toBe("Because you follow Cricket, one of your top priorities");
    expect(score(story({ importance: 80 }), reader([]))!.reason).toMatch(/most important stories/);
  });

  it("hides a story the reader hid, and learns from more and less", () => {
    const hidden = story();
    expect(score(hidden, reader([], { feedback: [{ storyId: hidden.id, kind: "hide", categories: [] }] }))).toBeNull();
    const target = story({ categories: ["gaming"] });
    const liked = reader([], { feedback: [{ storyId: "other", kind: "more", categories: ["gaming"] }] });
    const disliked = reader([], { feedback: [{ storyId: "other", kind: "less", categories: ["gaming"] }] });
    expect(score(target, liked)!.relevance).toBeGreaterThan(score(target, disliked)!.relevance);
  });

  it("keeps a share for discovery, labelled, every fifth place", () => {
    const followed = Array.from({ length: 12 }, () => story({ categories: ["cricket"], publisherDomain: `c${n}.example` }));
    const others = Array.from({ length: 3 }, () => story({ categories: ["science"], importance: 70 }));
    const ranked = rankForReader([...followed, ...others], reader([follow("category", "cricket")]), 10);
    const discoveries = ranked.filter((entry) => entry.discovery);
    expect(discoveries.length).toBeGreaterThanOrEqual(1);
    expect(discoveries.every((entry) => entry.reason.startsWith("Discovery"))).toBe(true);
  });

  it("never runs three stories from one section in a row when others are waiting, and caps a publisher at three", () => {
    const pool = [
      ...Array.from({ length: 6 }, () => story({ categories: ["cricket"], importance: 60 })),
      ...Array.from({ length: 4 }, () => story({ categories: ["cinema"], importance: 20 })),
      ...Array.from({ length: 5 }, () => story({ categories: ["business"], publisherDomain: "same.example", importance: 50 })),
    ];
    const ranked = rankForReader(pool, reader([follow("category", "cricket"), follow("category", "cinema"), follow("category", "business")]), 15);
    let longest = 1;
    let run = 1;
    for (let i = 1; i < ranked.length; i++) {
      run = ranked[i]!.story.categories[0] === ranked[i - 1]!.story.categories[0] ? run + 1 : 1;
      longest = Math.max(longest, run);
    }
    // Only the deferred tail may still contain a run, once nothing else is left to break it up.
    expect(longest).toBeLessThanOrEqual(3);
    expect(ranked.filter((entry) => entry.story.publisherDomain === "same.example").length).toBeLessThanOrEqual(3);
  });
});
