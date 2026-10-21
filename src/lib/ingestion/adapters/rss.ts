import { XMLParser } from "fast-xml-parser";

import { categorise } from "../classify";
import { getFrom } from "../http";
import { canonicalUrl, cleanTitle, domainOf, normalizeTitle, plainText } from "../normalize";
import type { MediaCandidate } from "../media";
import { SourceError, type IncomingItem, type Quarantined, type SourceAdapter, type SourceContext } from "../types";

/**
 * RSS 2.0, Atom and RSS 1.0 (RDF) feeds, read conditionally (ETag and
 * Last-Modified, so an unchanged feed costs the publisher a 304 and us
 * nothing).
 *
 * Feeds differ in what they bother to say, and nothing missing is invented:
 * PIB's items carry a title and a link and no date at all, so its items have
 * no publication time and say so on screen.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Values stay strings: a headline that is all digits, or "true", must not become a number or a boolean.
  parseTagValue: false,
  trimValues: true,
  // Entities are decoded by us (normalize.ts), once; the parser's own expansion is off so a feed cannot define entities that expand without limit.
  processEntities: false,
  isArray: (name) => name === "item" || name === "entry" || name === "link" || name === "category" || name === "dc:creator",
});


/** The text of a node that may be a string, an object with #text, or a CDATA-wrapped value. */
function text(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node.trim();
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (Array.isArray(node)) return text(node[0]);
  if (typeof node === "object") {
    const record = node as Record<string, unknown>;
    if ("#text" in record) return text(record["#text"]);
    if ("__cdata" in record) return text(record.__cdata);
  }
  return "";
}

/** A feed date to an ISO instant, or null for no date or a date that is not one. Never a guess. */
export function feedDate(value: string): string | null {
  const raw = value.replace(/^<!\[CDATA\[|\]\]>$/g, "").trim();
  if (!raw) return null;
  const instant = new Date(raw);
  if (Number.isNaN(instant.getTime())) return null;
  // A date more than a day ahead is a clock error at the source, not a publication time.
  if (instant.getTime() > Date.now() + 86_400_000 || instant.getUTCFullYear() < 2000) return null;
  return instant.toISOString();
}

function linkOf(item: Record<string, unknown>): string {
  const links = item.link as unknown;
  if (Array.isArray(links)) {
    // Atom: prefer rel="alternate" (or no rel); RSS: the element's text.
    const alternate = links.find((link) => typeof link === "object" && link && (!("@_rel" in link) || (link as Record<string, unknown>)["@_rel"] === "alternate"));
    const chosen = alternate ?? links[0];
    if (chosen && typeof chosen === "object" && "@_href" in (chosen as Record<string, unknown>)) return text((chosen as Record<string, unknown>)["@_href"]);
    return text(chosen).replace(/^<!\[CDATA\[|\]\]>$/g, "");
  }
  return text(links);
}

