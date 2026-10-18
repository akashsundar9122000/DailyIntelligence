"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";

const KEY = "di-recent-searches";
const EVENT = "di-recent-searches-change";

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

function write(list: string[]): void {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the list simply is not remembered.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Recent searches, kept in THIS browser only (never sent anywhere) and
 * clearable in one press. A convenience, so losing it -- private browsing,
 * cleared storage -- loses nothing that matters.
 */
export function RecentSearches({ current }: { current: string }) {
  const recent = parse(useSyncExternalStore(subscribe, read, () => "[]"));

  // Remember the search on the page now, at the front of the list.
  useEffect(() => {
    if (!current) return;
    const list = parse(read());
    write([current, ...list.filter((entry) => entry.toLowerCase() !== current.toLowerCase())].slice(0, 8));
  }, [current]);

  if (recent.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="kicker text-text-tertiary">Recent</span>
      {recent.map((query) => (
        <Link key={query} href={`/app/search?q=${encodeURIComponent(query)}`} className="border border-border-strong px-2.5 py-1 text-text-secondary hover:text-text-primary">
          {query}
        </Link>
      ))}
      <button type="button" className="ml-1 font-semibold text-text-primary underline underline-offset-4" onClick={() => write([])}>
        Clear
      </button>
    </div>
  );
}
