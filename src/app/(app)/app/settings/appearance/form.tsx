"use client";

import { Panel, SettingRow } from "@/components/settings/panel";
import { PalettePicker } from "@/components/ui/palette-picker";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { MODE_OPTIONS, MOTION_OPTIONS } from "@/config/themes";
import { usePreferences } from "@/lib/settings/client";
import type { Preferences } from "@/lib/settings/preferences";

const TEXT_OPTIONS = [
  { value: "90", label: "Small" },
  { value: "100", label: "Default" },
  { value: "112", label: "Large" },
  { value: "125", label: "Largest" },
] as const;

const MOTION_NOTES: Record<Preferences["motion"], string> = {
  system: "Full: transitions, entrances and the light that drifts behind some themes. If your device asks for less motion, that wins.",
  calm: "Calm: transitions and entrances stay; nothing moves on its own.",
  reduce: "Reduced: everything is still here, whatever your device is set to.",
};

/** Every control saves as it is changed. There is no Save button to forget. */
export function AppearanceSettings() {
  const { preferences, update } = usePreferences();

  return (
    <Panel title="Appearance" note="Changes apply at once and follow you to your other devices.">
      <div className="space-y-3 py-4">
        <div>
          <p className="text-sm font-medium text-text-primary">Theme</p>
          <p className="text-sm text-text-secondary">The whole look of the paper. Every theme has a day and a night version.</p>
        </div>
        <PalettePicker onChoose={(palette) => update({ palette })} />
      </div>

      <SettingRow label="Colour scheme" note="Day or night in your theme, or follow your device.">
        <Segmented legend="Colour scheme" options={MODE_OPTIONS} value={preferences.mode} onChange={(mode) => update({ mode })} />
      </SettingRow>

      <div className="py-4">
        <Switch
          label="High contrast"
          description="Stronger text and rules in any theme, with every line of text held to 7:1. Turns off glass and glow."
          checked={preferences.contrast}
          onCheckedChange={(contrast) => update({ contrast })}
        />
      </div>

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

      <SettingRow label="Motion" note={MOTION_NOTES[preferences.motion]}>
        <Segmented legend="Motion" options={MOTION_OPTIONS} value={preferences.motion} onChange={(motion) => update({ motion })} />
      </SettingRow>
    </Panel>
  );
}
