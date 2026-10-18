import type { Metadata } from "next";
import Link from "next/link";

import { DemoBanner, EmptyEdition, FrontLayout, type Placed } from "@/components/news/edition";
import { ChipNav } from "@/components/news/chip-nav";
import { BriefingColumn, HotColumn } from "@/components/news/sidebar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CATEGORIES, isCategorySlug } from "@/config/categories";
import { SCOPE_LABELS } from "@/config/regions";
import { requireSession } from "@/lib/auth/session";
import { sampleEdition } from "@/lib/demo/provider";
import { getEditionStatus } from "@/lib/queries/edition";
import { getPreferences } from "@/lib/queries/preferences";
import { candidateStories, hotStories } from "@/lib/queries/stories";
import { rankForReader } from "@/lib/ranking/relevance";
import { getReaderProfile, listInterests, readerContext, savedStoryIds } from "@/lib/services/reader";

export const metadata: Metadata = { title: "For You" };

/**
 * The reader's own edition. Ranked for them from the last 48 hours of their
 * chosen edition (India, World or both), with every story saying why it is
 * here, a share kept for discovery, and the day's most important stories kept
 * in whatever they follow. With personalisation switched off it is the same
 * edition every reader gets, ordered by importance.
 */
export default async function ForYouPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const session = await requireSession();
  const userId = session.user.id;
  const now = new Date();
  const { c } = await searchParams;
  const category = c && isCategorySlug(c) ? c : undefined;

  // One scope at a time: scopes do not nest.
  const preferences = await getPreferences(userId);
  const profile = await getReaderProfile(userId);
  const interests = await listInterests(userId);
  const scope = preferences.defaultScope === "both" ? undefined : preferences.defaultScope;
  const candidates = await candidateStories({ scope, category });
  const context = await readerContext(userId, preferences.defaultScope, preferences.readingHistory);
  const saved = await savedStoryIds(userId);
  const hot = await hotStories({ scope }, 5);
  const edition = await getEditionStatus();

  let placed: Placed[];
  if (preferences.personalisation) {
    placed = rankForReader(candidates, context, 40);
  } else {
    placed = [...candidates]
      .sort((a, b) => b.importance - a.importance || b.lastUpdatedAt.localeCompare(a.lastUpdatedAt))
      .slice(0, 40)
      .map((story) => ({ story, reason: "Personalisation is off: the same edition every reader sees" }));
  }
  const samples = sampleEdition(candidates.length, now);
  const showingSamples = samples.length > 0;
  if (showingSamples) placed = samples.map((story) => ({ story, reason: "Sample: shows where the reason a story is in your feed appears" }));

  const followed = interests.filter((interest) => interest.kind === "category" && interest.stance === "follow").map((interest) => interest.value);
  const chipCategories = followed.length > 0 ? CATEGORIES.filter((entry) => followed.includes(entry.slug)) : CATEGORIES.slice(0, 8);
  const firstName = (session.user.name || "").split(/\s+/)[0];

  return (
    <div className="mx-auto max-w-[var(--container)] space-y-6">
      <PageHeader
        kicker={`${SCOPE_LABELS[preferences.defaultScope]} edition`}
        title={firstName ? `For you, ${firstName}` : "For you"}
        description="Your edition, ranked by what you follow, with the day's biggest stories kept in and a little room for what you would otherwise miss."
      />

      {!profile.onboardedAt ? (
        <div className="flex flex-col gap-3 border-l-[3px] border-text-primary bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-text-primary">
            <span className="font-semibold">Your edition is not set up yet.</span> Choose your sections and places, and this page starts ranking for you.
          </p>
          <Button asChild size="sm">
            <Link href="/app/onboarding">Set up my edition</Link>
          </Button>
        </div>
      ) : null}

      <ChipNav
        label="Filter by section"
        chips={[
          { href: "/app", label: "Everything", current: !category },
          ...chipCategories.map((entry) => ({ href: `/app?c=${entry.slug}`, label: entry.label, current: category === entry.slug })),
        ]}
      />

      {showingSamples ? <DemoBanner /> : null}

      {placed.length === 0 ? (
        <EmptyEdition
          reason={!edition.updatedAt ? "no-reports" : category ? "no-matches" : "no-stories"}
          action={category ? <Link href="/app" className="font-semibold underline underline-offset-4">Show everything</Link> : undefined}
        />
      ) : (
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <FrontLayout placed={placed} now={now} saved={saved} label="Your stories" />
          <aside className="space-y-8 xl:border-l xl:border-border-strong xl:pl-8" aria-label="Alongside your edition">
            <BriefingColumn entries={placed.slice(0, 5).map(({ story, reason }) => ({ story, reason }))} />
            <HotColumn stories={showingSamples ? samples.filter((story) => story.heat >= 60) : hot} now={now} />
          </aside>
        </div>
      )}
    </div>
  );
}
