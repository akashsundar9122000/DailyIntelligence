#!/usr/bin/env node
/**
 * Look at the screen.
 *
 * Captures each route in every palette, by day and by night, at desktop and
 * phone width from a PRODUCTION build, into shots/ (ignored by git). Contrast arithmetic says
 * nothing about whether a page reads well, and a layout can pass every
 * assertion and still be ugly -- so a person reads these before a screen is
 * called done.
 *
 *   pnpm build && node scripts/shoot.mjs / /dev/tokens
 *   SHOOT_PALETTES=newspaper SHOOT_THEMES=light,dark-contrast node scripts/shoot.mjs /dev/tokens
 *   SHOOT_SIGNED_IN=1 node scripts/shoot.mjs /app /app/settings/appearance
 *   SHOOT_SIGNED_IN=1 SHOOT_CLICK="Play the cards" SHOOT_WAIT=1500 node scripts/shoot.mjs /app/story/<id>
 *
 * Signed in, it uses one account in the LOCAL development database, created
 * through the real sign-up pages the first time and signed in to afterwards.
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { config as loadEnv } from "dotenv";

const PORT = Number(process.env.SHOOT_PORT ?? 4630);
const BASE = `http://127.0.0.1:${PORT}`;
const ROUTES = process.argv.slice(2);
/** "light", "dark", "light-contrast" or "dark-contrast". */
const THEMES = (process.env.SHOOT_THEMES ?? "light,dark").split(",");
// Every offered palette by default, read from the vocabulary itself so a new
// palette is photographed without anyone remembering to add it here.
const OFFERED = JSON.parse(/PALETTES = (\[[^\]]*\])/.exec(readFileSync("src/lib/design/palettes.ts", "utf8"))[1]);
const PALETTES = process.env.SHOOT_PALETTES && process.env.SHOOT_PALETTES !== "all" ? process.env.SHOOT_PALETTES.split(",") : OFFERED;
// SHOOT_HEIGHT: the signed-in shell scrolls inside itself, so a full-page
// capture is one viewport tall. A taller viewport is how the rest is seen.
const HEIGHT = Number(process.env.SHOOT_HEIGHT ?? 0);
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: HEIGHT || 900 },
  { name: "phone", width: 390, height: HEIGHT || 844 },
];

if (ROUTES.length === 0) {
  console.error("usage: node scripts/shoot.mjs <route> [route…]");
  process.exit(1);
}

/** Take the port back from a stale server. Kill by PORT: a production server
 *  started by a package script does not match a process-name search. */
