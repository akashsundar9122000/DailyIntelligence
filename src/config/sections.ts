/**
 * What each section of the paper will hold, and which build phase brings it.
 * Read only by the "in preparation" page (components/shell/section-page.tsx),
 * which a section shows until its phase lands. When a section is built, its
 * entry is deleted here; tests/unit/sections.test.ts fails if a built route
 * still has one, so an outdated "coming soon" cannot linger.
 */
export type SectionPlan = { phase: number; willHold: string[] };

export const SECTION_PLANS: Record<string, SectionPlan> = {
  "/app/social": {
    phase: 4,
    willHold: [
      "Public posts from platforms that permit it (Bluesky and selected Mastodon servers), each linked to the original.",
      "Every post labelled as a post, an official statement, a video or commentary. Engagement is never treated as evidence.",
    ],
  },
};
