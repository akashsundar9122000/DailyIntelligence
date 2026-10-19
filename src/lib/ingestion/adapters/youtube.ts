import { z } from "zod";

import { env } from "@/lib/env";

import { getFrom } from "../http";
import { significantTokens } from "../normalize";
import { SourceError, type IncomingPost, type SocialAdapter, type SourceContext } from "../types";

/**
 * YouTube: recent videos from a short list of official channels, through the
 * YouTube Data API with this deployment's key.
 *
 * Within the developer policies (catalogue entry "youtube-official"): only
 * public, embeddable videos; shown in YouTube's own player, unaltered; kept
 * seven days and re-checked; NO statistics kept -- the policies forbid derived
 * data and metrics, so a video never feeds a score or a count. The title's
 * words are kept to place a video beside the story it is about.
 *
 * Quota: one unit per channel for its uploads list, one for the batch of
 * videos. The key travels in the URL, so no error message here ever contains
 * a URL.
 */

const playlist = z.object({ items: z.array(z.object({ contentDetails: z.object({ videoId: z.string() }) })).default([]) });
const videos = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        snippet: z.object({ publishedAt: z.string(), channelId: z.string(), channelTitle: z.string(), title: z.string(), description: z.string().optional(), defaultAudioLanguage: z.string().optional() }),
        status: z.object({ privacyStatus: z.string(), embeddable: z.boolean() }),
      }),
    )
    .default([]),
});
type Video = z.infer<typeof videos>["items"][number];

const PER_CHANNEL = 8;

function key(): string {
  const value = env().YOUTUBE_API_KEY;
  if (!value) throw new SourceError("No YouTube API key is configured.");
  return value;
}

/** The uploads playlist of a channel: its id with UC replaced by UU, a fixed rule of YouTube's. */
export const uploadsOf = (channelId: string) => (channelId.startsWith("UC") ? `UU${channelId.slice(2)}` : channelId);

export function youtubeExclusion(video: Video): string | null {
  if (video.status.privacyStatus !== "public") return "not public";
  if (!video.status.embeddable) return "not embeddable";
  return null;
}

export function toVideo(video: Video): IncomingPost {
  return {
    platform: "youtube",
    externalId: video.id,
    url: `https://www.youtube.com/watch?v=${video.id}`,
    // Privacy-enhanced mode, YouTube's own: no cookie until the reader plays the video.
    embedUrl: `https://www.youtube-nocookie.com/embed/${video.id}`,
    authorHandle: video.snippet.channelTitle,
    authorName: video.snippet.channelTitle,
    authorUrl: `https://www.youtube.com/channel/${video.snippet.channelId}`,
    postedAt: new Date(video.snippet.publishedAt).toISOString(),
    tokens: [...new Set(significantTokens(`${video.snippet.title} ${(video.snippet.description ?? "").slice(0, 300)}`))].sort(),
    hashtags: [],
    language: video.snippet.defaultAudioLanguage ?? null,
    // Not kept: statistics are API data the policies allow neither to store long nor to turn into measures.
    replies: 0,
    reposts: 0,
    likes: 0,
  };
}

async function fetchVideos(source: SourceContext, ids: string[], fetchFn: Parameters<SocialAdapter["read"]>[1]["fetch"], deadline: number): Promise<Video[]> {
  if (ids.length === 0) return [];
  const response = await getFrom(fetchFn, `${source.feedUrl}videos?part=snippet,status&id=${ids.map(encodeURIComponent).join(",")}&key=${encodeURIComponent(key())}`, { deadline, timeoutMs: 10_000 });
  if (!response.ok) throw new SourceError(`The video details answered ${response.status}.`, response.status, response.status === 403 || response.status === 429);
  const parsed = videos.safeParse(await response.json());
  if (!parsed.success) throw new SourceError("The video details were not in the expected shape.");
  return parsed.data.items;
}

export const youtubeAdapter: SocialAdapter = {
  provider: "youtube",
  async read(source, { fetch: fetchFn, deadline }) {
    const channels = Array.isArray(source.config.channels)
      ? (source.config.channels as unknown[]).filter((entry): entry is { id: string } => typeof (entry as { id?: unknown })?.id === "string" && /^UC[\w-]{22}$/.test((entry as { id: string }).id))
      : [];
    if (channels.length === 0) throw new SourceError("No channels are configured.");
    const ids: string[] = [];
    for (const channel of channels) {
      if (deadline - Date.now() < 4_000) break;
      const response = await getFrom(fetchFn, `${source.feedUrl}playlistItems?part=contentDetails&maxResults=${PER_CHANNEL}&playlistId=${uploadsOf(channel.id)}&key=${encodeURIComponent(key())}`, { deadline, timeoutMs: 10_000 });
      // 403 here is quota or a key problem: throttled, so the circuit opens instead of every run failing the same way.
      if (!response.ok) throw new SourceError(`A channel's uploads answered ${response.status}.`, response.status, response.status === 403 || response.status === 429);
      const parsed = playlist.safeParse(await response.json());
      if (!parsed.success) throw new SourceError("A channel's uploads were not in the expected shape.");
      ids.push(...parsed.data.items.map((item) => item.contentDetails.videoId));
    }
    const found = await fetchVideos(source, [...new Set(ids)].slice(0, 50), fetchFn, deadline);
    const kept = found.filter((video) => !youtubeExclusion(video)).map(toVideo);
    const newest = kept.reduce<string | null>((latest, video) => (!latest || video.postedAt > latest ? video.postedAt : latest), null);
    return { status: "ok", httpStatus: 200, posts: kept, skipped: found.length - kept.length, newestAt: newest };
  },
  async exists(source, externalId, { fetch: fetchFn, deadline }) {
    try {
      const [video] = await fetchVideos(source, [externalId], fetchFn, deadline);
      return Boolean(video && !youtubeExclusion(video));
    } catch {
      return null;
    }
  },
};
