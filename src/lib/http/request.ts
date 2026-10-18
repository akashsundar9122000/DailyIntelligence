import "server-only";

import { headers } from "next/headers";

import { forbidden } from "@/lib/errors";

type HeaderReader = { get(name: string): string | null };

/**
 * Whether this request arrived over TLS.
 *
 * Read from the request's TRANSPORT, never from NODE_ENV. A production build
 * served over plain http (a local `next start`, the e2e suite) must not set
 * Secure cookies: Safari drops them, and sign-in then succeeds and lands back
 * on the sign-in page with nothing in any log.
 */
export function isSecureRequest(h: HeaderReader, fallbackUrl?: string): boolean {
  const forwarded = h.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwarded) return forwarded === "https";
  return fallbackUrl ? fallbackUrl.startsWith("https://") : false;
}

/**
 * The caller's address, for rate limiting only.
 *
 * x-forwarded-for is a list the client can prepend to. Vercel sets
 * x-real-ip itself, so prefer it; otherwise take the LAST forwarded hop, the
 * one our own proxy appended, never the first, which is whatever the client
 * typed.
 */
export function clientIp(h: HeaderReader): string {
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const hops = h.get("x-forwarded-for")?.split(",").map((hop) => hop.trim()).filter(Boolean);
  return hops?.[hops.length - 1] ?? "unknown";
}

/**
 * Refuse a state-changing request that another site initiated.
 *
 * Next already compares Origin and Host for server actions; this is the same
 * rule, applied where a route handler accepts a mutation, and with the fetch
 * metadata header a browser sends but a forged form cannot remove.
 */
export function assertSameOriginHeaders(h: HeaderReader): void {
  const site = h.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") throw forbidden("That request did not come from this site.");

  const origin = h.get("origin");
  if (!origin) return;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden("That request did not come from this site.");
  }
  if (!host || originHost !== host) throw forbidden("That request did not come from this site.");
}

export async function assertSameOrigin(): Promise<void> {
  assertSameOriginHeaders(await headers());
}
