"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "./cn";
import { Select, type SelectOption } from "./select";

const control =
  "h-10 w-full rounded-md border border-border-input bg-surface px-3 text-text-primary placeholder:text-text-tertiary " +
  "coarse:h-11 disabled:cursor-not-allowed disabled:opacity-60 " +
  "aria-[invalid=true]:border-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type FieldShell = {
  label: string;
  /** Shown under the control. Explains what is wanted, before anything goes wrong. */
  hint?: string;
  /** Shown under the control and announced. Says what to do, not only what is wrong. */
  error?: string;
  /** Hide the label visually. It is still read out; a placeholder is not a label. */
  labelHidden?: boolean;
  className?: string;
};

function Shell({
  id,
  label,
  hint,
  error,
  labelHidden,
  className,
  children,
}: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label id={`${id}-label`} htmlFor={id} className={cn("block text-sm font-medium text-text-primary", labelHidden && "sr-only")}>
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-text-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function TextField({
  label,
  hint,
  error,
  labelHidden,
  className,
  id: givenId,
  ...props
}: FieldShell & Omit<InputHTMLAttributes<HTMLInputElement>, "className">) {
  const generated = useId();
  const id = givenId ?? generated;
  return (
    <Shell id={id} label={label} hint={hint} error={error} labelHidden={labelHidden} className={className}>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} className={control} {...props} />
    </Shell>
  );
}

/**
 * A labelled choice from a list: the paper's own dropdown (./select), with a
 * search box once the list is long. The trigger is named by the label and
 * reads the current choice as its value, as the ARIA select pattern does.
 */
export function SelectField<V extends string>({
  label,
  hint,
  error,
  labelHidden,
  className,
  id: givenId,
  ...props
}: FieldShell & {
  id?: string;
  options: readonly SelectOption<V>[];
  value?: V;
  defaultValue?: V;
  onChange?: (next: V) => void;
  name?: string;
  searchable?: boolean;
  disabled?: boolean;
}) {
  const generated = useId();
  const id = givenId ?? generated;
  return (
    <Shell id={id} label={label} hint={hint} error={error} labelHidden={labelHidden} className={className}>
      <Select id={id} labelledBy={`${id}-label`} describedBy={describedBy(id, hint, error)} invalid={Boolean(error)} {...props} />
    </Shell>
  );
}
