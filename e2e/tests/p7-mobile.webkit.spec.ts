import type { Page } from "@playwright/test";

import { expect, test } from "../support/session";
import { untilHydrated } from "../support/test";

/*
 * The paper on an iPhone, in WebKit: the engine Safari is, and the one every
 * other project here is not. Each test is a failure that passed every Chromium
 * project and was found only by sweeping the app in WebKit (19 October 2026).
 */

/** Errors React raised while hydrating. Production React says only "Minified React error #418". */
function hydrationErrors(page: Page): string[] {
  const errors: string[] = [];
  const keep = (text: string) => {
    if (/#418|#423|#425|hydrat/i.test(text)) errors.push(text);
  };
  page.on("pageerror", (error) => keep(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") keep(message.text());
  });
  return errors;
}

async function firstStory(page: Page): Promise<string> {
  await page.goto("/app");
  const href = await page.locator('a[href^="/app/story/"]').first().getAttribute("href");
  expect(href, "the seed edition has a story to open").toBeTruthy();
  return href!;
}

test.describe("on an iPhone", () => {
  test("hydrates every kind of page without React throwing the server's HTML away", async ({ page }) => {
    // WebKit writes an instant as "9 Oct 2026 at 3:30 PM" where Node writes "9 Oct 2026, 3:30 pm".
    // A date written by the formatter's own join differed between server and phone, and React gave up on the page.
    const errors = hydrationErrors(page);
    const story = await firstStory(page);
    for (const path of ["/", "/login", "/app", "/app/hot", story, "/app/settings/notifications", "/app/settings/security"]) {
      await page.goto(path, { waitUntil: "load" });
      await untilHydrated(page.locator("body *").first());
    }
    expect(errors).toEqual([]);
  });

  test("can choose from a dropdown with a tap", async ({ page }) => {
    // The option list once cancelled pointerdown to keep focus in its search box. In WebKit that also cancels the
    // tap's click, so no option on an iPhone could be chosen at all.
    await page.goto("/app/settings/notifications");
    const cap = page.getByRole("combobox", { name: "At most, per day" });
    await untilHydrated(cap);
    const before = (await cap.textContent())?.trim();
    const target = before === "5 alerts" ? "2 alerts" : "5 alerts";
    await cap.tap();
    const listbox = page.getByRole("listbox");
    await listbox.getByRole("option", { name: target, exact: true }).tap();
    await expect(listbox).toBeHidden();
    await expect(cap).toHaveText(target);
  });

  test("lays out at phone width: no sideways scroll, no collapsed inputs", async ({ page }) => {
    const story = await firstStory(page);
    for (const path of ["/", "/login", "/app", "/app/settings/interests", story]) {
      await page.goto(path, { waitUntil: "load" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }

    // In a flex column, `flex-1` with no width collapsed the question box to 20px in WebKit.
    await page.goto(story);
    const ask = page.getByRole("textbox", { name: "Your question" });
    await expect(ask).toBeVisible();
    expect((await ask.boundingBox())!.width).toBeGreaterThan(200);
  });

  test("gives the landing page's links a target a finger can hit", async ({ page }) => {
    await page.goto("/");
    const links = page.locator("footer").getByRole("link");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      const box = await links.nth(index).boundingBox();
      if (box) expect(box.height, await links.nth(index).innerText()).toBeGreaterThanOrEqual(44);
    }
  });

  test("shows the chosen edition at once when it is changed from More", async ({ page }) => {
    // The choice was saved, but the server-rendered feed was not fetched again: the old edition stayed on screen.
    await page.goto("/app");
    const more = page.getByRole("navigation", { name: "Main" }).last().getByRole("button", { name: "More" });
    await untilHydrated(more);

    async function pick(edition: string) {
      await more.tap();
      const sheet = page.getByRole("dialog", { name: "All pages" });
      const radio = sheet.getByRole("radiogroup", { name: "Edition" }).getByRole("radio", { name: edition, exact: true });
      const refreshed = page.waitForRequest((request) => request.headers()["rsc"] === "1" && new URL(request.url()).pathname === "/app");
      await radio.tap();
      await expect(radio).toHaveAttribute("aria-checked", "true");
      await refreshed;
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
    }

    await pick("World");
    // Put it back: this account is the next spec's, and its edition is shared state.
    await pick("India + World");
  });
});
