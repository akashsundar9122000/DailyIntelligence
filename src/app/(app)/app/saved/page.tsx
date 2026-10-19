import { Bookmark } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ChipNav } from "@/components/news/chip-nav";
import { DeleteCollection, NewCollection } from "@/components/news/new-collection";
import { SavedItemControls } from "@/components/news/saved-item";
import { StoryCard } from "@/components/news/story-card";
import { PageHeader } from "@/components/ui/page-header";
import { ReadingStrip } from "@/components/news/dashboards";
import { requireSession } from "@/lib/auth/session";
import { formatInstant } from "@/lib/format/date";
import { storiesByIds } from "@/lib/queries/stories";
import { listBookmarks, listCollections } from "@/lib/services/reader";
import { readingNumbers } from "@/lib/queries/dashboards";
import { getPreferences } from "@/lib/queries/preferences";

export const metadata: Metadata = { title: "Saved" };

/**
 * Saved stories and collections. Each is the live story -- its sources may
 * have grown since it was saved -- and if a story can no longer be shown (its
 * source's rights were withdrawn) the headline as saved is kept, and says so.
 */
export default async function SavedPage({ searchParams }: { searchParams: Promise<{ collection?: string }> }) {
  const session = await requireSession();
  const now = new Date();
  const { collection: rawCollection } = await searchParams;
  const collections = await listCollections(session.user.id);
  const collection = collections.find((entry) => entry.id === rawCollection);
  const bookmarks = await listBookmarks(session.user.id, collection?.id);
  const live = new Map((await storiesByIds(bookmarks.map((bookmark) => bookmark.storyId))).map((story) => [story.id, story]));
  const reading = await readingNumbers(session.user.id, (await getPreferences(session.user.id)).readingHistory);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        kicker="Yours"
        title={collection ? collection.name : "Saved"}
        description={collection ? `${collection.count} saved ${collection.count === 1 ? "story" : "stories"} in this collection.` : "Stories you saved, newest first, with your private notes."}
        actions={<NewCollection />}
      />
      {collection ? null : <ReadingStrip numbers={reading} />}
      {collections.length ? (
        <ChipNav
          label="Collections"
          chips={[{ href: "/app/saved", label: "All saved", current: !collection }, ...collections.map((entry) => ({ href: `/app/saved?collection=${entry.id}`, label: `${entry.name} (${entry.count})`, current: collection?.id === entry.id }))]}
        />
      ) : null}
      {collection ? <DeleteCollection id={collection.id} name={collection.name} /> : null}

      {bookmarks.length === 0 ? (
        <div className="border border-dashed border-border-strong px-6 py-12 text-center">
          <Bookmark className="mx-auto size-8 text-text-tertiary" aria-hidden />
          <p className="mt-4 font-display text-2xl font-bold">{collection ? "Nothing in this collection yet." : "Nothing saved yet."}</p>
          <p className="mx-auto mt-2 max-w-md font-serif text-lg text-text-secondary">Press Save on any story and it is kept here, with its sources, for as long as you want it.</p>
          <Link href="/app" className="mt-4 inline-block font-semibold underline underline-offset-4">
            Go to your edition
          </Link>
        </div>
      ) : (
        <ol className="divide-y divide-border border-y border-border">
          {bookmarks.map((bookmark) => {
            const story = live.get(bookmark.storyId);
            return (
              <li key={bookmark.id} className="space-y-3 py-5">
                {story ? (
                  <StoryCard story={story} now={now} variant="row" saved signedIn={false} />
                ) : (
                  <div>
                    <p className="font-display text-lg font-bold">{bookmark.headline}</p>
                    <p className="mt-1 text-sm text-warning">This story can no longer be shown: its source was withdrawn. The headline is kept as you saved it.</p>
                  </div>
                )}
                {bookmark.note ? <p className="border-l-[3px] border-border-strong pl-3 font-serif italic text-text-secondary">{bookmark.note}</p> : null}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-text-tertiary">
                    Saved {formatInstant(bookmark.createdAt)}
                    {bookmark.readAt ? " · read" : " · unread"}
                  </p>
                  <SavedItemControls
                    bookmarkId={bookmark.id}
                    storyId={bookmark.storyId}
                    read={Boolean(bookmark.readAt)}
                    note={bookmark.note}
                    inCollections={bookmark.collections}
                    collections={collections.map(({ id, name }) => ({ id, name }))}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
