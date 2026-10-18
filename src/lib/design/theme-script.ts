/**
 * The theme vocabulary and the pre-paint script, in a module with no
 * "use client" so the root layout (a server component) can import the string.
 *
 *   light     the morning edition: newsprint and ink
 *   dark      the night edition: warm off-white on warm near-black
 *   contrast  black on white, every text pair held to 7:1
 */

export const THEMES = ["light", "dark", "contrast"] as const;
export type Theme = (typeof THEMES)[number];

/** What the user chose. "system" is the absence of a choice, and is never stored. */
export type ThemePreference = "system" | Theme;

export const THEME_STORAGE_KEY = "app-theme";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/**
 * Runs SYNCHRONOUSLY in <head>, before first paint. Anything that runs after
 * hydration flashes the wrong theme.
 *
 * It always writes a concrete theme to data-theme, resolving "system" itself,
 * so CSS never has to ask which of two selectors applies. The resolved system
 * value is deliberately NOT persisted: following the OS stays the default until
 * the user says otherwise.
 *
 * <html> needs suppressHydrationWarning because this mutates the attribute
 * before React sees it.
 */
export const themeScript = `(function(){try{
var ok=${JSON.stringify(THEMES)};
var p=localStorage.getItem('${THEME_STORAGE_KEY}');
var chosen=ok.indexOf(p)>-1;
var d=document.documentElement;
d.dataset.theme=chosen?p:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
d.dataset.themePref=chosen?p:'system';
}catch(e){}})();`;
