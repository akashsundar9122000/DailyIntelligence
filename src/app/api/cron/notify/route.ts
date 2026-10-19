import { NextResponse, type NextRequest } from "next/server";

import { refuseUnlessScheduler, triggerOf } from "@/lib/http/cron";
import { runNotify } from "@/lib/services/notify";

export const maxDuration = 60;

/**
 * The notification pass: alerts, scheduled briefings and the email digest,
 * each decided by the reader's own rules. The workflow's third step, after the
 * tick and the AI pass, so it sees the newest stories and the newest briefing.
 * Without the scheduler's secret: 401.
 */
async function handle(request: NextRequest) {
  const refused = refuseUnlessScheduler(request);
  if (refused) return refused;
  try {
    const { runId, detail } = await runNotify({ trigger: triggerOf(request), budgetMs: 45_000 });
    return NextResponse.json({ ok: true, runId, ...detail }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[notify]", error);
    else console.error("[notify] failed:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "The notification pass failed. It is recorded in job_runs." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
