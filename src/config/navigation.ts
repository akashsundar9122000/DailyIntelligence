import {
  Bookmark,
  Compass,
  Flame,
  Globe2,
  LayoutGrid,
  MessagesSquare,
  Newspaper,
  ScrollText,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** One sentence for the command palette and for the page's own header. */
  summary: string;
  group: "Edition" | "Sections" | "Yours" | "Account";
  /** Shown in the phone's bottom bar. Four at most; the rest sit behind "More". */
  primaryOnPhone?: boolean;
  /** May be chosen as the page that opens after signing in. */
  landing?: boolean;
};

/**
 * Every destination in the signed-in product, in the order the blueprint
 * lists them (§3). The rail, the phone bar, the command palette and the
 * breadcrumbs are all drawn from this one list, so they cannot disagree about
 * what exists.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "For You", icon: Newspaper, summary: "Your edition: the stories that match what you follow, with room for what you would otherwise miss.", group: "Edition", primaryOnPhone: true, landing: true },
  { href: "/app/today", label: "Today", icon: ScrollText, summary: "Today's front page and briefing, the same for every reader.", group: "Edition", landing: true },
  { href: "/app/hot", label: "Hot Now", icon: Flame, summary: "Stories gaining attention fastest, with how well each is sourced shown beside it.", group: "Edition", primaryOnPhone: true, landing: true },
  { href: "/app/india", label: "India", icon: LayoutGrid, summary: "National, state and city news, government notices and Indian business, cinema and sport.", group: "Sections", landing: true },
  { href: "/app/global", label: "Global", icon: Globe2, summary: "World news by region, with where an event happened kept apart from where it was reported.", group: "Sections", landing: true },
  { href: "/app/categories", label: "Categories", icon: LayoutGrid, summary: "Cinema, sport, politics, business, technology, AI, science, health, climate and more.", group: "Sections" },
  { href: "/app/social", label: "Social Pulse", icon: MessagesSquare, summary: "Public conversation from platforms that permit it, labelled and linked to the original post.", group: "Sections" },
  { href: "/app/briefings", label: "Briefings", icon: Sparkles, summary: "Morning and evening briefings and topic catch-ups, each claim linked to its source.", group: "Sections", landing: true },
  { href: "/app/search", label: "Explore", icon: Compass, summary: "Search stories, sources, topics and people.", group: "Yours", primaryOnPhone: true },
  { href: "/app/saved", label: "Saved", icon: Bookmark, summary: "Bookmarks and collections, with the sources they were saved from.", group: "Yours", primaryOnPhone: true, landing: true },
  { href: "/app/settings", label: "Settings", icon: Settings, summary: "Your interests, sources, appearance, notifications and data.", group: "Account" },
];

export const NAV_GROUPS = ["Edition", "Sections", "Yours", "Account"] as const;

/** The nav item a path belongs to: the longest href that is the path or a parent of it. */
export function navItemFor(pathname: string): NavItem | undefined {
  return NAV_ITEMS.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
}
