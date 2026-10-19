import pg from "pg";

import { E2E_ADMIN_EMAIL } from "../support/admin";
import { signIn } from "../support/auth";
import { E2E_CRON_SECRET } from "../support/cron";
import { SEED_STORIES } from "../support/seed";
import { expect, test } from "../support/session";
import { test as fresh } from "../support/test";

/*
 * Social Pulse, the dashboards, search by meaning and the newsroom tools, end
 * to end. Every headline is from the invented seed edition; the posts are
 * seeded rows whose embeds point at a test address the suite never reaches.
 */

const headline = (key: string) => SEED_STORIES.find((story) => story.key === key)!.headline;

async function owner<T extends pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST_OWNER });
  await client.connect();
  try {
    return (await client.query<T>(text, values)).rows;
  } finally {
    await client.end();
  }
}

test.describe("Social Pulse", () => {
  test("says which platforms are connected and why the others are not", async ({ page }) => {
    await page.goto("/app/social");
    const platforms = page.getByRole("region", { name: "Platforms" });
    await expect(platforms.getByRole("listitem").filter({ hasText: "mastodon.social" })).toContainText("connected");
    await expect(platforms.getByRole("listitem").filter({ hasText: "mastodon.social" })).toContainText("3 posts kept in the last day");
    await expect(platforms.getByRole("listitem").filter({ hasText: "Bluesky" })).toContainText("Not yet: needs a public contact address.");
  });

  test("shows the conversation around a story, every post labelled and linked, through the platform's embed", async ({ page }) => {
    await page.goto("/app/social");
    const conversation = page.getByRole("region", { name: "Conversation around the paper's stories" });
    await expect(conversation.getByRole("link", { name: headline("final") })).toBeVisible();
    await expect(conversation.getByText(/3 posts in the last day, 3 in six hours/)).toBeVisible();
    const post = conversation.getByRole("figure").first();
    await expect(post).toContainText("Post");
    await expect(post).toContainText("Mastodon");
    await expect(post.getByRole("link", { name: /Original/ })).toHaveAttribute("href", /^https:\/\/fixtures\.invalid\/@fan\d\/\d$/);
    await expect(post.locator("iframe")).toHaveAttribute("title", /^Post by @fan\d@mastodon\.social on Mastodon$/);
    await expect(post).toContainText("Counts, not evidence.");
  });

  test("filters posts by topic", async ({ page }) => {
    await page.goto("/app/social");
    await page.getByRole("navigation", { name: "Topics" }).getByRole("link", { name: "#cricket (3)" }).click();
    await expect(page).toHaveURL(/topic=cricket/);
    await expect(page.getByRole("region", { name: "Most discussed topics" }).getByRole("figure")).toHaveCount(3);
  });

  test("a story's page shows its public conversation, as posts and not reporting", async ({ page }) => {
    await page.goto("/app/categories/cricket");
    await page.getByRole("link", { name: headline("final") }).first().click();
    const conversation = page.getByRole("region", { name: "Public conversation" });
    await expect(conversation.getByText("Posts, not reporting")).toBeVisible();
    await expect(conversation.getByRole("figure")).toHaveCount(3);
  });
});

test.describe("dashboards", () => {
  test("Today counts the day, and the section heatmap is a table with every value written", async ({ page }) => {
    await page.goto("/app/today");
    const numbers = page.getByRole("region", { name: "The day in numbers" });
    await expect(numbers.getByText("Stories", { exact: true })).toBeVisible();
    await expect(numbers.getByText(/^India: \d+/)).toBeVisible();
    const table = numbers.getByRole("table", { name: "New stories by section and six-hour window, last 24 hours" });
    await expect(table.getByRole("rowheader", { name: "Cricket" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Last 6 hours" })).toBeVisible();
  });

  test("Saved shows the reader's own reading", async ({ page }) => {
    await page.goto("/app/saved");
    const reading = page.getByLabel("Your reading");
    await expect(reading.getByText("Saved", { exact: true })).toBeVisible();
    await expect(reading.getByText("Opened this week")).toBeVisible();
  });
});

test.describe("search by meaning", () => {
  test("finds a story by meaning when none of the words match, and labels how it was found", async ({ page, request }) => {
    const pass = await request.post("/api/cron/enrich", { headers: { authorization: `Bearer ${E2E_CRON_SECRET}` } });
    expect(pass.status()).toBe(200);
    expect(await owner("select 1 from story_embeddings")).not.toHaveLength(0);
    await page.goto(`/app/search?q=${encodeURIComponent("rain arrives early in the south")}`);
    await expect(page.getByText("Nothing matches", { exact: false })).toBeVisible();
    const meaning = page.getByRole("region", { name: "Close in meaning" });
    await expect(meaning.getByText("An AI model compared what you typed with each headline.", { exact: false })).toBeVisible();
    await expect(meaning.getByRole("heading", { level: 3, name: headline("monsoon") })).toBeVisible();
  });
});

fresh.describe("the newsroom", () => {
  fresh("an administrator resolves a reader's report, and moves a wrongly attached report out of a story", async ({ page }, testInfo) => {
    await signIn(page, E2E_ADMIN_EMAIL);
    // A story of its own per project: a split cannot be undone, and the next project must find two reports to split.
    const key = testInfo.project.name === "mobile" ? "survey" : "market";
    const note = `Not this section (${testInfo.project.name}).`;
    const market = (await owner<{ id: string }>("select id from stories where headline = $1", [headline(key)]))[0]!.id;
    const reader = (await owner<{ id: string }>("select id from users where lower(email) <> lower($1) limit 1", [E2E_ADMIN_EMAIL]))[0]!.id;
    await owner("insert into content_reports (id, user_id, story_id, reason, detail) values (gen_random_uuid(), $1, $2, 'wrong_category', $3)", [reader, market, note]);

    await page.goto("/app/admin");
    const reports = page.getByRole("region", { name: /^Readers' reports/ });
    const item = reports.getByRole("listitem").filter({ hasText: note });
    await item.getByLabel("Note (optional)").fill("Checked; it is.");
    await item.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByText("Done: Report dismissed.", { exact: true })).toBeVisible();
    expect(await owner<{ status: string; resolution: string }>("select status, resolution from content_reports where detail = $1", [note])).toEqual([{ status: "dismissed", resolution: "Checked; it is." }]);

    await page.goto(`/app/story/${market}`);
    const sources = page.getByRole("region", { name: "Every source" });
    await sources.getByRole("button", { name: /^Move ".*\(report 2\)" to a story of its own$/ }).click();
    await expect(page).not.toHaveURL(new RegExp(market));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${headline(key)} (report 2)`);
    expect((await owner<{ source_count: number }>("select source_count from stories where id = $1", [market]))[0]!.source_count).toBe(1);
  });

  fresh("is not there for anyone else: no split control on a story", async ({ page }) => {
    await signIn(page);
    await page.goto("/app/categories/technology");
    await page.getByRole("link", { name: headline("chip") }).first().click();
    await expect(page.getByRole("button", { name: /to a story of its own/ })).toHaveCount(0);
  });
});
