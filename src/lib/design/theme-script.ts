/**
 * The appearance vocabulary and the pre-paint script, in a module with no
 * "use client" so the root layout (a server component) can import the string.
 *
 * Three independent choices, each an attribute on <html>:
 *
 *   data-palette    the look: aurora, newspaper (lib/design/palettes.ts)
 *   data-theme      the MODE, always concrete: light or dark. "Match device"
 *                   is resolved here, before paint, and never stored.
 *   data-contrast   "more" when high contrast is on, over any palette and mode
 */
import { DEFAULT_PALETTE, LEGACY_PALETTE, PALETTES } from "./palettes";

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** What the user chose. "system" is the absence of a choice, and is never stored. */
export type ThemePreference = "system" | Theme;

export const PALETTE_STORAGE_KEY = "app-palette";
export const MODE_STORAGE_KEY = "app-mode";
export const CONTRAST_STORAGE_KEY = "app-contrast";
/**
 * Where a visitor's choice was kept before palettes existed: "light", "dark"
 * or "contrast", all of them chosen in the Newspaper look. Read once, mapped
 * onto the new keys, and removed -- never written again, so a value there can
 * only ever mean the old vocabulary.
 */
export const LEGACY_THEME_STORAGE_KEY = "app-theme";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/**
 * Runs SYNCHRONOUSLY in <head>, before first paint. Anything that runs after
 * hydration flashes the wrong look.
 *
 * The defaults are written FIRST, outside the try: storage throws in some
 * private windows, and a page with no data-palette would fall back to the
 * CSS default -- correct, but by a different path than the one the tests
 * exercise.
 *
 * A legacy "app-theme" with no "app-palette" beside it is a returning visitor
 * who chose Day, Night or High contrast in the Newspaper look: they keep
 * Newspaper, in that mode, rather than being moved to the new default.
 *
 * <html> needs suppressHydrationWarning because this mutates its attributes
 * before React sees them.
 */
export const themeScript = `(function(){
var d=document.documentElement,P=${JSON.stringify(PALETTES)},M=${JSON.stringify(THEMES)};
var dark=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
d.dataset.palette='${DEFAULT_PALETTE}';d.dataset.theme=dark;d.dataset.themePref='system';
try{
var s=localStorage,pal=s.getItem('${PALETTE_STORAGE_KEY}'),mode=s.getItem('${MODE_STORAGE_KEY}'),con=s.getItem('${CONTRAST_STORAGE_KEY}')==='more',old=s.getItem('${LEGACY_THEME_STORAGE_KEY}');
if(P.indexOf(pal)<0&&(old==='light'||old==='dark'||old==='contrast')){
pal='${LEGACY_PALETTE}';if(M.indexOf(mode)<0)mode=old==='contrast'?'light':old;if(old==='contrast')con=true;
s.setItem('${PALETTE_STORAGE_KEY}',pal);s.setItem('${MODE_STORAGE_KEY}',mode);if(con)s.setItem('${CONTRAST_STORAGE_KEY}','more');
}
if(old!==null)s.removeItem('${LEGACY_THEME_STORAGE_KEY}');
if(P.indexOf(pal)>-1)d.dataset.palette=pal;
if(M.indexOf(mode)>-1){d.dataset.theme=mode;d.dataset.themePref=mode;}
if(con)d.dataset.contrast='more';
}catch(e){}})();`;
