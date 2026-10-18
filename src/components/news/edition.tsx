import { Newspaper } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/components/ui/cn";

import { StoryCard, type CardStory } from "./story-card";

export type Placed = { story: CardStory; reason?: string; discovery?: boolean };

/** A section's head on a page: a thick rule, a kicker, a title, and an optional "see all". */
export function SectionHead({ kicker, title, href, linkLabel = "See all", id }: { kicker?: string; title: string; href?: string; linkLabel?: string; id?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 border-t-2 border-text-primary pt-2.5">
      <div>
        {kicker ? <p className="kicker text-text-tertiary">{kicker}</p> : null}
        <h2 id={id} className="text-2xl font-bold leading-tight">
          {title}
        </h2>
      </div>
      {href ? (
        <Link href={href} className="shrink-0 pb-1 text-sm font-semibold underline underline-offset-4">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

/** Shown above the sample edition and nowhere else. It cannot be dismissed: a sample must never pass for news. */
export function DemoBanner() {
  return (
    <div role="note" className="border-2 border-press bg-press-subtle px-4 py-3 text-sm text-press">
      <p className="font-bold uppercase tracking-[0.08em]">Sample content: not live news</p>
      <p className="mt-0.5 text-text-primary">No source has reported yet, so this deployment is showing invented stories to demonstrate the paper. Every one is labelled Sample.</p>
    </div>
  );
}

/**
 * An empty edition, explained. Never a blank page and never filler: it says
 * why there is nothing (no source has reported yet, or nothing matches these
 * filters) and what happens next.
 */
export function EmptyEdition({ reason, action }: { reason: "no-reports" | "no-matches" | "no-stories"; action?: ReactNode }) {
  const copy = {
    "no-reports": {
      title: "The first edition is being set.",
      body: "No source has reported yet. Sources are read every fifteen minutes; the paper fills as they answer. Nothing is shown until then, because nothing would be real.",
    },
    "no-matches": { title: "Nothing matches these filters.", body: "No story in this edition fits every filter you chose. Widen the time window or remove a filter." },
    "no-stories": { title: "Nothing new here yet.", body: "No story in this section has been reported in the time shown. It fills as the sources report." },
  }[reason];
  return (
    <div className="border border-dashed border-border-strong px-6 py-12 text-center">
      <Newspaper className="mx-auto size-8 text-text-tertiary" aria-hidden />
      <p className="mt-4 font-display text-2xl font-bold">{copy.title}</p>
      <p className="mx-auto mt-2 max-w-xl font-serif text-lg leading-relaxed text-text-secondary">{copy.body}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm">
        {action}
        <Link href="/status" className="font-semibold underline underline-offset-4">
          See which sources are reporting
        </Link>
      </div>
    </div>
  );
}

/**
 * A front page: the lead story large beside two seconds, then a grid of
 * standard stories, then the rest as rows. Columns are ruled, as on paper.
 * The order is the caller's: this only decides where each one sits.
 */
export function FrontLayout({ placed, now, saved, signedIn = true, label }: { placed: Placed[]; now: Date; saved: Set<string>; signedIn?: boolean; label: string }) {
  const [lead, ...rest] = placed;
  if (!lead) return null;
  const seconds = rest.slice(0, 2);
  const grid = rest.slice(2, 8);
  const rows = rest.slice(8);
  const card = (entry: Placed, variant: "lead" | "standard" | "row" | "compact") => (
    <StoryCard story={entry.story} now={now} variant={variant} reason={entry.reason} discovery={entry.discovery} saved={saved.has(entry.story.id)} signedIn={signedIn} />
  );
  return (
    <section aria-label={label} className="space-y-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:gap-0 lg:divide-x lg:divide-border-strong">
        <div className="lg:pr-8">{card(lead, "lead")}</div>
        {seconds.length ? (
          <div className="space-y-6 divide-y divide-border lg:pl-8 [&>*+*]:pt-6">
            {seconds.map((entry) => (
              <div key={entry.story.id}>{card(entry, "standard")}</div>
            ))}
          </div>
        ) : null}
      </div>
      {grid.length ? (
        <div className="grid gap-8 border-t border-border-strong pt-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-0 lg:[&>*]:px-6 lg:[&>*:nth-child(3n+1)]:pl-0 lg:[&>*:nth-child(3n)]:pr-0 lg:[&>*:not(:nth-child(3n+1))]:border-l lg:[&>*]:border-border">
          {grid.map((entry) => (
            <div key={entry.story.id} className={cn("min-w-0")}>
              {card(entry, "standard")}
            </div>
          ))}
        </div>
      ) : null}
      {rows.length ? (
        <ol className="divide-y divide-border border-t border-border-strong">
          {rows.map((entry) => (
            <li key={entry.story.id} className="py-5">
              {card(entry, "row")}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

/** A plain list of stories as rows, for search results and section pages. */
export function StoryList({ placed, now, saved, label, numbered = false }: { placed: Placed[]; now: Date; saved: Set<string>; label: string; numbered?: boolean }) {
  return (
    <ol aria-label={label} className="divide-y divide-border border-y border-border">
      {placed.map((entry, index) => (
        <li key={entry.story.id} className="flex gap-4 py-5">
          {numbered ? <span className="w-8 shrink-0 font-display text-3xl font-black leading-none text-text-tertiary tabular-nums">{index + 1}</span> : null}
          <div className="min-w-0 flex-1">
            <StoryCard story={entry.story} now={now} variant="row" reason={entry.reason} discovery={entry.discovery} saved={saved.has(entry.story.id)} />
          </div>
        </li>
      ))}
    </ol>
  );
}
