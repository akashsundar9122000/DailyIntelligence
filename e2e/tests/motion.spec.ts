import { expect, test } from "../support/test";

/* Runs only in the reduced-motion project (playwright.config.ts). */
test.describe("with reduced motion", () => {
  test("every reveal is visible without scrolling to it, and nothing is mid-animation", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const hidden = await page.locator("[data-reveal]").evaluateAll((elements) => elements.filter((element) => getComputedStyle(element).opacity !== "1").length);
    expect(hidden).toBe(0);
  });

  test("the light behind the page stands still", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const orbs = page.locator(".atmosphere-orb");
    await expect(orbs).toHaveCount(3);
    expect(await orbs.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).animationName))).toEqual(["none", "none", "none"]);
  });

  test("the sources ticker stands still and wraps", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const ticker = page.locator(".ticker");
    await expect(ticker).toHaveCount(1);
    expect(await ticker.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  });
});
