import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { EXCLUDED_PUBLISHER_DOMAINS, publicDirectory, publisherAllowed, SOURCE_CATALOGUE } from "@/lib/sources/catalogue";
import { renderSourceRights } from "@/lib/sources/rights-doc";

describe("the source catalogue", () => {
  it("records, for every source, the terms read, the day, and a quote from them", () => {
    for (const source of SOURCE_CATALOGUE) {
      expect(source.rights.termsUrl, source.key).toMatch(/^https:\/\//);
      expect(source.rights.checkedOn, source.key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(source.rights.operativeQuote.length, source.key).toBeGreaterThan(20);
      expect(source.rights.note.length, source.key).toBeGreaterThan(20);
    }
  });

  it("gives every source a unique key", () => {
    const keys = SOURCE_CATALOGUE.map((source) => source.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("permits nothing for a source that is not cleared", () => {
    for (const source of SOURCE_CATALOGUE.filter((entry) => entry.rights.status !== "cleared")) {
      const r = source.rights;
      expect([r.headline, r.excerpt, r.aiSummary, r.media], source.key).toEqual([false, false, false, false]);
    }
  });

  it("never lets a model or an excerpt near the text of GDELT's third-party articles", () => {
    const gdelt = SOURCE_CATALOGUE.filter((source) => source.provider.startsWith("gdelt"));
    expect(gdelt.length).toBeGreaterThan(0);
    for (const source of gdelt) {
      expect(source.rights.excerpt, source.key).toBe(false);
      expect(source.rights.aiSummary, source.key).toBe(false);
      expect(source.rights.media, source.key).toBe(false);
    }
  });

  it("re-uses no image from any source at launch", () => {
    expect(SOURCE_CATALOGUE.filter((source) => source.rights.media)).toEqual([]);
  });

  it("asks arXiv no more often than its terms allow, and GDELT no more often than it publishes", () => {
    for (const source of SOURCE_CATALOGUE) {
      if (source.canonicalDomain === "arxiv.org") expect(source.pollIntervalSeconds, source.key).toBeGreaterThanOrEqual(3600);
      if (source.provider === "gdelt_gkg") expect(source.pollIntervalSeconds).toBeGreaterThanOrEqual(900);
    }
  });
});

describe("excluded publishers", () => {
  it("are dropped from the index, with their subdomains, and nobody else is", () => {
    for (const domain of EXCLUDED_PUBLISHER_DOMAINS) {
      expect(publisherAllowed(domain), domain).toBe(false);
      expect(publisherAllowed(`www.${domain}`), domain).toBe(false);
      expect(publisherAllowed(`m.${domain}`), domain).toBe(false);
    }
    expect(publisherAllowed("thehindu.com.example.org")).toBe(true);
    expect(publisherAllowed("reuters.com")).toBe(true);
    expect(publisherAllowed("notbbc.com")).toBe(true);
  });

  it("are listed publicly with their reason", () => {
    const listed = publicDirectory().notIncluded.map((entry) => entry.key);
    for (const source of SOURCE_CATALOGUE.filter((entry) => entry.rights.status === "excluded")) expect(listed).toContain(source.key);
  });
});

describe("docs/SOURCE_RIGHTS.md", () => {
  it("is exactly what the catalogue renders, so the two can never disagree", () => {
    // Regenerate with `pnpm docs:sources`.
    expect(readFileSync("docs/SOURCE_RIGHTS.md", "utf8")).toBe(renderSourceRights());
  });
});
