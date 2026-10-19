import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ChipNav } from "@/components/news/chip-nav";
import { SectionHead, StoryList } from "@/components/news/edition";
import { FollowButton } from "@/components/news/follow-button";
import { RecentSearches } from "@/components/news/recent-searches";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CATEGORIES, isCategorySlug } from "@/config/categories";
import { requireSession } from "@/lib/auth/session";
import { searchByMeaning } from "@/lib/services/search";
import { searchableSources, searchStories } from "@/lib/queries/stories";
import { listInterests, savedStoryIds } from "@/lib/services/reader";

export const metadata: Metadata = { title: "Explore" };

type Params = { q?: string; tab?: string; scope?: string; c?: string; days?: string; min?: string };
const TABS = ["stories", "sources", "sections"] as const;
const DAYS = { "1": "Today", "7": "This week", "30": "This month" } as const;

function hrefWith(params: Params, change: Partial<Params>): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...change })) if (value) next.set(key, value);
  return `/app/search?${next.toString()}`;
}

/**
 * Explore: search every story by any of its publishers' wording, the sources
 * we read, and the sections. A GET form, so a search has an address that can
 * be shared, reloaded and reached with Back.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await requireSession();
  const now = new Date();
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 200);
  const tab = (TABS as readonly string[]).includes(params.tab ?? "") ? (params.tab as (typeof TABS)[number]) : "stories";
  const scope = params.scope === "india" || params.scope === "global" ? params.scope : undefined;
  const category = params.c && isCategorySlug(params.c) ? params.c : undefined;
  const days = params.days && params.days in DAYS ? params.days : "30";
  const min = params.min === "2" ? 2 : undefined;

  const stories = tab === "stories" && query ? await searchStories({ query, scope, category, withinHours: Number(days) * 24, minSources: min }) : [];
  // Beside the word search, never instead of it: the stories it found are not repeated.
  const meaning = tab === "stories" && query ? await searchByMeaning(session.user.id, query, { scope, category, minSources: min }, new Set(stories.map((story) => story.id))) : { stories: [], available: false };
  const sources = tab === "sources" ? await searchableSources() : [];
  const interests = await listInterests(session.user.id);
  const saved = await savedStoryIds(session.user.id);
  const needle = query.toLowerCase();
  const sourceMatches = sources.filter((source) => !needle || source.name.toLowerCase().includes(needle) || source.key.includes(needle));
  const sectionMatches = CATEGORIES.filter((entry) => !needle || entry.label.toLowerCase().includes(needle) || entry.summary.toLowerCase().includes(needle));
  const stanceOf = (kind: string, value: string) => interests.find((entry) => entry.kind === kind && entry.value === value)?.stance ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader kicker="Explore" title="Search the paper" description="Every story, by any of its publishers' wording. Quote a phrase to match it exactly; put a minus before a word to leave it out." />
      <form action="/app/search" method="get" role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" aria-hidden />
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="A story, a place, a person, a topic"
            className="h-12 w-full border border-border-input bg-surface pl-10 pr-3 text-text-primary placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            autoComplete="off"
            maxLength={200}
          />
        </div>
        <input type="hidden" name="tab" value={tab} />
        <Button type="submit" size="lg">
          Search
        </Button>
      </form>
      <RecentSearches current={query} />

      <ChipNav
        label="What to search"
        chips={[
          { href: hrefWith(params, { tab: undefined }), label: "Stories", current: tab === "stories" },
          { href: hrefWith(params, { tab: "sources" }), label: "Sources", current: tab === "sources" },
          { href: hrefWith(params, { tab: "sections" }), label: "Sections", current: tab === "sections" },
        ]}
      />

      {tab === "stories" ? (
        <>
          <ChipNav
            label="Filters"
            chips={[
              { href: hrefWith(params, { scope: undefined }), label: "India + World", current: !scope },
              { href: hrefWith(params, { scope: "india" }), label: "India", current: scope === "india" },
              { href: hrefWith(params, { scope: "global" }), label: "World", current: scope === "global" },
              ...Object.entries(DAYS).map(([value, label]) => ({ href: hrefWith(params, { days: value === "30" ? undefined : value }), label, current: days === value })),
              { href: hrefWith(params, { min: min ? undefined : "2" }), label: "2+ sources", current: Boolean(min) },
              ...(category ? [{ href: hrefWith(params, { c: undefined }), label: `Section: ${CATEGORIES.find((entry) => entry.slug === category)?.label} ×`, current: true }] : []),
            ]}
          />
          {!query ? (
            <p className="font-serif text-lg text-text-secondary">Type something to search. Results come from stories in the last month, from every source we read.</p>
          ) : stories.length === 0 ? (
            <p className="font-serif text-lg text-text-secondary">
              Nothing matches “{query}” in the stories we hold. Try fewer words, or <Link href={hrefWith(params, { days: undefined, scope: undefined, min: undefined })} className="underline underline-offset-4">clear the filters</Link>.
            </p>
          ) : (
            <>
              <p className="text-sm text-text-secondary">
                {stories.length} {stories.length === 1 ? "story" : "stories"} for “{query}”, best match first.
              </p>
              <StoryList placed={stories.map((story) => ({ story }))} now={now} saved={saved} label={`Results for ${query}`} />
            </>
          )}
          {meaning.stories.length ? (
            <section aria-labelledby="meaning-heading" className="space-y-3 pt-4">
              <SectionHead id="meaning-heading" kicker="Found by meaning, not by your words" title="Close in meaning" />
              <p className="text-sm text-text-secondary">An AI model compared what you typed with each headline. These do not contain your words; check that they are what you meant.</p>
              <StoryList placed={meaning.stories.map((story) => ({ story }))} now={now} saved={saved} label={`Close in meaning to ${query}`} />
            </section>
          ) : null}
        </>
      ) : null}

      {tab === "sources" ? (
        <ul className="divide-y divide-border border-y border-border">
          {sourceMatches.map((source) => (
            <li key={source.key} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="font-display text-xl font-bold">{source.name}</p>
                <p className="text-sm text-text-secondary">
                  {source.isOfficial ? "Official source" : source.sourceType === "research" ? "Research" : "News index"} · {source.stories} {source.stories === 1 ? "story" : "stories"} this week
                </p>
              </div>
              {source.sourceType === "aggregator" ? (
                <span className="text-sm text-text-tertiary">An index of many publishers: follow sections or places instead.</span>
              ) : (
                <FollowButton kind="source" value={source.domain} label={source.name} stance={stanceOf("source", source.domain)} />
              )}
            </li>
          ))}
          {sourceMatches.length === 0 ? <li className="py-4 text-text-secondary">No source by that name. The full list is in the <Link href="/sources" className="underline">source directory</Link>.</li> : null}
        </ul>
      ) : null}

      {tab === "sections" ? (
        <ul className="divide-y divide-border border-y border-border">
          {sectionMatches.map((entry) => (
            <li key={entry.slug} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <Link href={`/app/categories/${entry.slug}`} className="font-display text-xl font-bold hover:underline">
                  {entry.label}
                </Link>
                <p className="text-sm text-text-secondary">{entry.summary}</p>
              </div>
              <FollowButton kind="category" value={entry.slug} label={entry.label} stance={stanceOf("category", entry.slug)} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
