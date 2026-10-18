import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { CATEGORIES } from "@/config/categories";
import { requireSession } from "@/lib/auth/session";
import { editionCounts } from "@/lib/queries/stories";
import { listInterests } from "@/lib/services/reader";

export const metadata: Metadata = { title: "Categories" };

/** Every section of the paper, with how many stories each has in the last two days and whether the reader follows it. */
export default async function CategoriesPage() {
  const session = await requireSession();
  const counts = await editionCounts();
  const interests = await listInterests(session.user.id);
  const followed = new Set(interests.filter((entry) => entry.kind === "category" && entry.stance === "follow").map((entry) => entry.value));
  return (
    <div className="mx-auto max-w-[var(--container)] space-y-8">
      <PageHeader kicker="Sections" title="Every section" description="Each section has its own front. Counts are stories updated in the last two days." />
      <ul className="grid gap-0 border-t border-border-strong sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((category) => {
          const count = counts.categories.get(category.slug) ?? 0;
          return (
            <li key={category.slug} className="border-b border-border sm:odd:border-r lg:[&:nth-child(3n+1)]:border-r lg:[&:nth-child(3n+2)]:border-r lg:odd:border-r-0 lg:[&:nth-child(3n+1)]:border-r">
              <Link href={`/app/categories/${category.slug}`} className="group block p-5 hover:bg-surface-hover">
                <p className="kicker text-text-tertiary">
                  {count} {count === 1 ? "story" : "stories"}
                  {followed.has(category.slug) ? " · following" : ""}
                </p>
                <p className="mt-1 font-display text-2xl font-bold group-hover:underline">{category.label}</p>
                <p className="mt-1 text-sm text-text-secondary">{category.summary}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
