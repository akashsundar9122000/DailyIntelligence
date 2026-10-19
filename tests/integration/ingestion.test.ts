import { sql } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import pg from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closeDb } from "@/lib/db/client";
import { execRows, withSystem } from "@/lib/db/scope";
import { dateToStamp } from "@/lib/ingestion/adapters/gdelt-gkg";
import { runTick } from "@/lib/ingestion/pipeline";
import { frontPage, hotStories, searchStories, storyDetail } from "@/lib/queries/stories";
import { SOURCE_CATALOGUE } from "@/lib/sources/catalogue";

/*
 * The whole pipeline against the real test database, with the outside world
 * replaced by a fake fetch that serves recorded responses. Every headline
 * here is invented test text.
 */

afterAll(async () => {
  await closeDb();
});

async function ownerQuery<T extends pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
  const owner = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST_OWNER });
  await owner.connect();
  try {
    return (await owner.query<T>(text, values)).rows;
  } finally {
    await owner.end();
  }
}

/** A GKG line in the 2.1 column layout. */
function gkgLine(id: string, domain: string, path: string, title: string, india = true): string {
  const cols = new Array<string>(27).fill("");
  cols[0] = id;
  cols[2] = "1";
  cols[3] = domain;
  cols[4] = `https://${domain}/${path}`;
  cols[9] = india ? "4#Chennai, Tamil Nadu, India#IN#IN25#13#80#1;1#India#IN#IN#20#77#IN" : "1#France#FR#FR#46#2#FR";
  cols[26] = `<PAGE_PRECISEPUBTIMESTAMP>20261018100000</PAGE_PRECISEPUBTIMESTAMP><PAGE_TITLE>${title}</PAGE_TITLE>`;
  return cols.join("\t");
}

/** The newest GKG file is "now" rounded down to fifteen minutes, as the real index would name. */
const stamp = dateToStamp(new Date(Math.floor(Date.now() / 900_000) * 900_000 - 900_000));
const GKG_LINES = [
  gkgLine("g1", "alpha.example", "floods-1", "Floods cut off three villages in the hill district"),
  gkgLine("g2", "beta.example", "floods-2", "Three hill district villages cut off by floods"),
  gkgLine("g3", "gamma.example", "floods-3?utm_source=feed", "Floods cut off three villages in hill district, rescue under way"),
  // An excluded publisher: dropped before storage.
  gkgLine("g4", "thehindu.com", "floods-4", "Floods cut off three villages in the hill district area"),
  // A world story with an echo, and a lonely world story without one.
  gkgLine("g5", "delta.example", "summit", "Leaders gather for the coastal cities climate summit", false),
  gkgLine("g6", "epsilon.example", "summit-2", "Coastal cities climate summit gathers leaders", false),
  gkgLine("g7", "zeta.example", "garden", "A single site's own feature about winter gardening", false),
];

const RSS = (title: string, link: string) => `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>
  <item><title>${title}</title><link>${link}</link><description>A detailed description of the announcement for readers.</description></item></channel></rss>`;

/** Recorded answers, by URL. Anything not listed is a 404, as the real internet would be for a wrong address. */
function fakeInternet(overrides: Record<string, () => Response> = {}) {
  const calls: string[] = [];
  const routes: Record<string, () => Response> = {
    "https://fixtures.invalid/gdeltv2/lastupdate.txt": () => new Response(`1 h http://fixtures.invalid/gdeltv2/${stamp}.export.CSV.zip\n2 h http://fixtures.invalid/gdeltv2/${stamp}.gkg.csv.zip\n`),
    [`https://fixtures.invalid/gdeltv2/${stamp}.gkg.csv.zip`]: () => new Response(zipSync({ [`${stamp}.gkg.csv`]: strToU8(GKG_LINES.join("\n")) }), { headers: { "content-type": "application/zip" } }),
    "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3&reg=3": () =>
      new Response(RSS("Ministry announces relief for flood-hit hill district villages", "https://pib.gov.in/PressReleaseIframePage.aspx?PRID=1"), { headers: { etag: '"pib-1"' } }),
    ...overrides,
  };
  const fetchFn = async (input: string, init?: RequestInit) => {
    calls.push(input);
    const route = routes[input];
    if (input.startsWith("https://fixtures.invalid/") && !route) return new Response("", { status: 404 });
    if (!route) return new Response("", { status: 404 });
    if (input.includes("pib.gov.in") && (init?.headers as Record<string, string> | undefined)?.["if-none-match"] === '"pib-1"') return new Response(null, { status: 304 });
    return route();
  };
  return { fetchFn, calls };
}

