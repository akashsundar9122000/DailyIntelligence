import { openMenuTo } from "../support/menu";
import { SEED_STORIES } from "../support/seed";
import { expect, test } from "../support/session";

/* Every headline here is from the invented seed edition (e2e/support/seed.ts). */

const headline = (key: string) => SEED_STORIES.find((story) => story.key === key)!.headline;

test.describe("the editions", () => {
  test("For You shows the edition with a reason under every story, and a briefing beside it", async ({ page }) => {
    await page.goto("/app");
    const stories = page.getByRole("region", { name: "Your stories" });
    await expect(stories.getByRole("heading", { level: 3 }).first()).toBeVisible();
    // Every story says why it is here, in words. The line opens with a screen-reader prefix, so match the whole sentence after it.
    const reasons = await stories.getByText(/^Why this is here: (Because|One of the most important|Recent, from|Discovery|Shown lower)/).count();
    const cards = await stories.getByRole("article").count();
    expect(reasons).toBe(cards);
    await expect(page.getByRole("heading", { name: /\d+ stories · about \d+ minutes/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Hot now" })).toBeVisible();
  });

  test("filters For You by section with a link that can be shared", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("navigation", { name: "Filter by section" }).getByRole("link", { name: "Cricket" }).click();
    await expect(page).toHaveURL(/\/app\?c=cricket$/);
    await expect(page.getByRole("region", { name: "Your stories" }).getByRole("heading", { level: 3 })).toHaveText([headline("final")]);
  });

  test("Hot Now ranks by heat, prints confidence beside it, and flags a story spreading faster than it is confirmed", async ({ page }) => {
    await page.goto("/app/hot");
    const list = page.getByRole("list", { name: "Hot stories" });
    await expect(list.getByRole("heading", { level: 3 }).first()).toHaveText(headline("final"));
    const first = list.getByRole("listitem").first();
    await expect(first).toContainText("Heat 88");
    await expect(first).toContainText("Sourced 32");
    await expect(first).toContainText("spreading faster than it is being confirmed");
  });

  test("Hot Now's filters are links that keep each other", async ({ page }) => {
    await page.goto("/app/hot");
    await page.getByRole("navigation", { name: "Edition" }).getByRole("link", { name: "India", exact: true }).click();
    await expect(page).toHaveURL(/scope=india/);
    await page.getByRole("navigation", { name: "Filters" }).getByRole("link", { name: "3+ sources" }).click();
    await expect(page).toHaveURL(/scope=india/);
    await expect(page).toHaveURL(/min=3/);
    await expect(page.getByRole("list", { name: "Hot stories" }).getByRole("heading", { level: 3 })).toHaveText([headline("lane")]);
  });

  test("India filters by state, counting the stories each has", async ({ page }) => {
    await page.goto("/app/india");
    const states = page.getByRole("navigation", { name: "Filter by state" });
    await expect(states.getByRole("link", { name: "Tamil Nadu (1)" })).toBeVisible();
    await states.getByRole("link", { name: "Kerala (1)" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("India · Kerala");
    await expect(page.getByRole("region", { name: "India stories" }).getByRole("heading", { level: 3 })).toHaveText([headline("monsoon")]);
  });

  test("Global filters by where the event happened", async ({ page }) => {
    await page.goto("/app/global");
    await page.getByRole("navigation", { name: "Filter by region" }).getByRole("link", { name: /^Europe/ }).click();
    const headings = page.getByRole("region", { name: "World stories" }).getByRole("heading", { level: 3 });
    await expect(headings).toContainText([headline("river")]);
    await expect(headings).not.toContainText([headline("chip")]);
  });

  test("Today is a front page by importance, the same for every reader", async ({ page }) => {
    await page.goto("/app/today");
    await expect(page.getByRole("region", { name: "Today's stories" }).getByRole("heading", { level: 3 }).first()).toHaveText(headline("lane"));
  });

  test("a section has its own front, and can be followed from it", async ({ page }) => {
    await page.goto("/app/categories");
    await page.getByRole("link", { name: /Climate/ }).click();
    await expect(page).toHaveURL(/\/app\/categories\/climate$/);
    await expect(page.getByRole("heading", { level: 3, name: headline("monsoon") })).toBeVisible();
    await page.getByRole("button", { name: "Follow", exact: true }).click();
    await expect(page.getByText("Following Climate.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Following" })).toBeVisible();
  });
});

test.describe("one story", () => {
  test("shows the publisher's headline, both times, every source, and why it is hot and how well it is sourced", async ({ page }) => {
    await page.goto("/app/hot");
    await page.getByRole("link", { name: headline("monsoon") }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(headline("monsoon"));
    await expect(page.getByText(/Headline as published by/)).toContainText(/Published \d+ (min|hr) ago · Detected/);
    const original = page.getByRole("link", { name: /Open the original/ });
    await expect(original).toHaveAttribute("href", /^https:\/\/seed-official\.example\//);
    await expect(original).toHaveAttribute("target", "_blank");
    const sources = page.getByRole("region", { name: "Every source" });
    await expect(sources.getByRole("listitem")).toHaveCount(2);
    await expect(sources.getByText("Official statement")).toBeVisible();
    // The official source's excerpt, which its terms allow; the news index's items have none.
    await expect(sources.getByText(/The bureau's own statement/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Heat and confidence" }).getByText("Why it is hot")).toBeVisible();
    await expect(page.getByText("Written from the source records by rule, not by a model.")).toBeVisible();
  });

  test("says when it has only one source", async ({ page }) => {
    await page.goto("/app/categories/football");
    await page.getByRole("link", { name: headline("football") }).first().click();
    await expect(page.getByText("Limited source coverage: one publisher so far.")).toBeVisible();
  });

  test("can be saved, found in Saved, and removed", async ({ page }) => {
    await page.goto("/app/categories/science");
    await page.getByRole("link", { name: headline("survey") }).first().click();
    await page.getByRole("button", { name: "Save this story" }).click();
    // Exact, so "Removed from Saved." cannot pass for it; the toast opens with a screen-reader "Done: ".
    await expect(page.getByText("Done: Saved.", { exact: true })).toBeVisible();
    await page.goto("/app/saved");
    await expect(page.getByRole("heading", { level: 3, name: headline("survey") })).toBeVisible();
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Nothing saved yet.")).toBeVisible();
  });

  test("can be reported, through a dialog that says a person reads it", async ({ page }) => {
    await page.goto("/app/categories/technology");
    await page.getByRole("link", { name: headline("chip") }).first().click();
    await openMenuTo(page.getByRole("button", { name: "More about this story" }).first(), page.getByRole("menuitem", { name: "Report a problem" }));
    await page.getByRole("menuitem", { name: "Report a problem" }).click();
    const dialog = page.getByRole("dialog", { name: "Report this story" });
    await dialog.getByLabel("What is wrong").selectOption("wrong_category");
    await dialog.getByRole("button", { name: "Send report" }).click();
    await expect(page.getByText("Thank you. Your report went to the editors.")).toBeVisible();
  });

  test("can be hidden from the feed, and brought back", async ({ page }) => {
    await page.goto("/app/categories/cinema");
    const card = page.getByRole("article").filter({ hasText: headline("festival") });
    await openMenuTo(card.getByRole("button", { name: "More about this story" }), page.getByRole("menuitem", { name: "Hide this story" }));
    await page.getByRole("menuitem", { name: "Hide this story" }).click();
    await expect(page.getByText("Hidden from your feed.")).toBeVisible();
    await page.goto("/app");
    await expect(page.getByRole("heading", { level: 3, name: headline("festival") })).toHaveCount(0);
    await page.goto("/app/categories/cinema");
    await openMenuTo(page.getByRole("article").filter({ hasText: headline("festival") }).getByRole("button", { name: "More about this story" }), page.getByRole("menuitem", { name: "Hide this story" }));
    await page.getByRole("menuitem", { name: "Hide this story" }).click();
    await expect(page.getByText("Shown in your feed again.")).toBeVisible();
  });

  test("an unknown story is a 404, not an empty page", async ({ page }) => {
    const response = await page.goto("/app/story/00000000-0000-4000-8000-0000000000aa");
    expect(response?.status()).toBe(404);
  });
});
