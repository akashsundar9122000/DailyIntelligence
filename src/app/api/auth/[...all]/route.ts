import { authFor } from "@/lib/auth/auth";

/**
 * Every authentication endpoint. The library does its own validation, CSRF
 * origin checking and rate limiting, so this is not wrapped by defineRoute.
 */
function handle(request: Request): Promise<Response> {
  return authFor(request.headers).handler(request);
}

export { handle as GET, handle as POST };
