import type { Metadata } from "next";

import { DemoBanner, EmptyEdition, FrontLayout } from "@/components/news/edition";
import { HotColumn } from "@/components/news/sidebar";
import { PageHeader } from "@/components/ui/page-header";
import { NewStories } from "@/components/news/new-stories";
import { SCOPE_LABELS } from "@/config/regions";
import { requireSession } from "@/lib/auth/session";
import { sampleEdition } from "@/lib/demo/provider";
import { formatDateline } from "@/lib/format/date";
import { getEditionStatus } from "@/lib/queries/edition";
import { getPreferences } from "@/lib/queries/preferences";
import { frontPage, hotStories } from "@/lib/queries/stories";
import { savedStoryIds } from "@/lib/services/reader";

export const metadata: Metadata = { title: "Today" };

/** Today's front page: importance first, the same for every reader of an edition. Nothing here is personalised. */
export default async function TodayPage() {
  const session = await requireSession();
  const now = new Date();
  const preferences = await getPreferences(session.user.id);
  const scope = preferences.defaultScope === "both" ? undefined : preferences.defaultScope;
  const stories = await frontPage({ scope }, 30);
  const hot = await hotStories({ scope }, 5);
  const saved = await savedStoryIds(session.user.id);
  const edition = await getEditionStatus();
  const samples = sampleEdition(stories.length, now);
  const shown = samples.length ? samples : stories;
  return (
    <div className="mx-auto max-w-[var(--container)] space-y-6">
      <NewStories renderedAt={now.toISOString()} scope={preferences.defaultScope === "both" ? undefined : preferences.defaultScope} />
      <PageHeader kicker={formatDateline(now.toISOString())} title="Today's front page" description={`The ${SCOPE_LABELS[preferences.defaultScope]} edition, by importance: the same page every reader sees.`} />
      {samples.length ? <DemoBanner /> : null}
      {shown.length === 0 ? (
        <EmptyEdition reason={edition.updatedAt ? "no-stories" : "no-reports"} />
      ) : (
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <FrontLayout placed={shown.map((story) => ({ story }))} now={now} saved={saved} label="Today's stories" />
          <aside className="xl:border-l xl:border-border-strong xl:pl-8" aria-label="Alongside the front page">
            <HotColumn stories={samples.length ? samples.filter((story) => story.heat >= 60) : hot} now={now} />
          </aside>
        </div>
      )}
    </div>
  );
}
