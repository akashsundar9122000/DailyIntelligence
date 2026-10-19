import { describe, expect, it } from "vitest";

import { latestGkgStamp, nextStamp, parseGkgLine, selectRows, stampToDate, type GkgRow } from "@/lib/ingestion/adapters/gdelt-gkg";
import { feedDate, parseFeed } from "@/lib/ingestion/adapters/rss";
import { categorise, entitiesFromGkg } from "@/lib/ingestion/classify";
import { isoFromFips, placesFromGkgLocations } from "@/lib/ingestion/geo";
import { canonicalUrl, cleanTitle, containment, decodeEntities, normalizeTitle, overlap, sameStory, significantTokens, titleSignature, urlHash } from "@/lib/ingestion/normalize";
import { nextPollDelaySeconds } from "@/lib/ingestion/pipeline";

/*
 * Every headline in this file is invented test text. None is news.
 */

describe("canonical URLs", () => {
  it("drops what identifies the click, keeps what identifies the page", () => {
    expect(canonicalUrl("https://WWW.Example.com/a/b/?utm_source=x&id=7&fbclid=y#top")).toBe("https://example.com/a/b?id=7");
    expect(canonicalUrl("https://example.com/story/amp/")).toBe("https://example.com/story");
    expect(canonicalUrl("https://example.com/?b=2&a=1")).toBe("https://example.com/?a=1&b=2");
    expect(canonicalUrl("https://example.com:443/x")).toBe("https://example.com/x");
  });

  it("refuses what is not an absolute web address", () => {
    for (const bad of ["/relative/path", "javascript:alert(1)", "ftp://example.com/x", "not a url", ""]) expect(canonicalUrl(bad), bad).toBeNull();
  });

  it("hashes http and https copies of one article the same", () => {
    expect(urlHash("http://example.com/a")).toBe(urlHash("https://example.com/a"));
    expect(urlHash("https://example.com/a")).not.toBe(urlHash("https://example.com/b"));
  });
});

describe("titles", () => {
  it("decodes the entities feeds leave behind", () => {
    expect(decodeEntities("Tom &amp; Jerry &#8217;s &#x2014; &quot;x&quot; &unknown;")).toBe("Tom & Jerry ’s — \"x\" &unknown;");
  });

  it("drops a trailing site name, and only a site name", () => {
    expect(cleanTitle("Council approves the new cycle lane - The Sample Times", "sampletimes.example")).toBe("Council approves the new cycle lane");
    expect(cleanTitle("Council approves the new cycle lane | Example News")).toBe("Council approves the new cycle lane");
    // A dash inside a real headline stays.
    expect(cleanTitle("Score 2-1: home side wins the final")).toBe("Score 2-1: home side wins the final");
  });

  it("reduces to significant words, in any order", () => {
    expect(significantTokens("The Council's plan: a new cycle lane for 2026!")).toEqual(["council", "plan", "cycle", "lane", "2026"]);
    // Plurals fold, so "floods" and "flood" are one word; "press" and "status" are left alone.
    expect(significantTokens("Floods hit villages and cities")).toEqual(["flood", "hit", "village", "city"]);
    expect(significantTokens("Press status update")).toEqual(["press", "status", "update"]);
    expect(titleSignature("lane cycle council")).toBe(titleSignature("Council cycle lane"));
    expect(normalizeTitle("Café   Olé!")).toBe("cafe ole");
  });
});

describe("same story or not", () => {
  const words = (title: string) => significantTokens(title);

  it("joins one story told at two lengths", () => {
    // The pair that was split on the first real run.
    const short = words("Mayor endorses Rivera ahead of elections");
    const long = words("Mayor endorses embattled regional leader Carla Rivera for reelection");
    expect(overlap(short, long)).toBeLessThan(0.4);
    expect(containment(short, long)).toBeGreaterThanOrEqual(0.6);
    expect(sameStory(short, long)).not.toBeNull();
  });

  it("joins close rewordings", () => {
    expect(sameStory(words("Floods cut off three villages in hill district"), words("Three hill district villages cut off by floods"))).not.toBeNull();
  });

  it("does not join two stories that share a few common words", () => {
    expect(sameStory(words("India beat Australia in the final"), words("India and Australia sign a trade deal"))).toBeNull();
    expect(sameStory(words("Mayor endorses Rivera"), words("Mayor endorses Ortiz"))).toBeNull();
  });
});

