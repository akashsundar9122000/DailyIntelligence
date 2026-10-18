import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SectionHead } from "@/components/news/edition";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { getSession } from "@/lib/auth/session";
import { formatInstant, relativeTime } from "@/lib/format/date";
import { adminOverview, isAdmin } from "@/lib/services/admin";

import { SourceSwitch } from "./source-switch";

export const metadata: Metadata = { title: "Administration" };

const HEALTH_TONE: Record<string, "outline" | "neutral" | "warning" | "danger"> = { healthy: "outline", unknown: "neutral", degraded: "warning", failing: "danger", stale: "warning", disabled: "neutral" };

/**
 * Operations: is every source answering, what did each run do, did the
 * scheduler run. For a confirmed administrator only; anyone else gets the
 * same 404 as a page that does not exist. Counts and bookkeeping, never
 * anything a reader saved, followed or read.
 */
export default async function AdminPage() {
  const session = await getSession();
  if (!(await isAdmin(session))) notFound();
  const now = new Date();
  const { sources, runs, jobs, counts } = await adminOverview(session);
  const lastTick = jobs.find((job) => job.job === "tick");

  return (
    <div className="mx-auto max-w-[var(--container)] space-y-10">
      <PageHeader kicker="Administration" title="The press room" description="Sources, runs and the scheduler, as they are now." />

      <dl className="grid grid-cols-2 gap-0 border-t-2 border-text-primary sm:grid-cols-4 lg:grid-cols-7">
        {[
          ["Stories", counts.stories],
          ["Updated today", counts.storiesDay],
          ["Items held", counts.items],
          ["Items today", counts.itemsDay],
          ["Readers", counts.readers],
          ["Open reports", counts.openReports],
          ["Mail failed (7 days)", counts.mailFailed],
        ].map(([label, value]) => (
          <div key={label} className="border-b border-r border-border p-4">
            <dt className="kicker text-text-tertiary">{label}</dt>
            <dd className="mt-1 font-display text-3xl font-black tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <p className={lastTick && Date.parse(lastTick.startedAt) > now.getTime() - 45 * 60_000 ? "text-sm text-text-secondary" : "border-l-[3px] border-warning bg-warning-subtle px-3 py-2 text-sm text-warning"}>
        {lastTick ? (
          <>
            The scheduler last ticked {relativeTime(lastTick.startedAt, now)} ({lastTick.trigger}, {lastTick.status.toLowerCase()}).
            {Date.parse(lastTick.startedAt) <= now.getTime() - 45 * 60_000 ? " That is longer than it should be: check the GitHub tick workflow." : ""}
          </>
        ) : (
          "The scheduler has never ticked. Check the GitHub tick workflow and its secrets."
        )}
      </p>

      <section aria-labelledby="sources-heading" className="space-y-3">
        <SectionHead id="sources-heading" kicker={`${sources.filter((source) => source.enabled).length} switched on`} title="Sources" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b-2 border-text-primary text-xs uppercase tracking-[0.06em] text-text-tertiary">
              <tr>
                <th className="py-2 pr-3 font-semibold">Source</th>
                <th className="py-2 pr-3 font-semibold">Health</th>
                <th className="py-2 pr-3 font-semibold">Last answered</th>
                <th className="py-2 pr-3 font-semibold">Newest item</th>
                <th className="py-2 pr-3 font-semibold">Items, 24h</th>
                <th className="py-2 pr-3 font-semibold">Next read</th>
                <th className="py-2 font-semibold">
                  <span className="sr-only">Switch</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sources.map((source) => (
                <tr key={source.id} className="align-top">
                  <td className="py-3 pr-3">
                    <p className="font-semibold">{source.name}</p>
                    <p className="text-xs text-text-tertiary">
                      {source.provider} · rights {source.rightsStatus.replace("_", " ")}
                      {source.disableReason ? ` · off: ${source.disableReason}` : ""}
                    </p>
                    {source.lastError ? <p className="mt-1 text-xs text-danger">Last error: {source.lastError}</p> : null}
                  </td>
                  <td className="py-3 pr-3">
                    <Badge tone={HEALTH_TONE[source.health] ?? "neutral"}>{source.health}</Badge>
                    {source.consecutiveFailures > 0 ? <p className="mt-1 text-xs text-text-tertiary">{source.consecutiveFailures} failures in a row</p> : null}
                  </td>
                  <td className="py-3 pr-3 tabular-nums">{source.lastSuccessAt ? <time dateTime={source.lastSuccessAt} title={formatInstant(source.lastSuccessAt)}>{relativeTime(source.lastSuccessAt, now)}</time> : "never"}</td>
                  <td className="py-3 pr-3 tabular-nums">{source.newestItemAt ? relativeTime(source.newestItemAt, now) : "—"}</td>
                  <td className="py-3 pr-3 tabular-nums">{source.itemsDay}</td>
                  <td className="py-3 pr-3 tabular-nums">{source.enabled ? (Date.parse(source.nextPollAt) <= now.getTime() ? "due now" : `in ${Math.max(1, Math.round((Date.parse(source.nextPollAt) - now.getTime()) / 60_000))} min`) : "—"}</td>
                  <td className="py-3 text-right">
                    <SourceSwitch sourceId={source.id} name={source.name} enabled={source.enabled} cleared={source.rightsStatus === "cleared"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="runs-heading" className="space-y-3">
        <SectionHead id="runs-heading" kicker="Newest first" title="Recent runs" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b-2 border-text-primary text-xs uppercase tracking-[0.06em] text-text-tertiary">
              <tr>
                <th className="py-2 pr-3 font-semibold">When</th>
                <th className="py-2 pr-3 font-semibold">Source</th>
                <th className="py-2 pr-3 font-semibold">Result</th>
                <th className="py-2 pr-3 font-semibold">Fetched</th>
                <th className="py-2 pr-3 font-semibold">New</th>
                <th className="py-2 pr-3 font-semibold">Already held</th>
                <th className="py-2 pr-3 font-semibold">Stories touched</th>
                <th className="py-2 font-semibold">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="py-2 pr-3 tabular-nums">{relativeTime(run.startedAt, now)}</td>
                  <td className="py-2 pr-3">{run.source}</td>
                  <td className="py-2 pr-3">
                    {run.status}
                    {run.error ? <span className="block text-xs text-danger">{run.error}</span> : null}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{run.fetched}</td>
                  <td className="py-2 pr-3 tabular-nums">{run.inserted}</td>
                  <td className="py-2 pr-3 tabular-nums">{run.duplicates}</td>
                  <td className="py-2 pr-3 tabular-nums">{run.clustered}</td>
                  <td className="py-2 tabular-nums">{run.durationMs === null ? "—" : `${(run.durationMs / 1000).toFixed(1)}s`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
