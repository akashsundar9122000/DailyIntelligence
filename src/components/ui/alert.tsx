"use client";

import { CircleAlert, CircleCheck, Info, Radio, TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "./cn";

export type AlertTone = "neutral" | "info" | "success" | "warning" | "danger" | "breaking";

/*
 * Each tone's ground, edge and type. Written out in full: Tailwind generates
 * only the class names it can read in the source. The text and ground pairs are
 * the ones check:contrast measures in every look (info on info-subtle, …);
 * "breaking" is the reserved alert colour, for breaking, live or wrong only.
 */
const TONES: Record<AlertTone, { box: string; text: string; icon: typeof Info }> = {
  neutral: { box: "border-border-strong border-l-rule bg-surface", text: "text-text-primary", icon: Info },
  info: { box: "border-info/30 border-l-info bg-info-subtle", text: "text-info", icon: Info },
  success: { box: "border-success/30 border-l-success bg-success-subtle", text: "text-success", icon: CircleCheck },
  warning: { box: "border-warning/30 border-l-warning bg-warning-subtle", text: "text-warning", icon: TriangleAlert },
  danger: { box: "border-danger/30 border-l-danger bg-danger-subtle", text: "text-danger", icon: CircleAlert },
  breaking: { box: "border-press/30 border-l-press-solid bg-press-subtle", text: "text-press", icon: Radio },
};

/**
 * A message in the page: a notice, a warning, a confirmation, an error.
 *
 * Whether it is ANNOUNCED is a separate decision from how it looks, because
 * it depends on how it arrives:
 *   - `live="assertive"` (role="alert"): an error that appears after the
 *     reader did something, and must interrupt.
 *   - `live="polite"` (role="status"): a confirmation that appears after an
 *     action, read when the reader pauses.
 *   - no `live` (role="note"): a notice that is part of the page as it loads.
 *     Announcing a page's own notices on arrival is noise.
 * A live region must already be in the page when its text changes, or nothing
 * is read; callers that announce render the Alert first and change its text.
 *
 * Every tone carries an icon and words: colour is never the only signal.
 */
export function Alert({
  tone = "neutral",
  title,
  children,
  actions,
  onDismiss,
  live,
  role,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  /** Buttons or links that act on the message. */
  actions?: ReactNode;
  /** Shows a close button. The caller decides what dismissing means and whether it is remembered. */
  onDismiss?: () => void;
  live?: "polite" | "assertive";
  /**
   * Only for an Alert placed inside a live region that is always in the page
   * (FormError): the region announces, so the Alert itself takes no role.
   */
  role?: "presentation";
  className?: string;
}) {
  const { box, text, icon: Icon } = TONES[tone];
  return (
    <div
      role={role ?? (live === "assertive" ? "alert" : live === "polite" ? "status" : "note")}
      className={cn("alert-in flex gap-3 rounded-lg border border-l-[3px] px-4 py-3 text-sm", box, className)}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", text)} />
      <div className="min-w-0 flex-1 space-y-1.5 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:space-y-0">
        <div className={cn("min-w-0 space-y-0.5", text)}>
          {title ? <p className="font-semibold">{title}</p> : null}
          {children ? <div>{children}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn(
            "-m-1.5 flex size-8 shrink-0 items-center justify-center rounded-md opacity-80 hover:opacity-100 coarse:size-11",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            text,
          )}
        >
          <X aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
