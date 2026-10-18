import { describe, expect, it } from "vitest";

import { searchDestinations } from "@/components/shell/command-palette";
import { NAV_GROUPS, NAV_ITEMS, navItemFor } from "@/config/navigation";
import { SECTION_PLANS } from "@/config/sections";

describe("navigation", () => {
  it("lists the destinations in the blueprint's order", () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      "For You",
      "Today",
      "Hot Now",
      "India",
      "Global",
      "Categories",
      "Social Pulse",
      "Briefings",
      "Explore",
      "Saved",
      "Settings",
    ]);
  });

  it("puts For You, Hot Now, Explore and Saved in the phone's bottom bar, as the blueprint asks", () => {
    expect(NAV_ITEMS.filter((item) => item.primaryOnPhone).map((item) => item.label)).toEqual(["For You", "Hot Now", "Explore", "Saved"]);
  });

  it("gives every destination its own address under /app and a known group", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const item of NAV_ITEMS) {
      expect(item.href === "/app" || item.href.startsWith("/app/")).toBe(true);
      expect(NAV_GROUPS).toContain(item.group);
      expect(item.summary.endsWith(".")).toBe(true);
    }
  });

  it("puts exactly four destinations in the phone's bottom bar, leaving room for More", () => {
    expect(NAV_ITEMS.filter((item) => item.primaryOnPhone)).toHaveLength(4);
  });

  it("finds the section a path is in, and does not call every page For You", () => {
    expect(navItemFor("/app")?.label).toBe("For You");
    expect(navItemFor("/app/hot")?.label).toBe("Hot Now");
    expect(navItemFor("/app/india/TN")?.label).toBe("India");
    expect(navItemFor("/app/settings/security")?.label).toBe("Settings");
    expect(navItemFor("/login")).toBeUndefined();
  });

  it("explains every section that is still in preparation, and keeps no stale explanation for one that is built", () => {
    // A destination with no plan and no page would render a 404 from inside the
    // product; a plan left behind for a built page is copy nobody will update.
    const BUILT = ["/app", "/app/today", "/app/hot", "/app/india", "/app/global", "/app/categories", "/app/search", "/app/saved", "/app/settings"];
    for (const item of NAV_ITEMS) {
      const plan = SECTION_PLANS[item.href];
      if (BUILT.includes(item.href)) {
        expect(plan, item.href).toBeUndefined();
        continue;
      }
      expect(plan, item.href).toBeDefined();
      expect(plan!.willHold.length).toBeGreaterThanOrEqual(1);
      expect(plan!.phase).toBeGreaterThanOrEqual(1);
    }
  });

  it("never promises universal or instant coverage in a section's description", () => {
    const text = Object.values(SECTION_PLANS)
      .flatMap((plan) => plan.willHold)
      .join(" ");
    expect(text).not.toMatch(/every story in the world|instantly|real-time|all news/i);
  });
});

describe("searchDestinations", () => {
  it("returns everything for an empty query", () => {
    expect(searchDestinations("")).toHaveLength(NAV_ITEMS.length);
    expect(searchDestinations("   ")).toHaveLength(NAV_ITEMS.length);
  });

  it("matches labels before summaries, ignoring case", () => {
    expect(searchDestinations("HOT")[0]?.label).toBe("Hot Now");
    // "source" is in no label, only in summaries.
    const sourced = searchDestinations("source").map((item) => item.label);
    expect(sourced).toContain("Hot Now");
    expect(sourced).toContain("Briefings");
  });

  it("returns nothing for something that is not a page", () => {
    expect(searchDestinations("zzzz-not-a-page")).toEqual([]);
  });
});
