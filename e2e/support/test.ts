import { expect, test as base, type Locator, type Page } from "@playwright/test";

import { DEFAULT_PALETTE, PALETTES, type Palette } from "../../src/lib/design/palettes";

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

export { expect };

/** Every route a signed-out visitor can reach. Hand-maintained: add new routes here. */
export const PUBLIC_ROUTES = ["/", "/sources", "/status", "/ai-policy", "/privacy", "/terms", "/login", "/dev/tokens", "/dev/outbox"] as const;

/*
 * Every look a reader can choose: each palette, by day and by night, with and
 * without high contrast. Read from the vocabulary itself, so a palette added
 * there is measured here without anyone remembering to list it.
 */

export type Look = { palette: Palette; mode: "light" | "dark"; contrast: boolean };

export const LOOKS: Look[] = PALETTES.flatMap((palette) =>
  (["light", "dark"] as const).flatMap((mode) => [false, true].map((contrast) => ({ palette, mode, contrast }))),
);

/** The default palette by day and by night: the looks every other route is measured in. */
export const DEFAULT_LOOKS: Look[] = LOOKS.filter((look) => look.palette === DEFAULT_PALETTE && !look.contrast);

export function lookName({ palette, mode, contrast }: Look): string {
  return `${palette} ${mode === "light" ? "day" : "night"}${contrast ? " with high contrast" : ""}`;
}

/** Wear a look before the page's own script runs, the way a returning visitor's browser does. */
export async function wearLook(page: Page, { palette, mode, contrast }: Look): Promise<void> {
  await page.addInitScript(
    ([p, m, c]) => {
      localStorage.setItem("app-palette", p as string);
      localStorage.setItem("app-mode", m as string);
      if (c) localStorage.setItem("app-contrast", "more");
      else localStorage.removeItem("app-contrast");
    },
    [palette, mode, contrast] as const,
  );
}

/**
 * Wait until React has hydrated an element, before clicking it.
 *
 * A server-rendered control can be clicked before its handler exists: the
 * browser checks a native radio, nothing is saved, and a test waiting for the
 * save waits forever. On a fast machine hydration always wins that race; on a
 * CI runner it did not (the theme picker, 2026-10-19). React marks a hydrated
 * node with its own properties, which is what this waits for.
 */
export async function untilHydrated(locator: Locator): Promise<void> {
  await expect
    .poll(() => locator.first().evaluate((element) => Object.keys(element).some((key) => key.startsWith("__reactProps"))), {
      message: "the control was never hydrated",
    })
    .toBe(true);
}

/**
 * Choose from the paper's dropdown (components/ui/select.tsx) the way a person
 * does: open it, then press the option by its visible name. Hydration first,
 * for the same reason as untilHydrated: a press before it opens nothing.
 */
export async function choose(combobox: Locator, option: string): Promise<void> {
  await untilHydrated(combobox);
  await combobox.click();
  const listbox = combobox.page().getByRole("listbox");
  await listbox.getByRole("option", { name: option, exact: true }).click();
  await expect(listbox).toBeHidden();
  await expect(combobox).toHaveText(option);
}
