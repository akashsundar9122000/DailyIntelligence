import type { ReactNode } from "react";

import { cn } from "./cn";

/**
 * A page's head, set like a section front: an optional kicker, the title in
 * the display serif, a dek beneath it, and a thick rule closing the block.
 */
export function PageHeader({
  title,
  kicker,
  description,
  actions,
  className,
}: {
  title: string;
  kicker?: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 border-b-2 border-text-primary pb-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1.5">
        {kicker ? <p className="kicker text-text-tertiary">{kicker}</p> : null}
        <h1 className="text-3xl font-bold leading-[1.1] text-text-primary sm:text-4xl">{title}</h1>
        {description ? <p className="dek max-w-[64ch] text-base sm:text-lg">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

/** A label and its value, for details panels. A missing value is shown as missing, never as zero. */
export function KeyValue({ label, children, numeric = true }: { label: string; children: ReactNode; /** False for words and identifiers: tabular figures space an identifier's digits apart. */ numeric?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2.5">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium text-text-primary" data-numeric={numeric ? "" : undefined}>
        {children}
      </dd>
    </div>
  );
}
