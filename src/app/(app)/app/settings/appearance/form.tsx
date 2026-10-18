"use client";

import { Panel, SettingRow } from "@/components/settings/panel";
import { Segmented } from "@/components/ui/segmented";
import { usePreferences } from "@/lib/settings/client";
import type { Preferences } from "@/lib/settings/preferences";

const THEME_OPTIONS = [
  { value: "system", label: "Match device" },
  { value: "light", label: "Day" },
  { value: "dark", label: "Night" },
  { value: "contrast", label: "High contrast" },
] as const;

const TEXT_OPTIONS = [
  { value: "90", label: "Small" },
  { value: "100", label: "Default" },
  { value: "112", label: "Large" },
  { value: "125", label: "Largest" },
] as const;

/** Every control saves as it is changed. There is no Save button to forget. */
export function AppearanceSettings() {
  const { preferences, update } = usePreferences();

  return (
    <Panel title="Appearance" note="Changes apply at once and follow you to your other devices.">
      <SettingRow label="Colour scheme" note="Day is ink on newsprint. Night is warm off-white on near-black, for reading in the dark. High contrast is black on white.">
        <Segmented legend="Colour scheme" options={THEME_OPTIONS} value={preferences.theme} onChange={(theme) => update({ theme })} />
      </SettingRow>

      <SettingRow label="Text size" note="Scales all text, on top of your browser's own setting.">
        <Segmented
          legend="Text size"
          options={TEXT_OPTIONS}
          value={String(preferences.textSize) as (typeof TEXT_OPTIONS)[number]["value"]}
          onChange={(value) => update({ textSize: Number.parseInt(value, 10) as Preferences["textSize"] })}
        />
      </SettingRow>

      <SettingRow label="Density" note="Compact fits more stories on a screen.">
        <Segmented
          legend="Density"
          options={[
            { value: "comfortable", label: "Comfortable" },
            { value: "compact", label: "Compact" },
          ]}
          value={preferences.density}
          onChange={(density) => update({ density })}
        />
      </SettingRow>

      <SettingRow label="Motion" note="Reduced turns off page transitions and moving charts here, whatever your device is set to.">
        <Segmented
          legend="Motion"
          options={[
            { value: "system", label: "Match device" },
            { value: "reduce", label: "Reduced" },
          ]}
          value={preferences.motion}
          onChange={(motion) => update({ motion })}
        />
      </SettingRow>
    </Panel>
  );
}
