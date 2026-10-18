import { describe, expect, it } from "vitest";

import { brand } from "@/config/brand";
import { resolveSiteUrl } from "@/config/site";

describe("resolveSiteUrl", () => {
  it("uses an explicit origin first, without a trailing slash", () => {
    expect(
      resolveSiteUrl({ NEXT_PUBLIC_APP_URL: "https://example.in/", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" }),
    ).toBe("https://example.in");
  });

  it("falls back to the production domain the host reports", () => {
    // Without this a first deployment's canonical URL points at localhost.
    expect(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" })).toBe("https://x.vercel.app");
  });

  it("uses the local fallback only when nothing else is known", () => {
    expect(resolveSiteUrl({})).toBe(brand.fallbackUrl);
    expect(resolveSiteUrl({ NEXT_PUBLIC_APP_URL: "" })).toBe(brand.fallbackUrl);
  });
});
