"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { setSourceEnabledAction } from "@/lib/actions/admin";

/** Switch a source off (with a reason, for the audit log) or back on. */
export function SourceSwitch({ sourceId, name, enabled, cleared }: { sourceId: string; name: string; enabled: boolean; cleared: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");

  async function apply(next: boolean) {
    setBusy(true);
    const result = await setSourceEnabledAction({ sourceId, enabled: next, reason });
    setBusy(false);
    if (!result.ok) return void toast.error(result.message);
    setOpen(false);
    setReason("");
    toast.success(next ? `${name} switched on.` : `${name} switched off. Its stories are withdrawn from every page.`);
    router.refresh();
  }

  if (!enabled) {
    return cleared ? (
      <Button variant="secondary" size="sm" loading={busy} onClick={() => void apply(true)}>
        Switch on
      </Button>
    ) : null;
  }
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Switch off
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={`Switch off ${name}?`} description="It stops being read, and everything from it is withdrawn from every page on the next request. The reason goes in the audit log.">
        <div className="space-y-4">
          <TextField label="Reason" name="reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} hint="For example: terms changed, feed broken, removal request." />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep it on
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void apply(false)}>
              Switch off
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
