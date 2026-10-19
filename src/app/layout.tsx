import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";
import {
  Archivo,
  Archivo_Narrow,
  Azeret_Mono,
  Bricolage_Grotesque,
  Geist,
  Geist_Mono,
  Inter,
  JetBrains_Mono,
  Manrope,
  Newsreader,
  Playfair_Display,
  Sofia_Sans_Condensed,
} from "next/font/google";
import type { ReactNode } from "react";

import { Atmosphere } from "@/components/ui/atmosphere";
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
//
// Every palette's faces are declared here; each palette picks its own through
// --face-* (src/styles/themes). A browser downloads a face only when text on
// the page is set in it, so an unchosen palette's faces cost nothing. Only the
// default palette's faces are PRELOADED -- a preload is a download whether the
// face is used or not.
const ui = Geist({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const text = Newsreader({ subsets: ["latin"], variable: "--font-text-serif", display: "swap", style: ["normal", "italic"] });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const display = Playfair_Display({ subsets: ["latin"], variable: "--font-display-serif", display: "swap", preload: false });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap", preload: false });
// Terminal
const sofiaCondensed = Sofia_Sans_Condensed({ subsets: ["latin"], variable: "--font-sofia-condensed", display: "swap", preload: false });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap", preload: false });
// Blueprint
const archivoNarrow = Archivo_Narrow({ subsets: ["latin"], variable: "--font-archivo-narrow", display: "swap", preload: false });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap", preload: false });
const azeret = Azeret_Mono({ subsets: ["latin"], variable: "--font-azeret", display: "swap", preload: false });
// Studio
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap", preload: false });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", preload: false });
const FONT_VARIABLES = [ui, text, bricolage, display, mono, sofiaCondensed, jetbrains, archivoNarrow, archivo, azeret, manrope, inter]
  .map((font) => font.variable)
  .join(" ");

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
    <html lang={brand.locale} className={FONT_VARIABLES} suppressHydrationWarning>
      <head>
        {/* The pre-paint theme script carries this request's nonce, or the policy set in src/proxy.ts would refuse it. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript + appearanceScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <Atmosphere />
        {children}
        <Toaster />
        <ThemeChrome />
      </body>
    </html>
  );
}
