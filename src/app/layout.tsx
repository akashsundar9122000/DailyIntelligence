import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader, Playfair_Display } from "next/font/google";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/toast";
import { brand } from "@/config/brand";
import { siteUrl } from "@/config/site";
import { ThemeChrome } from "@/lib/design/theme";
import { themeScript } from "@/lib/design/theme-script";
import { NONCE_HEADER } from "@/proxy";
import { appearanceScript } from "@/lib/settings/apply";

import "./globals.css";

// Variable fonts, loaded without a `weight` array: passing one crashes Turbopack.
// Self-hosted by next/font, so a headline never re-flows when a fallback face is swapped out.
const ui = Geist({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const display = Playfair_Display({ subsets: ["latin"], variable: "--font-display-serif", display: "swap" });
const text = Newsreader({ subsets: ["latin"], variable: "--font-text-serif", display: "swap", style: ["normal", "italic"] });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${brand.name} — ${brand.tagline}`, template: `%s · ${brand.name}` },
  description: brand.description,
  applicationName: brand.name,
  icons: {
    icon: [{ url: brand.assets.mark, type: "image/svg+xml" }, { url: brand.assets.icon192, type: "image/png", sizes: "192x192" }],
    apple: [{ url: brand.assets.appleTouch, sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    siteName: brand.name,
    title: `${brand.name} — ${brand.tagline}`,
    description: brand.description,
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image", title: `${brand.name} — ${brand.tagline}`, description: brand.description },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the layout paint under a notch; the --safe-* tokens then pad it back.
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  return (
    <html lang={brand.locale} className={`${ui.variable} ${display.variable} ${text.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* The pre-paint theme script carries this request's nonce, or the policy set in src/proxy.ts would refuse it. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript + appearanceScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster />
        <ThemeChrome />
      </body>
    </html>
  );
}
