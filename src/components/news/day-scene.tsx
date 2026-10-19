"use client";

import { useSyncExternalStore } from "react";

import { cn } from "@/components/ui/cn";

type Period = "dawn" | "day" | "dusk" | "night";

/** The hour in India, where the paper's day is kept. */
function periodNow(): Period {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()));
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

/** Checked once a minute: a page left open through the evening turns to dusk on its own. */
function subscribe(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
}

/*
 * Class names written out in full: Tailwind finds them by reading this file,
 * and a name assembled from the period would never be generated.
 */
const SKY: Record<Period, string> = {
  dawn: "bg-gradient-to-b from-glow-3/40 via-accent-subtle to-canvas",
  day: "bg-gradient-to-b from-accent-subtle via-surface to-canvas",
  dusk: "bg-gradient-to-b from-glow-2/50 via-glow-1/25 to-canvas",
  night: "bg-gradient-to-b from-surface-sunken via-surface to-canvas",
};

const BODY: Record<Period, string> = {
  dawn: "left-[18%] bg-warning",
  day: "left-[62%] bg-warning",
  dusk: "left-[82%] bg-press-solid",
  night: "left-[70%] bg-text-secondary",
};

/**
 * Studio's sky over the Today page: dawn, day, dusk or night by the hour in
 * India, with the sun or the moon rising once into place. Decoration only --
 * hidden from assistive technology, and drawn only in Studio (palettes.css).
 *
 * The server snapshot is "day": the server does not know when the reader is
 * reading, and a guess that differed from the browser's would fail hydration.
 */
export function DayScene() {
  const period = useSyncExternalStore(subscribe, periodNow, () => "day" as Period);
  return (
    <div aria-hidden className={cn("day-scene relative h-20 overflow-hidden rounded-2xl", SKY[period])}>
      {period === "night"
        ? ["left-[12%] top-4", "left-[30%] top-9", "left-[46%] top-3", "left-[58%] top-10", "left-[88%] top-5"].map((place) => (
            <span key={place} className={cn("absolute size-1 rounded-full bg-text-tertiary", place)} />
          ))
        : null}
      <span className={cn("day-scene-body absolute top-5 size-9 rounded-full shadow-[0_0_32px_var(--glow-1)]", BODY[period])} />
    </div>
  );
}
