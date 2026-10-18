"use client";

import { useId } from "react";

import { cn } from "./cn";

export type SegmentedOption<V extends string> = { value: V; label: string };

/**
 * A single choice from a short set, shown all at once.
 *
 * Native radio inputs under the styling, not buttons with role="radio": the
 * browser then supplies arrow-key movement, the single tab stop and the
 * "2 of 5" announcement, none of which survive a hand-rolled version intact.
 */
export function Segmented<V extends string>({
  legend,
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  /** Names the group. Read out, not shown: the surrounding label is usually visible already. */
  legend: string;
  options: readonly SegmentedOption<V>[];
  value: V;
  onChange: (next: V) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="sr-only">{legend}</legend>
      <div className="inline-flex max-w-full flex-wrap gap-1 border border-border-strong bg-surface-sunken p-1">
        {options.map((option) => (
          <label key={option.value} className="relative">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex cursor-pointer items-center font-medium text-text-secondary coarse:h-11",
                size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3 text-sm",
                "peer-checked:bg-ink peer-checked:text-on-ink",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
