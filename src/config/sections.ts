/**
 * What each section of the paper will hold, and which build phase brings it.
 * Read only by the "in preparation" page (components/shell/section-page.tsx),
 * which a section shows until its phase lands. When a section is built, its
 * entry is deleted here; tests/unit/sections.test.ts fails if a built route
 * still has one, so an outdated "coming soon" cannot linger.
 */
export type SectionPlan = { phase: number; willHold: string[] };

export const SECTION_PLANS: Record<string, SectionPlan> = {
  "/app": {
    phase: 1,
    willHold: [
      "The stories that match the interests you chose, each with a line saying why it is in your feed.",
      "A small share of worthwhile stories outside your interests, marked as discovery.",
      "Real publication and detection times on every story, and a link to the original.",
    ],
  },
  "/app/today": {
    phase: 1,
    willHold: ["Today's front page: the most important stories of the day, the same for every reader.", "A short briefing of what changed since this morning."],
  },
  "/app/hot": {
    phase: 1,
    willHold: [
      "Stories gaining attention fastest, ranked as clusters rather than as repeated links.",
      "Heat and source confidence shown side by side: a story can be hot and unconfirmed.",
      "Why each story is trending, from measured signals: new articles per hour, independent publishers, recency.",
    ],
  },
  "/app/india": { phase: 1, willHold: ["National news and state-by-state coverage.", "Government notices from the Press Information Bureau, marked as official statements."] },
  "/app/global": { phase: 1, willHold: ["World news by region.", "Where an event happened, kept apart from where it was reported."] },
  "/app/categories": { phase: 1, willHold: ["Cinema, sport, politics, business, technology, AI, science, health, climate and more, each with its own front."] },
  "/app/social": {
    phase: 4,
    willHold: [
      "Public posts from platforms that permit it (Bluesky and selected Mastodon servers), each linked to the original.",
      "Every post labelled as a post, an official statement, a video or commentary. Engagement is never treated as evidence.",
    ],
  },
  "/app/briefings": {
    phase: 2,
    willHold: ["Morning and evening briefings, and topic catch-ups.", "Every claim linked to the source it came from, and the period covered stated."],
  },
  "/app/search": { phase: 1, willHold: ["Search across stories, sources, topics and people, with filters for time, edition, category and source."] },
  "/app/saved": { phase: 1, willHold: ["Your bookmarks and collections, with private notes and the sources each story was saved with."] },
};
