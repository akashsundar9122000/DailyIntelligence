import { NextResponse } from "next/server";
import { connection } from "next/server";

import { checkHealth } from "@/lib/services/health";

/**
 * 503 when the database is unreachable, unconfigured, or reachable through a
 * role that could bypass row-level security.
 *
 * Deliberately not built with defineRoute: a monitor needs the full body on a
 * failure, and must not be rate limited by the table whose health it reports.
 */
export async function GET() {
  // Checked per request. Prerendered, this would report the build machine's
  // database for ever.
  await connection();
  const health = await checkHealth();
  return NextResponse.json(health, { status: health.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
