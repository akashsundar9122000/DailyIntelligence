import { z } from "zod";

import { NAV_ITEMS } from "@/config/navigation";
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
/** "system" follows the OS; "reduce" turns motion down whatever the OS says. */
export const MOTION = ["system", "reduce"] as const;
/** How long an explainer is by default. The reader can switch on any story. */
export const READING_STYLES = ["concise", "balanced", "deep"] as const;
/** Which edition the feed opens on. */
export const SCOPES = ["both", "india", "global"] as const;
export const LANGUAGES = ["en"] as const;

const LANDING_PAGES = NAV_ITEMS.filter((item) => item.landing).map((item) => item.href);

export const preferencesSchema = z.object({
  theme: z.enum(["system", ...THEMES]),
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
  theme: "system",
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
 */
export function resolvePreferences(stored: unknown): Preferences {
  const input = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
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
