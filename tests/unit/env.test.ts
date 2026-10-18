import { afterEach, describe, expect, it, vi } from "vitest";

/** env() caches its first parse, so each case needs a fresh copy of the module. */
async function load(vars: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  return import("@/lib/env");
}

afterEach(() => vi.unstubAllEnvs());

describe("devToolsEnabled", () => {
  it("is on in development with nothing configured", async () => {
    const { devToolsEnabled } = await load({ NODE_ENV: "development", APP_DEV_TOOLS: undefined });
    expect(devToolsEnabled()).toBe(true);
  });

  it("is off in a production build unless explicitly opted in", async () => {
    // The design reference pages must not be reachable on a real deployment.
    const { devToolsEnabled } = await load({ NODE_ENV: "production", APP_DEV_TOOLS: undefined });
    expect(devToolsEnabled()).toBe(false);
  });

  it("can be opted into in a production build, which is how the e2e suite reaches them", async () => {
    const { devToolsEnabled } = await load({ NODE_ENV: "production", APP_DEV_TOOLS: "1" });
    expect(devToolsEnabled()).toBe(true);
  });
});

describe("env", () => {
  it("names a malformed variable without printing its value", async () => {
    const { env } = await load({ NODE_ENV: "production", APP_DEV_TOOLS: "yes-please" });
    expect(() => env()).toThrow(/APP_DEV_TOOLS/);
    expect(() => env()).not.toThrow(/yes-please/);
  });
});

describe("adminEmails", () => {
  it("is nobody when nothing is configured", async () => {
    const { adminEmails } = await load({ ADMIN_EMAILS: undefined });
    expect(adminEmails()).toEqual([]);
  });

  it("reads a list however it was spaced and capitalised, and drops what is not an address", async () => {
    const { adminEmails } = await load({ ADMIN_EMAILS: " Ada@Example.in ,grace@example.in,, not-an-address " });
    expect(adminEmails()).toEqual(["ada@example.in", "grace@example.in"]);
  });
});

describe("devOutboxEnabled", () => {
  it("follows the development tools on a machine that is not a hosted deployment", async () => {
    expect((await load({ NODE_ENV: "development", APP_DEV_TOOLS: undefined, VERCEL: undefined })).devOutboxEnabled()).toBe(true);
    expect((await load({ NODE_ENV: "production", APP_DEV_TOOLS: undefined, VERCEL: undefined })).devOutboxEnabled()).toBe(false);
    expect((await load({ NODE_ENV: "production", APP_DEV_TOOLS: "1", VERCEL: undefined })).devOutboxEnabled()).toBe(true);
  });

  it("is off on a hosted deployment even with the development tools switched on", async () => {
    // The flag that shows sample data on a demo must not also publish everybody's one-time codes.
    const { devOutboxEnabled, devToolsEnabled } = await load({ NODE_ENV: "production", APP_DEV_TOOLS: "1", VERCEL: "1" });
    expect(devToolsEnabled()).toBe(true);
    expect(devOutboxEnabled()).toBe(false);
  });
});

describe("demoModeEnabled", () => {
  it("is off with nothing set, in every environment", async () => {
    // Unlike the developer pages, the sample edition never turns on by itself:
    // a sample story mixed into a live feed is exactly what this product forbids.
    expect((await load({ NODE_ENV: "production", DEMO_MODE: undefined })).demoModeEnabled()).toBe(false);
    expect((await load({ NODE_ENV: "development", DEMO_MODE: undefined })).demoModeEnabled()).toBe(false);
  });

  it("is on only by name, and opens neither the developer pages nor the outbox", async () => {
    const { demoModeEnabled, devToolsEnabled, devOutboxEnabled } = await load({ NODE_ENV: "production", APP_DEV_TOOLS: undefined, DEMO_MODE: "1", VERCEL: "1" });
    expect(demoModeEnabled()).toBe(true);
    expect(devToolsEnabled()).toBe(false);
    expect(devOutboxEnabled()).toBe(false);
  });
});

describe("optional connectors", () => {
  it("treats half a Bluesky credential as none", async () => {
    expect((await load({ BSKY_HANDLE: "reader.bsky.social", BSKY_APP_PASSWORD: undefined })).blueskySearchConfigured()).toBe(false);
    expect((await load({ BSKY_HANDLE: "reader.bsky.social", BSKY_APP_PASSWORD: ["abcd", "efgh", "ijkl"].join("-") })).blueskySearchConfigured()).toBe(true);
  });

  it("treats two of the three web push values as none", async () => {
    const key = "k".repeat(40);
    expect((await load({ WEB_PUSH_PUBLIC_KEY: key, WEB_PUSH_PRIVATE_KEY: key, WEB_PUSH_SUBJECT: undefined })).webPushConfigured()).toBe(false);
    expect((await load({ WEB_PUSH_PUBLIC_KEY: key, WEB_PUSH_PRIVATE_KEY: key, WEB_PUSH_SUBJECT: "mailto:news@example.in" })).webPushConfigured()).toBe(true);
  });

  it("leaves YouTube off without a key", async () => {
    expect((await load({ YOUTUBE_API_KEY: undefined })).youtubeConfigured()).toBe(false);
  });
});
