import { test as base, type Page } from "@playwright/test";

/**
 * The project's `test`. Import it from HERE, never from "@playwright/test", or
 * the next call site gets the old behaviour back.
 *
 * `domcontentloaded` rather than the default `load`: `load` waits for every
 * subresource, and on an image-heavy page that is every variant the image
 * pipeline was asked to produce.
 *
 * The second argument is named `run`, not Playwright's conventional `use`: a
 * function named `use` inside a function named `page` trips eslint's
 * rules-of-hooks.
 */
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, run) => {
    const goto = page.goto.bind(page);
    page.goto = (url, options) => goto(url, { waitUntil: "domcontentloaded", ...options });
    await run(page);
  },
});

export { expect } from "@playwright/test";

/** Every route a signed-out visitor can reach. Hand-maintained: add new routes here. */
export const PUBLIC_ROUTES = ["/", "/sources", "/status", "/ai-policy", "/privacy", "/terms", "/login", "/dev/tokens", "/dev/outbox"] as const;

export const THEMES = ["light", "dark", "contrast"] as const;
