import { describe, expect, it } from "vitest";

import { isTheme, THEME_STORAGE_KEY, THEMES, themeScript } from "@/lib/design/theme-script";

/** Run the pre-paint script against a stand-in for the browser globals it touches. */
function run(stored: string | null, systemDark: boolean): Record<string, string> {
  const dataset: Record<string, string> = {};
  const fn = new Function("localStorage", "matchMedia", "document", themeScript);
  fn(
    { getItem: (key: string) => (key === THEME_STORAGE_KEY ? stored : null) },
    () => ({ matches: systemDark }),
    { documentElement: { dataset } },
  );
  return dataset;
}

describe("the pre-paint theme script", () => {
  it("follows the device when nothing is stored", () => {
    expect(run(null, true)).toEqual({ theme: "dark", themePref: "system" });
    expect(run(null, false)).toEqual({ theme: "light", themePref: "system" });
  });

  it("lets an explicit choice win over the device in both directions", () => {
    expect(run("light", true)).toEqual({ theme: "light", themePref: "light" });
    expect(run("dark", false)).toEqual({ theme: "dark", themePref: "dark" });
  });

  it("applies every theme it advertises", () => {
    for (const theme of THEMES) {
      expect(run(theme, false).theme).toBe(theme);
    }
  });

  it("ignores a stored value it does not recognise", () => {
    expect(run("sepia", false)).toEqual({ theme: "light", themePref: "system" });
  });

  it("leaves the page alone when storage throws", () => {
    const dataset: Record<string, string> = {};
    const fn = new Function("localStorage", "matchMedia", "document", themeScript);
    const blocked = {
      getItem: () => {
        throw new Error("storage is blocked");
      },
    };
    expect(() => fn(blocked, () => ({ matches: false }), { documentElement: { dataset } })).not.toThrow();
    expect(dataset).toEqual({});
  });

  it("narrows unknown values", () => {
    expect(isTheme("contrast")).toBe(true);
    // A theme from an earlier design, still in somebody's storage, is not a theme now.
    expect(isTheme("black")).toBe(false);
    expect(isTheme("system")).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });
});
