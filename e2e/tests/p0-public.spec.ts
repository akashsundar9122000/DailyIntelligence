import { brand } from "../../src/config/brand";
import { publicDirectory } from "../../src/lib/sources/catalogue";
import { expect, test } from "../support/test";

test.describe("the landing page", () => {
  test("is a front page: masthead, lead, and every section in order", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/", { waitUntil: "load" });
    await expect(page.getByRole("link", { name: `${brand.name}, home` }).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "The news, with its sources showing." })).toBeVisible();
    for (const id of ["how-it-works", "hot-is-not-true", "your-paper", "sources", "questions"]) {
      await expect(page.locator(`section#${id}`)).toHaveCount(1);
    }
    expect(errors).toEqual([]);
  });

  test("shows no story it does not have: before the first edition, it says so", async ({ page }) => {
    // The suite's database has no stories. The live column must not fill the space with anything news-like.
    await page.goto("/");
    const column = page.getByRole("complementary", { name: "The front page, live" });
    await expect(column.getByText("The first edition is being set.")).toBeVisible();
    for (const source of publicDirectory().onPress) await expect(column.getByText(source.name, { exact: true })).toBeVisible();
    await expect(page.getByText("Awaiting first report").first()).toBeVisible();
  });

  test("labels every drawing of how it works as an illustration", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Illustration of how it works. Not live news.").first()).toBeAttached();
    await expect(page.getByText("Illustration: the two scores for one example story")).toBeAttached();
  });

  test("lets a visitor choose sections, star at most three, and carry them into sign-in", async ({ page }) => {
    await page.goto("/#your-paper");
    const cinema = page.getByRole("button", { name: "Cinema & Entertainment", exact: true });
    await cinema.click();
    await expect(cinema).toHaveAttribute("aria-pressed", "true");
    for (const name of ["Make Cricket a top priority", "Make Business & Markets a top priority"]) await page.getByRole("button", { name }).click();
    // AI was starred already; that is three. A fourth cannot be starred.
    await expect(page.getByText("3/3 starred.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Make Cinema & Entertainment a top priority" })).toBeDisabled();
    await page.getByRole("link", { name: /Start with these/ }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fonboarding/);
    const saved = await page.evaluate(() => localStorage.getItem("di-landing-interests"));
    expect(JSON.parse(saved!)).toMatchObject({ priority: ["ai", "cricket", "business"] });
  });

  test("answers its questions in place", async ({ page }) => {
    await page.goto("/#questions");
    const question = page.locator("summary", { hasText: "Is this every news story in the world?" });
    await question.click();
    await expect(page.getByText(/No, and nothing honest could be/)).toBeVisible();
  });
});

test.describe("the trust pages", () => {
  test("the source directory lists what is read, what is waiting, and what is not, with the terms", async ({ page }) => {
    await page.goto("/sources");
    const directory = publicDirectory();
    await expect(page.getByRole("heading", { name: "On the press" })).toBeVisible();
    for (const line of [...directory.onPress, ...directory.pending, ...directory.notIncluded]) {
      await expect(page.getByText(line.name, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByRole("link", { name: /Read their terms/ })).toHaveCount(directory.onPress.length + directory.pending.length + directory.notIncluded.length);
  });

  test("the status page says plainly that nothing has run yet", async ({ page }) => {
    await page.goto("/status");
    await expect(page.getByText(/No source has been registered yet|Has not answered yet/).first()).toBeVisible();
  });

  for (const [path, heading] of [
    ["/privacy", "Privacy notice"],
    ["/terms", "Terms of use"],
    ["/ai-policy", "How we use AI"],
  ] as const) {
    test(`${path} renders its heading`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    });
  }
});
