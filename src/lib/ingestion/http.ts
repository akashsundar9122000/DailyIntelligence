import { USER_AGENT } from "@/lib/sources/catalogue";

import { SourceError, type FetchFn } from "./types";

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
