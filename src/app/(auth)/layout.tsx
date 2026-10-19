import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Mark, Wordmark } from "@/components/branding/logo";
import { StoryAnatomy } from "@/components/news/story-anatomy";
import { Badge } from "@/components/ui/badge";
import { brand } from "@/config/brand";
import { categoryFor } from "@/config/categories";
import { DEFAULT_AFTER_SIGN_IN } from "@/lib/auth/next-path";
import { getSession } from "@/lib/auth/session";
import { formatClock, formatDateline, relativeTime } from "@/lib/format/date";
import { getEditionStatus } from "@/lib/queries/edition";
import { frontPageHeadlines } from "@/lib/queries/front-page";

/** The three promises, set as a newspaper's standing column when there is no news to show yet. */
const PROMISES = [
  { title: "Every story keeps its source", body: "A headline here is the publisher's own, with their name, the time they published it, the time we found it, and a link to the original." },
  { title: "Hot is not the same as true", body: "How fast a story is spreading and how well it is sourced are measured separately, and shown side by side." },
  { title: "Your interests, in your hands", body: "Follow, mute and block topics and sources. Every story in your feed says why it is there." },
];

/**
 * The sign-in pages: a broadsheet. On a wide screen, the front page on the
 * left -- today's real headlines, or the paper's standing promises before any
 * have arrived -- and the form on the right. On a phone the front page is not
 * rendered at all, only a compact nameplate: a phone should not lay out a page
 * of text it will never show (CodeAtlas's lesson).
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  // Somebody already signed in has no use for a sign-in page.
  if (await getSession()) redirect(DEFAULT_AFTER_SIGN_IN);
  const now = new Date();
  const [headlines, edition] = [await frontPageHeadlines(4), await getEditionStatus()];

  return (
    <div className="grid min-h-dvh grid-cols-1 bg-canvas lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <aside className="hidden flex-col border-r border-border-strong px-10 py-8 lg:flex xl:px-14" aria-label="Today's front page">
        <div className="flex items-center justify-between gap-4 pb-2 text-[0.6875rem] font-semibold tracking-[0.12em] text-text-secondary uppercase">
          <span>{formatDateline(now.toISOString())}</span>
          <span>{edition.updatedAt ? <>Updated <time dateTime={edition.updatedAt}>{formatClock(edition.updatedAt)} IST</time></> : "Awaiting first report"}</span>
        </div>
        <div className="rule-thick" />
        <Link href="/" className="flex items-center justify-center gap-4 py-5" aria-label={`${brand.name}, home`}>
          <Mark className="size-14" />
          <Wordmark className="text-[clamp(2.5rem,4.4vw,4rem)] leading-none" />
        </Link>
        <div className="rule-double" />

        {headlines.length > 0 ? (
          <section className="mt-6 flex-1">
            <p className="kicker pb-3 text-text-tertiary">On the front page now</p>
            <ol className="divide-y divide-border">
              {headlines.map((story, index) => (
                <li key={story.id} className="py-4 first:pt-0">
                  <p className="kicker text-text-tertiary">
                    {categoryFor(story.category ?? "")?.label ?? (story.scope === "india" ? "India" : "World")}
                  </p>
                  <p className={index === 0 ? "mt-1 font-display text-3xl font-bold leading-tight text-text-primary" : "mt-1 font-display text-xl font-bold leading-snug text-text-primary"}>
                    {story.headline}
                  </p>
                  <p className="mt-1.5 text-sm text-text-secondary">
                    {story.publisher}
                    {story.sourceCount > 1 ? ` and ${story.sourceCount - 1} more` : ""} · updated {relativeTime(story.lastUpdatedAt, now)}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <div className="flex flex-1 flex-col">
            <section className="mt-8 grid grid-cols-3 gap-0 columns-ruled">
              {PROMISES.map((promise) => (
                <div key={promise.title} className="px-5 first:pl-0 last:pr-0">
                  <h2 className="text-xl font-bold leading-snug">{promise.title}</h2>
                  <p className="mt-2 font-serif text-base leading-relaxed text-text-secondary">{promise.body}</p>
                </div>
              ))}
            </section>
            <section aria-label="What every story carries" className="mt-auto border-t-2 border-rule pt-4">
              <p className="kicker pb-4 text-text-tertiary">Anatomy of a story</p>
              <StoryAnatomy />
            </section>
          </div>
        )}

        <div className="mt-8 flex items-center gap-3 border-t border-border pt-4 text-sm text-text-secondary">
          <Badge tone="outline" className="shrink-0 whitespace-nowrap">Free sources</Badge>
          <span>Built on GDELT, official feeds and publishers whose terms allow it.</span>
          <Link href="/sources" className="ml-auto shrink-0 whitespace-nowrap font-medium text-text-primary underline underline-offset-4">
            See every source
          </Link>
        </div>
      </aside>

      <main className="flex flex-col">
        <div className="border-b border-border-strong px-5 pb-3 pt-[calc(var(--safe-top)+1rem)] lg:hidden">
          <Link href="/" className="flex items-center justify-center gap-2.5" aria-label={`${brand.name}, home`}>
            <Mark className="size-8" />
            <Wordmark className="text-2xl leading-none" />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">{children}</div>
      </main>
    </div>
  );
}
