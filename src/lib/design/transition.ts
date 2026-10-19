"use client";

/**
 * A change of look, animated. Full motion: the new look spreads in a circle
 * from where the reader clicked. Calm, or a change made from the keyboard: a
 * short crossfade. Reduced, or a browser without view transitions: instant.
 *
 * The change itself always happens -- the transition is decoration around
 * `apply`, never a condition on it.
 */

let lastPointer: { x: number; y: number; at: number } | null = null;

if (typeof window !== "undefined") {
  // Where the reader last pressed, so a click on a theme card can grow the new
  // look from that card. Capture phase: a control that stops propagation still
  // tells us where it was.
  window.addEventListener("pointerdown", (event) => {
    lastPointer = { x: event.clientX, y: event.clientY, at: event.timeStamp };
  }, { capture: true, passive: true });
}

function prefersStill(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce";
}

/** The pointer, if it was pressed in the last second -- otherwise the change came from a key or a script. */
function recentPointer(): { x: number; y: number } | null {
  if (!lastPointer || performance.now() - lastPointer.at > 1000) return null;
  return lastPointer;
}

export function withLookTransition(apply: () => void): void {
  const root = document.documentElement;
  if (prefersStill() || typeof document.startViewTransition !== "function") {
    apply();
    return;
  }

  const origin = root.dataset.motion === "calm" ? null : recentPointer();
  root.dataset.lookTransition = origin ? "reveal" : "fade";
  const transition = document.startViewTransition(apply);

  if (origin) {
    transition.ready
      .then(() => {
        const radius = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
        const duration = Number.parseFloat(getComputedStyle(root).getPropertyValue("--dur-slow")) || 560;
        root.animate(
          { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] },
          { duration, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
        );
      })
      // A transition skipped because another began is not an error: the look
      // has still been applied.
      .catch(() => undefined);
  }
  void transition.finished.finally(() => {
    delete root.dataset.lookTransition;
  });
}
