/**
 * The palette vocabulary: which looks the paper can wear.
 *
 * A palette is the whole character of the app -- colour, type, shape and
 * motion. It is independent of the MODE (day or night), which every palette
 * has both of, and of high contrast, which can be switched on over any of them.
 *
 * No "use client" and no imports, so the pre-paint script, the preferences
 * whitelist, the theme generator and the contrast check can all read it.
 *
 * Adding a palette here offers it to readers. The contrast check, the axe
 * matrix and the screenshot matrix all read this list, so a palette cannot be
 * offered without being measured.
 */
export const PALETTES = ["aurora", "newspaper"] as const;
export type Palette = (typeof PALETTES)[number];

/** The look a reader gets before choosing one. */
export const DEFAULT_PALETTE: Palette = "aurora";

/**
 * The palette a reader who chose Day or Night before palettes existed keeps.
 * They chose it in the Newspaper look, and a deliberate choice is not
 * overridden by a new default.
 */
export const LEGACY_PALETTE: Palette = "newspaper";

export function isPalette(value: unknown): value is Palette {
  return typeof value === "string" && (PALETTES as readonly string[]).includes(value);
}
