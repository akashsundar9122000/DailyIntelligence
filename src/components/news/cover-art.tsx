import type { ReactNode } from "react";

import { between, pick, seeded } from "@/lib/media/seed";

/*
 * A story's cover when it has no photo, video, AI illustration or map: an
 * abstract drawing of its SECTION, arranged by its id.
 *
 * Every colour is a theme token (fill-accent, stroke-accent-2, …), so a cover
 * is violet light in Aurora, ink and sepia in Newspaper, amber on navy in
 * Terminal -- the drawing changes with the paper. The alert colour (press) is
 * never used: in art it would read as "breaking".
 *
 * Nothing in it depicts the event. It is labelled "Illustration" wherever it
 * appears, and hidden from assistive technology: the headline beside it says
 * what the story is.
 *
 * Drawn in a 320×200 box and cropped to the frame (slice), so one drawing
 * serves the 16:9 hero, the 16:10 card and the square thumbnail.
 */

const W = 320;
const H = 200;

type Draw = (next: () => number) => ReactNode;

const range = (count: number) => Array.from({ length: count }, (_, index) => index);

/** Soft light behind every motif, so no two covers sit on the same flat ground. */
function Ground({ next }: { next: () => number }) {
  return (
    <>
      <rect width={W} height={H} className="fill-surface-sunken" />
      <circle cx={between(next, 0, W)} cy={between(next, 0, H)} r={between(next, 90, 150)} className="fill-glow-1" opacity={0.35} />
      <circle cx={between(next, 0, W)} cy={between(next, 0, H)} r={between(next, 60, 120)} className="fill-glow-2" opacity={0.3} />
    </>
  );
}

/** A pitch with its creases and stumps, and the ball with its two seams. */
const cricket: Draw = (next) => {
  const x = pick(next, [80, 240]) + between(next, -20, 20);
  const y = between(next, 70, 130);
  return (
    <>
      <rect x={140} y={-10} width={40} height={220} className="fill-accent-subtle" />
      <line x1={140} x2={180} y1={40} y2={40} className="stroke-border-strong" strokeWidth={2} />
      <line x1={140} x2={180} y1={160} y2={160} className="stroke-border-strong" strokeWidth={2} />
      {[150, 160, 170].map((sx) => (
        <rect key={sx} x={sx - 1.5} y={22} width={3} height={18} className="fill-accent-2" />
      ))}
      <circle cx={x} cy={y} r={34} className="fill-accent" />
      <path d={`M${x - 20} ${y - 26} Q${x + 6} ${y} ${x - 20} ${y + 26}`} className="fill-none stroke-on-accent" strokeWidth={2} strokeDasharray="4 4" />
      <path d={`M${x + 20} ${y - 26} Q${x - 6} ${y} ${x + 20} ${y + 26}`} className="fill-none stroke-on-accent" strokeWidth={2} strokeDasharray="4 4" />
    </>
  );
};

const football: Draw = (next) => (
  <>
    <rect x={20} y={20} width={280} height={160} rx={4} className="fill-none stroke-border-strong" strokeWidth={2} />
    <line x1={160} x2={160} y1={20} y2={180} className="stroke-border-strong" strokeWidth={2} />
    <circle cx={160} cy={100} r={34} className="fill-none stroke-border-strong" strokeWidth={2} />
    <rect x={20} y={64} width={36} height={72} className="fill-none stroke-border-strong" strokeWidth={2} />
    <rect x={264} y={64} width={36} height={72} className="fill-none stroke-border-strong" strokeWidth={2} />
    <circle cx={between(next, 80, 240)} cy={between(next, 50, 150)} r={22} className="fill-accent" />
  </>
);

