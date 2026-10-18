import { expect, test } from "../support/test";

test.describe("the keyboard", () => {
  test("the first Tab on the landing page offers a way past the header", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await skip.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  });

  test("the code boxes move with the arrow keys and Backspace", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill("keyboard@example.in");
    await page.getByRole("button", { name: /Email me a code/ }).click();
    const first = page.getByLabel("Sign-in code, digit 1 of 6");
    await first.press("1");
    await expect(page.getByLabel("Sign-in code, digit 2 of 6")).toBeFocused();
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await expect(first).toBeFocused();
    await expect(first).toHaveValue("");
  });
});
