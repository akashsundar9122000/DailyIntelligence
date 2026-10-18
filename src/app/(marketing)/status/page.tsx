import type { Metadata } from "next";
import { connection } from "next/server";

import { ProsePage, ProseSection } from "@/components/marketing/prose";
import { Badge } from "@/components/ui/badge";
import { formatInstant, relativeTime } from "@/lib/format/date";
import { sourceStatus } from "@/lib/queries/source-status";

export const metadata: Metadata = { title: "Source status" };

const HEALTH_LABEL = { unknown: "Not yet run", healthy: "Reporting", degraded: "Slow or partial", failing: "Failing", stale: "Stale", disabled: "Switched off" } as const;

export default async function StatusPage() {
  await connection();
  const rows = await sourceStatus();
  const now = new Date();
  return (
    <ProsePage kicker="Trust" title="Source status" lead="When each source last answered, and how recent its newest item is. If a source goes quiet, it shows here first.">
      <ProseSection id="sources" title="Sources">
        {rows === null ? (
          <p>No database is connected, so there is nothing to report.</p>
        ) : rows.length === 0 ? (
          <p>No source has been registered yet. The first ingestion run registers every cleared source.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border font-sans">
            {rows.map((row) => (
              <li key={row.key} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline">
                <p className="font-semibold text-text-primary">{row.name}</p>
                <Badge tone={row.health === "failing" || row.health === "stale" ? "danger" : row.health === "healthy" ? "outline" : "neutral"}>{row.enabled ? HEALTH_LABEL[row.health] : HEALTH_LABEL.disabled}</Badge>
                <p className="text-sm text-text-secondary sm:col-span-2">
                  {row.lastSuccessAt ? (
                    <>
                      Last answered <time dateTime={row.lastSuccessAt} title={formatInstant(row.lastSuccessAt)}>{relativeTime(row.lastSuccessAt, now)}</time>
                    </>
                  ) : (
                    "Has not answered yet"
                  )}
                  {row.newestItemAt ? <> · newest item {relativeTime(row.newestItemAt, now)}</> : null} · asked every {Math.round(row.pollIntervalSeconds / 60)} min
                </p>
              </li>
            ))}
          </ul>
        )}
      </ProseSection>
    </ProsePage>
  );
}
