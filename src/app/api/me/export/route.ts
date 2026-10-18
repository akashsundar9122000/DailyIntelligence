import { NextResponse, type NextRequest } from "next/server";

import { recordSecurityEvent } from "@/lib/auth/security-events";
import { sessionFromHeaders } from "@/lib/auth/session";
import { hasRecentStepUp } from "@/lib/auth/step-up";
import { clientIp } from "@/lib/http/request";
import { LIMITS, take } from "@/lib/rate-limit";
import { exportReaderData } from "@/lib/services/export";

/**
 * Download everything held about the signed-in reader. Needs a recent proof
 * of identity (a fresh emailed code within ten minutes): an export is
 * everything a person who found an unlocked laptop would want. 403 tells the
 * page to ask for the code, then try again.
 */
export async function GET(request: NextRequest) {
  const session = await sessionFromHeaders(request.headers);
  if (!session) return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  if (!hasRecentStepUp(session)) return NextResponse.json({ ok: false, error: "Confirm it is you first.", stepUp: "required" }, { status: 403 });
  const allowed = await take(`export:${clientIp(request.headers)}`, LIMITS.exportPerIp);
  if (!allowed.ok) return NextResponse.json({ ok: false, error: "Too many exports. Try again in an hour." }, { status: 429 });
  const data = await exportReaderData(session.user.id);
  await recordSecurityEvent(session.user.id, "data_exported", { ip: request.headers.get("x-real-ip"), userAgent: request.headers.get("user-agent") });
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="my-reading-data-${day}.json"`,
      "cache-control": "no-store",
    },
  });
}
