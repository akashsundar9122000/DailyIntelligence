/**
 * Appearance: the store and the hooks.
 *
 * THE DOM ATTRIBUTES ARE THE SOURCE OF TRUTH, not React state. Reading them
 * through useSyncExternalStore avoids the set-state-in-effect double render and
 * the hydration mismatch that comes from guessing on the server.
 */
"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_PALETTE, isPalette, type Palette } from "./palettes";
import {
  CONTRAST_STORAGE_KEY,
  isTheme,
  MODE_STORAGE_KEY,
  PALETTE_STORAGE_KEY,
  type Theme,
  type ThemePreference,
} from "./theme-script";

const EVENT = "themechange";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function readPreference(): ThemePreference {
  const pref = document.documentElement.dataset.themePref;
  return isTheme(pref) ? pref : "system";
}

function readPalette(): Palette {
  const palette = document.documentElement.dataset.palette;
  return isPalette(palette) ? palette : DEFAULT_PALETTE;
}

function readContrast(): boolean {
  return document.documentElement.dataset.contrast === "more";
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  // Live, so toggling the OS setting takes effect without a reload -- but only
  // while the user has made no explicit choice.
  const mq = window.matchMedia(DARK_QUERY);
  const onSystem = () => {
    if (readPreference() !== "system") return;
    document.documentElement.dataset.theme = systemTheme();
    onChange();
  };
  mq.addEventListener("change", onSystem);
  return () => {
    window.removeEventListener(EVENT, onChange);
    mq.removeEventListener("change", onSystem);
  };
}

function store(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private browsing. The attribute is already set, so the page is correct
    // for this visit; only persistence is lost.
  }
}

/** Day, night or match the device. */
export function setThemePreference(next: ThemePreference): void {
  const root = document.documentElement;
  root.dataset.themePref = next;
  root.dataset.theme = next === "system" ? systemTheme() : next;
  store(MODE_STORAGE_KEY, next === "system" ? null : next);
  window.dispatchEvent(new Event(EVENT));
}

/**
 * The look. Stored even when it is the default: a reader who picked it has
 * made a choice, and a later change of default should not move them.
 */
export function setPalette(next: Palette): void {
  document.documentElement.dataset.palette = next;
  store(PALETTE_STORAGE_KEY, next);
  window.dispatchEvent(new Event(EVENT));
}

export function setContrast(on: boolean): void {
  const root = document.documentElement;
  if (on) root.dataset.contrast = "more";
  else delete root.dataset.contrast;
  store(CONTRAST_STORAGE_KEY, on ? "more" : null);
  window.dispatchEvent(new Event(EVENT));
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    subscribe,
    readPreference,
    // Server snapshot. It must be a stable value, not a guess at the user's
    // preference -- the inline script has already corrected the DOM by the time
    // this matters, and guessing here is what produces a hydration mismatch.
    () => "system" as ThemePreference,
  );
}

/** The mode actually on screen, whichever preference produced it. */
export function useResolvedTheme(): Theme {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    () => "light" as Theme,
  );
}

export function usePalette(): Palette {
  return useSyncExternalStore(subscribe, readPalette, () => DEFAULT_PALETTE);
}

export function useContrast(): boolean {
  return useSyncExternalStore(subscribe, readContrast, () => false);
}

/**
 * Keeps the browser's own chrome (the address bar on a phone) the colour of
 * the page. Read from the computed --canvas token rather than written out
 * here, so the meta tag can never disagree with the look it sits under.
 */
function syncChromeColour(): void {
  const canvas = getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim();
  if (!canvas) return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = canvas;
}

/** Mounted once, in the root layout. Renders nothing. */
export function ThemeChrome(): null {
  useSyncExternalStore(
    (onChange) => {
      syncChromeColour();
      const update = () => {
        syncChromeColour();
        onChange();
      };
      window.addEventListener(EVENT, update);
      const mq = window.matchMedia(DARK_QUERY);
      mq.addEventListener("change", update);
      return () => {
        window.removeEventListener(EVENT, update);
        mq.removeEventListener("change", update);
      };
    },
    () => 0,
    () => 0,
  );
  return null;
}
