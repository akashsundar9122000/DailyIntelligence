import type { ContentType, Provider, RightsStatus, SourceType } from "@/lib/db/schema/news";

/**
 * Every source the product has considered, and what was decided.
 *
 * THIS FILE IS THE RECORD OF THE RIGHTS REVIEW. Each entry's terms page was
 * read on `rightsCheckedOn`, and `operativeQuote` is copied from it. The rule
 * from the blueprint (§6.3) is that a source is fetched only when its terms
 * permit what we do; anything unclear stays `pending_review`, and anything
 * that says no is `excluded` and listed publicly with the reason. A feed
 * existing is not permission.
 *
 * The catalogue is mirrored into the `sources` table by the ingestion tick
 * (lib/ingestion/registry.ts); an administrator can withdraw a source in the
 * database without a deploy, and that wins. The database constraint
 * `sources_enabled_needs_clearance` refuses to enable anything not cleared.
 *
 * Engineering diligence, not legal advice. Docs: docs/SOURCE_RIGHTS.md.
 */
export type SourceDefinition = {
  key: string;
  name: string;
  /** How the reader sees it named in the directory, e.g. "Official · India". */
  kindLabel: string;
  canonicalDomain: string;
  sourceType: SourceType;
  provider: Provider;
  feedUrl: string;
  countryOrRegion: string;
  language: string;
  categories: string[];
  isOfficial: boolean;
  /** What each item from this source is, unless the adapter knows better. */
  contentType: ContentType;
  rights: {
    status: RightsStatus;
    termsUrl: string;
    checkedOn: string;
    commercialUse: boolean;
    headline: boolean;
    excerpt: boolean;
    aiSummary: boolean;
    media: boolean;
    attribution: string;
    /** A sentence for the public directory: why it is in, or why it is not. */
    note: string;
    operativeQuote: string;
    retentionDays: number | null;
  };
  /** Ask no more often than this. Set from the source's cadence and its rate limits, not from impatience. */
  pollIntervalSeconds: number;
  /** Lower runs first when a tick cannot reach everything. */
  priority: number;
  /** Provider-specific settings. Never a credential. */
  config?: Record<string, unknown>;
};

const CHECKED = "2026-10-18";

/** Sent with every request: who we are and where to complain. Some official sites refuse anything that looks like a bot farm. */
export const USER_AGENT = "DailyIntelligence/0.1 (news reader; contact via github.com/akashsundar9122000)";

/**
 * Publishers whose terms forbid what we do. GDELT indexes them like anyone
 * else, so an item from one of these domains is dropped at ingestion, before
 * it is stored: GDELT licenses its own data, not the publishers' headlines.
 */
export const EXCLUDED_PUBLISHER_DOMAINS = [
  "thehindu.com",
  "thehindubusinessline.com",
  "indianexpress.com",
  "timesofindia.indiatimes.com",
  "economictimes.indiatimes.com",
  "indiatimes.com",
  "ndtv.com",
  "bbc.co.uk",
  "bbc.com",
  "esa.int",
] as const;

