import { cn } from "@/components/ui/cn";
import { brand } from "@/config/brand";
import { D_PATH, GLOBE_PATH, MARK_VIEWBOX, SIGNAL } from "@/lib/brand/mark-geometry";

/**
 * The mark, drawn inline so its ink follows the theme (`currentColor`) and its
 * signal dot follows the press-red token. The static files in public/brand are
 * the same geometry (lib/brand/mark-geometry.ts) with the colours baked in, for
 * places CSS cannot reach: the favicon, the app icon, link previews.
 */
export function Mark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      className={cn("size-8 text-text-primary", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path fill="currentColor" fillRule="evenodd" d={D_PATH} />
      <path fill="currentColor" fillRule="evenodd" d={GLOBE_PATH} />
      <circle cx={SIGNAL.cx} cy={SIGNAL.cy} r={SIGNAL.r} className="fill-press-solid" />
    </svg>
  );
}

/**
 * The masthead wordmark: the name in the display serif. Set as text, not
 * outlined, so it is selectable and read correctly by a screen reader; the
 * font is self-hosted by next/font so it cannot fall back mid-load to a face
 * with different widths.
 */
export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("font-display font-bold tracking-[-0.01em] text-text-primary", className)}>{brand.name}</span>;
}

/** Mark and wordmark together, for the rail and the auth pages. */
export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Mark className={cn("size-8", markClassName)} />
      <Wordmark className="text-xl leading-none" />
    </span>
  );
}
