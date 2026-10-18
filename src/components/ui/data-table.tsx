import type { ReactNode } from "react";

import { cn } from "./cn";

export type Column<Row> = {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /** Right-align figures so their decimal points line up. */
  numeric?: boolean;
  /** Leave out of the phone layout. The first column is always kept. */
  hideOnPhone?: boolean;
};

/**
 * One data set, two layouts: a real <table> from `md`, a list of labelled cards
 * below it. A table squeezed onto a phone either scrolls sideways or truncates
 * the figures it exists to show.
 *
 * Both layouts are in the DOM and CSS picks one, so a test or a screen reader
 * finds each value twice. Query within `data-layout`.
 */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  className,
}: {
  /** Names the table for assistive technology. Not shown. */
  caption: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  className?: string;
}) {
  const [first, ...rest] = columns;
  if (!first) return null;

  return (
    <div className={className}>
      <div className="hidden md:block" data-layout="table">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn("px-4 py-[var(--pad-row)] font-medium text-text-secondary", column.numeric ? "text-right" : "text-left")}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-border last:border-b-0 hover:bg-surface-hover">
                {columns.map((column, index) => {
                  const Cell = index === 0 ? "th" : "td";
                  return (
                    <Cell
                      key={column.key}
                      scope={index === 0 ? "row" : undefined}
                      data-numeric={column.numeric ? "" : undefined}
                      className={cn("px-4 py-[var(--pad-row)] font-normal text-text-primary", column.numeric ? "text-right" : "text-left")}
                    >
                      {column.cell(row)}
                    </Cell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border md:hidden" data-layout="cards" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="space-y-2 px-4 py-3.5">
            <div className="text-sm font-medium text-text-primary">{first.cell(row)}</div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {rest
                .filter((column) => !column.hideOnPhone)
                .map((column) => (
                  <div key={column.key} className="min-w-0">
                    <dt className="text-xs text-text-secondary">{column.header}</dt>
                    <dd className="text-text-primary" data-numeric={column.numeric ? "" : undefined}>
                      {column.cell(row)}
                    </dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
