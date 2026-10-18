import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { authFor } from "./auth";
import { safeNextPath } from "./next-path";

// The same name src/proxy.ts sets. Repeated rather than imported: the proxy is
// bundled separately and must not pull this server-only module into it.
const REQUESTED_PATH_HEADER = "x-requested-path";

export type CurrentSession = {
  sessionId: string;
  user: { id: string; name: string; email: string; emailVerified: boolean; image: string | null };
  createdAt: Date;
  /** When this session last re-proved who is using it. Null if it never has. */
  stepUpAt: Date | null;
};

/**
 * The signed-in session for this request, or null.
 *
 * Resolved from the database on every request (cached for the length of one
 * render), never from a client-supplied id and never from a cached cookie: a
 * session revoked on another device stops working on its next request.
 *
 * A layout that calls this is not a security boundary. Every server action and
 * route handler resolves the session again, through its wrapper.
 */
export const getSession = cache(async (): Promise<CurrentSession | null> => {
  const requestHeaders = await headers();
  return sessionFromHeaders(requestHeaders);
});

export async function sessionFromHeaders(requestHeaders: Headers): Promise<CurrentSession | null> {
  const result = await authFor(requestHeaders).api.getSession({ headers: requestHeaders });
  if (!result) return null;
  const { user, session } = result;
  return {
    sessionId: session.id,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: Boolean(user.emailVerified),
      image: user.image ?? null,
    },
    createdAt: session.createdAt,
    stepUpAt: session.stepUpAt ?? null,
  };
}

/**
 * For pages: the session, or a redirect to sign in that returns to the page
 * that was asked for. The path comes from src/proxy.ts; it is validated again
 * on the sign-in page before it is used.
 */
export async function requireSession(): Promise<CurrentSession> {
  const session = await getSession();
  if (!session) {
    const requested = (await headers()).get(REQUESTED_PATH_HEADER);
    redirect(`/login?next=${encodeURIComponent(safeNextPath(requested))}`);
  }
  return session;
}
