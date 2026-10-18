import type { MetadataRoute } from "next";

import { brand } from "@/config/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.shortName,
    description: brand.description,
    start_url: "/app",
    display: "standalone",
    icons: [
      { src: brand.assets.mark, sizes: "any", type: "image/svg+xml" },
      { src: brand.assets.icon192, sizes: "192x192", type: "image/png" },
      { src: brand.assets.icon512, sizes: "512x512", type: "image/png" },
      { src: brand.assets.maskable, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
