import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { categoryFor } from "@/config/categories";
import { relativeTime } from "@/lib/format/date";
import type { FrontPageHeadline } from "@/lib/queries/front-page";

/**
 * The landing page's right-hand column: the real front page, as it stands.
 *
 * Every line here is a story in the database, with its publisher and its
 * update time. Before the first edition there is nothing to show, and the
 * column says exactly that and lists who is on the press -- it never fills the
 * space with headlines that look real and are not.
 */
export function LiveFrontPage({ headlines, now, onPress }: { headlines: FrontPageHeadline[]; now: Date; onPress: string[] }) {
  return (
    <aside aria-labelledby="live-front-page" className="flex h-full flex-col border-t-[3px] border-rule pt-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="live-front-page" className="kicker text-text-primary">
          The front page, live
        </h2>
        {headlines.length > 0 ? (
          <Badge tone="press">
            <span aria-hidden className="size-1.5 rounded-full bg-on-press" /> Live
          </Badge>
        ) : null}
      </div>

      {headlines.length > 0 ? (
        <ol className="mt-3 divide-y divide-border">
          {headlines.map((story, index) => (
            <li key={story.id} className="py-4 first:pt-1">
              <p className="kicker text-text-tertiary">{categoryFor(story.category ?? "")?.label ?? (story.scope === "india" ? "India" : "World")}</p>
              <p className={index === 0 ? "mt-1 font-display text-2xl font-bold leading-tight" : "mt-1 font-display text-lg font-bold leading-snug"}>{story.headline}</p>
              <p className="mt-1.5 text-sm text-text-secondary">
                {story.publisher}
                {story.sourceCount > 1 ? ` + ${story.sourceCount - 1} more` : ""} · <time dateTime={story.lastUpdatedAt}>{relativeTime(story.lastUpdatedAt, now)}</time>
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-4 flex flex-1 flex-col">
          <p className="font-display text-2xl font-bold leading-tight">The first edition is being set.</p>
          <p className="mt-2 font-serif text-base leading-relaxed text-text-secondary">
            No story has come off the press yet, so there is nothing to show here, and we will not show you something that only looks like news. These sources are on the press:
          </p>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {onPress.map((name) => (
              <li key={name} className="py-2 text-sm font-medium text-text-primary">
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link href="/login" className="mt-auto pt-5 text-sm font-semibold text-text-primary underline underline-offset-4">
        Read the full edition →
      </Link>
    </aside>
  );
}
