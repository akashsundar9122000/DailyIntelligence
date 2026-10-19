"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";

import { cn } from "@/components/ui/cn";
import { useReturnFocus } from "@/components/ui/use-return-focus";
import { NAV_ITEMS, type NavItem } from "@/config/navigation";

/** Case-insensitive match on the label or the summary; label matches first. */
export function searchDestinations(query: string, items: NavItem[] = NAV_ITEMS): NavItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  const inLabel = items.filter((item) => item.label.toLowerCase().includes(needle));
  const inSummary = items.filter((item) => !inLabel.includes(item) && item.summary.toLowerCase().includes(needle));
  return [...inLabel, ...inSummary];
}

/**
 * Jump anywhere with the keyboard. It searches the product's own pages; stories,
 * sources and topics are searched on the Explore page, and the palette says so
 * rather than returning made-up results.
 *
 * A combobox driving a listbox: focus stays in the input and aria-activedescendant
 * names the highlighted option, so typing never has to stop to move focus.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchDestinations(query), [query]);
  const highlighted = Math.min(active, Math.max(results.length - 1, 0));
  const returnFocus = useReturnFocus();

  function close(next: boolean) {
    if (!next) {
      setQuery("");
      setActive(0);
    }
    onOpenChange(next);
  }

  function go(item: NavItem) {
    close(false);
    router.push(item.href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(results.length ? (highlighted + 1) % results.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(results.length ? (highlighted - 1 + results.length) % results.length : 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = results[highlighted];
      if (item) go(item);
    }
  }

  return (
    <RadixDialog.Root open={open} onOpenChange={close}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-overlay fixed inset-0 z-[var(--z-overlay)] bg-ink/40 backdrop-blur-[2px]" />
        <RadixDialog.Content
          {...returnFocus}
          aria-describedby={undefined}
          className="dialog-panel fixed inset-x-3 top-[10dvh] z-[var(--z-overlay)] mx-auto flex max-h-[70dvh] max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-lg focus-visible:outline-none"
        >
          <RadixDialog.Title className="sr-only">Search and go to</RadixDialog.Title>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-text-secondary" aria-hidden />
            <input
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={results[highlighted] ? `${listId}-${highlighted}` : undefined}
              aria-autocomplete="list"
              aria-label="Search pages"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Go to a page…"
              className="h-13 w-full bg-transparent text-text-primary placeholder:text-text-tertiary focus-visible:outline-none"
            />
          </div>
          <ul id={listId} role="listbox" aria-label="Pages" className="min-h-0 flex-1 overflow-y-auto p-2">
            {results.map((item, index) => (
              <li
                key={item.href}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === highlighted}
                onMouseMove={() => setActive(index)}
                onClick={() => go(item)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5",
                  index === highlighted ? "bg-accent-subtle" : "",
                )}
              >
                <item.icon className="size-4 shrink-0 text-text-secondary" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text-primary">{item.label}</span>
                  <span className="block truncate text-xs text-text-secondary">{item.summary}</span>
                </span>
              </li>
            ))}
          </ul>
          {results.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-text-secondary" role="status">
              No page matches “{query}”. To search stories, sources and topics, use Explore.
            </p>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Opens on ⌘K or Ctrl+K anywhere, and on "/" when the reader is not typing. */
export function usePaletteShortcut(onOpen: () => void): void {
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      const typing = event.target instanceof HTMLElement && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName));
      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpen();
      } else if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        onOpen();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen]);
}
