import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "../support/session";

test.use({ reducedMotion: "reduce" });

const ROUTES = ["/app", "/app/hot", "/app/settings/account", "/app/settings/appearance", "/app/settings/security", "/app/settings/data"];

for (const route of ROUTES) {
  for (const theme of ["light", "dark"] as const) {
    test(`${route} has no serious accessibility violations in the ${theme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(route, { waitUntil: "load" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.evaluate(() => document.fonts.ready);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const blocking = results.violations
        .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
        .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} node(s)) ${violation.nodes[0]?.html ?? ""}`);
      expect(blocking).toEqual([]);
      expect(results.passes.length).toBeGreaterThan(5);
    });
  }
}
