import type { MetadataRoute } from "next";

import { siteUrl } from "@/config/site";

/** The public pages. Hand-maintained: add a public route here when one is added. */
export const PUBLIC_PAGES = ["/", "/sources", "/status", "/ai-policy", "/privacy", "/terms"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((path) => ({
    url: `${siteUrl}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.5,
  }));
}
