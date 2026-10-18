import { NextResponse, type NextRequest } from "next/server";

import { runTick } from "@/lib/ingestion/pipeline";
import { refuseUnlessScheduler, triggerOf } from "@/lib/http/cron";

export const maxDuration = 60;

/**
 * The fifteen-minute tick: read every due source, cluster, score. Called by
 * the GitHub workflow (.github/workflows/tick.yml) with the scheduler's
 * secret. Without it the answer is 401 and nothing is read or written, which
 * is what the production smoke test checks.
 *
 * GET and POST both: a scheduler that can only GET still works, and a person
 * running it by hand from a terminal can POST.
 */
async function handle(request: NextRequest) {
  const refused = refuseUnlessScheduler(request);
  if (refused) return refused;
  try {
    const { runId, detail } = await runTick({ trigger: triggerOf(request), budgetMs: 50_000 });
    return NextResponse.json(
      {
        ok: true,
        runId,
        rescored: detail.rescored,
        sources: detail.sources.map(({ source, status, fetched, inserted, duplicates, clustered, error }) => ({ source, status, fetched, inserted, duplicates, clustered, error })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // The whole error on a developer's own console only; a deployment logs the kind and nothing that could carry data.
    if (process.env.NODE_ENV !== "production") console.error("[tick]", error);
    else console.error("[tick] failed:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "The tick failed. It is recorded in job_runs." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
