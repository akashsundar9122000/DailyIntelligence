import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { brand } from "@/config/brand";

describe("brand config", () => {
  it("carries the name and tagline every surface reads", () => {
    expect(brand.name.length).toBeGreaterThan(0);
    expect(brand.tagline.length).toBeGreaterThan(0);
    expect(brand.description.length).toBeGreaterThan(40);
  });

  it("points the favicon at a file that exists", () => {
    // A wrong path here is a 404 on every page and no error anywhere.
    const file = join(process.cwd(), "public", brand.assets.mark);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, "utf8")).toContain("<svg");
  });

  it("versions the mark's path so a redrawn icon is not served from cache", () => {
    expect(brand.assets.mark).toMatch(/-v\d+\.svg$/);
  });
});
