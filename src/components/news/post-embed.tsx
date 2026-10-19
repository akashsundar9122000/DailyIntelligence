import { ExternalLink } from "lucide-react";

import { relativeTime } from "@/lib/format/date";
import type { PostCard } from "@/lib/queries/social";

const PLATFORM: Record<PostCard["platform"], { name: string; reposts: string; likes: string }> = {
  mastodon: { name: "Mastodon", reposts: "boosts", likes: "favourites" },
  bluesky: { name: "Bluesky", reposts: "reposts", likes: "likes" },
  youtube: { name: "YouTube", reposts: "shares", likes: "likes" },
};

/**
 * One public post, through its platform's own embed: the platform renders the
 * author's words, we do not copy them. Labelled first -- a post is not an
 * article -- with who, where, when and the way to the original. The counts are
 * printed as counts: engagement is attention, never evidence.
 */
export function PostEmbed({ post, now }: { post: PostCard; now: Date }) {
  const platform = PLATFORM[post.platform];
  return (
    <figure className="border border-border bg-surface">
      <figcaption className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-3 py-2 text-xs text-text-secondary">
        <span className="font-semibold uppercase tracking-[0.08em] text-text-primary">Post</span>
        <span aria-hidden>·</span>
        <span>{platform.name}</span>
        <span aria-hidden>·</span>
        <span className="font-medium text-text-primary">{post.authorName ?? post.authorHandle}</span>
        <span className="text-text-tertiary">{post.authorHandle}</span>
        <span aria-hidden>·</span>
        <time dateTime={post.postedAt}>{relativeTime(post.postedAt, now)}</time>
        <a href={post.url} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 font-semibold text-text-primary underline-offset-4 hover:underline">
          <ExternalLink className="size-3.5" aria-hidden /> Original<span className="sr-only"> post on {platform.name} (opens in a new tab)</span>
        </a>
      </figcaption>
      <iframe
        src={post.embedUrl}
        title={`Post by ${post.authorHandle} on ${platform.name}`}
        loading="lazy"
        // The platform's embed needs its own script; it gets nothing else of ours.
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        className="block h-72 w-full border-0 bg-surface"
      />
      <p className="border-t border-border px-3 py-1.5 text-xs text-text-tertiary">
        {post.replies} replies · {post.reposts} {platform.reposts} · {post.likes} {platform.likes} when last checked. Counts, not evidence.
      </p>
    </figure>
  );
}
