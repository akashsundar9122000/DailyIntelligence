import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/components/ui/cn";

const DIRECTION = {
  rising: { icon: ArrowUpRight, label: "rising" },
  steady: { icon: ArrowRight, label: "steady" },
  cooling: { icon: ArrowDownRight, label: "cooling" },
} as const;

function band(value: number): string {
  return value >= 70 ? "high" : value >= 40 ? "moderate" : "low";
}

/**
 * Heat and confidence, side by side and never merged: how fast a story is
 * spreading, and how well it is sourced. Each is a number with a word, so
 * neither is read off a colour; heat alone may be drawn in the spot red,
 * because a fast-spreading story is the one thing on the page that is "live".
 */
export function ScorePair({ heat, confidence, direction, size = "sm", className }: { heat: number; confidence: number; direction?: "rising" | "steady" | "cooling"; size?: "sm" | "md"; className?: string }) {
  const Arrow = direction ? DIRECTION[direction].icon : null;
  const box = size === "md" ? "px-2 py-1 text-xs" : "px-1.5 py-0.5 text-[0.6875rem]";
  return (
    <span className={cn("inline-flex items-stretch gap-1.5 font-semibold uppercase tracking-[0.06em]", className)}>
      <span className={cn("inline-flex items-center gap-1 border border-press text-press", box)} title={`Heat ${heat} of 100 (${band(heat)})${direction ? `, ${DIRECTION[direction].label}` : ""}`}>
        Heat <span className="tabular-nums">{heat}</span>
        {Arrow ? <Arrow className="size-3" aria-label={DIRECTION[direction!].label} /> : null}
      </span>
      <span className={cn("inline-flex items-center gap-1 border border-text-primary text-text-primary", box)} title={`Confidence ${confidence} of 100 (${band(confidence)})`}>
        Sourced <span className="tabular-nums">{confidence}</span>
      </span>
    </span>
  );
}
