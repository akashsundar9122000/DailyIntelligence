import { NAV_ITEMS } from "../../src/config/navigation";
import { expect, test } from "../support/session";

test.describe("the signed-in shell, on a phone", () => {
  test("has four destinations and More in the bottom bar", async ({ page }) => {
    await page.goto("/app");
    const bar = page.getByRole("navigation", { name: "Main" }).last();
    for (const item of NAV_ITEMS.filter((entry) => entry.primaryOnPhone)) await expect(bar.getByRole("link", { name: item.label })).toBeVisible();
    await expect(bar.getByRole("button", { name: "More" })).toBeVisible();
  });

  test("offers every page, the edition and sign-out behind More", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("navigation", { name: "Main" }).last().getByRole("button", { name: "More" }).click();
    const sheet = page.getByRole("dialog", { name: "All pages" });
    for (const item of NAV_ITEMS) await expect(sheet.getByRole("link", { name: item.label, exact: true })).toBeVisible();
    await expect(sheet.getByRole("radiogroup", { name: "Edition" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  test("never scrolls sideways", async ({ page }) => {
    for (const path of ["/app", "/app/hot", "/app/settings/appearance"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
