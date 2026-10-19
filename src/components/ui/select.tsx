"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "./cn";

export type SelectOption<V extends string> = {
  value: V;
  label: string;
  /** A second line under the label, for a choice that needs explaining. */
  description?: string;
  disabled?: boolean;
};

/** Lists longer than this get a search box. Seven fit on a phone without scrolling. */
const SEARCH_FROM = 8;

/**
 * One choice from a list, in the paper's own dropdown rather than the
 * browser's: themed with the rest of the page, with a search box for a long
 * list, and the same on every device.
 *
 * Built to the ARIA "select-only combobox" pattern, because a hand-rolled
 * dropdown is where keyboard and screen-reader support usually goes missing:
 *   - the trigger is a button with role="combobox", named by its label, whose
 *     text is the current choice (read as its value);
 *   - the list is a listbox of options; focus stays in the search box (or on
 *     the list) and the highlighted option is aria-activedescendant, so a
 *     screen reader hears each option as the arrows move;
 *   - arrows, Home and End move; Enter or Space chooses; Escape closes and
 *     focus returns to the trigger (Radix); typing jumps to the next option
 *     starting with that letter when there is no search box.
 *
 * Controlled (`value` + `onChange`) or uncontrolled (`defaultValue`). With a
 * `name`, a hidden input carries the value, so it submits with its form like
 * the native select it replaces.
 */
