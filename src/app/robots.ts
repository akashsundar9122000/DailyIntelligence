import type { MetadataRoute } from "next";

import { siteUrl } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // The signed-in product, the API and the development pages are nobody's search result.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/api", "/dev", "/login", "/signup", "/verify-email", "/reset-password", "/forgot-password"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
