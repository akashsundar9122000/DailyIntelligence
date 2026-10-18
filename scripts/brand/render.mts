#!/usr/bin/env tsx
/**
 * Writes the static brand files from the one geometry in
 * src/lib/brand/mark-geometry.ts: the SVG marks and the PNG app icons.
 *
 * Run after changing the geometry, with a NEW version suffix in
 * src/config/brand.ts (see the note there on the favicon cache). The colours
 * here are the light and dark ink and the press red from tokens.css; this is
 * one of the few places a hex value may appear outside the tokens, because a
 * PNG cannot read a CSS variable. scripts/check-tokens.mjs allows scripts/brand.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { markSvg } from "../../src/lib/brand/mark-geometry";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "public/brand");
mkdirSync(OUT, { recursive: true });

const INK = "#141311";
const PAPER = "#f3f0e8";
const NIGHT_INK = "#ede8dd";
const RED = "#c8102e";

writeFileSync(join(OUT, "mark-v1.svg"), markSvg({ ink: INK, signal: RED }));
writeFileSync(join(OUT, "mark-inverse-v1.svg"), markSvg({ ink: NIGHT_INK, signal: RED }));

async function png(name: string, size: number, inset: number) {
  const svg = markSvg({ ink: INK, signal: RED, background: PAPER, size, inset });
  await sharp(Buffer.from(svg)).png().toFile(join(OUT, name));
}

// Standard icons sit close to the edge; the maskable one keeps the drawing
// inside the 80% safe zone a launcher may crop to a circle.
await png("icon-192-v1.png", 192, 6);
await png("icon-512-v1.png", 512, 6);
await png("icon-maskable-v1.png", 512, 13);
await png("apple-touch-v1.png", 180, 8);
console.log("brand files written to public/brand");
