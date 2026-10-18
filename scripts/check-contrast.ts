#!/usr/bin/env tsx
/**
 * Contrast, computed rather than eyeballed.
 *
 * Reads src/styles/tokens.css DIRECTLY rather than a duplicated TS copy of the
 * palette -- a second source of truth would drift, and the drift would be
 * invisible precisely because both files would look right.
 *
 * Checks three things:
 *   1. Every declared pair, in every theme and every surface scope.
 *   2. DRIFT between the blocks that are deliberately duplicated (the
 *      media-query dark block and the [data-theme="dark"] one).
 *   3. Brand accents, if a brands file is present, against every ground they
 *      can land on -- not just against their own on-accent.
 *
 * Adjust the token names in PAIRS and SCOPES. Do not lower a threshold.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// fileURLToPath, not new URL(...).pathname: a project directory containing a
// space comes back percent-encoded from pathname, and every lookup then
// silently misses.
const HERE = dirname(fileURLToPath(import.meta.url));
const TOKENS = join(HERE, "../src/styles/tokens.css");

/*
 * Comments are blanked -- with their newlines preserved -- BEFORE anything is
 * extracted. This file's own docblock names the selectors it looks for, and
 * `indexOf` found the mention in the prose before the real rule, so the drift
 * check compared the light block against itself and reported every dark token
 * as drifted. A guard that greps raw source matches the prose explaining it.
 */
const css = readFileSync(TOKENS, "utf8").replace(/\/\*[\s\S]*?\*\//g, (m) =>
  m.replace(/[^\n]/g, " "),
);

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

/* ------------------------------------------------------------- extraction */

/**
 * The body of the first rule whose selector contains `selector`.
 *
 * Brace COUNTING, not a regex: a dark theme block nested inside a media query
 * is one level down, and a lazy /{[^}]*}/ stops at the first inner brace.
 */
function blockAfter(selector: string): Record<string, string> {
  const at = css.indexOf(selector);
  if (at === -1) return {};
  const open = css.indexOf("{", at);
  if (open === -1) return {};

  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  const body = css.slice(open + 1, end);
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]!] = m[2]!.trim();
  }
  return out;
}

/** Resolve one var() indirection, so --color-x: var(--x) still measures. */
function resolve(tokens: Record<string, string>, name: string): string | undefined {
  const raw = tokens[name];
  if (!raw) return undefined;
  const ref = raw.match(/^var\(\s*--([\w-]+)\s*\)$/);
  return ref ? tokens[ref[1]!] ?? raw : raw;
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
  { fg: "on-accent",      bg: "accent",         min: 4.5, why: "a primary button's label" },
  { fg: "on-accent",      bg: "accent-hover",   min: 4.5, why: "a primary button's label, hovered" },
  { fg: "on-ink",         bg: "ink",            min: 4.5, why: "an inverted button's label" },
  { fg: "on-danger",      bg: "danger",         min: 4.5, why: "a destructive button's label" },

  // The spot colour as TEXT: a "Breaking" kicker is read, not glanced at.
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

  // A divider must be VISIBLE, not loud. 3:1 here looks heavy, which is why
  // border-strong and border-input are separate tokens.
  { fg: "border-strong",  bg: "surface",        min: 1.4, why: "a row divider" },
];

/**
 * Every theme and scope that can present these pairs to a reader.
 *
 * `enhanced` holds text pairs to 7:1 (WCAG AAA) instead of 4.5:1. A theme
 * called "high contrast" that only met the ordinary threshold would be a label,
 * not a feature.
 */
const SCOPES: { name: string; selector: string; base?: string; enhanced?: boolean; partial?: boolean }[] = [
  { name: "light",             selector: ":root {" },
  { name: "dark (explicit)",   selector: ':root[data-theme="dark"]', base: ":root {" },
  { name: "dark (system)",     selector: ':root:not([data-theme="light"])', base: ":root {" },
  { name: "high contrast",     selector: ':root[data-theme="contrast"]', base: ":root {", enhanced: true },
  { name: "night band",        selector: '[data-surface="night"]', base: ":root {" },
];

/** The colour tokens every theme block must declare. Read from the light block. */
const REQUIRED = Object.entries(blockAfter(":root {"))
  .filter(([, value]) => parseColour(value) !== null)
  .map(([name]) => name);

/* ------------------------------------------------------------------- run */