describe("categories, from the headline only", () => {
  it("places headlines by their words", () => {
    expect(categorise({ title: "Late wicket swings the final over", india: true })).toContain("cricket");
    expect(categorise({ title: "New AI model released by the lab", india: false })).toContain("ai");
    expect(categorise({ title: "WHO warns of a new outbreak", india: false })).toContain("health");
  });

  it("does not read 'who' or 'ai' in ordinary words as acronyms", () => {
    expect(categorise({ title: "The teacher who walked to work", india: false })).not.toContain("health");
    expect(categorise({ title: "Thai food festival returns", india: false })).not.toContain("ai");
  });

  it("puts politics in India or the world by where the event is", () => {
    expect(categorise({ title: "Chief Minister announces a new scheme", india: true })[0]).toBe("india-politics");
    expect(categorise({ title: "Chief Minister announces a new scheme", india: false })).toContain("world-politics");
  });

  it("leaves what it cannot place unplaced, rather than guessing", () => {
    // GDELT once tagged a piece like this with ECON_WORLDCURRENCIES and EDUCATION.
    expect(categorise({ title: "Why do we love fiery foods if they hurt?", india: false })).toEqual([]);
  });

  it("title-cases GDELT's people and organisations, a few of each", () => {
    expect(entitiesFromGkg("carla rivera,12;carla rivera,40;jo bloggs,3", "sample council,5")).toEqual([
      { kind: "person", name: "Carla Rivera" },
      { kind: "person", name: "Jo Bloggs" },
      { kind: "organisation", name: "Sample Council" },
    ]);
  });
});

describe("geography", () => {
  it("converts GDELT's FIPS codes, where FIPS and ISO disagree", () => {
    expect(isoFromFips("CH")).toBe("CN");
    expect(isoFromFips("SZ")).toBe("CH");
    expect(isoFromFips("UK")).toBe("GB");
    expect(isoFromFips("ZZ")).toBeNull();
  });

  it("reads countries and Indian states from a GKG locations field", () => {
    const field = "4#Chennai, Tamil Nadu, India#IN#IN25#13.08#80.27#-1;1#India#IN#IN#20#77#IN;1#Sri Lanka#CE#CE#7#81#CE";
    expect(placesFromGkgLocations(field)).toEqual({ countries: ["IN", "LK"], indianStates: ["TN"] });
  });
});

/** A GKG line in the 2.1 column layout, built from parts. */
function gkgLine(parts: { id?: string; domain: string; url: string; title?: string; locations?: string; published?: string; collection?: string }): string {
  const cols = new Array<string>(27).fill("");
  cols[0] = parts.id ?? "20261018150000-1";
  cols[1] = "20261018150000";
  cols[2] = parts.collection ?? "1";
  cols[3] = parts.domain;
  cols[4] = parts.url;
  cols[9] = parts.locations ?? "";
  cols[26] = `${parts.published ? `<PAGE_PRECISEPUBTIMESTAMP>${parts.published}</PAGE_PRECISEPUBTIMESTAMP>` : ""}${parts.title ? `<PAGE_TITLE>${parts.title}</PAGE_TITLE>` : ""}`;
  return cols.join("\t");
}

