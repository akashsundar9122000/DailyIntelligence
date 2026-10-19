import { unzipSync } from "fflate";

import { env } from "@/lib/env";
import { publisherAllowed } from "@/lib/sources/catalogue";

import { categorise, entitiesFromGkg } from "../classify";
import { placesFromGkgLocations } from "../geo";
import { getFrom } from "../http";
import { canonicalUrl, cleanTitle, decodeEntities, domainOf, significantTokens } from "../normalize";
import { SourceError, type IncomingItem, type Quarantined, type SourceAdapter } from "../types";

/**
 * The GDELT Global Knowledge Graph, read from its fifteen-minute files.
 *
 * WHY THE FILES AND NOT THE API: GDELT's DOC API refused us with 429 on the
 * first request ("one request every 5 seconds"). The files carry no rate limit,
 * and each holds every English article GDELT saw in that window, with its
 * title, its places, its people and organisations, and -- where the page said
 * -- its own publication time.
 *
 * WHY A CURSOR AND NOT lastupdate.txt: the index names the newest file the
 * moment it is planned, but the GKG file itself appears up to two hours later
 * (observed 2026-10-18: lastupdate named 17:45 while 17:00 and later answered
 * 404, and 15:00 was there). So the adapter walks forward from the last file
 * it read, takes each one that exists, and stops at the first that does not
 * exist yet. A 404 there is "not published yet", never a failure.
 *
 * WHAT IS KEPT: every article placed in India, and from the rest of the world
 * only articles that at least one OTHER publisher in the same file also wrote
 * about (two or more shared significant words with a different site). A single
 * site's story with no echo is noise at this volume -- about 675 articles per
 * file, 65,000 a day -- and storing all of it would fill the database in days.
 */

const FILE_MINUTES = 15;
const MAX_FILES_PER_RUN = 3;
/** On a first run, look back this far for the newest file that exists. */
const FIRST_RUN_LOOKBACK_FILES = 16;

