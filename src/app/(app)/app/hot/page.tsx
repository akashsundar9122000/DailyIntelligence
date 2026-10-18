import type { Metadata } from "next";
import Link from "next/link";

import { ChipNav } from "@/components/news/chip-nav";
import { DemoBanner, EmptyEdition, StoryList } from "@/components/news/edition";
import { PageHeader } from "@/components/ui/page-header";
import { CATEGORIES, isCategorySlug } from "@/config/categories";
import { requireSession } from "@/lib/auth/session";
import { sampleEdition } from "@/lib/demo/provider";
import { getEditionStatus } from "@/lib/queries/edition";
import { hotStories } from "@/lib/queries/stories";
import { savedStoryIds } from "@/lib/services/reader";

export const metadata: Metadata = { title: "Hot Now" };

type Params = { scope?: string; c?: string; window?: string; min?: string; rising?: string };

const WINDOWS = { "6": "6 hours", "24": "24 hours", "48": "2 days" } as const;

/** Build a link to this page with one filter changed and the rest kept. */
function hrefWith(params: Params, change: Partial<Params>): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...change })) if (value) next.set(key, value);
  const query = next.toString();
  return query ? `/app/hot?${query}` : "/app/hot";
}

/**
 * Stories gaining attention fastest, as clusters. Heat and how well each is
 * sourced are printed side by side on every row; a viral, thinly sourced story
 * says so. Filters are links, so a filtered view has its own address.
 */
export default async function HotPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await requireSession();
  const now = new Date();
  const params = await searchParams;
  const scope = params.scope === "india" || params.scope === "global" ? params.scope : undefined;
  const category = params.c && isCategorySlug(params.c) ? params.c : undefined;
  const window = params.window && params.window in WINDOWS ? params.window : "24";
  const min = params.min === "2" || params.min === "3" ? Number(params.min) : undefined;
  const rising = params.rising === "1";
  const stories = await hotStories({ scope, category, withinHours: Number(window), minSources: min, rising }, 40);
  const saved = await savedStoryIds(session.user.id);
  const edition = await getEditionStatus();
  const filtered = Boolean(scope || category || min || rising || window !== "24");
  const samples = filtered ? [] : sampleEdition(stories.length, now).sort((a, b) => b.heat - a.heat);
  const shown = samples.length ? samples : stories;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        kicker="Ranked by heat"
        title="Hot now"
        description="How fast each story is spreading: new reports against its own recent pace, how many independent publishers have it, and how recently it moved. How well it is sourced is printed beside it, and never mixed in."
      />
      <div className="space-y-3">
        <ChipNav
          label="Edition"
          chips={[
            { href: hrefWith(params, { scope: undefined }), label: "India + World", current: !scope },
            { href: hrefWith(params, { scope: "india" }), label: "India", current: scope === "india" },
            { href: hrefWith(params, { scope: "global" }), label: "World", current: scope === "global" },
          ]}
        />
        <ChipNav
          label="Filters"
          chips={[
            ...Object.entries(WINDOWS).map(([value, label]) => ({ href: hrefWith(params, { window: value === "24" ? undefined : value }), label: `Last ${label}`, current: window === value })),
            { href: hrefWith(params, { min: min === 2 ? undefined : "2" }), label: "2+ independent sources", current: min === 2 },
            { href: hrefWith(params, { min: min === 3 ? undefined : "3" }), label: "3+ sources", current: min === 3 },
            { href: hrefWith(params, { rising: rising ? undefined : "1" }), label: "Rising only", current: rising },
          ]}
        />
        <ChipNav
          label="Section"
          chips={[
            { href: hrefWith(params, { c: undefined }), label: "All sections", current: !category },
            ...CATEGORIES.map((entry) => ({ href: hrefWith(params, { c: entry.slug }), label: entry.label, current: category === entry.slug })),
          ]}
        />
      </div>
      {samples.length ? <DemoBanner /> : null}
      {shown.length === 0 ? (
        <EmptyEdition
          reason={!edition.updatedAt ? "no-reports" : filtered ? "no-matches" : "no-stories"}
          action={filtered ? <Link href="/app/hot" className="font-semibold underline underline-offset-4">Clear filters</Link> : undefined}
        />
      ) : (
        <StoryList
          numbered
          label="Hot stories"
          now={now}
          saved={saved}
          placed={shown.map((story) => ({
            story,
            reason: `Why it is hot: ${[
              story.direction === "rising" ? "picking up pace" : story.direction === "cooling" ? "slowing down" : "steady",
              `${story.sourceCount} ${story.sourceCount === 1 ? "publisher" : "independent publishers"}`,
              story.heat >= 70 && story.confidence < 40 ? "spreading faster than it is being confirmed" : null,
            ]
              .filter(Boolean)
              .join(" · ")}`,
          }))}
        />
      )}
    </div>
  );
}
