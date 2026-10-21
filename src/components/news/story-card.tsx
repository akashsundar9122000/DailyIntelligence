import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { categoryFor } from "@/config/categories";
import { INDIAN_STATES } from "@/config/regions";
import { timesLine } from "@/lib/format/date";
import { storyImage, type StoredImage } from "@/lib/media/story-image";
import type { StoryCard as Story } from "@/lib/queries/stories";

import { ScorePair } from "./score-pair";
import { StoryActions } from "./story-actions";
import { StoryPicture } from "./story-image";

export type CardStory = Story & { sample?: boolean; images?: StoredImage[] };

/** What kind of evidence the headline is. Shown on every card: a press release is not reporting. */
export function KindBadge({ story }: { story: Pick<CardStory, "contentType" | "isOfficial"> }) {
  if (story.contentType === "official_statement" || story.isOfficial) return <Badge tone="outline">Official statement</Badge>;
  if (story.contentType === "preprint") return <Badge tone="outline">Preprint</Badge>;
  if (story.contentType === "social_post") return <Badge tone="outline">Post</Badge>;
  if (story.contentType === "commentary") return <Badge tone="outline">Commentary</Badge>;
  return null;
}

/** A story's stored pictures -- its licensed photo, its AI illustration -- as the picture resolver takes them. */
export function storedOf(story: Pick<CardStory, "photo" | "illustration">): StoredImage[] | undefined {
  const stored: StoredImage[] = [];
  if (story.photo) stored.push({ kind: "photo", src: story.photo.src, alt: story.photo.alt ?? `Photo from ${story.photo.credit}`, credit: story.photo.credit });
  if (story.illustration) stored.push({ kind: "ai", ...story.illustration, credit: "AI illustration" });
  return stored.length ? stored : undefined;
}

/** The kicker: the section, then the place. */
export function kickerOf(story: Pick<CardStory, "category" | "scope" | "states">): string {
  const section = categoryFor(story.category ?? "")?.label;
  const place = story.scope === "india" ? (INDIAN_STATES.find((state) => state.code === story.states[0])?.label ?? "India") : "World";
  return section ? `${section} · ${place}` : place;
}

/**
 * One story, set four ways for four places on the page: the lead (the day's
 * top story), standard (a column), row (a list) and compact (a sidebar).
 *
 * Whatever the size it carries the same evidence: the publisher's own
 * headline and name, when they published and when we found it, how many
 * independent publishers, and heat beside confidence. A story with one source
 * says so in words. A sample story says so before anything else.
 */
export function StoryCard({
  story,
  now,
  variant = "standard",
  reason,
  discovery,
  saved,
  signedIn = true,
  className,
}: {
  story: CardStory;
  now: Date;
  variant?: "lead" | "standard" | "row" | "compact";
  reason?: string;
  discovery?: boolean;
  saved?: boolean;
  signedIn?: boolean;
  className?: string;
}) {
  const href = story.sample ? undefined : `/app/story/${story.id}`;
  // A long lead headline is set smaller: a front page sets the size to the words, so a long one does not fill the fold.
  const leadSize =
    story.headline.length > 110 ? "text-[clamp(1.6rem,2.4vw,2.1rem)]" : story.headline.length > 70 ? "text-[clamp(1.8rem,3vw,2.6rem)]" : "text-[clamp(1.9rem,3.6vw,3rem)]";
  const headlineClass = {
    lead: `${leadSize} font-black leading-[1.06] tracking-[-0.015em]`,
    standard: "text-xl font-bold leading-snug sm:text-[1.4rem]",
    row: "text-lg font-bold leading-snug",
    compact: "text-base font-bold leading-snug",
  }[variant];
  const others = story.sourceCount - 1;
  // Every story has a picture: a licensed photo, a video, an AI illustration,
  // a map or its section's cover art (lib/media/story-image.ts).
  const image = storyImage({ ...story, stored: story.images ?? storedOf(story) });
  const wide = variant === "lead" || variant === "standard";
  return (
    <article className={cn("group relative flex flex-col", variant === "row" && "sm:flex-row sm:items-start sm:gap-6", className)} aria-labelledby={`story-${story.id}`}>
      {wide ? <StoryPicture image={image} variant="card" priority={variant === "lead"} className="mb-3" /> : null}
      <div className={cn("min-w-0 flex-1", !wide && "flex gap-3 sm:gap-4")}>
        {wide ? null : <StoryPicture image={image} variant="thumb" className={variant === "compact" ? "order-last" : undefined} />}
        <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {story.sample ? <Badge tone="press">Sample</Badge> : null}
          {story.state === "developing" && story.heat >= 60 ? <Badge tone="press">Developing</Badge> : null}
          <p className="kicker text-kicker">{kickerOf(story)}</p>
          <KindBadge story={story} />
        </div>
        <h3 id={`story-${story.id}`} className={cn("mt-1.5 text-text-primary", headlineClass)}>
          {href ? (
            <Link href={href} className="decoration-2 underline-offset-4 hover:underline focus-visible:underline">
              {story.headline}
            </Link>
          ) : (
            story.headline
          )}
        </h3>
        {story.excerpt && variant !== "compact" ? (
          <p className={cn("mt-2 font-serif leading-relaxed text-text-secondary", variant === "lead" ? "text-lg" : "text-base", variant !== "lead" && "line-clamp-3")}>{story.excerpt}</p>
        ) : null}
        <p className="mt-2 text-sm text-text-secondary">
          <span className="font-semibold text-text-primary">{story.publisher}</span>
          {others > 0 ? <> and {others} more {others === 1 ? "publisher" : "publishers"}</> : <span> · only source so far</span>}
        </p>
        <p className="mt-0.5 text-xs text-text-tertiary">{timesLine(story.publishedAt, story.firstSeenAt, now)}</p>
        {variant !== "compact" ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <ScorePair heat={story.heat} confidence={story.confidence} direction={story.direction} />
            {story.sourceCount === 1 ? <span className="text-xs font-medium text-warning">Limited source coverage</span> : null}
          </div>
        ) : null}
        {reason ? (
          <p className={cn("mt-2.5 text-xs", discovery ? "font-semibold text-text-primary" : "text-text-tertiary")}>
            <span className="sr-only">Why this is here: </span>
            {reason}
          </p>
        ) : null}
        </div>
      </div>
      {signedIn && !story.sample && variant !== "compact" ? (
        <div className={cn("mt-3", variant === "row" && "sm:mt-0")}>
          <StoryActions storyId={story.id} saved={Boolean(saved)} url={story.url} />
        </div>
      ) : null}
    </article>
  );
}
