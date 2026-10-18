import AxeBuilder from "@axe-core/playwright";

import { expect, PUBLIC_ROUTES, test, THEMES } from "../support/test";

/*
 * Axe over a production build: every public route, every theme, at the desktop
 * and phone widths the two projects supply.
 *
 * Axe finds roughly a third of accessibility problems -- it cannot tell whether
 * a heading is meaningful or a tab order makes sense. But the third it finds is
 * the third that is unambiguous and cheap to regress, so gate on it and do the
 * judgement work by hand.
 */

// Without reduced motion, axe catches elements MID-FADE and reports the blended
// colour, which fails differently on every run.
test.use({ reducedMotion: "reduce" });

for (const route of PUBLIC_ROUTES) {
  for (const theme of THEMES) {
    test(`${route} has no serious accessibility violations in the ${theme} theme`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("app-theme", value), theme);
      await page.goto(route, { waitUntil: "load" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
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
