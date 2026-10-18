import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";

/**
 * The scheduler's door. Returns a response to send back when the caller is
 * NOT the scheduler, or null when it is.
 *
 * With no secret configured it refuses everyone, including the scheduler:
 * failing closed is the right failure for an endpoint that makes the server do
 * work. Without the secret it answers 401 and does nothing else -- no read, no
 * write -- so the production smoke test can call it safely.
 */
export function refuseUnlessScheduler(request: NextRequest): NextResponse | null {
  const secret = env().CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "The scheduler secret is not configured." }, { status: 503 });
  const given = request.headers.get("authorization") ?? "";
  if (!safeEqual(given, `Bearer ${secret}`)) return NextResponse.json({ ok: false, error: "Not authorised." }, { status: 401 });
  return null;
}

/** Who called: the 15-minute GitHub workflow, the daily Vercel backstop, or a person's manual dispatch. */
export function triggerOf(request: NextRequest): string {
  const given = request.headers.get("x-trigger");
  return given === "backup" || given === "manual" || given === "github" ? given : "cron";
}
