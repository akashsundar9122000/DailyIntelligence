import "server-only";

import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { execRows, withSystem } from "@/lib/db/scope";
import { isoInstant } from "@/lib/db/sql";

/**
 * Run a background job with a record of having run.
 *
 * The row is written RUNNING before the work and closed after it, in separate
 * transactions. A job that only reports when it finds something looks the same
 * as one that has stopped; with this, a stopped job is a gap in the table and a
 * crashed one is a row that never closed.
 */
export async function recordedJob<T extends Record<string, unknown>>(job: string, trigger: string, work: () => Promise<T>): Promise<{ runId: string; detail: T }> {
  const runId = uuidv7();
  await withSystem(`job.open:${job}`, (tx) => tx.execute(sql`insert into job_runs (id, job, trigger) values (${runId}::uuid, ${job}, ${trigger})`));
  try {
    const detail = await work();
    await withSystem(`job.close:${job}`, (tx) =>
      tx.execute(sql`update job_runs set status = 'OK', finished_at = now(), detail = ${JSON.stringify(detail)}::jsonb where id = ${runId}::uuid`),
    );
    return { runId, detail };
  } catch (error) {
    const reason = error instanceof Error ? error.name : "Error";
    await withSystem(`job.fail:${job}`, (tx) =>
      tx.execute(sql`update job_runs set status = 'FAILED', finished_at = now(), error = ${reason} where id = ${runId}::uuid`),
    ).catch(() => undefined);
    throw error;
  }
}

export type JobHealth = { job: string; lastStartedAt: string | null; lastStatus: string | null; hoursSinceLastRun: number | null; healthy: boolean };

/** Whether a job has run recently enough. A job with no run at all is unhealthy, not "nothing to report". */
export async function jobHealth(job: string, maxHours: number, now: Date = new Date()): Promise<JobHealth> {
  const rows = await withSystem("job.health", (tx) =>
    execRows<{ started: string; status: string }>(
      tx,
      sql`select ${isoInstant(sql`started_at`)} as started, status from job_runs where job = ${job} order by job_runs.started_at desc limit 1`,
    ),
  );
  const last = rows[0];
  if (!last) return { job, lastStartedAt: null, lastStatus: null, hoursSinceLastRun: null, healthy: false };
  const hours = (now.getTime() - Date.parse(last.started)) / 3_600_000;
  return {
    job,
    lastStartedAt: last.started,
    lastStatus: last.status,
    hoursSinceLastRun: Math.round(hours * 10) / 10,
    // A run still RUNNING after this long has crashed; a FAILED one is not health.
    healthy: hours <= maxHours && last.status === "OK",
  };
}
