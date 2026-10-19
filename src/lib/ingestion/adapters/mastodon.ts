import { z } from "zod";

import { getFrom } from "../http";
import { plainText, significantTokens } from "../normalize";
import { SourceError, type IncomingPost, type SocialAdapter, type SourceContext } from "../types";

/**
 * mastodon.social's public hashtag timelines.
 *
 * Kept, and only these: public posts, written on mastodon.social itself (its
 * terms are the ones that were read), by accounts that opted into discovery
 * and did not opt out of indexing, that are not bots, reblogs or behind a
 * content warning. Everything else is counted as skipped and dropped here,
 * before anything is stored.
 *
 * The post's text is read only to take its significant words for matching,
 * then discarded: the page shows the post through mastodon.social's own embed.
 */

const status = z.object({
  id: z.string(),
  url: z.string().url().nullable(),
  created_at: z.string(),
  visibility: z.string(),
  language: z.string().nullable().optional(),
  sensitive: z.boolean().optional(),
  spoiler_text: z.string().optional(),
  content: z.string(),
  reblog: z.unknown().nullable().optional(),
  replies_count: z.number().optional(),
  reblogs_count: z.number().optional(),
  favourites_count: z.number().optional(),
  tags: z.array(z.object({ name: z.string() })).optional(),
  account: z.object({
    acct: z.string(),
    username: z.string(),
    display_name: z.string().optional(),
    url: z.string().optional(),
    bot: z.boolean().optional(),
    discoverable: z.boolean().nullable().optional(),
    indexable: z.boolean().nullable().optional(),
  }),
});
type Status = z.infer<typeof status>;

const PER_TAG = 40;

/** Why a status is left out, or null when it may be kept. */
export function mastodonExclusion(post: Status): string | null {
  if (post.visibility !== "public") return "not public";
  if (post.reblog) return "a reblog";
  if (post.account.acct.includes("@")) return "from another server";
  if (post.account.bot) return "a bot";
  if (post.account.discoverable !== true) return "author not discoverable";
  if (post.account.indexable === false) return "author opted out of indexing";
  if (post.sensitive || (post.spoiler_text ?? "").trim()) return "behind a content warning";
  if (!post.url) return "no address";
  return null;
}

/**
 * The words of a post, without its links: Mastodon wraps a link's URL in an
 * anchor, and "https", "utm", a shortener's code are not what a post is about
 * (seen 19 October 2026). Hashtag and mention anchors stay -- they are words.
 */
export function postWords(html: string): string[] {
  const withoutLinks = html.replace(/<a\b(?![^>]*class="[^"]*(?:hashtag|mention)[^"]*")[^>]*>[\s\S]*?<\/a>/gi, " ");
  return significantTokens(plainText(withoutLinks).replace(/\bhttps?:\/\/\S+/gi, " "));
}

export function toPost(post: Status, origin: string): IncomingPost {
  const hashtags = [...new Set((post.tags ?? []).map((tag) => tag.name.toLowerCase()))];
  return {
    platform: "mastodon",
    externalId: post.id,
    url: post.url!,
    embedUrl: `${post.url}/embed`,
    authorHandle: `@${post.account.acct}@${new URL(origin).host}`,
    authorName: post.account.display_name?.trim() || null,
    authorUrl: post.account.url ?? null,
    postedAt: new Date(post.created_at).toISOString(),
    // The words only, de-duplicated and sorted: enough to match a headline, not to rebuild the post.
    tokens: [...new Set([...postWords(post.content), ...hashtags])].sort(),
    hashtags,
    language: post.language ?? null,
    replies: post.replies_count ?? 0,
    reposts: post.reblogs_count ?? 0,
    likes: post.favourites_count ?? 0,
  };
}

const originOf = (source: SourceContext) => new URL(source.feedUrl).origin;

export const mastodonAdapter: SocialAdapter = {
  provider: "mastodon",
  async read(source, { fetch: fetchFn, deadline }) {
    const tags = Array.isArray(source.config.hashtags) ? (source.config.hashtags as unknown[]).filter((tag): tag is string => typeof tag === "string" && /^[a-z0-9_]+$/i.test(tag)) : [];
    if (tags.length === 0) throw new SourceError("No hashtags are configured.");
    const cursor = { ...source.cursor } as Record<string, string>;
    const posts = new Map<string, IncomingPost>();
    let skipped = 0;
    let newest: string | null = null;
    for (const tag of tags) {
      if (deadline - Date.now() < 4_000) break;
      const since = typeof cursor[tag] === "string" ? `&since_id=${encodeURIComponent(cursor[tag]!)}` : "";
      const response = await getFrom(fetchFn, `${source.feedUrl}${tag}?limit=${PER_TAG}${since}`, { deadline, timeoutMs: 10_000, headers: { accept: "application/json" } });
      if (!response.ok) throw new SourceError(`The #${tag} timeline answered ${response.status}.`, response.status);
      const parsed = z.array(z.unknown()).safeParse(await response.json());
      if (!parsed.success) throw new SourceError(`The #${tag} timeline was not a list of posts.`);
      for (const raw of parsed.data) {
        const one = status.safeParse(raw);
        if (!one.success || mastodonExclusion(one.data)) {
          skipped += 1;
          continue;
        }
        const post = toPost(one.data, originOf(source));
        posts.set(post.externalId, post);
        if (!newest || post.postedAt > newest) newest = post.postedAt;
        // Mastodon ids are time-ordered numbers: the largest seen is where the next read starts.
        if (!cursor[tag] || BigInt(one.data.id) > BigInt(cursor[tag]!)) cursor[tag] = one.data.id;
      }
    }
    return { status: "ok", httpStatus: 200, posts: [...posts.values()], skipped, cursor, newestAt: newest };
  },
  async exists(source, externalId, { fetch: fetchFn, deadline }) {
    try {
      const response = await getFrom(fetchFn, `${originOf(source)}/api/v1/statuses/${encodeURIComponent(externalId)}`, { deadline, timeoutMs: 8_000, headers: { accept: "application/json" } });
      if (response.status === 404 || response.status === 410) return false;
      if (!response.ok) return null;
      // Still there, but made private, or its author left discovery since: gone from the paper too.
      const one = status.safeParse(await response.json());
      return one.success && !mastodonExclusion(one.data);
    } catch {
      return null;
    }
  },
};
