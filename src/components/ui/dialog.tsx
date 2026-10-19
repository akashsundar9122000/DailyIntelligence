"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "./button";
import { cn } from "./cn";
import { useReturnFocus } from "./use-return-focus";

type Presentation = "modal" | "drawer";

/*
 * One component, two shapes. On a phone both become a bottom sheet: a centred
 * modal on a 390px screen is a sheet with worse ergonomics, and a side drawer
 * leaves a sliver of page nobody can use.
 */
const shapes: Record<Presentation, string> = {
  modal:
    "max-lg:inset-x-0 max-lg:bottom-0 max-lg:max-h-[85dvh] max-lg:rounded-t-2xl " +
    "lg:left-1/2 lg:top-1/2 lg:w-full lg:max-w-lg lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl lg:max-h-[85dvh]",
  drawer:
    "max-lg:inset-x-0 max-lg:bottom-0 max-lg:max-h-[85dvh] max-lg:rounded-t-2xl " +
    "lg:inset-y-0 lg:right-0 lg:w-full lg:max-w-md lg:border-l",
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  presentation,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required: a dialog with no name is announced as just "dialog". */
  title: string;
  description?: string;
  presentation?: Presentation;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const returnFocus = useReturnFocus();
  const shape = shapes[presentation ?? "modal"];
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-overlay fixed inset-0 z-[var(--z-overlay)] bg-ink/40 backdrop-blur-[2px]" />
        <RadixDialog.Content
          {...returnFocus}
          // With no description Radix warns unless told there is none.
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "dialog-panel fixed z-[var(--z-overlay)] flex flex-col border border-border bg-surface-raised shadow-lg",
            "pb-[var(--safe-bottom)] focus-visible:outline-none",
            shape,
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-5">
            <div className="min-w-0 space-y-1">
              <RadixDialog.Title className="text-lg font-semibold text-text-primary">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="text-sm text-text-secondary">{description}</RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X className="size-4" aria-hidden />
              </Button>
            </RadixDialog.Close>
          </div>
          {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div> : null}
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/**
 * Asks before something that cannot be undone. The confirm button says what it
 * will do ("Delete portfolio"), never "OK": the label is the last thing read
 * before the click.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = false,
  busy = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
  busy?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      // Always centred: a question that blocks the page belongs in front of it.
      presentation="modal"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
