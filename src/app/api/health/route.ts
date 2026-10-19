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
/*
 * The last answer, kept five seconds per server instance. Unauthenticated and
 * unlimited, the route would let anyone keep the database busy with one query
 * per request; held briefly, a flood costs one query per five seconds, and a
 * monitor still gets a fresh, full answer.
 */
const HOLD_MS = 5_000;
let held: { at: number; health: Awaited<ReturnType<typeof checkHealth>> } | null = null;

export async function GET() {
  // Checked per request (within the hold). Prerendered, this would report the build machine's database for ever.
  await connection();
  if (!held || Date.now() - held.at > HOLD_MS) held = { at: Date.now(), health: await checkHealth() };
  const { health } = held;
  return NextResponse.json(health, { status: health.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
