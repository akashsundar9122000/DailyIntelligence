#!/usr/bin/env tsx
/**
 * Contrast, computed rather than eyeballed.
 *
 * Reads the palette SOURCES (src/styles/themes/*.ts) -- the one place a colour
 * value is written. The CSS is generated from them, and check:themes fails
 * if the generated file disagrees, so measuring the source measures what
 * ships.
 *
 * For every offered palette (PALETTES), in day and in night, plain and with
 * high contrast on, it checks:
 *   1. Every block declares every colour token (a block that left one out
 *      would inherit it from the block underneath: a mixed theme).
 *   2. Every declared pair. High contrast holds text pairs to 7:1.
 *   3. Text on the page with the palette's atmosphere showing through the
 *      canvas, and text on a glass card with the light showing through it --
 *      each glow composited at the palette's own opacity. A translucent
 *      surface measured as if it were solid is a guess.
 *   4. The alert colour stays visibly apart from the accent, so "live" never
 *      reads as "a button".
 * And that colour lives only in the sources: tokens.css, palettes.css and
 * motion.css hold no colour literal, and every --color-* name in @theme is a
 * token a palette declares.
 *
 * The night band uses a palette's night set, measured here as its dark mode.
 *
 * Adjust a value in src/styles/themes. Do not lower a threshold.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PALETTES } from "../src/lib/design/palettes";
import { PALETTE_SOURCES } from "../src/styles/themes";
import { COLOUR_TOKENS, type ColourSet, type Mode } from "../src/styles/themes/schema";

// fileURLToPath, not new URL(...).pathname: a project directory containing a
// space comes back percent-encoded from pathname, and every lookup then
// silently misses.
const HERE = dirname(fileURLToPath(import.meta.url));

/* ----------------------------------------------------------------- colour */

type RGB = { r: number; g: number; b: number; a: number };

function parseHex(value: string): RGB | null {
  const m = value.trim().match(/^#([0-9a-f]{3,8})$/i);
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
  if (h.length !== 6 && h.length !== 8) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
  };
}

/** oklch(L C H [/ A]) -> sRGB. Enough of the conversion to be exact for checks. */
function parseOklch(value: string): RGB | null {
  const m = value.trim().match(/^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i);
  if (!m) return null;
  const pct = (s: string) => (s.endsWith("%") ? parseFloat(s) / 100 : parseFloat(s));
  const L = pct(m[1]!);
  const C = parseFloat(m[2]!);
  const H = (parseFloat(m[3]!) * Math.PI) / 180;
  const a = m[4] ? pct(m[4]) : 1;

  const A = C * Math.cos(H);
  const B = C * Math.sin(H);

  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const mm = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;

  const lin = [
    +4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];

  const enc = (v: number) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, c)) * 255);
  };

  return { r: enc(lin[0]!), g: enc(lin[1]!), b: enc(lin[2]!), a };
}

function parseColour(value: string): RGB | null {
  return parseHex(value) ?? parseOklch(value);
}

/** Composite a translucent colour over an opaque ground before measuring it. */
function over(fg: RGB, bg: RGB): RGB {
  if (fg.a >= 1) return fg;
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
}

function withAlpha(colour: RGB, alpha: number): RGB {
  return { ...colour, a: colour.a * alpha };
}

