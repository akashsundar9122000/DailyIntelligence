"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A long list, cut short on a phone. The rows past the first few carry
 * `data-extra` (set by whoever renders them, so the server decides the cut and
 * nothing moves on hydration) and are hidden below the desktop breakpoint until
 * the reader asks for them. A desktop column has the room; a phone scrolled
 * through fifteen thousand pixels of one story.
 *
 * A row can be the target of a link -- the explainer's citations point into
 * "Every source" -- so a fragment that lands on a hidden row opens the list
 * first. Without it, a citation tap on a phone went nowhere.
 */
export function ShowMore({ total, limit, noun, children }: { total: number; limit: number; noun: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function reveal() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      // offsetParent is null only for an element that is not rendered: a row the cut is hiding.
      if (!target || !box.current?.contains(target) || target.offsetParent !== null) return;
      setOpen(true);
      requestAnimationFrame(() => target.scrollIntoView());
    }
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);

  return (
    <div ref={box} data-collapsed={open ? undefined : ""} className="max-lg:data-collapsed:[&_[data-extra]]:hidden">
      {children}
      {!open && total > limit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 flex min-h-11 w-full items-center justify-center border border-border-strong text-sm font-semibold text-text-primary hover:bg-surface-hover lg:hidden"
        >
          Show all {total} {noun}
        </button>
      ) : null}
    </div>
  );
}
