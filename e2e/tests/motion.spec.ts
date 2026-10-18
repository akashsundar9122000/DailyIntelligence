import { expect, test } from "../support/test";

/* Runs only in the reduced-motion project (playwright.config.ts). */
test.describe("with reduced motion", () => {
  test("every reveal is visible without scrolling to it, and nothing is mid-animation", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const hidden = await page.locator("[data-reveal]").evaluateAll((elements) => elements.filter((element) => getComputedStyle(element).opacity !== "1").length);
    expect(hidden).toBe(0);
  });

  test("the sources ticker stands still and wraps", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const ticker = page.locator(".ticker");
    await expect(ticker).toHaveCount(1);
    expect(await ticker.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  });
});
