import Link from "next/link";

import { relativeTime } from "@/lib/format/date";

import { SectionHead } from "./edition";
import type { CardStory } from "./story-card";

/** The numbered Hot Now column: heat with its direction, beside how well each is sourced. */
export function HotColumn({ stories, now }: { stories: CardStory[]; now: Date }) {
  if (stories.length === 0) return null;
  return (
    <section aria-labelledby="hot-column">
      <SectionHead id="hot-column" kicker="Spreading fastest" title="Hot now" href="/app/hot" />
      <ol className="mt-3 divide-y divide-border">
        {stories.map((story, index) => (
          <li key={story.id} className="flex gap-3 py-3">
            <span className="w-6 shrink-0 font-display text-2xl font-black leading-none text-press tabular-nums">{index + 1}</span>
            <div className="min-w-0">
              {story.sample ? (
                <p className="font-display text-base font-bold leading-snug">{story.headline}</p>
              ) : (
                <Link href={`/app/story/${story.id}`} className="font-display text-base font-bold leading-snug hover:underline">
                  {story.headline}
                </Link>
              )}
              <p className="mt-1 text-xs text-text-tertiary">
                Heat {story.heat}
                {story.direction === "rising" ? ", rising" : story.direction === "cooling" ? ", cooling" : ""} · sourced {story.confidence} · {story.sourceCount}{" "}
                {story.sourceCount === 1 ? "source" : "sources"} · {relativeTime(story.lastUpdatedAt, now)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The reader's briefing: the first few stories of their own edition, with an
 * honest reading time (about a minute per story's headline and its sources),
 * and why each one is there. The AI-written "catch me up" summary joins it in
 * the next phase; until then this is the list it will summarise.
 */
export function BriefingColumn({ entries }: { entries: { story: CardStory; reason?: string }[] }) {
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby="briefing-column" className="border border-border-strong border-t-[3px] border-t-text-primary bg-surface p-4">
      <p className="kicker text-text-tertiary">Your briefing</p>
      <h2 id="briefing-column" className="text-xl font-bold">
        {entries.length} stories · about {entries.length} minutes
      </h2>
      <ol className="mt-3 space-y-3">
        {entries.map(({ story, reason }) => (
          <li key={story.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
            {story.sample ? (
              <p className="font-display font-bold leading-snug">{story.headline}</p>
            ) : (
              <Link href={`/app/story/${story.id}`} className="font-display font-bold leading-snug hover:underline">
                {story.headline}
              </Link>
            )}
            {reason ? <p className="mt-0.5 text-xs text-text-tertiary">{reason}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
