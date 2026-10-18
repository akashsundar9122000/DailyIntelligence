import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SectionHead } from "@/components/news/edition";
import { ReaderTools } from "@/components/news/reader-tools";
import { ScoreExplainer } from "@/components/news/score-explainer";
import { ScorePair } from "@/components/news/score-pair";
import { StoryActions } from "@/components/news/story-actions";
import { KindBadge, kickerOf, StoryCard } from "@/components/news/story-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { INDIAN_STATES } from "@/config/regions";
import { requireSession } from "@/lib/auth/session";
import { formatInstant, relativeTime, timesLine } from "@/lib/format/date";
import { getPreferences } from "@/lib/queries/preferences";
import { relatedStories, storyDetail, type StorySource } from "@/lib/queries/stories";
import { previousVisit, recordRead, savedStoryIds } from "@/lib/services/reader";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const detail = await storyDetail(id);
  return { title: detail?.story.headline.slice(0, 80) ?? "Story" };
}

/**
 * A plain account of a story built only from its records -- who reported it,
 * when, from where -- with no model involved. Labelled as such. The AI-written
 * explainer (phase 2) sits above it when it exists; this is what stands when
 * it does not, or when the AI service is unavailable.
 */
function plainAccount(detail: NonNullable<Awaited<ReturnType<typeof storyDetail>>>): string {
  const { story, sources } = detail;
  const chronological = [...sources].sort((a, b) => (a.publishedAt ?? a.ingestedAt).localeCompare(b.publishedAt ?? b.ingestedAt));
  const first = chronological[0];
  const publishers = new Set(sources.map((source) => source.publisher));
  const official = sources.filter((source) => source.isOfficial).map((source) => source.sourceName);
  const place =
    story.scope === "india"
      ? story.states.length
        ? `in ${story.states.map((code) => INDIAN_STATES.find((state) => state.code === code)?.label ?? code).join(", ")}, India`
        : "in India"
      : story.countries.length
        ? `touching ${story.countries.length} ${story.countries.length === 1 ? "country" : "countries"}`
        : "";
  const parts = [
    `${publishers.size} ${publishers.size === 1 ? "publisher has" : "publishers have"} reported this story${place ? ` ${place}` : ""}.`,
    first ? `The earliest report on record is from ${first.publisher}${first.publishedAt ? `, ${formatInstant(first.publishedAt)}` : ""}.` : "",
    official.length ? `It includes an official statement from ${[...new Set(official)].join(" and ")}.` : "No official statement is on record for it yet.",
    publishers.size === 1 ? "Only one source has it so far: treat it as unconfirmed until others report it." : "",
  ];
  return parts.filter(Boolean).join(" ");
}

