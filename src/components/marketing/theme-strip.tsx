"use client";

import { useId } from "react";

import { cn } from "@/components/ui/cn";
import { LANDING_PALETTE_KEY, PALETTE_COPY } from "@/config/themes";
import { PALETTES, type Palette } from "@/lib/design/palettes";
import { setPalette, usePalette, useResolvedTheme } from "@/lib/design/theme";
import { withLookTransition } from "@/lib/design/transition";

function choose(palette: Palette) {
  withLookTransition(() => setPalette(palette));
  try {
    localStorage.setItem(LANDING_PALETTE_KEY, palette);
  } catch {
    // Private browsing: the page still changes; only the offer at sign-up is lost.
  }
}

/**
 * "Try a theme": the landing page wearing each palette, chosen from five
 * swatches. The choice re-skins the whole page in place and is kept in this
 * browser, and the onboarding wizard offers it to the new account, as it
 * does the interests picked further down.
 *
 * Native radio inputs, as in Segmented and PalettePicker: one tab stop, arrow
 * keys, "2 of 5". Each swatch is drawn in its own palette through the preview
 * scope, so it shows the real colours, in the mode on screen.
 */
export function ThemeStrip() {
  const current = usePalette();
  const mode = useResolvedTheme();
  const name = useId();

  return (
    <section aria-labelledby={`${name}-title`} className="px-4 pb-14 sm:px-6">
      <div className="mx-auto flex max-w-[var(--container)] flex-col gap-5 rounded-3xl border border-border bg-surface/70 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-md">
          <p className="kicker text-kicker">Five looks</p>
          <h2 id={`${name}-title`} className="mt-1 text-2xl font-bold leading-tight">
            Try a theme
          </h2>
          <p className="mt-1 text-sm text-text-secondary">The whole paper changes. Your choice stays in this browser and comes with you when you sign up.</p>
        </div>
        <fieldset className="min-w-0">
          <legend className="sr-only">Theme</legend>
          <div className="flex flex-wrap gap-2">
            {PALETTES.map((palette) => {
              const checked = current === palette;
              return (
                <label key={palette} className="relative">
                  <input
                    type="radio"
                    name={name}
                    value={palette}
                    checked={checked}
                    onChange={() => choose(palette)}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "lift flex h-11 cursor-pointer items-center gap-2.5 rounded-full border bg-surface py-1 pl-1.5 pr-4 text-sm font-medium",
                      "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                      checked ? "border-accent text-text-primary shadow-md" : "border-border-strong text-text-secondary",
                    )}
                  >
                    <span
                      aria-hidden
                      data-preview-palette={palette}
                      data-preview-mode={mode}
                      className="relative flex size-8 items-center justify-center overflow-hidden rounded-full border border-border bg-canvas"
                    >
                      <span className="absolute inset-y-0 left-0 w-1/2 bg-accent" />
                      <span className="relative size-2.5 rounded-full bg-press-solid ring-2 ring-canvas" />
                    </span>
                    {PALETTE_COPY[palette].name}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>
    </section>
  );
}
