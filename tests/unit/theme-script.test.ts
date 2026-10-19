import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE, isPalette, PALETTES } from "@/lib/design/palettes";
import {
  CONTRAST_STORAGE_KEY,
  isTheme,
  LEGACY_THEME_STORAGE_KEY,
  MODE_STORAGE_KEY,
  PALETTE_STORAGE_KEY,
  THEMES,
  themeScript,
} from "@/lib/design/theme-script";

/** Run the pre-paint script against a stand-in for the browser globals it touches. */
function run(stored: Record<string, string>, systemDark: boolean): { dataset: Record<string, string>; storage: Record<string, string> } {
  const dataset: Record<string, string> = {};
  const storage = { ...stored };
  const fn = new Function("localStorage", "matchMedia", "document", themeScript);
  fn(
    {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
    },
    () => ({ matches: systemDark }),
    { documentElement: { dataset } },
  );
  return { dataset, storage };
}

describe("the pre-paint theme script", () => {
  it("gives a first visit the default palette, following the device", () => {
    expect(run({}, true).dataset).toEqual({ palette: DEFAULT_PALETTE, theme: "dark", themePref: "system" });
    expect(run({}, false).dataset).toEqual({ palette: DEFAULT_PALETTE, theme: "light", themePref: "system" });
  });

  it("lets an explicit mode win over the device in both directions", () => {
    expect(run({ [MODE_STORAGE_KEY]: "light" }, true).dataset).toMatchObject({ theme: "light", themePref: "light" });
    expect(run({ [MODE_STORAGE_KEY]: "dark" }, false).dataset).toMatchObject({ theme: "dark", themePref: "dark" });
  });

  it("applies every palette and mode it advertises", () => {
    for (const palette of PALETTES) {
      for (const theme of THEMES) {
        expect(run({ [PALETTE_STORAGE_KEY]: palette, [MODE_STORAGE_KEY]: theme }, false).dataset).toMatchObject({ palette, theme });
      }
    }
  });

  it("turns high contrast on over any palette, and only when asked", () => {
    expect(run({ [CONTRAST_STORAGE_KEY]: "more" }, false).dataset).toMatchObject({ palette: DEFAULT_PALETTE, contrast: "more" });
    expect(run({ [CONTRAST_STORAGE_KEY]: "yes" }, false).dataset).not.toHaveProperty("contrast");
  });

  it("keeps a returning visitor who chose Day or Night in the Newspaper look, and moves their choice to the new keys", () => {
    const night = run({ [LEGACY_THEME_STORAGE_KEY]: "dark" }, false);
    expect(night.dataset).toEqual({ palette: "newspaper", theme: "dark", themePref: "dark" });
    expect(night.storage).toEqual({ [PALETTE_STORAGE_KEY]: "newspaper", [MODE_STORAGE_KEY]: "dark" });

    expect(run({ [LEGACY_THEME_STORAGE_KEY]: "light" }, true).dataset).toEqual({ palette: "newspaper", theme: "light", themePref: "light" });
  });

  it("maps the old High contrast theme to Newspaper by day with contrast on", () => {
    const { dataset, storage } = run({ [LEGACY_THEME_STORAGE_KEY]: "contrast" }, true);
    expect(dataset).toEqual({ palette: "newspaper", theme: "light", themePref: "light", contrast: "more" });
    expect(storage).toEqual({ [PALETTE_STORAGE_KEY]: "newspaper", [MODE_STORAGE_KEY]: "light", [CONTRAST_STORAGE_KEY]: "more" });
  });

  it("lets a palette chosen since win over a legacy value left beside it", () => {
    const { dataset, storage } = run({ [PALETTE_STORAGE_KEY]: "aurora", [LEGACY_THEME_STORAGE_KEY]: "dark" }, false);
    expect(dataset).toMatchObject({ palette: "aurora", theme: "light" });
    expect(storage).not.toHaveProperty(LEGACY_THEME_STORAGE_KEY);
  });

  it("ignores stored values it does not recognise", () => {
    expect(run({ [PALETTE_STORAGE_KEY]: "sepia", [MODE_STORAGE_KEY]: "dusk", [LEGACY_THEME_STORAGE_KEY]: "black" }, false).dataset).toEqual({
      palette: DEFAULT_PALETTE,
      theme: "light",
      themePref: "system",
    });
  });

  it("still paints the default when storage throws", () => {
    const dataset: Record<string, string> = {};
    const fn = new Function("localStorage", "matchMedia", "document", themeScript);
    const blocked = {
      getItem: () => {
        throw new Error("storage is blocked");
      },
    };
    expect(() => fn(blocked, () => ({ matches: true }), { documentElement: { dataset } })).not.toThrow();
    expect(dataset).toEqual({ palette: DEFAULT_PALETTE, theme: "dark", themePref: "system" });
  });

  it("narrows unknown values", () => {
    expect(isTheme("dark")).toBe(true);
    // Themes from an earlier design, still in somebody's storage, are not modes now.
    expect(isTheme("contrast")).toBe(false);
    expect(isTheme("black")).toBe(false);
    expect(isTheme("system")).toBe(false);
    expect(isTheme(undefined)).toBe(false);
    expect(isPalette("newspaper")).toBe(true);
    expect(isPalette("sepia")).toBe(false);
  });
});
