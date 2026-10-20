import AxeBuilder from "@axe-core/playwright";

import { SEED_STORIES } from "../support/seed";
import { expect, test } from "../support/session";

test.use({ reducedMotion: "reduce" });

const ROUTES = [
  "/app",
  "/app/today",
  "/app/hot",
  "/app/india",
  "/app/global",
  "/app/categories",
  "/app/categories/climate",
  "/app/social",
  "/app/search?q=monsoon",
  "/app/saved",
  "/app/onboarding",
  "/app/settings/account",
  "/app/settings/interests",
  "/app/settings/reading",
  "/app/settings/notifications",
  "/app/settings/appearance",
  "/app/settings/security",
  "/app/settings/data",
  // A story's id is made by the seed, so the story page is reached the way a reader reaches it.
  "story",
];

for (const route of ROUTES) {
  for (const theme of ["light", "dark"] as const) {
    test(`${route} has no serious accessibility violations in the ${theme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      if (route === "story") {
        await page.goto("/app/categories/climate");
        await page.getByRole("link", { name: SEED_STORIES.find((story) => story.key === "monsoon")!.headline }).first().click();
        await expect(page).toHaveURL(/\/app\/story\//);
      } else {
        await page.goto(route, { waitUntil: "load" });
      }
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.evaluate(() => document.fonts.ready);
      // Settled: after a client navigation the <title> can land a moment after the page.
      await expect(page).not.toHaveTitle("");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const blocking = results.violations
        .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
        .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} node(s)) ${violation.nodes[0]?.html ?? ""}`);
      expect(blocking).toEqual([]);
      expect(results.passes.length).toBeGreaterThan(5);
    });
  }
}
