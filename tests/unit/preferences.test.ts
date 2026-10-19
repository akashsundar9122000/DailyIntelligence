import { describe, expect, it } from "vitest";

import { appearanceScript, PREFERENCES_STORAGE_KEY } from "@/lib/settings/apply";
import {
  DEFAULT_PREFERENCES,
  LANDING_PAGE_OPTIONS,
  preferencesPatchSchema,
  resolvePreferences,
  sparsePreferences,
} from "@/lib/settings/preferences";

describe("resolvePreferences", () => {
  it("returns the defaults for nothing, null or junk", () => {
    for (const stored of [undefined, null, "x", 42, []]) expect(resolvePreferences(stored)).toEqual(DEFAULT_PREFERENCES);
  });

  it("lays stored values over the defaults", () => {
    expect(resolvePreferences({ palette: "newspaper", mode: "dark", textSize: 125 })).toEqual({ ...DEFAULT_PREFERENCES, palette: "newspaper", mode: "dark", textSize: 125 });
  });

  it("gives Aurora to a reader who never chose", () => {
    expect(DEFAULT_PREFERENCES.palette).toBe("aurora");
    expect(resolvePreferences({}).palette).toBe("aurora");
  });

  it("keeps a reader who chose Day or Night before themes existed on Newspaper, in that mode", () => {
    expect(resolvePreferences({ theme: "dark", textSize: 112 })).toEqual({ ...DEFAULT_PREFERENCES, palette: "newspaper", mode: "dark", textSize: 112 });
    expect(resolvePreferences({ theme: "light" })).toMatchObject({ palette: "newspaper", mode: "light", contrast: false });
  });

  it("maps the old High contrast theme to Newspaper by day with contrast on", () => {
    expect(resolvePreferences({ theme: "contrast" })).toMatchObject({ palette: "newspaper", mode: "light", contrast: true });
  });

  it("lets keys saved since win over a legacy theme left beside them", () => {
    expect(resolvePreferences({ theme: "dark", palette: "aurora", mode: "light" })).toMatchObject({ palette: "aurora", mode: "light" });
  });

  it("does not move a reader on Match device: they get the new default", () => {
    // "system" was never stored, so there is no legacy key to find.
    expect(resolvePreferences({ density: "compact" })).toMatchObject({ palette: "aurora", mode: "system" });
  });

  it("drops a stored value that is no longer allowed, without losing the valid ones beside it", () => {
    // "black" was a theme in an earlier design; a reader who chose it falls back rather than losing everything.
    const resolved = resolvePreferences({ theme: "black", palette: "sepia", density: "compact", defaultScope: "mars", textSize: "125" });
    expect(resolved.palette).toBe(DEFAULT_PREFERENCES.palette);
    expect(resolved.mode).toBe(DEFAULT_PREFERENCES.mode);
    expect(resolved.defaultScope).toBe(DEFAULT_PREFERENCES.defaultScope);
    expect(resolved.textSize).toBe(DEFAULT_PREFERENCES.textSize);
    expect(resolved.density).toBe("compact");
  });

  it("ignores keys that are not preferences", () => {
    expect(resolvePreferences({ isAdmin: true, theme: "dark" })).not.toHaveProperty("isAdmin");
    // The legacy key itself is read, never kept: the next save writes the new keys only.
    expect(resolvePreferences({ theme: "dark" })).not.toHaveProperty("theme");
    expect(sparsePreferences(resolvePreferences({ theme: "dark" }))).toEqual({ palette: "newspaper", mode: "dark" });
  });
});

describe("sparsePreferences", () => {
  it("stores nothing when everything is at its default", () => {
    // Stored defaults would be frozen: a later improvement would never reach anyone who had saved.
    expect(sparsePreferences(DEFAULT_PREFERENCES)).toEqual({});
  });

  it("stores only what differs", () => {
    expect(sparsePreferences({ ...DEFAULT_PREFERENCES, defaultScope: "india", readingHistory: false })).toEqual({ defaultScope: "india", readingHistory: false });
  });
});

describe("a preferences update", () => {
  it("accepts any subset of valid keys", () => {
    expect(preferencesPatchSchema.safeParse({ palette: "newspaper", mode: "dark", contrast: true }).success).toBe(true);
    expect(preferencesPatchSchema.safeParse({ textSize: 112, density: "compact" }).success).toBe(true);
    expect(preferencesPatchSchema.safeParse({}).success).toBe(true);
  });

  it("refuses an unknown key rather than quietly storing it", () => {
    expect(preferencesPatchSchema.safeParse({ mode: "dark", role: "admin" }).success).toBe(false);
    // The old key is read from storage but never accepted from a client.
    expect(preferencesPatchSchema.safeParse({ theme: "dark" }).success).toBe(false);
  });

  it("refuses values outside each list", () => {
    for (const bad of [{ palette: "sepia" }, { mode: "contrast" }, { contrast: "yes" }, { defaultScope: "mars" }, { textSize: 200 }, { textSize: "112" }, { readingStyle: "epic" }, { motion: "fast" }]) {
      expect(preferencesPatchSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("only allows a landing page that is one of the product's own pages", () => {
    // This value is redirected to after sign-in; it must not be free text.
    expect(preferencesPatchSchema.safeParse({ landingPage: "/app/hot" }).success).toBe(true);
    for (const hostile of ["https://evil.example", "//evil.example", "/login", "/app/settings", "/app/search", "/app/../admin", ""]) {
      expect(preferencesPatchSchema.safeParse({ landingPage: hostile }).success, hostile).toBe(false);
    }
    expect(LANDING_PAGE_OPTIONS.map((option) => option.value)).toContain("/app");
  });

  it("offers one edition switch with exactly three positions", () => {
    for (const scope of ["both", "india", "global"]) expect(preferencesPatchSchema.safeParse({ defaultScope: scope }).success).toBe(true);
  });
});

describe("the pre-paint appearance script", () => {
  function run(stored: string | null): Record<string, string> {
    const dataset: Record<string, string> = {};
    new Function("localStorage", "document", appearanceScript)(
      { getItem: (key: string) => (key === PREFERENCES_STORAGE_KEY ? stored : null) },
      { documentElement: { dataset } },
    );
    return dataset;
  }

  it("applies cached appearance before the page paints", () => {
    expect(run(JSON.stringify({ density: "compact", textSize: 125, motion: "reduce" }))).toEqual({ density: "compact", textSize: "125", motion: "reduce" });
    expect(run(JSON.stringify({ motion: "calm" }))).toEqual({ motion: "calm" });
  });

  it("leaves the defaults as no attribute at all", () => {
    expect(run(JSON.stringify(DEFAULT_PREFERENCES))).toEqual({});
    expect(run(null)).toEqual({});
  });

  it("writes nothing it does not recognise, since anything on the page can write to storage", () => {
    expect(run(JSON.stringify({ motion: '"><script>', density: "huge", textSize: "125" }))).toEqual({});
    expect(run("{not json")).toEqual({});
  });
});
