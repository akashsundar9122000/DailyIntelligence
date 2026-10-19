import type { Metadata } from "next";
import Link from "next/link";

import { ChipNav } from "@/components/news/chip-nav";
import { DemoBanner, EmptyEdition, FrontLayout } from "@/components/news/edition";
import { PageHeader } from "@/components/ui/page-header";
import { NewStories } from "@/components/news/new-stories";
import { INDIAN_STATES } from "@/config/regions";
import { requireSession } from "@/lib/auth/session";
import { sampleEdition } from "@/lib/demo/provider";
import { getEditionStatus } from "@/lib/queries/edition";
import { editionCounts, frontPage } from "@/lib/queries/stories";
import { savedStoryIds } from "@/lib/services/reader";

export const metadata: Metadata = { title: "India" };

/**
 * The India edition: stories whose EVENT is in India, wherever they were
 * published, with state filters for the states that have stories now.
 * Government releases appear here as official statements, labelled as such.
 */
export default async function IndiaPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const session = await requireSession();
  const now = new Date();
  const { state: rawState } = await searchParams;
  const state = INDIAN_STATES.find((entry) => entry.code === rawState)?.code;
  const stories = await frontPage({ scope: "india", state, withinHours: 48 }, 40);
  const counts = await editionCounts();
  const saved = await savedStoryIds(session.user.id);
  const edition = await getEditionStatus();
  const samples = state ? [] : sampleEdition(stories.length, now).filter((story) => story.scope === "india");
  const shown = samples.length ? samples : stories;
  const withStories = INDIAN_STATES.filter((entry) => (counts.states.get(entry.code) ?? 0) > 0).sort((a, b) => (counts.states.get(b.code) ?? 0) - (counts.states.get(a.code) ?? 0));
  const stateName = INDIAN_STATES.find((entry) => entry.code === state)?.label;

  return (
    <div className="mx-auto max-w-[var(--container)] space-y-6">
      <NewStories renderedAt={now.toISOString()} scope={"india"} />
      <PageHeader kicker="National edition" title={stateName ? `India · ${stateName}` : "India"} description="Stories that happened in India, wherever they were published: national news, the states, and government statements labelled as official." />
      <ChipNav
        label="Filter by state"
        chips={[
          { href: "/app/india", label: "All India", current: !state },
          ...withStories.map((entry) => ({ href: `/app/india?state=${entry.code}`, label: `${entry.label} (${counts.states.get(entry.code)})`, current: state === entry.code })),
        ]}
      />
      {samples.length ? <DemoBanner /> : null}
      {shown.length === 0 ? (
        <EmptyEdition reason={!edition.updatedAt ? "no-reports" : state ? "no-matches" : "no-stories"} action={state ? <Link href="/app/india" className="font-semibold underline underline-offset-4">All of India</Link> : undefined} />
      ) : (
        <FrontLayout placed={shown.map((story) => ({ story }))} now={now} saved={saved} label="India stories" />
      )}
    </div>
  );
}
