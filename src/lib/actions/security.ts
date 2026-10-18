"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { deleteAccount } from "@/lib/auth/account";
import { recordSecurityEvent } from "@/lib/auth/security-events";
import { revokeDeviceSession, revokeOtherDeviceSessions } from "@/lib/auth/sessions";
import { sendStepUpCode, stepUpWithCode } from "@/lib/auth/step-up";
import { AppError } from "@/lib/errors";

import { signedInAction } from "./_define";

const code = z.string().regex(/^\d{6}$/, "Enter the six-digit code from your email.");

async function requestContext() {
  const requestHeaders = await headers();
  return { requestHeaders, context: { ip: requestHeaders.get("x-real-ip"), userAgent: requestHeaders.get("user-agent") } };
}

/** Mail a confirmation code to the signed-in address. */
export const sendStepUpCodeAction = signedInAction(z.object({}), async (_input, { session }) => {
  const { requestHeaders } = await requestContext();
  await sendStepUpCode(session, requestHeaders);
  return { sent: true };
});

/** Re-prove identity with that code. Unlocks the step-up actions for ten minutes. */
export const stepUpAction = signedInAction(z.object({ code }), async (input, { session }) => {
  const { requestHeaders } = await requestContext();
  await stepUpWithCode(session, input.code, requestHeaders);
  return { confirmed: true };
});

export const revokeSessionAction = signedInAction(
  z.object({ sessionId: z.uuid() }),
  async (input, { session }) => {
    if (input.sessionId === session.sessionId) {
      throw new AppError("INVALID_STATE", "To end this session, sign out from the account menu.");
    }
    await revokeDeviceSession(session.user.id, input.sessionId);
    await recordSecurityEvent(session.user.id, "session_revoked", (await requestContext()).context);
    return { revoked: input.sessionId };
  },
  { stepUp: true },
);

export const revokeOtherSessionsAction = signedInAction(
  z.object({}),
  async (_input, { session }) => {
    const ended = await revokeOtherDeviceSessions(session.user.id, session.sessionId);
    await recordSecurityEvent(session.user.id, "other_sessions_revoked", (await requestContext()).context);
    return { ended };
  },
  { stepUp: true },
);

/**
 * Delete the account. Asks for a fresh emailed code AND the word DELETE: the
 * code proves who is asking, the word proves they meant it.
 */
export const deleteAccountAction = signedInAction(
  z.object({ code, confirmation: z.literal("DELETE", { error: "Type DELETE in capitals to confirm." }) }),
  async (input, { session }) => {
    const { requestHeaders } = await requestContext();
    await deleteAccount(session, input.code, requestHeaders);
    return { deleted: true };
  },
);
