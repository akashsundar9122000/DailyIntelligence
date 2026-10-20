import AxeBuilder from "@axe-core/playwright";
import type { APIRequestContext, Page } from "@playwright/test";

import { E2E_CRON_SECRET } from "../support/cron";
import { SEED_STORIES } from "../support/seed";
import { expect, test } from "../support/session";

/*
 * The AI layer end to end: the scheduler's endpoint calls the stand-in model
 * (e2e/support/model-stub.ts) through the real client, the output is checked
 * and stored, and the pages show what passed and nothing that did not.
 * Every headline is from the invented seed edition.
 */

const headline = (key: string) => SEED_STORIES.find((story) => story.key === key)!.headline;

/** Run the AI pass the way the scheduler does. Idempotent: a story explained once is not sent again. */
async function enrich(request: APIRequestContext) {
  const response = await request.post("/api/cron/enrich", { headers: { authorization: `Bearer ${E2E_CRON_SECRET}`, "x-trigger": "manual" } });
  expect(response.status()).toBe(200);
  return (await response.json()) as { ok: boolean; configured: boolean; explained: number; rejected: number; briefing: { status: string } | null };
}

async function openStory(page: Page, key: string, section: string) {
  await page.goto(`/app/categories/${section}`);
  await page.getByRole("link", { name: headline(key) }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(headline(key));
}

test.describe("the AI pass", () => {
  test("refuses a caller without the scheduler's secret", async ({ request }) => {
    expect((await request.post("/api/cron/enrich")).status()).toBe(401);
  });

  test("runs, and a second run sends nothing already explained", async ({ request }) => {
    const first = await enrich(request);
    expect(first).toMatchObject({ ok: true, configured: true });
    const second = await enrich(request);
    expect(second).toMatchObject({ explained: 0, rejected: 0 });
  });
});

test.describe("a story's explainer", () => {
  test.beforeEach(async ({ request }) => {
    await enrich(request);
  });

  test("is labelled as AI, cites its sources, and opens at the reader's length", async ({ page }) => {
    await openStory(page, "monsoon", "climate");
    const explainer = page.getByRole("region", { name: "In one minute" });
    await expect(explainer.getByText("AI-generated summary")).toBeVisible();
    // The official record is attributed, never stated in the paper's own voice.
    await expect(explainer.getByText(/Seed-official said: Monsoon reaches the southern districts two days early\./)).toBeVisible();
    await expect(explainer).toContainText("Written by an AI model (stub/scripted)");

    // A citation leads to the source it rests on.
    const citation = explainer.getByRole("link", { name: /^\[1\]/ }).first();
    const target = await citation.getAttribute("href");
    expect(target).toMatch(/^#source-[0-9a-f-]{36}$/);
    await expect(page.locator(target!)).toContainText(headline("monsoon"));

    // Balanced by default; the deep dive adds what the records support.
    await expect(explainer.getByRole("heading", { name: "Key details" })).toHaveCount(0);
    await explainer.getByRole("group", { name: "Explainer length" }).getByText("Deep dive", { exact: true }).click();
    await expect(explainer.getByRole("heading", { name: "Key details" })).toBeVisible();
    await expect(explainer).toContainText("is among the publishers carrying it.");
  });

  test("is never shown when it stated a figure no source gave; the rule-written account stands", async ({ page }) => {
    await openStory(page, "survey", "science");
    await expect(page.getByText("AI-generated summary")).toHaveCount(0);
    await expect(page.getByText("4,000")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "At a glance" })).toBeVisible();
    await expect(page.getByText(/An AI explainer with citations is added when one passes its checks\./)).toBeVisible();
  });

  test("is not written for a story only one publisher has", async ({ page }) => {
    await openStory(page, "football", "football");
    await expect(page.getByText("AI-generated summary")).toHaveCount(0);
    await expect(page.getByText(/An AI explainer is written once a second publisher or an official source reports it\./)).toBeVisible();
  });
});

test.describe("asking about a story", () => {
  test("answers from the records with a citation, and says when the records do not say", async ({ page, request }) => {
    await enrich(request);
    await openStory(page, "lane", "india-politics");
    const ask = page.getByRole("region", { name: "Ask about this story" });
    await ask.getByLabel("Your question").fill("Who reported the council's decision?");
    await ask.getByRole("button", { name: "Ask" }).click();
    await expect(ask.getByText("You asked: Who reported the council's decision?")).toBeVisible();
    await expect(ask.getByText(/reported: Seaside city council approves a longer cycle lane/)).toBeVisible();
    await expect(ask.getByText(/AI-generated answer \(stub\/scripted\)/)).toBeVisible();

    await ask.getByLabel("Your question").fill("Why did the council change its mind?");
    await ask.getByRole("button", { name: "Ask" }).click();
    await expect(ask.getByText("The sources here do not say.", { exact: false })).toBeVisible();
  });
});

test.describe("briefings", () => {
  test("the edition briefing leads, one checked line per story, each linking to it", async ({ page, request }) => {
    const result = await enrich(request);
    expect(["ready", "not due"]).toContain(result.briefing?.status);
    await page.goto("/app/briefings");
    const briefing = page.getByRole("region", { name: /^The (morning|evening) briefing$/ });
    await expect(briefing.getByText("AI-generated briefing")).toBeVisible();
    const items = briefing.getByRole("listitem");
    expect(await items.count()).toBeGreaterThanOrEqual(3);
    await items.first().getByRole("link").click();
    await expect(page).toHaveURL(/\/app\/story\//);
  });

  test("the catch-up lists the stories since the last visit, and labels every line a model wrote", async ({ page, request }) => {
    await enrich(request);
    await page.goto("/app/briefings");
    const since = page.getByRole("region", { name: "Since you last checked" });
    const items = since.getByRole("listitem");
    expect(await items.count()).toBeGreaterThan(0);
    // A line under a headline is a model's sentence; each one carries the label.
    for (const item of await items.all()) {
      const paragraphs = await item.locator("p.font-serif").count();
      expect(await item.getByText("AI summary", { exact: true }).count()).toBe(paragraphs);
    }
    await expect(since.getByText("AI summary", { exact: true }).first()).toBeVisible();
  });
});

test.describe("the AI pages are accessible", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`a story with an explainer, and the briefings page, in the ${theme} theme`, async ({ page, request }) => {
      await enrich(request);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      for (const open of [() => openStory(page, "monsoon", "climate"), () => page.goto("/app/briefings")]) {
        await open();
        // The page has settled: after a client navigation the new <title> can
        // arrive a moment after the heading, and axe measured the gap (CI,
        // 2026-10-19). A page with no title at rest still fails here.
        await expect(page).not.toHaveTitle("");
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => `${violation.id}: ${violation.nodes[0]?.html ?? ""}`);
        expect(blocking).toEqual([]);
      }
    });
  }
});
