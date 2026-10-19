import AxeBuilder from "@axe-core/playwright";

import { DEFAULT_LOOKS, expect, LOOKS, lookName, PUBLIC_ROUTES, test, wearLook } from "../support/test";

/*
 * Axe over a production build, at the desktop and phone widths the two
 * projects supply.
 *
 * The pages that carry the most of a look -- the landing page, sign-in and the
 * design reference -- are measured in EVERY look: each palette, day and night,
 * with and without high contrast. Every other public route is measured in the
 * default palette by day and by night. check:contrast measures every token pair
 * in every look; this measures the pages built from them.
 *
 * Axe finds roughly a third of accessibility problems -- it cannot tell whether
 * a heading is meaningful or a tab order makes sense. But the third it finds is
 * the third that is unambiguous and cheap to regress, so gate on it and do the
 * judgement work by hand.
 */

// Without reduced motion, axe catches elements MID-FADE and reports the blended
// colour, which fails differently on every run.
test.use({ reducedMotion: "reduce" });

const EVERY_LOOK = new Set<string>(["/", "/login", "/dev/tokens"]);

for (const route of PUBLIC_ROUTES) {
  for (const look of EVERY_LOOK.has(route) ? LOOKS : DEFAULT_LOOKS) {
    test(`${route} has no serious accessibility violations in ${lookName(look)}`, async ({ page }) => {
      await wearLook(page, look);
      await page.goto(route, { waitUntil: "load" });
      const html = page.locator("html");
      await expect(html).toHaveAttribute("data-palette", look.palette);
      await expect(html).toHaveAttribute("data-theme", look.mode);
      if (look.contrast) await expect(html).toHaveAttribute("data-contrast", "more");
      else await expect(html).not.toHaveAttribute("data-contrast");
      await page.evaluate(() => document.fonts.ready);

      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const blocking = results.violations
        .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
        .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} node(s)) ${violation.nodes[0]?.html ?? ""}`);
      expect(blocking).toEqual([]);
      // A page that failed to render has nothing to violate. Prove axe saw one.
      expect(results.passes.length).toBeGreaterThan(5);
    });
  }
}
