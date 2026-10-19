import { DEFAULT_PREFERENCES, type Preferences } from "./preferences";

/** Where the browser keeps the last known preferences, so they apply before the page paints. */
export const PREFERENCES_STORAGE_KEY = "app-prefs";

/**
 * Put the appearance preferences on <html>. CSS does the rest, through
 * attribute selectors in tokens.css. The palette, mode and contrast are
 * handled by lib/design/theme, which also keeps them for signed-out pages.
 */
export function applyAppearance(preferences: Pick<Preferences, "density" | "textSize" | "motion">): void {
  const root = document.documentElement;
  const setOrClear = (name: string, value: string, fallback: string) => {
    if (value === fallback) delete root.dataset[name];
    else root.dataset[name] = value;
  };
  setOrClear("density", preferences.density, DEFAULT_PREFERENCES.density);
  setOrClear("textSize", String(preferences.textSize), String(DEFAULT_PREFERENCES.textSize));
  setOrClear("motion", preferences.motion, DEFAULT_PREFERENCES.motion);
}

/**
 * The second half of the pre-paint script: appearance from the cached
 * preferences. Values are checked against fixed lists before they are written
 * to the DOM, because localStorage is writable by anything on the page.
 */
export const appearanceScript = `(function(){try{
var p=JSON.parse(localStorage.getItem('${PREFERENCES_STORAGE_KEY}')||'{}'),d=document.documentElement;
if(p.density==='compact')d.dataset.density='compact';
if([90,112,125].indexOf(p.textSize)>-1)d.dataset.textSize=String(p.textSize);
if(p.motion==='reduce'||p.motion==='calm')d.dataset.motion=p.motion;
}catch(e){}})();`;
