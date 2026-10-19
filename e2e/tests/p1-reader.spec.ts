import type { Page } from "@playwright/test";

import { E2E_ADMIN_EMAIL } from "../support/admin";
import { openMenuTo } from "../support/menu";
import { newEmail, signIn } from "../support/auth";
import { SEED_STORIES } from "../support/seed";
import { expect, test } from "../support/session";
import { test as fresh } from "../support/test";

/* Every headline here is from the invented seed edition (e2e/support/seed.ts). */

const headline = (key: string) => SEED_STORIES.find((story) => story.key === key)!.headline;
const toastSaying = (page: Page, message: string) => page.getByText(`Done: ${message}`, { exact: true });

/*
 * Onboarding and admin each need an account of their own: the shared session
 * is used by every other spec, and onboarding it would change what those see.
 */
fresh.describe("setting up an edition", () => {
  fresh("a new reader is taken through six steps and lands on a feed ranked by what they chose", async ({ page }) => {
    await signIn(page, newEmail());
    await page.goto("/app/start");
    await expect(page).toHaveURL(/\/app\/onboarding/);

    await expect(page.getByRole("heading", { level: 1, name: "Choose your coverage" })).toBeVisible();
    await page.getByRole("radiogroup", { name: "Coverage" }).getByRole("radio", { name: /^India \+ World/ }).click();
    await page.getByRole("button", { name: "Kerala" }).click();
    await expect(page.getByRole("button", { name: "Kerala" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Pick your sections" })).toBeVisible();
    const sections = page.getByRole("list", { name: "Sections" });
    await sections.getByRole("button", { name: "Cricket", exact: true }).click();
    await sections.getByRole("button", { name: "Make Cricket a top priority" }).click();
    await sections.getByRole("button", { name: "Climate", exact: true }).click();
    await expect(page.getByText("2 chosen · 1/3 top priorities")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Anything in particular?" })).toBeVisible();
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Anything in particular?");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "See my edition" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Your edition, as it stands" })).toBeVisible();
    const preview = page.getByRole("list", { name: "Your edition preview" });
    // What leads is something the reader chose, not the day's biggest story: Climate and Kerala both match the monsoon story.
    await expect(preview.getByRole("listitem").first()).toContainText("Why this is here: Because you follow");
    await expect(preview.getByRole("listitem").filter({ hasText: headline("final") })).toContainText("Because you follow Cricket, one of your top priorities");

    await page.getByRole("button", { name: "Open my edition" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("link", { name: "Set up my edition" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Your stories" }).getByRole("article").first()).toContainText("Why this is here: Because you follow");

    // What was chosen is in Settings, where it can be undone.
    await page.goto("/app/settings/interests");
    await expect(page.getByRole("button", { name: "Cricket is a top priority. Remove it." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove Kerala" })).toBeVisible();

    // Once set up, signing in opens on the page the reader chose, kept across a reload.
    await page.goto("/app/settings/reading");
    // Preferences save a moment after the change; wait for that write, as a reader's next click would.
    const written = page.waitForResponse((response) => response.request().method() === "POST" && response.status() === 200);
    await page.getByLabel("Open the paper on").selectOption("/app/hot");
    await written;
    await page.reload();
    await expect(page.getByLabel("Open the paper on")).toHaveValue("/app/hot");
    await page.goto("/app/start");
    await expect(page).toHaveURL(/\/app\/hot$/);
  });
});

fresh.describe("administration", () => {
  fresh("is a 404 to a reader who is not an administrator", async ({ page }) => {
    await signIn(page, newEmail());
    const response = await page.goto("/app/admin");
    expect(response?.status()).toBe(404);
  });

  fresh("shows the administrator every source with its health, and the runs", async ({ page }) => {
    await signIn(page, E2E_ADMIN_EMAIL);
    const response = await page.goto("/app/admin");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "The press room" })).toBeVisible();
    const sources = page.getByRole("region", { name: "Sources" });
    await expect(sources.getByRole("row").filter({ hasText: "E2E Official Bureau" })).toContainText("healthy");
    // Switching off is offered but not pressed: it would withdraw the seed edition from every other spec.
    await expect(sources.getByRole("row").filter({ hasText: "E2E Official Bureau" }).getByRole("button", { name: "Switch off" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Recent runs" })).toBeVisible();
  });
});

test.describe("search", () => {
  test("finds a story by any of its words, and narrows by edition", async ({ page }) => {
    await page.goto("/app/search");
    await page.getByRole("search").getByRole("searchbox", { name: "Search" }).fill("cycle lane");
    await page.getByRole("search").getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/q=cycle\+lane/);
    const results = page.getByRole("list", { name: "Results for cycle lane" });
    await expect(results.getByRole("heading", { level: 3 })).toHaveText([headline("lane")]);
    await page.getByRole("navigation", { name: "Filters" }).getByRole("link", { name: "World", exact: true }).click();
    await expect(page.getByText("Nothing matches “cycle lane” in the stories we hold.")).toBeVisible();
  });

  test("lists the sources and sections, each with a follow control", async ({ page }) => {
    await page.goto("/app/search?tab=sources");
    const official = page.getByRole("listitem").filter({ hasText: "E2E Official Bureau" });
    await expect(official).toContainText("Official source");
    await expect(official.getByRole("button", { name: "Follow", exact: true })).toBeVisible();
    // An index of many publishers is not something to follow.
    await expect(page.getByRole("listitem").filter({ hasText: "E2E News Index" })).toContainText("follow sections or places instead");
    await page.goto("/app/search?tab=sections&q=cricket");
    await expect(page.getByRole("listitem").filter({ hasText: "Cricket" }).getByRole("button", { name: /^(Follow|Following)$/ })).toBeVisible();
  });
});

test.describe("saved stories and collections", () => {
  test("a saved story can be noted, filed in a collection, and the collection deleted without losing it", async ({ page }) => {
    await page.goto("/app/search?q=river+survey");
    await page.getByRole("article").filter({ hasText: headline("river") }).getByRole("button", { name: "Save this story" }).click();
    await expect(toastSaying(page, "Saved.")).toBeVisible();

    await page.goto("/app/saved");
    const saved = page.getByRole("listitem").filter({ hasText: headline("river") });
    await saved.getByRole("button", { name: "Add note" }).click();
    const note = page.getByRole("dialog", { name: "Private note" });
    await note.getByLabel("Note").fill("Read before the meeting.");
    await note.getByRole("button", { name: "Save note" }).click();
    await expect(toastSaying(page, "Note saved.")).toBeVisible();
    await expect(saved).toContainText("Read before the meeting.");

    await page.getByRole("button", { name: "New collection" }).click();
    const make = page.getByRole("dialog", { name: "New collection" });
    await make.getByLabel("Name").fill("Weekend");
    await make.getByRole("button", { name: "Make collection" }).click();
    await expect(toastSaying(page, "Collection “Weekend” made.")).toBeVisible();

    await openMenuTo(saved.getByRole("button", { name: "Collections" }), page.getByRole("menuitemcheckbox", { name: "Weekend" }));
    await page.getByRole("menuitemcheckbox", { name: "Weekend" }).click();
    await expect(toastSaying(page, "Added to Weekend.")).toBeVisible();

    await page.getByRole("navigation", { name: "Collections" }).getByRole("link", { name: "Weekend (1)" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Weekend" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: headline("river") })).toBeVisible();
    await page.getByRole("button", { name: "Delete this collection" }).click();
    await expect(page).toHaveURL(/\/app\/saved$/);
    await expect(page.getByRole("heading", { level: 3, name: headline("river") })).toBeVisible();

    await page.getByRole("listitem").filter({ hasText: headline("river") }).getByRole("button", { name: "Remove" }).click();
    await expect(toastSaying(page, "Removed from Saved.")).toBeVisible();
  });
});

test.describe("settings for reading", () => {
  test("a muted word is listed, labelled, and can be taken back", async ({ page }) => {
    await page.goto("/app/settings/interests");
    await page.getByLabel("A word or name").fill("harbour");
    await page.getByLabel("Mute or block").selectOption("mute");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(toastSaying(page, "“harbour” muted.")).toBeVisible();
    const row = page.getByRole("listitem").filter({ hasText: "harbour" });
    await expect(row).toContainText("Muted");
    await page.reload();
    await page.getByRole("button", { name: "Remove harbour" }).click();
    await expect(toastSaying(page, "Removed harbour.")).toBeVisible();
    await expect(page.getByText("Nothing muted or blocked.")).toBeVisible();
  });

  test("downloads the reader's own data as one file, without asking again so soon after signing in", async ({ page }) => {
    await page.goto("/app/settings/data");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download", exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^my-reading-data-\d{4}-\d{2}-\d{2}\.json$/);
    const data = JSON.parse(await (await import("node:fs/promises")).readFile((await file.path())!, "utf8")) as { account: { email: string } };
    expect(data.account.email).toMatch(/@example\.in$/);
    await expect(toastSaying(page, "Your data was downloaded.")).toBeVisible();
  });
});
