import { NextResponse, type NextRequest } from "next/server";

/**
 * Passes the requested path to the signed-in layout.
 *
 * A server layout cannot see the URL it is rendering for. Without this, a
 * signed-out visitor who followed a link to /app/funds was sent to sign in and
 * then returned to /app: the page they asked for was forgotten.
 *
 * It sets a REQUEST header for our own server code to read. It makes no
 * authorisation decision: the session is checked where the data is read.
 * The header is overwritten on every request, so a client cannot supply it.
 */
export const REQUESTED_PATH_HEADER = "x-requested-path";

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(REQUESTED_PATH_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: "/app/:path*" };
