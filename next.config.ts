import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          /*
           * The directives that can be enforced without knowing every script the framework emits:
           * nothing may frame these pages, no <base> may re-point their relative links, no plugin
           * content, and a form may post only to this site. A script policy needs a nonce on every
           * inline script Next writes; it is recorded as outstanding in docs/KNOWN_LIMITATIONS.md.
           */
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // Nothing in the product needs a device sensor; deny rather than leave open.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
