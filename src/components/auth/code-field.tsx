"use client";

import { TextField } from "@/components/ui/field";

/**
 * A six-digit code. One field, not six boxes: it can be pasted into, a password
 * manager or the phone's keyboard can fill it from the message, and a screen
 * reader announces one input rather than six.
 */
export function CodeField({
  value,
  onChange,
  label = "Six-digit code",
  hint,
  error,
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <TextField
      label={label}
      hint={hint}
      error={error}
      name="code"
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      maxLength={6}
      required
      placeholder="000000"
    />
  );
}
