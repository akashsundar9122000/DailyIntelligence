import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, type CSSProperties } from "react";

import { LiveFrontPage } from "@/components/marketing/front-page";
import { ClosingBand, HotIsNotTrue, Questions, SourcesTeaser, SourceTicker, YourPaper } from "@/components/marketing/landing-sections";
import { ReadingSequence } from "@/components/marketing/reading-sequence";
import { Section } from "@/components/marketing/section";
import { ThemeStrip } from "@/components/marketing/theme-strip";
import { Masthead } from "@/components/news/masthead";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { getEditionStatus } from "@/lib/queries/edition";
import { frontPageHeadlines } from "@/lib/queries/front-page";
import { publicDirectory } from "@/lib/sources/catalogue";

export const metadata: Metadata = { title: { absolute: `${brand.name} — ${brand.tagline}` } };

// Rendered per request: the front page and the "Updated" time are live.
export const dynamic = "force-dynamic";

const HEADLINE = "The news, with its sources showing.";

const BRIEFS = [
  { kicker: "Freshness", title: "Every fifteen minutes", body: "Sources are read on a schedule, and every story shows when it was published and when we found it. Two times, never one." },
  { kicker: "Trust", title: "Hot is not true", body: "How fast a story spreads and how well it is sourced are separate scores, side by side on every story." },
  { kicker: "Control", title: "Why it reached you", body: "Every story in your feed says why it is there, and every interest, mute and block is yours to change." },
];

export default async function LandingPage() {
  const now = new Date();
  const [headlines, edition] = [await frontPageHeadlines(6), await getEditionStatus()];
  const directory = publicDirectory();

  return (
    <>
      <div className="px-4 pt-6 sm:px-6 sm:pt-8">
        <div className="mx-auto max-w-[var(--container)]">
          <Masthead now={now} updatedAt={edition.updatedAt} />
        </div>
      </div>

      <section aria-labelledby="lead-title" className="px-4 pb-16 pt-10 sm:px-6 lg:pb-20 lg:pt-14">
        <div className="mx-auto grid max-w-[var(--container)] gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-0 lg:divide-x lg:divide-border-strong">
          <div className="lg:pr-12">
            <p className="kicker text-press">A different kind of news app</p>
            {/*
              Word by word, each with its index for the stagger (motion.css). The words
              are inline spans of one heading separated by real spaces, so it is still
              read as one sentence; in a palette with light, the heading catches it.
            */}
            <h1 id="lead-title" className="text-sheen mt-3 text-[clamp(2.75rem,7.2vw,6.25rem)] font-black leading-[0.95] tracking-[-0.02em]">
              {HEADLINE.split(" ").map((word, index) => (
                // The space sits between the spans: inside an inline-block it would collapse and join the words.
                <Fragment key={index}>
                  {index > 0 ? " " : null}
                  <span className="hero-word" style={{ "--i": index } as CSSProperties}>
                    {word}
                  </span>
                </Fragment>
              ))}
            </h1>
            <p className="dek mt-6 max-w-3xl text-xl leading-relaxed sm:text-2xl">
              {brand.name} reads the world&rsquo;s news index, official feeds and open research every fifteen minutes, groups the coverage into stories, and tells you what is hot, how well it is sourced, and why it reached you.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link href="/login">
                  Start reading, free <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/#how-it-works">See how it works</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-text-tertiary">No password. No ads. Every source listed, with the terms we read.</p>

            <div className="mt-12 grid gap-8 border-t border-border-strong pt-6 sm:grid-cols-3 sm:gap-0 columns-ruled">
              {BRIEFS.map((brief, index) => (
                <div key={brief.title} data-reveal style={{ "--i": index } as CSSProperties} className="sm:px-5 sm:first:pl-0 sm:last:pr-0">
                  <p className="kicker text-text-tertiary">{brief.kicker}</p>
                  <h2 className="mt-1.5 text-2xl font-bold leading-tight">{brief.title}</h2>
                  <p className="mt-2 font-serif text-base leading-relaxed text-text-secondary">{brief.body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:pl-10">
            <LiveFrontPage headlines={headlines} now={now} onPress={directory.onPress.map((line) => line.name)} />
          </div>
        </div>
      </section>

      <ThemeStrip />

      <SourceTicker names={directory.onPress.map((line) => line.name)} />

      <Section
        id="how-it-works"
        kicker="How it works"
        title="From a thousand links to one story you can check."
        dek="Four steps, run every fifteen minutes. Each one keeps the trail back to the original publisher."
        wide
      >
        <ReadingSequence />
      </Section>

      <HotIsNotTrue />

      <Section id="your-paper" kicker="Your paper" title="Edited by you, explained to you." dek="Choose what you follow. See why every story is there. Change your mind in one tap." wide>
        <YourPaper />
      </Section>

      <Section id="sources" kicker="Source directory" title="Who we read, and who we don’t." dek="A feed existing is not permission. Each source is read only after its terms have been, and the decision is published." wide className="bg-surface">
        <SourcesTeaser onPress={directory.onPress} notIncluded={[...directory.pending, ...directory.notIncluded]} />
      </Section>

      <Section id="questions" kicker="Questions" title="Asked, and answered plainly.">
        <Questions />
      </Section>

      <ClosingBand />
    </>
  );
}