/** GDELT's file stamp, YYYYMMDDHHMMSS in UTC, to an instant and back. */
export function stampToDate(stamp: string): Date {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(stamp);
  if (!m) throw new RangeError(`Not a GDELT stamp: ${stamp}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])));
}

export function dateToStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
}

export function nextStamp(stamp: string, steps = 1): string {
  return dateToStamp(new Date(stampToDate(stamp).getTime() + steps * FILE_MINUTES * 60_000));
}

/**
 * The newest stamp that can exist at `now`: the quarter-hour at or before it.
 * The index names the NEXT file before its window has closed (seen 19 October
 * 2026: at 02:42 UTC it named 02:45), and a start in the future is a run that
 * reads nothing.
 */
export function latestPossibleStamp(now: number): string {
  const quarter = FILE_MINUTES * 60_000;
  return dateToStamp(new Date(Math.floor(now / quarter) * quarter));
}

/**
 * Whether an answer is the file, not a page about the file. Only a partial
 * answer to the one-byte range, or a whole answer that says it is an archive,
 * counts: a CDN that answers 200 with an HTML error page must not pass for one.
 */
function isArchive(response: Response): boolean {
  if (response.status === 206) return true;
  return response.status === 200 && /zip|octet-stream/i.test(response.headers.get("content-type") ?? "");
}

/** The GKG file's stamp from lastupdate.txt: three lines of "size hash url"; the gkg line names the file. */
export function latestGkgStamp(index: string): string | null {
  const line = index.split("\n").find((entry) => /\.gkg\.csv\.zip\s*$/.test(entry));
  return /(\d{14})\.gkg\.csv\.zip/.exec(line ?? "")?.[1] ?? null;
}

function fileUrl(stamp: string): string {
  // The index lists http:// URLs that redirect to https. Ask for https directly.
  const base = env().GDELT_LASTUPDATE_URL.replace(/lastupdate\.txt$/, "");
  return `${base}${stamp}.gkg.csv.zip`;
}

/** A value from GDELT's V2EXTRASXML column, by tag. */
function extra(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  return match ? match[1]!.trim() : null;
}

export type GkgRow = IncomingItem & { tokens: string[]; india: boolean };

/**
 * One GKG line to an item, or a reason it was not one. Pure: given the same
 * line it gives the same answer, which is what the fixture tests rely on.
 */
export function parseGkgLine(line: string): GkgRow | { skip: string } {
  const cols = line.split("\t");
  if (cols.length < 27) return { skip: "malformed" };
  const [recordId, , collection, domainCol, documentUrl] = cols;
  if (collection !== "1") return { skip: "not a web article" };
  const url = canonicalUrl(documentUrl ?? "");
  if (!url) return { skip: "no usable URL" };
  const publisherDomain = (domainCol || domainOf(url)).toLowerCase().replace(/^www\./, "");
  if (!publisherAllowed(publisherDomain)) return { skip: "excluded publisher" };
  const extras = cols[26] ?? "";
  const rawTitle = extra(extras, "PAGE_TITLE");
  if (!rawTitle) return { skip: "no title" };
  const title = cleanTitle(rawTitle, publisherDomain);
  if (title.length < 20 || title.length > 300) return { skip: "title too short or too long" };

  const published = extra(extras, "PAGE_PRECISEPUBTIMESTAMP");
  let publishedAt: string | null = null;
  if (published && /^\d{14}$/.test(published)) {
    const instant = stampToDate(published);
    // A page that claims a time more than a day ahead, or before 2000, is a broken claim, not a time.
    if (instant.getTime() < Date.now() + 86_400_000 && instant.getUTCFullYear() >= 2000) publishedAt = instant.toISOString();
  }

  const places = placesFromGkgLocations(cols[9] ?? "");
  const india = places.countries.includes("IN");
  const themes = cols[7] ?? "";
  const author = extra(extras, "PAGE_AUTHORS");
  return {
    providerItemId: recordId ?? url,
    url,
    title,
    // GDELT carries no text of the article, and we would not keep it if it did.
    excerpt: null,
    author: author ? decodeEntities(author).slice(0, 200) : null,
    publisherDomain,
    publisherName: null,
    language: "en",
    contentType: "report",
    publishedAt,
    sourceUpdatedAt: null,
    categories: categorise({ title, india }),
    eventCountries: places.countries,
    indianStates: places.indianStates,
    entities: entitiesFromGkg(cols[11] ?? "", cols[13] ?? ""),
    metadata: { themes: themes.split(";").filter(Boolean).slice(0, 12) },
    tokens: significantTokens(title),
    india,
  };
}

/**
 * Which rows of one file to keep: India, and the rest of the world where a
 * second publisher echoes the story. Then at most `cap` in all, India first,
 * at most `perDomain` from any one site so one prolific site cannot fill the
 * paper.
 */
export function selectRows(rows: GkgRow[], { cap, perDomain = 6 }: { cap: number; perDomain?: number }): GkgRow[] {
  const echoed = new Set<GkgRow>();
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i]!;
      const b = rows[j]!;
      if (a.publisherDomain === b.publisherDomain) continue;
      let shared = 0;
      const set = new Set(a.tokens);
      for (const token of b.tokens) if (set.has(token) && ++shared >= 3) break;
      if (shared >= 3) {
        echoed.add(a);
        echoed.add(b);
      }
    }
  }
  const ordered = [...rows.filter((row) => row.india), ...rows.filter((row) => !row.india && echoed.has(row))];
  const perSite = new Map<string, number>();
  const kept: GkgRow[] = [];
  for (const row of ordered) {
    const count = perSite.get(row.publisherDomain) ?? 0;
    if (count >= perDomain) continue;
    perSite.set(row.publisherDomain, count + 1);
    kept.push(row);
    if (kept.length >= cap) break;
  }
  return kept;
}

/** A selected row without the two helpers selection needed; they are not part of an item. */
function toIncoming(row: GkgRow): IncomingItem {
  const item: Partial<GkgRow> = { ...row };
  delete item.tokens;
  delete item.india;
  return item as IncomingItem;
}

export const gdeltGkgAdapter: SourceAdapter = {
  provider: "gdelt_gkg",
  async read(source, { fetch: fetchFn, deadline }) {
    const cap = typeof source.config.maxItemsPerRun === "number" ? source.config.maxItemsPerRun : 150;
    let next: string;
    const last = typeof source.cursor.lastFile === "string" ? source.cursor.lastFile : null;
    if (last) {
      next = nextStamp(last);
    } else {
      // First run: find the newest file that exists, by walking back from what the index names.
      const index = await getFrom(fetchFn, env().GDELT_LASTUPDATE_URL, { deadline, timeoutMs: 10_000 });
      if (!index.ok) throw new SourceError(`The file index answered ${index.status}.`, index.status);
      const named = latestGkgStamp(await index.text());
      if (!named) throw new SourceError("The file index named no knowledge-graph file.");
      // Stamps are fixed-width digits, so they compare as strings.
      const ceiling = latestPossibleStamp(Date.now());
      next = named < ceiling ? named : ceiling;
      // Each stamp tried and what it answered, so a first run that finds nothing says exactly why.
      const tried: string[] = [];
      let found = false;
      for (let step = 0; step < FIRST_RUN_LOOKBACK_FILES; step++) {
        const probe = await getFrom(fetchFn, fileUrl(next), { deadline, timeoutMs: 10_000, headers: { range: "bytes=0-0" } });
        await probe.body?.cancel();
        tried.push(`${next.slice(8, 12)} ${probe.status}`);
        if (isArchive(probe)) {
          found = true;
          break;
        }
        next = nextStamp(next, -1);
      }
      // Never "not modified" on a first run: nothing has been read, so nothing can be unchanged.
      if (!found) throw new SourceError(`No knowledge-graph file in the last four hours (UTC ${tried.join(", ")}).`, 404);
    }

    const items: GkgRow[] = [];
    const quarantined: Quarantined[] = [];
    let readUpTo = last;
    let lastStatus = 200;
    for (let file = 0; file < MAX_FILES_PER_RUN; file++) {
      // Never ask for a file stamped in the future: it cannot exist yet.
      if (stampToDate(next).getTime() > Date.now()) break;
      const response = await getFrom(fetchFn, fileUrl(next), { deadline, timeoutMs: 25_000 });
      lastStatus = response.status;
      if (response.status === 404) break; // not published yet: try again next run
      if (!response.ok) throw new SourceError(`The file for ${next} answered ${response.status}.`, response.status);
      // A page standing in for a file that is not there yet is also "not published yet". Taking it as a damaged
      // archive would move the cursor past the file, and the real one would never be read.
      if (!isArchive(response)) {
        await response.body?.cancel();
        break;
      }
      const zipped = new Uint8Array(await response.arrayBuffer());
      let text: string;
      try {
        const files = unzipSync(zipped);
        const first = Object.values(files)[0];
        if (!first) throw new Error("empty archive");
        text = new TextDecoder("utf-8").decode(first);
      } catch {
        // A damaged file is skipped, not retried for ever: the cursor moves past it, and the skip is recorded.
        quarantined.push({ reason: "unreadable archive", sample: next });
        readUpTo = next;
        next = nextStamp(next);
        continue;
      }
      const rows: GkgRow[] = [];
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        const parsed = parseGkgLine(line);
        if ("skip" in parsed) {
          if (parsed.skip === "malformed" && quarantined.length < 20) quarantined.push({ reason: parsed.skip, sample: line.slice(0, 120) });
          continue;
        }
        rows.push(parsed);
      }
      items.push(...selectRows(rows, { cap: Math.max(0, cap - items.length) }));
      readUpTo = next;
      next = nextStamp(next);
      if (items.length >= cap || deadline - Date.now() < 8_000) break;
    }

    if (readUpTo === null) throw new SourceError(`The newest file, ${next}, answered ${lastStatus} when read.`, lastStatus);
    if (readUpTo === last) return { status: "not_modified", httpStatus: lastStatus };
    const newestAt = items.reduce<string | null>((newest, item) => (item.publishedAt && (!newest || item.publishedAt > newest) ? item.publishedAt : newest), null);
    return {
      status: "ok",
      httpStatus: 200,
      items: items.map(toIncoming),
      quarantined,
      cursor: { lastFile: readUpTo },
      newestAt,
    };
  },
};
