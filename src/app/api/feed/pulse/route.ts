import { NextResponse, type NextRequest } from "next/server";

import { sessionFromHeaders } from "@/lib/auth/session";
import { clientIp } from "@/lib/http/request";
import { newStoriesSince } from "@/lib/queries/stories";
import { LIMITS, take } from "@/lib/rate-limit";

/**
 * How many stories arrived since a page was drawn. Polled by an open page
 * once a minute while it is visible -- polling, not a held-open stream, which
 * would keep a serverless function running for every reader with a tab open.
 */
export async function GET(request: NextRequest) {
  const session = await sessionFromHeaders(request.headers);
  if (!session) return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  const allowed = await take(`pulse:${clientIp(request.headers)}`, LIMITS.apiPerIp);
  if (!allowed.ok) return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(allowed.retryAfterSeconds) } });

  const since = request.nextUrl.searchParams.get("since") ?? "";
  const scopeParam = request.nextUrl.searchParams.get("scope");
  // An instant in the last two days, or nothing: an old or malformed one would count the whole paper as new.
  const at = Date.parse(since);
  if (!Number.isFinite(at) || at > Date.now() + 60_000 || at < Date.now() - 48 * 3_600_000) {
    return NextResponse.json({ ok: false, error: "since must be a recent instant." }, { status: 400 });
  }
  const scope = scopeParam === "india" || scopeParam === "global" ? scopeParam : undefined;
  const { count, newest } = await newStoriesSince(new Date(at).toISOString(), scope);
  return NextResponse.json({ ok: true, count, newest }, { headers: { "Cache-Control": "no-store" } });
}
