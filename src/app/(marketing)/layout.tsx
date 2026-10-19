import type { ReactNode } from "react";

import { RevealController } from "@/components/marketing/reveal";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-3 focus-visible:top-3 focus-visible:z-[var(--z-overlay)] focus-visible:bg-ink focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm focus-visible:text-on-ink"
      >
        Skip to content
      </a>
      <SiteHeader />
      {/*
        clip, not hidden: an entrance animation that starts off to one side made the document 431px wide
        on a 390px phone, so the page could be dragged sideways. `hidden` would also stop it, but it makes
        <main> a scroll container, and the pinned reading scene's sticky stage would stop pinning.
      */}
      <main id="main" tabIndex={-1} className="overflow-x-clip focus-visible:outline-none">
        {children}
      </main>
      <SiteFooter />
      <RevealController />
    </>
  );
}