beforeEach(async () => {
  await ownerQuery("truncate sources, raw_source_items, stories, story_items, story_updates, story_scores, ingestion_runs, job_runs cascade");
});

const counts = async () =>
  (
    await ownerQuery<{ items: number; stories: number; links: number; runs: number }>(
      `select (select count(*)::int from raw_source_items) as items, (select count(*)::int from stories) as stories,
              (select count(*)::int from story_items) as links, (select count(*)::int from ingestion_runs) as runs`,
    )
  )[0]!;

describe("a tick", () => {
  it("registers every catalogue source, switching on only the cleared ones that have an adapter", async () => {
    await runTick({ trigger: "test", budgetMs: 20_000, fetchFn: fakeInternet().fetchFn });
    const rows = await ownerQuery<{ key: string; enabled: boolean; rights_status: string }>("select key, enabled, rights_status from sources");
    expect(rows).toHaveLength(SOURCE_CATALOGUE.length);
    for (const row of rows) if (row.enabled) expect(row.rights_status).toBe("cleared");
    expect(rows.find((row) => row.key === "the-hindu")?.enabled).toBe(false);
    expect(rows.find((row) => row.key === "rbi-press")?.enabled).toBe(false);
  });

  it("stores what may be stored, drops excluded publishers, and clusters coverage into stories", async () => {
    const { detail } = await runTick({ trigger: "test", budgetMs: 20_000, fetchFn: fakeInternet().fetchFn });
    const gdelt = detail.sources.find((run) => run.source === "gdelt-gkg")!;
    // Seven lines: one excluded publisher, one lonely world story: five kept.
    expect(gdelt).toMatchObject({ status: "ok", fetched: 5, inserted: 5 });
    const domains = await ownerQuery<{ publisher_domain: string }>("select publisher_domain from raw_source_items");
    expect(domains.map((row) => row.publisher_domain)).not.toContain("thehindu.com");
    expect(domains.map((row) => row.publisher_domain)).not.toContain("zeta.example");

    // The three flood reports are one story. The ministry's relief announcement shares only three words
    // with them and stays its own story: the clusterer would rather keep two stories apart than merge two.
    const stories = await ownerQuery<{ headline: string; source_count: number; official_count: number; scope: string; indian_states: string[] }>(
      "select headline, source_count, official_count, scope, indian_states from stories order by source_count desc, headline",
    );
    expect(stories[0]).toMatchObject({ source_count: 3, official_count: 0, scope: "india", indian_states: ["TN"] });
    expect(stories.find((story) => story.headline.includes("summit"))?.source_count).toBe(2);
    expect(stories.find((story) => story.headline.startsWith("Ministry"))).toMatchObject({ official_count: 1, scope: "india" });
  });

  it("applies rights before writing: no excerpt kept from GDELT, an excerpt kept from PIB, no media from anyone", async () => {
    await runTick({ trigger: "test", budgetMs: 20_000, fetchFn: fakeInternet().fetchFn });
    const rows = await ownerQuery<{ key: string; excerpt: string | null; media_url: string | null; published_at: Date | null; canonical_url: string }>(
      "select s.key, r.excerpt, r.media_url, r.published_at, r.canonical_url from raw_source_items r join sources s on s.id = r.source_id",
    );
    for (const row of rows.filter((row) => row.key === "gdelt-gkg")) expect(row.excerpt).toBeNull();
    const pib = rows.find((row) => row.key === "pib-english")!;
    expect(pib.excerpt).toBe("A detailed description of the announcement for readers.");
    // PIB gives no date: none is invented.
    expect(pib.published_at).toBeNull();
    expect(pib.canonical_url).toBe("https://pib.gov.in/PressReleasePage.aspx?PRID=1");
    expect(rows.every((row) => row.media_url === null)).toBe(true);
    // Tracking parameters are gone from stored links.
    expect(rows.some((row) => row.canonical_url.includes("utm_"))).toBe(false);
  });

  it("is idempotent: running again stores nothing twice and makes no new stories", async () => {
    const internet = fakeInternet();
    await runTick({ trigger: "test", budgetMs: 20_000, fetchFn: internet.fetchFn });
    const first = await counts();
    // Make every source due again, and forget GDELT's cursor so the same file is read again.
    await ownerQuery("update sources set next_poll_at = now(), cursor = '{}'::jsonb");
    const { detail } = await runTick({ trigger: "test", budgetMs: 20_000, fetchFn: internet.fetchFn });
    const second = await counts();
    expect(second.items).toBe(first.items);
    expect(second.stories).toBe(first.stories);
    expect(second.links).toBe(first.links);
    expect(detail.sources.find((run) => run.source === "gdelt-gkg")).toMatchObject({ inserted: 0, duplicates: 5 });
    // PIB answered 304 to its own ETag: nothing read at all.
    expect(detail.sources.find((run) => run.source === "pib-english")?.status).toBe("not_modified");
  });

  it("moves GDELT's cursor only past files it read, and treats a file not yet published as nothing new", async () => {
    await runTick({ trigger: "test", budgetMs: 20_000, fetchFn: fakeInternet().fetchFn });
    const cursor = (await ownerQuery<{ cursor: { lastFile?: string } }>("select cursor from sources where key = 'gdelt-gkg'"))[0]!.cursor;
    expect(cursor.lastFile).toBe(stamp);
    await ownerQuery("update sources set next_poll_at = now() where key = 'gdelt-gkg'");
    // The next file 404s, as GDELT's knowledge-graph files do for an hour or two after the index names them.
    const { detail } = await runTick({ trigger: "test", budgetMs: 20_000, fetchFn: fakeInternet().fetchFn });
    expect(detail.sources.find((run) => run.source === "gdelt-gkg")?.status).toBe("not_modified");
    expect((await ownerQuery<{ cursor: { lastFile?: string } }>("select cursor from sources where key = 'gdelt-gkg'"))[0]!.cursor.lastFile).toBe(stamp);
  });

  it("records a failing source, backs it off, and carries on with the rest", async () => {
    const internet = fakeInternet({ "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3&reg=3": () => new Response("<html>gone</html>", { status: 500 }) });
    const { detail } = await runTick({ trigger: "test", budgetMs: 20_000, fetchFn: internet.fetchFn });
    expect(detail.sources.find((run) => run.source === "pib-english")).toMatchObject({ status: "failed", error: "The feed answered 500." });
    expect(detail.sources.find((run) => run.source === "gdelt-gkg")?.status).toBe("ok");
    const pib = (await ownerQuery<{ health_status: string; consecutive_failures: number; later: boolean; last_error: string }>(
      "select health_status, consecutive_failures, next_poll_at > now() + interval '20 minutes' as later, last_error from sources where key = 'pib-english'",
    ))[0]!;
    expect(pib).toMatchObject({ health_status: "degraded", consecutive_failures: 1, later: true, last_error: "The feed answered 500." });
    // The error column holds our sentence, never the body the source sent.
    expect(pib.last_error).not.toContain("<html>");
  });

  it("opens the circuit for an hour when a source says slow down", async () => {
    const internet = fakeInternet({ "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3&reg=3": () => new Response("", { status: 429 }) });
    await runTick({ trigger: "test", budgetMs: 20_000, fetchFn: internet.fetchFn });
    const pib = (await ownerQuery<{ open: boolean }>("select circuit_open_until > now() + interval '50 minutes' as open from sources where key = 'pib-english'"))[0]!;
    expect(pib.open).toBe(true);
  });

  it("records itself in job_runs, so a scheduler that stops is a visible gap", async () => {
    await runTick({ trigger: "test", budgetMs: 20_000, fetchFn: fakeInternet().fetchFn });
    const jobs = await ownerQuery<{ job: string; status: string }>("select job, status from job_runs");
    expect(jobs).toEqual([{ job: "tick", status: "OK" }]);
  });
});

