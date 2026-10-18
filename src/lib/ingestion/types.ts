import type { ContentType, Provider } from "@/lib/db/schema/news";

/** One article, release, paper or post, as an adapter hands it to the pipeline. */
export type IncomingItem = {
  /** The source's own id, or the canonical URL when it has none. */
  providerItemId: string;
  url: string;
  title: string;
  /** The text the source offers alongside the title. The pipeline discards it unless the source's rights allow an excerpt. */
  excerpt: string | null;
  author: string | null;
  publisherDomain: string;
  publisherName: string | null;
  language: string;
  contentType: ContentType;
  /** ISO instants. Null when the source did not say: never filled with the time we fetched it. */
  publishedAt: string | null;
  sourceUpdatedAt: string | null;
  categories: string[];
  eventCountries: string[];
  indianStates: string[];
  entities: { kind: string; name: string }[];
  /** Small, safe facts worth keeping: a GDELT theme list, a feed category. Never an article body. */
  metadata: Record<string, unknown>;
};

export type Quarantined = { reason: string; sample: string };

export type FetchOutcome =
  | {
      status: "ok";
      httpStatus: number;
      items: IncomingItem[];
      quarantined: Quarantined[];
      /** Moved only when the run succeeds; handed back next time. */
      cursor?: Record<string, unknown>;
      etag?: string | null;
      lastModified?: string | null;
      /** The newest thing the source has published, for freshness. */
      newestAt?: string | null;
    }
  /** The source said nothing has changed (304), or has nothing new published yet. Not a failure. */
  | { status: "not_modified"; httpStatus: number; cursor?: Record<string, unknown> };

/** What an adapter is told about the source it is reading. Never a credential. */
export type SourceContext = {
  key: string;
  name: string;
  feedUrl: string;
  canonicalDomain: string;
  isOfficial: boolean;
  contentType: ContentType;
  language: string;
  countryOrRegion: string;
  categories: string[];
  etag: string | null;
  lastModified: string | null;
  cursor: Record<string, unknown>;
  config: Record<string, unknown>;
};

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface SourceAdapter {
  provider: Provider;
  read(source: SourceContext, options: { fetch: FetchFn; deadline: number }): Promise<FetchOutcome>;
}

/** A failure that is the source's fault and should count against its health. */
export class SourceError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number | null = null,
    /** True when the source asked us to slow down (429, 503 with Retry-After). Opens the circuit for longer. */
    readonly throttled = false,
  ) {
    super(message);
    this.name = "SourceError";
  }
}
