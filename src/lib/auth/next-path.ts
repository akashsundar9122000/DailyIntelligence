/**
 * Where to go after signing in.
 *
 * `next` arrives in a URL anybody can construct, so it is treated as hostile: a
 * sign-in page that redirects wherever it is told turns this site's address
 * into the first hop of somebody else's phishing link. Only a path on this
 * origin is accepted; anything else becomes the default.
 */
/**
 * A route that forwards to the reader's chosen landing page. Signing in goes
 * here unless a specific page was asked for.
 */
export const DEFAULT_AFTER_SIGN_IN = "/app/start";

export function safeNextPath(next: string | null | undefined): string {
  if (!next) return DEFAULT_AFTER_SIGN_IN;
  // Must be a single-slash absolute path. "//host" and "/\host" are both read
  // by browsers as another origin.
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return DEFAULT_AFTER_SIGN_IN;
  if (/[\u0000-\u001f]/.test(next)) return DEFAULT_AFTER_SIGN_IN;
  try {
    const resolved = new URL(next, "https://origin.invalid");
    if (resolved.origin !== "https://origin.invalid") return DEFAULT_AFTER_SIGN_IN;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return DEFAULT_AFTER_SIGN_IN;
  }
}
