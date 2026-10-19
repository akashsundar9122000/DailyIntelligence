"use client";

import { useEffect, type RefObject } from "react";

/**
 * Marks a sideways scroller with `data-more-start` / `data-more-end` while
 * there is content past that edge, for the `.scroll-fade` mask. Attributes,
 * not state: a scroll event per frame should not re-render the row.
 */
export function useScrollEdges(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    function measure() {
      if (!element) return;
      // A pixel of slack: a zoomed page reports fractional positions and never quite reaches the end.
      const start = element.scrollLeft > 1;
      const end = element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
      element.toggleAttribute("data-more-start", start);
      element.toggleAttribute("data-more-end", end);
    }
    measure();
    element.addEventListener("scroll", measure, { passive: true });
    const resize = new ResizeObserver(measure);
    resize.observe(element);
    return () => {
      element.removeEventListener("scroll", measure);
      resize.disconnect();
    };
  }, [ref]);
}
