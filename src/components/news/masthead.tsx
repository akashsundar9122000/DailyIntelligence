import Link from "next/link";

import { Mark, Wordmark } from "@/components/branding/logo";
import { cn } from "@/components/ui/cn";
import { brand } from "@/config/brand";
import { formatClock, formatDateline } from "@/lib/format/date";

/**
 * The nameplate, set like a broadsheet's: the name large and centred between
 * two rules, the dateline on one side and the edition's real update time on
 * the other. The update time is the newest successful source fetch, passed
 * in; with none, it says so rather than printing the time the page was drawn.
 */
export function Masthead({
  now,
  updatedAt,
  size = "lg",
  className,
}: {
  now: Date;
  updatedAt: string | null;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between gap-4 pb-2 text-[0.6875rem] font-semibold tracking-[0.12em] text-text-secondary uppercase">
        <span>{formatDateline(now.toISOString())}</span>
        <span className="hidden sm:inline">India &amp; World Edition</span>
        <span>{updatedAt ? <>Updated <time dateTime={updatedAt}>{formatClock(updatedAt)} IST</time></> : "Awaiting first report"}</span>
      </div>
      <div className="rule-thick" />
      <Link href="/" className="flex items-center justify-center gap-3 py-3 sm:gap-4 sm:py-4" aria-label={`${brand.name}, home`}>
        <Mark className={size === "lg" ? "size-10 sm:size-14" : "size-9"} />
        <Wordmark className={size === "lg" ? "text-[clamp(2rem,6.5vw,4.75rem)] leading-none" : "text-3xl leading-none"} />
      </Link>
      <div className="rule-double" />
      <p className="pt-2 text-center font-serif text-sm italic text-text-secondary">{brand.tagline}</p>
    </div>
  );
}
