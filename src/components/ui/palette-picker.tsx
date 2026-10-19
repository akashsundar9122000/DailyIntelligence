"use client";

import { Check } from "lucide-react";
import { useId } from "react";

import { brand } from "@/config/brand";
import { PALETTE_COPY } from "@/config/themes";
import { PALETTES, type Palette } from "@/lib/design/palettes";
import { setPalette, usePalette, useResolvedTheme } from "@/lib/design/theme";
import { withLookTransition } from "@/lib/design/transition";

import { cn } from "./cn";

/**
 * The look, chosen by seeing it. Each option is a small front page drawn IN
 * that palette -- through the generated [data-preview-palette] scope, so it is
 * the real tokens, not a picture -- in whichever mode is on screen now.
 *
 * Native radio inputs under the cards, as in Segmented: the browser supplies
 * arrow keys, one tab stop and "2 of 5". The previews are decoration
 * (aria-hidden); the name and summary are the label.
 *
 * `onChoose` replaces the default behaviour. Signed in, it is the preferences
 * store, which applies the palette AND saves it; without it the choice is kept
 * in this browser only.
 */
export function PalettePicker({ onChoose, className }: { onChoose?: (next: Palette) => void; className?: string }) {
  const current = usePalette();
  const mode = useResolvedTheme();
  const name = useId();
  const choose = onChoose ?? ((next: Palette) => withLookTransition(() => setPalette(next)));

  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="sr-only">Theme</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PALETTES.map((palette) => {
          const copy = PALETTE_COPY[palette];
          const checked = current === palette;
          return (
            <label key={palette} className="group relative block cursor-pointer">
              <input
                type="radio"
                name={name}
                value={palette}
                checked={checked}
                onChange={() => choose(palette)}
                className="peer sr-only"
                aria-describedby={`${name}-${palette}-summary`}
              />
              <span
                className={cn(
                  "block overflow-hidden rounded-xl border-2 bg-surface transition-[border-color,box-shadow,transform] duration-200",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                  checked ? "border-accent shadow-md" : "border-border group-hover:border-border-strong motion-safe:group-hover:-translate-y-0.5",
                )}
              >
                <PalettePreview palette={palette} mode={mode} />
                <span className="flex items-start justify-between gap-3 border-t border-border p-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-text-primary">{copy.name}</span>
                    <span id={`${name}-${palette}-summary`} className="block text-sm text-text-secondary">
                      {copy.summary}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                      checked ? "border-accent bg-accent text-on-accent" : "border-border-input text-transparent",
                    )}
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Blueprint's graph grid, drawn in the preview's own accent. */
const GRAPH_PAPER = {
  backgroundImage:
    "linear-gradient(to right, color-mix(in oklab, var(--accent) 14%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--accent) 14%, transparent) 1px, transparent 1px)",
  backgroundSize: "12px 12px",
};

/**
 * A front page in miniature: a masthead rule, a live tag in the alert colour,
 * a headline in the palette's display face, and heat and confidence as two
 * separate bars -- the parts of the paper a palette changes most.
 */
function PalettePreview({ palette, mode }: { palette: Palette; mode: "light" | "dark" }) {
  return (
    <span
      aria-hidden
      data-preview-palette={palette}
      data-preview-mode={mode}
      className="relative block h-36 overflow-hidden bg-canvas p-3 text-text-primary"
    >
      {palette === "aurora" ? (
        <span className="pointer-events-none absolute inset-0">
          <span className="absolute -left-6 -top-10 size-28 rounded-full bg-glow-1 opacity-40 blur-2xl" />
          <span className="absolute -right-8 top-6 size-28 rounded-full bg-glow-2 opacity-35 blur-2xl" />
        </span>
      ) : null}
      {palette === "studio" ? (
        <span className="pointer-events-none absolute inset-0">
          <span className="absolute -left-8 -top-12 size-32 rounded-full bg-glow-1 opacity-30 blur-2xl" />
        </span>
      ) : null}
      {palette === "blueprint" ? <span className="pointer-events-none absolute inset-0" style={GRAPH_PAPER} /> : null}
      <span className="relative block">
        <span className="flex items-center justify-between">
          <span className="font-display text-sm font-bold leading-none">{brand.shortName}</span>
          <span className="inline-flex items-center gap-1 rounded-sm bg-press-solid px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase tracking-[0.08em] text-on-press">
            Live
          </span>
        </span>
        <span className="rule-double mt-1.5 block" />
        <span className="card mt-2 block p-2">
          <span className="kicker block text-[0.5625rem] text-accent">Markets</span>
          <span className="mt-0.5 block font-display text-[0.8125rem] font-bold leading-tight">Rupee steadies as oil prices cool</span>
          <span className="mt-1.5 grid grid-cols-2 gap-2">
            <span className="block">
              <span className="block text-[0.5625rem] text-text-tertiary">Heat</span>
              <span className="mt-0.5 block h-1 rounded-full bg-chart-track">
                <span className="block h-full w-4/5 rounded-full bg-press-solid" />
              </span>
            </span>
            <span className="block">
              <span className="block text-[0.5625rem] text-text-tertiary">Confidence</span>
              <span className="mt-0.5 block h-1 rounded-full bg-chart-track">
                <span className="block h-full w-2/5 rounded-full bg-text-primary" />
              </span>
            </span>
          </span>
        </span>
      </span>
    </span>
  );
}
