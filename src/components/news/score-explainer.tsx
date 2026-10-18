import type { StoryScore } from "@/lib/queries/stories";

const HEAT_PARTS: Record<string, string> = {
  velocity: "New reports this hour against its own recent pace",
  spread: "Independent publishers in the last six hours",
  recency: "How recently it last moved",
  engagement: "Public conversation (no permitted social source connected yet)",
  breadth: "How many countries it touches",
};
const CONFIDENCE_PARTS: Record<string, string> = {
  independent: "Independent publishers reporting it",
  primary: "An official record on file",
  settled: "Time for others to corroborate",
};

function Bars({ title, total, parts, labels, press }: { title: string; total: number; parts: Record<string, number>; labels: Record<string, string>; press?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between border-b-2 border-text-primary pb-1.5">
        <p className="kicker text-text-primary">{title}</p>
        <p className="font-display text-3xl font-black tabular-nums">{total}</p>
      </div>
      <dl className="space-y-2.5">
        {Object.entries(labels).map(([key, label]) => {
          const value = parts[key] ?? 0;
          return (
            <div key={key}>
              <dt className="flex justify-between gap-3 text-xs text-text-secondary">
                <span>{label}</span>
                <span className="tabular-nums">{Math.round(value / 10)}%</span>
              </dt>
              <dd className="mt-1 h-1.5 bg-surface-sunken" aria-hidden>
                <div className={press ? "h-full bg-press-solid" : "h-full bg-text-primary"} style={{ width: `${value / 10}%` }} />
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/**
 * Why a story is hot, and how well it is sourced, from the stored arithmetic
 * that produced each number (lib/ranking/scores.ts). Two panels, never one: a
 * story can be very hot and barely sourced, and the page shows both.
 */
export function ScoreExplainer({ score }: { score: StoryScore }) {
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      <Bars title="Why it is hot" total={score.heat} parts={score.heatComponents} labels={HEAT_PARTS} press />
      <Bars title="How well it is sourced" total={score.confidence} parts={score.confidenceComponents} labels={CONFIDENCE_PARTS} />
      <p className="text-xs text-text-tertiary sm:col-span-2">
        Heat measures attention, not truth. Scored by rules version {score.version}; every component above is stored with the score.
      </p>
    </div>
  );
}
