import { latestCode, newEmail, requestCode, signIn } from "../support/auth";
import { expect, test } from "../support/test";

test.describe("signing in", () => {
  test("refuses an address that is not one, before sending anything", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill("not-an-address");
    await page.getByRole("button", { name: /Email me a code/ }).click();
    // Not getByRole("alert") alone: Next's route announcer is an alert too.
    await expect(page.getByRole("alert").filter({ hasText: "Enter a valid email address." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your desk awaits" })).toBeVisible();
  });

  test("creates an account with an emailed code and lands in the paper", async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
  });

  test("says when a code is wrong, clears it, and does not sign in", async ({ page }) => {
    const email = newEmail();
    await requestCode(page, email);
    const right = await latestCode(page, email);
    await page.getByLabel("Sign-in code, digit 1 of 6").fill(right === "123456" ? "654321" : "123456");
    await expect(page.getByRole("alert").filter({ hasText: "That code is not correct" })).toBeVisible();
    await expect(page.getByLabel("Sign-in code, digit 1 of 6")).toHaveValue("");
    await expect(page).toHaveURL(/\/login/);
  });

  test("goes back to change the address", async ({ page }) => {
    await requestCode(page, newEmail());
    await page.getByRole("button", { name: "Use a different email" }).click();
    await expect(page.getByRole("heading", { name: "Your desk awaits" })).toBeVisible();
  });

  test("returns a visitor to the page they asked for", async ({ page }) => {
    await page.goto("/app/hot");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fhot/);
    await signIn(page);
    await expect(page).toHaveURL(/\/app\/hot$/);
  });

  test("offers no provider button whose credentials are not configured", async ({ page }) => {
    // The suite's server has no Google or GitHub app: a button that leads to an error is a dead end.
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /Continue with/ })).toHaveCount(0);
  });

  test("sends a signed-in reader away from the sign-in page", async ({ page }) => {
    await signIn(page);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/app(\/|$)/);
  });
});
