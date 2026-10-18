"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/components/ui/cn";

import { IllustrationNote } from "./section";

type Step = { n: string; title: string; body: string };

export const STEPS: readonly Step[] = [
  {
    n: "01",
    title: "Gather, every fifteen minutes",
    body: "The world's news index (GDELT), official feeds and open research are read on a schedule. A source is read only after its terms have been, and the ones that say no are listed as not included, with the reason.",
  },
  {
    n: "02",
    title: "Cluster the coverage",
    body: "Reports about the same event are grouped into one story. Twenty copies of one wire report count once, and every original stays one tap away.",
  },
  {
    n: "03",
    title: "Score heat and confidence apart",
    body: "Heat is how fast a story is spreading. Confidence is how well it is sourced: how many independent publishers, whether there is an official record. A story can be hot and barely sourced, and you will see both.",
  },
  {
    n: "04",
    title: "Explain, with citations",
    body: "An AI explainer says what happened and why it matters, citing a source for every claim and marking what is still unclear. It is labelled as AI-written, and never stands in for the original.",
  },
];

/* ---------------------------------------------------------------- the art */
/*
 * Drawings of HOW it works, not of news: slips of ink, rules and meters. No
 * headline text appears in them, so there is nothing a reader could mistake
 * for a real story.
 */

function Slip({ className, tag }: { className?: string; tag?: string }) {
  return (
    <div className={cn("border border-border-strong bg-surface p-2.5", className)}>
      {tag ? <p className="kicker text-[0.5625rem] text-text-tertiary">{tag}</p> : null}
      <div className="mt-1.5 h-2 w-[85%] bg-text-primary" />
      <div className="mt-1.5 h-1.5 w-[60%] bg-border-strong" />
    </div>
  );
}

function GatherArt() {
  const tags = ["News index", "Official", "Research", "News index", "Official", "News index", "Research", "News index", "Official"];
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {tags.map((tag, index) => (
        <Slip key={index} tag={tag} className={cn(index % 3 === 1 && "translate-y-3")} />
      ))}
    </div>
  );
}

function ClusterArt() {
  return (
    <div className="flex items-center gap-6">
      <div className="relative h-44 w-40 shrink-0">
        {[0, 1, 2, 3, 4].map((index) => (
          // Fanned slightly, top card square: many reports, settling into one story.
          <div key={index} className="absolute inset-x-0" style={{ top: `${index * 14}px`, transform: `rotate(${(4 - index) * 1.4}deg)` }}>
            <Slip className="h-20" tag={index === 4 ? "One story" : undefined} />
          </div>
        ))}
      </div>
      <dl className="space-y-3">
        <div>
          <dt className="kicker text-text-tertiary">Reports</dt>
          <dd className="font-display text-4xl font-bold">many</dd>
        </div>
        <div>
          <dt className="kicker text-text-tertiary">Story</dt>
          <dd className="font-display text-4xl font-bold">one</dd>
        </div>
      </dl>
    </div>
  );
}

function Meter({ label, value, note, emphasis }: { label: string; value: number; note: string; emphasis?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="kicker text-text-primary">{label}</p>
        <p className="font-display text-3xl font-bold tabular-nums">{value}</p>
      </div>
      <div className="mt-2 h-3 border border-text-primary bg-surface" role="img" aria-label={`${label}: ${value} out of 100`}>
        <div className={cn("h-full", emphasis ? "bg-press-solid" : "bg-text-primary")} style={{ width: `${value}%` }} />
      </div>
      <p className="mt-1.5 text-sm text-text-secondary">{note}</p>
    </div>
  );
}

function ScoreArt() {
  return (
    <div className="space-y-6">
      <Meter label="Heat" value={88} note="Rising fast: many new reports this hour." emphasis />
      <Meter label="Confidence" value={34} note="Limited: two independent publishers, no official record yet." />
    </div>
  );
}

function ExplainArt() {
  return (
    <div className="border border-border-strong border-t-2 border-t-text-primary bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="kicker text-text-primary">In one minute</p>
        <span className="border border-current px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.08em] text-text-secondary">AI-written</span>
      </div>
      {[92, 80, 86, 54].map((width, index) => (
        <div key={index} className="mt-2.5 flex items-center gap-1.5">
          <div className="h-2 bg-text-primary" style={{ width: `${width}%` }} />
          <sup className="font-mono text-[0.625rem] font-bold text-text-secondary">[{index + 1}]</sup>
        </div>
      ))}
      <div className="mt-4 border-t border-border pt-3">
        <p className="kicker text-text-tertiary">Sources</p>
        {[1, 2, 3].map((index) => (
          <div key={index} className="mt-1.5 flex items-center gap-2">
            <span className="font-mono text-[0.625rem] font-bold text-text-secondary">[{index}]</span>
            <div className="h-1.5 w-1/2 bg-border-strong" />
          </div>
        ))}
      </div>
    </div>
  );
}

const ART = [GatherArt, ClusterArt, ScoreArt, ExplainArt];

function Figure({ index }: { index: number }) {
  const Art = ART[index]!;
  return (
    <figure className="space-y-4">
      <div className="min-h-64 border border-border bg-canvas p-5 sm:p-7">
        <Art />
      </div>
      <figcaption>
        <IllustrationNote />
      </figcaption>
    </figure>
  );
}

/**
 * The four stages, driven by the scroll.
 *
 * Rendered two ways and CSS chooses: on a wide screen a pinned figure beside
 * the scrolling steps; on a phone each step carries its own figure. The phone
 * layout is the default, and it is a complete section on its own, so a reader
 * whose browser never runs the observer still gets every step and every
 * drawing. The observer only decides which drawing the pinned figure shows.
 */
export function ReadingSequence() {
  const [active, setActive] = useState(0);
  const steps = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
        }
      },
      // A step is "current" while it crosses the middle band of the screen.
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const step of steps.current) if (step) observer.observe(step);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
      <div className="hidden lg:block">
        <div className="sticky top-28">
          <div className="relative">
            {STEPS.map((step, index) => (
              <div
                key={step.n}
                aria-hidden={index !== active}
                className={cn("transition-opacity duration-500", index === active ? "relative opacity-100" : "pointer-events-none absolute inset-0 opacity-0")}
              >
                <Figure index={index} />
              </div>
            ))}
          </div>
          <ol className="mt-6 flex gap-2" aria-hidden>
            {STEPS.map((step, index) => (
              <li key={step.n} className={cn("h-1 flex-1 transition-colors duration-300", index <= active ? "bg-text-primary" : "bg-border-strong")} />
            ))}
          </ol>
        </div>
      </div>

      <ol className="space-y-12 lg:space-y-0">
        {STEPS.map((step, index) => (
          <li
            key={step.n}
            ref={(element) => {
              steps.current[index] = element;
            }}
            data-step={index}
            className="lg:flex lg:min-h-[72vh] lg:items-center"
          >
            <div className={cn("transition-opacity duration-300 lg:max-w-md", index !== active && "motion-safe:lg:opacity-40")}>
              <p className="font-display text-6xl font-bold leading-none text-text-tertiary">{step.n}</p>
              <h3 className="mt-3 text-3xl font-bold leading-tight">{step.title}</h3>
              <p className="mt-3 font-serif text-lg leading-relaxed text-text-secondary">{step.body}</p>
              <div className="mt-6 lg:hidden">
                <Figure index={index} />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
