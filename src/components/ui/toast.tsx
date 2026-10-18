"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useSyncExternalStore } from "react";

import { cn } from "./cn";

type Tone = "success" | "error";
type Toast = { id: number; tone: Tone; message: string };

/*
 * A module-level store rather than context: an action's result handler should
 * be able to call toast() without being rendered inside any particular
 * provider, and a missing provider would fail silently.
 */
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const EMPTY: Toast[] = [];

function emit() {
  for (const listener of listeners) listener();
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

function push(tone: Tone, message: string): number {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, tone, message }];
  emit();
  // Errors stay until dismissed: a message that vanishes after four seconds is
  // one the person who looked away never saw.
  if (tone === "success") setTimeout(() => dismissToast(id), 4000);
  return id;
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Mount once, in the root layout. */
export function Toaster() {
  const items = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => EMPTY,
  );

  return (
    <div
      // polite, and always in the DOM: a live region created together with its
      // first message is frequently not announced at all.
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+1rem)] z-[var(--z-overlay)] flex flex-col items-center gap-2 px-4"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface-raised p-3.5 shadow-lg",
            item.tone === "error" ? "border-danger" : "border-border",
          )}
        >
          {item.tone === "error" ? (
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          ) : (
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          )}
          <p className="min-w-0 flex-1 text-sm text-text-primary">
            <span className="sr-only">{item.tone === "error" ? "Error: " : "Done: "}</span>
            {item.message}
          </p>
          <button
            type="button"
            onClick={() => dismissToast(item.id)}
            aria-label="Dismiss"
            className="-m-1.5 flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-surface-hover coarse:size-11"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
