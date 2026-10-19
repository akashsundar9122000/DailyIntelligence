import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SectionHead } from "@/components/news/edition";
import { PageHeader } from "@/components/ui/page-header";
import { categoryFor } from "@/config/categories";
import { requireSession } from "@/lib/auth/session";
import { significantTokens } from "@/lib/ingestion/normalize";
import { aiConfigured } from "@/lib/env";
import { formatInstant, relativeTime } from "@/lib/format/date";
import { latestEditionBriefing, oneMinuteFor } from "@/lib/queries/ai";
import { getPreferences } from "@/lib/queries/preferences";
import { frontPage, type StoryCard } from "@/lib/queries/stories";
import { markOpened } from "@/lib/services/notifications";
import { lastSessionAt, listInterests } from "@/lib/services/reader";

export const metadata: Metadata = { title: "Briefings" };

const MAX_SECTIONS = 4;

/*
 * Whether a model's line says anything its headline does not. From headlines
 * alone a model often writes the headline back as a sentence (seen on 19
 * October 2026); printing both is the same news twice. Two new significant
 * words, or it is not shown.
 */
function addsToHeadline(line: string | undefined, headline: string): line is string {
  if (!line) return false;
  const known = new Set(significantTokens(headline));
  return significantTokens(line).filter((token) => !known.has(token)).length >= 2;
}

/**
 * A headline and, where a checked explainer exists, its first sentence --
 * labelled, because a model wrote it. Citations live on the story page; this
 * is the index to it.
 */
function BriefLine({ story, line, now }: { story: StoryCard; line: string | undefined; now: Date }) {
  return (
    <li className="py-3.5">
      <Link href={`/app/story/${story.id}`} className="font-display text-lg font-bold leading-snug hover:underline">
        {story.headline}
      </Link>
      {addsToHeadline(line, story.headline) ? (
        <p className="mt-1 font-serif text-base leading-relaxed text-text-secondary">
          <span className="mr-1.5 font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-text-tertiary">AI summary</span>
          {line}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-text-tertiary">
        {story.sourceCount} {story.sourceCount === 1 ? "publisher" : "publishers"} · updated {relativeTime(story.lastUpdatedAt, now)}
      </p>
    </li>
  );
}

/**
 * Briefings. The edition briefing is written by the model from the day's
 * checked explainers and labelled as such; "since you last checked" and the
 * section round-ups are a selection and an order made from the records, each
 * line the story's own checked one-minute sentence, labelled as AI.
 */
export default async function BriefingsPage({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const session = await requireSession();
  const { n } = await searchParams;
  if (n) await markOpened(session.user.id, n);
  const now = new Date();
  const preferences = await getPreferences(session.user.id);
  const edition = await latestEditionBriefing();

  const since = preferences.readingHistory ? await lastSessionAt(session.user.id) : null;
  const sinceAt = since ?? new Date(now.getTime() - 12 * 3_600_000).toISOString();
  const hours = Math.min(48, Math.max(1, Math.ceil((now.getTime() - new Date(sinceAt).getTime()) / 3_600_000)));
  const scope = preferences.defaultScope === "both" ? undefined : preferences.defaultScope;
  const catchUp = (await frontPage({ scope, withinHours: hours }, 30)).filter((story) => story.lastUpdatedAt > sinceAt).slice(0, 8);

  const followed = (await listInterests(session.user.id)).filter((entry) => entry.kind === "category" && entry.stance === "follow").slice(0, MAX_SECTIONS);
  const sections = await Promise.all(followed.map(async (entry) => ({ slug: entry.value, label: categoryFor(entry.value)?.label ?? entry.label, stories: await frontPage({ category: entry.value, withinHours: 24 }, 3) })));

  const lines = await oneMinuteFor([...catchUp, ...sections.flatMap((section) => section.stories)].map((story) => story.id));
  const first = (id: string) => lines.get(id)?.[0]?.text;

  return (
    <div className="mx-auto max-w-[var(--container)] space-y-10">
      <PageHeader kicker="Catch up" title="Briefings" description="The edition in a few minutes, what moved since you last read, and your sections at a glance. Every line leads to the story and its sources." />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-0 lg:divide-x lg:divide-border-strong">
        <section aria-labelledby="edition-briefing" className="space-y-4 lg:pr-8">
          <div className="border-t-2 border-text-primary pt-2.5">
            <p className="kicker flex items-center gap-1.5 text-text-tertiary">
              <Sparkles className="size-3.5" aria-hidden /> AI-generated briefing
            </p>
            <h2 id="edition-briefing" className="text-2xl font-bold leading-tight">
              {edition ? `The ${edition.slot} briefing` : "The edition briefing"}
            </h2>
          </div>
          {edition ? (
            <>
              <ol className="divide-y divide-border">
                {edition.lines.map((line, index) => (
                  <li key={line.storyId} className="flex gap-4 py-4">
                    <span className="w-6 shrink-0 font-display text-2xl font-black leading-none text-text-tertiary tabular-nums">{index + 1}</span>
                    <div className="min-w-0">
                      <Link href={`/app/story/${line.storyId}`} className="font-serif text-lg leading-relaxed underline-offset-4 hover:underline">
                        {line.text}
                      </Link>
                      {/* The publisher's headline too, when the line says something it does not: whose words are whose stays plain. */}
                      {addsToHeadline(line.text, line.headline) ? <p className="mt-1 text-sm text-text-secondary">Headline: {line.headline}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="text-xs leading-relaxed text-text-tertiary">
                Written by an AI model ({edition.model}) at {formatInstant(edition.generatedAt)}, one line per story, each checked against that story&rsquo;s own explainer: no name or
                number appears that the story&rsquo;s sources did not give.
              </p>
            </>
          ) : (
            <p className="border border-dashed border-border-strong px-5 py-8 font-serif text-lg text-text-secondary">
              {aiConfigured()
                ? "No briefing yet for this edition. It is written from 06:00 and 18:00 IST, once at least three of the day's stories have explainers that passed their checks."
                : "Briefings are written by an AI model, which is not configured on this deployment. The catch-up beside this is assembled from the records and works without it."}
            </p>
          )}
        </section>

        <div className="space-y-10 lg:pl-8">
          <section aria-labelledby="since">
            <SectionHead id="since" kicker={since ? `Since ${formatInstant(since)}` : "The last twelve hours"} title="Since you last checked" />
            {catchUp.length ? (
              <ul className="divide-y divide-border">
                {catchUp.map((story) => (
                  <BriefLine key={story.id} story={story} line={first(story.id)} now={now} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-text-secondary">Nothing new has been reported since then.</p>
            )}
          </section>

          {sections.length ? (
            sections.map((section) => (
              <section key={section.slug} aria-labelledby={`section-${section.slug}`}>
                <SectionHead id={`section-${section.slug}`} kicker="A section you follow" title={section.label} href={`/app/categories/${section.slug}`} />
                {section.stories.length ? (
                  <ul className="divide-y divide-border">
                    {section.stories.map((story) => (
                      <BriefLine key={story.id} story={story} line={first(story.id)} now={now} />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-text-secondary">Nothing in this section in the last day.</p>
                )}
              </section>
            ))
          ) : (
            <p className="text-sm text-text-secondary">
              Follow a few sections and each gets a round-up here. <Link href="/app/categories" className="font-semibold underline underline-offset-4">Choose sections</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
