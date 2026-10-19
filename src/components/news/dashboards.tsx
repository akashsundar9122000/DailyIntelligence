import Link from "next/link";

import { categoryFor } from "@/config/categories";
import type { DayInNumbers, HeatmapCell, InterestActivity, ReadingNumbers } from "@/lib/queries/dashboards";

import { cn } from "../ui/cn";

/*
 * The dashboards: each a title, what it means, the period, the units, and the
 * numbers themselves in text -- a shade or a bar is never the only way a value
 * is shown, and every chart is readable as the table it is.
 */

function ChartHead({ title, meaning, period }: { title: string; meaning: string; period: string }) {
  return (
    <div className="space-y-0.5">
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="text-sm text-text-secondary">{meaning}</p>
      <p className="text-xs text-text-tertiary">{period}</p>
    </div>
  );
}

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

export function DayNumbers({ day }: { day: DayInNumbers }) {
  const figures: [string, number, string][] = [
    ["Stories", day.stories, "updated in the last day"],
    ["Publishers", day.publishers, "reported something"],
    ["Corroborated", day.corroborated, "had a second publisher"],
    ["Official", day.official, "include an official statement"],
  ];
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-0 border-t-2 border-rule sm:grid-cols-4">
        {figures.map(([label, value, note]) => (
          <div key={label} className="border-b border-r border-border p-4 last:border-r-0">
            <dt className="kicker text-text-tertiary">{label}</dt>
            <dd className="mt-1 font-display text-3xl font-black tabular-nums">{value}</dd>
            <dd className="text-xs text-text-tertiary">{note}</dd>
          </div>
        ))}
      </dl>
      <figure className="space-y-2">
        <ChartHead title="India and the world" meaning="Where this paper's stories of the last day happened. A share of what we hold, not of all the news." period="Last 24 hours · stories" />
        {day.stories ? (
          <>
            <div className="flex h-6 w-full overflow-hidden border border-border-strong" aria-hidden>
              <div className="bg-ink" style={{ width: `${pct(day.india, day.stories)}%` }} />
              <div className="bg-surface-sunken" style={{ width: `${pct(day.global, day.stories)}%` }} />
            </div>
            <figcaption className="flex justify-between text-sm">
              <span>
                <span className="mr-1.5 inline-block size-3 border border-border-strong bg-ink align-middle" aria-hidden />
                India: <strong className="tabular-nums">{day.india}</strong> ({pct(day.india, day.stories)}%)
              </span>
              <span>
                <span className="mr-1.5 inline-block size-3 border border-border-strong bg-surface-sunken align-middle" aria-hidden />
                World: <strong className="tabular-nums">{day.global}</strong> ({pct(day.global, day.stories)}%)
              </span>
            </figcaption>
          </>
        ) : (
          <p className="text-sm text-text-secondary">No story was updated in the last day.</p>
        )}
      </figure>
    </div>
  );
}

const WINDOWS = ["18–24 hours ago", "12–18 hours ago", "6–12 hours ago", "Last 6 hours"];
/* Written out in full: Tailwind generates only class names it can read in the source. */
const SHADES = ["bg-transparent", "bg-ink/15", "bg-ink/35", "bg-ink/60", "bg-ink"];

export function TopicHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const totals = new Map<string, number>();
  for (const cell of cells) totals.set(cell.category, (totals.get(cell.category) ?? 0) + cell.stories);
  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([category]) => category);
  const max = Math.max(1, ...cells.map((cell) => cell.stories));
  const value = (category: string, window: number) => cells.find((cell) => cell.category === category && cell.window === window)?.stories ?? 0;
  return (
    <figure className="space-y-3">
      <ChartHead title="Sections through the day" meaning="New stories in each section, in six-hour windows. The stronger the shade, the more; every value is written in its cell." period="Last 24 hours · stories first seen" />
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <caption className="sr-only">New stories by section and six-hour window, last 24 hours</caption>
            <thead>
              <tr className="border-b border-border-strong text-left text-xs text-text-tertiary">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Section
                </th>
                {WINDOWS.map((label) => (
                  <th key={label} scope="col" className="px-2 py-2 font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((category) => (
                <tr key={category}>
                  <th scope="row" className="py-2 pr-3 text-left font-medium">
                    <Link href={`/app/categories/${category}`} className="hover:underline">
                      {categoryFor(category)?.label ?? category}
                    </Link>
                  </th>
                  {[0, 1, 2, 3].map((window) => {
                    const count = value(category, window);
                    // A logarithmic scale: one busy section (arXiv's hundreds of preprints) must not flatten every other into one shade.
                    const shade = count === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((Math.log1p(count) / Math.log1p(max)) * 4)));
                    return (
                      <td key={window} className="px-2 py-2">
                        <span className="flex items-center gap-2 tabular-nums">
                          <span className={cn("inline-block h-4 w-8 border border-border", SHADES[shade])} aria-hidden />
                          {count}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-text-secondary">No section had a new story in the last day.</p>
      )}
    </figure>
  );
}

export function InterestStrip({ activity }: { activity: InterestActivity[] }) {
  if (activity.length === 0) return null;
  return (
    <section aria-labelledby="your-sections" className="space-y-2 border border-border-strong p-4">
      <h2 id="your-sections" className="kicker text-text-tertiary">
        Your sections, last day
      </h2>
      <ul className="divide-y divide-border">
        {activity.map((entry) => (
          <li key={entry.value} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <Link href={`/app/categories/${entry.value}`} className="font-medium hover:underline">
              {categoryFor(entry.value)?.label ?? entry.label}
            </Link>
            <span className="tabular-nums text-text-secondary">
              {entry.stories} {entry.stories === 1 ? "story" : "stories"}
              {entry.hot ? ` · ${entry.hot} hot` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReadingStrip({ numbers }: { numbers: ReadingNumbers }) {
  const figures: [string, string][] = [
    ["Saved", String(numbers.saved)],
    ["Not yet read", String(numbers.unread)],
    ["Collections", String(numbers.collections)],
    ["Opened this week", numbers.historyOn ? String(numbers.readWeek) : "off"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-0 border-y border-border sm:grid-cols-4" aria-label="Your reading">
      {figures.map(([label, value]) => (
        <div key={label} className="border-r border-border p-3 last:border-r-0">
          <dt className="kicker text-text-tertiary">{label}</dt>
          <dd className="mt-0.5 font-display text-2xl font-black tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