function luminance({ r, g, b }: RGB): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(fg: RGB, bg: RGB): number {
  const a = luminance(over(fg, bg));
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** sRGB -> OKLab, for a perceptual distance between two hues. */
function oklab({ r, g, b }: RGB): [number, number, number] {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function distance(a: RGB, b: RGB): number {
  const [l1, a1, b1] = oklab(a);
  const [l2, a2, b2] = oklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/* ------------------------------------------------------------------ rules */

type Pair = { fg: string; bg: string; min: number; why: string };

const PAIRS: Pair[] = [
  { fg: "text-primary",   bg: "canvas",         min: 4.5, why: "body text on the page" },
  { fg: "text-primary",   bg: "surface",        min: 4.5, why: "body text on a card" },
  { fg: "text-primary",   bg: "surface-raised", min: 4.5, why: "body text on a raised card" },
  { fg: "text-secondary", bg: "canvas",         min: 4.5, why: "secondary text on the page" },
  { fg: "text-secondary", bg: "surface",        min: 4.5, why: "secondary text on a card" },
  { fg: "text-secondary", bg: "surface-sunken", min: 4.5, why: "secondary text in a sunken well" },
  { fg: "text-secondary", bg: "danger-subtle",  min: 4.5, why: "the description in an error state" },
  { fg: "text-tertiary",  bg: "canvas",         min: 4.5, why: "a caption on the page" },
  { fg: "text-tertiary",  bg: "surface",        min: 4.5, why: "a caption on a card" },
  { fg: "accent",         bg: "canvas",         min: 4.5, why: "a link on the page" },
  { fg: "accent",         bg: "surface",        min: 4.5, why: "a link on a card" },
  { fg: "accent",         bg: "accent-subtle",  min: 4.5, why: "accent text on its tint" },
  { fg: "accent-2",       bg: "canvas",         min: 4.5, why: "the second hue of a headline's sheen" },
  { fg: "accent-2",       bg: "surface",        min: 4.5, why: "the second hue on a card" },
  { fg: "on-accent",      bg: "accent",         min: 4.5, why: "a primary button's label" },
  { fg: "on-accent",      bg: "accent-hover",   min: 4.5, why: "a primary button's label, hovered" },
  { fg: "on-ink",         bg: "ink",            min: 4.5, why: "an inverted button's label" },
  { fg: "on-danger",      bg: "danger",         min: 4.5, why: "a destructive button's label" },

  // The alert colour as TEXT: a "Breaking" kicker is read, not glanced at.
  { fg: "press",          bg: "canvas",         min: 4.5, why: "a breaking kicker on the page" },
  { fg: "press",          bg: "surface",        min: 4.5, why: "a breaking kicker on a card" },
  { fg: "press",          bg: "press-subtle",   min: 4.5, why: "red text in its tint" },
  { fg: "on-press",       bg: "press-solid",    min: 4.5, why: "the label on a filled red tag" },
  { fg: "warning",        bg: "canvas",         min: 4.5, why: "a stale-source note on the page" },

  { fg: "success",        bg: "success-subtle", min: 4.5, why: "success text on its tint" },
  { fg: "warning",        bg: "warning-subtle", min: 4.5, why: "warning text on its tint" },
  { fg: "danger",         bg: "danger-subtle",  min: 4.5, why: "danger text on its tint" },
  { fg: "info",           bg: "info-subtle",    min: 4.5, why: "info text on its tint" },

  // Non-text UI: WCAG 1.4.11 wants 3:1.
  { fg: "border-input",   bg: "surface",        min: 3.0, why: "the boundary that identifies an input" },
  { fg: "accent",         bg: "canvas",         min: 3.0, why: "the focus ring against the page" },
  { fg: "press-solid",    bg: "surface",        min: 3.0, why: "the signal dot on a card" },
  { fg: "press-solid",    bg: "canvas",         min: 3.0, why: "the signal dot on the page" },
  { fg: "chart-1",        bg: "surface",        min: 3.0, why: "chart series 1 on a card" },
  { fg: "chart-2",        bg: "surface",        min: 3.0, why: "chart series 2 on a card" },
  { fg: "chart-3",        bg: "surface",        min: 3.0, why: "chart series 3 on a card" },
  { fg: "chart-4",        bg: "surface",        min: 3.0, why: "chart series 4 on a card" },
  { fg: "chart-5",        bg: "surface",        min: 3.0, why: "chart series 5 on a card" },
  { fg: "chart-6",        bg: "surface",        min: 3.0, why: "chart series 6 on a card" },

  { fg: "kicker",         bg: "canvas",         min: 4.5, why: "a story's kicker on the page" },
  { fg: "kicker",         bg: "surface",        min: 4.5, why: "a story's kicker on a card" },

  // The strong rule across a panel's top, through the style token it names.
  { fg: "rule",           bg: "canvas",         min: 3.0, why: "a panel's top rule against the page" },

  // A divider must be VISIBLE, not loud. 3:1 here looks heavy, which is why
  // border-strong and border-input are separate tokens.
  { fg: "border-strong",  bg: "surface",        min: 1.4, why: "a row divider" },
];

/** The text that sits directly on the page, and so over the atmosphere. */
const ON_CANVAS = PAIRS.filter((pair) => pair.bg === "canvas" && pair.min >= 4.5);
/** The text that sits on a card, and so on glass. */
const ON_CARD = PAIRS.filter((pair) => pair.bg === "surface" && pair.min >= 4.5);

/**
 * How far apart, in OKLab, the alert colour must sit from the accent. 0.15 is
 * about the gap between a crimson and a violet of the same lightness -- the
 * distance at which a reader stops having to look twice.
 */
const ALERT_DISTANCE = 0.15;

/** Colour names in @theme that read a style token rather than a colour token. */
const STYLE_COLOURS: [string, string][] = [];
{
  const theme = readFileSync(join(HERE, "../src/styles/tokens.css"), "utf8");
  for (const match of theme.matchAll(/--color-([\w-]+)\s*:\s*var\(--([\w-]+)\)/g)) {
    if (!(COLOUR_TOKENS as readonly string[]).includes(match[2]!)) STYLE_COLOURS.push([match[1]!, match[2]!]);
  }
}

/* ------------------------------------------------------------------- run */

let failures = 0;
const rows: string[] = [];
let measured = 0;
let scopes = 0;

function fail(message: string): void {
  console.error(`  ${message}`);
  failures++;
}

function measure(scope: string, fgRaw: string | undefined, ground: RGB | string | undefined, pair: Pair, enhanced: boolean, where = pair.bg): void {
  if (!fgRaw || !ground) {
    // A pair naming a token that does not exist measures nothing.
    fail(`MISSING  ${pair.fg} or ${where} is not defined in "${scope}"`);
    return;
  }
  const fg = parseColour(fgRaw);
  const bg = typeof ground === "string" ? parseColour(ground) : ground;
  if (!fg || !bg) {
    fail(`UNPARSED  ${pair.fg}/${where} in "${scope}" — not a hex or oklch colour`);
    return;
  }
  const min = enhanced && pair.min === 4.5 ? 7 : pair.min;
  const ratio = contrast(fg, bg);
  const ok = ratio >= min;
  if (!ok) failures++;
  measured++;
  rows.push(`  ${ok ? "ok  " : "FAIL"}  ${ratio.toFixed(2).padStart(6)} / ${min.toFixed(1)}  ${scope.padEnd(26)} ${pair.fg} on ${where}  — ${pair.why}`);
}

for (const palette of PALETTES) {
  const source = PALETTE_SOURCES[palette];
  for (const mode of ["light", "dark"] as Mode[]) {
    for (const enhanced of [false, true]) {
      scopes++;
      const scope = `${palette} ${mode}${enhanced ? " +contrast" : ""}`;
      const own = source.colours[mode] as Partial<ColourSet>;
      for (const name of COLOUR_TOKENS) {
        if (!(name in own)) fail(`MISSING  --${name} is not declared in "${palette} ${mode}"`);
      }
      const override = enhanced ? (source.contrast[mode] as Record<string, string>) : {};
      const tokens: Record<string, string> = { ...source.colours[mode], ...override };
      const style: Record<string, string> = { ...source.style, ...override };
      // A colour name that reads a style token (--color-rule: var(--rule-strong-colour))
      // is measured as the colour token that style token names in this palette.
      for (const [name, target] of STYLE_COLOURS) {
        const ref = style[target]?.match(/^var\(--([\w-]+)\)$/)?.[1];
        if (ref && tokens[ref]) tokens[name] = tokens[ref]!;
      }

      for (const pair of PAIRS) measure(scope, tokens[pair.fg], tokens[pair.bg], pair, enhanced);

      const canvas = parseColour(tokens.canvas ?? "");
      const surface = parseColour(tokens.surface ?? "");
      const glows = ["glow-1", "glow-2", "glow-3"].map((name) => [name, parseColour(tokens[name] ?? "")] as const);
      const atmosphere = Number.parseFloat(style["atmosphere-opacity"] ?? "0");
      const glass = Number.parseFloat(style["glass-opacity"] ?? "1");
      if (!canvas || !surface || Number.isNaN(atmosphere) || Number.isNaN(glass)) {
        fail(`UNPARSED  canvas, surface, atmosphere-opacity or glass-opacity in "${scope}"`);
        continue;
      }

      for (const [name, glow] of glows) {
        if (!glow) {
          fail(`UNPARSED  --${name} in "${scope}"`);
          continue;
        }
        // The page where a glow is brightest: the glow at the atmosphere's
        // strength over the canvas.
        const lit = over(withAlpha(glow, atmosphere), canvas);
        if (atmosphere > 0) {
          for (const pair of ON_CANVAS) measure(scope, tokens[pair.fg], lit, pair, enhanced, `canvas under ${name}`);
        }
        // A glass card over that lit page.
        if (glass < 1) {
          const pane = over(withAlpha(surface, glass), lit);
          for (const pair of ON_CARD) measure(scope, tokens[pair.fg], pane, pair, enhanced, `glass over ${name}`);
        }
      }

      const alert = parseColour(tokens["press-solid"] ?? "");
      const accent = parseColour(tokens.accent ?? "");
      if (alert && accent) {
        const gap = distance(alert, accent);
        const ok = gap >= ALERT_DISTANCE;
        if (!ok) failures++;
        rows.push(`  ${ok ? "ok  " : "FAIL"}  ${gap.toFixed(3).padStart(6)} / ${ALERT_DISTANCE.toFixed(2)} ${scope.padEnd(26)} press-solid apart from accent  — "live" must not read as "a button"`);
      }
    }
  }
}

/* ------------------------------------------------------ one source of colour */
/*
 * Comments are blanked before anything is searched: this file's own kind of
 * docblock names colours in prose, and a guard that greps raw source matches
 * the prose explaining it.
 */
function code(path: string): string {
  return readFileSync(join(HERE, path), "utf8").replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

const LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/gi;
for (const file of ["../src/styles/tokens.css", "../src/styles/palettes.css", "../src/styles/motion.css"]) {
  const text = code(file);
  for (const match of text.matchAll(LITERAL)) {
    const line = text.slice(0, match.index).split("\n").length;
    fail(`LITERAL  ${match[0]} in ${file.slice(3)}:${line} — colour values belong in src/styles/themes/*.ts`);
  }
}

// A --color-* name Tailwind generates a utility for, with no palette token
// behind it, compiles to a class that paints nothing. A name may also read a
// style token, if in every palette that token is itself a colour token by
// var(): then it is measured through what it names.
const declared = new Set<string>(COLOUR_TOKENS);
for (const match of code("../src/styles/tokens.css").matchAll(/--color-([\w-]+)\s*:\s*var\(--([\w-]+)\)/g)) {
  const [, name, target] = match as unknown as [string, string, string];
  if (declared.has(target)) continue;
  const viaStyle = PALETTES.every((palette) => {
    const value = (PALETTE_SOURCES[palette].style as Record<string, string>)[target];
    const ref = value?.match(/^var\(--([\w-]+)\)$/)?.[1];
    return ref !== undefined && declared.has(ref);
  });
  if (!viaStyle) fail(`UNDEFINED  --color-${name} reads --${target}, which is not a colour token in every palette`);
}

/* --------------------------------------------------------------- report */

console.log("check:contrast\n");
for (const row of rows) console.log(row);

if (failures) {
  console.error(`\ncheck:contrast FAILED — ${failures} problem(s).`);
  console.error("Adjust the value in src/styles/themes. Do not lower a threshold.");
  process.exit(1);
}

console.log(`\ncheck:contrast ok — ${measured} pairs across ${scopes} scopes (${PALETTES.length} palettes × day/night × plain/high contrast)`);
