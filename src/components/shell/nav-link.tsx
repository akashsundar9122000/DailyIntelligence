"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/components/ui/cn";
import { navItemFor, type NavItem } from "@/config/navigation";

/** Whether this item is the section the reader is in. For You matches only itself. */
export function useIsCurrent(item: NavItem): boolean {
  const pathname = usePathname();
  return navItemFor(pathname)?.href === item.href;
}

/**
 * A rail entry, set like a newspaper's section index: a word, with a thick
 * ink rule beside the section you are in. Weight and the rule mark the
 * current one, not a coloured fill: on newsprint, colour is reserved.
 */
export function RailLink({ item, expanded }: { item: NavItem; expanded: boolean }) {
  const current = useIsCurrent(item);
  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      // Collapsed, the label is hidden, so it is the accessible name and the hover title.
      aria-label={expanded ? undefined : item.label}
      title={expanded ? undefined : item.label}
      className={cn(
        "relative flex h-10 items-center gap-3 text-sm transition-colors coarse:h-11",
        expanded ? "pl-4 pr-3" : "w-10 justify-center",
        current ? "font-semibold text-text-primary" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
      )}
    >
      {current ? <span aria-hidden className={cn("absolute inset-y-1.5 w-[3px] bg-text-primary", expanded ? "left-0" : "-left-2")} /> : null}
      <item.icon className="size-4 shrink-0" aria-hidden strokeWidth={current ? 2.25 : 1.75} />
      {expanded ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );
}

export function TabLink({ item }: { item: NavItem }) {
  const current = useIsCurrent(item);
  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem]",
        current ? "font-semibold text-text-primary" : "text-text-secondary",
      )}
    >
      {current ? <span aria-hidden className="absolute inset-x-4 top-0 h-[3px] bg-text-primary" /> : null}
      <item.icon className="size-5" aria-hidden strokeWidth={current ? 2.25 : 1.75} />
      <span className="max-w-full truncate">{item.label}</span>
    </Link>
  );
}