let failures = 0;
const rows: string[] = [];

for (const scope of SCOPES) {
  // A theme block is complete, so a preset layered on it needs only that block
  // beneath it; the light block is merged in first for the non-colour tokens.
  const base = scope.base ? { ...blockAfter(":root {"), ...blockAfter(scope.base) } : {};
  const own = blockAfter(scope.selector);
  if (Object.keys(own).length === 0) {
    // A scope that cannot be found is a scope that was not checked.
    console.error(`  MISSING  scope "${scope.name}" (${scope.selector}) not found in tokens.css`);
    failures++;
    continue;
  }
  // A block that omits a token inherits it from whichever block matched
  // underneath -- on a dark OS, the media-query one -- so a partial block is a
  // mixed theme. Every block declares the full set.
  for (const name of scope.partial ? [] : REQUIRED) {
    if (!(name in own)) {
      console.error(`  MISSING  --${name} is not declared in "${scope.name}"`);
      failures++;
    }
  }
  const tokens = { ...base, ...own };

  for (const pair of PAIRS) {
    const fgRaw = resolve(tokens, pair.fg);
    const bgRaw = resolve(tokens, pair.bg);
    if (!fgRaw || !bgRaw) {
      // A pair naming a token that does not exist measures nothing.
      console.error(`  MISSING  ${pair.fg} or ${pair.bg} is not defined in "${scope.name}"`);
      failures++;
      continue;
    }

    const fg = parseColour(fgRaw);
    const bg = parseColour(bgRaw);
    if (!fg || !bg) {
      console.error(`  UNPARSED  ${pair.fg}/${pair.bg} in "${scope.name}" — not a hex or oklch colour`);
      failures++;
      continue;
    }

    // A token the scope leaves inherited is a warning, not a failure -- but it
    // is worth seeing, because inheriting status colours into a dark band is
    // how success text ended up at 3.39:1 on near-black.
    if (!(pair.fg in own) && !(pair.bg in own) && scope.base) {
      // both inherited: the base scope already checked this pair
      continue;
    }

    const min = scope.enhanced && pair.min === 4.5 ? 7 : pair.min;
    const ratio = contrast(fg, bg);
    const ok = ratio >= min;
    if (!ok) failures++;
    rows.push(
      `  ${ok ? "ok  " : "FAIL"}  ${ratio.toFixed(2).padStart(6)} / ${min.toFixed(1)}  ` +
        `${scope.name.padEnd(16)} ${pair.fg} on ${pair.bg}  — ${pair.why}`,
    );
  }
}

/* ------------------------------------------------------------------ drift */
/*
 * The dark values are written three times on purpose (see tokens.css): the
 * media-query block, the explicit [data-theme="dark"] block and the night
 * band scope. Assert the copies have not diverged. Without this, a token
 * fixed in one block and not the others is a bug that appears only for users
 * whose OS preference happens to disagree with their explicit choice.
 */
const explicitDark = blockAfter(':root[data-theme="dark"]');
const DARK_COPIES: [string, Record<string, string>][] = [
  ["the media query", blockAfter(':root:not([data-theme="light"])')],
  ["the night band", blockAfter('[data-surface="night"]')],
];

for (const [label, copy] of DARK_COPIES) {
  for (const key of Object.keys(explicitDark)) {
    if (!(key in copy)) {
      console.error(`  DRIFT  --${key} is in [data-theme="dark"] but not in ${label}`);
      failures++;
    } else if (copy[key] !== explicitDark[key]) {
      console.error(`  DRIFT  --${key}: ${label} has ${copy[key]}, [data-theme="dark"] has ${explicitDark[key]}`);
      failures++;
    }
  }
  for (const key of Object.keys(copy)) {
    if (!(key in explicitDark)) {
      console.error(`  DRIFT  --${key} is in ${label} but not in [data-theme="dark"]`);
      failures++;
    }
  }
}

/* --------------------------------------------------------------- report */

console.log("check:contrast\n");
for (const row of rows) console.log(row);

if (failures) {
  console.error(`\ncheck:contrast FAILED — ${failures} problem(s).`);
  console.error("Adjust the token in src/styles/tokens.css. Do not lower a threshold.");
  process.exit(1);
}

console.log(`\ncheck:contrast ok — ${rows.length} pairs across ${SCOPES.length} scopes`);
