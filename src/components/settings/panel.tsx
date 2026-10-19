import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";

/**
 * A titled group of settings, as a region named by its title, so a screen
 * reader's landmark list reads "This device, Pause, Your devices" rather than
 * one undivided page. The id comes from the title: titles are unique on a page.
 */
export function Panel({ title, note, children, className }: { title: string; note?: ReactNode; children: ReactNode; className?: string }) {
  const id = `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  return (
    <section aria-labelledby={id}>
      <Card className={cn("p-[var(--pad-card)] sm:p-6", className)}>
        <div className="space-y-1 pb-2">
          <h2 id={id} className="font-display text-xl font-bold text-text-primary">
            {title}
          </h2>
          {note ? <p className="max-w-[70ch] text-sm text-text-secondary">{note}</p> : null}
        </div>
        <div className="divide-y divide-border">{children}</div>
      </Card>
    </section>
  );
}

/**
 * One setting: what it is on the left, the control on the right. On a phone the
 * control drops beneath its label and takes the full width, where a thumb can
 * reach it.
 */
export function SettingRow({ label, note, children }: { label: string; note?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {note ? <p className="text-sm text-text-secondary">{note}</p> : null}
      </div>
      <div className="min-w-0 sm:justify-self-end">{children}</div>
    </div>
  );
}
