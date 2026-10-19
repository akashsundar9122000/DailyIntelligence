import type { ReactNode } from "react";

import { cn } from "./cn";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "press" | "outline";

/*
 * Tags in small capitals, like a newspaper's labels. `press` is the one red
 * tag -- Breaking, Live -- and is filled; `outline` is the ruled tag for kinds
 * of content (Official, Preprint, Sample).
 */
const tones: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-text-secondary",
  accent: "bg-ink text-on-ink",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  info: "bg-info-subtle text-info",
  press: "bg-press-solid text-on-press",
  outline: "border border-current text-text-primary",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase leading-none tracking-[0.08em]", tones[tone], className)}>
      {children}
    </span>
  );
}

/**
 * A filter chip: a toggle, so it is a button with aria-pressed. A chip that is
 * only styled differently when selected tells a screen-reader user nothing.
 */
export function Chip({
  selected = false,
  onSelect,
  children,
  className,
}: {
  selected?: boolean;
  onSelect?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "inline-flex h-9 items-center rounded-md border px-3.5 text-sm font-medium transition-colors coarse:h-11",
        selected
          ? "border-text-primary bg-ink text-on-ink"
          : "border-border-strong bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary",
        className,
      )}
    >
      {children}
    </button>
  );
}
