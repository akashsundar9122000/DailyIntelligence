import type { Metadata } from "next";
import Link from "next/link";

import { DemoBanner, EmptyEdition, StoryList } from "@/components/news/edition";
import { SOURCE_CATALOGUE } from "@/lib/sources/catalogue";
import { requireSession } from "@/lib/auth/session";
import { sampleEdition } from "@/lib/demo/provider";
import { getEditionStatus } from "@/lib/queries/edition";
import { getPreferences } from "@/lib/queries/preferences";
import { candidateStories } from "@/lib/queries/stories";
import { rankForReader } from "@/lib/ranking/relevance";
import { getNotificationPrefs, getReaderProfile, listInterests, readerContext, savedStoryIds } from "@/lib/services/reader";

import { FinishOnboarding } from "./finish";
import { OnboardingWizard, Progress } from "./wizard";

export const metadata: Metadata = { title: "Set up your edition" };

/**
 * Onboarding. Steps 1-5 are the client wizard, each saving as the reader moves
 * on; step 6 is drawn here, from the database, so the preview is the real feed
 * ranked by what was just chosen -- not a picture of one.
 */
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const session = await requireSession();
  const userId = session.user.id;
  const now = new Date();
  const { step: rawStep } = await searchParams;
  const profile = await getReaderProfile(userId);
  const preferences = await getPreferences(userId);
  const interests = await listInterests(userId);
  const requested = Number.parseInt(rawStep ?? "", 10);
  const step = Number.isFinite(requested) && requested >= 1 && requested <= 6 ? requested : Math.min((profile.onboardingStep ?? 0) + 1, 5);

  if (step === 6) {
    const scope = preferences.defaultScope === "both" ? undefined : preferences.defaultScope;
    const candidates = await candidateStories({ scope });
    const context = await readerContext(userId, preferences.defaultScope, preferences.readingHistory);
    const saved = await savedStoryIds(userId);
    const edition = await getEditionStatus();
    const preview = rankForReader(candidates, context, 6);
    const samples = sampleEdition(candidates.length, now);
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <Progress step={6} />
        <section className="space-y-6">
          <div>
            <p className="kicker text-text-tertiary">Step 6 of 6</p>
            <h1 className="mt-1 text-4xl font-bold leading-tight sm:text-5xl">Your edition, as it stands</h1>
            <p className="dek mt-2 text-lg">The first stories of your feed, ranked by what you chose. Each says why it is here. Change anything now, or later in Settings.</p>
          </div>
          {samples.length ? <DemoBanner /> : null}
          {preview.length ? (
            <StoryList placed={preview} now={now} saved={saved} label="Your edition preview" />
          ) : samples.length ? (
            <StoryList placed={samples.map((story) => ({ story, reason: "Sample: where the reason a story is here appears" }))} now={now} saved={saved} label="Sample edition" />
          ) : (
            <EmptyEdition reason={edition.updatedAt ? "no-stories" : "no-reports"} />
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <Link href="/app/onboarding?step=2" className="font-semibold underline underline-offset-4">
              Change my sections
            </Link>
            <FinishOnboarding />
          </div>
        </section>
      </div>
    );
  }

  const followedSources = new Set(interests.filter((entry) => entry.kind === "source" && entry.stance === "follow").map((entry) => entry.value));
  // One entry per publisher: the four arXiv listings are one source to a reader, and an index (GDELT) is not a publisher to follow.
  const cleared = SOURCE_CATALOGUE.filter((source) => source.rights.status === "cleared" && source.sourceType !== "aggregator").filter(
    (source, index, all) => all.findIndex((other) => other.canonicalDomain === source.canonicalDomain) === index,
  );
  return (
    <div className="mx-auto max-w-3xl">
      <OnboardingWizard
        initial={{
          step,
          preferences: { defaultScope: preferences.defaultScope, readingStyle: preferences.readingStyle },
          categories: interests.filter((entry) => entry.kind === "category" && entry.stance === "follow").map((entry) => entry.value),
          priorities: interests.filter((entry) => entry.kind === "category" && entry.priority).map((entry) => entry.value),
          places: interests.filter((entry) => (entry.kind === "state" || entry.kind === "region") && entry.stance === "follow").map(({ id, kind, value, label }) => ({ id, kind, value, label })),
          follows: interests.filter((entry) => (entry.kind === "entity" || entry.kind === "keyword") && entry.stance === "follow").map(({ id, kind, value, label }) => ({ id, kind, value, label })),
          sources: cleared.map((source) => ({ key: source.canonicalDomain, name: source.canonicalDomain === "arxiv.org" ? "arXiv (AI research)" : source.name, followed: followedSources.has(source.canonicalDomain) })),
          notifications: await getNotificationPrefs(userId),
        }}
      />
    </div>
  );
}
