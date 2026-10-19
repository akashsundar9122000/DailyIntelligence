import "server-only";

import { and, eq } from "drizzle-orm";

import { getAuthDb } from "@/lib/db/client";
import { sessions, verifications } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";

import { authFor } from "./auth";
import { recordSecurityEvent } from "./security-events";
import type { CurrentSession } from "./session";

/** How long a re-proof of identity lasts. Long enough to finish a task, short enough to matter. */
export const STEP_UP_WINDOW_MS = 10 * 60 * 1000;

/**
 * Whether this session has recently proved who is using it: by signing in, or
 * by entering a fresh emailed code since.
 *
 * A session can live for thirty days on an unlocked laptop. The actions that
 * cannot be undone -- exporting or deleting everything, signing every other
 * device out -- ask again.
 */
export function hasRecentStepUp(session: Pick<CurrentSession, "createdAt" | "stepUpAt">, now: Date = new Date()): boolean {
  const latest = Math.max(session.createdAt.getTime(), session.stepUpAt?.getTime() ?? 0);
  return now.getTime() - latest < STEP_UP_WINDOW_MS;
}

export function assertRecentStepUp(session: Pick<CurrentSession, "createdAt" | "stepUpAt">): void {
  if (!hasRecentStepUp(session)) {
    throw new AppError("FORBIDDEN", "Please confirm it is you with a code from your email.", { _stepUp: "required" });
  }
}

/** Mail a confirmation code to the session's own address. Never to an address the client sent. */
export async function sendStepUpCode(session: CurrentSession, requestHeaders: Headers): Promise<void> {
  await authFor(requestHeaders).api.sendVerificationOTP({ headers: requestHeaders, body: { email: session.user.email, type: "email-verification" } });
}

/**
 * Re-prove identity with a fresh emailed code, and stamp the session.
 *
 * The library's three-guess cap and its per-address limits apply here too: the
 * check goes through its endpoint rather than a comparison of our own.
 */
export async function stepUpWithCode(session: CurrentSession, code: string, requestHeaders: Headers): Promise<void> {
  try {
    await authFor(requestHeaders).api.checkVerificationOTP({
      headers: requestHeaders,
      body: { email: session.user.email, type: "email-verification", otp: code },
    });
  } catch {
    throw new AppError("VALIDATION", "Please check the highlighted fields.", { code: "That code is not correct, or has expired." });
  }
  // Both the session and its user are named: this connection is the authentication role's, where no policy narrows the rows.
  await getAuthDb().update(sessions).set({ stepUpAt: new Date() }).where(and(eq(sessions.id, session.sessionId), eq(sessions.userId, session.user.id)));
  // Spent: the library leaves a checked code valid until it expires, so the code that just proved identity
  // would also have authorised the next sensitive step -- deleting the account among them.
  await getAuthDb().delete(verifications).where(eq(verifications.identifier, `email-verification-otp-${session.user.email.toLowerCase()}`));
  await recordSecurityEvent(session.user.id, "step_up", {
    ip: requestHeaders.get("x-real-ip"),
    userAgent: requestHeaders.get("user-agent"),
  });
}
