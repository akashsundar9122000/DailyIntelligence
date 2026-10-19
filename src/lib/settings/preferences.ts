import { z } from "zod";

import { NAV_ITEMS } from "@/config/navigation";
import { DEFAULT_PALETTE, LEGACY_PALETTE, PALETTES } from "@/lib/design/palettes";
import { THEMES } from "@/lib/design/theme-script";

/**
 * Every stored reading preference: its allowed values and its default.
 *
 * This is a WHITELIST. A key that is not here is not stored, and a value that
 * does not validate is refused, so the preferences column can never become a
 * place where arbitrary client data accumulates.
 *
 * Interests, follows and mutes are not preferences: they are rows of their own
 * (user_interests), because each one is explicit, explainable and removable.
 * Notification rules live in notification_preferences for the same reason.
 *
 * No `server-only`: the browser needs the option lists and the defaults too.
 */
export const TEXT_SIZES = [90, 100, 112, 125] as const;
export const DENSITIES = ["comfortable", "compact"] as const;
/**
 * "system" is Full motion, unless the OS asks for less -- the OS setting always
 * wins. "calm" keeps transitions and stops anything that moves on its own;
 * "reduce" stills everything, whatever the OS says.
 */
export const MOTION = ["system", "calm", "reduce"] as const;
/** How long an explainer is by default. The reader can switch on any story. */
export const READING_STYLES = ["concise", "balanced", "deep"] as const;
export type ReadingStyle = (typeof READING_STYLES)[number];
/** Which edition the feed opens on. */
export const SCOPES = ["both", "india", "global"] as const;
export const LANGUAGES = ["en"] as const;

const LANDING_PAGES = NAV_ITEMS.filter((item) => item.landing).map((item) => item.href);

export const preferencesSchema = z.object({
  /** The look. */
  palette: z.enum(PALETTES),
  /**
   * Day, night or match the device. Called `mode`, not `theme`: a stored
   * `theme` is the vocabulary from before palettes, and keeping the new key
   * distinct is what lets resolvePreferences() tell the two apart (below).
   */
  mode: z.enum(["system", ...THEMES]),
  /** High contrast, over any palette and mode. */
  contrast: z.boolean(),
  textSize: z.union([z.literal(90), z.literal(100), z.literal(112), z.literal(125)]),
  density: z.enum(DENSITIES),
  motion: z.enum(MOTION),
  readingStyle: z.enum(READING_STYLES),
  defaultScope: z.enum(SCOPES),
  language: z.enum(LANGUAGES),
  /**
   * Whether the stories a reader opens are remembered. Used for "what changed
   * since your last visit" and to keep read stories from resurfacing. Off
   * means nothing is recorded, not that it is recorded and hidden.
   */
  readingHistory: z.boolean(),
  /**
   * Whether the feed is ordered by the reader's interests. Off, every reader
   * sees the same edition for their scope, ordered by importance and recency.
   */
  personalisation: z.boolean(),
  /** The page shown after signing in. */
  landingPage: z.string().refine((value) => LANDING_PAGES.includes(value), "Choose one of the listed pages."),
});

export type Preferences = z.infer<typeof preferencesSchema>;
export type PreferenceKey = keyof Preferences;

export const DEFAULT_PREFERENCES: Preferences = {
  palette: DEFAULT_PALETTE,
  mode: "system",
  contrast: false,
  textSize: 100,
  density: "comfortable",
  motion: "system",
  readingStyle: "balanced",
  defaultScope: "both",
  language: "en",
  readingHistory: true,
  personalisation: true,
  landingPage: "/app",
};

export const LANDING_PAGE_OPTIONS = NAV_ITEMS.filter((item) => item.landing).map((item) => ({
  value: item.href,
  label: item.label,
}));

/**
 * Stored values over defaults. Anything stored that no longer validates -- a
 * value from an option since removed -- falls back to its default, key by key,
 * rather than failing the whole read.
 *
 * A stored `theme` is from before palettes: "light", "dark" or "contrast",
 * each chosen in the Newspaper look. The reader keeps Newspaper in that mode
 * (and with high contrast, for "contrast") instead of being moved to the new
 * default. The next save writes the new keys and drops `theme`, because
 * sparsePreferences() writes only keys the schema knows.
 */
export function resolvePreferences(stored: unknown): Preferences {
  const input = stored && typeof stored === "object" ? { ...(stored as Record<string, unknown>) } : {};
  const legacy = input.theme;
  if (legacy === "light" || legacy === "dark" || legacy === "contrast") {
    if (!("palette" in input)) input.palette = LEGACY_PALETTE;
    if (!("mode" in input)) input.mode = legacy === "contrast" ? "light" : legacy;
    if (!("contrast" in input) && legacy === "contrast") input.contrast = true;
  }
  const resolved: Record<string, unknown> = { ...DEFAULT_PREFERENCES };
  for (const key of Object.keys(DEFAULT_PREFERENCES) as PreferenceKey[]) {
    if (!(key in input)) continue;
    const parsed = preferencesSchema.shape[key].safeParse(input[key]);
    if (parsed.success) resolved[key] = parsed.data;
  }
  return resolved as Preferences;
}

/**
 * Only what differs from the defaults. Storing the defaults would freeze them:
 * a default improved later would never reach anybody who had once saved.
 */
export function sparsePreferences(preferences: Preferences): Partial<Preferences> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_PREFERENCES) as PreferenceKey[]) {
    if (preferences[key] !== DEFAULT_PREFERENCES[key]) out[key] = preferences[key];
  }
  return out as Partial<Preferences>;
}

/** A partial update: any subset of keys, each validated. Unknown keys are rejected, not ignored. */
export const preferencesPatchSchema = preferencesSchema.partial().strict();
