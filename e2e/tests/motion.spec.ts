import { expect, test, untilHydrated } from "../support/test";

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

  test("the headline, the scroll story and the dials are drawn finished, not mid-entrance", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const still = (selector: string) =>
      page.locator(selector).evaluateAll((elements) => elements.map((element) => [getComputedStyle(element).animationName, getComputedStyle(element).opacity]));
    for (const [name, opacity] of await still(".hero-word")) {
      expect(name).toBe("none");
      expect(opacity).toBe("1");
    }
    for (const selector of [".dial-arc", ".scene-gather > *", ".scene-meter", ".scene-line", ".scene-pin"]) {
      for (const [name] of await still(selector)) expect(name, selector).toBe("none");
    }
  });

  test("trying a theme still works, without a transition", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await untilHydrated(page.getByRole("group", { name: "Theme" }).getByRole("radio"));
    await page.getByRole("group", { name: "Theme" }).getByText("Studio", { exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-palette", "studio");
  });

  test("the sources ticker stands still and wraps", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const ticker = page.locator(".ticker");
    await expect(ticker).toHaveCount(1);
    expect(await ticker.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  });
});
