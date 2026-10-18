import { createHash } from "node:crypto";

/**
 * Turning what a source sent into what we compare and store. Pure functions,
 * no I/O: every rule here is unit-tested with the cases that broke it.
 */

/** Query parameters that identify a click, not a page. Two links differing only in these are one article. */
const TRACKING = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ref|ref_src|ref_url|cmpid|ito|ns_mchannel|ns_source|ns_campaign|ns_linkname|ns_fee|_ga|guccounter|guce_referrer|guce_referrer_sig|outputtype|amp|output)$/i;

/**
 * The address an article is known by: lower-case host without "www.", no
 * fragment, no tracking parameters, the remaining parameters sorted, no
 * trailing slash, and no "/amp" ending (an AMP copy is the same article).
 * The scheme is kept as given: forcing https onto a site that serves only
 * http would make the link we show broken.
 *
 * Returns null for anything that is not an absolute http(s) URL -- a relative
 * link in a feed cannot be safely resolved against a guess.
 */
export function canonicalUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.hash = "";
  url.username = "";
  url.password = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
  const kept = [...url.searchParams.entries()].filter(([key]) => !TRACKING.test(key)).sort(([a], [b]) => a.localeCompare(b));
  url.search = "";
  for (const [key, value] of kept) url.searchParams.append(key, value);
  let path = url.pathname.replace(/\/amp\/?$/i, "").replace(/\/+$/, "");
  if (path === "") path = "/";
  url.pathname = path;
  // The root keeps its slash ("https://site/"), as URL always writes it; every other path has none.
  return url.toString();
}

/** The duplicate key across sources: a hash of the canonical URL without its scheme, so http and https copies match. */
export function urlHash(canonical: string): string {
  return createHash("sha256").update(canonical.replace(/^https?:\/\//, "")).digest("hex");
}

/** The publisher's site from a URL: lower-case, without "www.". */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…" };

/** Decode the HTML entities feeds leave in titles, numeric and named. Unknown names are left as written. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** Plain text from a fragment of HTML: tags removed, entities decoded, whitespace collapsed. */
export function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * A title as a reader should see it: entities decoded, whitespace collapsed,
 * and a trailing " - Site Name" or " | Site Name" removed when it names the
 * publisher -- the publisher is shown beside the headline anyway, and the
 * suffix makes two copies of one headline look different.
 */
export function cleanTitle(raw: string, publisherHint?: string): string {
  let title = decodeEntities(raw).replace(/\s+/g, " ").trim();
  const suffix = /\s+[-–—|:]\s+([^-–—|:]{2,60})$/.exec(title);
  if (suffix) {
    const tail = suffix[1]!.toLowerCase().replace(/[^a-z0-9]/g, "");
    const hint = (publisherHint ?? "").toLowerCase().replace(/^www\./, "").split(".")[0]!.replace(/[^a-z0-9]/g, "");
    const looksLikeSite = /news|times|post|daily|express|herald|tribune|journal|today|online|\.com|\.in|bulletin|standard|chronicle|gazette/i.test(suffix[1]!);
    if ((hint.length >= 3 && tail.includes(hint)) || looksLikeSite) title = title.slice(0, suffix.index).trim();
  }
  return title;
}

const STOPWORDS = new Set(
  "a an and are as at be been but by for from has have he her his in into is it its of on or over says said she than that the their them they this to under was were what when where which who will with after amid against about before more new not out up how why can may could would should do does did its also just our your you we us".split(" "),
);

/** A title reduced for comparison: lower case, accents and punctuation gone, single spaces. Never shown. */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A plural folded to its singular, crudely and only where it is safe:
 * "floods" and "flood", "villages" and "village", "cities" and "city" are one
 * word to a reader, and two to a comparison that does not fold them. Words of
 * four letters or fewer, and words ending in "ss" ("press"), are left alone.
 */
function singular(token: string): string {
  if (token.length <= 4 || token.endsWith("ss") || token.endsWith("us") || token.endsWith("is")) return token;
  if (token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.endsWith("s")) return token.slice(0, -1);
  return token;
}

/** The words that carry a headline's meaning: no stopwords, no short words, plurals folded, each once. */
export function significantTokens(title: string): string[] {
  const tokens = normalizeTitle(title)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token) && !/^\d{1,3}$/.test(token))
    .map(singular);
  return [...new Set(tokens)];
}

/** The clustering key stored on a story: its significant words, sorted, so word order does not matter. */
export function titleSignature(title: string): string {
  return significantTokens(title).sort().join(" ");
}

/** Jaccard overlap of two sets of words: 1 is the same words, 0 is none in common. */
export function overlap(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const left = new Set(a);
  let shared = 0;
  for (const token of new Set(b)) if (left.has(token)) shared++;
  return shared / (left.size + new Set(b).size - shared);
}

/**
 * How much of the SHORTER headline the longer one contains, 0 to 1. Catches
 * one story told at two lengths -- "Trump endorses Netanyahu ahead of
 * elections" inside "Trump endorses embattled Israeli Prime Minister Benjamin
 * Netanyahu for reelection" -- which Jaccard overlap scores low because the
 * long one has so many more words.
 */
export function containment(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const left = new Set(a);
  const right = new Set(b);
  let shared = 0;
  for (const token of right) if (left.has(token)) shared++;
  return shared / Math.min(left.size, right.size);
}

/**
 * Whether two headlines report the same story, by their significant words.
 * At least three words in common, always (two short headlines sharing
 * "India" and "today" are not one story), and then either broad overlap or
 * the shorter headline mostly contained in the longer. Returns a confidence
 * 0-1, or null for "not the same story".
 */
export function sameStory(a: readonly string[], b: readonly string[]): number | null {
  const left = new Set(a);
  let shared = 0;
  for (const token of new Set(b)) if (left.has(token)) shared++;
  if (shared < 3) return null;
  const broad = overlap(a, b);
  const contained = containment(a, b);
  if (broad >= 0.4) return broad;
  if (contained >= 0.6) return Math.min(0.9, contained * 0.75);
  return null;
}