export const SOURCE_CATALOGUE: SourceDefinition[] = [
  /* ------------------------------------------------------------- cleared */
  {
    key: "gdelt-gkg",
    name: "The GDELT Project",
    kindLabel: "World news index",
    canonicalDomain: "gdeltproject.org",
    sourceType: "aggregator",
    provider: "gdelt_gkg",
    feedUrl: "https://data.gdeltproject.org/gdeltv2/lastupdate.txt",
    countryOrRegion: "global",
    language: "en",
    categories: [],
    isOfficial: false,
    contentType: "report",
    rights: {
      status: "cleared",
      termsUrl: "https://www.gdeltproject.org/about.html",
      checkedOn: CHECKED,
      commercialUse: true,
      headline: true,
      excerpt: false,
      aiSummary: false,
      media: false,
      attribution: "Data: The GDELT Project (gdeltproject.org)",
      note: "GDELT's own data is free for any use with a citation. It points to other publishers' articles, so we show only their headline, site, time and a link, never their text or images, and drop publishers whose terms forbid it.",
      operativeQuote:
        "all datasets released by the GDELT Project are available for unlimited and unrestricted use for any academic, commercial, or governmental use of any kind without fee. ... any use or redistribution of the data must include a citation to the GDELT Project and a link to this website",
      retentionDays: 30,
    },
    // GDELT publishes a new file every fifteen minutes; asking sooner gets the same file.
    pollIntervalSeconds: 900,
    priority: 10,
    config: { maxItemsPerRun: 400 },
  },
  {
    key: "pib-english",
    name: "Press Information Bureau",
    kindLabel: "Official · India",
    canonicalDomain: "pib.gov.in",
    sourceType: "official",
    provider: "rss",
    feedUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3&reg=3",
    countryOrRegion: "IN",
    language: "en",
    categories: ["india-politics"],
    isOfficial: true,
    contentType: "official_statement",
    rights: {
      status: "cleared",
      termsUrl: "https://www.pib.gov.in/ContentPage.aspx?lang=1&menuid=794&reg=23",
      checkedOn: CHECKED,
      commercialUse: true,
      headline: true,
      excerpt: true,
      aiSummary: true,
      media: false,
      attribution: "Source: Press Information Bureau, Government of India",
      note: "The Government of India's press releases. PIB permits reproduction without prior approval, accurately and with prominent acknowledgement. Shown as official statements, never as independent reporting.",
      operativeQuote:
        "Material featured on this website may be reproduced free of charge and there is no need for any prior approval for using the content. The permission to reproduce this material shall not extend to any third-party material. ... the source must be prominently acknowledged.",
      retentionDays: null,
    },
    pollIntervalSeconds: 900,
    priority: 20,
  },
  ...(["cs.AI", "cs.CL", "cs.LG", "cs.CV"] as const).map(
    (category, index): SourceDefinition => ({
      key: `arxiv-${category.toLowerCase().replace(".", "-")}`,
      name: `arXiv ${category}`,
      kindLabel: "Research · preprints",
      canonicalDomain: "arxiv.org",
      sourceType: "research",
      provider: "rss",
      feedUrl: `https://rss.arxiv.org/rss/${category}`,
      countryOrRegion: "global",
      language: "en",
      categories: category === "cs.CV" ? ["ai", "technology"] : ["ai"],
      isOfficial: false,
      contentType: "preprint",
      rights: {
        status: "cleared",
        termsUrl: "https://info.arxiv.org/help/api/tou.html",
        checkedOn: CHECKED,
        commercialUse: true,
        headline: true,
        excerpt: true,
        aiSummary: true,
        media: false,
        attribution: "Source: arXiv.org (not endorsed by arXiv)",
        note: "Preprints in AI and machine learning. arXiv's metadata, abstracts included, is CC0. Labelled as preprints: not peer reviewed. We link to the abstract page and never store the paper.",
        operativeQuote:
          "You are free to use descriptive metadata about arXiv e-prints under the terms of the Creative Commons Universal (CC0 1.0) Public Domain Declaration. ... Descriptive metadata ... includes fields such as title, abstract, authors, identifiers, and classification terms.",
        retentionDays: 90,
      },
      // The listings change once a day, and arXiv asks for one request every three seconds at most.
      pollIntervalSeconds: 6 * 3600,
      priority: 60 + index,
    }),
  ),
  {
    key: "nasa-news",
    name: "NASA",
    kindLabel: "Official · United States",
    canonicalDomain: "nasa.gov",
    sourceType: "official",
    provider: "rss",
    feedUrl: "https://www.nasa.gov/news-release/feed/",
    countryOrRegion: "US",
    language: "en",
    categories: ["space", "science"],
    isOfficial: true,
    contentType: "official_statement",
    rights: {
      status: "cleared",
      termsUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
      checkedOn: CHECKED,
      commercialUse: true,
      headline: true,
      excerpt: true,
      aiSummary: true,
      media: false,
      attribution: "Source: NASA",
      note: "NASA's news releases are generally not under US copyright, and may be used factually without implying endorsement, with NASA acknowledged.",
      operativeQuote:
        "NASA content ... generally are not subject to copyright in the United States. ... NASA content used in a factual manner that does not imply endorsement may be used without needing explicit permission. NASA should be acknowledged as the source of the material.",
      retentionDays: null,
    },
    pollIntervalSeconds: 1800,
    priority: 40,
  },
  {
    key: "federal-reserve",
    name: "US Federal Reserve Board",
    kindLabel: "Official · United States",
    canonicalDomain: "federalreserve.gov",
    sourceType: "official",
    provider: "rss",
    feedUrl: "https://www.federalreserve.gov/feeds/press_all.xml",
    countryOrRegion: "US",
    language: "en",
    categories: ["business"],
    isOfficial: true,
    contentType: "official_statement",
    rights: {
      status: "cleared",
      termsUrl: "https://www.federalreserve.gov/disclaimer.htm",
      checkedOn: CHECKED,
      commercialUse: true,
      headline: true,
      excerpt: true,
      aiSummary: true,
      media: false,
      attribution: "Source: Board of Governors of the Federal Reserve System",
      note: "Press releases from the US central bank. Public domain unless marked otherwise, to be cited as the source.",
      operativeQuote:
        "Unless otherwise indicated, information on Board's website is in the public domain and may be copied and distributed without permission. Please cite to the Board as the source of the information.",
      retentionDays: null,
    },
    pollIntervalSeconds: 1800,
    priority: 45,
  },

  /* ------------------------------------------------------ pending review */
  {
    key: "rbi-press",
    name: "Reserve Bank of India",
    kindLabel: "Official · India",
    canonicalDomain: "rbi.org.in",
    sourceType: "official",
    provider: "rss",
    feedUrl: "https://www.rbi.org.in/pressreleases_rss.xml",
    countryOrRegion: "IN",
    language: "en",
    categories: ["business"],
    isOfficial: true,
    contentType: "official_statement",
    rights: {
      status: "pending_review",
      termsUrl: "https://www.rbi.org.in/Scripts/Disclaimer.aspx",
      checkedOn: CHECKED,
      commercialUse: false,
      headline: false,
      excerpt: false,
      aiSummary: false,
      media: false,
      attribution: "Source: Reserve Bank of India",
      note: "Waiting for permission: RBI's terms prohibit caching, and require permission before linking to any page other than its home page.",
      operativeQuote:
        "Except as set forth below, caching and links to, and the framing of this Web Site or any of the contents are prohibited. ... For hyper-Linking to an internal page of this Web Site (not being the Home Page) the user must make a specific request for, and secure permission from RBI prior to hyper-linking",
      retentionDays: null,
    },
    pollIntervalSeconds: 1800,
    priority: 30,
  },
  {
    key: "sebi",
    name: "Securities and Exchange Board of India",
    kindLabel: "Official · India",
    canonicalDomain: "sebi.gov.in",
    sourceType: "official",
    provider: "rss",
    feedUrl: "https://www.sebi.gov.in/sebirss.xml",
    countryOrRegion: "IN",
    language: "en",
    categories: ["business"],
    isOfficial: true,
    contentType: "official_statement",
    rights: {
      status: "pending_review",
      termsUrl: "https://www.sebi.gov.in/website-policy.html",
      checkedOn: CHECKED,
      commercialUse: false,
      headline: false,
      excerpt: false,
      aiSummary: false,
      media: false,
      attribution: "Source: Securities and Exchange Board of India (SEBI)",
      note: "Waiting for permission: SEBI allows its material to be reproduced after permission is requested by email. Linking needs none.",
      operativeQuote:
        "Material featured on this Website may be reproduced free of charge after taking proper permission by sending a mail to us. ... We do not object to you linking directly to the information that is hosted on this Website and no prior permission is required for the same.",
      retentionDays: null,
    },
    pollIntervalSeconds: 1800,
    priority: 35,
  },
  {
    key: "who-news",
    name: "World Health Organization",
    kindLabel: "Official · International",
    canonicalDomain: "who.int",
    sourceType: "official",
    provider: "rss",
    feedUrl: "https://www.who.int/rss-feeds/news-english.xml",
    countryOrRegion: "global",
    language: "en",
    categories: ["health"],
    isOfficial: true,
    contentType: "official_statement",
    rights: {
      status: "pending_review",
      termsUrl: "https://www.who.int/about/policies/terms-of-use",
      checkedOn: CHECKED,
      commercialUse: false,
      headline: false,
      excerpt: false,
      aiSummary: false,
      media: false,
      attribution: "Source: World Health Organization",
      note: "Not yet: WHO's website terms allow extracts for research and private study, not for use alongside commercial purposes, without written authorisation.",
      operativeQuote:
        "Extracts of the information in the web site may be reviewed, reproduced or translated for research or private study but not for sale or for use in conjunction with commercial purposes.",
      retentionDays: null,
    },
    pollIntervalSeconds: 1800,
    priority: 50,
  },
  {
    key: "bluesky-public",
    name: "Bluesky",
    kindLabel: "Social",
    canonicalDomain: "bsky.app",
    sourceType: "social",
    provider: "bluesky",
    feedUrl: "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed",
    countryOrRegion: "global",
    language: "en",
    categories: [],
    isOfficial: false,
    contentType: "social_post",
    rights: {
      status: "pending_review",
      termsUrl: "https://bsky.social/about/support/tos",
      checkedOn: CHECKED,
      commercialUse: false,
      headline: false,
      excerpt: false,
      aiSummary: false,
      media: false,
      attribution: "@handle on Bluesky, linked to the post",
      note: "Under review: authors keep their copyright and Bluesky's licence does not extend to other apps. Social Pulse will link to and embed posts through Bluesky's own embed, not copy them.",
      operativeQuote: "You retain ownership of your Content ... By sharing Content on Bluesky, you grant us a limited, worldwide, non-exclusive, royalty-free license",
      retentionDays: 7,
    },
    pollIntervalSeconds: 900,
    priority: 70,
  },
  {
    key: "mastodon-social",
    name: "mastodon.social",
    kindLabel: "Social",
    canonicalDomain: "mastodon.social",
    sourceType: "social",
    provider: "mastodon",
    feedUrl: "https://mastodon.social/api/v1/timelines/tag/",
    countryOrRegion: "global",
    language: "en",
    categories: [],
    isOfficial: false,
    contentType: "social_post",
    rights: {
      status: "pending_review",
      termsUrl: "https://mastodon.social/terms-of-service",
      checkedOn: CHECKED,
      commercialUse: false,
      headline: false,
      excerpt: false,
      aiSummary: false,
      media: false,
      attribution: "@user@mastodon.social, linked to the post",
      note: "Under review: each post belongs to its author and the server grants no licence to other apps. Social Pulse will link to and embed posts, not copy them.",
      operativeQuote: "Nothing in these terms gives us ownership of your Content. Whoever owns the Content retains ownership.",
      retentionDays: 7,
    },
    pollIntervalSeconds: 900,
    priority: 75,
  },

  /* ------------------------------------------------------------ excluded */
  ...(
    [
      ["the-hindu", "The Hindu", "thehindu.com", "https://www.thehindu.com/termsofuse/", "Its terms prohibit displaying or using content for commercial or public purposes.", "Users are prohibited from ... displaying, publishing ... or using any Content available on or through the Site for commercial or public purposes."],
      ["indian-express", "The Indian Express", "indianexpress.com", "https://indianexpress.com/rss/", "Its RSS feeds are for personal and non-commercial use only, and titles are named as protected.", "Consumption of content via these RSS feeds are strictly for personal and non-commercial use."],
      ["times-of-india", "The Times of India", "timesofindia.indiatimes.com", "https://timesofindia.indiatimes.com/rss.cms", "Its terms forbid displaying or aggregating its feeds.", "TIL forbids you from any attempts at displaying, hosting, aggregating, reselling or putting to commercial use ... TIL's RSS feeds"],
      ["ndtv", "NDTV", "ndtv.com", "https://www.ndtv.com/rss", "Its RSS terms could not be read (the page refused our request), so it stays out until they can be.", "Terms page not reachable for review."],
      ["bbc-news", "BBC News", "bbc.co.uk", "https://www.bbc.co.uk/usingthebbc/terms/can-i-share-things-from-the-bbc/", "Its terms require permission, and possibly a fee, for any business use.", "You'll need to get our permission first for any business use, and you might have to pay a fee."],
      ["esa", "European Space Agency", "esa.int", "https://www.esa.int/Services/Terms_and_conditions", "Its terms prohibit redistributing or displaying its content without written authorisation.", "ESA does not grant the right to resell or redistribute any information ... or to compile or create derivative works from material on its website."],
    ] as const
  ).map(
    ([key, name, domain, termsUrl, note, quote]): SourceDefinition => ({
      key,
      name,
      kindLabel: key === "esa" ? "Official · Europe" : "Publisher",
      canonicalDomain: domain,
      sourceType: key === "esa" ? "official" : "publisher",
      provider: "rss",
      feedUrl: termsUrl,
      countryOrRegion: key === "bbc-news" ? "GB" : key === "esa" ? "EU" : "IN",
      language: "en",
      categories: [],
      isOfficial: key === "esa",
      contentType: key === "esa" ? "official_statement" : "report",
      rights: {
        status: "excluded",
        termsUrl,
        checkedOn: CHECKED,
        commercialUse: false,
        headline: false,
        excerpt: false,
        aiSummary: false,
        media: false,
        attribution: "",
        note,
        operativeQuote: quote,
        retentionDays: null,
      },
      pollIntervalSeconds: 3600,
      priority: 100,
    }),
  ),
];

