import { NextResponse, type NextRequest } from "next/server";

import { refuseUnlessScheduler, triggerOf } from "@/lib/http/cron";
import { runEnrichment } from "@/lib/services/enrichment";

export const maxDuration = 60;

/**
 * The AI pass: explainers for the stories that are due, and the edition
 * briefing when its slot comes round. Called by the GitHub workflow right
 * after /api/cron/tick, as a separate request so each has its own time budget:
 * a slow model never costs the paper a reading of its sources.
 *
 * GET and POST both, like the tick. Without the scheduler's secret: 401.
 */
async function handle(request: NextRequest) {
  const refused = refuseUnlessScheduler(request);
  if (refused) return refused;
  try {
    const { runId, detail } = await runEnrichment({ trigger: triggerOf(request), budgetMs: 50_000 });
    return NextResponse.json({ ok: true, runId, ...detail }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[enrich]", error);
    else console.error("[enrich] failed:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "The AI pass failed. It is recorded in job_runs." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
