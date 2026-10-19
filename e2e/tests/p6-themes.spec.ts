import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { PALETTE_COPY } from "../../src/config/themes";
import { DEFAULT_PALETTE, PALETTES, type Palette } from "../../src/lib/design/palettes";
import { expect, test as signedIn } from "../support/session";
import { LOOKS, lookName, test as signedOut, type Look, wearLook } from "../support/test";

const saved = (page: Page) => page.waitForResponse((response) => response.request().method() === "POST" && response.status() === 200);

/** Choose a theme the way a person does: by clicking its card. */
async function choosePalette(page: Page, palette: Palette) {
  const radio = page.getByRole("radio", { name: new RegExp(PALETTE_COPY[palette].name) });
  if (await radio.isChecked()) return;
  const save = saved(page);
  await page.locator("label").filter({ has: radio }).click();
  await expect(radio).toBeChecked();
  await save;
}

async function chooseOption(page: Page, group: string, option: string) {
  const radio = page.getByRole("group", { name: group }).getByRole("radio", { name: option, exact: true });
  if (await radio.isChecked()) return;
  const save = saved(page);
  await page.getByRole("group", { name: group }).getByText(option, { exact: true }).click();
  await expect(radio).toBeChecked();
  await save;
}

async function setContrast(page: Page, on: boolean) {
  const toggle = page.getByRole("switch", { name: "High contrast" });
  if ((await toggle.getAttribute("aria-checked")) === String(on)) return;
  const save = saved(page);
  await toggle.click();
  await save;
}

async function chooseLook(page: Page, look: Look) {
  await page.goto("/app/settings/appearance");
  await choosePalette(page, look.palette);
  await chooseOption(page, "Colour scheme", look.mode === "light" ? "Day" : "Night");
  await setContrast(page, look.contrast);
}

/** Put the account back for the specs after this one: workers share it, one spec's leftovers are the next one's fixtures. */
async function resetLook(page: Page) {
  await page.goto("/app/settings/appearance");
  await choosePalette(page, DEFAULT_PALETTE);
  await chooseOption(page, "Colour scheme", "Match device");
  await setContrast(page, false);
  await chooseOption(page, "Motion", "Full");
}

signedIn.describe("themes, signed in", () => {
  signedIn("offers every theme in Settings, applies each at once and keeps it after a reload", async ({ page }) => {
    await page.goto("/app/settings/appearance");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-palette", DEFAULT_PALETTE);
    await expect(page.getByRole("group", { name: "Theme" }).getByRole("radio")).toHaveCount(PALETTES.length);

    for (const palette of PALETTES) {
      await choosePalette(page, palette);
      await expect(html).toHaveAttribute("data-palette", palette);
      await page.reload();
      await expect(html).toHaveAttribute("data-palette", palette);
      await expect(page.getByRole("radio", { name: new RegExp(PALETTE_COPY[palette].name) })).toBeChecked();
    }
    await resetLook(page);
  });

  signedIn("keeps the theme when only the day/night switch is pressed", async ({ page }) => {
    await page.goto("/app/settings/appearance");
    await choosePalette(page, "newspaper");
    await chooseOption(page, "Colour scheme", "Night");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(html).toHaveAttribute("data-palette", "newspaper");
    await resetLook(page);
  });

  signedIn("switches high contrast on over the chosen theme, and it stays on", async ({ page }) => {
    await page.goto("/app/settings/appearance");
    const html = page.locator("html");
    await setContrast(page, true);
    await expect(html).toHaveAttribute("data-contrast", "more");
    await page.reload();
    await expect(html).toHaveAttribute("data-contrast", "more");
    await expect(page.getByRole("switch", { name: "High contrast" })).toBeChecked();
    // The light behind the page is the first thing high contrast removes.
    expect(await page.locator(".atmosphere").evaluate((element) => getComputedStyle(element).display)).toBe("none");
    await resetLook(page);
  });

  signedIn("calm stops the light drifting, and full lets it move again", async ({ page }) => {
    await page.goto("/app/settings/appearance");
    const orb = page.locator(".atmosphere-orb").first();
    await chooseOption(page, "Motion", "Calm");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "calm");
    expect(await orb.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    await chooseOption(page, "Motion", "Full");
    await expect(page.locator("html")).not.toHaveAttribute("data-motion");
    expect(await orb.evaluate((element) => getComputedStyle(element).animationName)).toBe("orb-drift-a");
  });

  signedIn("the paper and its appearance settings pass axe in every look", async ({ page }) => {
    // Every look is chosen through Settings: signed in, the account's saved look is what the page wears.
    signedIn.setTimeout(LOOKS.length * 20_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const look of LOOKS) {
      await chooseLook(page, look);
      for (const route of ["/app", "/app/settings/appearance"]) {
        await page.goto(route, { waitUntil: "load" });
        await expect(page.locator("html")).toHaveAttribute("data-palette", look.palette);
        await page.evaluate(() => document.fonts.ready);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        const blocking = results.violations
          .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
          .map((violation) => `${lookName(look)} ${route} ${violation.id}: ${violation.nodes[0]?.html ?? ""}`);
        expect(blocking).toEqual([]);
      }
    }
    await resetLook(page);
  });
});

signedOut.describe("themes, signed out", () => {
  signedOut("a first visit gets Aurora, lit, following the device", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/", { waitUntil: "load" });
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-palette", "aurora");
    await expect(html).toHaveAttribute("data-theme", "dark");
    expect(await page.locator(".atmosphere").evaluate((element) => getComputedStyle(element).display)).toBe("block");
  });

  signedOut("a returning visitor who chose Night before themes existed keeps the Newspaper look", async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("app-theme", "dark");
        sessionStorage.setItem("seeded", "1");
      }
    });
    await page.goto("/", { waitUntil: "load" });
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-palette", "newspaper");
    await expect(html).toHaveAttribute("data-theme", "dark");
    // Moved to the new keys, and the old one is gone: read back from storage, not assumed.
    expect(await page.evaluate(() => [localStorage.getItem("app-theme"), localStorage.getItem("app-palette"), localStorage.getItem("app-mode")])).toEqual([
      null,
      "newspaper",
      "dark",
    ]);
    await page.reload();
    await expect(html).toHaveAttribute("data-palette", "newspaper");
  });

  signedOut("the header's day/night switch changes the mode and keeps the theme", async ({ page }) => {
    await wearLook(page, { palette: "newspaper", mode: "light", contrast: false });
    await page.goto("/", { waitUntil: "load" });
    const html = page.locator("html");
    const toggle = page.getByRole("button", { name: "Switch between day and night" });
    await toggle.click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(html).toHaveAttribute("data-palette", "newspaper");
    expect(await page.evaluate(() => localStorage.getItem("app-mode"))).toBe("dark");
  });
});
