import type { Palette } from "@/lib/design/palettes";
import type { ThemePreference } from "@/lib/design/theme-script";
import type { Preferences } from "@/lib/settings/preferences";

/**
 * What each appearance choice is called and how it is described, in one place.
 * The settings page, the profile menu's switcher and the landing page's theme
 * strip all read these, so a look is never called two things.
 */
export const PALETTE_COPY: Record<Palette, { name: string; summary: string }> = {
  aurora: {
    name: "Aurora",
    summary: "Violet and teal light behind frosted cards. Modern, colourful and the most animated.",
  },
  newspaper: {
    name: "Newspaper",
    summary: "Ink on newsprint, ruled like a broadsheet. One spot of red, for breaking news only.",
  },
};

/** "Edition" means India / World / Both; this is the day/night control, and is never called an edition. */
export const MODE_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Match device" },
  { value: "light", label: "Day" },
  { value: "dark", label: "Night" },
];

export const MOTION_OPTIONS: { value: Preferences["motion"]; label: string }[] = [
  { value: "system", label: "Full" },
  { value: "calm", label: "Calm" },
  { value: "reduce", label: "Reduced" },
];