describe("the GDELT knowledge-graph adapter", () => {
  it("reads one line into an item with the publisher's own time", () => {
    const row = parseGkgLine(gkgLine({ domain: "example.com", url: "https://www.example.com/a?utm_source=x", title: "Council approves the new cycle lane plan", published: "20261018114500", locations: "1#India#IN#IN#20#77#IN" }));
    expect("skip" in row).toBe(false);
    const item = row as GkgRow;
    expect(item.url).toBe("https://example.com/a");
    expect(item.publishedAt).toBe("2026-10-18T11:45:00.000Z");
    expect(item.excerpt).toBeNull();
    expect(item.eventCountries).toEqual(["IN"]);
  });

  it("leaves the publication time empty when the page did not give one, never filling it", () => {
    const item = parseGkgLine(gkgLine({ domain: "example.com", url: "https://example.com/b", title: "Council approves the new cycle lane plan" })) as GkgRow;
    expect(item.publishedAt).toBeNull();
  });

  it("drops excluded publishers before anything is stored", () => {
    for (const domain of ["thehindu.com", "indianexpress.com", "timesofindia.indiatimes.com", "bbc.co.uk"]) {
      expect(parseGkgLine(gkgLine({ domain, url: `https://${domain}/story`, title: "Council approves the new cycle lane plan" }))).toEqual({ skip: "excluded publisher" });
    }
  });

  it("skips a line with no title, a short title, or no web address", () => {
    expect(parseGkgLine(gkgLine({ domain: "example.com", url: "https://example.com/c" }))).toEqual({ skip: "no title" });
    expect(parseGkgLine(gkgLine({ domain: "example.com", url: "https://example.com/c", title: "Too short" }))).toEqual({ skip: "title too short or too long" });
    expect(parseGkgLine(gkgLine({ domain: "example.com", url: "nope", title: "Council approves the new cycle lane plan" }))).toEqual({ skip: "no usable URL" });
    expect(parseGkgLine("too\tfew\tcolumns")).toEqual({ skip: "malformed" });
  });

  it("keeps India and echoed world stories, and caps any one site", () => {
    const rows = [
      parseGkgLine(gkgLine({ id: "1", domain: "a.example", url: "https://a.example/1", title: "Floods cut off three villages in the hill district", locations: "1#India#IN#IN#20#77#IN" })),
      parseGkgLine(gkgLine({ id: "2", domain: "b.example", url: "https://b.example/2", title: "Harbour strike enters its third week in the port city" })),
      parseGkgLine(gkgLine({ id: "3", domain: "c.example", url: "https://c.example/3", title: "Port city harbour strike reaches its third week" })),
      parseGkgLine(gkgLine({ id: "4", domain: "d.example", url: "https://d.example/4", title: "A single site's own feature about gardening tips" })),
    ] as GkgRow[];
    const kept = selectRows(rows, { cap: 10 }).map((row) => row.providerItemId);
    expect(kept).toEqual(["1", "2", "3"]);
    const many = Array.from({ length: 10 }, (_, i) => parseGkgLine(gkgLine({ id: String(i), domain: "same.example", url: `https://same.example/${i}`, title: `Floods cut off village number ${i} in hill district`, locations: "1#India#IN#IN#20#77#IN" }))) as GkgRow[];
    expect(selectRows(many, { cap: 50, perDomain: 6 })).toHaveLength(6);
  });

  it("walks GDELT's fifteen-minute stamps", () => {
    expect(nextStamp("20261018234500")).toBe("20261019000000");
    expect(nextStamp("20261018150000", -1)).toBe("20261018144500");
    expect(stampToDate("20261018150000").toISOString()).toBe("2026-10-18T15:00:00.000Z");
    expect(latestGkgStamp("1 h http://x/20261018174500.export.CSV.zip\n2 h http://x/20261018174500.gkg.csv.zip\n")).toBe("20261018174500");
    expect(latestGkgStamp("garbage")).toBeNull();
  });
});

const SOURCE = { canonicalDomain: "example.gov", contentType: "official_statement" as const, language: "en", countryOrRegion: "IN", categories: ["india-politics"], name: "Example Bureau" };

