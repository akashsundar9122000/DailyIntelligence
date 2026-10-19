/**
 * What each section of the paper will hold, and which build phase brings it.
 * Read only by the "in preparation" page (components/shell/section-page.tsx),
 * which a section shows until its phase lands. When a section is built, its
 * entry is deleted here; tests/unit/sections.test.ts fails if a built route
 * still has one, so an outdated "coming soon" cannot linger.
 */
export type SectionPlan = { phase: number; willHold: string[] };

/* Every section of the paper is built (phase 4). The mechanism stays for the next section added before it is ready. */
export const SECTION_PLANS: Record<string, SectionPlan> = {};
