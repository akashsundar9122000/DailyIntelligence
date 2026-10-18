"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { Bell, ChevronsLeft, ChevronsRight, Ellipsis, LogOut, Search, SunMoon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState, useSyncExternalStore, type ReactNode } from "react";

import { Mark, Wordmark } from "@/components/branding/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { toast } from "@/components/ui/toast";
import { brand } from "@/config/brand";
import { NAV_GROUPS, NAV_ITEMS, navItemFor } from "@/config/navigation";
import { authClient } from "@/lib/auth/client";
import { usePreferences } from "@/lib/settings/client";

import { CommandPalette, usePaletteShortcut } from "./command-palette";
import { EditionSwitch } from "./edition-switch";
import { RailLink, TabLink } from "./nav-link";

export type ShellUser = { name: string; email: string; /** Shows the Administration link. Not a permission: the pages decide for themselves. */ admin?: boolean };

const RAIL_KEY = "app-rail";

/*
 * The rail's width is remembered in the browser. Read through
 * useSyncExternalStore with a fixed server snapshot: initialising state from
 * localStorage would render "expanded" on the client's first pass against
 * "collapsed" from the server, a hydration mismatch that React resolves by
 * throwing the server markup away.
 */
const railListeners = new Set<() => void>();
let railMemory: boolean | null = null;

/* Expanded unless the reader has collapsed it: a section index is read, not decoded from icons. */
function readRail(): boolean {
  if (railMemory !== null) return railMemory;
  try {
    return localStorage.getItem(RAIL_KEY) !== "collapsed";
  } catch {
    return true;
  }
}

function setRailExpanded(next: boolean): void {
  railMemory = next;
  try {
    localStorage.setItem(RAIL_KEY, next ? "expanded" : "collapsed");
  } catch {
    // Private browsing: the choice lasts for this visit only.
  }
  for (const listener of railListeners) listener();
}