const sports: Draw = (next) => {
  const lanes = range(5);
  const highlight = Math.floor(next() * lanes.length);
  return (
    <>
      {lanes.map((lane) => (
        <rect
          key={lane}
          x={30 + lane * 12}
          y={30 + lane * 12}
          width={260 - lane * 24}
          height={140 - lane * 24}
          rx={70 - lane * 12}
          className={lane === highlight ? "fill-none stroke-accent" : "fill-none stroke-border-strong"}
          strokeWidth={lane === highlight ? 5 : 2}
        />
      ))}
      <circle cx={between(next, 60, 260)} cy={30 + highlight * 12} r={8} className="fill-accent-2" />
    </>
  );
};

/** A chamber of seats: rows of dots on concentric arcs, filled in two inks. */
const politics: Draw = (next) => {
  const split = between(next, 0.35, 0.65);
  const seats: ReactNode[] = [];
  range(6).forEach((row) => {
    const radius = 44 + row * 18;
    const count = 10 + row * 4;
    range(count).forEach((seat) => {
      const angle = Math.PI - (seat / (count - 1)) * Math.PI;
      const share = seat / (count - 1);
      seats.push(
        <circle
          key={`${row}-${seat}`}
          cx={160 + Math.cos(angle) * radius}
          cy={182 - Math.sin(angle) * radius}
          r={4.2}
          className={share < split ? "fill-accent" : next() > 0.15 ? "fill-accent-2" : "fill-border-strong"}
        />,
      );
    });
  });
  return <>{seats}</>;
};

/** Candlesticks on a random walk, with the closing line drawn through them. */
const business: Draw = (next) => {
  let price = between(next, 80, 120);
  const bars = range(16).map((index) => {
    const open = price;
    price = Math.max(30, Math.min(170, price + between(next, -18, 18)));
    return { x: 22 + index * 18, open, close: price, high: Math.min(open, price) - between(next, 4, 14), low: Math.max(open, price) + between(next, 4, 14) };
  });
  return (
    <>
      {bars.map((bar) => (
        <g key={bar.x}>
          <line x1={bar.x} x2={bar.x} y1={bar.high} y2={bar.low} className="stroke-text-tertiary" strokeWidth={1.5} />
          <rect
            x={bar.x - 5}
            y={Math.min(bar.open, bar.close)}
            width={10}
            height={Math.max(3, Math.abs(bar.close - bar.open))}
            className={bar.close <= bar.open ? "fill-accent" : "fill-accent-2"}
          />
        </g>
      ))}
      <polyline points={bars.map((bar) => `${bar.x},${bar.close}`).join(" ")} className="fill-none stroke-accent" strokeWidth={2} opacity={0.6} />
    </>
  );
};

const startups: Draw = (next) => (
  <>
    {range(7).map((index) => {
      const height = 20 + index * 20 + between(next, -6, 6);
      return <rect key={index} x={30 + index * 34} y={180 - height} width={22} height={height} rx={3} className={index === 6 ? "fill-accent" : "fill-accent-subtle"} />;
    })}
    <path d={`M30 170 Q170 ${between(next, 120, 160)} 290 20`} className="fill-none stroke-accent-2" strokeWidth={3} strokeDasharray="2 7" strokeLinecap="round" />
    <circle cx={290} cy={20} r={9} className="fill-accent-2" />
  </>
);