function freePort(port) {
  try {
    const pids = execFileSync("lsof", ["-nP", `-tiTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
    for (const pid of pids) process.kill(Number(pid), "SIGKILL");
  } catch {
    // Nothing listening.
  }
}

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server did not answer on ${url} within ${timeoutMs}ms`);
}

// A screenshot run must never be a production session. Refuse rather than
// photograph (or write to) a hosted database.
loadEnv({ path: ".env.local", quiet: true });
const databaseUrl = process.env.DATABASE_URL ?? "";
if (databaseUrl && !/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(databaseUrl)) {
  console.error("shoot: DATABASE_URL is not a local database. Refusing to start.");
  process.exit(1);
}

freePort(PORT);
const server = spawn("pnpm", ["start"], {
  env: {
    ...process.env,
    PORT: String(PORT),
    APP_DEV_TOOLS: "1",
    // A production build refuses to sign with the development key. This run
    // uses the local development database; the value protects nothing.
    APP_SECRET: process.env.APP_SECRET || "screenshot-run-only-".padEnd(48, "x"),
  },
  stdio: "ignore",
});

mkdirSync("shots", { recursive: true });
const written = [];

const ACCOUNT = { email: "screenshots@example.in" };

/**
 * Sign in as the screenshot account with an emailed code, read from the
 * development outbox. The first code to an address creates the account, so
 * there is no separate sign-up step.
 */
async function signedInState(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  await page.getByLabel("Email address").fill(ACCOUNT.email);
  await page.getByRole("button", { name: /Email me a code/ }).click();
  await page.getByRole("heading", { name: "Check your inbox" }).waitFor();
  const outbox = await context.newPage();
  await outbox.goto(`${BASE}/dev/outbox`, { waitUntil: "load" });
  const body = await outbox.getByTestId("outbox-entry").filter({ hasText: ACCOUNT.email }).first().getByTestId("outbox-body").innerText();
  await outbox.close();
  const code = /\b\d{6}\b/.exec(body)?.[0];
  if (!code) throw new Error("shoot: no sign-in code found in the development outbox");
  // The whole code typed into the first box fills all six and submits, as a keyboard's suggestion would.
  await page.getByLabel("Sign-in code, digit 1 of 6").fill(code);
  await page.waitForURL(/\/app(\/|$)/, { timeout: 15_000 });
  const state = await context.storageState();
  await context.close();
  return state;
}

/** Choose a look in Settings, then wait until the page wears it -- the save is what later pages read. */
async function chooseLook(page, palette, mode, contrast) {
  await page.goto(`${BASE}/app/settings/appearance`, { waitUntil: "load" });
  const name = palette[0].toUpperCase() + palette.slice(1);
  await page.locator("label").filter({ has: page.getByRole("radio", { name: new RegExp(name) }) }).click();
  // Inside the Colour scheme group, by exact text: a theme's description can
  // mention "night", and a loose match once clicked the wrong card.
  await page.getByRole("group", { name: "Colour scheme" }).getByText(mode === "dark" ? "Night" : "Day", { exact: true }).click();
  const toggle = page.getByRole("switch", { name: "High contrast" });
  if ((await toggle.getAttribute("aria-checked")) !== String(contrast)) await toggle.click();
  const html = page.locator("html");
  // A deadline, so a look that never arrives fails loudly instead of hanging the run.
  await html.evaluate((el, [p, m]) => new Promise((resolve, reject) => {
    const done = () => el.dataset.palette === p && el.dataset.theme === m;
    if (done()) return resolve();
    const timer = setTimeout(() => reject(new Error(`shoot: the page never wore ${p} ${m} (it shows ${el.dataset.palette} ${el.dataset.theme})`)), 10_000);
    new MutationObserver((_, obs) => { if (done()) { obs.disconnect(); clearTimeout(timer); resolve(); } }).observe(el, { attributes: true });
  }), [palette, mode]);
  // The save is debounced; let it land before the next page is read.
  await page.waitForTimeout(800);
}

try {
  await waitForServer(BASE);
  const browser = await chromium.launch();
  const storageState = process.env.SHOOT_SIGNED_IN ? await signedInState(browser) : undefined;

  // SHOOT_VIEWPORTS=phone: one width only, for a pass that is about one device.
  const only = process.env.SHOOT_VIEWPORTS?.split(",");
  for (const viewport of VIEWPORTS.filter((entry) => !only || only.includes(entry.name))) {
    for (const palette of PALETTES) {
    for (const theme of THEMES) {
      const [mode, contrast] = theme.split("-");
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.name === "phone" ? 2 : 1,
        reducedMotion: "reduce",
        storageState,
        colorScheme: mode === "dark" ? "dark" : "light",
      });
      await context.addInitScript(
        ([p, m, c]) => {
          localStorage.setItem("app-palette", p);
          localStorage.setItem("app-mode", m);
          if (c) localStorage.setItem("app-contrast", "more");
          else localStorage.removeItem("app-contrast");
        },
        [palette, mode, contrast === "contrast"],
      );
      const page = await context.newPage();
      // Signed in, the account's saved look wins once the page hydrates, so it
      // is set the way a reader sets it: in Settings.
      if (storageState) await chooseLook(page, palette, mode, contrast === "contrast");

      for (const route of ROUTES) {
        const response = await page.goto(`${BASE}${route}`, { waitUntil: "load" });
        if (!response || response.status() >= 400) {
          throw new Error(`${route} answered ${response?.status() ?? "nothing"} — refusing to photograph an error page`);
        }
        await page.evaluate(() => document.fonts.ready);
        // SHOOT_CLICK="Play the cards": press a button first, to photograph a state rather than a page as it loads.
        if (process.env.SHOOT_CLICK) {
          const button = page.getByRole("button", { name: process.env.SHOOT_CLICK }).first();
          if (await button.count()) {
            await button.scrollIntoViewIfNeeded();
            await button.click();
          }
        }
        // SHOOT_WAIT=4000: give embeds (frames that load from another site) time to draw.
        if (process.env.SHOOT_WAIT) await page.waitForTimeout(Number(process.env.SHOOT_WAIT));
        const slug = route === "/" ? "home" : route.replace(/^\//, "").replace(/[/?&=,]/g, "-");
        const file = `shots/${slug}-${palette}-${theme}-${viewport.name}.png`;
        await page.screenshot({ path: file, fullPage: true });
        written.push(file);
      }
      await context.close();
    }
    }
  }
  await browser.close();
} finally {
  server.kill("SIGKILL");
  freePort(PORT);
}

for (const file of written) console.log(file);
console.log(`\nshoot: ${written.length} screenshots — now read them`);
