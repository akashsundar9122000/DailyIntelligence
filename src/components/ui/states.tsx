/**
 * Empty, loading and error states as real primitives.
 *
 * Ship these on day one. A screen without them gets a bare spinner and a blank
 * div, and those are the screens that look unfinished in a screenshot.
 *
 * A skeleton's height MUST match its real component -- that is a layout
 * invariant no layer but a component test can see, and getting it wrong makes
 * every page jump as it loads.
 */
import type { ReactNode } from "react";

import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-hover", className)} aria-hidden />;
}

export function LoadingState({ label = "Loading", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  /** Say what this screen is FOR, not that it is empty. "Add a fund to start
   *  tracking it" beats "No funds found". */
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-12 text-center">
      {icon ? (
        <div className="text-text-tertiary" aria-hidden>
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-medium text-text-primary">{title}</h3>
      <p className="max-w-[46ch] text-sm text-text-secondary">{description}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "That did not work",
  description,
  retry,
  reference,
}: {
  title?: string;
  description: string;
  retry?: ReactNode;
  /** A short reference a person can quote to support. Never the raw error --
   *  a database message carries column names and occasionally data. */
  reference?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-danger-subtle bg-danger-subtle px-6 py-10 text-center"
    >
      <h3 className="text-base font-medium text-text-primary">{title}</h3>
      <p className="max-w-[46ch] text-sm text-text-secondary">{description}</p>
      {reference ? <p className="font-mono text-xs text-text-secondary">Reference {reference}</p> : null}
      {retry ? <div className="pt-1">{retry}</div> : null}
    </div>
  );
}
