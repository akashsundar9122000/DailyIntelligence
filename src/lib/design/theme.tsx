/**
 * Theme: the store and the hook.
 *
 * THE DOM ATTRIBUTE IS THE SOURCE OF TRUTH, not React state. Reading it through
 * useSyncExternalStore avoids the set-state-in-effect double render and the
 * hydration mismatch that comes from guessing on the server.
 */
"use client";

import { useSyncExternalStore } from "react";

import { isTheme, THEME_STORAGE_KEY, type Theme, type ThemePreference } from "./theme-script";

const EVENT = "themechange";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function readPreference(): ThemePreference {
  const pref = document.documentElement.dataset.themePref;
  return isTheme(pref) ? pref : "system";
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

export function setThemePreference(next: ThemePreference): void {
  const root = document.documentElement;
  root.dataset.themePref = next;
  root.dataset.theme = next === "system" ? systemTheme() : next;
  try {
    if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Private browsing. The attribute is already set, so the page is correct
    // for this visit; only persistence is lost.
  }
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

/**
 * Keeps the browser's own chrome (the address bar on a phone) the colour of
 * the paper. Read from the computed --canvas token rather than written out
 * here, so the meta tag can never disagree with the theme it sits under.
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