function useRailExpanded(): boolean {
  return useSyncExternalStore(
    (listener) => {
      railListeners.add(listener);
      return () => railListeners.delete(listener);
    },
    readRail,
    () => true,
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

/** Pages that are not destinations in the rail, and the name the breadcrumb gives them. */
const OFF_NAV: { prefix: string; label: string }[] = [
  { prefix: "/app/story/", label: "Story" },
  { prefix: "/app/onboarding", label: "Set up your edition" },
  { prefix: "/app/admin", label: "Administration" },
];

function Breadcrumbs() {
  const pathname = usePathname();
  const offNav = OFF_NAV.find((entry) => pathname.startsWith(entry.prefix));
  const item = offNav ? { href: pathname, label: offNav.label } : navItemFor(pathname);
  const nested = Boolean(item && item.href !== "/app");
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-2 text-sm">
        {/*
          On a phone there is room for one name beside the buttons, and it must
          be the page the reader is ON. The way back to For You is the bottom
          bar, so the parent crumb is dropped there rather than the current one
          being truncated to nothing.
        */}
        <li className={cn("items-center gap-2 text-text-secondary", nested ? "hidden sm:flex" : "flex")}>
          {nested ? (
            <Link href="/app" className="hover:text-text-primary">
              For You
            </Link>
          ) : (
            <span aria-current="page" className="font-display text-lg font-bold text-text-primary">
              For You
            </span>
          )}
        </li>
        {nested ? (
          <li className="flex min-w-0 items-center gap-2">
            <span className="hidden text-text-tertiary sm:inline" aria-hidden>
              /
            </span>
            <span aria-current="page" className="truncate font-display text-lg font-bold text-text-primary">
              {item!.label}
            </span>
          </li>
        ) : null}
      </ol>
    </nav>
  );
}

/** Ends the session and goes to the sign-in page. One implementation, behind every control that offers it. */
function useSignOut() {
  const router = useRouter();
  return useCallback(async () => {
    const { error } = await authClient.signOut();
    if (error) {
      toast.error("Could not sign out. Check your connection and try again.");
      return;
    }
    router.replace("/login");
    router.refresh();
  }, [router]);
}

/**
 * Day to night edition and back, in one press, and saved like any other choice
 * of colour scheme. The full list is in the account menu and in Settings.
 *
 * The label and the icon do not say which scheme is on: that is only known in
 * the browser, and a button whose name differed between the server's HTML and
 * the browser's would fail hydration, which is how the whole page once lost
 * its theme.
 */
function useThemeToggle() {
  const { update } = usePreferences();
  return useCallback(() => {
    // The scheme actually on screen, whichever preference produced it.
    const showing = document.documentElement.dataset.theme;
    update({ theme: showing === "light" ? "dark" : "light" });
  }, [update]);
}
const THEME_TOGGLE_LABEL = "Switch between the day and night editions";

function ProfileMenu({ user }: { user: ShellUser }) {
  const { update } = usePreferences();
  const signOut = useSignOut();
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${user.name}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface font-display text-sm font-bold text-text-primary hover:bg-surface-hover coarse:size-11"
        >
          {initials(user.name) || "?"}
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-[var(--z-popover)] w-72 border border-border-strong bg-surface-raised p-2 shadow-lg"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-text-primary">{user.name}</p>
            <p className="truncate text-xs text-text-secondary">{user.email}</p>
          </div>
          <div className="px-3 py-2">
            <p className="pb-1.5 text-xs font-medium text-text-secondary">Colour scheme</p>
            <ThemeSwitcher onChoose={(theme) => update({ theme })} />
          </div>
          <Dropdown.Separator className="my-1 h-px bg-border" />
          <Dropdown.Item asChild>
            <Link href="/app/settings" className="flex h-10 items-center rounded-lg px-3 text-sm text-text-primary data-[highlighted]:bg-surface-hover data-[highlighted]:outline-none">
              Settings
            </Link>
          </Dropdown.Item>
          {user.admin ? (
            <Dropdown.Item asChild>
              <Link href="/app/admin" className="flex h-10 items-center rounded-lg px-3 text-sm text-text-primary data-[highlighted]:bg-surface-hover data-[highlighted]:outline-none">
                Administration
              </Link>
            </Dropdown.Item>
          ) : null}
          <Dropdown.Item
            onSelect={() => void signOut()}
            className="flex h-10 cursor-pointer items-center rounded-lg px-3 text-sm text-text-primary data-[highlighted]:bg-surface-hover data-[highlighted]:outline-none"
          >
            Sign out
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

export type ShellNotifications = { unread: number; recent: { id: string; message: string }[] };

function Notifications({ unread, recent }: ShellNotifications) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="secondary" size="icon" aria-label={unread === 0 ? "Notifications" : `Notifications, ${unread} unread`} className="relative rounded-full">
          <Bell className="size-4" aria-hidden />
          {unread > 0 ? (
            <span aria-hidden data-testid="unread-badge" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-press-solid px-1 text-[0.625rem] font-semibold leading-none text-on-press">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-[var(--z-popover)] w-80 max-w-[calc(100vw-1.5rem)] border border-border-strong bg-surface-raised p-4 shadow-lg"
        >
          <p className="text-sm font-medium text-text-primary">Notifications</p>
          {recent.length === 0 ? (
            <p className="pt-1 text-sm text-text-secondary">Nothing new. Alerts you choose to receive appear here.</p>
          ) : (
            <ul className="space-y-2 pt-2 text-sm text-text-secondary">
              {recent.map((entry) => (
                <li key={entry.id}>{entry.message}</li>
              ))}
            </ul>
          )}
          <Link href="/app/settings/notifications" className="mt-3 inline-block text-sm font-medium text-text-primary underline underline-offset-4">
            Choose your alerts
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * The signed-in frame: a section index down the side, a top bar, the edition
 * strip (dateline and real update time), and on a phone a bottom bar with the
 * four most-used destinations.
 *
 * The frame is exactly one screen tall (dvh, not vh) and only the content
 * column scrolls. Two scrolling regions nested inside each other is what makes
 * a phone page "stick" halfway down.
 */
export function AppShell({ user, notifications, strip, children }: { user: ShellUser; notifications: ShellNotifications; /** The edition strip's contents, rendered on the server. */ strip: ReactNode; children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const expanded = useRailExpanded();
  const signOut = useSignOut();
  const toggleTheme = useThemeToggle();
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  usePaletteShortcut(openPalette);

  function toggleRail() {
    setRailExpanded(!expanded);
  }

  return (
    <>
    {/* On paper the frame is not a fixed box with a scrolling middle: that prints one sheet and cuts the rest off. */}
    <div id="app-frame" className="flex h-dvh overflow-hidden bg-canvas print:block print:h-auto print:overflow-visible">
      <a
        href="#content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-3 focus-visible:top-3 focus-visible:z-[var(--z-overlay)] focus-visible:rounded-md focus-visible:bg-ink focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm focus-visible:text-on-ink"
      >
        Skip to content
      </a>

      <aside
        className={cn(
          "hidden shrink-0 flex-col gap-4 border-r border-border-strong bg-surface py-4 lg:flex print:hidden!",
          expanded ? "w-[var(--rail-w)] px-3" : "w-[4.5rem] items-center px-0",
        )}
      >
        <Link href="/app" aria-label={`${brand.name}, For You`} className={cn("flex flex-col gap-2", expanded ? "px-1" : "items-center")}>
          <span className="flex items-center gap-2">
            <Mark className="size-8 shrink-0" />
            {expanded ? <Wordmark className="text-[1.15rem] leading-tight" /> : null}
          </span>
          {expanded ? <span aria-hidden className="rule-double block" /> : null}
        </Link>
        <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto">
          {NAV_GROUPS.map((group, index) => (
            <div key={group} className={cn("flex flex-col gap-0.5", expanded ? "" : "items-center", index > 0 && "mt-3 border-t border-border pt-3")}>
              {expanded ? <p className="kicker px-1 pb-1 text-text-tertiary">{group}</p> : null}
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => (
                <RailLink key={item.href} item={item} expanded={expanded} />
              ))}
            </div>
          ))}
        </nav>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleRail}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={expanded}
          className={expanded ? "self-end" : ""}
        >
          {expanded ? <ChevronsLeft className="size-4" aria-hidden /> : <ChevronsRight className="size-4" aria-hidden />}
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[var(--header-h)] shrink-0 items-center gap-3 border-b border-border-strong bg-surface px-4 pt-[var(--safe-top)] sm:px-6 print:hidden!">
          <Link href="/app" aria-label={`${brand.name}, For You`} className="lg:hidden">
            <Mark className="size-8" />
          </Link>
          <div className="min-w-0 flex-1">
            <Breadcrumbs />
          </div>
          <EditionSwitch className="hidden xl:inline-flex" />
          <button
            type="button"
            onClick={openPalette}
            className="hidden h-10 w-60 items-center gap-2 border border-border-strong bg-canvas px-3.5 text-sm text-text-secondary hover:bg-surface-hover md:flex"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="flex-1 text-left">Search the paper</span>
            <kbd className="border border-border px-1.5 font-mono text-[0.6875rem]">⌘K</kbd>
          </button>
          <Button variant="secondary" size="icon" onClick={openPalette} aria-label="Search" className="rounded-full md:hidden">
            <Search className="size-4" aria-hidden />
          </Button>
          {/* Not on a phone, where the bar is already full; there it is on the "More" sheet. */}
          <Button variant="secondary" size="icon" onClick={toggleTheme} aria-label={THEME_TOGGLE_LABEL} title={THEME_TOGGLE_LABEL} className="hidden rounded-full sm:inline-flex">
            <SunMoon className="size-4" aria-hidden />
          </Button>
          <Notifications {...notifications} />
          <ProfileMenu user={user} />
          {/*
            In plain sight, as well as in the account menu. That menu opens from a circle holding a person's
            initials; its owner looked for a way to sign out, did not find one, and reported it as missing.
            Here and not in the rail: the rail is exactly as tall as its destinations on a laptop screen, and
            one more button there pushed Settings out of sight.
          */}
          <Button variant="secondary" size="icon" onClick={() => void signOut()} aria-label="Sign out" title="Sign out" className="hidden rounded-full sm:inline-flex">
            <LogOut className="size-4" aria-hidden />
          </Button>
        </header>

        <div className="flex h-10 min-w-0 shrink-0 items-center gap-3 overflow-hidden border-b border-border bg-canvas px-4 text-sm sm:px-6 md:overflow-x-auto print:hidden!" role="region" aria-label="Edition"
          // It scrolls sideways on a phone. A scrolling region that cannot take
          // focus cannot be scrolled from a keyboard.
          tabIndex={0}
        >
          {strip}
        </div>

        {/*
          `relative`, and it is load-bearing. Text for screen readers is positioned absolutely, and an
          absolutely positioned element belongs to its nearest POSITIONED ancestor. With none, every such
          element inside this scroller belonged to the page instead: it did not scroll with the content and
          was not clipped by it, so one far down a long list made the whole document that much taller. The
          document then scrolled as well as this column, and the top bar, with the menu that holds the colour
          scheme and Sign out, could be scrolled out of sight above an empty space below the frame.
        */}
        <main id="content" tabIndex={-1} className="relative min-h-0 flex-1 overflow-y-auto pb-[var(--bottom-nav-h)] focus-visible:outline-none print:overflow-visible print:pb-0">
          {/* The whole width of the window: on a wide screen a centred column left a third of it empty. Prose keeps its own measure. */}
          <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-[var(--z-nav)] flex h-[var(--bottom-nav-h)] items-stretch border-t border-border bg-surface pb-[var(--safe-bottom)] lg:hidden print:hidden!"
      >
        {NAV_ITEMS.filter((item) => item.primaryOnPhone).map((item) => (
          <TabLink key={item.href} item={item} />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium text-text-secondary"
        >
          <Ellipsis className="size-5" aria-hidden />
          More
        </button>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen} title="All pages">
        <ul className="grid grid-cols-2 gap-2">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className="flex h-12 items-center gap-3 border border-border px-3 text-sm font-medium text-text-primary hover:bg-surface-hover"
              >
                <item.icon className="size-4 shrink-0 text-text-secondary" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        {/* On a phone the top bar has no room for these. */}
        <div className="mt-4 border-t border-border pt-4">
          <p className="kicker pb-2 text-text-tertiary">Edition</p>
          <EditionSwitch className="w-full [&>button]:flex-1" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={toggleTheme} className="h-12 justify-start gap-3">
            <SunMoon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">Day or night</span>
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setMoreOpen(false);
              void signOut();
            }}
            className="h-12 justify-start gap-3"
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            <span className="truncate">Sign out</span>
          </Button>
        </div>
      </Dialog>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
    </>
  );
}
