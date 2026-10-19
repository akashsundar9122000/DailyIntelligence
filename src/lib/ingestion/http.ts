import { USER_AGENT } from "@/lib/sources/catalogue";

import { SourceError, type FetchFn } from "./types";

/*
 * Per-host pacing: at most one request a second to any host, from this
 * instance. Most sources are read once a run and never feel it; it matters for
 * a small official site that would otherwise see several requests in a burst
 * when a run retries or follows a redirect. GDELT's file servers are built for
 * bulk download and a first run probes many files in a row, so they are
 * exempt. Per instance, not global: a politeness floor, not a rate limit.
 */
const MIN_GAP_MS = 1_000;
const UNPACED = new Set(["data.gdeltproject.org", "fixtures.invalid"]);
const lastRequestAt = new Map<string, number>();

async function pace(url: string, deadline: number): Promise<void> {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return;
  }
  if (UNPACED.has(host)) return;
  const wait = (lastRequestAt.get(host) ?? 0) + MIN_GAP_MS - Date.now();
  // Never wait past the run's own deadline: the request would be refused for time anyway.
  if (wait > 0 && Date.now() + wait < deadline - 1_500) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt.set(host, Date.now());
}

/**
 * A GET that identifies us, gives up on time, and turns every failure into a
 * SourceError with a short, safe message. Never a response body in the
 * message: a page of HTML in an error column is a log full of somebody's site.
 */
export async function getFrom(
  fetchFn: FetchFn,
  url: string,
  { deadline, headers = {}, timeoutMs = 20_000 }: { deadline: number; headers?: Record<string, string>; timeoutMs?: number },
): Promise<Response> {
  await pace(url, deadline);
  const remaining = deadline - Date.now();
  if (remaining < 1500) throw new SourceError("Out of time for this run before the request was made.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, remaining - 500));
  try {
    const response = await fetchFn(url, {
      headers: { "user-agent": USER_AGENT, accept: "*/*", ...headers },
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });
    if (response.status === 429 || (response.status === 503 && response.headers.has("retry-after"))) {
      throw new SourceError(`The source asked us to slow down (${response.status}).`, response.status, true);
    }
    return response;
  } catch (error) {
    if (error instanceof SourceError) throw error;
    const reason = error instanceof Error && error.name === "AbortError" ? "Timed out." : "Could not connect.";
    throw new SourceError(reason);
  } finally {
    clearTimeout(timer);
  }
}
