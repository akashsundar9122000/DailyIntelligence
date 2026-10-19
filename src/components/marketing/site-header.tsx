"use client";

import { Menu, SunMoon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Mark, Wordmark } from "@/components/branding/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { brand } from "@/config/brand";
import { setThemePreference } from "@/lib/design/theme";
import { withLookTransition } from "@/lib/design/transition";

const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#hot-is-not-true", label: "Hot is not true" },
  { href: "/#your-paper", label: "Your paper" },
  { href: "/sources", label: "Sources" },
  { href: "/#questions", label: "Questions" },
];

/** Day to night and back, within the visitor's palette. The full list is in Settings once signed in. */
function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  withLookTransition(() => setThemePreference(next));
}

/**
 * The public pages' header: a slim nameplate that rules itself off from the
 * page once the reader scrolls past the masthead, the section links, and the
 * two ways in. On a phone the links move into a sheet.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [pastMasthead, setPastMasthead] = useState(false);
  const [open, setOpen] = useState(false);
  // The home page prints the name large in its masthead; the header repeats it only once that has scrolled away.
  const home = usePathname() === "/";

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      setPastMasthead(window.scrollY > 260);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      style={{ viewTransitionName: "site-header" }}
      className={cn(
        "vt-frame sticky top-0 z-[var(--z-header)] border-b bg-canvas/95 pt-[var(--safe-top)] backdrop-blur supports-[backdrop-filter]:bg-canvas/85",
        scrolled ? "border-border-strong" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[var(--container)] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center gap-2.5" aria-label={`${brand.name}, home`}>
          <Mark className="size-8" />
          <Wordmark className={cn("hidden text-xl leading-none transition-opacity sm:inline", home && !pastMasthead && "sm:opacity-0")} />
        </Link>
        <nav aria-label="Sections" className="ml-6 hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Switch between day and night" title="Day or night">
            <SunMoon className="size-4" aria-hidden />
          </Button>
          <Button variant="secondary" asChild className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/login">Start reading</Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open the section menu" aria-haspopup="dialog" className="lg:hidden">
            <Menu className="size-5" aria-hidden />
          </Button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen} title="Sections">
        <ul className="divide-y divide-border">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} onClick={() => setOpen(false)} className="flex h-12 items-center font-display text-lg font-bold text-text-primary">
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/login" onClick={() => setOpen(false)} className="flex h-12 items-center font-display text-lg font-bold text-text-primary">
              Sign in
            </Link>
          </li>
        </ul>
      </Dialog>
    </header>
  );
}