export function Select<V extends string>({
  options,
  value: controlled,
  defaultValue,
  onChange,
  name,
  id: givenId,
  labelledBy,
  describedBy,
  invalid,
  placeholder = "Choose…",
  searchable,
  searchPlaceholder = "Search",
  disabled,
  className,
}: {
  options: readonly SelectOption<V>[];
  value?: V;
  defaultValue?: V;
  onChange?: (next: V) => void;
  name?: string;
  id?: string;
  /** The id of the visible label. A <label htmlFor> naming the trigger also works. */
  labelledBy?: string;
  describedBy?: string;
  invalid?: boolean;
  placeholder?: string;
  /** On by default for lists of eight or more. */
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const generated = useId();
  const id = givenId ?? generated;
  const listId = `${id}-list`;
  const [uncontrolled, setUncontrolled] = useState<V | undefined>(defaultValue);
  const value = controlled ?? uncontrolled;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const search = searchable ?? options.length >= SEARCH_FROM;

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => `${option.label} ${option.description ?? ""}`.toLowerCase().includes(needle));
  }, [options, query]);

  const selected = options.find((option) => option.value === value);

  function openList(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery("");
      // Open on the current choice, so Enter alone keeps it.
      setActive(Math.max(0, options.findIndex((option) => option.value === value)));
    }
  }

  function choose(option: SelectOption<V>) {
    if (option.disabled) return;
    if (controlled === undefined) setUncontrolled(option.value);
    onChange?.(option.value);
    setOpen(false);
  }

  /** The next option that can be chosen, from `from` in `step` direction, wrapping at neither end. */
  function move(from: number, step: 1 | -1): number {
    for (let index = from + step; index >= 0 && index < shown.length; index += step) {
      if (!shown[index]!.disabled) return index;
    }
    return from;
  }

  // Keep the highlighted option in view as the arrows move through a long list.
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, open]);

  function onListKey(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((current) => move(Math.min(current, shown.length - 1), 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((current) => move(Math.min(current, shown.length), -1));
        break;
      case "Home":
        event.preventDefault();
        setActive(move(-1, 1));
        break;
      case "End":
        event.preventDefault();
        setActive(move(shown.length, -1));
        break;
      case "Enter":
        event.preventDefault();
        if (shown[active]) choose(shown[active]!);
        break;
      case " ":
        // Space types a space in a search box; it chooses only without one.
        if (!search) {
          event.preventDefault();
          if (shown[active]) choose(shown[active]!);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        if (!search && event.key.length === 1 && /\S/.test(event.key)) {
          const letter = event.key.toLowerCase();
          const order = [...shown.keys()].map((offset) => (active + 1 + offset) % shown.length);
          const hit = order.find((index) => !shown[index]!.disabled && shown[index]!.label.toLowerCase().startsWith(letter));
          if (hit !== undefined) setActive(hit);
        }
    }
  }

  const activeId = shown[active] ? `${id}-option-${shown[active]!.value}` : undefined;

  return (
    <Popover.Root open={open} onOpenChange={openList}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          // Named by its label alone, as in the ARIA authoring practices' select-only
          // combobox; the choice is the control's content, read as its value.
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onKeyDown={(event) => {
            if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
              event.preventDefault();
              openList(true);
            }
          }}
          className={cn(
            "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-border-input bg-surface px-3 text-left text-text-primary coarse:h-11",
            "transition-[border-color,box-shadow] duration-200 hover:border-accent-border",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            "aria-expanded:border-accent aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-60",
            className,
          )}
        >
          <span className={cn("truncate", !selected && "text-text-tertiary")}>{selected?.label ?? placeholder}</span>
          <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-text-secondary transition-transform duration-200", open && "rotate-180")} />
        </button>
      </Popover.Trigger>
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(event) => {
            // Focus the search box, or the list itself; never the first option's
            // text. Radix would focus the first focusable child, which is fine
            // only when that is the search box.
            event.preventDefault();
            (search ? (document.getElementById(`${id}-search`) as HTMLElement | null) : list.current)?.focus();
          }}
          className="popover-panel z-[var(--z-dropdown)] w-[max(var(--radix-popover-trigger-width),14rem)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border-strong bg-surface-raised shadow-lg"
        >
          {search ? (
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search aria-hidden className="size-4 shrink-0 text-text-tertiary" />
              <input
                id={`${id}-search`}
                type="text"
                role="combobox"
                aria-label={searchPlaceholder}
                aria-controls={listId}
                aria-expanded
                aria-autocomplete="list"
                aria-activedescendant={activeId}
                autoComplete="off"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onListKey}
                placeholder={searchPlaceholder}
                className="h-11 w-full min-w-0 bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
            </div>
          ) : null}
          <ul
            ref={list}
            id={listId}
            role="listbox"
            tabIndex={search ? -1 : 0}
            aria-labelledby={labelledBy}
            aria-label={labelledBy ? undefined : placeholder}
            aria-activedescendant={search ? undefined : activeId}
            onKeyDown={search ? undefined : onListKey}
            className="max-h-[min(20rem,50dvh)] overflow-y-auto p-1 focus:outline-none"
          >
            {shown.length === 0 ? (
              <li role="presentation" className="px-3 py-6 text-center text-sm text-text-secondary">
                Nothing matches &ldquo;{query}&rdquo;.
              </li>
            ) : (
              shown.map((option, index) => {
                const isSelected = option.value === value;
                return (
                  <li
                    key={option.value}
                    id={`${id}-option-${option.value}`}
                    role="option"
                    // Named by its label, described by its second line: "Mute", not
                    // "Mute Shown lower, never hidden".
                    aria-labelledby={`${id}-option-${option.value}-label`}
                    aria-describedby={option.description ? `${id}-option-${option.value}-description` : undefined}
                    data-index={index}
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    // Keeps focus in the search box while a mouse presses. MOUSEdown, not pointerdown: in
                    // WebKit a cancelled pointerdown also cancels the tap's click, and on an iPhone no
                    // option could be chosen at all (found in a WebKit sweep, 19 October 2026).
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(option)}
                    onPointerMove={() => !option.disabled && setActive(index)}
                    className={cn(
                      "flex min-h-10 cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm coarse:min-h-11",
                      index === active ? "bg-accent-subtle text-accent" : "text-text-primary",
                      option.disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <Check aria-hidden className={cn("mt-0.5 size-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0">
                      <span id={`${id}-option-${option.value}-label`} className={cn("block", isSelected && "font-semibold")}>
                        {option.label}
                      </span>
                      {option.description ? (
                        <span id={`${id}-option-${option.value}-description`} className="block text-xs text-text-secondary">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