describe("the first GDELT run", () => {
  const later = dateToStamp(new Date(Math.floor(Date.now() / 900_000) * 900_000 + 900_000));
  const index = (named: string) => () => new Response(`1 h http://fixtures.invalid/gdeltv2/${named}.export.CSV.zip\n2 h http://fixtures.invalid/gdeltv2/${named}.gkg.csv.zip\n`);
  const gdeltRun = async () =>
    (await ownerQuery<{ status: string; inserted: number; error: string | null }>(
      "select r.status, r.inserted, r.error from ingestion_runs r join sources s on s.id = r.source_id where s.key = 'gdelt-gkg'",
    ))[0]!;

  // Seen in production on 19 October 2026: the index named a file whose window had not closed, and the run stored nothing while reporting success.
  it("reads the newest file that exists when the index names one still to come", async () => {
    await runTick({ trigger: "test", budgetMs: 20_000, fetchFn: fakeInternet({ "https://fixtures.invalid/gdeltv2/lastupdate.txt": index(later) }).fetchFn });
    expect(await gdeltRun()).toMatchObject({ status: "ok", inserted: 5 });
    const cursor = (await ownerQuery<{ last: string }>("select cursor->>'lastFile' as last from sources where key = 'gdelt-gkg'"))[0]!;
    expect(cursor.last).toBe(stamp);
  });

  it("does not take a page that answers 200 for the file", async () => {
    const page = () => new Response("<html>Not here yet</html>", { headers: { "content-type": "text/html" } });
    const current = dateToStamp(new Date(Math.floor(Date.now() / 900_000) * 900_000));
    await runTick({
      trigger: "test",
      budgetMs: 20_000,
      fetchFn: fakeInternet({ "https://fixtures.invalid/gdeltv2/lastupdate.txt": index(current), [`https://fixtures.invalid/gdeltv2/${current}.gkg.csv.zip`]: page }).fetchFn,
    });
    expect(await gdeltRun()).toMatchObject({ status: "ok", inserted: 5 });
  });

  it("fails, saying what it tried, when no file exists -- never 'not modified'", async () => {
    await runTick({
      trigger: "test",
      budgetMs: 20_000,
      fetchFn: fakeInternet({ [`https://fixtures.invalid/gdeltv2/${stamp}.gkg.csv.zip`]: () => new Response("", { status: 404 }) }).fetchFn,
    });
    const run = await gdeltRun();
    expect(run.status).toBe("failed");
    expect(run.inserted).toBe(0);
    expect(run.error).toMatch(/^No knowledge-graph file in the last four hours \(UTC \d{4} 404, /);
  });
});

describe("what readers can see", () => {
  it("shows stories through their headline source's rights, and withdraws them when the source is withdrawn", async () => {
    await runTick({ trigger: "test", budgetMs: 20_000, fetchFn: fakeInternet().fetchFn });
    const before = await frontPage({}, 50);
    expect(before.length).toBeGreaterThan(0);
    const flood = before.find((story) => story.headline.toLowerCase().includes("flood"))!;
    expect(flood.sourceCount).toBe(3);
    const detail = await storyDetail(flood.id);
    expect(detail?.sources.map((source) => source.publisher)).not.toContain("thehindu.com");
    expect(detail?.score?.heatComponents).toHaveProperty("velocity");

    // An administrator withdraws GDELT: every story it headlines disappears at once, from every query.
    await ownerQuery("update sources set rights_status = 'pending_review', enabled = false where key = 'gdelt-gkg'");
    const after = await frontPage({}, 50);
    expect(after.every((story) => story.sourceKey !== "gdelt-gkg")).toBe(true);
    expect(await hotStories({}, 50)).toEqual(after.length ? expect.any(Array) : []);
    expect(await storyDetail(after.find((story) => story.id === flood.id)?.id ?? flood.id)).toBeNull();
  });

  it("finds a story by any of its publishers' wording", async () => {
    await runTick({ trigger: "test", budgetMs: 20_000, fetchFn: fakeInternet().fetchFn });
    const results = await searchStories({ query: "rescue" });
    expect(results.map((story) => story.headline.toLowerCase())).toEqual(expect.arrayContaining([expect.stringContaining("flood")]));
    expect(await searchStories({ query: "x" })).toEqual([]);
  });

  it("lets the public role read stories but never write them", async () => {
    await runTick({ trigger: "test", budgetMs: 20_000, fetchFn: fakeInternet().fetchFn });
    const { withPublic, withUser } = await import("@/lib/db/scope");
    await expect(withPublic((tx) => tx.execute(sql`update stories set heat = 100`))).resolves.toBeDefined();
    const unchanged = await ownerQuery<{ n: number }>("select count(*)::int as n from stories where heat = 100");
    expect(unchanged[0]!.n).toBe(0);
    await expect(withUser("00000000-0000-4000-8000-000000000099", (tx) => tx.execute(sql`insert into sources (id, key, name, canonical_domain, source_type, provider, feed_url, country_or_region) values (gen_random_uuid(), 'x', 'x', 'x', 'publisher', 'rss', 'x', 'IN')`))).rejects.toThrow();
    const rows = await withSystem("test", (tx) => execRows<{ n: number }>(tx, sql`select count(*)::int as n from sources where key = 'x'`));
    expect(rows[0]!.n).toBe(0);
  });
});
