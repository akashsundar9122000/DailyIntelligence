"use client";

import { ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const EVERY_MS = 60_000;

/**
 * "N new stories" while a page is open. Polls once a minute only while the tab
 * is visible, and never moves the page by itself: new stories arrive when the
 * reader asks for them, so the line they were reading stays where it was.
 */
export function NewStories({ renderedAt, scope }: { renderedAt: string; scope?: "india" | "global" }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const since = useRef(renderedAt);

  useEffect(() => {
    since.current = renderedAt;
  }, [renderedAt]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    async function poll() {
      if (document.visibilityState === "visible") {
        try {
          const query = new URLSearchParams({ since: since.current, ...(scope ? { scope } : {}) });
          const response = await fetch(`/api/feed/pulse?${query}`, { cache: "no-store" });
          if (response.ok) {
            const body = (await response.json()) as { count: number };
            if (!stopped) setCount(body.count);
          }
        } catch {
          // Offline for a minute is not worth a message; the next poll tries again.
        }
      }
      if (!stopped) timer = setTimeout(poll, EVERY_MS);
    }
    timer = setTimeout(poll, EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [scope]);

  if (count === 0) return null;
  return (
    <div className="sticky top-2 z-[var(--z-sticky)] flex justify-center">
      <button
        type="button"
        onClick={() => {
          setCount(0);
          router.refresh();
          document.getElementById("content")?.scrollTo({ top: 0, behavior: "smooth" });
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className="inline-flex items-center gap-2 bg-ink px-4 py-2 text-sm font-semibold text-on-ink shadow-lg hover:bg-ink/90"
      >
        <ArrowUp className="size-4" aria-hidden />
        {count} new {count === 1 ? "story" : "stories"} · show
      </button>
    </div>
  );
}
