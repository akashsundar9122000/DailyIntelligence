"use client";

import * as RadixSwitch from "@radix-ui/react-switch";
import { useId } from "react";

import { cn } from "./cn";

/** A switch with its label attached. An unlabelled switch is announced as "switch, off" and nothing more. */
export function Switch({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-text-primary">
          {label}
        </label>
        {description ? (
          <p id={`${id}-description`} className="text-sm text-text-secondary">
            {description}
          </p>
        ) : null}
      </div>
      <RadixSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={description ? `${id}-description` : undefined}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full border border-border-input bg-surface-sunken transition-colors",
          "data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:opacity-50",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        )}
      >
        <RadixSwitch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-text-secondary transition-transform data-[state=checked]:translate-x-[1.375rem] data-[state=checked]:bg-on-accent" />
      </RadixSwitch.Root>
    </div>
  );
}
