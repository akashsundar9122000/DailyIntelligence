import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SectionHead } from "@/components/news/edition";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { getSession } from "@/lib/auth/session";
import { formatInstant, relativeTime } from "@/lib/format/date";
import { env } from "@/lib/env";
import { adminAi, adminNotifications, adminOverview, heldExplainers, isAdmin, openReports, possibleDuplicates } from "@/lib/services/admin";
import { listSwitches } from "@/lib/services/ops";

import { DryRunButton, MergeButton, OpsSwitch, ResolveReport, ReviewControls, TestSend } from "./ops-controls";
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
  const [notifications, switches, reports, duplicates, ai, held] = await Promise.all([
    adminNotifications(session),
    listSwitches(),
    openReports(session),
    possibleDuplicates(session),
    adminAi(session),
    heldExplainers(session),
  ]);
  const reviewing = env().EDITORIAL_REVIEW === "1";
  const lastTick = jobs.find((job) => job.job === "tick");
  const attention = sources.filter((source) => source.enabled && (source.health !== "healthy" || source.circuitOpenUntil));
  const failedRuns = runs.filter((run) => run.status === "failed" || run.status === "partial");

  return (
    <div className="mx-auto max-w-[var(--container)] space-y-10">
      <PageHeader kicker="Administration" title="The press room" description="Sources, runs and the scheduler, as they are now." />

      <dl className="grid grid-cols-2 gap-0 border-t-2 border-rule sm:grid-cols-4 lg:grid-cols-7">
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

      <TickNote lastTick={lastTick} now={now} />

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

      <section aria-labelledby="review-heading" className="space-y-3">
        <SectionHead id="review-heading" kicker={reviewing ? "High impact or thinly sourced: held until approved" : "Off: explainers publish once they pass their checks"} title={`Editorial review (${held.length})`} />
        {held.length ? (
          <ul className="divide-y divide-border border-y border-border">
            {held.map((entry) => (
              <li key={entry.id} className="space-y-2 py-3">
                <p className="text-sm">
                  <a href={`/app/story/${entry.storyId}`} className="font-semibold hover:underline">
                    {entry.headline}
                  </a>
                  <span className="text-xs text-text-tertiary">
                    {" "}
                    · importance {entry.importance} · sourced {entry.confidence} · {entry.model}, {relativeTime(entry.generatedAt, now)}
                  </span>
                </p>
                <blockquote className="border-l-[3px] border-border-strong pl-3 font-serif text-base">{entry.oneMinute.map((claim) => `${claim.text} [${claim.cites.map((ref) => ref.slice(1)).join(", ")}]`).join(" ")}</blockquote>
                <ReviewControls id={entry.id} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">{reviewing ? "Nothing is waiting." : "Set EDITORIAL_REVIEW=1 to hold explainers for high-impact or thinly sourced stories until an editor approves them."}</p>
        )}
      </section>

      <section aria-labelledby="reports-heading" className="space-y-3">
        <SectionHead id="reports-heading" kicker="Oldest first" title={`Readers' reports (${reports.length})`} />
        {reports.length ? (
          <ul className="divide-y divide-border border-y border-border">
            {reports.map((report) => (
              <li key={report.id} className="space-y-2 py-3">
                <p className="text-sm">
                  <Badge tone="warning">{report.reason.replace("_", " ")}</Badge>{" "}
                  {report.storyId ? (
                    <a href={`/app/story/${report.storyId}`} className="font-semibold underline-offset-4 hover:underline">
                      {report.headline}
                    </a>
                  ) : (
                    <span className="text-text-tertiary">a story since removed</span>
                  )}{" "}
                  <span className="text-xs text-text-tertiary">· {relativeTime(report.createdAt, now)}</span>
                </p>
                {report.detail ? <p className="text-sm text-text-secondary">&ldquo;{report.detail}&rdquo;</p> : null}
                <ResolveReport reportId={report.id} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">No open reports.</p>
        )}
      </section>

      <section aria-labelledby="duplicates-heading" className="space-y-3">
        <SectionHead id="duplicates-heading" kicker="Close in meaning, last two days" title="Possible duplicate stories" />
        {duplicates.length ? (
          <ul className="divide-y divide-border border-y border-border">
            {duplicates.map((pair) => (
              <li key={`${pair.keepId}-${pair.mergeId}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0 space-y-1">
                  <p>
                    <span className="text-xs text-text-tertiary">Keep ({pair.keepSources} publishers): </span>
                    <a href={`/app/story/${pair.keepId}`} className="font-semibold hover:underline">
                      {pair.keepHeadline}
                    </a>
                  </p>
                  <p>
                    <span className="text-xs text-text-tertiary">Merge ({pair.mergeSources}): </span>
                    <a href={`/app/story/${pair.mergeId}`} className="hover:underline">
                      {pair.mergeHeadline}
                    </a>
                    <span className="text-xs text-text-tertiary"> · distance {pair.distance}</span>
                  </p>
                </div>
                <MergeButton keepId={pair.keepId} mergeId={pair.mergeId} keepHeadline={pair.keepHeadline} mergeHeadline={pair.mergeHeadline} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">No pair of recent stories is close enough in meaning to suggest.</p>
        )}
      </section>

      <section aria-labelledby="ai-heading" className="space-y-2">
        <SectionHead id="ai-heading" kicker="The last day, in counts" title="The AI pass" />
        <p className="text-sm text-text-secondary">
          {ai.byStatus.length ? ai.byStatus.map((row) => `${row.count} ${row.status}`).join(", ") : "No model output in the last day"}; {ai.tokens.toLocaleString("en-IN")} tokens; {ai.embedded} headlines embedded for search by meaning.
        </p>
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
            <thead className="border-b-2 border-rule text-xs uppercase tracking-[0.06em] text-text-tertiary">
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
            <thead className="border-b-2 border-rule text-xs uppercase tracking-[0.06em] text-text-tertiary">
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

/** When the scheduler last ran. A plain line while it is on time; a warning once it is not, or never was. */
function TickNote({ lastTick, now }: { lastTick: { startedAt: string; trigger: string; status: string } | null | undefined; now: Date }) {
  if (!lastTick) return <Alert tone="warning">The scheduler has never ticked. Check the GitHub tick workflow and its secrets.</Alert>;
  const line = `The scheduler last ticked ${relativeTime(lastTick.startedAt, now)} (${lastTick.trigger}, ${lastTick.status.toLowerCase()}).`;
  if (Date.parse(lastTick.startedAt) > now.getTime() - 45 * 60_000) return <p className="text-sm text-text-secondary">{line}</p>;
  return <Alert tone="warning">{line} That is longer than it should be: check the GitHub tick workflow.</Alert>;
}
