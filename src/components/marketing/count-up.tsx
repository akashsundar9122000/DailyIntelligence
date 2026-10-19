"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A number that counts up to its value as it comes into view.
 *
 * The server renders the final value, so with scripting off -- or reduced
 * motion, or a number already on screen when the page loads -- it is simply
 * the number. Only a number still below the fold is set back to zero, and it
 * counts up once it is reached. A screen reader hears the value, never the
 * count: the moving digits are hidden from it.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce") return;
    if (element.getBoundingClientRect().top < window.innerHeight) return;

    let frame = 0;
    setShown(0);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const duration = 1100;
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          // Ease out: fast at first, settling on the value.
          setShown(Math.round(value * (1 - (1 - t) ** 3)));
          if (t < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span ref={ref} className={className}>
      <span aria-hidden>{shown}</span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
