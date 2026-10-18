"use client";

import { useCallback, useRef, useState, type FormEvent, type ReactNode } from "react";

import { CodeField } from "@/components/auth/code-field";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions/_define";
import { sendStepUpCodeAction, stepUpAction } from "@/lib/actions/security";

/** True when an action was refused only because identity has not been re-proved recently. */
export function needsStepUp(result: { ok: boolean; fieldErrors?: Record<string, string> }): boolean {
  return !result.ok && result.fieldErrors?._stepUp === "required";
}

/**
 * Run a sensitive action, asking for a fresh emailed code first if the server
 * says it is needed.
 *
 * The SERVER decides. This never guesses from a client-side clock whether the
 * ten minutes are up: it tries the action, and only if that comes back
 * "step-up required" does it mail a code, ask for it, and try once more.
 */
export function useStepUp() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const retry = useRef<(() => void) | null>(null);
  const cancel = useRef<(() => void) | null>(null);

  const ask = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        retry.current = () => resolve(true);
        cancel.current = () => resolve(false);
        setError(undefined);
        setCode("");
        setOpen(true);
        void sendStepUpCodeAction({}).then((sent) => {
          if (!sent.ok) toast.error(sent.message);
        });
      }),
    [],
  );

  const run = useCallback(
    async function attempt<T>(action: () => Promise<ActionResult<T>>): Promise<ActionResult<T> | null> {
      const first = await action();
      if (!needsStepUp(first)) return first;
      return (await ask()) ? action() : null;
    },
    [ask],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const result = await stepUpAction({ code });
    setBusy(false);
    if (!result.ok) {
      setError(result.fieldErrors?.code ?? result.message);
      return;
    }
    setOpen(false);
    retry.current?.();
    retry.current = cancel.current = null;
  }

  const dialog: ReactNode = (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          cancel.current?.();
          retry.current = cancel.current = null;
        }
      }}
      title="Confirm it is you"
      description="We have emailed you a six-digit code. Enter it to continue. You will not be asked again for ten minutes."
      presentation="modal"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <CodeField value={code} onChange={setCode} error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={code.length !== 6}>
            Confirm
          </Button>
        </div>
      </form>
    </Dialog>
  );

  return { run, confirm: ask, dialog };
}
