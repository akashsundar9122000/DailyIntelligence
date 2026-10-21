import { NextResponse, type NextRequest } from "next/server";

import { refuseUnlessScheduler, triggerOf } from "@/lib/http/cron";
import { runIllustrationJob } from "@/lib/services/illustrations";

export const maxDuration = 60;

/**
 * AI illustrations for the top stories (lib/services/illustrations.ts).
 * Called by the GitHub workflow after /api/cron/enrich, as its own request
 * with its own time budget: drawn on the AI pass's leftover time, they never
 * ran at all.
 *
 * GET and POST both, like the tick. Without the scheduler's secret: 401.
 */
async function handle(request: NextRequest) {
  const refused = refuseUnlessScheduler(request);
  if (refused) return refused;
  try {
    const { runId, detail } = await runIllustrationJob({ trigger: triggerOf(request), budgetMs: 50_000 });
    return NextResponse.json({ ok: true, runId, ...detail }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[illustrate]", error);
    else console.error("[illustrate] failed:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "The illustration pass failed. It is recorded in job_runs." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
