"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Slide } from "@/lib/ai/visual";
import { formatInstant } from "@/lib/format/date";

import { CitedText, type CiteTarget } from "./explainer";

const EVERY_MS = 7_000;

function prefersStill(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce";
}

/** One card's words, the same in the card and in the transcript: the transcript is the card, not a description of it. */
function SlideBody({ slide, refs, large }: { slide: Slide; refs: Record<string, CiteTarget>; large?: boolean }) {
  switch (slide.kind) {
    case "title":
      return (
        <>
          <p className="kicker text-text-tertiary">The story, in cards</p>
          <p className={large ? "mt-2 font-display text-3xl font-black leading-tight sm:text-4xl" : "font-semibold"}>{slide.headline}</p>
          <p className="mt-2 text-sm text-text-secondary">Built from {slide.recordCount} source records.</p>
        </>
      );
    case "summary":
      return <p className={large ? "font-serif text-2xl leading-snug" : ""}>{<CitedText claim={slide} refs={refs} />}</p>;
    case "figure":
      return (
        <>
          <p className={large ? "font-display text-6xl font-black tabular-nums sm:text-7xl" : "font-semibold tabular-nums"}>{slide.figure}</p>
          <p className={large ? "mt-3 font-serif text-lg" : ""}>
            <CitedText claim={slide} refs={refs} />
          </p>
        </>
      );
    case "timeline":
      return (
        <>
          <p className="kicker text-text-tertiary">As it was reported</p>
          <ol className={large ? "mt-3 space-y-3 border-l-2 border-border-strong pl-4" : "space-y-1"}>
            {slide.entries.map((entry, index) => (
              <li key={index}>
                <span className="text-xs text-text-tertiary">{entry.at ? formatInstant(entry.at) : "Time not given"}</span>
                <span className="block text-sm">
                  <strong>{entry.publisher}</strong> {entry.official ? "issued a statement" : "reported"}: {entry.title}
                </span>
              </li>
            ))}
          </ol>
        </>
      );
    case "where":
      return (
        <>
          <p className="kicker text-text-tertiary">Where</p>
          <p className={large ? "mt-2 font-display text-3xl font-bold" : ""}>{slide.places.join(" · ")}</p>
        </>
      );
    case "sources":
      return (
        <>
          <p className="kicker text-text-tertiary">Sources</p>
          <p className={large ? "mt-2 text-lg" : ""}>{slide.publishers.join(", ")}</p>
          <p className="mt-2 text-sm text-text-secondary">Every one is linked below, under Every source.</p>
        </>
      );
  }
}

/**
 * The visual explainer: the story as cards, from the checked explainer and
 * the records, and nothing else -- no footage, no images, no new words. Plays
 * only when asked, starts still for a reader who asked for less motion, and
 * carries the whole of itself as a transcript underneath.
 */
export function VisualExplainer({ slides, refs }: { slides: Slide[]; refs: Record<string, CiteTarget> }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (index >= slides.length - 1) setPlaying(false);
      else setIndex(index + 1);
    }, EVERY_MS);
    return () => clearTimeout(timer);
  }, [playing, index, slides.length]);

  const slide = slides[index]!;
  return (
    <section aria-labelledby="visual-explainer" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 border-t-2 border-rule pt-2.5">
        <div>
          <p className="kicker text-text-tertiary">Visual explainer · from the checked explainer and the records · no footage, no images</p>
          <h2 id="visual-explainer" className="text-2xl font-bold leading-tight">
            The story in cards
          </h2>
        </div>
        {open ? null : (
          <Button
            variant="secondary"
            onClick={() => {
              setOpen(true);
              setIndex(0);
              setPlaying(!prefersStill());
            }}
          >
            <Play className="size-4" aria-hidden /> Play the cards
          </Button>
        )}
      </div>
      {open ? (
        <div className="space-y-3">
          <div className="relative min-h-72 overflow-hidden border border-border-strong bg-surface p-6 sm:p-10" aria-live="polite" aria-atomic>
            <div key={index} className="rise-in max-w-2xl">
              <SlideBody slide={slide} refs={refs} large />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              <ChevronLeft className="size-4" aria-hidden /> Previous
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPlaying(!playing)} aria-pressed={playing}>
              {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
              {playing ? "Pause" : "Play"}
            </Button>
            <Button variant="ghost" size="sm" disabled={index === slides.length - 1} onClick={() => setIndex(index + 1)}>
              Next <ChevronRight className="size-4" aria-hidden />
            </Button>
            <span className="ml-auto text-sm tabular-nums text-text-secondary">
              Card {index + 1} of {slides.length}
            </span>
          </div>
        </div>
      ) : null}
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold">Transcript of every card</summary>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-text-secondary">
          {slides.map((entry, number) => (
            <li key={number}>
              <SlideBody slide={entry} refs={refs} />
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
