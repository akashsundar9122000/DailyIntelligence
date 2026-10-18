"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Panel, SettingRow } from "@/components/settings/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/messages";

function DetailsForm({ name: initialName, email }: { name: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();
  const dirty = trimmed !== saved && trimmed.length > 0;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const { error } = await authClient.updateUser({ name: trimmed });
    setBusy(false);
    if (error) {
      toast.error(authErrorMessage(error, "Your name could not be saved. Please try again."));
      return;
    }
    setSaved(trimmed);
    toast.success("Your name was saved.");
    // The name is shown in the shell, which the server renders.
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 py-4">
      <TextField label="Display name" name="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required maxLength={80} hint="Shown only to you, at the top of your edition." />
      <TextField label="Email" name="email" value={email} readOnly hint="Your sign-in codes are sent here. There is no password to remember." />
      <Button type="submit" loading={busy} disabled={!dirty}>
        Save changes
      </Button>
    </form>
  );
}

const PROVIDER_LABEL = { google: "Google", github: "GitHub" } as const;

export function AccountSettings({
  name,
  email,
  linked,
  available,
}: {
  name: string;
  email: string;
  linked: string[];
  available: { google: boolean; github: boolean };
}) {
  const offered = (Object.keys(PROVIDER_LABEL) as (keyof typeof PROVIDER_LABEL)[]).filter((provider) => available[provider] || linked.includes(provider));
  return (
    <>
      <Panel title="Your details">
        <DetailsForm name={name} email={email} />
      </Panel>
      <Panel title="How you sign in" note="Every account can sign in with a code sent to its email address. Others are optional, and use the same address.">
        <SettingRow label="Email code" note={email}>
          <Badge tone="outline">
            <Check className="size-3" aria-hidden /> Always on
          </Badge>
        </SettingRow>
        {offered.map((provider) => (
          <SettingRow key={provider} label={PROVIDER_LABEL[provider]} note={linked.includes(provider) ? "Linked to this account." : `Not linked. Choose “Continue with ${PROVIDER_LABEL[provider]}” when you next sign in, with the same email address.`}>
            {linked.includes(provider) ? (
              <Badge tone="outline">
                <Check className="size-3" aria-hidden /> Linked
              </Badge>
            ) : (
              <Badge>Not linked</Badge>
            )}
          </SettingRow>
        ))}
      </Panel>
    </>
  );
}
