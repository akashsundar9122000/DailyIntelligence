#!/usr/bin/env tsx
/**
 * Writes src/lib/media/geo/countries.ts: every country's outline, simplified,
 * from Natural Earth's admin-0 boundaries AS INDIA DEPICTS THEM
 * (ne_10m_admin_0_countries_ind). A news product for India draws India's
 * borders the way India's law requires; the default Natural Earth set draws
 * them de facto, and that is not a neutral choice here.
 *
 *   pnpm geo     (downloads once into a temporary folder, writes the module)
 *
 * The output is committed: the build never fetches, and a reviewer sees the
 * shapes that ship. Natural Earth is public domain ("No permission is needed
 * to use Natural Earth", naturalearthdata.com/about/terms-of-use, read
 * 2026-10-19); the credit is given anyway, on every map.
 *
 * Coordinates stay in degrees (an equirectangular projection, latitude
 * negated so north is up), rounded to 0.01 degrees, and simplified with
 * Douglas-Peucker: a card map is a few hundred pixels across, and a
 * kilometre-accurate coastline would be weight with nothing to show for it.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../../src/lib/media/geo/countries.ts");
const SOURCE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_ind.geojson";

type Ring = [number, number][];
type Feature = { properties: Record<string, unknown>; geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown } };

/** Perpendicular distance from p to the segment a-b, in degrees. */
function distance(p: [number, number], a: [number, number], b: [number, number]): number {
  const [x, y] = p;
  const [x1, y1] = a;
  const [x2, y2] = b;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function simplify(points: Ring, tolerance: number): Ring {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let worst = -1;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = distance(points[i]!, points[start]!, points[end]!);
      if (d > worst) {
        worst = d;
        index = i;
      }
    }
    if (worst > tolerance && index > 0) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function area(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum / 2);
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Tolerances, in degrees: a card's outline, and a neighbour's context outline. */
const MEDIUM = 0.12;
const COARSE = 0.3;

function pathOf(rings: Ring[]): string {
  return rings
    .map((ring) => "M" + ring.map(([lon, lat]) => `${round(lon)} ${round(-lat)}`).join("L") + "Z")
    .join("")
    .replace(/ -/g, "-");
}

async function load(): Promise<{ features: Feature[] }> {
  const cache = join(tmpdir(), "di-ne_10m_admin_0_countries_ind.geojson");
  if (!existsSync(cache)) {
    const response = await fetch(SOURCE);
    if (!response.ok) throw new Error(`geo: Natural Earth answered ${response.status}`);
    mkdirSync(dirname(cache), { recursive: true });
    writeFileSync(cache, await response.text());
  }
  return JSON.parse(readFileSync(cache, "utf8"));
}

const data = await load();
const entries: string[] = [];
let bytes = 0;

function codeOf(feature: Feature): string {
  return String(feature.properties.ISO_A2_EH ?? feature.properties.ISO_A2 ?? "");
}
function landOf(feature: Feature): number {
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates as Ring[]] : (feature.geometry.coordinates as Ring[][]);
  return polygons.reduce((sum, polygon) => sum + area(polygon[0]!), 0);
}

/*
 * Several features can carry one code (a country and a small territory
 * filed under it). Keep the one with the most land: written in order, a
 * later, empty one had replaced France itself.
 */
const byCode = new Map<string, Feature>();
for (const feature of data.features) {
  const iso = codeOf(feature);
  if (!/^[A-Z]{2}$/.test(iso)) continue;
  const held = byCode.get(iso);
  if (!held || landOf(feature) > landOf(held)) byCode.set(iso, feature);
}

for (const [iso, feature] of byCode) {
  const polygons: Ring[][] =
    feature.geometry.type === "Polygon" ? [feature.geometry.coordinates as Ring[]] : (feature.geometry.coordinates as Ring[][]);
  // India, the map most readers will see, is kept finer than the rest.
  const tolerance = iso === "IN" ? 0.03 : 0.08;
  const rings: Ring[] = [];
  const medium: Ring[] = [];
  const coarse: Ring[] = [];
  let largest: Ring | null = null;
  for (const polygon of polygons) {
    const outer = polygon[0]!;
    if (!largest || area(outer) > area(largest)) largest = outer;
    // Outer rings only: a lake inside a country is not news.
    const simple = simplify(outer, tolerance);
    if (simple.length >= 4 && area(simple) > tolerance * tolerance) rings.push(simple);
    // The card outline: a few hundred pixels across, where 10 km is a pixel.
    const mid = simplify(outer, MEDIUM);
    if (mid.length >= 4 && area(mid) > MEDIUM * MEDIUM * 2) medium.push(mid);
    // The context outline: a neighbour drawn around the country in the news,
    // where only its rough shape matters. Small islands drop out.
    const rough = simplify(outer, COARSE);
    if (rough.length >= 4 && area(rough) > COARSE * COARSE * 4) coarse.push(rough);
  }
  if (!largest) continue;
  // The frame is the main landmass, so Russia is not framed across the date
  // line by Chukotka, nor France by its overseas departments.
  const lons = largest.map(([lon]) => lon);
  const lats = largest.map(([, lat]) => lat);
  const box = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)].map(round);
  const centre = [round((box[0]! + box[2]!) / 2), round((box[1]! + box[3]!) / 2)];
  const d = pathOf(rings);
  const m = pathOf(medium);
  const c = pathOf(coarse);
  bytes += d.length + m.length + c.length;
  entries.push(`  ${iso}: { name: ${JSON.stringify(String(feature.properties.NAME_EN ?? feature.properties.NAME))}, box: [${box.join(", ")}], centre: [${centre.join(", ")}], d: ${JSON.stringify(d)}, m: ${JSON.stringify(m)}, c: ${JSON.stringify(c)} },`);
}

entries.sort();
writeFileSync(
  OUT,
  `/*
 * GENERATED by scripts/geo/build.mts from Natural Earth admin-0 countries, as
 * India depicts its borders (ne_10m_admin_0_countries_ind). Public domain.
 * Do not edit; run \`pnpm geo\`.
 *
 * d: the outline in degrees (x = longitude, y = -latitude), simplified.
 * m: a medium outline, for a card. c: a coarse one, for drawing it as a
 * neighbour (context only).
 * box: the main landmass [west, south, east, north]; centre: its middle.
 */
import "server-only";

export type CountryShape = { name: string; box: [number, number, number, number]; centre: [number, number]; d: string; m: string; c: string };

export const COUNTRY_SHAPES: Record<string, CountryShape> = {
${entries.join("\n")}
};
`,
);
console.log(`geo: wrote ${entries.length} countries, ${(bytes / 1024).toFixed(0)} KB of outline, to ${OUT}`);