describe("the RSS adapter", () => {
  it("reads RSS 2.0, with CDATA, and keeps an excerpt only when it is more than the headline", () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>
      <item><title>Bureau publishes the annual cycle lane report</title><link><![CDATA[https://example.gov/r/1?utm_medium=rss]]></link>
        <guid>abc-1</guid><pubDate><![CDATA[Fri, 16 Oct 2026 15:00:00 GMT]]></pubDate>
        <description><![CDATA[<p>The report counts <b>new lanes</b> in every district.</p>]]></description></item>
      <item><title>Bureau announces a public consultation on lanes</title><link>https://example.gov/r/2</link>
        <description>Bureau announces a public consultation on lanes</description></item>
    </channel></rss>`;
    const { items } = parseFeed(xml, SOURCE);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ providerItemId: "abc-1", url: "https://example.gov/r/1", publishedAt: "2026-10-16T15:00:00.000Z", excerpt: "The report counts new lanes in every district.", contentType: "official_statement", eventCountries: ["IN"] });
    // The second item's description is its own headline again: not an excerpt.
    expect(items[1]!.excerpt).toBeNull();
    // No date in the feed: no date on the item.
    expect(items[1]!.publishedAt).toBeNull();
  });

  it("reads Atom", () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Observatory releases a new sky survey map</title>
      <link rel="alternate" href="https://example.org/a"/><id>tag:1</id><updated>2026-10-17T08:00:00Z</updated>
      <summary>A survey of the southern sky, released as open data.</summary></entry></feed>`;
    const { items } = parseFeed(xml, { ...SOURCE, contentType: "report", countryOrRegion: "global", categories: [] });
    expect(items[0]).toMatchObject({ url: "https://example.org/a", publishedAt: "2026-10-17T08:00:00.000Z", excerpt: "A survey of the southern sky, released as open data." });
  });

  it("strips arXiv's identifier and announce line from an abstract", () => {
    const xml = `<rss><channel><item><title>A quieter way to cool computing clusters</title><link>https://arxiv.org/abs/2610.00001</link>
      <description>arXiv:2610.00001v1 Announce Type: new Abstract: We describe a passive cooling layout for dense racks.</description></item></channel></rss>`;
    expect(parseFeed(xml, { ...SOURCE, contentType: "preprint", countryOrRegion: "global", categories: ["ai"] }).items[0]!.excerpt).toBe("We describe a passive cooling layout for dense racks.");
  });

  it("links a PIB release to its page, not its bare frame", () => {
    const xml = `<rss><channel><item><title>Ministry releases the monthly cycle lane bulletin</title><link>https://pib.gov.in/PressReleaseIframePage.aspx?PRID=12345</link></item></channel></rss>`;
    expect(parseFeed(xml, SOURCE).items[0]!.url).toBe("https://pib.gov.in/PressReleasePage.aspx?PRID=12345");
  });

  it("quarantines an item with no link rather than guessing one, and refuses what is not a feed", () => {
    const { items, quarantined } = parseFeed(`<rss><channel><item><title>A headline with nowhere to go at all</title><link>/relative</link></item></channel></rss>`, SOURCE);
    expect(items).toHaveLength(0);
    expect(quarantined[0]!.reason).toBe("no usable link");
    expect(() => parseFeed("<html><body>not a feed</body></html>", SOURCE)).toThrow(/not an RSS/);
  });

  it("refuses dates that are not dates, or are far in the future", () => {
    expect(feedDate("not a date")).toBeNull();
    expect(feedDate("Fri, 16 Oct 2099 15:00:00 GMT")).toBeNull();
    expect(feedDate("")).toBeNull();
  });
});

describe("retrying a failing source", () => {
  it("waits the normal interval after a success, and backs off after failures, capped at six hours", () => {
    const source = { key: "example", pollIntervalSeconds: 900 };
    expect(nextPollDelaySeconds(source, 0)).toBe(900);
    expect(nextPollDelaySeconds(source, 1)).toBeGreaterThanOrEqual(1800);
    expect(nextPollDelaySeconds(source, 2)).toBeGreaterThanOrEqual(3600);
    expect(nextPollDelaySeconds(source, 20)).toBeLessThanOrEqual(6 * 3600 + 60);
  });

  it("spreads retries without chance: the same source and attempt always wait the same", () => {
    const source = { key: "example", pollIntervalSeconds: 900 };
    expect(nextPollDelaySeconds(source, 3)).toBe(nextPollDelaySeconds(source, 3));
    // Different sources, same attempt: different offsets, so they do not all retry in the same second.
    const offsets = new Set(["a", "b", "c", "d", "e"].map((key) => nextPollDelaySeconds({ key, pollIntervalSeconds: 900 }, 3)));
    expect(offsets.size).toBeGreaterThan(1);
  });
});

describe("pacing requests to one host", () => {
  it("leaves a second between two requests to the same host, and none between different hosts", async () => {
    const { getFrom } = await import("@/lib/ingestion/http");
    const at: Record<string, number[]> = {};
    const fetchFn = async (url: string) => {
      (at[new URL(url).host] ??= []).push(Date.now());
      return new Response("ok");
    };
    const deadline = Date.now() + 10_000;
    await getFrom(fetchFn as never, "https://pace-a.example/1", { deadline });
    await getFrom(fetchFn as never, "https://pace-b.example/1", { deadline });
    await getFrom(fetchFn as never, "https://pace-a.example/2", { deadline });
    expect(at["pace-a.example"]![1]! - at["pace-a.example"]![0]!).toBeGreaterThanOrEqual(950);
    expect(at["pace-b.example"]![0]! - at["pace-a.example"]![0]!).toBeLessThan(500);
  });
});

describe("the Mastodon adapter", () => {
  it("leaves a post's links out of its words, and keeps its hashtags", async () => {
    const { postWords } = await import("@/lib/ingestion/adapters/mastodon");
    const html = `<p>Shots fired at a film star's car in Mumbai <a href="https://dlvr.it/l40jham4?utm_source=x" rel="nofollow"><span class="invisible">https://</span>dlvr.it/l40jham4</a> <a href="https://mastodon.social/tags/bollywood" class="mention hashtag" rel="tag">#<span>bollywood</span></a></p>`;
    const words = postWords(html);
    // Plurals fold, as they do for headlines: "shots" is "shot".
    expect(words).toEqual(expect.arrayContaining(["shot", "fired", "mumbai", "bollywood"]));
    expect(words.join(" ")).not.toMatch(/dlvr|l40jham4|utm|https/);
  });
});
