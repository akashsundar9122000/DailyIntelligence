import { INDIAN_STATES } from "@/config/regions";
import { COUNTRY_SHAPES } from "@/lib/media/geo/countries";
import { STATE_PINS } from "@/lib/media/geo/states";

/**
 * Where a story happened: the country in the news, its neighbours for
 * context, and a pin for each Indian state the story names.
 *
 * Drawn from Natural Earth's India-view boundaries (lib/media/geo), in
 * degrees, cropped to a window round the country -- only the neighbours that
 * fall in that window are drawn, and only in coarse outline, so a card map
 * costs a few kilobytes, not a world. Colour is theme tokens throughout.
 *
 * `detail`: "fine" for the story page's hero, "card" for cards, "thumb" for an
 * 80px thumbnail -- the country alone in coarse outline, and its pins, since
 * neighbours at that size are noise and weight.
 */
export function PlaceMap({ focus, pins, detail = "card", aspect = 1.6, className }: { focus: string; pins: string[]; detail?: "fine" | "card" | "thumb"; aspect?: number; className?: string }) {
  const shape = COUNTRY_SHAPES[focus];
  if (!shape) return null;

  const [west, south, east, north] = shape.box;
  // The window: the country's main landmass with a margin, at the frame's
  // shape, and never so tight a small country fills it edge to edge.
  const span = Math.max(east - west, (north - south) * aspect, 8);
  const width = span * 1.45;
  const height = width / aspect;
  const cx = (west + east) / 2;
  const cy = -(south + north) / 2;
  const box = { x: cx - width / 2, y: cy - height / 2, w: width, h: height };

  // A neighbour is drawn when a real part of it is in the window: one that
  // only grazes an edge (Russia, from India) costs kilobytes and shows a sliver.
  const neighbours =
    detail === "thumb"
      ? []
      : Object.entries(COUNTRY_SHAPES).filter(([code, country]) => {
          if (code === focus || !country.c) return false;
          const [w, s, e, n] = country.box;
          const overlapX = Math.min(e, box.x + box.w) - Math.max(w, box.x);
          const overlapY = Math.min(-s, box.y + box.h) - Math.max(-n, box.y);
          return overlapX > 0 && overlapY > 0 && (overlapX * overlapY) / (box.w * box.h) >= 0.02;
        });

  const scale = width / 320;
  // A small window shows a small country closely: its fine outline, and its
  // neighbours at card detail, or they turn to shards at that zoom.
  const close = width < 25;
  const focusPath = detail === "thumb" ? shape.c || shape.m || shape.d : detail === "fine" || close ? shape.d : shape.m || shape.d;
  const step = close ? 2 : width < 60 ? 5 : 10;
  const lines: number[] = [];
  for (let at = Math.ceil(box.x / step) * step; at < box.x + box.w; at += step) lines.push(at);
  const rows: number[] = [];
  for (let at = Math.ceil(box.y / step) * step; at < box.y + box.h; at += step) rows.push(at);
  const names = pins.map((code) => INDIAN_STATES.find((state) => state.code === code)?.label).filter(Boolean);
  const label = names.length ? `Map of ${shape.name} marking ${names.join(", ")}` : `Map of ${shape.name} and its neighbours`;

  return (
    <svg role="img" aria-label={label} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} preserveAspectRatio="xMidYMid slice" className={className}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} className="fill-surface-sunken" />
      {/* A graticule, as on a printed map, so the sea is not a blank. */}
      {detail === "thumb"
        ? null
        : [
            ...lines.map((x) => <line key={`x${x}`} x1={x} x2={x} y1={box.y} y2={box.y + box.h} className="stroke-border" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />),
            ...rows.map((y) => <line key={`y${y}`} x1={box.x} x2={box.x + box.w} y1={y} y2={y} className="stroke-border" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />),
          ]}
      <circle cx={shape.centre[0]} cy={-shape.centre[1]} r={Math.max(east - west, north - south) * 0.75} className="fill-glow-1" opacity={0.3} />
      {neighbours.map(([code, country]) => (
        <path key={code} d={close ? country.m || country.c : country.c} className="fill-surface stroke-border-strong" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
      ))}
      {shape.d ? (
        <path d={focusPath} className="fill-accent stroke-accent" fillOpacity={0.35} strokeWidth={1.75} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      ) : (
        // Too small to outline at this scale (the Maldives, Monaco): mark it.
        <circle cx={shape.centre[0]} cy={-shape.centre[1]} r={6 * scale} className="fill-accent" />
      )}
      {pins.map((code) => {
        const at = STATE_PINS[code];
        if (!at) return null;
        return (
          <g key={code}>
            <circle cx={at[0]} cy={-at[1]} r={9 * scale} className="fill-accent-2" opacity={0.25} />
            <circle cx={at[0]} cy={-at[1]} r={4.5 * scale} className="fill-accent-2 stroke-surface" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}
    </svg>
  );
}
