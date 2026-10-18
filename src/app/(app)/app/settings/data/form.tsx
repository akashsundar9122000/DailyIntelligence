"use client";

import { useState, type FormEvent } from "react";

import { CodeField } from "@/components/auth/code-field";
import { Panel, SettingRow } from "@/components/settings/panel";
import { useStepUp } from "@/components/settings/step-up";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { TextField } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { clearHistoryAction } from "@/lib/actions/reader";
import { deleteAccountAction, sendStepUpCodeAction } from "@/lib/actions/security";
import { usePreferences } from "@/lib/settings/client";

function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ code?: string; confirmation?: string }>({});
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const confirmation = String(data.get("confirmation"));
    if (confirmation !== "DELETE") return setErrors({ confirmation: "Type DELETE in capitals to confirm." });
    setBusy(true);
    setErrors({});
    const result = await deleteAccountAction({ code, confirmation: "DELETE" });
    if (!result.ok) {
      setBusy(false);
      if (result.fieldErrors?.code || result.fieldErrors?.confirmation) setErrors(result.fieldErrors);
      else toast.error(result.message);
      return;
    }
    // A full navigation: nothing rendered for the deleted account may survive.
    window.location.assign(new URL("/", window.location.origin).href);
  }

  return (
    <Panel title="Delete account" note="Deletes your account and everything in it: your interests, saved stories, reading history, settings, signed-in devices and security activity. This cannot be undone.">
      <div className="py-4">
        <Button
          variant="danger"
          onClick={() => {
            setOpen(true);
            if (!sent) {
              setSent(true);
              void sendStepUpCodeAction({}).then((result) => {
                if (!result.ok) toast.error(result.message);
              });
            }
          }}
        >
          Delete my account
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setErrors({});
        }}
        presentation="modal"
        title="Delete your account?"
        description="We have emailed you a six-digit code. Everything is deleted immediately and cannot be recovered."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <CodeField value={code} onChange={setCode} label="Code from your email" error={errors.code} />
          <TextField
            label="Type DELETE to confirm"
            name="confirmation"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            error={errors.confirmation}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Keep my account
            </Button>
            <Button type="submit" variant="danger" loading={busy}>
              Delete account for ever
            </Button>
          </div>
        </form>
      </Dialog>
    </Panel>
  );
}

function ExportRow() {
  const { confirm, dialog } = useStepUp();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    let response = await fetch("/api/me/export", { credentials: "same-origin" });
    // The server decides whether a fresh code is needed; ask only if it says so.
    if (response.status === 403) {
      if (!(await confirm())) return setBusy(false);
      response = await fetch("/api/me/export", { credentials: "same-origin" });
    }
    setBusy(false);
    if (!response.ok) {
      toast.error(response.status === 429 ? "Too many exports. Try again in an hour." : "Your data could not be exported. Please try again.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "my-reading-data.json";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Your data was downloaded.");
  }

  return (
    <SettingRow label="Download my data" note="One JSON file: your account, settings, interests, saved stories and notes, collections, feedback, reading history, reports and security log. Sign-in codes and tokens are never included.">
      <Button variant="secondary" loading={busy} onClick={() => void download()}>
        Download
      </Button>
      {dialog}
    </SettingRow>
  );
}

function ClearHistoryRow() {
  const [busy, setBusy] = useState(false);
  return (
    <SettingRow label="Clear reading history" note="Forgets every story you have opened. Saved stories are not affected.">
      <Button
        variant="secondary"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          const result = await clearHistoryAction({});
          setBusy(false);
          if (!result.ok) return void toast.error(result.message);
          toast.success(result.data.cleared === 1 ? "1 story forgotten." : `${result.data.cleared} stories forgotten.`);
        }}
      >
        Clear history
      </Button>
    </SettingRow>
  );
}

export function DataSettings() {
  const { preferences, update } = usePreferences();
  return (
    <>
      <Panel title="Reading and personalisation" note="Both are yours to switch off. Off means not recorded, not recorded and hidden.">
        <div className="py-4">
          <Switch
            label="Remember what I read"
            description="Used to show what changed since your last visit and to stop stories you have read from resurfacing. Off, nothing you open is recorded."
            checked={preferences.readingHistory}
            onCheckedChange={(next) => update({ readingHistory: next })}
          />
        </div>
        <div className="py-4">
          <Switch
            label="Order my feed by my interests"
            description="Off, you see the same edition as every other reader, ordered by importance and recency."
            checked={preferences.personalisation}
            onCheckedChange={(next) => update({ personalisation: next })}
          />
        </div>
      </Panel>

      <Panel title="Your data" note="Yours to take away or wipe, at any time.">
        <ExportRow />
        <ClearHistoryRow />
      </Panel>

      <DeleteAccount />
    </>
  );
}
