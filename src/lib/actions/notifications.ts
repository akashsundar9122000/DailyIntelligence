"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { removePushEndpoint, removePushSubscription, savePushSubscription, sendTest, setPause } from "@/lib/services/notifications";

import { signedInAction } from "./_define";

const PAGE = "/app/settings/notifications";

/** Keep this browser's push subscription, after the reader pressed the button and the browser said yes. */
export const savePushSubscriptionAction = signedInAction(
  z.object({ endpoint: z.url().max(2000), p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  async (input, { session }) => {
    const saved = await savePushSubscription(session.user.id, { ...input, userAgent: (await headers()).get("user-agent") });
    revalidatePath(PAGE);
    return saved;
  },
);

export const removePushSubscriptionAction = signedInAction(z.object({ id: z.uuid() }), async (input, { session }) => {
  await removePushSubscription(session.user.id, input.id);
  revalidatePath(PAGE);
  return { removed: input.id };
});

/** "Turn off on this device": the browser knows its endpoint, not our id for it. */
export const removePushEndpointAction = signedInAction(z.object({ endpoint: z.url().max(2000) }), async (input, { session }) => {
  await removePushEndpoint(session.user.id, input.endpoint);
  revalidatePath(PAGE);
  return { removed: true };
});

export const sendTestNotificationAction = signedInAction(z.object({}), async (_input, { session }) => {
  const result = await sendTest(session.user.id);
  revalidatePath(PAGE);
  return result;
});

/** Pause for 8 or 24 hours, or resume. */
export const setPauseAction = signedInAction(z.object({ hours: z.union([z.literal(8), z.literal(24), z.null()]) }), async (input, { session }) => {
  const until = await setPause(session.user.id, input.hours);
  revalidatePath(PAGE);
  return { pausedUntil: until };
});
