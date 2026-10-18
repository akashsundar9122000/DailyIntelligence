"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { cn } from "./cn";

export type PillTab = { href: string; label: string; /** Current only on this exact path: for a first tab whose address is the parent of the others. */ exact?: boolean };

/**
 * Tabs that are routes. Each is a real link, so a tab can be opened in a new
 * window, bookmarked and reached with the back button -- none of which a
 * client-state tab strip gives you.
 *
 * The strip scrolls sideways on a phone rather than wrapping: ten tabs wrapped
 * onto four lines push the content they navigate off the screen.
 */
export function PillTabs({ label, tabs, className }: { label: string; tabs: PillTab[]; className?: string }) {
  const pathname = usePathname();
  const strip = useRef<HTMLUListElement>(null);

  // On a phone the strip is wider than the screen. Arriving on the fourth tab,
  // the reader must be able to see which tab they are on.
  useEffect(() => {
    const list = strip.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !current) return;
    const target = current.offsetLeft - (list.clientWidth - current.offsetWidth) / 2;
    list.scrollTo({ left: Math.max(0, target) });
  }, [pathname]);

  return (
    <nav aria-label={label} className={cn("min-w-0", className)}>
      <ul ref={strip} className="relative flex gap-1 overflow-x-auto border-b border-border-strong [scrollbar-width:none]">
        {tabs.map((tab) => {
          const current = pathname === tab.href || (!tab.exact && pathname.startsWith(`${tab.href}/`));
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "-mb-px flex h-10 items-center border-b-[3px] px-3 text-sm coarse:h-11",
                  current ? "border-text-primary font-semibold text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
