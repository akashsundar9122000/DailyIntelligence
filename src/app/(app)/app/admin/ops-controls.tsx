"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { dryRunAction, setOpsSwitchAction, testSendAction } from "@/lib/actions/admin";
import type { DryRun } from "@/lib/ingestion/pipeline";
import type { SwitchKey } from "@/lib/services/ops";

/** An operational switch. Off asks for a reason, which goes in the audit log and on this page. */
export function OpsSwitch({ switchKey, label, enabled }: { switchKey: SwitchKey; label: string; enabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");

  async function apply(next: boolean) {
    setBusy(true);
    const result = await setOpsSwitchAction({ key: switchKey, enabled: next, reason });
    setBusy(false);
    if (!result.ok) return void toast.error(result.message);
    setOpen(false);
    setReason("");
    toast.success(next ? `${label} switched on.` : `${label} switched off.`);
    router.refresh();
  }

  if (!enabled) {
    return (
      <Button variant="secondary" size="sm" loading={busy} onClick={() => void apply(true)} aria-label={`Switch on: ${label}`}>
        Switch on
      </Button>
    );
  }
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} aria-label={`Switch off: ${label}`}>
        Switch off
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={`Switch off ${label.toLowerCase()}?`} description="It stops on the next run, for everyone, until it is switched back on. The reason goes in the audit log.">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void apply(false);
          }}
          className="space-y-4"
        >
          <TextField label="Reason" name="reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={busy}>
              Switch off
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/** Read a source now and store nothing; show what came back. */
export function DryRunButton({ sourceId, name }: { sourceId: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DryRun | null>(null);
  return (
    <div className="space-y-1.5">
      <Button
        variant="ghost"
        size="sm"
        loading={busy}
        aria-label={`Test read of ${name}`}
        onClick={async () => {
          setBusy(true);
          const response = await dryRunAction({ sourceId });
          setBusy(false);
          if (!response.ok) return void toast.error(response.message);
          setResult(response.data);
        }}
      >
        Test read
      </Button>
      {result ? (
        <p className="max-w-xs text-xs text-text-secondary" role="status">
          {result.status === "failed"
            ? `Failed: ${result.error}`
            : result.status === "not_modified"
              ? "Nothing new since the last read."
              : `${result.fetched} items in ${Math.round(result.ms / 100) / 10}s${result.quarantined ? `, ${result.quarantined} set aside` : ""}. ${result.sample.length ? `First: ${result.sample[0]}` : ""}`}{" "}
          Nothing was stored.
        </p>
      ) : null}
    </div>
  );
}

export function TestSend() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const result = await testSendAction({});
        setBusy(false);
        if (!result.ok) return void toast.error(result.message);
        if (result.data.sent) toast.success(`Sent to your ${result.data.devices} ${result.data.devices === 1 ? "device" : "devices"}.`);
        else toast.error("None of your devices accepted it.");
      }}
    >
      Send a test to my devices
    </Button>
  );
}
