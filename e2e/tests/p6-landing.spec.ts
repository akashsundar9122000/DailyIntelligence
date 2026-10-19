import type { Page } from "@playwright/test";

import { LANDING_PALETTE_KEY } from "../../src/config/themes";
import { DEFAULT_PALETTE } from "../../src/lib/design/palettes";
import { expect, test as signedIn } from "../support/session";
import { test as signedOut } from "../support/test";

const saved = (page: Page) => page.waitForResponse((response) => response.request().method() === "POST" && response.status() === 200);

signedOut.describe("the landing page, in motion", () => {
  signedOut("the headline is one sentence to a screen reader, however it is animated", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expect(page.getByRole("heading", { level: 1, name: "The news, with its sources showing." })).toBeVisible();
  });

  signedOut("trying a theme re-skins the page, keeps it after a reload, and keeps it for sign-up", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const strip = page.getByRole("group", { name: "Theme" });
    await expect(strip.getByRole("radio")).toHaveCount(5);
    await strip.getByText("Terminal", { exact: true }).click();
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-palette", "terminal");
    await expect(strip.getByRole("radio", { name: "Terminal" })).toBeChecked();
    // Read back from storage: the hand-off to sign-up is a stored value, not a promise.
    expect(await page.evaluate((key) => localStorage.getItem(key), LANDING_PALETTE_KEY)).toBe("terminal");
    await page.reload();
    await expect(html).toHaveAttribute("data-palette", "terminal");
  });

  signedOut("a question opens to its answer, and closes again", async ({ page }) => {
    await page.goto("/#questions", { waitUntil: "load" });
    const question = page.locator("details.faq").first();
    await question.locator("summary").click();
    await expect(question).toHaveAttribute("open", "");
    await expect(question.locator("p")).toBeVisible();
    await question.locator("summary").click();
    await expect(question).not.toHaveAttribute("open", "");
  });

  signedOut("moving between public pages still lands on the page asked for", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await page.getByRole("contentinfo").getByRole("link", { name: "Source directory" }).click();
    await expect(page).toHaveURL(/\/sources$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

signedIn.describe("the theme tried before signing up", () => {
  signedIn("is offered at onboarding, and kept only if the reader says so", async ({ page }) => {
    await page.addInitScript(([key]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(key!, "blueprint");
        sessionStorage.setItem("seeded", "1");
      }
    }, [LANDING_PALETTE_KEY]);
    await page.goto("/app/onboarding?step=4");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-palette", DEFAULT_PALETTE);
    await expect(page.getByText("You tried the Blueprint theme before signing up.")).toBeVisible();

    const save = saved(page);
    await page.getByRole("button", { name: "Keep Blueprint" }).click();
    await save;
    await expect(html).toHaveAttribute("data-palette", "blueprint");
    expect(await page.evaluate((key) => localStorage.getItem(key), LANDING_PALETTE_KEY)).toBeNull();
    await expect(page.getByText("You tried the Blueprint theme before signing up.")).toBeHidden();

    // Kept on the account, not only in this browser.
    await page.goto("/app/settings/appearance");
    await expect(page.getByRole("radio", { name: /Blueprint/ })).toBeChecked();

    // Put the account back for the specs after this one.
    const reset = saved(page);
    await page.locator("label").filter({ has: page.getByRole("radio", { name: /Aurora/ }) }).click();
    await reset;
    await expect(html).toHaveAttribute("data-palette", DEFAULT_PALETTE);
  });
});
