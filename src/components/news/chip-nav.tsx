"use client";

import Link from "next/link";
import { useRef } from "react";

import { cn } from "@/components/ui/cn";
import { useScrollEdges } from "@/components/ui/use-scroll-edges";

export type ChipLink = { href: string; label: string; current: boolean };

/**
 * A row of filter chips that are LINKS, not buttons: a filtered page has its
 * own address, so it can be shared, reloaded and reached with Back. The row
 * scrolls sideways on a phone rather than wrapping into a wall of chips.
 */
export function ChipNav({ label, chips, className }: { label: string; chips: ChipLink[]; className?: string }) {
  const row = useRef<HTMLUListElement>(null);
  useScrollEdges(row);
  return (
    <nav aria-label={label} className={cn("min-w-0", className)}>
      <ul ref={row} className="scroll-fade flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {chips.map((chip) => (
          <li key={chip.href} className="shrink-0">
            <Link
              href={chip.href}
              aria-current={chip.current ? "page" : undefined}
              scroll={false}
              className={cn(
                "inline-flex h-9 items-center rounded-md border px-3.5 text-sm transition-colors coarse:h-11",
                chip.current ? "border-text-primary bg-ink font-semibold text-on-ink" : "border-border-strong text-text-secondary hover:bg-surface-hover hover:text-text-primary",
              )}
            >
              {chip.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
