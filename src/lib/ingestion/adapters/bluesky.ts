import { z } from "zod";

import { getFrom } from "../http";
import { significantTokens } from "../normalize";
import { SourceError, type IncomingPost, type SocialAdapter } from "../types";

/**
 * Bluesky: the public posts of a curated list of accounts (official bodies,
 * newsrooms), through the public AppView. Built and tested; switched off in
 * the catalogue until this deployment publishes the monitored contact address
 * Bluesky's developer guidelines require.
 *
 * Kept: original posts (no reposts), from listed accounts, with no moderation
 * label on the post or its author. Shown only through Bluesky's own embed.
 */

const post = z.object({
  uri: z.string().startsWith("at://"),
  cid: z.string(),
  indexedAt: z.string(),
  replyCount: z.number().optional(),
  repostCount: z.number().optional(),
  likeCount: z.number().optional(),
  labels: z.array(z.unknown()).optional(),
  author: z.object({ did: z.string(), handle: z.string(), displayName: z.string().optional(), labels: z.array(z.unknown()).optional() }),
  record: z.object({ text: z.string(), createdAt: z.string(), langs: z.array(z.string()).optional() }),
});
const feed = z.object({ feed: z.array(z.object({ post: z.unknown(), reason: z.unknown().optional() })), cursor: z.string().optional() });
type Post = z.infer<typeof post>;

export function blueskyExclusion(item: { post: Post; reason?: unknown }): string | null {
  if (item.reason) return "a repost";
  if ((item.post.labels ?? []).length || (item.post.author.labels ?? []).length) return "carries a moderation label";
  return null;
}

export function toBlueskyPost(item: Post): IncomingPost {
  const rkey = item.uri.split("/").pop()!;
  const hashtags = [...new Set((item.record.text.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((tag) => tag.slice(1).toLowerCase()))];
  return {
    platform: "bluesky",
    externalId: item.uri,
    url: `https://bsky.app/profile/${item.author.handle}/post/${rkey}`,
    embedUrl: `https://embed.bsky.app/embed/${item.author.did}/app.bsky.feed.post/${rkey}`,
    authorHandle: `@${item.author.handle}`,
    authorName: item.author.displayName?.trim() || null,
    authorUrl: `https://bsky.app/profile/${item.author.handle}`,
    postedAt: new Date(item.record.createdAt).toISOString(),
    tokens: [...new Set([...significantTokens(item.record.text), ...hashtags])].sort(),
    hashtags,
    language: item.record.langs?.[0] ?? null,
    replies: item.replyCount ?? 0,
    reposts: item.repostCount ?? 0,
    likes: item.likeCount ?? 0,
  };
}

export const blueskyAdapter: SocialAdapter = {
  provider: "bluesky",
  async read(source, { fetch: fetchFn, deadline }) {
    const accounts = Array.isArray(source.config.accounts) ? (source.config.accounts as unknown[]).filter((handle): handle is string => typeof handle === "string" && /^[a-z0-9.-]+$/i.test(handle)) : [];
    if (accounts.length === 0) throw new SourceError("No accounts are configured.");
    const posts = new Map<string, IncomingPost>();
    let skipped = 0;
    let newest: string | null = null;
    for (const handle of accounts) {
      if (deadline - Date.now() < 4_000) break;
      const response = await getFrom(fetchFn, `${source.feedUrl}?actor=${encodeURIComponent(handle)}&limit=30&filter=posts_no_replies`, { deadline, timeoutMs: 10_000, headers: { accept: "application/json" } });
      if (!response.ok) throw new SourceError(`The feed of ${handle} answered ${response.status}.`, response.status);
      const parsed = feed.safeParse(await response.json());
      if (!parsed.success) throw new SourceError(`The feed of ${handle} was not a feed.`);
      for (const entry of parsed.data.feed) {
        const one = post.safeParse(entry.post);
        if (!one.success || blueskyExclusion({ post: one.data, reason: entry.reason })) {
          skipped += 1;
          continue;
        }
        const kept = toBlueskyPost(one.data);
        posts.set(kept.externalId, kept);
        if (!newest || kept.postedAt > newest) newest = kept.postedAt;
      }
    }
    return { status: "ok", httpStatus: 200, posts: [...posts.values()], skipped, newestAt: newest };
  },
  async exists(source, externalId, { fetch: fetchFn, deadline }) {
    try {
      const base = new URL(source.feedUrl).origin;
      const response = await getFrom(fetchFn, `${base}/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(externalId)}`, { deadline, timeoutMs: 8_000, headers: { accept: "application/json" } });
      if (!response.ok) return null;
      const body = z.object({ posts: z.array(z.unknown()) }).safeParse(await response.json());
      return body.success ? body.data.posts.length > 0 : null;
    } catch {
      return null;
    }
  },
};
