"use client";

import { MODE_OPTIONS } from "@/config/themes";
import { setThemePreference, useThemePreference } from "@/lib/design/theme";
import type { ThemePreference } from "@/lib/design/theme-script";
import { withLookTransition } from "@/lib/design/transition";

import { Segmented } from "./segmented";

/**
 * Day, night or match the device, within the current palette.
 *
 * `onChoose` replaces the default behaviour. Signed in, it is the preferences
 * store, which applies the mode AND saves it; without it the choice is kept in
 * this browser only.
 */
export function ThemeSwitcher({ className, onChoose }: { className?: string; onChoose?: (next: ThemePreference) => void }) {
  const preference = useThemePreference();
  return (
    <Segmented
      legend="Colour scheme"
      options={MODE_OPTIONS}
      value={preference}
      onChange={onChoose ?? ((next) => withLookTransition(() => setThemePreference(next)))}
      className={className}
    />
  );
}
