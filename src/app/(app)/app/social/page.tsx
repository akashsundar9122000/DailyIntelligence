import type { Metadata } from "next";
import Link from "next/link";

import { ChipNav } from "@/components/news/chip-nav";
import { SectionHead } from "@/components/news/edition";
import { PostEmbed } from "@/components/news/post-embed";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { categoryFor } from "@/config/categories";
import { requireSession } from "@/lib/auth/session";
import { conversations, officialVideos, platformStates, postsForTopic, topTopics } from "@/lib/queries/social";

export const metadata: Metadata = { title: "Social Pulse" };

/**
 * Social Pulse: public conversation around the paper's stories, from
 * platforms whose terms permit it, each post through the platform's own embed.
 * Conversation is context, never confirmation: nothing here moves a story's
 * confidence, and the page says so before anything else.
 */
export default async function SocialPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  await requireSession();
  const now = new Date();
  const { topic: rawTopic } = await searchParams;
  const [platforms, stories, topics, videos] = await Promise.all([platformStates(), conversations(10, 2), topTopics(16), officialVideos(4)]);
  const topic = topics.find((entry) => entry.tag === rawTopic?.toLowerCase())?.tag;
  const topicPosts = topic ? await postsForTopic(topic, 9) : [];
  const connected = platforms.filter((platform) => platform.connected);

  return (
    <div className="mx-auto max-w-[var(--container)] space-y-10">
      <PageHeader
        kicker="Public conversation"
        title="Social Pulse"
        description="What people are posting about the paper's stories, from platforms whose terms allow it. Posts are conversation, not confirmation: they never change how well a story is sourced."
      />

      <section aria-labelledby="platforms-heading" className="space-y-3">
        <h2 id="platforms-heading" className="sr-only">
          Platforms
        </h2>
        <ul className="grid gap-0 border-y border-border sm:grid-cols-3">
          {platforms.map((platform) => (
            <li key={platform.key} className="border-b border-border p-4 sm:border-b-0 sm:[&:not(:last-child)]:border-r">
              <p className="flex items-center gap-2 font-semibold">
                {platform.name} <Badge tone={platform.connected ? "outline" : "neutral"}>{platform.connected ? "connected" : "not connected"}</Badge>
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {!platform.connected
                  ? (platform.reason ?? "Not connected.")
                  : platform.postsDay === null
                    ? "Official channels' videos, in YouTube's own player. Shown, never counted."
                    : `${platform.postsDay} ${platform.postsDay === 1 ? "post" : "posts"} kept in the last day.`}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {connected.length === 0 ? (
        <p className="border border-dashed border-border-strong px-6 py-10 text-center font-serif text-lg text-text-secondary">
          No social platform is connected yet. Nothing here is simulated: this page fills when one is.
        </p>
      ) : (
        <>
          <section aria-labelledby="conversation-heading" className="space-y-6">
            <SectionHead id="conversation-heading" kicker="The last day" title="Conversation around the paper's stories" />
            {stories.length === 0 ? (
              <p className="text-text-secondary">No post in the last day matched a story closely enough to attach to it. The topics below are still being discussed.</p>
            ) : (
              <ol className="space-y-10">
                {stories.map((story) => (
                  <li key={story.storyId} className="space-y-3 border-t border-border-strong pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {story.accelerating ? <Badge tone="press">Conversation is accelerating</Badge> : null}
                      <p className="kicker text-text-tertiary">
                        {categoryFor(story.category ?? "")?.label ?? (story.scope === "india" ? "India" : "World")} · {story.postsDay} {story.postsDay === 1 ? "post" : "posts"} in the last day{story.postsSixHours ? `, ${story.postsSixHours} in six hours` : ""}
                      </p>
                    </div>
                    <Link href={`/app/story/${story.storyId}`} className="block font-display text-2xl font-bold leading-snug hover:underline">
                      {story.headline}
                    </Link>
                    <div className="grid gap-4 md:grid-cols-2">
                      {story.posts.map((post) => (
                        <PostEmbed key={post.id} post={post} now={now} />
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {videos.length ? (
            <section aria-labelledby="videos-heading" className="space-y-4">
              <SectionHead id="videos-heading" kicker="Official channels, newest first" title="Official video" />
              <div className="grid gap-4 md:grid-cols-2">
                {videos.map((video) => (
                  <PostEmbed key={video.id} post={video} now={now} />
                ))}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="topics-heading" className="space-y-4">
            <SectionHead id="topics-heading" kicker="Hashtags, the last day" title="Most discussed topics" />
            {topics.length ? (
              <ChipNav
                label="Topics"
                chips={[{ href: "/app/social", label: "None", current: !topic }, ...topics.map((entry) => ({ href: `/app/social?topic=${entry.tag}`, label: `#${entry.tag} (${entry.posts})`, current: topic === entry.tag }))]}
              />
            ) : (
              <p className="text-text-secondary">No hashtag has posts in the last day.</p>
            )}
            {topic ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {topicPosts.map((post) => (
                  <PostEmbed key={post.id} post={post} now={now} />
                ))}
              </div>
            ) : null}
          </section>
        </>
      )}
      <p className="text-xs text-text-tertiary">
        Posts are shown through each platform&rsquo;s own embed and linked to the original; we keep a post&rsquo;s matching keywords, not its text, for at most seven days, and drop it as soon as its author deletes it.{" "}
        <Link href="/sources" className="underline underline-offset-4">
          The source directory
        </Link>{" "}
        says why each platform is in or out.
      </p>
    </div>
  );
}
