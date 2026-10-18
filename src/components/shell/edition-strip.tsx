import Link from "next/link";

import { formatClock, formatDateline, relativeTime } from "@/lib/format/date";
import type { EditionStatus } from "@/lib/queries/edition";

/**
 * The line under the top bar: today's date, and how fresh the paper actually
 * is. Every figure here is read from the sources' records. With nothing
 * fetched yet it says so -- it never prints the time the page was drawn as if
 * it were the time the news arrived.
 */
export function EditionStrip({ status, now }: { status: EditionStatus; now: Date }) {
  const today = now.toISOString();
  return (
    <>
      <span className="kicker shrink-0 text-text-primary">
        <span className="hidden sm:inline">{formatDateline(today)}</span>
        <span className="sm:hidden">{formatDateline(today).replace(/^\w+, /, "")}</span>
      </span>
      <span aria-hidden className="h-4 w-px shrink-0 bg-border-strong" />
      {!status.available ? (
        <span className="shrink-0 text-text-secondary">No database connected</span>
      ) : status.updatedAt ? (
        <span className="shrink-0 text-text-secondary">
          Updated <time dateTime={status.updatedAt}>{formatClock(status.updatedAt)} IST</time>
          <span className="hidden sm:inline"> · {relativeTime(status.updatedAt, now)}</span>
        </span>
      ) : (
        <span className="min-w-0 truncate text-text-secondary">No source has reported yet</span>
      )}
      {status.available && status.sources > 0 ? (
        <>
          <span aria-hidden className="hidden h-4 w-px shrink-0 bg-border-strong md:block" />
          <Link href="/sources" className="hidden shrink-0 text-text-secondary underline-offset-4 hover:text-text-primary hover:underline md:inline">
            {status.healthy} of {status.sources} sources reporting
          </Link>
        </>
      ) : null}
    </>
  );
}
