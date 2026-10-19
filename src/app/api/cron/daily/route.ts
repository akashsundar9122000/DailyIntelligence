import { NextResponse, type NextRequest } from "next/server";

import { refuseUnlessScheduler, triggerOf } from "@/lib/http/cron";
import { flushMail } from "@/lib/mail/send";
import { recordedJob } from "@/lib/services/jobs";
import { runRetention } from "@/lib/services/retention";

export const maxDuration = 60;

/**
 * The daily backstop, scheduled by Vercel (vercel.json). The frequent work --
 * ingestion, clustering, scoring -- is driven every fifteen minutes by the
 * GitHub workflow calling /api/cron/tick; this exists so that a day on which
 * that workflow is delayed or disabled still delivers queued mail and leaves a
 * record that something ran.
 */
export async function GET(request: NextRequest) {
  const refused = refuseUnlessScheduler(request);
  if (refused) return refused;
  try {
    const { runId, detail } = await recordedJob("daily", triggerOf(request), async () => {
      const mail = await flushMail();
      // The purge records its own run (job "retention"), so a day it did not run is a gap in job_runs.
      const { detail: purged } = await runRetention({ trigger: triggerOf(request) });
      return { mail, purged };
    });
    return NextResponse.json({ ok: true, runId, ...detail }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "The daily job failed. It is recorded in job_runs." }, { status: 500 });
  }
}