/** A small network: three layers of nodes, a few paths through them lit. */
const ai: Draw = (next) => {
  const layers = [4, 6, 4].map((count, layer) => range(count).map((index) => ({ x: 60 + layer * 100, y: 100 + (index - (count - 1) / 2) * 30 })));
  const edges: ReactNode[] = [];
  layers.slice(0, -1).forEach((layer, depth) =>
    layer.forEach((from, a) =>
      layers[depth + 1]!.forEach((to, b) => {
        const lit = next() > 0.82;
        edges.push(
          <line key={`${depth}-${a}-${b}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={lit ? "stroke-accent" : "stroke-border-strong"} strokeWidth={lit ? 2.5 : 1} />,
        );
      }),
    ),
  );
  return (
    <>
      {edges}
      {layers.flat().map((node, index) => (
        <circle key={index} cx={node.x} cy={node.y} r={8} className={next() > 0.6 ? "fill-accent-2" : "fill-surface stroke-accent"} strokeWidth={2} />
      ))}
    </>
  );
};

/** Circuit traces: right-angled runs ending in pads. */
const technology: Draw = (next) => (
  <>
    {range(9).map((index) => {
      const y = 22 + index * 20;
      const turn = between(next, 60, 260);
      const rise = pick(next, [-20, 0, 20]);
      const lit = index % 3 === Math.floor(next() * 3);
      return (
        <g key={index}>
          <polyline points={`0,${y} ${turn},${y} ${turn + 20},${y + rise} ${W},${y + rise}`} className={lit ? "fill-none stroke-accent" : "fill-none stroke-border-strong"} strokeWidth={lit ? 2.5 : 1.5} />
          <circle cx={turn} cy={y} r={4} className={lit ? "fill-accent" : "fill-border-strong"} />
        </g>
      );
    })}
    <rect x={130} y={70} width={60} height={60} rx={6} className="fill-surface stroke-accent-2" strokeWidth={3} />
  </>
);

const science: Draw = (next) => {
  const cx = between(next, 120, 200);
  return (
    <>
      {[0, 60, 120].map((rotation, index) => (
        <ellipse
          key={rotation}
          cx={cx}
          cy={100}
          rx={90}
          ry={30}
          transform={`rotate(${rotation} ${cx} 100)`}
          className={index === 1 ? "fill-none stroke-accent-2" : "fill-none stroke-accent"}
          strokeWidth={2.5}
        />
      ))}
      <circle cx={cx} cy={100} r={14} className="fill-accent" />
      <circle cx={cx + 90} cy={100} r={6} className="fill-accent-2" />
    </>
  );
};

const space: Draw = (next) => {
  const px = between(next, 90, 230);
  return (
    <>
      {range(40).map((index) => (
        <circle key={index} cx={between(next, 0, W)} cy={between(next, 0, H)} r={between(next, 0.6, 1.8)} className="fill-text-tertiary" />
      ))}
      <circle cx={px} cy={100} r={between(next, 70, 90)} className="fill-none stroke-border-strong" strokeWidth={1.5} strokeDasharray="3 6" />
      <circle cx={px} cy={100} r={36} className="fill-accent" />
      <ellipse cx={px} cy={100} rx={62} ry={14} transform={`rotate(-18 ${px} 100)`} className="fill-none stroke-accent-2" strokeWidth={4} />
    </>
  );
};

/** A pulse across the frame, and a cross: health without a body in it. */
const health: Draw = (next) => {
  const base = between(next, 90, 120);
  const points = [`0,${base}`];
  for (let x = 20; x < W; x += 40) points.push(`${x},${base}`, `${x + 8},${base - between(next, 30, 60)}`, `${x + 14},${base + between(next, 20, 40)}`, `${x + 20},${base}`);
  return (
    <>
      <polyline points={points.join(" ")} className="fill-none stroke-accent" strokeWidth={3} strokeLinejoin="round" />
      <path d="M248 24h20v20h20v20h-20v20h-20v-20h-20v-20h20z" className="fill-accent-2" />
    </>
  );
};

/** Isobars round a low: wobbling closed lines, and the sun behind them. */
const climate: Draw = (next) => {
  const cx = between(next, 110, 210);
  return (
    <>
      <circle cx={between(next, 30, 290)} cy={between(next, 20, 60)} r={22} className="fill-accent-2" />
      {range(6).map((ring) => {
        const radius = 22 + ring * 20;
        const points = range(24).map((step) => {
          const angle = (step / 24) * Math.PI * 2;
          const wobble = radius + between(next, -6, 6);
          return `${(cx + Math.cos(angle) * wobble * 1.4).toFixed(1)},${(110 + Math.sin(angle) * wobble).toFixed(1)}`;
        });
        return <polygon key={ring} points={points.join(" ")} className={ring === 0 ? "fill-accent-subtle stroke-accent" : "fill-none stroke-accent"} strokeWidth={ring === 0 ? 3 : 1.5} opacity={1 - ring * 0.12} />;
      })}
    </>
  );
};

const gaming: Draw = (next) => (
  <>
    {range(10).flatMap((column) =>
      range(6).map((row) => {
        const roll = next();
        return roll > 0.55 ? (
          <rect key={`${column}-${row}`} x={20 + column * 28} y={16 + row * 28} width={24} height={24} rx={3} className={roll > 0.85 ? "fill-accent" : "fill-accent-subtle"} />
        ) : null;
      }),
    )}
    <path d="M250 120h14v-14h14v14h14v14h-14v14h-14v-14h-14z" className="fill-accent-2" />
  </>
);

const education: Draw = (next) => {
  let y = 180;
  return (
    <>
      {range(6).map((index) => {
        const height = between(next, 14, 24);
        const width = between(next, 120, 200);
        y -= height + 3;
        return <rect key={index} x={160 - width / 2 + between(next, -12, 12)} y={y} width={width} height={height} rx={2} className={index % 2 ? "fill-accent" : "fill-accent-2"} />;
      })}
    </>
  );
};

const lifestyle: Draw = (next) => (
  <>
    <circle cx={between(next, 110, 210)} cy={130} r={56} className="fill-accent-2" />
    {range(5).map((index) => (
      <path
        key={index}
        d={`M0 ${132 + index * 14} Q80 ${122 + index * 14 + between(next, -8, 8)} 160 ${132 + index * 14} T320 ${132 + index * 14} V200 H0 Z`}
        className={index % 2 ? "fill-accent" : "fill-accent-subtle"}
        opacity={0.55 + index * 0.08}
      />
    ))}
  </>
);

const cinema: Draw = (next) => (
  <>
    <g transform={`rotate(${between(next, -10, 10)} 160 100)`}>
      <rect x={-20} y={50} width={360} height={100} className="fill-ink" />
      {range(20).map((index) => (
        <g key={index}>
          <rect x={-14 + index * 18} y={56} width={10} height={8} rx={1.5} className="fill-surface" />
          <rect x={-14 + index * 18} y={136} width={10} height={8} rx={1.5} className="fill-surface" />
        </g>
      ))}
      {range(5).map((index) => (
        <rect key={index} x={-6 + index * 72} y={72} width={60} height={56} rx={2} className={index === 2 ? "fill-accent" : "fill-accent-subtle"} />
      ))}
      <path d="M152 86 L176 100 L152 114 Z" className="fill-on-accent" />
    </g>
  </>
);

/** No section: slow waves. */
const waves: Draw = (next) => (
  <>
    {range(6).map((index) => (
      <path
        key={index}
        d={`M0 ${50 + index * 22} C80 ${30 + index * 22 + between(next, -20, 20)} 240 ${70 + index * 22 + between(next, -20, 20)} 320 ${50 + index * 22}`}
        className={index % 2 ? "fill-none stroke-accent" : "fill-none stroke-accent-2"}
        strokeWidth={3}
      />
    ))}
  </>
);

const BY_SECTION: Record<string, Draw> = {
  cricket,
  football,
  sports,
  "india-politics": politics,
  "world-politics": politics,
  business,
  startups,
  ai,
  technology,
  science,
  space,
  health,
  climate,
  gaming,
  education,
  lifestyle,
  cinema,
};

export function CoverArt({ seed, section, className }: { seed: string; section: string | null; className?: string }) {
  const next = seeded(seed);
  const draw = BY_SECTION[section ?? ""] ?? waves;
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={className}>
      <Ground next={next} />
      {draw(next)}
    </svg>
  );
}
