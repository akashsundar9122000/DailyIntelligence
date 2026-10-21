import { describe, expect, it } from "vitest";

import { mediaOf } from "@/lib/ingestion/adapters/rss";
import { acceptMedia } from "@/lib/ingestion/media";
import { SOURCE_CATALOGUE } from "@/lib/sources/catalogue";

import nextConfig from "../../next.config";

/*
 * Every item here is invented test markup, shaped like NASA's feed: the
 * picture sits in the item's HTML, inside a <figure>, with "&#038;" between
 * query parameters.
 */
const nasaItem = (figure: string) => ({
  title: "A release",
  "content:encoded": `<![CDATA[<p>Text.</p>${figure}<p>More.</p>]]>`,
});

const OWN = '<figure><img src="https://assets.science.nasa.gov/dynamicimage/x/mars.jpg?w=2048&#038;h=1365" alt="Dust over a crater rim"></figure>';

describe("the picture a feed item offers", () => {
  it("is the first image in the item's HTML, its URL decoded, with its alt text", () => {
    expect(mediaOf(nasaItem(OWN))).toEqual({ url: "https://assets.science.nasa.gov/dynamicimage/x/mars.jpg?w=2048&h=1365", alt: "Dust over a crater rim", credit: null });
  });

  it("carries the figure's credit when the caption gives one", () => {
    const item = nasaItem('<figure><img src="https://www.nasa.gov/wp-content/uploads/a.jpg" alt="A nebula"><figcaption>Image credit: ESA/Hubble</figcaption></figure>');
    expect(mediaOf(item)?.credit).toBe("Image credit: ESA/Hubble");
  });

  it("prefers a media element when the feed has one", () => {
    expect(mediaOf({ "media:content": { "@_url": "https://images-assets.nasa.gov/x.jpg", "@_medium": "image" } })?.url).toBe("https://images-assets.nasa.gov/x.jpg");
    expect(mediaOf({ enclosure: { "@_url": "https://example.test/a.mp3", "@_type": "audio/mpeg" } })).toBeNull();
  });

  it("is nothing when the item has no picture", () => {
    expect(mediaOf({ title: "A release", description: "Plain text only." })).toBeNull();
  });
});

describe("whether a picture may be kept", () => {
  it("keeps NASA's own picture from NASA's own asset host", () => {
    expect(acceptMedia("nasa-news", mediaOf(nasaItem(OWN)))).toEqual({ url: "https://assets.science.nasa.gov/dynamicimage/x/mars.jpg?w=2048&h=1365", alt: "Dust over a crater rim" });
    expect(acceptMedia("nasa-news", { url: "https://www.nasa.gov/x.jpg", alt: null, credit: "Credit: NASA/JPL-Caltech" })).not.toBeNull();
  });

  it("refuses a third party's picture, even on NASA's host: its terms say those are marked with their holder", () => {
    expect(acceptMedia("nasa-news", { url: "https://www.nasa.gov/x.jpg", alt: "A nebula", credit: "Image credit: ESA/Hubble" })).toBeNull();
    expect(acceptMedia("nasa-news", { url: "https://www.nasa.gov/x.jpg", alt: "© Example Observatory", credit: null })).toBeNull();
  });

  it("refuses NASA's insignia and logos, which are not in the public domain", () => {
    expect(acceptMedia("nasa-news", { url: "https://www.nasa.gov/wp-content/uploads/nasa-logo-web-rgb.png", alt: null, credit: null })).toBeNull();
    expect(acceptMedia("nasa-news", { url: "https://www.nasa.gov/x.png", alt: "The NASA insignia", credit: null })).toBeNull();
  });

  it("refuses a picture from any host but the source's own, or over plain http", () => {
    expect(acceptMedia("nasa-news", { url: "https://cdn.example.test/mars.jpg", alt: null, credit: null })).toBeNull();
    expect(acceptMedia("nasa-news", { url: "http://www.nasa.gov/x.jpg", alt: null, credit: null })).toBeNull();
  });

  it("keeps nothing at all from a source not cleared for media", () => {
    expect(acceptMedia("pib-english", { url: "https://www.pib.gov.in/x.jpg", alt: null, credit: null })).toBeNull();
    expect(acceptMedia("gdelt-gkg", { url: "https://publisher.example/x.jpg", alt: null, credit: null })).toBeNull();
    expect(acceptMedia("no-such-source", { url: "https://www.nasa.gov/x.jpg", alt: null, credit: null })).toBeNull();
  });
});

describe("the image optimiser's allowed hosts", () => {
  it("are exactly the media hosts of the sources cleared for media, and our own store: no more, no fewer", () => {
    const cleared = SOURCE_CATALOGUE.filter((source) => source.rights.status === "cleared" && source.rights.media).flatMap((source) => source.rights.mediaHosts ?? []);
    const allowed = (nextConfig.images?.remotePatterns ?? []).map((pattern) => ("hostname" in pattern ? pattern.hostname : ""));
    // Plus our own Blob store, where AI illustrations are kept: ours, not a source's.
    expect([...allowed].sort()).toEqual([...new Set(cleared), "*.public.blob.vercel-storage.com"].sort());
  });
});