export type DirectoryEntry = { key: string; name: string; kind: string; note: string; termsUrl: string; status: RightsStatus; checkedOn: string };

/** The public directory: what is on the press, and what is not and why. */
export function publicDirectory(): { onPress: DirectoryEntry[]; notIncluded: DirectoryEntry[]; pending: DirectoryEntry[] } {
  const entry = (source: SourceDefinition): DirectoryEntry => ({
    key: source.key,
    name: source.name,
    kind: source.kindLabel,
    note: source.rights.note,
    termsUrl: source.rights.termsUrl,
    status: source.rights.status,
    checkedOn: source.rights.checkedOn,
  });
  // One line per publisher in the public list: the four arXiv categories are one source to a reader.
  const cleared = SOURCE_CATALOGUE.filter((source) => source.rights.status === "cleared");
  const onPress = cleared.filter((source, index) => cleared.findIndex((other) => other.canonicalDomain === source.canonicalDomain) === index).map(entry);
  const arxiv = onPress.find((line) => line.key.startsWith("arxiv-"));
  if (arxiv) arxiv.name = "arXiv (AI, language, learning and vision)";
  return {
    onPress,
    notIncluded: SOURCE_CATALOGUE.filter((source) => source.rights.status === "excluded").map(entry),
    pending: SOURCE_CATALOGUE.filter((source) => source.rights.status === "pending_review").map(entry),
  };
}

/** Whether an item from this publisher domain may be stored at all. Subdomains of an excluded domain are excluded. */
export function publisherAllowed(domain: string): boolean {
  const host = domain.toLowerCase().replace(/^www\./, "");
  return !EXCLUDED_PUBLISHER_DOMAINS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}
