"use client";

import { useEffect } from "react";

/**
 * Reveals [data-reveal] sections as they scroll into view.
 *
 * Built to fail visible. The hiding rule in tokens.css applies only under a
 * `js-reveal` class that this component adds, and only to elements that are
 * still below the fold when it runs -- so with scripting off, on a slow
 * connection before hydration, or if the observer never fires, the page is
 * simply all there. A section left invisible is a worse outcome than a section
 * that did not animate.
 */
export function RevealController() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    // Either switch turns reveals off: the OS setting, or the reader's own choice here (Settings, Appearance).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (document.documentElement.dataset.motion === "reduce") return;

    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    // Anything already on screen is marked revealed BEFORE the class goes on,
    // so nothing the reader can see blinks out.
    for (const target of targets) {
      if (target.getBoundingClientRect().top < window.innerHeight * 0.92) target.dataset.revealed = "";
    }
    document.documentElement.classList.add("js-reveal");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.revealed = "";
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    for (const target of targets) if (!("revealed" in target.dataset)) observer.observe(target);

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("js-reveal");
    };
  }, []);
  return null;
}
