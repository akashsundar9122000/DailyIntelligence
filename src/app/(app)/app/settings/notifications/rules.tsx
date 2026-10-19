"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Panel } from "@/components/settings/panel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { setPauseAction } from "@/lib/actions/notifications";
import { saveNotificationPrefsAction } from "@/lib/actions/reader";
import type { NotificationPrefs } from "@/lib/services/reader";

const KINDS = [
  ["breaking", "Breaking news", "Exceptionally important stories, confirmed by two publishers or an official source."],
  ["hot", "Hot stories you follow", "A story about something you follow is rising sharply, and is being confirmed. Heat alone never alerts."],
  ["topics", "Topic alerts", "An important, confirmed story about something you follow."],
  ["storyUpdates", "Updates to saved stories", "New reports on a story you saved."],
  ["morningBriefing", "Morning briefing", "The edition in a few minutes, at the time below."],
  ["eveningBriefing", "Evening recap", "What changed during the day, at the time below."],
  ["emailDigest", "Email digest", "The morning briefing by email, at the morning time."],
] as const;

const input = "h-11 w-full border border-border-input bg-surface px-3 text-text-primary";

/** The alert rules, saved together: a half-saved set of rules is a set nobody chose. */
export function AlertRules({ initial }: { initial: NotificationPrefs }) {
  const router = useRouter();
  const [rules, setRules] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) => setRules((current) => ({ ...current, [key]: value }));

  async function save() {
    setBusy(true);
    const result = await saveNotificationPrefsAction(rules);
    setBusy(false);
    if (!result.ok) return void toast.error(result.message);
    setRules(result.data);
    toast.success("Your alert rules were saved.");
    router.refresh();
  }

  return (
    <Panel title="What to alert you about" note="Everything is off until you switch it on. Alerts also need a device with notifications on, above.">
      <div className="divide-y divide-border">
        {KINDS.map(([key, label, description]) => (
          <div key={key} className="py-3">
            <Switch label={label} description={description} checked={rules[key]} onCheckedChange={(next) => set(key, next)} />
          </div>
        ))}
      </div>
      <div className="grid gap-4 border-t border-border py-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium">
          <span>Morning briefing at</span>
          <input type="time" value={rules.morningAt} onChange={(event) => set("morningAt", event.target.value)} className={input} />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          <span>Evening recap at</span>
          <input type="time" value={rules.eveningAt} onChange={(event) => set("eveningAt", event.target.value)} className={input} />
        </label>
      </div>
      <div className="space-y-4 border-t border-border py-4">
        <Switch label="Quiet hours" description="No alerts in this window. Briefings still come at the times you chose." checked={rules.quietHours} onCheckedChange={(next) => set("quietHours", next)} />
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1.5 text-sm font-medium">
            <span>Quiet from</span>
            <input type="time" value={rules.quietStart} disabled={!rules.quietHours} onChange={(event) => set("quietStart", event.target.value)} className={input} />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <span>Quiet until</span>
            <input type="time" value={rules.quietEnd} disabled={!rules.quietHours} onChange={(event) => set("quietEnd", event.target.value)} className={input} />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <span>At most, per day</span>
            <select value={rules.dailyCap} onChange={(event) => set("dailyCap", Number(event.target.value))} className={input}>
              {[0, 1, 2, 3, 5, 8].map((value) => (
                <option key={value} value={value}>
                  {value === 0 ? "No alerts" : `${value} ${value === 1 ? "alert" : "alerts"}`}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="flex justify-end border-t border-border pt-4">
        <Button onClick={() => void save()} loading={busy}>
          Save alert rules
        </Button>
      </div>
    </Panel>
  );
}

/** Pause without changing a single rule. */
export function PauseControls({ pausedUntilLabel }: { pausedUntilLabel: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function pause(hours: 8 | 24 | null) {
    setBusy(true);
    const result = await setPauseAction({ hours });
    setBusy(false);
    if (!result.ok) return void toast.error(result.message);
    toast.success(hours ? `Paused for ${hours} hours.` : "Notifications resumed.");
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-2 py-4">
      {pausedUntilLabel ? (
        <>
          <p className="mr-2 text-sm text-text-primary">Paused until {pausedUntilLabel}.</p>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void pause(null)}>
            Resume now
          </Button>
        </>
      ) : (
        <>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void pause(8)}>
            Pause for 8 hours
          </Button>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void pause(24)}>
            Pause for a day
          </Button>
        </>
      )}
    </div>
  );
}
