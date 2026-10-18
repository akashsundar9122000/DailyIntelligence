import { ArrowRight, Check, Minus, X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { InterestPicker } from "./interest-picker";
import { IllustrationNote } from "./section";

/* ------------------------------------------------------------- the ticker */

/**
 * The sources on the press, scrolling like a ticker. Names only, read from the
 * catalogue, so the line can never claim a source the product does not read.
 * The animation is CSS and stops for reduced motion (tokens.css collapses it),
 * leaving a still line that wraps.
 */
export function SourceTicker({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  const line = names.join("  ·  ");
  return (
    <div className="overflow-hidden border-y-2 border-text-primary bg-ink py-2.5 text-on-ink" aria-label="Sources on the press">
      <div className="ticker flex w-max gap-12 whitespace-nowrap">
        {/* Two copies, so the loop has no gap; the second is hidden from screen readers. */}
        <p className="kicker text-on-ink">
          <span className="mr-3">On the press</span>
          {line}
        </p>
        <p className="kicker text-on-ink" aria-hidden>
          <span className="mr-3">On the press</span>
          {line}
        </p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- hot is not true */

function Dial({ label, value, verdict, lines, press }: { label: string; value: number; verdict: string; lines: string[]; press?: boolean }) {
  // A half-circle meter. The arc length is the value; the number is printed beside it, so it never has to be read off the curve.
  const radius = 80;
  const length = Math.PI * radius;
  return (
    <div className="border-t-2 border-text-primary pt-4">
      <p className="kicker text-text-secondary">{label}</p>
      <div className="mt-4 flex items-end gap-6">
        <svg viewBox="0 0 200 110" className="w-44 shrink-0 sm:w-52" role="img" aria-label={`${label}: ${value} out of 100, ${verdict}`}>
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" className="stroke-border-strong" strokeWidth="14" />
          <path
            d="M20 100 A80 80 0 0 1 180 100"
            fill="none"
            className={press ? "stroke-press-solid" : "stroke-text-primary"}
            strokeWidth="14"
            strokeDasharray={`${(length * value) / 100} ${length}`}
          />
        </svg>
        <div>
          <p className="font-display text-6xl font-bold leading-none tabular-nums">{value}</p>
          <p className="mt-1 font-serif text-lg italic text-text-secondary">{verdict}</p>
        </div>
      </div>
      <ul className="mt-5 space-y-2">
        {lines.map((line) => (
          <li key={line} className="flex gap-2.5 text-sm text-text-secondary">
            <Minus className="mt-0.5 size-4 shrink-0" aria-hidden />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The idea the product is built on, on a night band: a story's heat and its
 * confidence are two numbers, never one, and neither stands in for the other.
 */
export function HotIsNotTrue() {
  return (
    <section id="hot-is-not-true" aria-labelledby="hot-is-not-true-title" data-surface="night" className="scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-[var(--container)]">
        <div data-reveal className="grid gap-6 border-t-[3px] border-text-primary pt-4 lg:grid-cols-2 lg:items-end">
          <div>
            <p className="kicker text-text-tertiary">The rule we print by</p>
            <h2 id="hot-is-not-true-title" className="mt-2 text-[clamp(2.5rem,6vw,5rem)] font-bold leading-[0.98]">
              Hot is not
              <br />
              the same as true.
            </h2>
          </div>
          <p className="dek text-xl">
            Most feeds rank by attention and let you assume the rest. We measure how fast a story is spreading and how well it is sourced as two separate numbers, and show you both.
          </p>
        </div>

        <div data-reveal className="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-16">
          <Dial
            label="Heat"
            value={88}
            verdict="Rising fast"
            press
            lines={["New reports per hour, against the story's own recent pace.", "How many independent publishers have picked it up.", "How recently it moved. Old stories cool, however viral they were."]}
          />
          <Dial
            label="Confidence"
            value={34}
            verdict="Limited sources"
            lines={["Independent publishers, not copies of one wire report.", "Whether an official record exists, and that it is labelled as official, not as reporting.", "Whether sources agree, or the disagreement is shown with who said what."]}
          />
        </div>
        <p className="mt-8">
          <IllustrationNote>Illustration: the two scores for one example story</IllustrationNote>
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- your paper */

export function YourPaper() {
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
      <div data-reveal>
        <InterestPicker />
      </div>
      <div data-reveal className="space-y-8">
        {[
          {
            title: "Why is this in my feed?",
            body: "Every story says, in a line: because you follow Cricket; because it is the most important story in India today; or because it is a discovery outside your usual reading.",
          },
          {
            title: "More of this, less of that",
            body: "Follow a topic, mute a publisher, block a keyword. Muted means ranked down; blocked means gone. Both are listed in Settings, with one button to undo.",
          },
          {
            title: "Nothing guessed that you would mind",
            body: "Your interests are the ones you chose. We never infer politics, health or religion from what you read, and you can switch reading history off entirely.",
          },
        ].map((point) => (
          <div key={point.title} className="border-t border-border-strong pt-4">
            <h3 className="text-2xl font-bold leading-snug">{point.title}</h3>
            <p className="mt-2 font-serif text-lg leading-relaxed text-text-secondary">{point.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- sources */

export type DirectoryLine = { name: string; kind: string; note: string };

export function SourcesTeaser({ onPress, notIncluded }: { onPress: DirectoryLine[]; notIncluded: DirectoryLine[] }) {
  return (
    <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
      <div data-reveal>
        <h3 className="flex items-center gap-2 text-2xl font-bold">
          <Check className="size-6" aria-hidden /> On the press
        </h3>
        <p className="mt-1 text-sm text-text-secondary">Read on a schedule, because their terms allow what we do with them.</p>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {onPress.map((line) => (
            <li key={line.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 py-3">
              <span className="font-semibold">{line.name}</span>
              <span className="kicker text-text-tertiary">{line.kind}</span>
              <span className="col-span-2 text-sm text-text-secondary">{line.note}</span>
            </li>
          ))}
        </ul>
      </div>
      <div data-reveal>
        <h3 className="flex items-center gap-2 text-2xl font-bold">
          <X className="size-6" aria-hidden /> Not included, and why
        </h3>
        <p className="mt-1 text-sm text-text-secondary">A feed existing is not permission. These say personal or non-commercial use only, or their terms are unclear.</p>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {notIncluded.map((line) => (
            <li key={line.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 py-3">
              <span className="font-semibold">{line.name}</span>
              <span className="kicker text-text-tertiary">{line.kind}</span>
              <span className="col-span-2 text-sm text-text-secondary">{line.note}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="lg:col-span-2">
        <Link href="/sources" className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4">
          The full source directory, with every terms page we read <ArrowRight className="size-4" aria-hidden />
        </Link>
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- questions */

const QUESTIONS = [
  {
    q: "Is this every news story in the world?",
    a: "No, and nothing honest could be. We read a growing, selected network: GDELT's index of world news coverage, official feeds and open research, plus publishers whose terms permit it. Every source is listed, and when one stops reporting we say so.",
  },
  {
    q: "How fresh is it?",
    a: "Sources are read every fifteen minutes, which is as often as GDELT itself updates. Each story shows when its publisher says it was published and when we found it: two different times, never blurred into one.",
  },
  {
    q: "Do you copy articles?",
    a: "No. We show the publisher's headline, a short excerpt only where their terms allow, and a link to the original. AI explainers are our own words, built from what each source permits us to read, and they cite their sources.",
  },
  {
    q: "What does the AI do, and what does it not do?",
    a: "It summarises, explains and compares, using only the sources attached to a story, and marks what is confirmed, what is claimed and what is still unknown. It does not decide what is true, invent quotes or generate footage. When the AI service is down, you get a plain summary from the sources instead.",
  },
  {
    q: "What about X, Instagram and Reddit?",
    a: "Not at launch. Their data is either paid or not licensed for a product like this, and we will not scrape them. Social Pulse uses platforms that permit it, like Bluesky and selected Mastodon servers, and always links to the original post.",
  },
  {
    q: "What does it cost, and what do you keep?",
    a: "It is free. We keep your email, your interests, your saved stories and, if you leave it on, what you read. You can download it or delete everything from Settings, at any time.",
  },
];

export function Questions() {
  return (
    <div className="grid gap-x-16 lg:grid-cols-2">
      {QUESTIONS.map((item) => (
        <details key={item.q} data-reveal className="group border-t border-border-strong py-5">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-display text-xl font-bold leading-snug [&::-webkit-details-marker]:hidden">
            {item.q}
            <span aria-hidden className="mt-1 text-2xl leading-none transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="mt-3 font-serif text-lg leading-relaxed text-text-secondary">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ closing band */

export function ClosingBand() {
  return (
    <section aria-labelledby="closing-title" className="border-y-[3px] border-text-primary px-4 py-20 sm:px-6 lg:py-28">
      <div data-reveal className="mx-auto max-w-4xl text-center">
        <p className="kicker text-text-tertiary">The next edition is already being set</p>
        <h2 id="closing-title" className="mt-3 text-[clamp(2.5rem,6vw,4.75rem)] font-bold leading-[1.02]">
          Know what matters.
          <br />
          <span className="italic">Understand why.</span>
        </h2>
        <p className="dek mx-auto mt-5 max-w-2xl text-xl">One email, one code, and the front page is yours. No password, no ads, no guessing at what you believe.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/login">
              Start reading <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/sources">See the sources</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
