"use client";

import { setThemePreference, useThemePreference } from "@/lib/design/theme";
import type { ThemePreference } from "@/lib/design/theme-script";

import { Segmented, type SegmentedOption } from "./segmented";

const OPTIONS: SegmentedOption<ThemePreference>[] = [
  { value: "system", label: "Match device" },
  { value: "light", label: "Day" },
  { value: "dark", label: "Night" },
  { value: "contrast", label: "High contrast" },
];

/**
 * `onChoose` replaces the default behaviour. Signed in, it is the preferences
 * store, which applies the theme AND saves it; without it the choice is kept in
 * this browser only.
 */
export function ThemeSwitcher({ className, onChoose }: { className?: string; onChoose?: (next: ThemePreference) => void }) {
  const preference = useThemePreference();
  return (
    <Segmented legend="Colour scheme" options={OPTIONS} value={preference} onChange={onChoose ?? setThemePreference} className={className} />
  );
}
