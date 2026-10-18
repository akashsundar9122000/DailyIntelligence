import { NAV_ITEMS } from "../../src/config/navigation";
import { expect, test } from "../support/session";

test.describe("the signed-in shell, on a wide screen", () => {
  test("lists every destination in the rail, and each one opens", async ({ page }) => {
    await page.goto("/app");
    const rail = page.getByRole("navigation", { name: "Main" }).first();
    for (const item of NAV_ITEMS) {
      await rail.getByRole("link", { name: item.label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${item.href}(/[a-z]+)?$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("marks the section the reader is in", async ({ page }) => {
    await page.goto("/app/hot");
    await expect(page.getByRole("navigation", { name: "Main" }).first().getByRole("link", { name: "Hot Now" })).toHaveAttribute("aria-current", "page");
  });

  test("shows the dateline and when a source last really answered", async ({ page }) => {
    await page.goto("/app");
    const strip = page.getByRole("region", { name: "Edition" });
    await expect(strip).toContainText(/\d{4}/);
    await expect(strip).toContainText(/Updated \d{1,2}:\d{2} [ap]m IST/);
    await expect(strip).toContainText("2 of 2 sources reporting");
  });

  test("remembers the edition across a reload, on the server", async ({ page }) => {
    await page.goto("/app");
    const edition = page.getByRole("radiogroup", { name: "Edition" }).first();
    await edition.getByRole("radio", { name: "India", exact: true }).click();
    await expect(edition.getByRole("radio", { name: "India", exact: true })).toHaveAttribute("aria-checked", "true");
    // Saved after a short pause; wait for the save rather than for time.
    await page.waitForResponse((response) => response.request().method() === "POST" && response.status() === 200);
    await page.reload();
    await expect(page.getByRole("radiogroup", { name: "Edition" }).first().getByRole("radio", { name: "India", exact: true })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("radiogroup", { name: "Edition" }).first().getByRole("radio", { name: "India + World" }).click();
    await page.waitForResponse((response) => response.request().method() === "POST" && response.status() === 200);
  });

  test("switches between the day and night editions, and keeps the choice", async ({ page }) => {
    await page.goto("/app");
    const html = page.locator("html");
    const before = await html.getAttribute("data-theme");
    await page.getByRole("button", { name: "Switch between the day and night editions" }).click();
    await expect(html).toHaveAttribute("data-theme", before === "dark" ? "light" : "dark");
    await page.waitForResponse((response) => response.request().method() === "POST" && response.status() === 200);
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", before === "dark" ? "light" : "dark");
    // Put it back for the next spec.
    await page.getByRole("button", { name: "Switch between the day and night editions" }).click();
    await page.waitForResponse((response) => response.request().method() === "POST" && response.status() === 200);
  });

  test("opens the command palette with the keyboard and goes where it is told", async ({ page }) => {
    await page.goto("/app");
    // The shortcut is listened for once the page is interactive; a press during hydration is lost, so press again as a person would.
    await expect(async () => {
      await page.keyboard.press("ControlOrMeta+k");
      await expect(page.getByRole("combobox", { name: "Search pages" })).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await page.getByRole("combobox", { name: "Search pages" }).fill("saved");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/app\/saved$/);
  });

  test("every section still in preparation says so, and shows no stories", async ({ page }) => {
    await page.goto("/app/briefings");
    await expect(page.getByText("In preparation")).toBeVisible();
    await expect(page.getByText("Nothing here is sample news.")).toBeVisible();
  });
});
