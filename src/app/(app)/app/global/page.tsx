import type { Metadata } from "next";
import Link from "next/link";

import { ChipNav } from "@/components/news/chip-nav";
import { DemoBanner, EmptyEdition, FrontLayout } from "@/components/news/edition";
import { PageHeader } from "@/components/ui/page-header";
import { WORLD_REGIONS, type WorldRegion } from "@/config/regions";
import { requireSession } from "@/lib/auth/session";
import { sampleEdition } from "@/lib/demo/provider";
import { countriesInRegion } from "@/lib/ingestion/geo";
import { getEditionStatus } from "@/lib/queries/edition";
import { editionCounts, frontPage } from "@/lib/queries/stories";
import { savedStoryIds } from "@/lib/services/reader";

export const metadata: Metadata = { title: "Global" };

/**
 * The world edition, by region. A region is matched on where the EVENT is
 * (the places named in the reporting), never on where the publisher is: a
 * London paper's story about Nairobi is an Africa story.
 */
export default async function GlobalPage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  const session = await requireSession();
  const now = new Date();
  const { region: rawRegion } = await searchParams;
  const region = WORLD_REGIONS.find((entry) => entry.slug === rawRegion)?.slug as WorldRegion | undefined;
  const countries = region ? countriesInRegion(region) : undefined;
  const stories = await frontPage(region ? { countries, withinHours: 48 } : { scope: "global", withinHours: 48 }, 40);
  const counts = await editionCounts();
  const saved = await savedStoryIds(session.user.id);
  const edition = await getEditionStatus();
  const samples = region ? [] : sampleEdition(stories.length, now).filter((story) => story.scope === "global");
  const shown = samples.length ? samples : stories;
  const regionCount = (slug: WorldRegion) => countriesInRegion(slug).reduce((sum, iso) => sum + (counts.countries.get(iso) ?? 0), 0);
  const regionLabel = WORLD_REGIONS.find((entry) => entry.slug === region)?.label;

  return (
    <div className="mx-auto max-w-[var(--container)] space-y-6">
      <PageHeader kicker="World edition" title={regionLabel ? `World · ${regionLabel}` : "The world"} description="Stories by where they happened, not where they were published. A story touching several regions appears in each." />
      <ChipNav
        label="Filter by region"
        chips={[
          { href: "/app/global", label: "Whole world", current: !region },
          ...WORLD_REGIONS.map((entry) => ({ href: `/app/global?region=${entry.slug}`, label: `${entry.label} (${regionCount(entry.slug)})`, current: region === entry.slug })),
        ]}
      />
      {samples.length ? <DemoBanner /> : null}
      {shown.length === 0 ? (
        <EmptyEdition reason={!edition.updatedAt ? "no-reports" : region ? "no-matches" : "no-stories"} action={region ? <Link href="/app/global" className="font-semibold underline underline-offset-4">Whole world</Link> : undefined} />
      ) : (
        <FrontLayout placed={shown.map((story) => ({ story }))} now={now} saved={saved} label="World stories" />
      )}
    </div>
  );
}
