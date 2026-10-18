"use client";

import { useRef } from "react";

import { cn } from "@/components/ui/cn";

/**
 * Six single-digit boxes that behave as ONE field: typing advances, Backspace
 * goes back, the arrow keys move, and pasting a whole code fills every box.
 * The first box carries `autocomplete="one-time-code"`, so a phone's keyboard
 * can offer the code from the email it just received.
 *
 * Wrapped in a fieldset with a legend, so a screen reader announces "Sign-in
 * code, group" once rather than six unexplained inputs.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  length = 6,
  label,
  invalid,
  describedBy,
  autoFocus,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Called once all digits are present, so the form can submit itself. */
  onComplete?: (code: string) => void;
  length?: number;
  label: string;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? "");

  function commit(next: string) {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  }

  return (
    <fieldset disabled={disabled} aria-describedby={describedBy}>
      <legend className="sr-only">{label}</legend>
      <div
        className="grid grid-cols-6 gap-2 sm:gap-3"
        onPaste={(event) => {
          const text = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
          if (!text) return;
          event.preventDefault();
          commit(text);
          refs.current[Math.min(text.length, length - 1)]?.focus();
        }}
      >
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              refs.current[index] = element;
            }}
            value={digit}
            autoFocus={autoFocus && index === 0}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={`${label}, digit ${index + 1} of ${length}`}
            aria-invalid={invalid || undefined}
            maxLength={length}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              const typed = event.target.value.replace(/\D/g, "");
              if (typed.length > 1) {
                // A keyboard's one-time-code suggestion arrives as the whole code in one box.
                commit(typed);
                refs.current[Math.min(typed.length, length - 1)]?.focus();
                return;
              }
              commit(value.slice(0, index) + typed + value.slice(index + 1));
              if (typed) refs.current[index + 1]?.focus();
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digit && index > 0) {
                event.preventDefault();
                commit(value.slice(0, index - 1) + value.slice(index));
                refs.current[index - 1]?.focus();
              }
              if (event.key === "ArrowLeft") refs.current[index - 1]?.focus();
              if (event.key === "ArrowRight") refs.current[index + 1]?.focus();
            }}
            className={cn(
              "h-14 w-full min-w-0 border-b-[3px] bg-surface-sunken text-center font-display text-3xl font-bold text-text-primary tabular-nums transition-colors sm:h-16",
              "focus-visible:border-text-primary focus-visible:bg-surface focus-visible:outline-none disabled:opacity-60",
              invalid ? "border-danger" : digit ? "border-text-primary" : "border-border-input",
            )}
          />
        ))}
      </div>
    </fieldset>
  );
}
