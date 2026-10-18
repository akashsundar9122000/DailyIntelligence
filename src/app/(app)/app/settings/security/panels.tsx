"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Panel } from "@/components/settings/panel";
import { useStepUp } from "@/components/settings/step-up";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { revokeOtherSessionsAction, revokeSessionAction } from "@/lib/actions/security";
import type { SecurityEventKind } from "@/lib/auth/security-event-kinds";
import { formatInstant } from "@/lib/format/date";

type Device = { id: string; device: string; network: string | null; createdAt: string; lastActiveAt: string; current: boolean };
type Activity = { intact: boolean; events: { id: string; kind: SecurityEventKind; detail: Record<string, string>; createdAt: string }[] };

const EVENT_LABEL: Record<SecurityEventKind, string> = {
  signed_in: "Signed in",
  signed_out: "Signed out",
  session_revoked: "A device was signed out",
  other_sessions_revoked: "All other devices were signed out",
  step_up: "Identity confirmed with a code",
  data_exported: "Data exported",
  account_deleted: "Account deleted",
};
/** Events worth a second look. Marked with a word, not with colour alone. */
const NOTABLE = new Set<SecurityEventKind>(["other_sessions_revoked", "data_exported"]);

function DevicesPanel({ devices }: { devices: Device[] }) {
  const router = useRouter();
  const { run, dialog } = useStepUp();
  const [busy, setBusy] = useState<string | null>(null);
  const others = devices.filter((device) => !device.current);

  async function end(device: Device) {
    setBusy(device.id);
    const result = await run(() => revokeSessionAction({ sessionId: device.id }));
    setBusy(null);
    if (!result) return;
    if (result.ok) {
      toast.success("That device was signed out.");
      router.refresh();
    } else toast.error(result.message);
  }

  async function endOthers() {
    setBusy("others");
    const result = await run(() => revokeOtherSessionsAction({}));
    setBusy(null);
    if (!result) return;
    if (result.ok) {
      toast.success(result.data.ended === 1 ? "1 other device was signed out." : `${result.data.ended} other devices were signed out.`);
      router.refresh();
    } else toast.error(result.message);
  }

  return (
    <Panel title="Where you are signed in" note="Each browser or device with an open session. A network is shown as its first two numbers only.">
      <ul className="divide-y divide-border">
        {devices.map((device) => (
          <li key={device.id} className="flex flex-wrap items-center justify-between gap-3 py-3" data-testid="device-session">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-primary">
                {device.device}
                {device.current ? <Badge tone="outline">This device</Badge> : null}
              </p>
              <p className="text-xs text-text-secondary">
                {device.network ? `Network ${device.network} · ` : ""}Last active {formatInstant(device.lastActiveAt)}
              </p>
            </div>
            {device.current ? null : (
              <Button variant="secondary" size="sm" loading={busy === device.id} onClick={() => void end(device)}>
                Sign out
              </Button>
            )}
          </li>
        ))}
      </ul>
      {others.length > 0 ? (
        <div className="py-4">
          <Button variant="secondary" loading={busy === "others"} onClick={() => void endOthers()}>
            Sign out everywhere else
          </Button>
        </div>
      ) : null}
      {dialog}
    </Panel>
  );
}

function ActivityPanel({ activity }: { activity: Activity }) {
  const [all, setAll] = useState(false);
  const shown = all ? activity.events : activity.events.slice(0, 12);
  return (
    <Panel title="Security activity" note="What has happened to your account, newest first. Entries cannot be edited or removed.">
      <p className="flex items-center gap-2 py-3 text-sm" role="status">
        {activity.intact ? (
          <>
            <ShieldCheck className="size-4 text-success" aria-hidden />
            <span className="text-text-secondary">Checked: this record is complete and unaltered.</span>
          </>
        ) : (
          <>
            <ShieldAlert className="size-4 text-danger" aria-hidden />
            <span className="font-medium text-danger">Warning: this record has been altered or is missing entries. Contact support.</span>
          </>
        )}
      </p>
      <ul className="divide-y divide-border">
        {shown.map((event) => (
          <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3" data-testid="security-event">
            <p className="text-sm text-text-primary">
              {NOTABLE.has(event.kind) ? <span className="mr-2 text-xs font-semibold uppercase text-warning">Note</span> : null}
              {EVENT_LABEL[event.kind] ?? event.kind}
            </p>
            <p className="text-xs text-text-secondary">
              {[event.detail.device, event.detail.network ? `network ${event.detail.network}` : null].filter(Boolean).join(" · ")}
              {event.detail.device || event.detail.network ? " · " : ""}
              <time dateTime={event.createdAt}>{formatInstant(event.createdAt)}</time>
            </p>
          </li>
        ))}
      </ul>
      {activity.events.length > 12 && !all ? (
        <div className="py-3">
          <Button variant="ghost" onClick={() => setAll(true)}>
            Show all {activity.events.length}
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}

export function SecuritySettings({ devices, activity }: { devices: Device[]; activity: Activity }) {
  return (
    <>
      <DevicesPanel devices={devices} />
      <ActivityPanel activity={activity} />
    </>
  );
}
