import type { Metadata } from "next";

import { Panel } from "@/components/settings/panel";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/auth/session";
import { env, webPushConfigured } from "@/lib/env";
import { formatInstant, relativeTime } from "@/lib/format/date";
import { listDevices, markOpened, pausedUntil, recentNotifications, type NotificationRow } from "@/lib/services/notifications";
import { getNotificationPrefs } from "@/lib/services/reader";

import { DevicePush, RemoveDevice } from "./device";
import { AlertRules, PauseControls } from "./rules";

export const metadata: Metadata = { title: "Notifications" };

const STATUS: Record<NotificationRow["status"], { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  sent: { label: "Sent", tone: "success" },
  opened: { label: "Opened", tone: "success" },
  queued: { label: "Sending", tone: "neutral" },
  suppressed: { label: "Held back", tone: "warning" },
  failed: { label: "Not delivered", tone: "danger" },
};

/**
 * Notifications. The device first, because without it nothing arrives; then
 * the rules; then what was sent and what was held back and why, so a missing
 * alert has an answer the reader can read.
 */
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const session = await requireSession();
  const { n } = await searchParams;
  if (n) await markOpened(session.user.id, n);
  const now = new Date();
  const [prefs, devices, recent, paused] = await Promise.all([
    getNotificationPrefs(session.user.id),
    listDevices(session.user.id),
    recentNotifications(session.user.id, 20),
    pausedUntil(session.user.id),
  ]);
  const pushReady = webPushConfigured();

  return (
    <>
      <Panel title="This device" note="The browser asks for permission only after you press the button.">
        {pushReady ? <DevicePush publicKey={env().WEB_PUSH_PUBLIC_KEY!} /> : <p className="py-4 text-sm text-text-secondary">Push notifications are not configured on this deployment. The email digest below still works.</p>}
      </Panel>

      <AlertRules initial={prefs} />

      <Panel title="Pause" note="Stops every alert and briefing for a while without changing your rules.">
        <PauseControls pausedUntilLabel={paused ? formatInstant(paused) : null} />
      </Panel>

      <Panel title="Your devices" note="Every browser that may receive your notifications.">
        {devices.length ? (
          <ul className="divide-y divide-border">
            {devices.map((device) => (
              <li key={device.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">{device.label}</p>
                  <p className="text-xs text-text-tertiary">
                    Added {relativeTime(device.createdAt, now)}
                    {device.lastSuccessAt ? ` · last notified ${relativeTime(device.lastSuccessAt, now)}` : ""}
                  </p>
                </div>
                <RemoveDevice id={device.id} label={device.label} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-sm text-text-secondary">No device yet.</p>
        )}
      </Panel>

      <Panel title="Recent notifications" note="What was sent, and what was held back by your rules, with the reason. Sent means handed to your browser's push service or our mail server; whether it was seen, only you know.">
        {recent.length ? (
          <ul className="divide-y divide-border">
            {recent.map((event) => (
              <li key={event.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS[event.status].tone}>{STATUS[event.status].label}</Badge>
                  <span className="text-xs text-text-tertiary">
                    {event.channel === "email" ? "Email" : "Push"} · {relativeTime(event.createdAt, now)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-text-primary">{event.title}</p>
                {event.reason ? <p className="text-sm text-text-secondary">{event.reason}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-sm text-text-secondary">Nothing yet. Once you switch something on, every alert considered for you is listed here.</p>
        )}
      </Panel>
    </>
  );
}
