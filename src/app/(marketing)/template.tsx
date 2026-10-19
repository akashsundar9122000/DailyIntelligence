import { ViewTransition, type ReactNode } from "react";

/**
 * A template, not a layout: it mounts again on every navigation, so the page's
 * content leaves and the next one arrives (the `page` class in
 * src/styles/motion.css). The frame around it is named there and held still.
 *
 * `default="none"`: only entering and leaving animate. Without it this would
 * also animate on every unrelated transition on the page -- a change of look,
 * a Suspense reveal.
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page" exit="page" default="none">
      {children}
    </ViewTransition>
  );
}
