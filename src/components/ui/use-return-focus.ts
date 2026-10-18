"use client";

import { useRef } from "react";

/**
 * Put keyboard focus back where it was when an overlay closes.
 *
 * Radix returns focus only to a Trigger it owns. An overlay opened from state
 * -- a keyboard shortcut, a confirm step after an action -- has none, so on
 * close focus falls to <body>: a keyboard user is sent back to the top of the
 * page, and a screen reader loses its place entirely.
 *
 * `onOpenAutoFocus` fires before focus moves in, which is the last moment the
 * element that opened the overlay is still the active one.
 */
export function useReturnFocus() {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    },
    onCloseAutoFocus: (event: Event) => {
      const target = opener.current;
      opener.current = null;
      // The opener may have been removed while the overlay was up (a deleted row).
      if (target && target.isConnected) {
        event.preventDefault();
        target.focus();
      }
    },
  };
}
