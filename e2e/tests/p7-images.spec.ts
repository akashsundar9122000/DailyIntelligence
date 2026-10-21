import { E2E_CRON_SECRET } from "../support/cron";
import { SEED_ILLUSTRATION_URL, SEED_PHOTO_URL, SEED_STORIES } from "../support/seed";
import { expect, test } from "../support/session";

const headline = (key: string) => SEED_STORIES.find((story) => story.key === key)!.headline;

test.describe("every story has a picture", () => {
  for (const route of ["/app", "/app/today", "/app/hot"]) {
    test(`on ${route}, every story carries a picture, and every large one says what it is`, async ({ page }) => {
      await page.goto(route);
      const stories = page.locator("main article");
      await expect(stories.first()).toBeVisible();
      const count = await stories.count();
      for (let index = 0; index < count; index++) {
        const story = stories.nth(index);
        await expect(story.locator("figure.story-picture"), `story ${index + 1} on ${route}`).toHaveCount(1);
        const caption = story.locator("figure.story-picture figcaption");
        // A thumbnail has no room for a caption; a card's picture always has one.
        if (await caption.count()) await expect(caption).toHaveText(/Illustration|Map: Natural Earth|Photo|Video|AI illustration|NASA|YouTube/);
      }
    });
  }

  test("a story about an Indian state shows a map naming the state, and one abroad names the country", async ({ page }) => {
    await page.goto("/app/categories/cricket");
    const final = page.locator("main article").filter({ hasText: headline("final") });
    await expect(final.getByRole("img", { name: "Map of India marking Maharashtra" })).toBeVisible();

    await page.goto("/app/categories/football");
    const club = page.locator("main article").filter({ hasText: headline("football") });
    await expect(club.getByRole("img", { name: /^Map of Spain/ })).toBeVisible();
  });

  test("a story naming several countries gets its section's cover, not a guessed map", async ({ page }) => {
    await page.goto("/app/categories/world-politics");
    const river = page.locator("main article").filter({ hasText: headline("river") });
    await expect(river.locator("figure.story-picture figcaption")).toHaveText("Illustration · World Politics");
    await expect(river.getByRole("img", { name: /^Map/ })).toHaveCount(0);
  });

  test("the story page opens with its picture, credited", async ({ page }) => {
    await page.goto("/app/categories/climate");
    await page.getByRole("link", { name: headline("monsoon") }).first().click();
    await expect(page).toHaveURL(/\/app\/story\//);
    const hero = page.locator("header figure.story-picture");
    await expect(hero).toBeVisible();
    await expect(hero.getByRole("img", { name: "Map of India marking Kerala" })).toBeVisible();
    await expect(hero.locator("figcaption")).toHaveText(/Map: Natural Earth/);
  });

  test("a story with a licensed picture shows it, from this site's optimiser, credited to its source", async ({ page }) => {
    await page.goto("/app/categories/science");
    const survey = page.locator("main article").filter({ hasText: headline("survey") });
    const photo = survey.getByRole("img", { name: "Stars over an observatory dome" });
    await expect(photo).toBeVisible();
    // Served through /_next/image from this origin: the CSP's img-src 'self' is enough.
    expect(await photo.getAttribute("src")).toContain(`/_next/image?url=${encodeURIComponent(SEED_PHOTO_URL)}`);
    await expect(survey.locator("figure.story-picture figcaption")).toHaveText("Photo: E2E Photo Desk");
  });

  test("an AI illustration says so on the picture itself and in its caption", async ({ page }) => {
    await page.goto("/app/categories/ai");
    const model = page.locator("main article").filter({ hasText: headline("model") });
    const picture = model.locator("figure.story-picture");
    await expect(picture.getByText("AI illustration", { exact: true }).first()).toBeVisible();
    await expect(picture.locator("figcaption")).toHaveText("AI illustration");
    expect(await picture.locator("img").getAttribute("src")).toContain(`/_next/image?url=${encodeURIComponent(SEED_ILLUSTRATION_URL)}`);
  });

  test("the Hot now column carries a thumbnail beside each story", async ({ page }) => {
    await page.goto("/app/today");
    const column = page.getByRole("region", { name: "Hot now" });
    const rows = column.getByRole("listitem");
    await expect(rows.first()).toBeVisible();
    expect(await column.locator("figure.story-picture").count()).toBe(await rows.count());
  });
});

test.describe("the illustration pass", () => {
  test("refuses a caller without the scheduler's secret, and says when it could not draw, rather than reporting nothing", async ({ request }) => {
    expect((await request.post("/api/cron/illustrate")).status()).toBe(401);
    const run = await request.post("/api/cron/illustrate", { headers: { authorization: `Bearer ${E2E_CRON_SECRET}`, "x-trigger": "manual" } });
    expect(run.status()).toBe(200);
    const body = (await run.json()) as { ok: boolean; drawn: number; failed: number; lastError?: string };
    // The suite's image model is a stand-in with no image route: nothing is drawn, and the run says why.
    expect(body).toMatchObject({ ok: true, drawn: 0 });
    expect(body.failed).toBeGreaterThan(0);
    expect(body.lastError).toMatch(/illustration model answered 404/);
  });
});