/** Entities in an attribute value, enough for a URL: NASA's feed writes "&#038;" between query parameters. */
function decodeAttribute(value: string): string {
  return value.replace(/&#0*38;|&amp;/g, "&").replace(/&#0*39;|&apos;/g, "'").replace(/&quot;/g, '"');
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
  const value = match?.[2] ?? match?.[3];
  return value ? decodeAttribute(value) : null;
}

/**
 * The one picture a feed item offers, as a CANDIDATE for the pipeline's
 * rule (lib/ingestion/media.ts), which decides whether it is kept. A media
 * element first, then the first image in the item's own HTML -- with its
 * figure caption, which is where a feed says whose picture it is.
 */
export function mediaOf(item: Record<string, unknown>): MediaCandidate | null {
  for (const key of ["media:content", "media:thumbnail", "enclosure"] as const) {
    const nodes = ([] as unknown[]).concat(item[key] ?? []);
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const record = node as Record<string, unknown>;
      const url = text(record["@_url"]);
      const type = text(record["@_type"]) || text(record["@_medium"]);
      if (url && (key !== "enclosure" || /^image\//.test(type))) {
        return { url: decodeAttribute(url), alt: text(record["media:description"]) || null, credit: text(record["media:credit"]) || null };
      }
    }
  }
  const html = (text(item["content:encoded"]) || text(item.description) || text(item.content)).replace(/^<!\[CDATA\[|\]\]>$/g, "");
  const figure = /<figure\b[\s\S]*?<\/figure>/i.exec(html)?.[0];
  const scope = figure && /<img\b/i.test(figure) ? figure : html;
  const tag = /<img\b[^>]*>/i.exec(scope)?.[0];
  if (!tag) return null;
  const url = attribute(tag, "src");
  if (!url) return null;
  const caption = figure ? plainText(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i.exec(figure)?.[1] ?? "") : "";
  return { url, alt: attribute(tag, "alt"), credit: /credit|courtesy|©|image:/i.test(caption) ? caption.slice(0, 200) : null };
}

/** An excerpt at most `max` characters, cut at a word, from whatever summary text the item carries. */
function excerptOf(item: Record<string, unknown>, max = 420): string | null {
  const raw = text(item.description) || text(item.summary) || text(item["content:encoded"]) || text(item.content);
  if (!raw) return null;
  let clean = plainText(raw.replace(/^<!\[CDATA\[|\]\]>$/g, ""));
  // arXiv prefixes every abstract with its identifier and "Announce Type"; the reader wants the abstract.
  clean = clean.replace(/^arXiv:\S+\s+Announce Type:\s*\S+\s*/i, "").replace(/^Abstract:\s*/i, "");
  if (clean.length < 20) return null;
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40)).trimEnd()}…`;
}

function authorOf(item: Record<string, unknown>): string | null {
  const creators = item["dc:creator"];
  const fromCreators = Array.isArray(creators) ? creators.map(text).filter(Boolean).join(", ") : text(creators);
  const author = fromCreators || text((item.author as Record<string, unknown> | undefined)?.name ?? item.author);
  const clean = plainText(author.replace(/^<!\[CDATA\[|\]\]>$/g, ""));
  return clean ? clean.slice(0, 300) : null;
}

/**
 * Per-source link repair, where a source's feed links to a view a reader
 * should not land on. Each one is named, with the reason.
 */
function readerLink(url: string): string {
  // PIB's feed links to the bare frame of a release; the release page is the same text inside PIB's own site.
  return url.replace(/^(https?:\/\/(?:www\.)?pib\.gov\.in)\/PressReleaseIframePage\.aspx/i, "$1/PressReleasePage.aspx");
}

/** The items of a parsed feed, whatever its dialect. */
function itemsOf(document: Record<string, unknown>): Record<string, unknown>[] {
  const rss = document.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  if (channel) return (channel.item as Record<string, unknown>[] | undefined) ?? [];
  const feed = document.feed as Record<string, unknown> | undefined;
  if (feed) return (feed.entry as Record<string, unknown>[] | undefined) ?? [];
  const rdf = document["rdf:RDF"] as Record<string, unknown> | undefined;
  if (rdf) return (rdf.item as Record<string, unknown>[] | undefined) ?? [];
  throw new SourceError("The response is not an RSS, Atom or RDF feed.");
}

/** Parse a feed body into items for this source. Pure: the fixture tests call it directly. */
export function parseFeed(xml: string, source: Pick<SourceContext, "canonicalDomain" | "contentType" | "language" | "countryOrRegion" | "categories" | "name">): { items: IncomingItem[]; quarantined: Quarantined[] } {
  let document: Record<string, unknown>;
  try {
    document = parser.parse(xml) as Record<string, unknown>;
  } catch {
    throw new SourceError("The feed is not well-formed XML.");
  }
  const items: IncomingItem[] = [];
  const quarantined: Quarantined[] = [];
  const india = source.countryOrRegion === "IN";
  for (const entry of itemsOf(document)) {
    const rawLink = linkOf(entry);
    const url = canonicalUrl(readerLink(rawLink));
    const rawTitle = plainText(text(entry.title).replace(/^<!\[CDATA\[|\]\]>$/g, ""));
    if (!url || !rawTitle) {
      if (quarantined.length < 20) quarantined.push({ reason: !url ? "no usable link" : "no title", sample: (rawTitle || rawLink).slice(0, 120) });
      continue;
    }
    const title = cleanTitle(rawTitle, source.canonicalDomain);
    // A description that only repeats the headline is not an excerpt (the Federal Reserve's are exactly their titles).
    let excerpt = excerptOf(entry);
    if (excerpt && normalizeTitle(excerpt).startsWith(normalizeTitle(title))) excerpt = null;
    const guid = text(entry.guid).replace(/^<!\[CDATA\[|\]\]>$/g, "") || text(entry.id);
    const published = feedDate(text(entry.pubDate) || text(entry["dc:date"]) || text(entry.published) || text(entry.updated));
    const updated = entry.updated ? feedDate(text(entry.updated)) : null;
    const ruleCategories = categorise({ title, india });
    items.push({
      providerItemId: (guid || url).slice(0, 500),
      url,
      title,
      excerpt,
      author: authorOf(entry),
      publisherDomain: domainOf(url) || source.canonicalDomain,
      publisherName: source.name,
      language: source.language,
      contentType: source.contentType,
      publishedAt: published,
      sourceUpdatedAt: updated && updated !== published ? updated : null,
      // The source's own section first (arXiv cs.AI is AI whatever its title says), then what the headline adds.
      categories: [...new Set([...source.categories, ...ruleCategories])],
      eventCountries: source.countryOrRegion.length === 2 ? [source.countryOrRegion] : [],
      indianStates: [],
      entities: [],
      metadata: {},
      media: mediaOf(entry),
    });
  }
  return { items, quarantined };
}

export const rssAdapter: SourceAdapter = {
  provider: "rss",
  async read(source, { fetch: fetchFn, deadline }) {
    const headers: Record<string, string> = { accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8" };
    if (source.etag) headers["if-none-match"] = source.etag;
    if (source.lastModified) headers["if-modified-since"] = source.lastModified;
    const response = await getFrom(fetchFn, source.feedUrl, { deadline, headers });
    if (response.status === 304) return { status: "not_modified", httpStatus: 304 };
    if (!response.ok) throw new SourceError(`The feed answered ${response.status}.`, response.status);
    const body = await response.text();
    if (body.length > 5_000_000) throw new SourceError("The feed is larger than any feed should be.");
    const { items, quarantined } = parseFeed(body, source);
    const newestAt = items.reduce<string | null>((newest, item) => (item.publishedAt && (!newest || item.publishedAt > newest) ? item.publishedAt : newest), null);
    return {
      status: "ok",
      httpStatus: response.status,
      items,
      quarantined,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      newestAt,
    };
  },
};

