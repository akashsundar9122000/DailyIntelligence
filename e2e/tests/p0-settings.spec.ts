import { expect, test } from "../support/session";

import type { Page } from "@playwright/test";

const saved = (page: Page) => page.waitForResponse((response) => response.request().method() === "POST" && response.status() === 200);

/** Choose an option the way a person does: by clicking its label, inside the named group. */
async function choose(page: Page, group: string, option: string) {
  await page.getByRole("group", { name: group }).getByText(option, { exact: true }).click();
  await expect(page.getByRole("group", { name: group }).getByRole("radio", { name: option, exact: true })).toBeChecked();
}

test.describe("settings", () => {
  test("opens on the account tab and lists only tabs that work", async ({ page }) => {
    await page.goto("/app/settings");
    await expect(page).toHaveURL(/\/app\/settings\/account$/);
    const tabs = page.getByRole("navigation", { name: "Settings sections" });
    await expect(tabs.getByRole("link")).toHaveText(["Account", "Interests", "Reading", "Appearance", "Security", "Data & privacy"]);
  });

  test("changes the display name, and the shell shows it", async ({ page }) => {
    await page.goto("/app/settings/account");
    await page.getByLabel("Display name").fill("Asha Reader");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Your name was saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Display name")).toHaveValue("Asha Reader");
  });

  test("applies an appearance change at once and keeps it after a reload", async ({ page }) => {
    await page.goto("/app/settings/appearance");
    const html = page.locator("html");
    await choose(page, "Colour scheme", "Night");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await choose(page, "Text size", "Large");
    await expect(html).toHaveAttribute("data-text-size", "112");
    await choose(page, "Motion", "Reduced");
    await expect(html).toHaveAttribute("data-motion", "reduce");
    await saved(page);
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(html).toHaveAttribute("data-text-size", "112");
    await expect(html).toHaveAttribute("data-motion", "reduce");
    // Put it back for the specs after this one.
    await choose(page, "Colour scheme", "Match device");
    await choose(page, "Text size", "Default");
    await choose(page, "Motion", "Match device");
    await saved(page);
  });

  test("switches reading history off, and it stays off", async ({ page }) => {
    await page.goto("/app/settings/data");
    const history = page.getByRole("switch", { name: "Remember what I read" });
    await expect(history).toBeChecked();
    await history.click();
    await saved(page);
    await page.reload();
    await expect(page.getByRole("switch", { name: "Remember what I read" })).not.toBeChecked();
    await page.getByRole("switch", { name: "Remember what I read" }).click();
    await saved(page);
  });

  test("lists this device, and the sign-in in the security log", async ({ page }) => {
    await page.goto("/app/settings/security");
    await expect(page.getByTestId("device-session").filter({ hasText: "This device" })).toHaveCount(1);
    await expect(page.getByTestId("security-event").filter({ hasText: "Signed in" }).first()).toBeVisible();
    await expect(page.getByText("Checked: this record is complete and unaltered.")).toBeVisible();
  });
});
