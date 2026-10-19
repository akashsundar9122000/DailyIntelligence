"use client";

import { Panel, SettingRow } from "@/components/settings/panel";
import { SelectField } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { usePreferences } from "@/lib/settings/client";
import { LANDING_PAGE_OPTIONS } from "@/lib/settings/preferences";

/** How the paper opens and how long explainers are. Saved as changed. */
export function ReadingSettings() {
  const { preferences, update } = usePreferences();
  return (
    <Panel title="Reading" note="Changes apply at once and follow you to your other devices.">
      <SettingRow label="Edition" note="Which stories your feeds open on. The switch at the top of every page changes the same setting.">
        <Segmented
          legend="Edition"
          options={[
            { value: "both", label: "India + World" },
            { value: "india", label: "India" },
            { value: "global", label: "World" },
          ]}
          value={preferences.defaultScope}
          onChange={(defaultScope) => update({ defaultScope })}
        />
      </SettingRow>
      <SettingRow label="Explainer length" note="Where an AI explainer opens. Every story lets you switch.">
        <Segmented
          legend="Explainer length"
          options={[
            { value: "concise", label: "Concise" },
            { value: "balanced", label: "Balanced" },
            { value: "deep", label: "Deep dive" },
          ]}
          value={preferences.readingStyle}
          onChange={(readingStyle) => update({ readingStyle })}
        />
      </SettingRow>
      <SettingRow label="Open the paper on" note="The page you land on after signing in.">
        <SelectField label="Open the paper on" labelHidden value={preferences.landingPage} onChange={(landingPage) => update({ landingPage })} options={LANDING_PAGE_OPTIONS} className="sm:w-64" />
      </SettingRow>
      <SettingRow label="Language" note="The paper is in English. Tamil and Hindi are planned, and machine translation will always be labelled.">
        <span className="text-sm font-semibold">English</span>
      </SettingRow>
    </Panel>
  );
}
