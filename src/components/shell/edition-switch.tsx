"use client";

import { cn } from "@/components/ui/cn";
import { SCOPE_LABELS } from "@/config/regions";
import { usePreferences } from "@/lib/settings/client";
import { SCOPES } from "@/lib/settings/preferences";

/**
 * India, World, or both: the edition every feed opens on. A persistent global
 * control (blueprint §3), saved like any other preference, so it follows the
 * reader to another device. A page that has its own scope (India, Global)
 * ignores it rather than fighting it.
 *
 * A radio group, not three buttons: it is one choice among three, and a
 * screen reader should say so.
 */
export function EditionSwitch({ className }: { className?: string }) {
  const { preferences, update } = usePreferences();
  return (
    <div role="radiogroup" aria-label="Edition" className={cn("inline-flex items-center overflow-hidden rounded-md border border-border-strong", className)}>
      {SCOPES.map((scope) => {
        const chosen = preferences.defaultScope === scope;
        return (
          <button
            key={scope}
            type="button"
            role="radio"
            aria-checked={chosen}
            onClick={() => update({ defaultScope: scope })}
            className={cn(
              "h-8 px-3 text-xs font-semibold tracking-wide uppercase transition-colors coarse:h-11",
              chosen ? "bg-ink text-on-ink" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
            )}
          >
            {SCOPE_LABELS[scope]}
          </button>
        );
      })}
    </div>
  );
}
