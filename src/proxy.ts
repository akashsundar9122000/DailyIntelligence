import { NextResponse, type NextRequest } from "next/server";

/**
 * Two jobs, before any page renders.
 *
 * 1. THE CONTENT SECURITY POLICY. A fresh nonce for every page request: only
 *    scripts carrying it run, and 'strict-dynamic' lets them load the
 *    framework's chunks and nothing an attacker injects. Embeds come only from
 *    the two platforms Social Pulse is allowed to show. Styles keep
 *    'unsafe-inline' -- charts size bars with style attributes, which a nonce
 *    cannot cover -- a far smaller door than inline script. The nonce needs a
 *    rendered-per-request page; every page here reads it in the root layout.
 *
 * 2. THE REQUESTED PATH, for the signed-in layout: a server layout cannot see
 *    the URL it renders for, and without this a signed-out visitor who followed
 *    a link to /app/story/... was returned to /app after signing in. It makes
 *    no authorisation decision; the session is checked where data is read.
 *
 * Both are REQUEST headers our own code reads, overwritten here on every
 * request, so a client cannot supply them.
 */
export const REQUESTED_PATH_HEADER = "x-requested-path";
export const NONCE_HEADER = "x-nonce";

/** Where a social post's embed may come from: the platforms whose terms were read (src/lib/sources/catalogue.ts). */
const EMBED_ORIGINS = ["https://mastodon.social", "https://embed.bsky.app", "https://www.youtube-nocookie.com"];

export function contentSecurityPolicy(nonce: string, { https, dev }: { https: boolean; dev: boolean }): string {
  return [
    "default-src 'self'",
    // 'unsafe-eval' only in development, where React rebuilds server error stacks with it.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    `frame-src ${EMBED_ORIGINS.join(" ")}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Only over https: over plain http (a local build) it would upgrade the page's own requests to a port that is not there.
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const https = (request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")) === "https";
  const policy = contentSecurityPolicy(nonce, { https, dev: process.env.NODE_ENV === "development" });
  const headers = new Headers(request.headers);
  headers.set(NONCE_HEADER, nonce);
  headers.set("Content-Security-Policy", policy);
  if (request.nextUrl.pathname.startsWith("/app")) headers.set(REQUESTED_PATH_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: API routes, static files and prefetches carry no inline script.
      source: "/((?!api|_next/static|_next/image|brand|sw.js|manifest.webmanifest|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
