"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { toast } from "@/components/ui/toast";
import { savePreferencesAction } from "@/lib/actions/preferences";
import { setThemePreference } from "@/lib/design/theme";

import { applyAppearance, PREFERENCES_STORAGE_KEY } from "./apply";
import type { Preferences } from "./preferences";

type Store = {
  preferences: Preferences;
  /** Apply at once, then save. If the save is refused, the server's value is restored and the user is told. */
  update: (patch: Partial<Preferences>) => void;
  saving: boolean;
};

const PreferencesContext = createContext<Store | null>(null);

function applyAll(preferences: Preferences): void {
  applyAppearance(preferences);
  setThemePreference(preferences.theme);
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Private browsing: they apply for this visit and are fetched again next time.
  }
}

const SAVE_DELAY_MS = 250;

/**
 * The signed-in user's preferences, in the browser.
 *
 * A change is applied immediately and saved a moment later, so dragging through
 * five theme options is one request and not five. Only one save is in flight at
 * a time; changes made meanwhile are merged and sent when it returns.
 */
export function PreferencesProvider({ initial, children }: { initial: Preferences; children: ReactNode }) {
  const [preferences, setPreferences] = useState(initial);
  const [saving, setSaving] = useState(false);
  const confirmed = useRef(initial);
  const pending = useRef<Partial<Preferences>>({});
  const timer = useRef<number | null>(null);
  const inFlight = useRef(false);

  /*
   * A preference can also be changed outside this store: the research page
   * saves the reader's consent itself and re-reads the page. When the server
   * then hands down different values, the keys that changed THERE are taken
   * up here. Only those keys: one the reader has just changed in this browser,
   * and which is still on its way to the server, is left alone.
   */
  const [fromServer, setFromServer] = useState(initial);
  if (fromServer !== initial) {
    const changed = (Object.keys(initial) as (keyof Preferences)[]).filter((key) => initial[key] !== fromServer[key]);
    setFromServer(initial);
    if (changed.length > 0) setPreferences((current) => ({ ...current, ...Object.fromEntries(changed.map((key) => [key, initial[key]])) }));
  }

  // The server's values win over whatever the browser cached from last time.
  useEffect(() => {
    applyAll(initial);
  }, [initial]);

  const flush = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);

    // A loop, not a re-entry: whatever was changed while a save was in flight
    // is picked up on the next pass, still one request at a time.
    while (Object.keys(pending.current).length > 0) {
      const patch = pending.current;
      pending.current = {};
      const result = await savePreferencesAction(patch).catch(() => null);

      if (result?.ok) {
        confirmed.current = result.data;
        // Anything changed meanwhile is still pending; keep showing it.
        const merged = { ...result.data, ...pending.current };
        setPreferences(merged);
        applyAll(merged);
      } else {
        pending.current = {};
        setPreferences(confirmed.current);
        applyAll(confirmed.current);
        toast.error(result?.message ?? "Your settings could not be saved. Check your connection and try again.");
      }
    }

    inFlight.current = false;
    setSaving(false);
  }, []);

  const update = useCallback(
    (patch: Partial<Preferences>) => {
      setPreferences((current) => {
        const next = { ...current, ...patch };
        applyAll(next);
        return next;
      });
      pending.current = { ...pending.current, ...patch };
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  const store = useMemo(() => ({ preferences, update, saving }), [preferences, update, saving]);
  return <PreferencesContext.Provider value={store}>{children}</PreferencesContext.Provider>;
}

/** Inside the signed-in shell. Throws elsewhere: a settings control with no store saves nothing. */
export function usePreferences(): Store {
  const store = useContext(PreferencesContext);
  if (!store) throw new Error("usePreferences must be used inside PreferencesProvider.");
  return store;
}

