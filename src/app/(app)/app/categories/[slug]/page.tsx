import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DemoBanner, EmptyEdition, FrontLayout } from "@/components/news/edition";
import { FollowButton } from "@/components/news/follow-button";
import { PageHeader } from "@/components/ui/page-header";
import { categoryFor } from "@/config/categories";
import { requireSession } from "@/lib/auth/session";
import { sampleEdition } from "@/lib/demo/provider";
import { getEditionStatus } from "@/lib/queries/edition";
import { frontPage } from "@/lib/queries/stories";
import { listInterests, savedStoryIds } from "@/lib/services/reader";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = categoryFor((await params).slug);
  return { title: category?.label ?? "Section" };
}

/**
 * One section's front: its stories by importance over two days, the same for
 * every reader, with the follow control on the masthead so a reader can act on
 * the section where they meet it. An unknown slug is a 404, not an empty front,
 * so a mistyped link never looks like a quiet news day.
 */
export default async function CategoryPage({ params }: Props) {
  const session = await requireSession();
  const category = categoryFor((await params).slug);
  if (!category) notFound();
  const now = new Date();
  const stories = await frontPage({ category: category.slug, withinHours: 48 }, 40);
  const saved = await savedStoryIds(session.user.id);
  const edition = await getEditionStatus();
  const interest = (await listInterests(session.user.id)).find((entry) => entry.kind === "category" && entry.value === category.slug);
  const samples = sampleEdition(stories.length, now).filter((story) => story.category === category.slug);
  const shown = samples.length ? samples : stories;

  return (
    <div className="mx-auto max-w-[var(--container)] space-y-6">
      <PageHeader
        kicker="Section"
        title={category.label}
        description={category.summary}
        actions={<FollowButton kind="category" value={category.slug} label={category.label} stance={interest?.stance ?? null} />}
      />
      {samples.length ? <DemoBanner /> : null}
      {shown.length === 0 ? (
        <EmptyEdition
          reason={edition.updatedAt ? "no-stories" : "no-reports"}
          action={
            <Link href="/app/categories" className="font-semibold underline underline-offset-4">
              Every section
            </Link>
          }
        />
      ) : (
        <FrontLayout placed={shown.map((story) => ({ story }))} now={now} saved={saved} label={`${category.label} stories`} />
      )}
    </div>
  );
}
