import "server-only";

import webpush from "web-push";

import { env, webPushConfigured } from "@/lib/env";

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url: string; tag: string };

/**
 * What a send can tell us. `gone` is the push service saying the subscription
 * no longer exists (404 or 410): it is revoked, not retried. Nothing here can
 * tell us the notification was SEEN, so nothing claims "delivered".
 */
export type PushOutcome = { ok: true } | { ok: false; gone: boolean; status: number | null };

export interface PushSender {
  send(target: PushTarget, payload: PushPayload): Promise<PushOutcome>;
}

/** The real sender, signing with this deployment's VAPID keys. Null when push is not configured. */
export function webPushSender(): PushSender | null {
  if (!webPushConfigured()) return null;
  const { WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY, WEB_PUSH_SUBJECT } = env();
  return {
    async send(target, payload) {
      try {
        await webpush.sendNotification(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          JSON.stringify(payload),
          {
            vapidDetails: { subject: WEB_PUSH_SUBJECT!, publicKey: WEB_PUSH_PUBLIC_KEY!, privateKey: WEB_PUSH_PRIVATE_KEY! },
            // An alert that arrives a day late is wrong, not late: let the push service drop it.
            TTL: 6 * 3600,
            timeout: 10_000,
          },
        );
        return { ok: true };
      } catch (error) {
        const status = typeof (error as { statusCode?: unknown }).statusCode === "number" ? (error as { statusCode: number }).statusCode : null;
        return { ok: false, gone: status === 404 || status === 410, status };
      }
    },
  };
}
