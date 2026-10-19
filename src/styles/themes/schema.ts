/**
 * The shape every palette fills in. This directory is the ONE place a colour
 * value is written; src/styles/themes.generated.css is built from it by
 * scripts/build-themes.mts, and scripts/check-contrast.ts measures it directly.
 *
 * Why TypeScript and a generator rather than hand-written CSS: five palettes,
 * each in day and night, each with a high-contrast variant, plus the night band
 * and the preview scope, is about forty blocks. Written by hand, the copies
 * drift -- the old tokens.css wrote the night edition three times and needed a
 * drift check to keep them equal. Generated from one source, they cannot.
 */

/** Every colour a theme block declares. A block that left one out would inherit it from the block underneath -- a mixed theme. */
export const COLOUR_TOKENS = [
  "canvas",
  "surface",
  "surface-raised",
  "surface-sunken",
  "surface-hover",
  "border",
  "border-strong",
  "border-input",
  "text-primary",
  "text-secondary",
  "text-tertiary",
  "accent",
  "accent-hover",
  "accent-subtle",
  "accent-border",
  "on-accent",
  // The second hue of a palette's gradients. Decoration and emphasis only;
  // never a state.
  "accent-2",
  "ink",
  "on-ink",
  // The RESERVED alert colour: breaking, live or wrong, and nothing else, in
  // every palette. Still called "press" after the newspaper's spot colour.
  "press",
  "press-solid",
  "press-subtle",
  "on-press",
  "success",
  "success-subtle",
  "warning",
  "warning-subtle",
  "danger",
  "danger-subtle",
  "on-danger",
  "info",
  "info-subtle",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
  "chart-grid",
  "chart-track",
  // Ambient light: the glows behind a palette's atmosphere and its card
  // shadows. Never behind text without a surface between.
  "glow-1",
  "glow-2",
  "glow-3",
  // The tint of a shadow. Shadows are mixed from it, so a night shadow is not
  // a day shadow painted on a dark page.
  "shadow",
] as const;

export type ColourToken = (typeof COLOUR_TOKENS)[number];
export type ColourSet = Record<ColourToken, string>;

/**
 * Everything about a palette that is not a colour value: its faces, its
 * corners, how a card is drawn, and how it moves. Values may refer to colour
 * tokens through var(); they may not contain a colour of their own.
 */
export const STYLE_TOKENS = [
  // Faces. Each is a var() of a next/font variable from src/app/layout.tsx.
  "face-display",
  "face-ui",
  "face-mono",
  // Headlines.
  "heading-tracking",
  // Corners. Tailwind's rounded-sm … rounded-3xl read these through @theme, so
  // every button, chip and dialog changes shape with the palette. Named
  // "corner", not "radius": @theme's --radius-sm: var(--radius-sm) would be a
  // cycle, and a cyclic custom property is silently invalid.
  "corner-sm",
  "corner-md",
  "corner-lg",
  "corner-xl",
  "corner-2xl",
  "corner-3xl",
  "corner-card",
  // How a card is drawn: its ground, its top rule, its shadow and its blur.
  "card-bg",
  "card-rule-width",
  "card-rule-colour",
  "card-shadow",
  "card-shadow-hover",
  "card-filter",
  // Rules. The strong rule (.rule-thick) and the masthead's double rule
  // (.rule-double) are ink lines in Newspaper and lines of light in Aurora.
  "rule-strong-colour",
  "rule-strong-image",
  "rule-hair-colour",
  // The small capitals above a headline that say what a story is about.
  "kicker-colour",
  "rule-double-height",
  "rule-double-border",
  "rule-double-shadow",
  "rule-double-paint",
  "rule-double-radius",
  // A card a reader can open, hovered: how far it lifts and what its edge becomes.
  "lift-distance",
  "lift-border",
  // Glass: how opaque a translucent surface is, as a fraction. 1 is solid.
  // scripts/check-contrast.ts composites every glow under a glass surface at
  // this opacity before measuring text on it.
  "glass-opacity",
  // How strongly the atmosphere's light shows through the page canvas, as a
  // fraction. 0 turns it off. The contrast check composites each glow over
  // the canvas at this strength before measuring text on the page.
  "atmosphere-opacity",
  // Motion. Durations and easings for every transition in the palette.
  "dur-fast",
  "dur-base",
  "dur-slow",
  "motion-ease-out",
  "motion-ease-spring",
  // The entrance: how far a revealed block travels, and whether it focuses in.
  "reveal-distance",
  "reveal-blur",
] as const;

export type StyleToken = (typeof STYLE_TOKENS)[number];
export type StyleSet = Record<StyleToken, string>;

export type Mode = "light" | "dark";

export type PaletteSource = {
  /** Full sets, one per mode. */
  colours: Record<Mode, ColourSet>;
  style: StyleSet;
  /**
   * High contrast over this palette, per mode: only what must change. Text
   * pairs are then held to 7:1. Glass turns solid, because a glow under text
   * is exactly what high contrast is for removing.
   */
  contrast: Record<Mode, Partial<ColourSet> & Partial<StyleSet>>;
};
