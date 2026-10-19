import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SectionHead } from "@/components/news/edition";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { getSession } from "@/lib/auth/session";
import { formatInstant, relativeTime } from "@/lib/format/date";
import { adminNotifications, adminOverview, isAdmin } from "@/lib/services/admin";
import { listSwitches } from "@/lib/services/ops";

import { DryRunButton, OpsSwitch, TestSend } from "./ops-controls";
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
  const [notifications, switches] = await Promise.all([adminNotifications(session), listSwitches()]);
  const lastTick = jobs.find((job) => job.job === "tick");
  const attention = sources.filter((source) => source.enabled && (source.health !== "healthy" || source.circuitOpenUntil));
  const failedRuns = runs.filter((run) => run.status === "failed" || run.status === "partial");

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

      <section aria-labelledby="switches-heading" className="space-y-3">
        <SectionHead id="switches-heading" kicker="No deploy needed" title="Switches" />
        <ul className="divide-y divide-border border-y border-border">
          {switches.map((entry) => (
            <li key={entry.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {entry.label} <Badge tone={entry.enabled ? "outline" : "danger"}>{entry.enabled ? "on" : "off"}</Badge>
                </p>
                <p className="text-xs text-text-tertiary">
                  {entry.detail}
                  {entry.changedAt ? ` Changed ${relativeTime(entry.changedAt, now)}${entry.reason ? `: ${entry.reason}` : ""}.` : ""}
                </p>
              </div>
              <OpsSwitch switchKey={entry.key} label={entry.label} enabled={entry.enabled} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="attention-heading" className="space-y-3">
        <SectionHead id="attention-heading" kicker="Dead letters and stale feeds" title="Needs attention" />
        {attention.length === 0 && failedRuns.length === 0 ? (
          <p className="text-sm text-text-secondary">Every switched-on source is healthy, and none of the last 40 runs failed.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {attention.map((source) => (
              <li key={source.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">
                    {source.name} <Badge tone={HEALTH_TONE[source.health] ?? "neutral"}>{source.health}</Badge>
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {source.health === "stale" ? `Answering, but nothing new since ${source.newestItemAt ? relativeTime(source.newestItemAt, now) : "ever"}.` : source.lastError ?? "Failing."}
                    {source.circuitOpenUntil ? ` Paused by the circuit breaker until ${formatInstant(source.circuitOpenUntil)}.` : ""}
                  </p>
                </div>
                <DryRunButton sourceId={source.id} name={source.name} />
              </li>
            ))}
            {failedRuns.map((run) => (
              <li key={run.id} className="py-3 text-sm">
                <span className="font-semibold">{run.source}</span> · {run.status} {relativeTime(run.startedAt, now)}
                {run.quarantined ? ` · ${run.quarantined} items set aside` : ""}
                {run.error ? <span className="text-danger"> · {run.error}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="notifications-heading" className="space-y-3">
        <SectionHead id="notifications-heading" kicker="The last day, in counts" title="Notifications" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">
            {notifications.optedIn} {notifications.optedIn === 1 ? "reader has" : "readers have"} switched something on; {notifications.devices} {notifications.devices === 1 ? "device" : "devices"} can receive push.{" "}
            {notifications.byStatus.length ? notifications.byStatus.map((row) => `${row.count} ${row.status}`).join(", ") : "Nothing considered in the last day"}.
            {notifications.lastRun ? ` Last pass ${relativeTime(notifications.lastRun.startedAt, now)} (${notifications.lastRun.status.toLowerCase()}).` : " The notification pass has not run yet."}
          </p>
          <TestSend />
        </div>
      </section>

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