function SourceRow({ source, now }: { source: StorySource; now: Date }) {
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-text-primary">{source.publisher}</p>
        <KindBadge story={source} />
        {source.method === "url" ? <Badge>Same article</Badge> : null}
      </div>
      <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-1 block font-display text-lg font-bold leading-snug hover:underline">
        {source.title}
        <span className="sr-only"> (opens the publisher&rsquo;s page in a new tab)</span>
      </a>
      {source.excerpt ? <p className="mt-1.5 font-serif text-base leading-relaxed text-text-secondary">{source.excerpt}</p> : null}
      <p className="mt-1.5 text-xs text-text-tertiary">
        {timesLine(source.publishedAt, source.ingestedAt, now)} · via {source.sourceName}
        {source.attribution ? ` · ${source.attribution}` : ""}
      </p>
    </li>
  );
}

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const now = new Date();
  const detail = await storyDetail(id);
  // A story that does not exist and one that may not be shown answer the same.
  if (!detail) notFound();
  const { story, sources, score } = detail;
  const preferences = await getPreferences(session.user.id);
  // Read BEFORE this visit is recorded, so "since your last visit" compares with the last one and not this one.
  const lastVisit = preferences.readingHistory ? await previousVisit(session.user.id, story.id) : null;
  await recordRead(session.user.id, story.id, preferences.readingHistory);
  const saved = await savedStoryIds(session.user.id);
  const related = await relatedStories(story, 5);
  const sinceLastVisit = lastVisit ? sources.filter((source) => source.ingestedAt > lastVisit) : [];
  const timeline = [...sources].sort((a, b) => (a.publishedAt ?? a.ingestedAt).localeCompare(b.publishedAt ?? b.ingestedAt));
  const account = plainAccount(detail);

  return (
    <article className="mx-auto max-w-[var(--container)]" aria-labelledby="story-headline">
      <nav aria-label="Breadcrumb" className="pb-4 text-sm text-text-secondary">
        <Link href={story.scope === "india" ? "/app/india" : "/app/global"} className="hover:underline">
          {story.scope === "india" ? "India" : "World"}
        </Link>
        <span aria-hidden> / </span>
        <span>{kickerOf(story).split(" · ")[0]}</span>
      </nav>

      <header className="border-b-2 border-text-primary pb-6">
        <div className="flex flex-wrap items-center gap-2">
          {story.state === "developing" ? <Badge tone="press">Developing</Badge> : null}
          <p className="kicker text-text-tertiary">{kickerOf(story)}</p>
          <KindBadge story={story} />
        </div>
        <h1 id="story-headline" className="mt-3 max-w-5xl text-[clamp(2rem,4.6vw,3.75rem)] font-black leading-[1.03] tracking-[-0.015em]">
          {story.headline}
        </h1>
        <p className="mt-3 text-sm text-text-secondary">
          Headline as published by <span className="font-semibold text-text-primary">{story.publisher}</span> · {timesLine(story.publishedAt, story.firstSeenAt, now)} · last
          updated {relativeTime(story.lastUpdatedAt, now)}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <a href={story.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" aria-hidden /> Open the original
              <span className="sr-only"> (opens {story.publisher} in a new tab)</span>
            </a>
          </Button>
          <ScorePair heat={story.heat} confidence={story.confidence} direction={story.direction} size="md" />
          <span className="text-sm text-text-secondary">
            {story.sourceCount} {story.sourceCount === 1 ? "publisher" : "independent publishers"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <StoryActions storyId={story.id} saved={saved.has(story.id)} url={story.url} />
          <ReaderTools text={`${story.headline}. ${account}`} />
        </div>
      </header>

      <div className="grid gap-12 pt-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="glance">
            <SectionHead id="glance" kicker="From the records" title="At a glance" />
            <p className="prose-news mt-3 drop-cap">{account}</p>
            <p className="mt-2 text-xs text-text-tertiary">Written from the source records by rule, not by a model. An AI explainer with citations is added when it is available.</p>
            {story.sourceCount === 1 ? (
              <p className="mt-3 border-l-[3px] border-warning bg-warning-subtle px-3 py-2 text-sm text-warning">Limited source coverage: one publisher so far.</p>
            ) : null}
          </section>

          {lastVisit ? (
            <section aria-labelledby="since-visit">
              <SectionHead id="since-visit" kicker={`Since ${formatInstant(lastVisit)}`} title="What changed since your last visit" />
              {sinceLastVisit.length ? (
                <ul className="divide-y divide-border">
                  {sinceLastVisit.map((source) => (
                    <SourceRow key={source.itemId} source={source} now={now} />
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-text-secondary">No new reports since you last opened this story.</p>
              )}
            </section>
          ) : null}

          <section aria-labelledby="timeline">
            <SectionHead id="timeline" kicker="Oldest first" title="Coverage timeline" />
            <ol className="relative mt-4 space-y-5 border-l-2 border-border-strong pl-6">
              {timeline.map((source) => (
                <li key={source.itemId} className="relative">
                  <span aria-hidden className={source.isOfficial ? "absolute -left-[1.95rem] top-1.5 size-3 bg-press-solid" : "absolute -left-[1.95rem] top-1.5 size-3 rounded-full bg-text-primary"} />
                  <p className="text-xs font-semibold text-text-tertiary">
                    {source.publishedAt ? formatInstant(source.publishedAt) : `Found ${formatInstant(source.ingestedAt)} (publication time not given)`}
                  </p>
                  <p className="mt-0.5 text-sm">
                    <span className="font-semibold">{source.publisher}</span>
                    {source.isOfficial ? " issued an official statement: " : " reported: "}
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                      {source.title}
                    </a>
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="sources">
            <SectionHead id="sources" kicker={`${sources.length} ${sources.length === 1 ? "report" : "reports"} from ${story.sourceCount} ${story.sourceCount === 1 ? "publisher" : "publishers"}`} title="Every source" />
            <ul className="divide-y divide-border">
              {sources.map((source) => (
                <SourceRow key={source.itemId} source={source} now={now} />
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-10 lg:border-l lg:border-border-strong lg:pl-8" aria-label="About this story">
          {score ? (
            <section aria-labelledby="scores" className="space-y-4">
              <SectionHead id="scores" kicker="Measured, not guessed" title="Heat and confidence" />
              <ScoreExplainer score={score} />
            </section>
          ) : null}
          {related.length ? (
            <section aria-labelledby="related" className="space-y-3">
              <SectionHead id="related" kicker="Same section, same places" title="Related" />
              <ul className="divide-y divide-border">
                {related.map((entry) => (
                  <li key={entry.id} className="py-4">
                    <StoryCard story={entry} now={now} variant="compact" signedIn={false} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
